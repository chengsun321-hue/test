import express from 'express';
import session from 'express-session';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function createApp({ dataDir = path.resolve('.data'), secure = false } = {}) {
  fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true, mode: 0o700 });
  const dbPath = path.join(dataDir, 'content.json');
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({ categories: ['人像', '风光', '街头', '纪实'], works: [] }), { mode: 0o600 });
  const read = () => JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const save = (data) => { fs.writeFileSync(dbPath + '.tmp', JSON.stringify(data, null, 2), { mode: 0o600 }); fs.renameSync(dbPath + '.tmp', dbPath); };
  const credentialPath = path.join(dataDir, 'admin.json');
  if (!fs.existsSync(credentialPath)) {
    const password = crypto.randomBytes(18).toString('base64url');
    const salt = crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(credentialPath, JSON.stringify({ salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') }), { mode: 0o600 });
    fs.writeFileSync(path.join(dataDir, 'admin-initial-password.txt'), password + '\n', { mode: 0o600 });
  }
  const secretPath = path.join(dataDir, 'session-secret');
  if (!fs.existsSync(secretPath)) fs.writeFileSync(secretPath, crypto.randomBytes(48).toString('hex'), { mode: 0o600 });
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' }); next(); });
  app.use(express.json({ limit: '32kb' }));
  app.use(session({ secret: fs.readFileSync(secretPath, 'utf8'), resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'strict', secure, maxAge: 8 * 3600 * 1000 } }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) {
      const origin = req.get('origin');
      if (req.get('sec-fetch-site') === 'cross-site' || (origin && origin !== `${req.protocol}://${req.get('host')}`)) return res.status(403).json({ error: '不允许跨站请求' });
    }
    next();
  });
  const auth = (req, res, next) => req.session.admin ? next() : res.status(401).json({ error: '请先登录' });
  const attempts = new Map();
  app.post('/api/login', (req, res, next) => {
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.until < now) attempts.delete(key);
    const key = req.ip;
    const attempt = attempts.get(key) || { count: 0, until: now + 15 * 60000 };
    if (attempt.count >= 10) return res.status(429).json({ error: '尝试过多，请 15 分钟后再试' });
    const { salt, hash } = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
    const password = req.body?.password;
    if (typeof password !== 'string' || password.length > 200 || !crypto.timingSafeEqual(crypto.scryptSync(password, salt, 64), Buffer.from(hash, 'hex'))) {
      attempt.count++; attempts.set(key, attempt); return res.status(401).json({ error: '密码不正确' });
    }
    attempts.delete(key);
    req.session.regenerate(error => { if (error) return next(error); req.session.admin = true; res.json({ ok: true }); });
  });
  app.post('/api/logout', auth, (req, res, next) => req.session.destroy(error => { if (error) return next(error); res.clearCookie('connect.sid'); res.json({ ok: true }); }));
  app.get('/api/session', (req, res) => res.json({ admin: !!req.session.admin }));
  app.get('/api/content', (req, res) => { const data = read(); res.json({ ...data, works: data.works.filter(w => w.published) }); });
  app.get('/api/admin/content', auth, (req, res) => res.json(read()));
  app.get('/media/:filename', (req, res) => {
    const work = read().works.find(w => w.filename === req.params.filename && (w.published || req.session.admin));
    if (!work) return res.sendStatus(404);
    res.set('Cache-Control', 'private, no-store');
    res.sendFile(path.resolve(dataDir, 'uploads', work.filename));
  });
  app.post('/api/categories', auth, (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 30) return res.status(400).json({ error: '分类名称需要 1–30 个字符' });
    const data = read(); if (data.categories.includes(name)) return res.status(409).json({ error: '分类已存在' });
    data.categories.push(name); save(data); res.status(201).json({ ok: true });
  });
  app.delete('/api/categories/:name', auth, (req, res) => {
    const data = read(); const name = req.params.name;
    if (data.works.some(w => w.category === name)) return res.status(409).json({ error: '请先移动或删除此分类中的作品（包括草稿）' });
    data.categories = data.categories.filter(c => c !== name); save(data); res.json({ ok: true });
  });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 5 } });
  const fields = (body, data) => {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!title || title.length > 100 || description.length > 2000 || !data.categories.includes(body.category)) return null;
    return { title, description, category: body.category, published: body.published === true || body.published === 'true' };
  };
  app.post('/api/works', auth, upload.single('photo'), (req, res) => {
    const data = read(); const values = fields(req.body, data); const buf = req.file?.buffer;
    if (!values || !buf) return res.status(400).json({ error: '请填写标题、有效分类并选择照片' });
    let ext;
    if (buf.length >= 3 && buf.subarray(0, 3).equals(Buffer.from([255,216,255]))) ext = 'jpg';
    if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ext = 'png';
    if (buf.length >= 12 && buf.toString('ascii',0,4) === 'RIFF' && buf.toString('ascii',8,12) === 'WEBP') ext = 'webp';
    if (!ext) return res.status(400).json({ error: '仅支持 JPG、PNG 或 WebP 照片，最大 12MB' });
    const id = crypto.randomUUID(); const filename = `${id}.${ext}`;
    fs.writeFileSync(path.join(dataDir, 'uploads', filename), buf, { mode: 0o600 });
    const work = { id, filename, ...values, createdAt: new Date().toISOString() };
    try { data.works.unshift(work); save(data); } catch (error) { fs.unlinkSync(path.join(dataDir, 'uploads', filename)); throw error; }
    res.status(201).json(work);
  });
  app.patch('/api/works/:id', auth, (req, res) => {
    const data = read(); const work = data.works.find(w => w.id === req.params.id);
    if (!work) return res.status(404).json({ error: '作品不存在' });
    const values = fields(req.body, data); if (!values) return res.status(400).json({ error: '请检查标题、简介长度和分类' });
    Object.assign(work, values); save(data); res.json(work);
  });
  app.delete('/api/works/:id', auth, (req, res) => {
    const data = read(); const work = data.works.find(w => w.id === req.params.id);
    if (!work) return res.status(404).json({ error: '作品不存在' });
    data.works = data.works.filter(w => w.id !== work.id); save(data);
    fs.rmSync(path.join(dataDir, 'uploads', work.filename), { force: true }); res.json({ ok: true });
  });
  app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));
  app.use(express.static(path.resolve('dist')));
  app.get(['/', '/admin'], (req, res) => res.sendFile(path.resolve('dist/index.html')));
  app.use((error, req, res, next) => {
    const bad = error instanceof multer.MulterError || error instanceof SyntaxError;
    res.status(bad ? 400 : 500).json({ error: bad ? '请求无效，图片限制为 12MB，最多一张' : '服务器处理失败，请重试' });
  });
  return app;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, '0.0.0.0', () => console.log(`摄影作品集服务已启动，端口 ${port}。初始管理密码见 .data/admin-initial-password.txt（请勿提交）。`));
}

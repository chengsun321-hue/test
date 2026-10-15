import './style.css';
const root = document.querySelector('#app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let content = { categories: [], works: [] }; let filter = '全部'; let editing = null;
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.body && !(options.body instanceof FormData) ? {'Content-Type':'application/json'} : {}), ...options.headers } });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || '请求失败'); return data;
}
const post = (url, body, method='POST') => api(url, { method, body: JSON.stringify(body) });
const nav = `<header class="nav wrap"><a class="logo" href="/">孙程<span>SUN CHENG / PHOTOGRAPHY</span></a><nav><a href="/#works">摄影作品</a><a href="/#about">关于</a><a href="/#contact">联系 ↗</a></nav></header>`;
const footer = `<footer class="wrap footer"><span>© ${new Date().getFullYear()} 孙程摄影</span><span>用光影，收藏时间。</span><a href="/admin">管理后台 ↗</a></footer>`;
function notice(text, error=false) { const n=document.querySelector('#notice'); if(n){n.textContent=text;n.className=error?'notice error':'notice';} }
function gallery() {
  const works=content.works.filter(w=>filter==='全部'||w.category===filter);
  document.querySelector('#filters').innerHTML=['全部',...content.categories].map(c=>`<button class="filter ${filter===c?'active':''}" data-filter="${esc(c)}">${esc(c)}${c==='全部'?` <sup>${content.works.length}</sup>`:''}</button>`).join('');
  document.querySelector('#gallery').innerHTML=works.length?works.map((w,i)=>`<button class="photo-card" data-open="${esc(w.id)}"><div class="photo-frame"><img src="/media/${esc(w.filename)}" alt="${esc(w.title)}" loading="lazy"><span class="photo-open">↗</span></div><div class="photo-caption"><h3>${esc(w.title)}</h3><span>${esc(w.category)} / ${String(i+1).padStart(2,'0')}</span></div></button>`).join(''):`<div class="empty"><span>＋</span><h3>${filter==='全部'?'第一幅作品，即将入场。':'这一辑，等待新的故事。'}</h3><p>这里将展示孙程的真实摄影作品。<br>管理员可在后台上传照片并发布。</p><a class="text-link" href="/admin">进入管理后台 ↗</a></div>`;
}
function openWork(id) {
  const w=content.works.find(w=>w.id===id);if(!w)return;
  const dialog=document.createElement('dialog');dialog.className='lightbox';
  dialog.innerHTML=`<button class="close" aria-label="关闭作品详情">×</button><img src="/media/${esc(w.filename)}" alt="${esc(w.title)}"><div><span class="eyebrow">${esc(w.category)}</span><h2>${esc(w.title)}</h2><p class="description">${esc(w.description)}</p></div>`;
  document.body.append(dialog);dialog.querySelector('.close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});dialog.showModal();
}
async function publicPage() {
  root.innerHTML=`${nav}<main><section class="hero wrap"><div class="hero-top"><p class="eyebrow"><span class="dot"></span> 独立摄影 · 视觉叙事</p><span class="edition">PORTFOLIO — VOL. 01</span></div><h1>在日常里，<br>寻找<span class="serif">不寻常的光。</span><span class="hero-star">✳</span></h1><div class="hero-bottom"><p>我是孙程。以镜头为笔，记录人与风景。<br>让转瞬即逝的片刻，拥有被记住的形状。</p><a href="#works" class="circle-link" aria-label="浏览摄影作品">↓</a></div><div class="visual" aria-label="抽象光影设计，并非摄影作品"><div class="sun"></div><div class="mountain one"></div><div class="mountain two"></div><div class="visual-overlay"></div><span class="visual-note">LIGHT / SPACE / MOMENT</span><span class="visual-no">SC—001<br>光的练习 · 视觉序章</span></div></section><section class="works wrap" id="works"><div class="section-head"><div><p class="eyebrow">SELECTED PHOTOGRAPHS</p><h2>所见，所感。</h2></div><p>每一张照片，都是一次与世界的对话。</p></div><div class="filters" id="filters"></div><div id="notice" role="status" aria-live="polite"></div><div class="gallery" id="gallery"><p>正在加载作品…</p></div></section><section class="about wrap" id="about"><div><p class="eyebrow">BEHIND THE LENS</p><h2>镜头之后，<br>是对生活的好奇。</h2></div><div><p>你好，我是孙程。</p><p>我相信摄影不只是记录看见的东西，更是表达感受到的世界。留意光线的流动、人与空间的关系，也珍惜那些安静却动人的瞬间。</p><p class="muted">人像 / 风光 / 街头 / 纪实</p></div></section><section class="contact wrap" id="contact"><p class="eyebrow">LET’S MAKE SOMETHING MEANINGFUL</p><h2>下一个故事，<br>我们一起记录。</h2><p>欢迎摄影交流与合作。联系入口将在确认联系方式后开放。</p><a class="text-link" href="https://github.com/chengsun321-hue" target="_blank" rel="noopener noreferrer">通过 GitHub 找到我 ↗</a></section></main>${footer}`;
  try { content=await api('/api/content');gallery(); } catch(e){notice(e.message,true);document.querySelector('#gallery').innerHTML='<div class="empty"><h3>作品暂时无法加载</h3><p>请确认后端服务已启动，然后刷新页面。</p></div>';}
  root.addEventListener('click',e=>{const f=e.target.closest('[data-filter]');if(f){filter=f.dataset.filter;gallery();}const card=e.target.closest('[data-open]');if(card)openWork(card.dataset.open);});
}
function loginPage() {
  root.innerHTML=`${nav}<main class="login wrap"><div><p class="eyebrow">STUDIO ACCESS</p><h1>每个故事，<br>从这里开始。</h1><p class="muted">孙程摄影 · 作品管理</p></div><form id="login" class="panel"><h2>管理员登录</h2><p class="muted">使用本机生成的管理密码登录。</p><label for="password">管理密码</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="200" required><button class="btn" type="submit">进入工作室 ↗</button><p id="notice" role="status" aria-live="polite"></p><p class="hint">首次启动时，密码保存在项目的<br><code>.data/admin-initial-password.txt</code><br>请在本机查看，勿公开或提交。</p></form></main>${footer}`;
  document.querySelector('#login').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{await post('/api/login',{password:document.querySelector('#password').value});await adminPage();}catch(err){notice(err.message,true);}finally{b.disabled=false;}};
}
function options(selected=''){return content.categories.map(c=>`<option value="${esc(c)}" ${c===selected?'selected':''}>${esc(c)}</option>`).join('');}
function workForm(w=null) {
  editing=w?.id||null;
  const box=document.querySelector('#editor');
  box.innerHTML=`<div class="editor-title"><h2>${w?'编辑作品':'上传新作品'}</h2>${w?'<button id="cancel-edit" type="button" class="quiet">取消编辑</button>':''}</div><form id="work-form">${w?`<img class="edit-preview" src="/media/${esc(w.filename)}" alt="当前作品">`:'<label for="photo">照片 · JPG / PNG / WebP · 最大 12MB</label><input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required>'}<label for="title">作品标题</label><input id="title" name="title" maxlength="100" required value="${esc(w?.title||'')}"><label for="category">作品分类</label><select id="category" name="category" required>${options(w?.category)}</select><label for="description">作品简介</label><textarea id="description" name="description" maxlength="2000" rows="4">${esc(w?.description||'')}</textarea><label class="check"><input name="published" type="checkbox" ${w?.published?'checked':''}> 发布到前台（不勾选则保存为草稿）</label><button class="btn" ${!content.categories.length?'disabled':''}>${w?'保存修改':'上传作品'} ↗</button></form>`;
  box.querySelector('#cancel-edit')?.addEventListener('click',()=>workForm());
  box.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;notice('正在保存，请稍候…');try{
    const form=new FormData(e.target);form.set('published',String(form.get('published')==='on'));
    if(editing) await post('/api/works/'+editing,Object.fromEntries(form),'PATCH');else await api('/api/works',{method:'POST',body:form});
    await refreshAdmin();workForm();notice('作品已保存。');
  }catch(err){notice(err.message,true);}finally{button.disabled=false;}};
}
function adminLists() {
  document.querySelector('#stats').textContent=`${content.works.length} 幅作品 / ${content.works.filter(w=>w.published).length} 幅已发布`;
  document.querySelector('#categories').innerHTML=content.categories.map(c=>`<span class="category-chip">${esc(c)}<button type="button" data-delete-category="${esc(c)}" aria-label="删除分类 ${esc(c)}">×</button></span>`).join('')||'<p class="muted">请先添加分类</p>';
  document.querySelector('#work-list').innerHTML=content.works.map(w=>`<article class="admin-work"><img src="/media/${esc(w.filename)}" alt="${esc(w.title)}"><div><span class="badge ${w.published?'published':''}">${w.published?'已发布':'草稿'}</span><h3>${esc(w.title)}</h3><p>${esc(w.category)}</p><div class="actions"><button data-edit="${w.id}" class="quiet">编辑</button><button data-toggle="${w.id}" class="quiet">${w.published?'下架':'发布'}</button><button data-delete="${w.id}" class="quiet danger">删除</button></div></div></article>`).join('')||'<p class="empty-small">工作室还没有作品。上传你的第一张照片吧。</p>';
}
async function refreshAdmin(){content=await api('/api/admin/content');adminLists();}
async function adminPage() {
  root.innerHTML=`${nav}<main class="wrap admin"><div class="section-head"><div><p class="eyebrow">YOUR PHOTOGRAPHY STUDIO</p><h1>作品工作室<span class="small-dot">●</span></h1><p id="stats" class="muted"></p></div><div class="actions"><a class="quiet" href="/">查看前台 ↗</a><button id="logout" class="quiet">退出登录</button></div></div><p id="notice" role="status" aria-live="polite"></p><div class="admin-grid"><section class="panel" id="editor"></section><div><section class="panel category-panel"><h2>作品分类</h2><div id="categories"></div><form id="category-form" class="inline-form"><label class="sr-only" for="new-category">新分类名称</label><input id="new-category" maxlength="30" required placeholder="新分类名称"><button class="btn">添加</button></form></section><section class="panel"><h2>作品列表</h2><div id="work-list"></div></section></div></div></main>${footer}`;
  await refreshAdmin();workForm();
  document.querySelector('#logout').onclick=async()=>{try{await post('/api/logout',{});loginPage();}catch(e){notice(e.message,true);}};
  document.querySelector('#category-form').onsubmit=async e=>{e.preventDefault();try{await post('/api/categories',{name:document.querySelector('#new-category').value});e.target.reset();await refreshAdmin();workForm(content.works.find(w=>w.id===editing));notice('分类已添加');}catch(err){notice(err.message,true);}};
  document.querySelector('.admin-grid').onclick=async e=>{
    const b=e.target.closest('button');if(!b)return;
    try{
      if(b.dataset.edit){workForm(content.works.find(w=>w.id===b.dataset.edit));document.querySelector('#editor').scrollIntoView({behavior:'smooth',block:'start'});}
      if(b.dataset.toggle){const w=content.works.find(w=>w.id===b.dataset.toggle);await post('/api/works/'+w.id,{...w,published:!w.published},'PATCH');await refreshAdmin();if(editing===w.id)workForm(content.works.find(x=>x.id===w.id));notice(w.published?'作品已下架':'作品已发布');}
      if(b.dataset.delete&&confirm('确定永久删除这幅作品和照片文件？')){await api('/api/works/'+b.dataset.delete,{method:'DELETE'});await refreshAdmin();if(editing===b.dataset.delete)workForm();notice('作品已删除');}
      if(b.dataset.deleteCategory&&confirm('确定删除此分类？')){await api('/api/categories/'+encodeURIComponent(b.dataset.deleteCategory),{method:'DELETE'});await refreshAdmin();workForm(content.works.find(w=>w.id===editing));notice('分类已删除');}
    }catch(err){notice(err.message,true);}
  };
}
async function boot(){if(location.pathname==='/admin'){try{const s=await api('/api/session');if(s.admin)await adminPage();else loginPage();}catch(err){loginPage();notice('无法连接后端：'+err.message,true);}}else await publicPage();}
boot();

(() => {
  const cfg = window.YURUPAKA_SUPABASE || {};
  const hasConfig = Boolean(cfg.url && cfg.anonKey);
  const fallbackPosts = [{ id:'sample-blog', slug:'sample-blog', title:'ゆるパカ・ブログ準備中', category:'お知らせ', excerpt:'ブログ記事は準備中です。', body:'# ゆるパカ・ブログ準備中\n\n感性、アート、場づくりについての記事を掲載していきます。', cover_image:'', author_name:'ゆるパカ鑑賞会', published_at:new Date().toISOString(), status:'published' }];
  function esc(v){ return String(v || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s])); }
  function dt(v){ if(!v) return ''; const d = new Date(v); if(Number.isNaN(d.getTime())) return ''; return d.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric'}); }
  function ytId(url){ const s=String(url||''); const m=s.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/); return m ? m[1] : ''; }
  function inline(v){ return esc(v).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>'); }
  function paragraph(buf){ return buf.length ? '<p>'+inline(buf.join('\n')).replace(/\n/g,'<br>')+'</p>' : ''; }
  function renderMarkdown(md){
    const lines = String(md || '').replace(/\r\n/g,'\n').split('\n');
    const html=[]; let buf=[];
    const flush=()=>{ const p=paragraph(buf); if(p) html.push(p); buf=[]; };
    for(const raw of lines){
      const line = raw.trimEnd(); const trimmed=line.trim();
      if(!trimmed){ flush(); continue; }
      const card = trimmed.match(/^\[\[card:(https?:\/\/[^|\]]+)(?:\|([^\]]*))?(?:\|([^\]]*))?\]\]$/);
      if(card){ flush(); html.push('<a class="blog-card-link" href="'+esc(card[1])+'" target="_blank" rel="noopener"><strong>'+esc(card[2]||card[1])+'</strong><span>'+esc(card[3]||card[1])+'</span></a>'); continue; }
      const image = trimmed.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+|[^\s)]+)\)$/);
      if(image){ flush(); html.push('<figure><img src="'+esc(image[2])+'" alt="'+esc(image[1])+'"><figcaption>'+esc(image[1])+'</figcaption></figure>'); continue; }
      const id = ytId(trimmed);
      if(id && /^https?:\/\//.test(trimmed)){ flush(); html.push('<div class="blog-video"><iframe src="https://www.youtube.com/embed/'+esc(id)+'" title="YouTube video" loading="lazy" allowfullscreen></iframe></div>'); continue; }
      if(trimmed.startsWith('### ')){ flush(); html.push('<h3>'+inline(trimmed.slice(4))+'</h3>'); continue; }
      if(trimmed.startsWith('## ')){ flush(); html.push('<h2>'+inline(trimmed.slice(3))+'</h2>'); continue; }
      if(trimmed.startsWith('# ')){ flush(); html.push('<h1>'+inline(trimmed.slice(2))+'</h1>'); continue; }
      if(/^[-*] /.test(trimmed)){ flush(); html.push('<ul><li>'+inline(trimmed.slice(2))+'</li></ul>'); continue; }
      buf.push(line);
    }
    flush(); return html.join('');
  }
  async function client(){ if(!hasConfig || !window.supabase) return null; return window.supabase.createClient(cfg.url, cfg.anonKey); }
  async function loadPosts(){ const sb = await client(); if(!sb) return fallbackPosts; const r = await sb.from('blog_posts').select('*').eq('status','published').order('published_at',{ascending:false}).limit(60); if(r.error) throw r.error; return r.data && r.data.length ? r.data : fallbackPosts; }
  function card(post){ const img = post.cover_image ? '<img src="'+esc(post.cover_image)+'" alt="'+esc(post.title)+'">' : '<div class="blog-card-empty">ゆるパカ</div>'; return '<article class="blog-post-card"><a href="blog-detail.html?slug='+encodeURIComponent(post.slug || post.id)+'"><div class="blog-post-media">'+img+'</div><div class="blog-post-body"><span>'+esc(post.category || '未分類')+' / '+esc(dt(post.published_at))+'</span><h2>'+esc(post.title)+'</h2><p>'+esc(post.excerpt || '').slice(0,120)+'</p></div></a></article>'; }
  async function initList(){ const target=document.querySelector('[data-blog-list]'); if(!target) return; try{ const posts=await loadPosts(); const params=new URLSearchParams(location.search); const cat=params.get('category') || ''; const cats=[...new Set(posts.map(p=>p.category).filter(Boolean))]; const shown=cat ? posts.filter(p=>p.category===cat) : posts; const nav=document.querySelector('[data-blog-categories]'); if(nav) nav.innerHTML='<a class="'+(!cat?'active':'')+'" href="blog.html">すべて</a>'+cats.map(c=>'<a class="'+(cat===c?'active':'')+'" href="blog.html?category='+encodeURIComponent(c)+'">'+esc(c)+'</a>').join(''); target.innerHTML=shown.map(card).join('') || '<p>記事はまだありません。</p>'; } catch(e){ console.warn(e); target.innerHTML=fallbackPosts.map(card).join(''); } }
  async function initDetail(){ const target=document.querySelector('[data-blog-detail]'); if(!target) return; const params=new URLSearchParams(location.search); const key=params.get('slug') || params.get('id'); let post=null; try{ const sb=await client(); if(sb && key){ let r=await sb.from('blog_posts').select('*').eq('slug',key).maybeSingle(); if(!r.data) r=await sb.from('blog_posts').select('*').eq('id',key).maybeSingle(); if(r.error) throw r.error; post=r.data; } } catch(e){ console.warn(e); } if(!post) post=fallbackPosts[0]; document.title=post.title+' | ゆるパカ鑑賞会公式サイト'; const cover=post.cover_image ? '<img class="blog-cover" src="'+esc(post.cover_image)+'" alt="'+esc(post.title)+'">' : ''; target.innerHTML='<article class="blog-article"><p class="eyebrow">'+esc(post.category || 'BLOG')+'</p><h1>'+esc(post.title)+'</h1><p class="blog-meta">'+esc(post.author_name || 'ゆるパカ鑑賞会')+' / '+esc(dt(post.published_at))+'</p>'+cover+'<div class="blog-content">'+renderMarkdown(post.body || '')+'</div><a class="secondary" href="blog.html">ブログ一覧へ戻る</a></article>'; }
  document.addEventListener('DOMContentLoaded',()=>{ initList(); initDetail(); });
})();
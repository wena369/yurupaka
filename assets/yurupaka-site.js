(() => {
  const cfg = window.YURUPAKA_SUPABASE || {};
  const hasConfig = Boolean(cfg.url && cfg.anonKey);
  const fallbackNews = [{ id: 'sample-news', title: 'ゆるパカ鑑賞会からのお知らせ', excerpt: '最新情報は準備中です。開催予定や講座情報を順次掲載していきます。', body: 'ゆるパカ鑑賞会の最新情報をこちらに掲載していきます。', images: [], organizer_name: '江夏画廊', published_at: new Date().toISOString() }];
  const fallbackEvents = [{ id: 'sample-event', title: 'ゆるパカ鑑賞会 開催準備中', description: '開催日程が決まり次第、こちらに掲載します。', images: [], session_format: 'Zoom', starts_at: null, venue_name: 'Zoom', address: '', venue_address: '', organizer_name: '江夏画廊', signup_url: '#entry' }];
  function esc(v){ return String(v || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s])); }
  function imgs(v){ if(Array.isArray(v)) return v.filter(Boolean).slice(0,3); if(!v) return []; try { return JSON.parse(v).filter(Boolean).slice(0,3); } catch { return []; } }
  function dt(v){ if(!v) return '日程調整中'; const d = new Date(v); if(Number.isNaN(d.getTime())) return '日程調整中'; return d.toLocaleString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'}); }
  function dateValue(v, fallback){ const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d.getTime() : fallback; }
  function media(images, title){ const list = imgs(images); return list.length ? '<img src="'+esc(list[0])+'" alt="'+esc(title)+'">' : '<div class="dynamic-card-empty" aria-hidden="true">ゆるパカ</div>'; }
  function mergeRowsById(...groups){ const map = new Map(); groups.flat().filter(Boolean).forEach(row => { const key = row.id || JSON.stringify(row); map.set(key, {...(map.get(key) || {}), ...row}); }); return Array.from(map.values()); }
  function restHeaders(){ return { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey }; }
  async function restList(table, order, ascending, limit){
    if(!hasConfig) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    try {
      const params = new URLSearchParams();
      params.set('select','*');
      if(order) params.set('order', order + '.' + (ascending ? 'asc' : 'desc'));
      if(limit) params.set('limit', String(limit));
      const url = cfg.url.replace(/\/$/, '') + '/rest/v1/' + encodeURIComponent(table) + '?' + params.toString();
      const res = await fetch(url, { headers: restHeaders(), signal: controller.signal });
      const text = await res.text();
      if(!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 160));
      return text ? JSON.parse(text) : [];
    } finally { clearTimeout(timer); }
  }
  async function getNews(limit = 100){ const rows = await restList('news_posts','published_at',false,limit); return (rows || []).sort((a,b) => dateValue(b.published_at,0) - dateValue(a.published_at,0)); }
  async function getEvents(limit = 100){
    const groups = [];
    try { groups.push(await restList('calendar_events','starts_at',false,limit)); } catch(e){ console.warn(e); }
    try { groups.push(await restList('events','starts_at',false,limit)); } catch(e){ console.warn(e); }
    return mergeRowsById(...groups).sort((a,b) => dateValue(b.starts_at,0) - dateValue(a.starts_at,0));
  }
  function renderNews(target, data){ const items = data && data.length ? data : fallbackNews; target.innerHTML = items.map(item => '<article class="dynamic-card"><a href="/news-detail.html?id='+encodeURIComponent(item.id)+'"><div class="dynamic-card-media">'+media(item.images,item.title)+'</div><h3>'+esc(item.title)+'</h3></a><p>'+esc(item.excerpt || item.body || '').slice(0,96)+'</p><span>'+esc(item.organizer_name || item.author_email || 'ゆるパカ鑑賞会')+'</span></article>').join(''); }
  function renderEvents(target, data){ const items = data && data.length ? data : fallbackEvents; target.innerHTML = items.map(item => { const isZoom = String(item.session_format || '').toLowerCase().includes('zoom'); const venue = isZoom ? 'Zoom' : (item.venue_name || '会場調整中'); const address = item.venue_address || item.address || ''; const map = !isZoom && address ? '<a href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address)+'" target="_blank" rel="noopener">Googleマップ</a>' : ''; const signup = item.signup_url ? '<a class="dynamic-card-action" href="'+esc(item.signup_url)+'" target="_blank" rel="noopener">申込ページへ</a>' : ''; return '<article class="dynamic-card event-card"><div class="dynamic-card-media">'+media(item.images,item.title)+'</div><time>'+esc(dt(item.starts_at))+'</time><h3>'+esc(item.title)+'</h3><p>'+esc(item.description || '')+'</p><dl><div><dt>形式</dt><dd>'+esc(item.session_format || '未定')+'</dd></div><div><dt>会場</dt><dd>'+esc(venue)+'</dd></div>'+(!isZoom && address ? '<div><dt>住所</dt><dd>'+esc(address)+' '+map+'</dd></div>' : '')+'<div><dt>主催</dt><dd>'+esc(item.organizer_name || item.organizer_email || 'ゆるパカ鑑賞会')+'</dd></div></dl>'+signup+'</article>'; }).join(''); }
  function actionButton(target, href){ if(!target) return; target.innerHTML = '<a class="secondary" href="'+href+'">一覧を表示する</a>'; }
  async function initHome(){
    const ns = document.querySelectorAll('[data-yurupaka-news]');
    const es = document.querySelectorAll('[data-yurupaka-events]');
    if(!ns.length && !es.length) return;
    actionButton(document.querySelector('[data-news-more]'), 'news-list.html');
    actionButton(document.querySelector('[data-events-more]'), 'events-list.html');
    try {
      const [news, eventsAll] = await Promise.all([ns.length ? getNews(100) : null, es.length ? getEvents(100) : null]);
      const now = Date.now();
      const upcoming = (eventsAll || []).filter(item => dateValue(item.starts_at, 0) >= now).sort((a,b) => dateValue(a.starts_at, Number.MAX_SAFE_INTEGER) - dateValue(b.starts_at, Number.MAX_SAFE_INTEGER));
      ns.forEach(el => renderNews(el, (news || []).slice(0,3)));
      es.forEach(el => renderEvents(el, upcoming.slice(0,3)));
    } catch(e){ console.warn(e); ns.forEach(el => renderNews(el, [])); es.forEach(el => renderEvents(el, [])); }
  }
  async function initNewsList(){ const target = document.querySelector('[data-yurupaka-news-list]'); if(!target) return; try { const news = await getNews(100); renderNews(target, news); } catch(e){ console.warn(e); renderNews(target, []); } }
  async function initEventsList(){ const target = document.querySelector('[data-yurupaka-events-list]'); if(!target) return; try { const events = await getEvents(100); renderEvents(target, events); } catch(e){ console.warn(e); renderEvents(target, []); } }
  async function initDetail(){ const target = document.querySelector('[data-news-detail]'); if(!target) return; const id = new URLSearchParams(location.search).get('id'); let item = null; try { const rows = await getNews(100); item = rows.find(row => String(row.id) === String(id)); } catch(e){ console.warn(e); } if(!item) item = fallbackNews[0]; const list = imgs(item.images); target.innerHTML = '<article class="detail-article"><p class="eyebrow">WHAT&#39;S NEW</p><h1>'+esc(item.title)+'</h1><p class="detail-meta">'+esc(item.organizer_name || item.author_email || 'ゆるパカ鑑賞会')+' / '+esc(dt(item.published_at))+'</p>'+(list.length ? '<div class="detail-images">'+list.map(src => '<img src="'+esc(src)+'" alt="'+esc(item.title)+'">').join('')+'</div>' : '')+'<div class="detail-body">'+esc(item.body || item.excerpt || '').replace(/\n/g,'<br>')+'</div><a class="secondary" href="/news-list.html">一覧へ戻る</a></article>'; }
  document.addEventListener('DOMContentLoaded', () => { initHome(); initNewsList(); initEventsList(); initDetail(); });
})();

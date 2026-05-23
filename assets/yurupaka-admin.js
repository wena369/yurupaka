(() => {
  window.YURUPAKA_ADMIN_VERSION = '20260523-rest-lists';
  const cfg = window.YURUPAKA_SUPABASE || {};
  const status = document.querySelector('[data-admin-status]');
  const loginBox = document.querySelector('[data-login-form]');
  const emailLoginForm = document.querySelector('[data-email-login]');
  const googleButton = document.querySelector('[data-google-login]');
  const logoutButton = document.querySelector('[data-logout]');
  const adminPanel = document.querySelector('[data-admin-panel]');
  const labels = document.querySelectorAll('[data-organizer-label]');
  const adminLabel = document.querySelector('[data-admin-label]');
  const facilitatorForm = document.querySelector('[data-facilitator-form]');
  const newsList = document.querySelector('[data-news-list]');
  const eventList = document.querySelector('[data-event-list]');
  const blogList = document.querySelector('[data-blog-list]');
  const bucket = cfg.bucket || 'yurupaka-media';
  const eventTable = 'calendar_events';
  const ownerEmails = ['wena369@gmail.com'];
  const newsStatus = document.querySelector('[data-news-status]');
  const eventStatus = document.querySelector('[data-event-status]');
  const blogStatus = document.querySelector('[data-blog-status]');
  const facilitatorStatus = document.querySelector('[data-facilitator-status]');
  let sb = null; let user = null; let facilitator = null; let isAdmin = false; let authAccessToken = ''; let authRefreshToken = ''; 
  function setStatus(msg){ if(status) status.textContent = msg || ''; }
  function setFormStatus(el, msg){ if(el) el.textContent = msg || ''; setStatus(msg); }
  function withTimeout(promise, ms, label){ return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(label + 'がタイムアウトしました。通信、ログイン状態、またはSupabase側の設定を確認してください。')), ms))]); }
  function createClientWithToken(){
    const options = authAccessToken ? { global: { headers: { Authorization: 'Bearer ' + authAccessToken } } } : undefined;
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, options);
  }
  function configured(){ return Boolean(cfg.url && cfg.anonKey && window.supabase); }
  function loadScript(src, ms){
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (fn) => { if(done) return; done = true; clearTimeout(timer); fn(); };
      const timer = setTimeout(() => finish(() => reject(new Error('Supabase接続ライブラリの読み込みがタイムアウトしました。'))), ms || 5000);
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => finish(resolve);
      s.onerror = () => finish(() => reject(new Error(src + ' を読み込めませんでした。')));
      document.head.appendChild(s);
    });
  }
  async function ensureSupabase(){
    if(window.supabase) return true;
    const urls = [
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
      'https://unpkg.com/@supabase/supabase-js@2'
    ];
    for(const src of urls){
      try {
        setStatus('Supabase接続ライブラリを読み込んでいます...');
        await loadScript(src, 5000);
        if(window.supabase) return true;
      } catch(err){ console.warn(err); }
    }
    return false;
  }
  function baseName(){ return (user && (user.user_metadata?.full_name || user.user_metadata?.name || user.email)) || ''; }
  function organizerName(){ return facilitator?.name || baseName(); }
  function esc(v){ return String(v || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s])); }
  function canEdit(row, emailKey){ return isAdmin || (user && row && row[emailKey] === user.email); }
  function rowDate(v){ if(!v) return ''; const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('ja-JP'); }
  function cleanText(v, max = 2000){ return String(v || '').normalize('NFKC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max); }
  function authDebug(extra){
    const params = new URLSearchParams(location.search);
    const hash = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
    const details = [
      'URL: ' + location.href,
      'code: ' + (params.has('code') ? 'あり' : 'なし'),
      'query error: ' + (params.get('error_description') || params.get('error') || 'なし'),
      'hash access_token: ' + (hash.has('access_token') ? 'あり' : 'なし'),
      'user: ' + (user?.email || 'なし')
    ];
    if(extra) details.push(extra);
    if(status) status.innerHTML = '<strong>ログイン診断</strong><br>' + details.map(esc).join('<br>');
  }
  function decodeJwtPayload(token){
    try {
      const part = String(token || '').split('.')[1];
      if(!part) return null;
      const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for(let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return JSON.parse(new TextDecoder('utf-8').decode(bytes));
    } catch(err){
      console.warn('JWT decode failed', err);
      return null;
    }
  }
  function supabaseStorageKey(){
    try { return 'sb-' + new URL(cfg.url).hostname.split('.')[0] + '-auth-token'; }
    catch(_err){ return ''; }
  }
  function storeHashSessionFallback(hash){
    const access_token = hash.get('access_token');
    const refresh_token = hash.get('refresh_token');
    if(!access_token || !refresh_token) return false;
    const payload = decodeJwtPayload(access_token);
    const key = supabaseStorageKey();
    if(!payload || !key) return false;
    const session = {
      access_token,
      refresh_token,
      token_type: hash.get('token_type') || 'bearer',
      expires_in: Number(hash.get('expires_in') || 3600),
      expires_at: Number(hash.get('expires_at') || payload.exp || Math.floor(Date.now()/1000) + 3600),
      user: {
        id: payload.sub,
        aud: payload.aud,
        role: payload.role,
        email: payload.email,
        phone: payload.phone || '',
        app_metadata: payload.app_metadata || {},
        user_metadata: payload.user_metadata || {},
        identities: [],
        created_at: new Date((payload.iat || Math.floor(Date.now()/1000)) * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }
    };
    localStorage.setItem(key, JSON.stringify(session));
    user = session.user;
    return true;
  }
  async function completeAuthFromUrl(){
    const params = new URLSearchParams(location.search);
    const hash = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
    const err = params.get('error_description') || params.get('error') || hash.get('error_description') || hash.get('error');
    if(err){ authDebug('Supabaseからエラーが返っています: ' + err); return false; }
    const access = hash.get('access_token');
    const refresh = hash.get('refresh_token');
    if(access){
      const payload = decodeJwtPayload(access);
      authAccessToken = access;
      authRefreshToken = refresh || '';
      if(!payload){ authDebug('access_tokenを読み取れませんでした。最新版の反映、またはトークン期限を確認してください。'); return false; }
      if(payload){
        user = {
          id: payload.sub,
          aud: payload.aud,
          role: payload.role,
          email: payload.email,
          phone: payload.phone || '',
          app_metadata: payload.app_metadata || {},
          user_metadata: payload.user_metadata || {},
          created_at: new Date((payload.iat || Math.floor(Date.now()/1000)) * 1000).toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      try { sessionStorage.setItem('yurupaka_access_token', authAccessToken); sessionStorage.setItem('yurupaka_refresh_token', authRefreshToken); } catch(_err) {}
      createClientWithToken();
      history.replaceState(null, '', location.origin + location.pathname);
      return Boolean(user);
    }
    try {
      const stored = sessionStorage.getItem('yurupaka_access_token') || '';
      const storedRefresh = sessionStorage.getItem('yurupaka_refresh_token') || '';
      if(stored){
        const payload = decodeJwtPayload(stored);
        if(payload && (!payload.exp || payload.exp > Math.floor(Date.now()/1000))){
          authAccessToken = stored;
          authRefreshToken = storedRefresh;
          user = {
            id: payload.sub,
            aud: payload.aud,
            role: payload.role,
            email: payload.email,
            phone: payload.phone || '',
            app_metadata: payload.app_metadata || {},
            user_metadata: payload.user_metadata || {},
            created_at: new Date((payload.iat || Math.floor(Date.now()/1000)) * 1000).toISOString(),
            updated_at: new Date().toISOString()
          };
          createClientWithToken();
          return true;
        }
      }
    } catch(_err) {}
    const code = params.get('code');
    if(code && sb?.auth?.exchangeCodeForSession){
      try {
        const r = await withTimeout(sb.auth.exchangeCodeForSession(code), 6000, 'Googleログイン情報の受け取り');
        if(r.error){ authDebug('exchangeCodeForSession: ' + r.error.message); return false; }
        user = r.data?.user || r.data?.session?.user || null;
        history.replaceState(null, '', location.origin + location.pathname);
        return Boolean(user);
      } catch(e){ authDebug('exchangeCodeForSession例外: ' + e.message); return false; }
    }
    return false;
  }
  function showVersion(){ const versionLabel = document.querySelector('[data-version-label]'); if(versionLabel) versionLabel.textContent = '管理プログラム: ' + (window.YURUPAKA_ADMIN_VERSION || 'unknown'); }
  function render(){ showVersion(); const ok = Boolean(user); if(loginBox) loginBox.hidden = ok; if(adminPanel) adminPanel.hidden = !ok; if(logoutButton) logoutButton.hidden = !ok; if(facilitatorForm) facilitatorForm.hidden = !isAdmin; labels.forEach(el => el.textContent = organizerName() || '未ログイン'); if(adminLabel) adminLabel.textContent = isAdmin ? '管理者権限あり: ファシリテーター事前登録ができます。' : (facilitator ? '登録済みファシリテーターとして認識されています。' : 'このメールアドレスは未登録です。管理者に登録を依頼してください。'); if(ok) setStatus(organizerName()+' としてログイン中です。'); else authDebug('未ログイン判定です。Googleログイン後もここに表示される場合は、下の診断内容を確認してください。'); }
  function safeFile(n){ return String(n || 'image').replace(/[^a-zA-Z0-9._-]/g,'-'); }
  async function loadProfile(){
    facilitator = null;
    isAdmin = false;
    if(!sb || !user?.email) return;
    const email = user.email.toLowerCase();
    if(ownerEmails.includes(email)){ isAdmin = true; facilitator = { email, name: baseName() || email, profile: '管理者' }; return; }
    try {
      const f = await withTimeout(sb.from('facilitators').select('*').eq('email', email).maybeSingle(), 10000, 'ファシリテーター情報の確認');
      if(!f.error) facilitator = f.data || (ownerEmails.includes(email) ? { email, name: baseName() || email, profile: '管理者' } : null);
      else console.warn(f.error);
    } catch(err){ console.warn(err); }
    try {
      const a = await withTimeout(sb.from('admins').select('email').eq('email', email).maybeSingle(), 10000, '管理者権限の確認');
      if(!a.error && a.data) isAdmin = true; if(ownerEmails.includes(email)) isAdmin = true;
      else if(a.error) console.warn(a.error);
    } catch(err){ console.warn(err); }
  }
  function restHeaders(){
    const headers = { apikey: cfg.anonKey, Authorization: 'Bearer ' + (authAccessToken || cfg.anonKey) };
    return headers;
  }
  async function restList(table, order, ascending, limit){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const params = new URLSearchParams();
      params.set('select', '*');
      if(order) params.set('order', order + '.' + (ascending ? 'asc' : 'desc'));
      if(limit) params.set('limit', String(limit));
      const url = cfg.url.replace(/\/$/, '') + '/rest/v1/' + encodeURIComponent(table) + '?' + params.toString();
      const res = await fetch(url, { headers: restHeaders(), signal: controller.signal });
      const text = await res.text();
      if(!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 240));
      return text ? JSON.parse(text) : [];
    } catch(err){
      if(err && err.name === 'AbortError') throw new Error(table + ' の読み込みがタイムアウトしました。');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  function isMissingTableError(error){ return error && /Could not find the table|schema cache|relation .* does not exist/i.test(error.message || ''); }
  async function loadLists(){
    if(!cfg.url || !cfg.anonKey) return;
    const notices = [];
    if(newsList) newsList.innerHTML = '<p>What\'s New一覧を読み込んでいます...</p>';
    if(eventList) eventList.innerHTML = '<p>開催予定一覧を読み込んでいます...</p>';
    if(blogList) blogList.innerHTML = '<p>ブログ一覧を読み込んでいます...</p>';

    try {
      const news = await restList('news_posts', 'published_at', false, 100);
      renderNewsList(news || []);
    } catch(err) {
      notices.push('What\'s New一覧: ' + err.message);
      if(newsList) newsList.innerHTML = '<p>What\'s New一覧を読み込めません: '+esc(err.message)+'</p>';
      console.error(err);
    }

    try {
      let eventRows = [];
      try {
        eventRows = await restList(eventTable, 'starts_at', true, 100);
      } catch(newErr) {
        console.warn(newErr);
        eventRows = await restList('events', 'starts_at', true, 100);
      }
      renderEventList(eventRows || []);
    } catch(err) {
      notices.push('開催予定一覧: ' + err.message);
      if(eventList) eventList.innerHTML = '<p>開催予定一覧を読み込めません: '+esc(err.message)+'</p>';
      console.error(err);
    }

    try {
      const blogs = await restList('blog_posts', 'published_at', false, 100);
      renderBlogList(blogs || []);
    } catch(err) {
      if(isMissingTableError(err)){
        renderBlogList([]);
        if(blogList) blogList.innerHTML = '<p>ブログ用テーブル blog_posts がまだ作成されていません。ブログを使う場合はSupabaseで作成してください。</p>';
      } else {
        notices.push('ブログ一覧: ' + err.message);
        if(blogList) blogList.innerHTML = '<p>ブログ一覧を読み込めません: '+esc(err.message)+'</p>';
        console.error(err);
      }
    }
    if(notices.length) setStatus(notices.join(' / '));
    else if(user) setStatus(organizerName() + ' としてログイン中です。登録済み一覧を読み込みました。');
  }
  function renderNewsList(rows){
    if(!newsList) return;
    newsList.innerHTML = rows.length ? rows.map(row => { const actions = canEdit(row, 'author_email') ? '<div class="admin-list-actions"><button type="button" data-edit-news="'+row.id+'">編集</button><button type="button" data-delete-news="'+row.id+'">削除</button></div>' : '<div class="admin-list-note">閲覧のみ</div>'; return '<article class="admin-list-item"><div><strong>'+esc(row.title)+'</strong><span>'+esc(row.organizer_name || row.author_email || '')+' / '+esc(rowDate(row.published_at))+'</span></div>'+actions+'</article>'; }).join('') : '<p>登録済みのお知らせはありません。</p>';
  }
  function renderBlogList(rows){
    if(!blogList) return;
    blogList.innerHTML = rows.length ? rows.map(row => { const actions = canEdit(row, 'author_email') ? '<div class="admin-list-actions"><button type="button" data-edit-blog="'+row.id+'">編集</button><button type="button" data-delete-blog="'+row.id+'">削除</button></div>' : '<div class="admin-list-note">閲覧のみ</div>'; return '<article class="admin-list-item"><div><strong>'+esc(row.title)+'</strong><span>'+esc(row.category || '未分類')+' / '+esc(row.status || '')+' / '+esc(rowDate(row.published_at))+'</span></div>'+actions+'</article>'; }).join('') : '<p>登録済みのブログ記事はありません。</p>';
  }
  function renderEventList(rows){
    if(!eventList) return;
    eventList.innerHTML = rows.length ? rows.map(row => { const actions = canEdit(row, 'organizer_email') ? '<div class="admin-list-actions"><button type="button" data-edit-event="'+row.id+'">編集</button><button type="button" data-delete-event="'+row.id+'">削除</button></div>' : '<div class="admin-list-note">閲覧のみ</div>'; return '<article class="admin-list-item"><div><strong>'+esc(row.title)+'</strong><span>'+esc(row.session_format || '')+' / '+esc(rowDate(row.starts_at))+' / '+esc(row.organizer_name || row.organizer_email || '')+'</span></div>'+actions+'</article>'; }).join('') : '<p>登録済みの開催予定はありません。</p>';
  }
  async function fetchOne(table, id){ const r = await sb.from(table).select('*').eq('id', id).single(); if(r.error) throw r.error; return r.data; }
  async function removeRow(table, id){ const r = await sb.from(table).delete().eq('id', id); if(r.error) throw r.error; await loadLists(); }
  async function editNews(id){
    const row = await fetchOne('news_posts', id);
    const form = document.querySelector('[data-news-form]');
    form.dataset.editId = id;
    form.title.value = row.title || '';
    form.excerpt.value = row.excerpt || '';
    form.body.value = row.body || '';
    form.querySelector('button[type="submit"]').textContent = 'What\'s Newを更新';
    setFormStatus(newsStatus, '編集中です。画像を選ぶと追加・差し替えではなく、新しい画像セットとして保存します。');
    form.scrollIntoView({behavior:'smooth', block:'center'});
  }
  async function editBlog(id){
    const row = await fetchOne('blog_posts', id);
    const form = document.querySelector('[data-blog-form]');
    form.dataset.editId = id;
    form.title.value = row.title || '';
    form.slug.value = row.slug || '';
    form.category.value = row.category || '';
    form.excerpt.value = row.excerpt || '';
    form.cover_image.value = row.cover_image || '';
    form.body.value = row.body || '';
    form.status.value = row.status || 'published';
    form.querySelector('button[type="submit"]').textContent = 'ブログ記事を更新';
    setFormStatus(blogStatus, '編集中です。');
    form.scrollIntoView({behavior:'smooth', block:'center'});
  }
  async function editEvent(id){
    const row = await fetchOne(eventTable, id);
    const form = document.querySelector('[data-event-form]');
    form.dataset.editId = id;
    form.title.value = row.title || '';
    form.description.value = row.description || '';
    form.session_format.value = row.session_format || 'Zoom';
    form.starts_at.value = row.starts_at ? new Date(row.starts_at).toISOString().slice(0,16) : '';
    form.venue_name.value = row.venue_name || '';
    form.address.value = row.venue_address || row.address || '';
    form.signup_url.value = row.signup_url || '';
    form.querySelector('button[type="submit"]').textContent = '開催予定を更新';
    syncVenue();
    setFormStatus(eventStatus, '編集中です。画像を選ぶと追加・差し替えではなく、新しい画像セットとして保存します。');
    form.scrollIntoView({behavior:'smooth', block:'center'});
  }
  document.addEventListener('click', async e => {
    const en = e.target.closest('[data-edit-news]');
    const dn = e.target.closest('[data-delete-news]');
    const ee = e.target.closest('[data-edit-event]');
    const de = e.target.closest('[data-delete-event]');
    const eb = e.target.closest('[data-edit-blog]');
    const db = e.target.closest('[data-delete-blog]');
    try {
      if(en) await editNews(en.dataset.editNews);
      if(ee) await editEvent(ee.dataset.editEvent);
      if(eb) await editBlog(eb.dataset.editBlog);
      if(dn && confirm('このWhat\'s Newを削除しますか？')) await removeRow('news_posts', dn.dataset.deleteNews);
      if(de && confirm('この開催予定を削除しますか？')) await removeRow(eventTable, de.dataset.deleteEvent);
      if(db && confirm('このブログ記事を削除しますか？')) await removeRow('blog_posts', db.dataset.deleteBlog);
    } catch(err) { setStatus(err.message); console.error(err); }
  });
  function loadImageFile(file){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  async function compressImage(file, maxSize = 900, quality = 0.6){
    if(!file || !file.type || !file.type.startsWith('image/')) return file;
    if(file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
    const img = await loadImageFile(file);
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(img.src);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if(!blob) return file;
    const base = safeFile(file.name).replace(/.[^.]+$/, '');
    return new File([blob], base + '.jpg', { type: 'image/jpeg' });
  }
  async function upload(files, folder, statusEl){
    const out = [];
    for(const file of Array.from(files || []).slice(0,3)){
      setFormStatus(statusEl, '画像を軽量化しています...');
      const optimized = await withTimeout(compressImage(file), 20000, '画像の軽量化');
      const mediaFolder = cleanText(folder, 40) || 'news';
      const p = mediaFolder+'/'+user.id+'/'+Date.now()+'-'+safeFile(optimized.name);
      const sizeKb = Math.max(1, Math.round(optimized.size / 1024));
      setFormStatus(statusEl, '画像をアップロードしています...（約'+sizeKb+'KB / 共通保存先）');
      const r = await withTimeout(
        sb.storage.from(bucket).upload(p, optimized, { upsert:false, contentType:optimized.type || 'image/jpeg' }),
        15000,
        '画像アップロード'
      );
      if(r.error) throw r.error;
      out.push(sb.storage.from(bucket).getPublicUrl(p).data.publicUrl);
    }
    return out;
  }
  function makeId(){
    return (crypto?.randomUUID && crypto.randomUUID()) || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; const v = c === 'x' ? r : (r&0x3|0x8); return v.toString(16); });
  }
  async function restEvents(method, payload, query, prefer){
    const session = (await sb.auth.getSession()).data.session;
    if(!session?.access_token) throw new Error('ログイン状態を確認できません。再ログインしてください。');
    const endpoint = cfg.url.replace(/\/$/, '') + '/rest/v1/' + eventTable + (query || '');
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let done = false;
      const timer = setTimeout(() => {
        if(done) return;
        done = true;
        try { xhr.abort(); } catch(_err) {}
        reject(new Error('開催予定の保存がタイムアウトしました。calendar_eventsテーブルのRLS、trigger、必須列、またはDBロックを確認してください。'));
      }, 15000);
      function finish(fn){
        if(done) return;
        done = true;
        clearTimeout(timer);
        fn();
      }
      xhr.open(method, endpoint);
      xhr.timeout = 15000;
      xhr.setRequestHeader('apikey', cfg.anonKey);
      xhr.setRequestHeader('Authorization', 'Bearer ' + session.access_token);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Prefer', prefer || 'return=minimal');
      xhr.onload = () => {
        finish(() => {
          const text = xhr.responseText || '';
          if(xhr.status >= 200 && xhr.status < 300){
            try { resolve(text ? JSON.parse(text) : []); }
            catch(_err){ resolve([]); }
          } else {
            reject(new Error('開催予定の保存に失敗しました。HTTP ' + xhr.status + ': ' + text));
          }
        });
      };
      xhr.onerror = () => finish(() => reject(new Error('開催予定の保存に失敗しました。通信またはSupabase設定を確認してください。')));
      xhr.ontimeout = () => finish(() => reject(new Error('開催予定の保存がタイムアウトしました。calendar_eventsテーブルのRLS、trigger、必須列を確認してください。')));
      xhr.send(JSON.stringify(payload));
    });
  }
  async function init(){
    showVersion();
    setStatus('管理ページを初期化しています...');
    if(!configured()){
      setStatus('SupabaseのURLとanon key、またはSupabase接続ライブラリを読み込めていません。');
      return;
    }
    setStatus('Supabase接続を準備しています...');
    createClientWithToken();

    // Googleログイン後の #access_token は、表示や一覧読み込みより先に必ず処理します。
    setStatus('ログイン情報を確認しています...');
    await completeAuthFromUrl();

    try {
      if(!user){
        const s = await sb.auth.getSession();
        user = s.data?.session?.user || null;
      }
      if(!user){
        const r = await sb.auth.getUser();
        user = r.data.user || null;
      }
      if(user) await loadProfile(); else { facilitator = null; isAdmin = false; }
    } catch(err) {
      console.warn(err);
      if(!user){ facilitator = null; isAdmin = false; }
    }

    render();
    if(!user) authDebug('Googleログイン後もユーザー情報を取得できていません。');
    setStatus(user ? (organizerName()+' としてログイン中です。') : '登録済み一覧を読み込みました。ログイン情報は見つかっていません。');
    await loadLists();

    sb.auth.onAuthStateChange(async (_event, session) => {
      if(!authAccessToken){
        user = session?.user || null;
      }
      if(user) await loadProfile(); else { facilitator = null; isAdmin = false; }
      render();
      await loadLists();
    });
  }
  googleButton?.addEventListener('click', async () => {
    if(!sb) return;
    const redirectTo = location.origin + location.pathname;
    const r = await sb.auth.signInWithOAuth({ provider:'google', options:{ redirectTo } });
    if(r.error) setStatus(r.error.message);
  });
  emailLoginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    if(!sb) return;
    const email = new FormData(emailLoginForm).get('email');
    const emailRedirectTo = location.origin + location.pathname;
    const r = await sb.auth.signInWithOtp({ email, options:{ emailRedirectTo } });
    setStatus(r.error ? r.error.message : 'ログイン用リンクをメールで送信しました。');
  });
  logoutButton?.addEventListener('click', async () => { if(sb) await sb.auth.signOut(); try { sessionStorage.removeItem('yurupaka_access_token'); sessionStorage.removeItem('yurupaka_refresh_token'); } catch(_err) {} authAccessToken = ''; authRefreshToken = ''; user = null; facilitator = null; isAdmin = false; createClientWithToken(); render(); await loadLists(); });
  facilitatorForm?.addEventListener('submit', async e => { e.preventDefault(); if(!sb || !user || !isAdmin) return; const form = e.currentTarget; const fd = new FormData(form); try { if(!form.reportValidity()) return; setFormStatus(facilitatorStatus, 'ファシリテーターを登録しています...'); const email = String(fd.get('email')).trim().toLowerCase(); const photoFiles = form.querySelector('[name="photo"]').files; const photoUrls = await upload(photoFiles, 'facilitators', facilitatorStatus); const payload = { email, name:fd.get('name'), profile:fd.get('profile'), certification_status:fd.get('certification_status'), created_by:user.email }; if (photoUrls[0]) payload.photo_url = photoUrls[0]; const r = await sb.from('facilitators').upsert(payload, { onConflict:'email' }); if(r.error) throw r.error; form.reset(); setFormStatus(facilitatorStatus, 'ファシリテーターを登録しました。'); } catch(err){ setFormStatus(facilitatorStatus, err.message); console.error(err); }  });

  document.querySelector('[data-blog-form]')?.addEventListener('submit', async e => { e.preventDefault(); if(!sb || !user) return; const form = e.currentTarget; const fd = new FormData(form); try { if(!form.reportValidity()) return; setFormStatus(blogStatus, 'ブログ記事を保存しています...'); const title = cleanText(fd.get('title'), 160); const slugBase = cleanText(fd.get('slug'), 160) || title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || ('blog-'+Date.now()); const payload = { title, slug: slugBase, category: cleanText(fd.get('category'), 80) || '未分類', excerpt: cleanText(fd.get('excerpt'), 220), cover_image: cleanText(fd.get('cover_image'), 600), body: cleanText(fd.get('body'), 12000), status: fd.get('status') || 'published', author_name: organizerName(), author_email: user.email }; if(payload.status === 'published') payload.published_at = new Date().toISOString(); let r; if(form.dataset.editId){ r = await withTimeout(sb.from('blog_posts').update(payload).eq('id', form.dataset.editId), 20000, 'ブログ記事の更新'); } else { r = await withTimeout(sb.from('blog_posts').insert(payload), 20000, 'ブログ記事の登録'); } if(r.error) throw r.error; delete form.dataset.editId; form.querySelector('button[type="submit"]').textContent = 'ブログ記事を保存'; form.reset(); await loadLists(); setFormStatus(blogStatus, 'ブログ記事を保存しました。'); } catch(err){ setFormStatus(blogStatus, err.message); console.error(err); } });
  document.querySelector('[data-news-form]')?.addEventListener('submit', async e => { e.preventDefault(); if(!sb || !user) return; const form = e.currentTarget; const fd = new FormData(form); try { if(!form.reportValidity()) return; setFormStatus(newsStatus, 'What\'s Newを保存しています...'); const images = await upload(form.querySelector('[name="images"]').files, 'news', newsStatus); const payload = { title:fd.get('title'), excerpt:fd.get('excerpt'), body:fd.get('body'), organizer_name:organizerName(), author_email:user.email, facilitator_id:facilitator?.id || null }; if(images.length) payload.images = images; let r; if(form.dataset.editId){ setFormStatus(newsStatus, 'What\'s Newを更新しています...'); r = await withTimeout(sb.from('news_posts').update(payload).eq('id', form.dataset.editId), 20000, 'What\'s Newの更新'); } else { payload.published_at = new Date().toISOString(); if(!payload.images) payload.images = []; setFormStatus(newsStatus, 'What\'s Newを登録しています...'); r = await withTimeout(sb.from('news_posts').insert(payload), 20000, 'What\'s Newの登録'); } if(r.error) throw r.error; delete form.dataset.editId; form.querySelector('button[type="submit"]').textContent = 'What\'s Newを保存'; form.reset(); await loadLists(); setFormStatus(newsStatus, 'What\'s Newを保存しました。'); } catch(err){ setFormStatus(newsStatus, err.message); console.error(err); }  });
  document.querySelector('[data-event-form]')?.addEventListener('submit', async e => {
    e.preventDefault();
    if(!sb || !user) return;
    const form = e.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const fd = new FormData(form);
    const format = fd.get('session_format') || 'Zoom';
    const savedIdFromEdit = form.dataset.editId || '';
    const stage = async (label, patch, savedId) => {
      const keys = Object.keys(patch).filter(k => patch[k] !== undefined);
      if(!keys.length) return { id: savedId };
      setFormStatus(eventStatus, label + 'を保存しています...');
      const r = await withTimeout(
        sb.from(eventTable).update(patch).eq('id', savedId).select('id').single(),
        12000,
        '開催予定の' + label
      );
      if(r.error) throw new Error(label + 'の保存に失敗しました: ' + r.error.message);
      return r.data || { id: savedId };
    };
    try {
      if(!form.reportValidity()) return;
      if(button) button.disabled = true;
      setFormStatus(eventStatus, '開催予定の基本情報を保存しています...');
      const title = cleanText(fd.get('title'), 120) || '開催予定';
      const basePayload = {
        title,
        session_format: format,
        organizer_name: cleanText(organizerName(), 120),
        organizer_email: user.email,
        facilitator_id: facilitator?.id || null
      };
      let savedId = savedIdFromEdit;
      let r;
      if(savedId){
        r = await withTimeout(sb.from(eventTable).update(basePayload).eq('id', savedId).select('id').single(), 12000, '開催予定の基本情報');
      } else {
        r = await withTimeout(sb.from(eventTable).insert({...basePayload, images: []}).select('id').single(), 12000, '開催予定の基本情報');
        savedId = r.data?.id || '';
      }
      if(r.error) throw new Error('基本情報の保存に失敗しました: ' + r.error.message);
      if(!savedId) throw new Error('保存IDを取得できませんでした。Supabaseのcalendar_eventsテーブル設定を確認してください。');

      await stage('本文', { description: cleanText(fd.get('description'), 2000) }, savedId);
      await stage('日時', { starts_at: fd.get('starts_at') || null }, savedId);
      await stage('会場情報', {
        venue_name: format === 'Zoom' ? 'Zoom' : cleanText(fd.get('venue_name'), 120),
        venue_address: format === 'Zoom' ? '' : cleanText(fd.get('address'), 240)
      }, savedId);
      await stage('申込リンク', { signup_url: cleanText(fd.get('signup_url'), 500) }, savedId);

      const files = form.querySelector('[name="images"]').files;
      if(files && files.length){
        setFormStatus(eventStatus, '入力内容は保存済みです。画像を追加しています...');
        const images = await upload(files, 'events', eventStatus);
        await stage('画像', { images }, savedId);
      }
      delete form.dataset.editId;
      if(button) button.textContent = '開催予定を保存';
      form.reset();
      await loadLists();
      setFormStatus(eventStatus, '開催予定を保存しました。');
    } catch(err){
      setFormStatus(eventStatus, err.message);
      console.error(err);
    } finally {
      if(button) button.disabled = false;
    }
  });
  function syncVenue(){ const select = document.querySelector('[name="session_format"]'); const isZoom = !select || select.value === 'Zoom'; document.querySelectorAll('[data-real-only]').forEach(el => el.hidden = isZoom); }
  document.querySelector('[name="session_format"]')?.addEventListener('change', syncVenue);
  async function boot(){ try { showVersion(); setStatus('管理プログラムを起動しています...'); syncVenue(); await init(); } catch(err) { console.error(err); showVersion(); setStatus('管理ページ初期化エラー: ' + (err && err.message ? err.message : err)); } }
  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();

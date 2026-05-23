(() => {
  const feedUrl = 'https://note.com/enatsugaro/m/mce6e5f2a7235';
  function esc(v){ return String(v || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s])); }
  function dt(v){ if(!v) return ''; const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric'}); }
  function card(item){
    const image = item.image ? '<div class="dynamic-card-media"><img src="'+esc(item.image)+'" alt="'+esc(item.title)+'"></div>' : '<div class="dynamic-card-media"><div class="dynamic-card-empty">note</div></div>';
    return '<article class="dynamic-card note-card"><a href="'+esc(item.link || feedUrl)+'" target="_blank" rel="noopener">'+image+'<h3>'+esc(item.title)+'</h3></a><p>'+esc(item.description || '').slice(0,110)+'</p><span>'+esc(dt(item.pubDate))+'</span></article>';
  }
  function fallback(target){
    target.innerHTML = '<article class="dynamic-card note-card"><a href="'+feedUrl+'" target="_blank" rel="noopener"><div class="dynamic-card-media"><div class="dynamic-card-empty">note</div></div><h3>ゆるパカ鑑賞会 noteマガジン</h3></a><p>noteで公開している記事をこちらからご覧いただけます。</p><span>noteへ移動</span></article>';
  }
  async function load(){
    const targets = document.querySelectorAll('[data-note-magazine]');
    if(!targets.length) return;
    targets.forEach(t => t.innerHTML = '<p>noteマガジンを読み込んでいます...</p>');
    try {
      const res = await fetch('note-magazine.json?v=20260524', { cache:'no-store' });
      if(!res.ok) throw new Error('note-magazine.jsonを読み込めません');
      const json = await res.json();
      const all = Array.isArray(json.items) ? json.items : [];
      targets.forEach(target => {
        const limit = Number(target.dataset.limit || 0);
        const items = limit ? all.slice(0, limit) : all;
        if(items.length) target.innerHTML = items.map(card).join('');
        else fallback(target);
      });
    } catch(err) {
      console.warn(err);
      targets.forEach(fallback);
    }
  }
  document.addEventListener('DOMContentLoaded', load);
})();

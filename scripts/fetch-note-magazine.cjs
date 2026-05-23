const fs = require('fs');
const NOTE_RSS = 'https://note.com/enatsugaro/m/mce6e5f2a7235/rss';
const OUT = 'note-magazine.json';
function textBetween(src, tag){
  const m = src.match(new RegExp('<' + tag + '[^>]*>([\s\S]*?)<\/' + tag + '>', 'i'));
  if(!m) return '';
  return m[1].replace(/^<!\[CDATA\[/,'').replace(/\]\]>$/,'').trim();
}
function strip(html){ return String(html || '').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim(); }
function imageFrom(html){
  const m = String(html || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : '';
}
async function main(){
  const res = await fetch(NOTE_RSS, { headers:{ 'user-agent':'yurupaka-site-rss-fetcher' }});
  if(!res.ok) throw new Error('RSS fetch failed: ' + res.status);
  const xml = await res.text();
  const itemXml = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  const items = itemXml.map(item => {
    const encoded = textBetween(item, 'content:encoded') || textBetween(item, 'description');
    return {
      title: strip(textBetween(item, 'title')),
      link: strip(textBetween(item, 'link')),
      pubDate: strip(textBetween(item, 'pubDate')),
      description: strip(textBetween(item, 'description')).slice(0, 180),
      image: imageFrom(encoded)
    };
  }).filter(item => item.title && item.link);
  const data = { source: NOTE_RSS, magazine: 'ゆるパカ鑑賞会 noteマガジン', updated_at: new Date().toISOString(), items };
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log('wrote', OUT, items.length, 'items');
}
main().catch(err => { console.error(err); process.exit(1); });

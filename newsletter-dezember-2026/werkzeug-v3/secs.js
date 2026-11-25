const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:640,height:1000}});
await p.goto('file://'+__dirname+'/page.html');await p.waitForTimeout(800);
const s=await p.evaluate(()=>[...document.querySelectorAll('section')].map(e=>{const r=e.getBoundingClientRect();
 const t=[...e.querySelectorAll('div,a')].filter(d=>!d.children.length||d.matches('.h,.t')).map(d=>d.innerText.replace(/\s+/g,' ').trim()).filter(Boolean);
 return {y0:Math.round(r.top+scrollY),y1:Math.round(r.bottom+scrollY),id:e.id,txt:[...new Set(t)].join(' · ').slice(0,400)}}));
fs.writeFileSync('out/secs.json',JSON.stringify(s,null,1));await b.close()})();

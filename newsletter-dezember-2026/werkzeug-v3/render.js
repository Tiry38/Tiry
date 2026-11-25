const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:640,height:1000},deviceScaleFactor:2});
await p.goto('file://'+__dirname+'/page.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(1500);
await p.evaluate(()=>setT(99));await p.waitForTimeout(500);
const info=await p.evaluate(()=>{const R=e=>{const r=e.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height}};
 return {H:document.body.scrollHeight,
  links:[...document.querySelectorAll('[data-href]')].map(e=>({...R(e),href:e.dataset.href,txt:(e.textContent||'').trim().slice(0,60)})),
  anims:[...document.querySelectorAll('[data-anim]')].map(e=>({...R(e),name:e.dataset.anim}))}});
fs.mkdirSync('out',{recursive:true});fs.writeFileSync('out/layout.json',JSON.stringify(info,null,1));
await p.setViewportSize({width:640,height:info.H});await p.waitForTimeout(400);
await p.screenshot({path:'out/static.png',fullPage:true});
for(const a of info.anims){const loop=(a.name==='hero'||a.name==='deal');const N=loop?30:31;fs.mkdirSync('out/fr-'+a.name,{recursive:true});
 for(let i=0;i<N;i++){const t=loop?i/12.5:i*0.08;await p.evaluate(t=>setT(t),t);
  if(loop) await p.evaluate(()=>Promise.all([...document.images].map(im=>im.complete?1:new Promise(r=>{im.onload=r;im.onerror=r}))));
  await p.screenshot({path:`out/fr-${a.name}/${String(i).padStart(3,'0')}.png`,clip:{x:Math.round(a.x),y:Math.round(a.y),width:Math.round(a.w),height:Math.round(a.h)}});}
 console.log('anim',a.name,N);}
await b.close();console.log('H',info.H,'links',info.links.length);})();

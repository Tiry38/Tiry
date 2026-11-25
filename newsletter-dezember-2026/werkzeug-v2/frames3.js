const {chromium}=require('playwright');const fs=require('fs');
const FPS=12.5;const only=process.argv.slice(2);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:700,height:700},deviceScaleFactor:2});
await p.goto('file://'+__dirname+'/scene3.html');await p.evaluate(()=>document.fonts.ready);
await p.evaluate(()=>{draw('board',3)});await p.waitForTimeout(800);
const names=await p.evaluate(()=>Object.keys(SC));
for(const n of names){ if(only.length&&!only.includes(n))continue;
 const {w,h,dur}=await p.evaluate(n=>({w:SC[n].w,h:SC[n].h,dur:SC[n].dur}),n);
 fs.rmSync('fr/'+n,{recursive:true,force:true});fs.mkdirSync('fr/'+n,{recursive:true});
 const N=Math.round(dur*FPS);
 for(let i=0;i<=N;i++){await p.evaluate(([n,t])=>draw(n,t),[n,i/FPS]);
  await p.evaluate(()=>Promise.all([...document.images].map(im=>im.complete?1:new Promise(r=>im.onload=r))));
  await p.screenshot({path:`fr/${n}/${String(i).padStart(3,'0')}.png`,clip:{x:0,y:0,width:w,height:h}});}
 console.log(n,N+1);}
await b.close();})();

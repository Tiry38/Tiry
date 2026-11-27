// Standbilder rechnen (Tiry 27.11.2026): node standbild.js <gebauter-ordner> <ausgabe>
// Je Seite und Bildschirmformat das erste echte Bild des Hintergrund-Shaders (t=0, Maus Mitte, nicht gescrollt, Start-Pose der Seite) als Rohdaten.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const [ROOT,OUT]=process.argv.slice(2);
const SEITEN=['start','service','hersteller','lager','isy-experte','isy-treffen','e-dreiraeder','kontakt','impressum','datenschutz'];
const F=[['w169',1920,1080,1],['w1610',1440,900,1],['w43',1024,768,1],['t34',820,1180,1],['p',412,915,2.625]];
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});fs.mkdirSync(OUT,{recursive:true});
for(const [n,w,h,d] of F){const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:d,screen:{width:w,height:h}});
 await ctx.route('http://t.test/**',r=>{let u=new URL(r.request().url()).pathname;if(u.endsWith('/'))u+='index.html';const f=path.join(ROOT,decodeURIComponent(u));if(!fs.existsSync(f))return r.fulfill({status:404,body:''});
  const ct={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2'}[path.extname(f)]||'application/octet-stream';r.fulfill({status:200,body:fs.readFileSync(f),headers:{'content-type':ct}})});
 await ctx.route(/^https?:\/\/(?!t\.test)/,r=>r.abort());
 for(const k of SEITEN){const p=await ctx.newPage();await p.goto('http://t.test/'+(k==='start'?'':k+'/'));
  await p.waitForFunction(()=>window.HG12_STAT&&document.getElementById('hg'),null,{timeout:60000});await p.waitForTimeout(7000);
  const o=await p.evaluate(()=>{const s=HG12_SHOT({t:0,m:[.5,.5],s:0,po:1});let t='';for(let i=0;i<s.px.length;i+=32768)t+=String.fromCharCode.apply(null,s.px.subarray(i,i+32768));return {w:s.w,h:s.h,b:btoa(t),hash:location.hash}});
  fs.writeFileSync(path.join(OUT,k+'-'+n+'_'+o.w+'x'+o.h+'.rgba'),Buffer.from(o.b,'base64'));console.log(k,n,o.w,o.h,o.hash);await p.close()}
 await ctx.close()}
await b.close()})();

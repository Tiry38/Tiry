const {chromium}=require('playwright');const fs=require('fs');
const D=__dirname+'/v/';
const WAVES=`<svg viewBox="0 0 1440 320" preserveAspectRatio="none"><defs><linearGradient id="w1" x1="0" x2="1"><stop offset="0" stop-color="#E2232D"/><stop offset=".5" stop-color="#C04BFF"/><stop offset="1" stop-color="#22C3D6"/></linearGradient><linearGradient id="w2" x1="1" x2="0"><stop offset="0" stop-color="#FF8A4C"/><stop offset=".5" stop-color="#FF5FA8"/><stop offset="1" stop-color="#9B5CFF"/></linearGradient></defs><path fill="url(#w2)" opacity=".18" d="M0,180 C240,120 420,250 720,200 C1000,150 1180,90 1440,160 L1440,320 L0,320Z"/><path fill="url(#w1)" opacity=".22" d="M0,230 C300,170 520,300 820,240 C1080,190 1260,220 1440,200 L1440,320 L0,320Z"/><path fill="url(#w1)" opacity=".12" d="M0,270 C260,240 560,310 900,280 C1150,258 1300,290 1440,270 L1440,320 L0,320Z"/></svg>`;
const sets={ist:['proto'],A:['base-bg','H1','N1'],B:['base-bg','H2','N3'],C:['base-bg','H3','N2']};
(async()=>{const b=await chromium.launch();fs.mkdirSync('out',{recursive:true});
for(const [k,files] of Object.entries(sets)){
 const css=files.map(f=>fs.readFileSync(D+f+'.css','utf8')).join('\n');
 for(const [n,w,h] of [['pc',1440,900],['handy',390,844]]){
  const p=await b.newPage({viewport:{width:w,height:h}});
  await p.goto('http://localhost:8765/index.html',{waitUntil:'load',timeout:60000}).catch(e=>console.log(e.message));
  if(files.length) await p.evaluate(([css,k,W])=>{const s=document.createElement('style');s.textContent=css;document.head.appendChild(s);
    const d=document.createElement('div');d.id='vxbg';d.setAttribute('aria-hidden','true');d.innerHTML=k==='C'?W+W.replace('<svg','<svg class="t"'):'<i></i><i></i><i></i><i></i><i></i>';document.body.prepend(d);},[css,k,WAVES]);
  await p.waitForTimeout(3500);
  await p.screenshot({path:`out/${k}-${n}-top.png`});
  if(n==='pc'){await p.evaluate(()=>window.scrollTo(0,1900));await p.waitForTimeout(1200);await p.screenshot({path:`out/${k}-${n}-mid.png`});}
  await p.close();}}
await b.close();})();

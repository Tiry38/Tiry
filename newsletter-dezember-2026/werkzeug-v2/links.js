const {chromium}=require('playwright');const fs=require('fs');
const h=fs.readFileSync('out/newsletter-dezember-2026.html','utf8');
const L=[...new Set([...h.matchAll(/href="([^"]+)"/g)].map(m=>m[1].replace(/&amp;/g,'&')))];
(async()=>{const b=await chromium.launch();const p=await b.newPage();const res=[];
for(const u of L){ if(u.startsWith('{%')||u.startsWith('tel:')||u.startsWith('mailto:')){res.push(['--',u,'Platzhalter/Protokoll']);continue}
 if(u.includes('fonts.googleapis')){continue}
 if(/velocenter\.de|velo-center\.de/.test(u)){res.push(['VERBOTEN',u,''])}
 let st='?',info='';
 try{const r=await fetch(u,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0'}});st=r.status;}catch(e){st='ERR '+e.message}
 if(u.startsWith('https://tiry38.github.io/velo-center-web/#')){const hs=u.split('#')[1];
  await p.goto(u,{waitUntil:'networkidle'});await p.waitForTimeout(1200);
  if(hs.startsWith('rad=')) info=await p.evaluate(()=>{const m=document.querySelector('#lgm');return m&&!m.hidden?m.innerText.slice(0,90).replace(/\s+/g,' '):'MODAL ZU'});
  else info=await p.evaluate(h=>document.getElementById(h)?'Ziel #'+h+' vorhanden':'Ziel #'+h+' FEHLT',hs);}
 res.push([st,u,info]);}
console.log(res.map(r=>r.join(' | ')).join('\n'));await b.close();})();

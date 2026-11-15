(function(){const w=document.querySelector('.erl .errw');if(w&&!w.querySelector('.erx')){
 const x=document.createElement('i');x.className='erx';w.appendChild(x);
 const f=document.createElement('div');f.className='erinfo';
 f.innerHTML='<div class="ertk"><div class="rail"></div></div><div class="erkz"><div><b>300+</b><small>E-Bikes vor Ort</small></div><div><b>4,8<em>★</em></b><small>bei Google</small></div><div><b>1995</b><small>Familienbetrieb</small></div></div>';w.appendChild(f);
 const T=['Bosch Service Center','★ 4,8 bei Google · 221 Rezensionen','Über 300 E-Bikes vor Ort','Hartmannstraße 25 · Wörth am Rhein','Telefon 07271 78033'];
 function stat(){const p=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
  const g=k=>(p.find(z=>z.type===k)||{}).value||'';const D=['Mo','Di','Mi','Do','Fr','Sa','So'],d=D.indexOf(g('weekday').replace('.','')),m=+g('hour')*60+ +g('minute');
  const H=d=>d===5?[[540,720]]:(d===2||d===6||d<0)?[]:[[540,720],[870,1080]];const hh=v=>String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0');
  const o=H(d).find(r=>m>=r[0]&&m<r[1]);if(o)return[1,'Jetzt geöffnet bis '+hh(o[1])];
  const n=H(d).find(r=>m<r[0]);if(n)return[0,'Geschlossen · heute ab '+hh(n[0])];
  for(let i=1;i<8;i++){const k=(d+i)%7,r=H(k);if(r.length)return[0,'Geschlossen · ab '+D[k]+' '+hh(r[0][0])]}return[0,'Geschlossen']}
 function fill(){const s=stat(),one='<span class="st'+(s[0]?'':' zu')+'"><i></i>'+s[1]+'</span>'+T.map(t=>'<span>'+t+'</span>').join('');f.querySelector('.rail').innerHTML=one+one}
 fill();setInterval(fill,60000)}
const V=[['1','Carbon','repeating-linear-gradient(45deg,#7E0C20 0 4px,#B8132F 4px 8px)'],['2','Facetten','conic-gradient(from 30deg,#B8132F,#7E0C20,#D2263F,#960F27,#B8132F)'],['3','Info-Kante','linear-gradient(115deg,#B8132F 0 66%,#fff 66% 72%,#7E0C20 72%)'],['4','Kennzahlen','linear-gradient(160deg,#B8132F,#6E0C1F)'],['5','Laden-Foto','linear-gradient(160deg,#C9A5AB,#7E0C20)']];
let cur='1';try{cur=localStorage.getItem('rv')||'1'}catch(_){}
const d=document.createElement('div');d.className='bgsw';d.setAttribute('role','group');d.setAttribute('aria-label','Rote Fläche wählen');
d.innerHTML='<span class="lab"><small>Rot</small><b class="nm"></b></span>'+V.map(v=>`<button type="button" data-v="${v[0]}" style="--sw:${v[2]};color:#fff" title="${v[1]}" aria-label="Variante ${v[0]}: ${v[1]}">${v[0]}</button>`).join('');
document.body.appendChild(d);
function set(v){cur=v;document.documentElement.setAttribute('data-rv',v);d.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===v));d.querySelector('.nm').textContent=V.find(x=>x[0]===v)[1];try{localStorage.setItem('rv',v)}catch(_){}}
d.addEventListener('click',e=>{const b=e.target.closest('button');if(b)set(b.dataset.v)});
addEventListener('keydown',e=>{if(/^[1-5]$/.test(e.key)&&!/INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||''))set(e.key)});
set(cur)})();

/* Menüband „Lichtband“: gleitende Linse + aktiver Punkt + Vorschau-Panel (nur PC mit Maus, ab 1181 px) */
(function(){
const n=document.getElementById('nav'),h=document.querySelector('.hdr');if(!n||!h)return;
const mq=matchMedia('(min-width:1181px)'),hov=matchMedia('(hover:hover)');
const lens=document.createElement('span');lens.className='lbl';lens.setAttribute('aria-hidden','true');
const act=document.createElement('span');act.className='lba';act.setAttribute('aria-hidden','true');
n.prepend(lens,act);
const place=(el,a)=>{el.style.left=a.offsetLeft+'px';el.style.width=a.offsetWidth+'px'};
function posA(){const a=n.querySelector('a.on');act.style.opacity=a?'1':'0';if(a)place(act,a)}
new MutationObserver(posA).observe(n,{subtree:true,attributes:true,attributeFilter:['class']});
if(window.ResizeObserver)new ResizeObserver(posA).observe(n);
window.addEventListener('load',posA);posA();setTimeout(posA,600);
n.addEventListener('pointermove',e=>{const r=n.getBoundingClientRect();n.style.setProperty('--mx',((e.clientX-r.left)/r.width*100).toFixed(1)+'%')});

const AR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const cta=(a,b)=>`<div class="lbp-cta"><a href="${a[1]}">${a[0]}${AR}</a>${b?`<a href="${b[1]}">${b[0]}</a>`:''}</div>`;
const tx=(ey,hh,p,ch,c)=>`<div class="lbp-tx"><div class="lbp-ey">${ey}</div><h3 class="lbp-h">${hh}</h3>${p?`<p class="lbp-p">${p}</p>`:''}${ch?`<div class="lbp-ch">${ch.map(x=>`<span>${x}</span>`).join('')}</div>`:''}${c}</div>`;
const M=['ktm','isy','gudereit','vdv','qio','vanraam','victoria','stevens'];
const P={
service:tx('Werkstatt · Bosch Service Center','Service, der dein Rad fit hält','Inspektion, Reparatur und Bosch-Diagnose, auch wenn du dein Rad woanders gekauft hast.',['<b>–20 €</b> + Sattelüberzug gratis'],cta(['Termin anfragen','#termin'],['Zum Service','#service']))+
 `<div class="lbp-vi"><div class="lbp-blob"></div><img class="lbp-cut" src="img/sattelueberzug.webp" alt="" style="width:205px;left:70px;top:14px"><div class="lbp-bd" style="width:96px;height:96px;right:6px;top:8px;font-size:26px">–20 €<small style="display:block;font-size:10px;letter-spacing:.12em;margin-top:5px">BIS 28.02.</small></div></div>`,
marken:tx('Hersteller','Unsere Marken','Von KTM bis i:SY: diese Hersteller führen wir.',0,cta(['Alle Marken','#marken']))+
 `<div class="lbp-lg">${M.map(m=>`<a href="#marken" tabindex="-1"><img src="img/marke-${m}.svg" alt=""></a>`).join('')}</div>`,
lager:tx('Ausstellung · Live','Über 300 E‑Bikes vor Ort','Sieh live, was gerade im Laden steht, und komm zur Probefahrt vorbei.',['Probefahrt möglich'],cta(['Live-Bestand ansehen','#lager']))+
 `<div class="lbp-vi"><div class="lbp-blob"></div><img class="lbp-cut" src="img/p-ktm.webp" alt="" style="width:230px;left:2px;top:58px"><img class="lbp-cut" src="img/p-isy.webp" alt="" style="width:220px;right:0;top:12px"><span class="lbp-live" style="left:16px;top:10px"><i></i>LIVE</span></div>`,
isy:tx('Seit 2015','i:SY Experte in Wörth','Probefahrt übers Wochenende möglich, Ersatzteile vorrätig.',['<b>1.000+</b> i:SY verkauft','<b>100+</b> auf Lager'],cta(['Zum i:SY Experten','#isy']))+
 `<div class="lbp-vi"><div class="lbp-blob"></div><img class="lbp-cut" src="img/p-isy-orange.webp" alt="" style="width:270px;left:0;top:44px"><img class="lbp-cut" src="img/isy-experte-rund.webp" alt="" style="width:118px;right:4px;top:0"></div>`,
treffen:tx('Wörth am Rhein · 2017–2024','Das i:SY-Treffen','Fotos und Videos aller Treffen, inklusive Weltrekord 2024.',['<b>283</b> i:SY beim Weltrekord'],cta(['Fotos & Videos','#treffen']))+
 `<div class="lbp-vi"><div class="lbp-ph"><img src="img/treffen-luft.webp" alt=""></div><img class="lbp-cut" src="img/weltrekord-button.webp" alt="" style="width:112px;right:-14px;bottom:-12px"></div>`,
dreirad:tx('Sicher auf drei Rädern','E‑Dreiräder','Drei Räder, kein Kippen beim Anhalten. Beratung, Probefahrt und Service in Wörth.',['Van Raam Easy Rider'],cta(['E-Dreiräder ansehen','#dreirad']))+
 `<div class="lbp-vi"><div class="lbp-blob"></div><img class="lbp-cut" src="img/p-vanraam.webp" alt="" style="width:290px;left:22px;top:20px"></div>`,
kontakt:tx('Hartmannstraße 25 · 76744 Wörth','Komm vorbei','<span class="lbp-hr"><b>Mo, Di, Do, Fr</b><span>9:00–12:00 · 14:30–18:00</span><b>Sa</b><span>9:00–12:00</span><b>Mi, So</b><span>geschlossen</span></span>',['Tel. 07271 78033'],cta(['Kontakt & Anfahrt','#kontakt'],['Termin','#termin']))+
 `<div class="lbp-vi"><div class="lbp-ph"><img src="img/laden-eingang.webp" alt=""></div></div>`
};
const pan=document.createElement('div');pan.className='lbp';pan.id='lbp';pan.setAttribute('aria-hidden','true');
pan.innerHTML='<div class="lbp-box"></div>'+Object.keys(P).map(k=>`<div class="lbp-pg" data-k="${k}">${P[k]}</div>`).join('');
document.body.appendChild(pan);
const pg={};pan.querySelectorAll('.lbp-pg').forEach(e=>pg[e.dataset.k]=e);
const ord=[...n.querySelectorAll('a[data-r]')].map(a=>a.dataset.r);
let cur=null,tOpen=0,tClose=0;
function open(a){
 const k=a.dataset.r;if(!pg[k]){close();return}
 const g=pg[k],w=g.offsetWidth,hh=g.offsetHeight;
 const nr=n.getBoundingClientRect(),ar=a.getBoundingClientRect();
 let x=ar.left+ar.width/2-w/2;x=Math.max(16,Math.min(x,innerWidth-w-16));
 pan.style.top=(nr.bottom+14)+'px';
 if(!pan.classList.contains('on')){pan.style.transition='none';pan.style.left=x+'px';pan.style.width=w+'px';pan.style.height=hh+'px';void pan.offsetWidth;pan.style.transition=''}
 else{pan.style.left=x+'px';pan.style.width=w+'px';pan.style.height=hh+'px'}
 const dir=cur?Math.sign(ord.indexOf(k)-ord.indexOf(cur)):0;
 Object.values(pg).forEach(e=>{if(e!==g){e.style.setProperty('--dx',(-dir*24)+'px');e.classList.remove('on');e.querySelectorAll('a').forEach(l=>l.tabIndex=-1)}});
 g.style.setProperty('--dx',(dir*24)+'px');void g.offsetWidth;g.classList.add('on');g.querySelectorAll('.lbp-cta a').forEach(l=>l.tabIndex=0);
 pan.classList.add('on');pan.setAttribute('aria-hidden','false');cur=k;
}
function close(){pan.classList.remove('on');pan.setAttribute('aria-hidden','true');cur=null;lens.style.opacity='0'}
const fit=()=>{if(!cur)return;const g=pg[cur];pan.style.width=g.offsetWidth+'px';pan.style.height=g.offsetHeight+'px'};
if(window.ResizeObserver){const ro=new ResizeObserver(fit);Object.values(pg).forEach(e=>ro.observe(e))}
pan.querySelectorAll('img').forEach(i=>i.addEventListener('load',fit));
const ok=()=>mq.matches&&hov.matches;
n.querySelectorAll('a[data-r]').forEach(a=>{
 a.addEventListener('pointerenter',()=>{if(!ok())return;clearTimeout(tClose);place(lens,a);lens.style.opacity='1';clearTimeout(tOpen);tOpen=setTimeout(()=>open(a),cur?0:110)});
 a.addEventListener('focus',()=>{if(mq.matches){place(lens,a);lens.style.opacity='1';open(a)}});
 a.addEventListener('click',()=>{clearTimeout(tOpen);close()});
});
const leave=()=>{clearTimeout(tOpen);clearTimeout(tClose);tClose=setTimeout(close,260)};
n.addEventListener('pointerleave',leave);pan.addEventListener('pointerleave',leave);
pan.addEventListener('pointerenter',()=>clearTimeout(tClose));
pan.addEventListener('click',e=>{if(e.target.closest('a'))close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&cur){close();const a=n.querySelector('a:focus');if(a)a.blur()}});
document.addEventListener('focusin',e=>{if(cur&&!n.contains(e.target)&&!pan.contains(e.target))close()});
addEventListener('scroll',()=>{if(cur&&Math.abs(scrollY-(window.__lbY||0))>80)close();window.__lbY=scrollY},{passive:true});
mq.addEventListener('change',()=>{if(!mq.matches)close();posA()});
})();

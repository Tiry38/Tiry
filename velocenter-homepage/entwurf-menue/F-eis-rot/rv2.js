(function(){const w=document.querySelector('.erl .errw');if(!w||w.querySelector('.erv'))return;
const v=document.createElement('div');v.className='erv';
const M=['ktm','isy','gudereit','vdv','qio','vanraam','victoria','stevens'];
v.innerHTML='<div class="erlg"><i></i></div><div class="ergeo"></div><div class="ermk"><b>Unsere Marken</b>'+M.map(m=>'<img src="img/marke-'+m+'.svg" alt="">').join('')+'</div>'+
 '<div class="erq"><div class="shp"></div><div class="sp" style="--top:150px"></div><div class="st">★★★★★</div><p></p><small></small><span class="sc"></span></div>'+
 '<div class="eroz"><div class="shp"></div><div class="sp" style="--top:150px"></div><h4>Öffnungszeiten</h4><div class="now"><i></i><b></b></div>'+
 '<div class="r" data-d="0,1,3,4"><span><em>Mo · Di · Do · Fr</em>9:00–12:00 · 14:30–18:00</span></div><div class="r" data-d="5"><span><em>Samstag</em>9:00–12:00</span></div><div class="r" data-d="2,6"><span><em>Mi · So</em>geschlossen</span></div></div>';
w.appendChild(v);
function lay(){const W=w.offsetWidth,H=w.offsetHeight;if(!W||!H)return;const mk=v.querySelector('.ermk'),y0=112,st=55;
 mk.querySelector('b').style.cssText='top:'+(y0-34)+'px;right:34px';
 mk.querySelectorAll('img').forEach((im,i)=>{const y=y0+i*st,x=Math.max(y*W/H+40,W-34-118-(i<1?0:0));im.style.top=y+'px';im.style.left=Math.min(x,W-34-118)+'px'})}
lay();addEventListener('resize',lay);new MutationObserver(lay).observe(document.querySelector('main'),{attributes:true,subtree:true,attributeFilter:['hidden']});
/* echte Stimmen aus dem Bewertungs-Bereich der Seite */
const Q=[...document.querySelectorAll('#qs .q')].map(q=>[q.querySelector('p')?.textContent.trim(),q.querySelector('small')?.textContent.trim()]).filter(x=>x[0]);
const g=document.querySelector('[data-g="r"]'),gn=document.querySelector('[data-g="n"]');
const qe=v.querySelector('.erq');qe.querySelector('.sc').textContent=(g?g.textContent.trim():'4,8')+' ★ · '+(gn?gn.textContent.trim().replace(/ bei Google$/,''):'');
let qi=0;function qs(){if(!Q.length)return;const x=Q[qi%Q.length];qe.querySelector('p').textContent=x[0];qe.querySelector('small').textContent=x[1]||''}
qs();if(!matchMedia('(prefers-reduced-motion:reduce)').matches)setInterval(()=>{qe.classList.add('fd');setTimeout(()=>{qi++;qs();qe.classList.remove('fd')},600)},6500);
/* Öffnungszeiten live */
function oz(){const s=window.erStat?window.erStat():[0,''];const n=v.querySelector('.eroz .now');n.classList.toggle('zu',!s[0]);n.querySelector('b').textContent=s[0]?'Jetzt geöffnet':'Gerade geschlossen';
 const d=['Mo','Di','Mi','Do','Fr','Sa','So'].indexOf(new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'short'}).format(new Date()).replace('.',''));
 v.querySelectorAll('.eroz .r').forEach(r=>r.classList.toggle('on',r.dataset.d.split(',').includes(String(d))))}
oz();setInterval(oz,60000)})();
(function(){const V=[['1','Carbon'],['2','Facetten'],['3','Info-Kante'],['4','Kennzahlen'],['5','Laden-Foto'],['6','Eloxiert'],['7','Riffelblech'],['8','Reifenprofil'],['9','Pyramiden'],['10','Riffelglas'],['11','Logo-Prägung'],['12','Technik-Zeichnung'],['13','Marken'],['14','Kundenstimme'],['15','Öffnungszeiten']];
let cur='6';try{cur=localStorage.getItem('rv2')||'6'}catch(_){}
const d=document.createElement('div');d.className='bgsw rvs';d.setAttribute('role','group');d.setAttribute('aria-label','Rote Fläche wählen');
d.innerHTML='<span class="lab"><small>Rote Fläche</small><b class="nm"></b></span><span class="grp"><em>Runde 1</em>'+V.slice(0,5).map(b).join('')+'</span><span class="grp nw"><em>Neu</em>'+V.slice(5).map(b).join('')+'</span>';
function b(v){return `<button type="button" data-v="${v[0]}" title="${v[1]}" aria-label="Variante ${v[0]}: ${v[1]}">${v[0]}</button>`}
document.body.appendChild(d);
function set(x){cur=x;document.documentElement.setAttribute('data-rv',x);d.querySelectorAll('button').forEach(q=>q.setAttribute('aria-pressed',q.dataset.v===x));d.querySelector('.nm').textContent=x+' · '+V.find(y=>y[0]===x)[1];try{localStorage.setItem('rv2',x)}catch(_){}const b=d.querySelector('button[aria-pressed="true"]');if(b&&d.scrollWidth>d.clientWidth)d.scrollLeft=b.offsetLeft-d.clientWidth/2+b.offsetWidth/2}
d.addEventListener('click',e=>{const q=e.target.closest('button');if(q)set(q.dataset.v)});
addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||''))return;const i=V.findIndex(y=>y[0]===cur);if(e.key==='ArrowRight')set(V[(i+1)%V.length][0]);if(e.key==='ArrowLeft')set(V[(i+V.length-1)%V.length][0])});
set(cur)})();

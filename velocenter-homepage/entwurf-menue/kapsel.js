/* Menüband „Kapsel“: gleitende Markierung + Lichtfleck folgt der Maus */
(function(){const n=document.getElementById('nav'),w=document.querySelector('.hdr .wrap');if(!n||!w)return;
const d=document.createElement('span');d.className='knd';d.setAttribute('aria-hidden','true');n.prepend(d);
let lastL=-1,lastW=-1;
function pos(){const a=n.querySelector('a.on');if(!a||getComputedStyle(n).display==='none'){d.style.opacity='0';return}
 const L=a.offsetLeft,W=a.offsetWidth;d.style.opacity='1';if(L!==lastL||W!==lastW){d.style.left=L+'px';d.style.width=W+'px';lastL=L;lastW=W}}
new MutationObserver(pos).observe(n,{subtree:true,attributes:true,attributeFilter:['class']});
if(window.ResizeObserver)new ResizeObserver(pos).observe(n);
n.addEventListener('transitionend',e=>{if(e.target.tagName==='A')pos()});
w.addEventListener('pointermove',e=>{const r=w.getBoundingClientRect();w.style.setProperty('--mx',((e.clientX-r.left)/r.width*100).toFixed(1)+'%')});
window.addEventListener('load',pos);
w.addEventListener('transitionend',e=>{if(e.target===w&&e.propertyName==='max-width'&&typeof hdrFit==='function'){hdrFit();pos()}});pos();
let t=0;const tick=()=>{pos();if(++t<40)requestAnimationFrame(tick)};document.body.addEventListener('transitionrun',()=>{t=0;tick()});
let sc=document.body.classList.contains('sc'),kt=0;
new MutationObserver(()=>{const v=document.body.classList.contains('sc');if(v===sc)return;sc=v;w.classList.remove('kmv');void w.offsetWidth;w.classList.add('kmv');clearTimeout(kt);kt=setTimeout(()=>{w.classList.remove('kmv');if(typeof hdrFit==='function')hdrFit();pos()},900)}).observe(document.body,{attributes:true,attributeFilter:['class']});
})();

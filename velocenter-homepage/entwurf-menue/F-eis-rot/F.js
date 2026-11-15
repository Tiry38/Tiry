(function(){const n=document.getElementById('nav');if(!n)return;
const NS='http://www.w3.org/2000/svg';const sv=document.createElementNS(NS,'svg');sv.setAttribute('width','0');sv.setAttribute('height','0');sv.style.position='absolute';
sv.innerHTML='<filter id="lqf" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="2" seed="7" result="t"/><feGaussianBlur in="t" stdDeviation="2" result="b"/><feDisplacementMap in="SourceGraphic" in2="b" scale="8" xChannelSelector="R" yChannelSelector="G"/></filter>';document.body.appendChild(sv);
const lq=document.createElement('span');lq.className='lq';const la=document.createElement('span');la.className='lqa';[lq,la].forEach(e=>e.setAttribute('aria-hidden','true'));n.prepend(la,lq);
// Feder je Kante: Linse dehnt sich beim Gleiten wie ein Tropfen
const S={l:0,r:0,vl:0,vr:0,tl:0,tr:0,run:0};const A={l:0,r:0,vl:0,vr:0,tl:0,tr:0,run:0};
function step(o,el){const dt=1/60;let moving=false;for(const k of ['l','r']){const kk=(o['t'+k]>o[k])===(k==='r')?260:120;const c=2*Math.sqrt(kk)*.62;const f=kk*(o['t'+k]-o[k])-c*o['v'+k];o['v'+k]+=f*dt;o[k]+=o['v'+k]*dt;if(Math.abs(o['t'+k]-o[k])>.2||Math.abs(o['v'+k])>.2)moving=true}
 el.style.left=o.l+'px';el.style.width=Math.max(10,o.r-o.l)+'px';if(moving)o.run=requestAnimationFrame(()=>step(o,el));else o.run=0}
function aim(o,el,a,jump){o.tl=a.offsetLeft;o.tr=a.offsetLeft+a.offsetWidth;if(jump||matchMedia('(prefers-reduced-motion:reduce)').matches){o.l=o.tl;o.r=o.tr;o.vl=o.vr=0;el.style.left=o.l+'px';el.style.width=(o.r-o.l)+'px';return}if(!o.run)o.run=requestAnimationFrame(()=>step(o,el))}
let first=true;n.querySelectorAll('a[data-r]').forEach(a=>a.addEventListener('pointerenter',()=>{aim(S,lq,a,!lq.classList.contains('on'));lq.classList.add('on')}));
n.addEventListener('pointerleave',()=>lq.classList.remove('on'));
function act(){const a=n.querySelector('a.on');la.style.opacity=a?'1':'0';if(a){aim(A,la,a,first);first=false}}
new MutationObserver(act).observe(n,{subtree:true,attributes:true,attributeFilter:['class']});if(window.ResizeObserver)new ResizeObserver(()=>{first=true;act()}).observe(n);act();
if(typeof hdrFit==='function')setTimeout(hdrFit,60)})();

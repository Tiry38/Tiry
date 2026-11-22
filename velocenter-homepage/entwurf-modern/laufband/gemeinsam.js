/* Laufband-Vorlagen (Tiry 22.11.2026): gemeinsame Physik – Scroll-Tempo, Zeiger, Sichtbarkeit */
window.LB=function(cls,tick){
 var de=document.documentElement;de.classList.add(cls);
 function go(){var bt=document.querySelector('.view[data-v="start"] .bands.top');if(!bt)return;
  bt.querySelectorAll('.band').forEach(function(b){var tk=b.querySelector('.tk');if(!tk||tk.parentNode.classList.contains('lbvp'))return;
   var vp=document.createElement('div');vp.className='lbvp';b.insertBefore(vp,tk);vp.appendChild(tk)});
  var st={bt:bt,v:0,px:.5,py:.5,tx:.5,ty:.5,over:0,on:true,t:performance.now()},ly=scrollY,anims=[],lr=1;
  bt.addEventListener('pointermove',function(e){var r=bt.getBoundingClientRect();st.tx=(e.clientX-r.left)/r.width;st.ty=(e.clientY-r.top)/r.height;st.over=1});
  bt.addEventListener('pointerleave',function(){st.over=0;st.tx=.5;st.ty=.5});
  if(window.IntersectionObserver)new IntersectionObserver(function(e){st.on=e[0].isIntersecting;if(st.on)requestAnimationFrame(f)}).observe(bt);
  function f(now){if(!st.on)return;if(document.hidden){setTimeout(function(){requestAnimationFrame(f)},400);return}
   var dt=Math.min(.05,((now||performance.now())-st.t)/1000);st.t=now||performance.now();
   var d=Math.abs(scrollY-ly);ly=scrollY;st.v+=(Math.min(d/9,4)-st.v)*Math.min(1,dt*6);
   st.px+=(st.tx-st.px)*Math.min(1,dt*7);st.py+=(st.ty-st.py)*Math.min(1,dt*7);
   bt.style.setProperty('--v',st.v.toFixed(3));bt.style.setProperty('--px',(st.px*100).toFixed(2)+'%');bt.style.setProperty('--py',(st.py*100).toFixed(2)+'%');
   if(!anims.length)bt.querySelectorAll('.tk').forEach(function(t){if(t.getAnimations)t.getAnimations().forEach(function(x){anims.push(x)})});
   var r=1+st.v*1.6;if(Math.abs(r-lr)>.02){anims.forEach(function(x){x.playbackRate=r});lr=r}
   if(tick)tick(st,dt);requestAnimationFrame(f)}
  requestAnimationFrame(f)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();
};

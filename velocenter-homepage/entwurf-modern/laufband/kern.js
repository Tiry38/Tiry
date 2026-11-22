/* Laufband-Vorlagen mit Umschalter (Tiry 22.11.2026: „mit 1, 2, 3 durchklicken links … komplett von Rand zu Rand“).
   Jede Variante: {name, info, on(bt), off(bt), tick(st,dt)}; gemeinsamer Takt mit Scroll-Tempo und Zeiger. */
(function(){var V=window.LBV=[],cur=-1,st=null,de=document.documentElement;
function go(){var bt=document.querySelector('.view[data-v="start"] .bands.top');if(!bt||!V.length)return;
 st={bt:bt,v:0,px:.5,py:.5,tx:.5,ty:.5,cx:-1e4,cy:-1e4,over:0,t:performance.now(),T:0,on:true};var ly=scrollY,anims=[],lr=1;
 addEventListener('pointermove',function(e){st.cx=e.clientX;st.cy=e.clientY;var r=bt.getBoundingClientRect();st.tx=(e.clientX-r.left)/r.width;st.ty=(e.clientY-r.top)/r.height;
  st.over=st.ty>-.4&&st.ty<1.4?1:0;if(!st.over){st.tx=.5;st.ty=.5}},{passive:true});
 if(window.IntersectionObserver)new IntersectionObserver(function(e){st.on=e[0].isIntersecting;if(st.on)requestAnimationFrame(f)},{rootMargin:'120px'}).observe(bt);
 function f(now){if(!st.on)return;now=now||performance.now();var dt=Math.min(.05,(now-st.t)/1000);st.t=now;st.T+=dt;
  var d=Math.abs(scrollY-ly);ly=scrollY;st.v+=(Math.min(d/9,4)-st.v)*Math.min(1,dt*6);
  st.px+=(st.tx-st.px)*Math.min(1,dt*7);st.py+=(st.ty-st.py)*Math.min(1,dt*7);
  bt.style.setProperty('--v',st.v.toFixed(3));bt.style.setProperty('--px',(st.px*100).toFixed(2)+'%');
  anims=[];bt.querySelectorAll('.tk').forEach(function(t){if(t.getAnimations)t.getAnimations().forEach(function(x){anims.push(x)})});
  var r=1+st.v*1.6;if(Math.abs(r-lr)>.02){lr=r}anims.forEach(function(x){if(Math.abs(x.playbackRate-lr)>.02)x.playbackRate=lr});
  if(cur>=0&&V[cur].tick)V[cur].tick(st,dt);requestAnimationFrame(f)}
 function pick(i){if(i===cur)return;if(cur>=0){V[cur].off&&V[cur].off(bt);de.classList.remove('lbv'+(cur+1))}cur=i;de.classList.add('lbv'+(i+1));V[i].on&&V[i].on(bt,st);up();try{localStorage.setItem('vc_lbv',String(i))}catch(_){}}
 /* Umschalter links (gleiche Optik wie bei den Hintergründen) */
 var b=document.createElement('div');b.id='ueSw';b.setAttribute('role','group');b.setAttribute('aria-label','Laufband wählen');
 b.innerHTML='<span class="ue-k">Laufband</span>'+V.map(function(m,i){return'<button type="button" data-i="'+i+'" aria-pressed="false"><b>'+(i+1)+'</b><span>'+m.name+'<small>'+m.info+'</small></span></button>'}).join('');
 document.body.appendChild(b);
 function up(){[].forEach.call(b.querySelectorAll('button'),function(x){var on=+x.dataset.i===cur;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on))})}
 var tt=0;function tip(){var n=document.getElementById('ueTip');if(!n){n=document.createElement('div');n.id='ueTip';document.body.appendChild(n)}
  n.innerHTML='<b>Laufband '+(cur+1)+'</b> · '+V[cur].name+' – '+V[cur].info;n.classList.remove('on');void n.offsetWidth;n.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){n.classList.remove('on')},2800)}
 b.addEventListener('click',function(e){var x=e.target.closest('button');if(!x)return;e.stopPropagation();pick(+x.dataset.i);tip()});
 var s0=0;try{var q=new URLSearchParams(location.search).get('lb');if(q)s0=+q-1;else s0=+(localStorage.getItem('vc_lbv')||0)}catch(_){}
 if(!(s0>=0&&s0<V.length))s0=0;pick(s0);setTimeout(tip,1200);requestAnimationFrame(f)}
window.LBV_START=function(){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go()};
})();

/* 2 · Laser-Gravur: rechts sitzt ein Laserkopf; jeder Buchstabe wird beim Durchlaufen live in schwarzes Glas graviert –
   glühend rot am Brennpunkt, kühlt nach links silbern ab, Funken sprühen. Brennpunkt rastert auf und ab. */
(function(){var E=null,K=null,MO=null;
function sync(bt){var a=bt.querySelector('.band.a'),tk=a.querySelector('.lbvp>.tk')||a.querySelector(':scope>.tk');if(tk.parentNode===a){var vp=document.createElement('div');vp.className='lbvp';a.insertBefore(vp,tk);vp.appendChild(tk)}if(!E){
  E={a:a,H:document.createElement('div'),beam:document.createElement('i'),head:document.createElement('i'),sp:document.createElement('canvas'),P:[]};
  E.H.className='lbH';E.H.setAttribute('aria-hidden','true');K=document.createElement('div');K.className='tk';E.H.appendChild(K);a.appendChild(E.H);
  E.beam.className='lbBeam';E.head.className='lbHead';E.sp.className='lbSp';a.appendChild(E.beam);a.appendChild(E.head);a.appendChild(E.sp);E.x=E.sp.getContext('2d')}
 K.innerHTML=tk.innerHTML;requestAnimationFrame(function(){var o=tk.getAnimations()[0],c=K.getAnimations()[0];if(o&&c){c.currentTime=o.currentTime;c.playbackRate=o.playbackRate}})}
LBV.push({name:'Laser-Gravur',info:'Laser graviert die Schrift live in schwarzes Glas, Funken inklusive',
 on:function(bt){sync(bt);[E.H,E.beam,E.head,E.sp].forEach(function(e){e.style.display=''});
  if(!MO){MO=new MutationObserver(function(){sync(bt)});MO.observe(bt.querySelector('.band.a .lbvp>.tk'),{childList:true})}},
 off:function(){if(E)[E.H,E.beam,E.head,E.sp].forEach(function(e){e.style.display='none'})},
 tick:function(st,dt){if(!E)return;var a=E.a,w=a.offsetWidth,h=a.offsetHeight,hx=w<760?w*.78:w*.84;
  var hy=.5+.36*Math.sin(st.T*31)*Math.sin(st.T*2.3+1.1);a.style.setProperty('--hx',hx.toFixed(1)+'px');a.style.setProperty('--hy',(hy*100).toFixed(1)+'%');
  var tk=a.querySelector('.lbvp>.tk'),o=tk.getAnimations()[0],c=K.getAnimations()[0];if(o&&c&&Math.abs((c.currentTime||0)-(o.currentTime||0))>30)c.currentTime=o.currentTime;
  /* Funken */
  var cv=E.sp,d=Math.min(2,devicePixelRatio||1),W=Math.round(w*d),Hh=Math.round((h+120)*d);if(cv.width!==W||cv.height!==Hh){cv.width=W;cv.height=Hh}
  var x=E.x,n=Math.round((34+st.v*40)*dt*60*.5);for(var i=0;i<n;i++){var an=Math.PI*(.55+Math.random()*.9),sp=60+Math.random()*260;
   E.P.push({x:hx,y:60+h*hy,vx:Math.cos(an)*sp-40,vy:-Math.sin(an)*sp*.7*(Math.random()<.5?1:-1),l:0,m:.25+Math.random()*.5})}
  x.clearRect(0,0,W,Hh);x.globalCompositeOperation='lighter';
  E.P=E.P.filter(function(p){p.l+=dt;if(p.l>p.m)return false;p.vy+=520*dt;p.vx*=.985;var ox=p.x,oy=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;var k=1-p.l/p.m;
   x.strokeStyle='rgba(255,'+(120+k*120|0)+','+(60+k*100|0)+','+k.toFixed(2)+')';x.lineWidth=(1.2+k*1.6)*d;x.beginPath();x.moveTo(ox*d,oy*d);x.lineTo(p.x*d,p.y*d);x.stroke();return true});
  if(E.P.length>500)E.P.splice(0,E.P.length-500);x.globalCompositeOperation='source-over'}});
})();

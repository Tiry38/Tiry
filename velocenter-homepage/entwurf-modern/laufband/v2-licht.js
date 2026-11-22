/* 2 · Lichtspuren – Langzeitbelichtung der Herbstallee: im roten Glasband ziehen Rücklichter, im Rauchglas-Band Scheinwerfer
   in Gegenrichtung. Schrift schwebt darüber, wird von vorbeiziehendem Licht angestrahlt; Scrollen = Gas geben. */
(function(){var B=[];
function mk(band,red){var c=document.createElement('canvas');c.className='lbL';c.setAttribute('aria-hidden','true');band.insertBefore(c,band.firstChild);
 var s=[];for(var i=0;i<(red?46:38);i++)s.push(nw(red,true));return {band:band,c:c,x:c.getContext('2d'),s:s,red:red,w:0,h:0}}
function nw(red,init){var f=Math.random();return {x:init?Math.random()*1.4-.2:(red?1.15:-.15)+Math.random()*.1*(red?1:-1),y:.12+Math.random()*.76,
 l:.06+Math.random()*.28,sp:(.10+Math.random()*.22)*(red?-1:1),w:f<.15?2.6:f<.6?1.4:.8,a:.35+Math.random()*.65,
 c:red?(f<.7?[255,40+Math.random()*40|0,50]:[255,150,60]):(f<.75?[255,246,230]:[150,200,255])}}
function draw(b,st,dt){var r=b.band.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1),W=Math.round(b.band.offsetWidth*dpr),H=Math.round(b.band.offsetHeight*dpr);
 if(!W||!H)return;if(b.c.width!==W||b.c.height!==H){b.c.width=W;b.c.height=H}
 var x=b.x,g=1+st.v*3.2;x.globalCompositeOperation='source-over';x.clearRect(0,0,W,H);x.globalCompositeOperation='lighter';
 b.s.forEach(function(p,i){p.x+=p.sp*dt*g;if(p.sp<0&&p.x+p.l<-.05||p.sp>0&&p.x-p.l>1.05){b.s[i]=nw(b.red,false);return}
  var hx=p.x*W,tx=hx-Math.sign(p.sp)*p.l*W*(1+st.v*.6),y=p.y*H,col=p.c.join(',');
  var gr=x.createLinearGradient(tx,0,hx,0);gr.addColorStop(0,'rgba('+col+',0)');gr.addColorStop(.85,'rgba('+col+','+(p.a*.55)+')');gr.addColorStop(1,'rgba('+col+','+p.a+')');
  x.strokeStyle=gr;x.lineCap='round';x.lineWidth=p.w*dpr*3.2;x.globalAlpha=.22;x.beginPath();x.moveTo(tx,y);x.lineTo(hx,y);x.stroke();
  x.globalAlpha=1;x.lineWidth=p.w*dpr;x.beginPath();x.moveTo(tx,y);x.lineTo(hx,y);x.stroke();
  if(p.w>2){x.fillStyle='rgba('+col+',.9)';x.beginPath();x.arc(hx,y,p.w*dpr*1.4,0,7);x.fill()}});
 x.globalAlpha=1}
LBV.push({name:'Lichtspuren',info:'Langzeitbelichtung: Rück- und Frontlichter ziehen durchs Band',
 on:function(bt){if(!B.length)bt.querySelectorAll('.band').forEach(function(b){B.push(mk(b,b.classList.contains('a')))});B.forEach(function(b){b.c.style.display=''})},
 off:function(){B.forEach(function(b){b.c.style.display='none'})},
 tick:function(st,dt){B.forEach(function(b){draw(b,st,dt)})}});
})();

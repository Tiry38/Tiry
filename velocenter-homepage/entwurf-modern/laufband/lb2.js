/* Mikro-LED-Wand: Inhalt wird in LED-Auflösung gezeichnet, dann als runde LEDs mit Glüh-Ebene dargestellt */
(function(){var LED=null,SRC='';
LB('lb2',function(st,dt){
 if(!LED){var bt=st.bt,box=document.createElement('div');box.className='lbled';box.setAttribute('aria-hidden','true');
  var hi=document.createElement('canvas'),lo=document.createElement('canvas');lo.className='lbglow';box.appendChild(hi);box.appendChild(lo);bt.appendChild(box);
  LED={box:box,hi:hi,lo:lo,hx:hi.getContext('2d'),lx:lo.getContext('2d'),off:0,w:0,h:0,R:0,C:0,strip:null,mk:null,waves:[]};
  box.addEventListener('pointerdown',function(e){var r=box.getBoundingClientRect();LED.waves.push({x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height,t:0})});
  addEventListener('resize',function(){LED.w=0})}
 var L=LED,r=L.box.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
 var txt=[].map.call(st.bt.querySelectorAll('.band .tk'),function(t){return t.dataset.t}).join('|');
 if(!L.w||Math.abs(L.w-r.width)>1||txt!==SRC){
  L.w=r.width;L.h=r.height;L.R=r.width<700?17:21;var P=L.h/L.R;L.C=Math.ceil(L.w/P);
  L.hi.width=Math.round(L.w*dpr);L.hi.height=Math.round(L.h*dpr);L.lo.width=L.C;L.lo.height=L.R;
  /* LED-Maske einmal zeichnen */
  var mk=document.createElement('canvas');mk.width=L.hi.width;mk.height=L.hi.height;var m=mk.getContext('2d'),px=L.hi.width/L.C,py=L.hi.height/L.R;
  m.fillStyle='#050608';m.fillRect(0,0,mk.width,mk.height);m.globalCompositeOperation='destination-out';
  for(var y=0;y<L.R;y++)for(var x=0;x<L.C;x++){m.beginPath();m.arc((x+.5)*px,(y+.5)*py,Math.min(px,py)*.40,0,7);m.fill()}
  L.mk=mk;SRC=txt;L.strip=strip(txt,L.R)}
 /* Bewegung */
 L.off=(L.off+dt*(L.R*1.25)*(1+st.v*1.8))%L.strip.width;
 var lx=L.lx;lx.globalCompositeOperation='source-over';lx.globalAlpha=st.v>.15?Math.max(.35,1-st.v*.22):1;lx.fillStyle='#1C1517';lx.fillRect(0,0,L.C,L.R);lx.globalAlpha=1;
 var o=Math.floor(L.off);lx.drawImage(L.strip,-o,0);lx.drawImage(L.strip,L.strip.width-o,0);
 /* Lichtkegel am Zeiger + Klick-Wellen */
 lx.globalCompositeOperation='lighter';
 if(st.over){var g=lx.createRadialGradient(st.px*L.C,st.py*L.R,0,st.px*L.C,st.py*L.R,L.R*1.1);g.addColorStop(0,'rgba(255,60,70,.30)');g.addColorStop(.6,'rgba(255,60,70,.08)');g.addColorStop(1,'rgba(255,60,70,0)');lx.fillStyle=g;lx.fillRect(0,0,L.C,L.R)}
 L.waves=L.waves.filter(function(w){w.t+=dt;var rad=w.t*L.R*5,a=Math.max(0,1-w.t/1.1);if(a<=0)return false;
  lx.strokeStyle='rgba(255,90,95,'+a+')';lx.lineWidth=1.6;lx.beginPath();lx.ellipse(w.x*L.C,w.y*L.R,rad,rad,0,0,7);lx.stroke();return true});
 lx.globalCompositeOperation='source-over';
 var hx=L.hx;hx.imageSmoothingEnabled=false;hx.drawImage(L.lo,0,0,L.hi.width,L.hi.height);hx.drawImage(L.mk,0,0)});
/* Inhalt in LED-Auflösung: Texte mit ihren Farben, rote Rauten als Trenner */
function strip(t,R){var items=t.split('|'),c=document.createElement('canvas'),x=c.getContext('2d'),fs=Math.round(R*.74),base=Math.round(R*.8);
 var F='italic 800 '+fs+'px Outfit,ui-sans-serif,system-ui,sans-serif';x.font=F;
 var runs=[];items.forEach(function(it){it=it.toUpperCase();var parts=[];
  it.split(/(★|I:SY'S|I:SY|BOSCH|300\+|GOOGLE)/).forEach(function(p){if(!p)return;var col='#F4F4F6';
   if(p==='★'||p==='300+')col='#FFC83D';else if(p.indexOf('I:SY')===0){col='#FF7A00';p=p.replace('I:SY','i:SY')}else if(p==='BOSCH')col='#FF2A33';
   if(p==='GOOGLE'){['#4285F4','#EA4335','#FBBC05','#4285F4','#34A853','#EA4335'].forEach(function(cc,i){parts.push(['Google'[i].toUpperCase(),cc])})}else parts.push([p,col])});
  runs.push(parts)});
 var gap=Math.round(R*1.5),W=0;runs.forEach(function(p){p.forEach(function(q){W+=x.measureText(q[0]).width});W+=gap*2});
 c.width=Math.ceil(W);c.height=R;x.font=F;x.textBaseline='alphabetic';var X=0;
 runs.forEach(function(p){p.forEach(function(q){x.fillStyle=q[1];x.fillText(q[0],X,base);X+=x.measureText(q[0]).width});
  var cx=X+gap,cy=R/2,s=R*.2;x.fillStyle='#FF2A33';x.beginPath();x.moveTo(cx,cy-s);x.lineTo(cx+s,cy);x.lineTo(cx,cy+s);x.lineTo(cx-s,cy);x.fill();X+=gap*2});
 return c}
})();

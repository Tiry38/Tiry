/* Vorlage „Übergänge“ (Tiry 21.11.2026): drei Seitenwechsel auf Basis der View Transitions API.
   Der Browser macht ein GPU-Foto der alten Seite, die neue Seite läuft live darunter/darüber.
   Linse = Kreis aus dem Klickpunkt + Lichtring · Lamellen = 115°-Lamellen brechen weg · Tiefe = Seiten als Karten im Raum.
   Ohne View-Transitions-Unterstützung läuft der bisherige Wischer (#wipe). Nur transform/opacity/clip-path. */
(function(){
var MODES=[['linse','Linse','Klinge'],['lamellen','Lamellen','Rotglas'],['tiefe','Tiefe','Facette']],BG={linse:'klinge',lamellen:'glas',tiefe:'facette'};
var mode=window.UE_DEFAULT||'linse';
try{var q=new URLSearchParams(location.search).get('ue');if(q)mode=q;else{var s=localStorage.getItem('vc_ue');if(s)mode=s}}catch(e){}
if(!MODES.some(function(m){return m[0]===mode}))mode='linse';
var de=document.documentElement,SL=+(window.UE_SLOW||1);
function bg(){de.classList.remove('bg-klinge','bg-glas','bg-facette');de.classList.add('bgx','bg-'+BG[mode])}bg();
var px=0,py=0,pt=-1e9;
addEventListener('pointerdown',function(e){px=e.clientX;py=e.clientY;pt=performance.now()},{capture:true,passive:true});
function origin(){return performance.now()-pt<1600?[px,py]:[innerWidth/2,innerHeight*.42]}

/* cubic-bezier wie in CSS, damit Leinwand und Clip exakt synchron laufen */
function bez(x1,y1,x2,y2){function a(p,q){return 1-3*q+3*p}function b(p,q){return 3*q-6*p}function c(p){return 3*p}
 function cal(t,p,q){return((a(p,q)*t+b(p,q))*t+c(p))*t}function sl(t,p,q){return 3*a(p,q)*t*t+2*b(p,q)*t+c(p)}
 return function(x){if(x<=0)return 0;if(x>=1)return 1;var t=x;for(var i=0;i<6;i++){var s=sl(t,x1,x2);if(Math.abs(s)<1e-6)break;t-=(cal(t,x1,x2)-x)/s}return cal(t,y1,y2)}}
var IO=bez(.76,0,.2,1),OUT=bez(.16,1,.3,1),INO=bez(.65,0,.35,1);
function cl(v){return v<0?0:v>1?1:v}

function fx(){var c=document.createElement('canvas'),d=Math.min(devicePixelRatio||1,1.5);c.id='vtfx';c.setAttribute('aria-hidden','true');
 c.width=Math.round(innerWidth*d);c.height=Math.round(innerHeight*d);document.body.appendChild(c);var g=c.getContext('2d');g.setTransform(d,0,0,d,0,0);return{c:c,g:g}}
function names(on){[['header.hdr','vthdr'],['.fab','vtfab'],['#ueSw','vtsw'],['#ueTip','vttip']].forEach(function(x){var e=document.querySelector(x[0]);if(e)e.style.viewTransitionName=on?x[1]:''})}
function A(pe,kf,o){o.pseudoElement='::view-transition-'+pe+'(root)';o.fill='both';return de.animate(kf,o)}

/* ---------- 1 · Linse ---------- */
function linse(t,F){var o=origin(),x=o[0],y=o[1],W=innerWidth,H=innerHeight,R=Math.hypot(Math.max(x,W-x),Math.max(y,H-y))+30,D=1050*SL;
 var an=A('new',{clipPath:['circle(0px at '+x+'px '+y+'px)','circle('+R+'px at '+x+'px '+y+'px)']},{duration:D,easing:'cubic-bezier(.76,0,.2,1)'});
 A('old',{transform:['scale(1)','scale(.9)'],transformOrigin:[x+'px '+y+'px',x+'px '+y+'px'],filter:['brightness(1) saturate(1)','brightness(.42) saturate(.55)']},{duration:D,easing:'cubic-bezier(.5,0,.2,1)'});
 var g=F.g;
 return function(){var p=cl((an.currentTime||0)/D),e=IO(p),r=R*e;g.clearRect(0,0,W,H);
  /* Blitz am Klickpunkt */
  var fl=1-cl(p/.28);if(fl>0){var gr=g.createRadialGradient(x,y,0,x,y,140);gr.addColorStop(0,'rgba(255,255,255,'+(.95*fl)+')');gr.addColorStop(.35,'rgba(226,35,45,'+(.55*fl)+')');gr.addColorStop(1,'rgba(226,35,45,0)');g.fillStyle=gr;g.fillRect(x-140,y-140,280,280)}
  if(r<2)return;var al=1-cl((p-.78)/.22);if(al<=0)return;
  /* weiches Leuchten außen + Chrom-Ring (konischer Glanz dreht mit) */
  g.lineWidth=34;g.strokeStyle='rgba(226,35,45,'+(.10*al)+')';g.beginPath();g.arc(x,y,r+12,0,7);g.stroke();
  g.lineWidth=12;g.strokeStyle='rgba(226,35,45,'+(.22*al)+')';g.beginPath();g.arc(x,y,r+4,0,7);g.stroke();
  var cg=g.createConicGradient?g.createConicGradient(p*5.5,x,y):null;
  if(cg){cg.addColorStop(0,'rgba(200,16,46,'+al+')');cg.addColorStop(.18,'rgba(255,255,255,'+al+')');cg.addColorStop(.34,'rgba(226,35,45,'+al+')');cg.addColorStop(.62,'rgba(134,130,130,'+al+')');cg.addColorStop(.8,'rgba(255,255,255,'+al+')');cg.addColorStop(1,'rgba(200,16,46,'+al+')');g.strokeStyle=cg}
  else g.strokeStyle='rgba(226,35,45,'+al+')';
  g.lineWidth=3.2;g.beginPath();g.arc(x,y,r,0,7);g.stroke();
  g.lineWidth=1;g.strokeStyle='rgba(255,255,255,'+(.7*al)+')';g.beginPath();g.arc(x,y,Math.max(0,r-3),0,7);g.stroke()}}

/* ---------- 2 · Lamellen (115° wie die Schraffur der Seite) ---------- */
function lamellen(t,F){var o=origin(),W=innerWidth,H=innerHeight,D=1150*SL,gx=Math.sin(115*Math.PI/180),gy=-Math.cos(115*Math.PI/180),nx=-gy,ny=gx,
 w=W>760?120:72,sMax=W*gx+H*gy,N=Math.ceil((sMax+w*2)/w),s0=-w,T=W+H,sc=o[0]*gx+o[1]*gy,SP=.42,SD=.58;
 function slat(i,p){var c=s0+i*w+w/2,dl=Math.abs(c-sc)/sMax*SP;return INO(cl((p-dl)/SD))}
 function P(s,tt){return(s*gx+tt*nx).toFixed(1)+'px '+(s*gy+tt*ny).toFixed(1)+'px'}
 function poly(p){var a=[];for(var i=0;i<N;i++){var c=s0+i*w+w/2,q=slat(i,p),hw=q>=1?0:(w/2+.6)*(1-q);a.push(P(c-hw,-T),P(c-hw,T),P(c+hw,T),P(c+hw,-T))}return'polygon('+a.join(',')+')'}
 var K=44,kf=[];for(var k=0;k<=K;k++)kf.push({clipPath:poly(k/K),offset:k/K});
 var an=A('old',kf,{duration:D,easing:'linear'});
 A('new',{transform:['scale(1.045)','scale(1)'],filter:['brightness(.82)','brightness(1)']},{duration:D,easing:'cubic-bezier(.3,0,.2,1)'});
 var g=F.g;
 return function(){var p=cl((an.currentTime||0)/D);g.clearRect(0,0,W,H);
  for(var i=0;i<N;i++){var q=slat(i,p);if(q<=0||q>=1)continue;var c=s0+i*w+w/2,hw=w/2*(1-q),al=Math.sin(q*Math.PI);
   for(var sd=-1;sd<=1;sd+=2){var s=c+sd*hw,x1=s*gx-T*nx,y1=s*gy-T*ny,x2=s*gx+T*nx,y2=s*gy+T*ny;
    g.lineWidth=9;g.strokeStyle='rgba(226,35,45,'+(.16*al)+')';g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
    g.lineWidth=2.2;g.strokeStyle='rgba(226,35,45,'+(.95*al)+')';g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
    g.lineWidth=.9;g.strokeStyle='rgba(255,255,255,'+(.85*al)+')';var ox=-sd*1.8*gx,oy=-sd*1.8*gy;g.beginPath();g.moveTo(x1+ox,y1+oy);g.lineTo(x2+ox,y2+oy);g.stroke()}}}}

/* ---------- 3 · Tiefe (Seiten als Karten im Raum) ---------- */
function tiefe(t,F,v){var W=innerWidth,H=innerHeight,D=1350*SL,d0=470*SL,R=W>760?30:22;
 var an=A('old',[{transform:'perspective(1600px) translate3d(0,0,0) rotateX(0deg) scale(1)',borderRadius:'0px',filter:'brightness(1)',opacity:1,easing:'cubic-bezier(.55,0,.2,1)'},
  {offset:.4,transform:'perspective(1600px) translate3d(0,-5%,-180px) rotateX(12deg) scale(.76)',borderRadius:R+'px',filter:'brightness(.55)',opacity:1,easing:'cubic-bezier(.4,0,.7,1)'},
  {offset:.62,transform:'perspective(1600px) translate3d(0,-10%,-360px) rotateX(18deg) scale(.64)',borderRadius:R+'px',filter:'brightness(.3)',opacity:0},
  {transform:'perspective(1600px) translate3d(0,-10%,-360px) rotateX(18deg) scale(.64)',borderRadius:R+'px',filter:'brightness(.3)',opacity:0}],{duration:D});
 A('new',[{transform:'translateY(104%) scale(.9)',borderRadius:R+'px'},{transform:'translateY(0) scale(1)',borderRadius:'0px'}],{duration:D-d0,delay:d0,easing:'cubic-bezier(.16,1,.3,1)'});
 var g=F.g;
 return function(){var ms=an.currentTime||0,p=cl(ms/D),q=OUT(cl((ms-d0)/(D-d0))),ty=H*1.04*(1-q),s=.9+.1*q,top=ty+H*(1-s)/2;g.clearRect(0,0,W,H);
  /* Lichtnaht an der Oberkante der neuen Karte */
  if(q>0&&q<1&&top<H){var sa=1-cl((q-.7)/.3),gr=g.createLinearGradient(0,top-46,0,top);gr.addColorStop(0,'rgba(226,35,45,0)');gr.addColorStop(1,'rgba(226,35,45,'+(.22*sa)+')');
   var xL=W*(1-s)/2,xR=W-xL;g.fillStyle=gr;g.fillRect(xL+R,top-46,xR-xL-2*R,46);
   var lg2=g.createLinearGradient(xL,0,xR,0);lg2.addColorStop(0,'rgba(226,35,45,0)');lg2.addColorStop(.2,'rgba(226,35,45,'+sa+')');lg2.addColorStop(.5,'rgba(255,255,255,'+sa+')');lg2.addColorStop(.8,'rgba(226,35,45,'+sa+')');lg2.addColorStop(1,'rgba(226,35,45,0)');
   g.fillStyle=lg2;g.fillRect(xL+R*.6,top-1.5,xR-xL-R*1.2,2.4)}}}

var RUN={linse:linse,lamellen:lamellen,tiefe:tiefe},act=null;
window.VTX=function(update,done,v){if(!document.startViewTransition)return false;
 var m=mode,F=null,draw=null,raf=0,fin=false;
 if(act){try{act.skipTransition()}catch(e){}}
 de.classList.add('vtx','vt-'+m);names(true);
 var t;try{t=document.startViewTransition(function(){update();F=fx()})}catch(e){de.classList.remove('vtx','vt-'+m);names(false);return false}
 act=t;
 function loop(){if(fin)return;if(draw)draw();raf=requestAnimationFrame(loop)}
 t.ready.then(function(){if(!F)return;draw=RUN[m](t,F,v);loop()}).catch(function(){});
 t.finished.catch(function(){}).then(function(){fin=true;cancelAnimationFrame(raf);if(F&&F.c.parentNode)F.c.remove();
  de.classList.remove('vtx','vt-'+m);names(false);if(act===t)act=null;done()});
 return true};

/* ---------- Umschalter unten links ---------- */
function sw(){var b=document.createElement('div');b.id='ueSw';b.setAttribute('role','group');b.setAttribute('aria-label','Übergang wählen');
 b.innerHTML='<span class="ue-k">Übergang</span>'+MODES.map(function(m,i){return'<button type="button" data-ue="'+m[0]+'" aria-pressed="false"><b>'+(i+1)+'</b><span>'+m[1]+'<small>'+m[2]+'</small></span></button>'}).join('');
 document.body.appendChild(b);
 function up(){[].forEach.call(b.querySelectorAll('button'),function(x){var on=x.dataset.ue===mode;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on))})}
 b.addEventListener('click',function(e){var x=e.target.closest('button');if(!x)return;mode=x.dataset.ue;try{localStorage.setItem('vc_ue',mode)}catch(_){}bg();up();tip()});
 var tt=0;function tip(){var n=document.getElementById('ueTip');if(!n){n=document.createElement('div');n.id='ueTip';document.body.appendChild(n)}
  var i=MODES.findIndex(function(m){return m[0]===mode}),m=MODES[i];n.innerHTML='<b>Vorlage '+(i+1)+'</b> · Übergang '+m[1]+' · Hintergrund '+m[2]+' – jetzt Menüpunkt antippen';n.classList.remove('on');void n.offsetWidth;n.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){n.classList.remove('on')},2600)}
 up();setTimeout(tip,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sw);else sw();
})();

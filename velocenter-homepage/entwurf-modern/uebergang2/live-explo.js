/* Seitenwechsel „Explosionszeichnung“ (Tiry 21.11.2026): Kamera kippt die Seite in die Schrägansicht, Bauteile heben sich
   als Ebenen ab (Hilfslinien, Positionsnummern), die neue Seite senkt sich ein. View Transitions API; ohne Unterstützung läuft der Wischer. */
(function(){var de=document.documentElement,SL=1,PI=Math.PI;
function cl(v){return v<0?0:v>1?1:v}
function bez(x1,y1,x2,y2){function a(p,q){return 1-3*q+3*p}function b(p,q){return 3*q-6*p}function c(p){return 3*p}
 function cal(t,p,q){return((a(p,q)*t+b(p,q))*t+c(p))*t}function sl(t,p,q){return 3*a(p,q)*t*t+2*b(p,q)*t+c(p)}
 return function(x){if(x<=0)return 0;if(x>=1)return 1;var t=x;for(var i=0;i<6;i++){var s=sl(t,x1,x2);if(Math.abs(s)<1e-6)break;t-=(cal(t,x1,x2)-x)/s}return cal(t,y1,y2)}}
var IO=bez(.7,0,.25,1),OUT=bez(.16,1,.3,1);
/* gedämpfte Feder: 0 → 1 mit leichtem Überschwingen */
function spring(om,ze){var wd=om*Math.sqrt(1-ze*ze);return function(t){return 1-Math.exp(-ze*om*t)*(Math.cos(wd*t)+ze*om/wd*Math.sin(wd*t))}}
function names(on){[['header.hdr','vthdr'],['.fab','vtfab']].forEach(function(x){var e=document.querySelector(x[0]);if(e)e.style.viewTransitionName=on?x[1]:''})}
function A(pe,nm,kf,o){o.pseudoElement='::view-transition-'+pe+'('+nm+')';o.fill='both';return de.animate(kf,o)}
function view(){return document.querySelector('section.view:not([hidden])')}
function inVP(e){var b=e.getBoundingClientRect();return b.width>6&&b.height>6&&b.bottom>0&&b.top<innerHeight&&b.right>0&&b.left<innerWidth}
function okEl(e){var c=getComputedStyle(e);return c.display!=='inline'&&c.display!=='contents'&&c.display!=='none'&&c.visibility!=='hidden'&&+c.opacity>.05}
var named=[];
function nm(e,n){e.style.viewTransitionName=n;named.push(e)}
function unname(){named.forEach(function(e){e.style.viewTransitionName=''});named=[]}
function unvtm(){[].forEach.call(document.querySelectorAll('.vtm'),function(e){e.classList.remove('vtm')})}
function fx2d(){var c=document.createElement('canvas'),d=Math.min(devicePixelRatio||1,1.5);c.id='vtfx';c.setAttribute('aria-hidden','true');
 c.width=Math.round(innerWidth*d);c.height=Math.round(innerHeight*d);document.body.appendChild(c);var g=c.getContext('2d');g.setTransform(d,0,0,d,0,0);return{c:c,g:g}}

/* ================= 3 · Explosionszeichnung ================= */
/* Kamera kippt die Seite wie eine Konstruktionszeichnung in die Schrägansicht, die Bauteile heben sich als Ebenen ab
   (Maßlinien, Positionsnummern, Umriss auf der Grundplatte), die neue Seite senkt sich Ebene für Ebene ein. */
var XS='p.eyebrow,h1,h2,h3,p.lead,.row > *,.trust > *,.hvis,.bandimg,.duo img,.wm,.logobox,.card,.srow,.tile,figure,li,.chip,.pill,img';
function pickParts(max){var v=view();if(!v)return[];var W=innerWidth,H=innerHeight,c=[].filter.call(v.querySelectorAll(XS),function(e){if(!inVP(e)||!okEl(e))return false;var b=e.getBoundingClientRect();return b.width*b.height>1500&&b.width*b.height<W*H*.3});
 c.sort(function(a,b){var x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return y.width*y.height-x.width*x.height});
 var r=[];c.forEach(function(e){if(r.length>=max)return;if(r.some(function(o){return o.contains(e)||e.contains(o)}))return;r.push(e)});return r}
var PP=1700,AXX=50,AZZ=-24,SC=.36;
function cam(c){return{a:AXX*c*PI/180,b:(AZZ*c)*PI/180,s:1-SC*c}}
function proj(C,x,y,z,k){var cx=x*k.s,cy=y*k.s,x1=cx*Math.cos(k.b)-cy*Math.sin(k.b),y1=cx*Math.sin(k.b)+cy*Math.cos(k.b),y2=y1*Math.cos(k.a)-z*Math.sin(k.a),z2=y1*Math.sin(k.a)+z*Math.cos(k.a),f=PP/(PP-z2);return[C[0]+x1*f,C[1]+y2*f]}
function tf(c,z){var k=cam(c);return'perspective('+PP+'px) rotateX('+(AXX*c).toFixed(3)+'deg) rotateZ('+(AZZ*c).toFixed(3)+'deg) scale('+k.s.toFixed(4)+') translateZ('+z.toFixed(1)+'px)'}
function geo(list,C){var N=list.length,H=innerHeight;return list.map(function(e,i){var b=e.getBoundingClientRect();
 return{e:e,b:b,x0:b.left-C[0],y0:b.top-C[1],x1:b.right-C[0],y1:b.bottom-C[1],z:H*(.06+.26*(N>1?(N-1-i)/(N-1):1))}})}
var EX={fx:fx2d,prep:function(){var mx=innerWidth>760?12:8,C=[innerWidth/2,innerHeight*.56],o=geo(pickParts(mx),C);o.forEach(function(p,i){p.e.classList.add('vtm');nm(p.e,'x-o'+i)});return{C:C,old:o}},
 after:function(st){var mx=innerWidth>760?12:8,n=geo(pickParts(mx),st.C);n.forEach(function(p,i){p.e.classList.add('vtm');nm(p.e,'x-n'+i)});st.nw=n},
 go:function(t,F,st){var C=st.C,W=innerWidth,H=innerHeight,D=2100*SL,K=48,fS=spring(11,.62);
  /* Kamera: 0–.3 kippen, .3–.62 schweben (leichte Drehung), .62–1 zurück mit Feder */
  function camAt(u){if(u<.3)return IO(u/.3);if(u<.62)return 1;var s=fS((u-.62)/.38*.95);return 1-s}
  function orb(u){return u<.3?0:u<.62?IO((u-.3)/.32)*.06:.06*(1-IO((u-.62)/.38))}
  function oldZ(p,i,u){var a=cl((u-.04-i*.012)/.3),e=IO(a);var up=cl((u-.36-i*.008)/.2);return{z:p.z*e+H*.9*up*up,op:1-cl((u-.40-i*.008)/.14)}}
  function newZ(p,i,u){var a=cl((u-.40)/.18),dn=cl((u-.62-(st.nw.length-1-i)*.014)/.3);var z=p.z+H*.9*(1-IO(a));z=z*(1-fS(dn*.9));return{z:z,op:IO(cl((u-.40)/.14))}}
  function ori(p){return(-p.x0).toFixed(1)+'px '+(-p.y0).toFixed(1)+'px'}
  function rootKF(isOld){var kf=[];for(var k=0;k<=K;k++){var u=k/K,c=camAt(u)+orb(u);kf.push({offset:u,transform:tf(c,0),transformOrigin:C[0]+'px '+C[1]+'px',
    opacity:isOld?1-cl((u-.38)/.16):cl((u-.40)/.16),boxShadow:'0 '+(40*Math.max(0,c)).toFixed(1)+'px '+(90*Math.max(0,c)).toFixed(1)+'px rgba(20,22,28,'+(.28*Math.max(0,c)).toFixed(3)+')',borderRadius:(18*Math.max(0,c)).toFixed(1)+'px'})}return kf}
  var an=A('old','root',rootKF(true),{duration:D,easing:'linear'});A('new','root',rootKF(false),{duration:D,easing:'linear'});
  st.old.forEach(function(p,i){var kf=[];for(var k=0;k<=K;k++){var u=k/K,s=oldZ(p,i,u);kf.push({offset:u,transform:tf(camAt(u)+orb(u),s.z),transformOrigin:ori(p),opacity:s.op})}A('old','x-o'+i,kf,{duration:D,easing:'linear'})});
  st.nw.forEach(function(p,i){var kf=[];for(var k=0;k<=K;k++){var u=k/K,s=newZ(p,i,u);kf.push({offset:u,transform:tf(camAt(u)+orb(u),s.z),transformOrigin:ori(p),opacity:s.op})}A('new','x-n'+i,kf,{duration:D,easing:'linear'})});
  var g=F.g;
  function part(p,i,z,al,k){if(al<=.01)return;var c4=[[p.x0,p.y0],[p.x1,p.y0],[p.x1,p.y1],[p.x0,p.y1]],b=c4.map(function(v){return proj(C,v[0],v[1],0,k)}),a=c4.map(function(v){return proj(C,v[0],v[1],z,k)});
   g.globalAlpha=al;g.setLineDash([4,4]);g.lineWidth=1;g.strokeStyle='#D4152F';g.beginPath();b.forEach(function(v,j){j?g.lineTo(v[0],v[1]):g.moveTo(v[0],v[1])});g.closePath();g.stroke();
   g.strokeStyle='rgba(70,74,82,.75)';g.beginPath();for(var j=0;j<4;j++){g.moveTo(b[j][0],b[j][1]);g.lineTo(a[j][0],a[j][1])}g.stroke();g.setLineDash([]);
   g.fillStyle='#D4152F';for(j=0;j<4;j++){g.beginPath();g.arc(b[j][0],b[j][1],2.2,0,7);g.fill()}
   var t0=a[1];g.strokeStyle='rgba(212,21,47,.35)';g.lineWidth=5;g.beginPath();g.arc(t0[0],t0[1],6.5,0,7);g.stroke();g.fillStyle='#D4152F';g.beginPath();g.arc(t0[0],t0[1],3.2,0,7);g.fill();
   g.font='700 11px Outfit,system-ui,sans-serif';var lab='POS '+('0'+(i+1)).slice(-2)+' · Z '+Math.round(z);var tw=g.measureText(lab).width;
   g.fillStyle='rgba(255,255,255,.9)';g.beginPath();g.roundRect?g.roundRect(t0[0]+10,t0[1]-22,tw+14,18,9):g.rect(t0[0]+10,t0[1]-22,tw+14,18);g.fill();
   g.fillStyle='#2A2D33';g.fillText(lab,t0[0]+17,t0[1]-9);g.globalAlpha=1}
  return function(){var u=cl((an.currentTime||0)/D),c=camAt(u)+orb(u),k=cam(c);g.clearRect(0,0,W,H);if(c<.05)return;
   st.old.forEach(function(p,i){var s=oldZ(p,i,u);part(p,i,s.z,Math.min(1,s.z/60)*s.op*Math.min(1,c*1.5),k)});
   st.nw.forEach(function(p,i){var s=newZ(p,i,u);part(p,i,s.z,Math.min(1,s.z/60)*s.op*Math.min(1,c*1.5),k)})}}};

var act=null;
window.VTX=function(update,done,v){if(!document.startViewTransition)return false;
 var m='explo',R=EX,F=null,draw=null,raf=0,fin=false,st;
 if(act){try{act.skipTransition()}catch(e){}}
 unname();
 de.classList.add('vtx','vt-'+m);names(true);st=R.prep();
 var t;try{t=document.startViewTransition(function(){unname();unvtm();update();if(R.after)R.after(st);if(R.fx)F=R.fx()})}
 catch(e){unname();de.classList.remove('vtx','vt-'+m);names(false);return false}
 act=t;
 function loop(){if(fin)return;if(draw)draw();raf=requestAnimationFrame(loop)}
 t.ready.then(function(){draw=R.go(t,F,st);if(draw)loop()}).catch(function(){});
 t.finished.catch(function(){}).then(function(){fin=true;cancelAnimationFrame(raf);if(F&&F.c.parentNode)F.c.remove();unname();
  de.classList.remove('vtx','vt-'+m);names(false);if(act===t)act=null;done()});
 return true};
})();

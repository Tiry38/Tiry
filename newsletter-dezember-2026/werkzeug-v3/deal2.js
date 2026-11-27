// Winter-Karte der Homepage als nahtlose 10-s-Schleife (200 Bilder à 50 ms):
// echter Homepage-Aufbau, Schnee = Homepage-Kristallschnee (gleiche Formen, Farben, Größen, Tempo), Sattel schwebt (suf 5 s)
const {chromium}=require('playwright');const N=+(process.env.N||200),T=10;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:600,height:1200},deviceScaleFactor:2});
await p.clock.install();
await p.goto('https://tiry38.github.io/velo-center-web/',{waitUntil:'load'});
await p.clock.runFor(4000);await p.waitForTimeout(1500);
await p.addStyleTag({content:'#deal .cdn,#deal .cta,#snow{display:none!important} #deal{clip-path:none!important;-webkit-mask:none!important;mask:none!important;border-radius:0!important} nav,header,[class*="mbar"],[class*="dock"]{visibility:hidden!important} #deal{margin-top:0!important} #snow2{position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none}'});
const d=await p.$('#deal');await d.scrollIntoViewIfNeeded();await p.clock.runFor(2000);await p.waitForTimeout(800);
await p.evaluate(()=>{for(const e of document.querySelectorAll('body *')){const cs=getComputedStyle(e);if(cs.position==='fixed'&&!e.closest('#deal'))e.style.visibility='hidden'}
 const c=document.createElement('canvas');c.id='snow2';const o=document.getElementById('snow');o.parentNode.insertBefore(c,o);
 document.getAnimations().forEach(a=>a.pause());});
const bb=await d.boundingBox();console.log(bb);
await p.evaluate(T=>{const cv=document.getElementById('snow2'),cx=cv.getContext('2d');const r0=cv.getBoundingClientRect(),D=2,W=r0.width,H2=r0.height;cv.width=W*D;cv.height=H2*D;
 const AST=[[[.38,.26],[.62,.22],[.82,.13]],[[.45,.36],[.75,.16]],[[.3,.18],[.52,.3],[.74,.18],[.9,.08]]];
 const P=AST.map(br=>{const q=new Path2D();for(let i=0;i<6;i++){const t=i*Math.PI/3,ux=Math.sin(t),uy=-Math.cos(t),px=-uy,py=ux;
   q.moveTo(ux*.17,uy*.17);q.lineTo(ux,uy);br.forEach(([d,l])=>{const bx=ux*d,by=uy*d;q.moveTo(bx,by);q.lineTo(bx+(ux+px)*l*.72,by+(uy+py)*l*.72);q.moveTo(bx,by);q.lineTo(bx+(ux-px)*l*.72,by+(uy-py)*l*.72)})}
  for(let i=0;i<=6;i++){const t=i*Math.PI/3+Math.PI/6,x=Math.sin(t)*.17,y=-Math.cos(t)*.17;i?q.lineTo(x,y):q.moveTo(x,y)}return q});
 let s=7;const R=()=>{s=(s*16807)%2147483647;return s/2147483647};const w0=2*Math.PI/T,HH=H2+20;
 // Homepage-Werte (gleiche Formeln), Frequenzen auf die 10-s-Schleife gerundet
 const F=Array.from({length:Math.round(W/16)},()=>{const r=4.2+R()*3.4;const v=.22+R()*.5+r*.06;const w=(R()-.5)*.025,gf=.6+R()*.9;
  return {x:R()*W,y:R()*HH,r,vs:v*42,s:R()*6,a:R()*6.3,wr:Math.round(w*42/w0)*w0,k:R()*3|0,o:.72+R()*.28,g:R()*40,shw:Math.max(1,Math.round(gf*2.2/w0))*w0,glw:w0,tau:R()*T}});
 const TX=[...cv.parentElement.querySelectorAll('.eyebrow,.minus,h2,.wbk,.sux,.winc,.lead')].map(e=>{const r=e.getBoundingClientRect();return [r.left-r0.left-10,r.top-r0.top-10,r.right-r0.left+10,r.bottom-r0.top+10]});
 const ss=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
 // weicher Rand statt harter Kante hinter Text (sonst sichtbare „Würfel“)
 const dim=(x,y)=>{let m=1;for(const r of TX){const e=Math.min(x-r[0],r[2]-x,y-r[1],r[3]-y);if(e>-14){m=Math.min(m,1-.88*ss((e+14)/28))}}return m};
 function star(x,y,l,al){cx.setTransform(D,0,0,D,x*D,y*D);cx.globalAlpha=al;const gr=cx.createRadialGradient(0,0,0,0,0,l);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.35,'rgba(210,232,255,.55)');gr.addColorStop(1,'rgba(210,232,255,0)');cx.fillStyle=gr;
  cx.beginPath();cx.moveTo(0,-l);cx.lineTo(l*.09,-l*.09);cx.lineTo(l,0);cx.lineTo(l*.09,l*.09);cx.lineTo(0,l);cx.lineTo(-l*.09,l*.09);cx.lineTo(-l,0);cx.lineTo(-l*.09,-l*.09);cx.closePath();cx.fill()}
 function one(f,tt,al,ts){const y=((f.y+f.vs*tt)%HH+HH)%HH-10;const x=f.x-21*Math.cos(ts*w0+f.s);const m=dim(x,y);
   const sh=.5+.5*Math.sin(ts*f.shw+f.s*3),gl=Math.pow(Math.max(0,Math.sin(ts*f.glw+f.g)),60)*.45*m;
   cx.setTransform(D*f.r,0,0,D*f.r,x*D,y*D);cx.rotate(f.a+f.wr*ts);
   cx.globalAlpha=al*f.o*(.24+.06*sh)*m;cx.strokeStyle='#BFE0FF';cx.lineWidth=2.6/f.r;cx.stroke(P[f.k]);
   cx.globalAlpha=al*f.o*(.88+.08*sh+gl*.3)*m;cx.strokeStyle='#FFFFFF';cx.lineWidth=.95/f.r;cx.stroke(P[f.k]);
   if(gl>.03&&al>.5){cx.globalCompositeOperation='lighter';star(x,y,f.r*1.5,gl*.7*al);cx.globalCompositeOperation='source-over'}}
 window.snowT=t=>{cx.setTransform(1,0,0,1,0,0);cx.clearRect(0,0,cv.width,cv.height);cx.lineCap='round';cx.lineJoin='round';
  // jede Flocke wechselt einmal je Schleife weich (1,6 s) zu ihrer Position von vor 10 s -> Bild 0 = Bild T, ohne Sprung
  F.forEach(f=>{const u=Math.max(0,Math.min(1,(t-f.tau+.8)/1.6));const a=.5-.5*Math.cos(Math.PI*u);if(a<1)one(f,t,1-a,t);if(a>0)one(f,t-T,a,t)});cx.globalAlpha=1;
  document.getAnimations().forEach(an=>{an.currentTime=(t*1000)%5000+ (an.effect&&an.effect.getTiming().delay||0)})};
},T);
for(let i=0;i<N;i++){await p.evaluate(t=>snowT(t),i*T/N);await p.waitForTimeout(20);
 await p.screenshot({path:`fr/deal2/${String(i).padStart(3,'0')}.png`,clip:{x:bb.x,y:bb.y,width:bb.width,height:bb.height}});}
await b.close();})();

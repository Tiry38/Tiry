/* Vorlage „Verwandlung“ (16.11.2026, Tiry): Rad + Hersteller-Logo verwandeln sich ineinander statt raus/rein zu gleiten.
   WebGL: das alte Bild zerfällt entlang einer wandernden Front (leuchtende Kante) in Partikel, die Partikel fliegen in die Form
   des neuen Bildes und setzen es dort wieder zusammen. Gleiche Front für Rad, Spiegelung und Logo. Läuft nur während des Wechsels
   (≈1,8 s), danach ist die Zeichenfläche weg – kein Dauer-Aufwand. Ohne WebGL: alter Wechsel. */
(function(){'use strict';
const VM=window.VM={on:true,ok:false,dur:1800};
/* ---- Rauschfeld (64×64, wiederholend) – identisch auf CPU und GPU ---- */
const NS=64,NZ=new Uint8Array(NS*NS);
{let s=20261116;const r=()=>(s=(s*16807)%2147483647)/2147483647;const a=new Float32Array(NS*NS);for(let i=0;i<a.length;i++)a[i]=r();
 const b=new Float32Array(NS*NS);let lo=9,hi=-9;
 for(let y=0;y<NS;y++)for(let x=0;x<NS;x++){let v=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)v+=a[((y+j+NS)%NS)*NS+((x+i+NS)%NS)];b[y*NS+x]=v;lo=Math.min(lo,v);hi=Math.max(hi,v)}
 for(let i=0;i<b.length;i++)NZ[i]=Math.round((b[i]-lo)/(hi-lo)*255)}
const nz=(u,v)=>{const fx=u*NS-.5,fy=v*NS-.5,x0=Math.floor(fx),y0=Math.floor(fy),tx=fx-x0,ty=fy-y0,g=(x,y)=>NZ[(((y%NS)+NS)%NS)*NS+(((x%NS)+NS)%NS)]/255;
 return (g(x0,y0)*(1-tx)+g(x0+1,y0)*tx)*(1-ty)+(g(x0,y0+1)*(1-tx)+g(x0+1,y0+1)*tx)*ty};
/* Front: läuft von links unten nach rechts oben, mit organischer Kante */
const keyRaw=(x,y,W,H)=>.6*(x/W)+.12*(1-y/H)+.28*(.65*nz(x/150,y/150)+.35*nz(x/57+.37,y/57+.71));
const R0=.03,RW=.47,FL=.47,HOLO=[.13,.69,.93];/* Eisblau-Cyan der Hologramm-Zone */
const GLSL_KEY=`uniform sampler2D uN;uniform vec2 uCss;uniform float uK0,uK1;
float kraw(vec2 p){return .6*(p.x/uCss.x)+.12*(1.-p.y/uCss.y)+.28*(.65*texture2D(uN,p/150.).r+.35*texture2D(uN,p/57.+vec2(.37,.71)).r);}
float kn(vec2 p){return clamp((kraw(p)-uK0)/(uK1-uK0),0.,1.);}`;
const VS_Q=`attribute vec2 aP;uniform vec4 uRect;uniform vec2 uRes;uniform float uDpr,uRefl;varying vec2 vU;varying vec2 vC;
void main(){vec2 c=uRect.xy+aP*uRect.zw;vU=aP;if(uRefl>.5){c.y=uRect.y+uRect.w+2.+aP.y*uRect.w;}vC=c;
vec2 d=c*uDpr/uRes*2.-1.;gl_Position=vec4(d.x,-d.y,0.,1.);}`;
const FS_Q=`precision highp float;${GLSL_KEY}
uniform sampler2D uTex;uniform vec4 uRect;uniform float uT,uMode,uRefl,uGlowOn,uR0,uRW,uF;uniform vec3 uEdge,uHolo;varying vec2 vU;varying vec2 vC;
void main(){vec2 uv=vU;vec2 p=vC;float m=1.;
 if(uRefl>.5){float s=vU.y;uv=vec2(vU.x,1.-vU.y);p=vec2(vC.x,uRect.y+uRect.w-s*uRect.w);m=.17*clamp((1.-s-.68)/.32,0.,1.);}
 float r=uR0+kn(p)*uRW;float d=uMode<.5?r-uT:uT-(r+uF);float vis=smoothstep(0.,.006,d);
 float fade=uMode<.5?smoothstep(0.,.03,uT):1.-smoothstep(.93,1.,uT);
 float h=(1.-smoothstep(0.,uMode<.5?.035:.05,d))*uGlowOn*fade;
 vec2 off=vec2(.004*h,0.);vec4 c=texture2D(uTex,uv),cl=texture2D(uTex,uv-off),cr=texture2D(uTex,uv+off);
 c=mix(c,vec4(cl.r,c.g,cr.b,max(c.a,max(cl.a,cr.a))),h);
 float lum=dot(c.rgb,vec3(.3,.59,.11));float scan=.62+.38*sin(gl_FragCoord.y*1.9);
 vec3 holo=uHolo*c.a*(.35+1.2*lum/max(c.a,.001));vec3 rgb=mix(c.rgb,holo,h*.6);float a=c.a*mix(1.,scan,h*.9);rgb*=mix(1.,scan,h*.9);
 float e=(1.-smoothstep(0.,.007,d))*uGlowOn*fade;float ec=1.-smoothstep(0.,.0025,d);rgb=mix(rgb,mix(uEdge,vec3(1.,.93,.9),ec*.6)*a,e);
 gl_FragColor=vec4(rgb,a)*vis*m;}`;
const VS_P=`attribute vec2 aA,aB,aK;attribute vec3 aCA,aCB;attribute float aR;uniform vec2 uRes;uniform float uDpr,uT,uPs,uGlowOn,uR0,uRW,uF,uLag,uTrail;uniform vec3 uEdge,uHolo;
varying vec3 vCol;varying float vA,vHot,vSq;
void main(){float t0=uR0+aK.x*uRW;float t1=max(uR0+aK.y*uRW+uF,t0+.12);float p=clamp((uT-uLag-t0)/(t1-t0),0.,1.);
 float e=p<.5?4.*p*p*p:1.-pow(-2.*p+2.,3.)/2.;vec2 d=aB-aA;float L=length(d);vec2 n=L>.001?vec2(-d.y,d.x)/L:vec2(0.,1.);float s=sin(3.14159*p);
 vec2 pos=mix(aA,aB,e)+n*s*(aR-.5)*(.05*L+5.)+vec2(0.,-1.)*s*(3.+8.*fract(aR*7.13));
 /* Digitalisieren: unterwegs rasten die Teilchen in ein Voxel-Gitter ein */
 float g=5.;float sn=smoothstep(.12,.55,s)*uGlowOn;pos=mix(pos,(floor(pos/g)+.5)*g,sn);
 vec2 c=pos*uDpr/uRes*2.-1.;gl_Position=vec4(c.x,-c.y,0.,1.);
 float hot=max(exp(-p*16.),exp(-(1.-p)*16.))*uGlowOn;
 float fz=fract(aR*13.7);float isE=step(fz,.10);
 gl_PointSize=mix(uPs*(1.+.7*hot),g*.82,sn)*uDpr*(1.+.25*isE*s)*(1.-.25*uTrail);
 vA=smoothstep(0.,.03,p)*(1.-smoothstep(.97,1.,p))*(1.-uTrail)*mix(1.,.78,sn);
 vec3 col=mix(aCA,aCB,e);float lu=dot(col,vec3(.3,.59,.11));
 col=mix(col,vec3(.16,.18,.22)+lu*.35,.45*sn);
 vec3 en=fz<.075?uEdge:uHolo;
 vCol=mix(col,en,clamp(isE*(.5+.5*s)+.65*hot,0.,1.)*uGlowOn);vHot=max(hot,isE*s)*uGlowOn;vSq=sn;}`;
const FS_P=`precision mediump float;varying vec3 vCol;varying float vA,vHot,vSq;
void main(){vec2 q=abs(gl_PointCoord-.5);float r=mix(length(q),max(q.x,q.y),vSq);
 float a=mix(smoothstep(.5,.1,r),1.-smoothstep(.40,.5,r),vSq)*vA;if(a<.004)discard;
 float rim=vSq*smoothstep(.30,.46,r);vec3 c=mix(vCol,vCol*.55,rim);
 c=mix(c,vec3(1.),.6*smoothstep(.24,.0,r)*vHot);gl_FragColor=vec4(c*a,a);}`;
/* ---- GL je Zeichenfläche ---- */
function mk(cv){const gl=cv.getContext('webgl',{premultipliedAlpha:true,alpha:true,antialias:true,preserveDrawingBuffer:false});if(!gl)return null;
 const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o};
 const pr=(v,f)=>{const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
  const u={},a={};const nu=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<nu;i++){const n=gl.getActiveUniform(p,i).name;u[n]=gl.getUniformLocation(p,n)}
  const na=gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);for(let i=0;i<na;i++){const n=gl.getActiveAttrib(p,i).name;a[n]=gl.getAttribLocation(p,n)}return{p,u,a}};
 const G={gl,q:pr(VS_Q,FS_Q),pt:pr(VS_P,FS_P)};
 G.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,G.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
 G.nt=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,G.nt);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,NS,NS,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,NZ);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
 G.pb=gl.createBuffer();G.tex=[gl.createTexture(),gl.createTexture()];return G}
function texUp(G,t,cv){const gl=G.gl;gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,cv);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)}
/* ---- Hilfen ---- */
const load=src=>new Promise(res=>{const im=new Image();im.decoding='async';im.onload=()=>res(im);im.onerror=()=>res(null);im.src=src});
/* Box eines Bildes so messen, wie die Seite es zeigen würde (gleiche Klassen, keine Übergänge) */
function measure(tpl,src){return new Promise(res=>{const m=tpl.cloneNode(false);m.removeAttribute('id');m.removeAttribute('loading');m.removeAttribute('data-src');m.removeAttribute('hidden');
 m.className=tpl.className.replace(/\b(off|out-l|in-r|swap)\b/g,' ');m.style.cssText='visibility:hidden;transition:none;animation:none;opacity:0';m.alt='';m.setAttribute('aria-hidden','true');
 const done=()=>{const w=m.offsetWidth,h=m.offsetHeight,cx=m.offsetLeft,cy=m.offsetTop,nw=m.naturalWidth||w,nh=m.naturalHeight||h;m.remove();
  const s=Math.min(w/nw,h/nh),cw=nw*s,ch=nh*s;res({x:cx-cw/2,y:cy-ch/2,w:cw,h:ch})};
 tpl.parentNode.insertBefore(m,tpl);m.onload=()=>(m.decode?m.decode().catch(()=>{}):Promise.resolve()).then(done);m.onerror=done;m.src=src;if(m.complete&&m.naturalWidth)m.onload()})}
function raster(im,r,dpr){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(r.w*dpr));c.height=Math.max(1,Math.round(r.h*dpr));const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(im,0,0,c.width,c.height);return c}
/* Punkte aus den deckenden Pixeln eines Bildes */
function points(im,r,step,N,W,H){const cw=Math.max(2,Math.round(r.w/step)),ch=Math.max(2,Math.round(r.h/step));const c=document.createElement('canvas');c.width=cw;c.height=ch;
 const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,cw,ch);const d=x.getImageData(0,0,cw,ch).data,P=[];const sx=r.w/cw,sy=r.h/ch;
 for(let j=0;j<ch;j++)for(let i=0;i<cw;i++){const o=(j*cw+i)*4;if(d[o+3]>140){const px=r.x+(i+.2+Math.random()*.6)*sx,py=r.y+(j+.2+Math.random()*.6)*sy;P.push([px,py,d[o]/255,d[o+1]/255,d[o+2]/255,keyRaw(px,py,W,H)])}}
 if(!P.length)P.push([r.x+r.w/2,r.y+r.h/2,.5,.5,.5,keyRaw(r.x+r.w/2,r.y+r.h/2,W,H)]);
 const out=new Array(N);if(P.length>=N){for(let i=0;i<N;i++){const j=i+Math.floor(Math.random()*(P.length-i));const t=P[i];P[i]=P[j];P[j]=t;out[i]=P[i]}}else for(let i=0;i<N;i++)out[i]=P[Math.floor(Math.random()*P.length)];
 return out.sort((a,b)=>a[5]-b[5])}
const hex=s=>{s=String(s||'').trim();const m=s.match(/^#?([0-9a-f]{6})$/i);if(m){const n=parseInt(m[1],16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}
 const r=s.match(/rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);return r?[r[1]/255,r[2]/255,r[3]/255]:[.886,.137,.176]};
/* ---- eine Ebene (Rad oder Logo) vorbereiten ---- */
async function layer(root,cv,o,kind){const dpr=Math.min(2,devicePixelRatio||1),W=root.clientWidth,H=root.clientHeight;
 const [ia,ib,ra,rb]=await Promise.all([load(o.from),load(o.to),measure(o.tplA,o.from),measure(o.tplB,o.to)]);if(!ia||!ib)throw new Error('Bild');
 cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);if(!cv._G)cv._G=mk(cv);const G=cv._G;if(!G)throw new Error('WebGL');
 texUp(G,G.tex[0],raster(ia,ra,dpr));texUp(G,G.tex[1],raster(ib,rb,dpr));
 const area=Math.max(ra.w*ra.h,rb.w*rb.h);const N=Math.round(Math.min(kind==='bike'?15000:7000,Math.max(2500,area/(kind==='bike'?14:22))));
 const step=kind==='bike'?1.4:1.8;const A=points(ia,ra,step,N,W,H),B=points(ib,rb,step,N,W,H);
 let k0=Infinity,k1=-Infinity;for(const p of A){k0=Math.min(k0,p[5]);k1=Math.max(k1,p[5])}for(const p of B){k0=Math.min(k0,p[5]);k1=Math.max(k1,p[5])}if(k1-k0<.01)k1=k0+.01;
 const f=new Float32Array(N*13);for(let i=0;i<N;i++){const a=A[i],b=B[i],q=i*13;f[q]=a[0];f[q+1]=a[1];f[q+2]=b[0];f[q+3]=b[1];f[q+4]=(a[5]-k0)/(k1-k0);f[q+5]=(b[5]-k0)/(k1-k0);f[q+6]=a[2];f[q+7]=a[3];f[q+8]=a[4];f[q+9]=b[2];f[q+10]=b[3];f[q+11]=b[4];f[q+12]=Math.random()}
 const gl=G.gl;gl.bindBuffer(gl.ARRAY_BUFFER,G.pb);gl.bufferData(gl.ARRAY_BUFFER,f,gl.STATIC_DRAW);
 return{G,N,ra,rb,k0,k1,W,H,dpr,ps:kind==='bike'?1.55:1.9,glow:kind==='bike'?1:.7,refl:!!o.refl}}
function draw(L,T,glow){const{G,N,ra,rb,k0,k1,W,H,dpr}=L,gl=G.gl;gl.viewport(0,0,gl.canvas.width,gl.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
 gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
 const Q=G.q;gl.useProgram(Q.p);gl.bindBuffer(gl.ARRAY_BUFFER,G.quad);gl.enableVertexAttribArray(Q.a.aP);gl.vertexAttribPointer(Q.a.aP,2,gl.FLOAT,false,0,0);
 gl.uniform2f(Q.u.uRes,gl.canvas.width,gl.canvas.height);gl.uniform1f(Q.u.uDpr,dpr);gl.uniform2f(Q.u.uCss,W,H);gl.uniform1f(Q.u.uK0,k0);gl.uniform1f(Q.u.uK1,k1);gl.uniform1f(Q.u.uT,T);
 gl.uniform1f(Q.u.uR0,R0);gl.uniform1f(Q.u.uRW,RW);gl.uniform1f(Q.u.uF,FL);gl.uniform3fv(Q.u.uEdge,glow);gl.uniform3fv(Q.u.uHolo,HOLO);gl.uniform1f(Q.u.uGlowOn,L.glow);
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,G.nt);gl.uniform1i(Q.u.uN,1);gl.activeTexture(gl.TEXTURE0);gl.uniform1i(Q.u.uTex,0);
 [[0,ra],[1,rb]].forEach(([m,r])=>{gl.bindTexture(gl.TEXTURE_2D,G.tex[m]);gl.uniform1f(Q.u.uMode,m);gl.uniform4f(Q.u.uRect,r.x,r.y,r.w,r.h);
  for(const rf of L.refl?[1,0]:[0]){gl.uniform1f(Q.u.uRefl,rf);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}});
 gl.disableVertexAttribArray(Q.a.aP);
 const P=G.pt;gl.useProgram(P.p);gl.bindBuffer(gl.ARRAY_BUFFER,G.pb);const S=13*4,at=(n,sz,off)=>{gl.enableVertexAttribArray(P.a[n]);gl.vertexAttribPointer(P.a[n],sz,gl.FLOAT,false,S,off*4)};
 at('aA',2,0);at('aB',2,2);at('aK',2,4);at('aCA',3,6);at('aCB',3,9);at('aR',1,12);
 gl.uniform2f(P.u.uRes,gl.canvas.width,gl.canvas.height);gl.uniform1f(P.u.uDpr,dpr);gl.uniform1f(P.u.uT,T);gl.uniform1f(P.u.uPs,L.ps);gl.uniform1f(P.u.uGlowOn,L.glow);gl.uniform3fv(P.u.uEdge,glow);gl.uniform3fv(P.u.uHolo,HOLO);
 gl.uniform1f(P.u.uR0,R0);gl.uniform1f(P.u.uRW,RW);gl.uniform1f(P.u.uF,FL);
 /* Schweif: zwei verzögerte, blassere Durchgänge, dann die Partikel selbst */
 for(const [lag,tr] of L.glow?[[.05,.82],[.025,.6],[0,0]]:[[0,0]]){gl.uniform1f(P.u.uLag,lag);gl.uniform1f(P.u.uTrail,tr);gl.drawArrays(gl.POINTS,0,N)}
 ['aA','aB','aK','aCA','aCB','aR'].forEach(n=>gl.disableVertexAttribArray(P.a[n]))}
/* Zeichenflächen je Showroom (bleiben bestehen, im Ruhezustand ausgeblendet) */
function cvFor(root,key,place){root._vm=root._vm||{};let c=root._vm[key];if(!c){c=document.createElement('canvas');c.className='vmcv';c.setAttribute('aria-hidden','true');root._vm[key]=c;place(c)}return c}
const quiet=(el,fn)=>{el.style.transition='none';fn();requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.transition=''}))};
/* o = {root, bike:{oldEl,newEl,to,from?,alt?}, logo:{el,to,from?,op0?}} – erledigt den kompletten Wechsel */
VM.run=async function(o){const root=o.root,bk=o.bike,lg=o.logo;const bOld=bk.oldEl,bNew=bk.newEl,from=bk.from||bOld.currentSrc||bOld.src,lFrom=lg.from||lg.el.currentSrc||lg.el.src;
 const fl=root.querySelector(':scope>.hfloor');const cB=cvFor(root,'b',c=>fl?fl.before(c):bNew.after(c)),cL=cvFor(root,'l',c=>lg.el.after(c));
 const csB=getComputedStyle(bOld),csL=getComputedStyle(lg.el);const op0=lg.op0!=null?lg.op0:csL.opacity;
 const finish=()=>{if(bNew===bOld){if(bNew.getAttribute('src')!==bk.to)bNew.src=bk.to}quiet(bNew,()=>{bNew.classList.remove('off','out-l','in-r');bNew.style.opacity=''});
  if(bOld!==bNew)quiet(bOld,()=>{bOld.classList.add('off');bOld.style.opacity=''});if(bk.alt)bNew.alt=bk.alt;
  quiet(lg.el,()=>{lg.el.style.opacity=''});cB.style.display='none';cL.style.display='none';root.classList.remove('vmrun')};
 try{let Lb,Ll;[Lb,Ll]=await Promise.all([layer(root,cB,{from,to:bk.to,tplA:bOld,tplB:bNew,refl:(csB.webkitBoxReflect||'none')!=='none'},'bike'),
   layer(root,cL,{from:lFrom,to:lg.to,tplA:lg.el,tplB:lg.el},'logo')]);
  cB.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;filter:'+csB.filter;
  cL.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:'+csL.mixBlendMode+';filter:'+csL.filter+';opacity:'+op0;
  const ac=()=>hex(getComputedStyle(root.closest('.show')||root).getPropertyValue('--ac')||'#E2232D');let glow=[.886,.137,.176];try{glow=ac()}catch(_){}
  draw(Lb,0,glow);draw(Ll,0,glow);root.classList.add('vmrun');
  /* gleicher Takt: Zeichenfläche zeigt exakt das alte Bild, dann echte Bilder still ausblenden */
  quiet(bOld,()=>{bOld.style.opacity='0'});if(bNew!==bOld)bNew.style.opacity='0';quiet(lg.el,()=>{lg.el.style.opacity='0'});
  lg.el.src=lg.to;if(bNew===bOld)bNew.src=bk.to;
  const op1=lg.op1!=null?lg.op1:(()=>{const v=lg.el.style.opacity;lg.el.style.opacity='';const r=getComputedStyle(lg.el).opacity;lg.el.style.opacity=v;return r})();
  cL.style.transition='opacity '+VM.dur+'ms ease';requestAnimationFrame(()=>{cL.style.opacity=op1});
  await new Promise(res=>{const t0=performance.now();let gl0=0;const f=now=>{const T=VM.fixT!=null?VM.fixT:Math.min(1,(now-t0)/VM.dur);if(!gl0&&T>.05){gl0=1;try{glow=ac()}catch(_){}}draw(Lb,T,glow);draw(Ll,T,glow);if(T<1||VM.fixT!=null&&VM.fixT<1)requestAnimationFrame(f);else res()};requestAnimationFrame(f)});
  await Promise.all([bNew.decode?bNew.decode().catch(()=>{}):0,lg.el.decode?lg.el.decode().catch(()=>{}):0]);
  bNew.style.opacity='';finish()}
 catch(e){console.warn('Verwandlung:',e);finish()}};
/* WebGL vorhanden? */
try{const t=document.createElement('canvas');VM.ok=!!(t.getContext('webgl'));}catch(_){VM.ok=false}
})();

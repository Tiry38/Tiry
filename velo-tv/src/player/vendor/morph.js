/* Velo-TV: Showroom-Verwandlung der Homepage (vMorphJs, unverändert übernommen). Im Herbst-Modus zerfällt das Rad in Laub. */

/* Showroom-Verwandlung (Tiry 16.11.2026, live): WebGL-Voxel-Morph für Rad + Markenlogo; ohne WebGL bisheriger Wechsel. Quelle: entwurf-menue/morph/morph.js */
/* Vorlage „Verwandlung“ (16.11.2026, Tiry): Rad + Hersteller-Logo verwandeln sich ineinander statt raus/rein zu gleiten.
   WebGL: das alte Bild zerfällt entlang einer wandernden Front (leuchtende Kante) in Partikel, die Partikel fliegen in die Form
   des neuen Bildes und setzen es dort wieder zusammen. Gleiche Front für Rad, Spiegelung und Logo. Läuft nur während des Wechsels
   (≈1,8 s), danach ist die Zeichenfläche weg – kein Dauer-Aufwand. Ohne WebGL: alter Wechsel. */
(function(){'use strict';
const VM=window.VM={on:true,ok:false,dur:2600};
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
const VS_Q=`attribute vec2 aP;uniform vec4 uRect;uniform vec2 uRes,uO,uBox;uniform vec3 uRf;uniform float uDpr,uRefl;varying vec2 vU;varying vec2 vC;
void main(){vec2 c=uRect.xy+aP*uRect.zw;vU=aP;if(uRefl>.5){c.y=2.*(uBox.x+uBox.y)+uRf.x-(uRect.y+uRect.w)+aP.y*uRect.w;}vC=c;
vec2 d=(c+uO)*uDpr/uRes*2.-1.;gl_Position=vec4(d.x,-d.y,0.,1.);}`;
const FS_Q=`precision highp float;${GLSL_KEY}
uniform sampler2D uTex;uniform vec4 uRect;uniform vec2 uBox;uniform vec3 uRf;uniform float uT,uMode,uRefl,uGlowOn,uR0,uRW,uF,uLeaf;uniform vec3 uEdge,uHolo;varying vec2 vU;varying vec2 vC;
void main(){vec2 uv=vU;vec2 p=vC;float m=1.;
 if(uRefl>.5){float s=vU.y;uv=vec2(vU.x,1.-vU.y);float yo=uRect.y+uRect.w-s*uRect.w;p=vec2(vC.x,yo);m=uRf.z*clamp(((yo-uBox.x)/uBox.y-uRf.y)/max(1.-uRf.y,.001),0.,1.);}
 float r=uR0+kn(p)*uRW;float d=uMode<.5?r-uT:uT-(r+uF);float vis=smoothstep(0.,.006,d);
 float fade=uMode<.5?smoothstep(0.,.03,uT):1.-smoothstep(.93,1.,uT);
 float h=(1.-smoothstep(0.,uMode<.5?.035:.05,d))*uGlowOn*fade*(1.-uLeaf);
 vec2 off=vec2(.004*h,0.);vec4 c=texture2D(uTex,uv),cl=texture2D(uTex,uv-off),cr=texture2D(uTex,uv+off);
 c=mix(c,vec4(cl.r,c.g,cr.b,max(c.a,max(cl.a,cr.a))),h);
 float lum=dot(c.rgb,vec3(.3,.59,.11));float scan=.62+.38*sin(gl_FragCoord.y*1.9);
 vec3 holo=min(c.rgb*1.35+.1*c.a,vec3(c.a));vec3 rgb=mix(c.rgb,holo,h*.6);float a=c.a*mix(1.,scan,h*.9);rgb*=mix(1.,scan,h*.9);
 float e=(1.-smoothstep(0.,.007,d))*uGlowOn*fade*(1.-uLeaf);float ec=1.-smoothstep(0.,.0025,d);vec3 own=c.a>.01?c.rgb/c.a:vec3(1.);rgb=mix(rgb,mix(min(own*1.6+.18,vec3(1.)),vec3(1.),ec*.65)*a,e);
 gl_FragColor=vec4(rgb,a)*vis*m;}`;
const VS_P=`attribute vec2 aA,aB,aK;attribute vec3 aCA,aCB;attribute float aR;uniform vec2 uRes,uCA,uCB;uniform float uDpr,uT,uPs,uGlowOn,uR0,uRW,uF,uLag,uTrail,uSW;uniform vec3 uEdge,uHolo,uDA,uDB;
varying vec3 vCol;varying float vA,vHot,vSq;
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
void main(){float t0=uR0+aK.x*uRW;float t1=max(uR0+aK.y*uRW+uF,t0+.12);float p=clamp((uT-uLag-t0)/(t1-t0),0.,1.);
 float mv=smoothstep(.12,.88,p);float e=mv<.5?4.*mv*mv*mv:1.-pow(-2.*mv+2.,3.)/2.;
 /* Nano-Schwarm: Pixel lösen sich, schwirren als dichter Schwarm (viele kleine Strömungen, kein großer Wirbel) und bauen das neue Rad Stück für Stück auf */
 float w=smoothstep(.10,.42,p)*(1.-smoothstep(.58,.90,p))*uGlowOn;
 vec2 base=mix(aA,aB,e);vec2 cen=mix(uCA,uCB,e);vec2 rel=base-cen;
 rel*=1.-.16*w;
 vec2 path=vec2(0.,-.025*sin(3.1416*e))*uSW*uGlowOn;
 vec2 pos=cen+rel+path;
 vec2 q=pos/uSW*16.;float tt=uT*9.;
 pos+=(vec2(sin(q.y*1.3+tt+cos(q.x*.9-tt*.6)),cos(q.x*1.1-tt*.8+sin(q.y*.8)))*.016+vec2(sin(q.y*2.9-tt*1.7),cos(q.x*3.1+tt*1.5))*.007)*uSW*w;
 pos+=vec2(fract(aR*91.7)-.5,fract(aR*57.3)-.5)*uSW*.028*w+vec2(sin(uT*95.+aR*517.),cos(uT*88.+aR*311.))*1.3*w;
 float g=3.2;float sn=smoothstep(0.,.10,p)*(1.-smoothstep(.90,1.,p))*(1.-w)*uGlowOn;pos=mix(pos,(floor(pos/g)+.5)*g,sn);
 vec2 c=pos*uDpr/uRes*2.-1.;gl_Position=vec4(c.x,-c.y,0.,1.);
 float hot=max(exp(-p*18.),exp(-(1.-p)*18.))*uGlowOn;
 float isE=step(fract(aR*13.7),.12);
 gl_PointSize=mix(uPs*(1.+.5*hot+.6*w),g*.84,sn)*uDpr*(1.+.5*isE*w)*(1.-.2*uTrail);
 vA=smoothstep(0.,.03,p)*(1.-smoothstep(.97,1.,p))*(1.-uTrail);
 /* Farben: echte Radfarben, kräftiger; graue/schwarze Pixel nehmen im Schwarm die Hauptfarbe des Rads an */
 float cm=smoothstep(.30,.70,p);vec3 col=mix(aCA,aCB,cm);float lu=dot(col,vec3(.3,.59,.11));
 float sat=max(col.r,max(col.g,col.b))-min(col.r,min(col.g,col.b));
 col=clamp(mix(vec3(lu),col,1.9),0.,1.);
 vec3 dom=mix(uDA,uDB,cm);col=mix(col,dom*(.5+.85*lu),clamp(1.-sat*3.5,0.,1.)*w);
 col=col*(1.+.18*w);
 vCol=mix(clamp(col,0.,1.),min(col*1.5+.15,vec3(1.)),clamp(isE*w+.6*hot,0.,1.));vHot=max(hot,isE*w*.8)*uGlowOn;vSq=sn;}`;
const FS_P=`precision mediump float;varying vec3 vCol;varying float vA,vHot,vSq;
void main(){vec2 q=abs(gl_PointCoord-.5);float r=mix(length(q),max(q.x,q.y),vSq);
 float a=mix(smoothstep(.5,.1,r),1.-smoothstep(.40,.5,r),vSq)*vA;if(a<.004)discard;
 float rim=vSq*smoothstep(.30,.46,r);vec3 c=mix(vCol,vCol*.85,rim);
 c=mix(c,vec3(1.),.6*smoothstep(.24,.0,r)*vHot);gl_FragColor=vec4(c*a,a);}`;

/* Herbstallee (Tiry 22.11.2026): Laub-Zauber statt Nano-Schwarm. Abbau und Neubau gleichzeitig: Entlang der wandernden Front lösen sich Blätter vom alten Rad,
   steigen im Bogen mit dem Wind auf, flattern, kippen und trudeln – und sinken sanft gebremst genau an ihren Platz im neuen Rad. Der Showroom ist nie leer.
   Dazu weht ein Teil des alten Laubs davon (uPh 1) – wie ein Laubhaufen im Wind, ohne Wirbel. Zeichenfläche größer als der Showroom (uO), Ränder blenden weich aus. */
const VS_L=`attribute vec2 aA,aB,aK;attribute vec3 aCA,aCB;attribute float aR;
uniform vec2 uRes,uO;uniform float uDpr,uT,uPs,uR0,uRW,uF,uSW,uPh,uSh,uDs;
varying vec3 vC1,vC2;varying float vA,vAng,vFlip,vTy,vGl,vPx;
float hs(float n){return fract(sin(n)*43758.5453);}
vec3 pal(float h){return h<.17?vec3(.98,.80,.20):h<.33?vec3(.97,.58,.10):h<.49?vec3(.92,.38,.07):h<.64?vec3(.80,.13,.05):h<.76?vec3(.58,.15,.06):h<.88?vec3(.56,.60,.17):vec3(.54,.32,.12);}
void main(){float r1=hs(aR*91.7),r2=hs(aR*57.3+1.),r3=hs(aR*13.1+2.),r4=hs(aR*71.9+3.),r5=hs(aR*33.3+4.),r6=hs(aR*7.7+5.);
 float t0=uR0+aK.x*uRW;float t1=max(uR0+aK.y*uRW+uF,t0+.10);
 bool fly=uPh>.5;float p,dur;
 if(fly){if(r6>.20){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;vA=0.;return;}dur=.40;p=(uT-t0)/dur;}else{dur=t1-t0;p=(uT-t0)/dur;}
 if(p<=0.||p>=1.){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;vA=0.;return;}
 float z=r3*2.-1.;float bump=sin(3.1416*p);float tau=p*dur*uDs;
 float ph=(1.4+1.4*r2)*6.2832*tau+aR*40.;
 vec2 pos;float sc;
 if(fly){float g=p*p*(1.5-.5*p);float gu=.85+.3*sin(aA.y/uSW*4.+aA.x/uSW*1.5+r4*2.);
  pos=aA+vec2((.12+.30*r1)*gu*(1.+.45*z),-(.18+.30*r2))*g*uSW+vec2(0.,.10*r5*p*p*p)*uSW;
  float fa=uSW*(.016+.022*r4)*sin(3.1416*min(p*1.7,1.));pos+=normalize(vec2(.3,1.))*sin(ph)*fa;pos.y-=abs(cos(ph))*fa*.45;
  sc=1.+(z>0.?z*1.1:z*.45)*smoothstep(0.,.8,p);}
 else{float e=p*p*p*(p*(p*6.-15.)+10.);
  vec2 lift=vec2((.02+.08*r1)*(r4<.5?1.:-.6),-(.05+.11*r2))*uSW;
  vec2 m=mix(aA,aB,.5)+lift;pos=mix(mix(aA,m,e),mix(m,aB,e),e);
  float fa=uSW*(.010+.016*r4)*bump;pos+=normalize(vec2(.3,1.))*sin(ph)*fa;pos.y-=abs(cos(ph))*fa*.40;
  sc=1.+(z>0.?z*.9:z*.35)*bump;}
 if(uSh>.5)pos+=vec2(.028,.050)*uSW*(fly?smoothstep(0.,.45,p):bump)*(1.+.6*max(z,0.));
 vec2 c=(pos+uO)*uDpr/uRes*2.-1.;gl_Position=vec4(c.x,-c.y,0.,1.);
 gl_PointSize=uPs*(.72+.62*r5)*sc*uDpr*(uSh>.5?1.15:1.);vPx=1./max(gl_PointSize,1.);
 bool tb=r4<.32;float env=fly?smoothstep(0.,.15,p):pow(bump,.6);
 vAng=r1*6.2832+.75*cos(ph)*env+(tb?(r2-.5)*7.*tau:(r2-.5)*1.4*tau);
 float fl=tb?cos((2.2+3.*r5)*3.1416*tau+aR*9.):mix(.85,cos(ph*.5+aR*7.),.45+.35*r1);
 vFlip=mix(1.,fl,env);
 float am=fly?smoothstep(0.,.20,p):smoothstep(0.,.20,p)*(1.-smoothstep(.80,1.,p));
 vec3 pc=fly?aCA:mix(aCA,aCB,smoothstep(.45,.75,p));vec3 a1=pal(r2),a2=pal(fract(r2+.17+.33*r5));
 vC1=mix(pc,a1,am);vC2=mix(pc,a2,am);
 vec2 cssR=uRes/uDpr;vec2 q=pos+uO;vec2 ed=min(q,cssR-q)/(uSW*.12);
 vA=smoothstep(0.,.02,p)*(fly?1.-smoothstep(.62,1.,p):1.-smoothstep(.97,1.,p))*(uSh>.5?.11:1.)*clamp(min(ed.x,ed.y),0.,1.);
 vGl=(fly?exp(-p*13.):exp(-p*14.)+exp(-(1.-p)*14.))*(1.-uSh);vTy=uSh>.5?-1.:hs(aR*5.7+9.);}`;
const FS_L=`precision mediump float;varying vec3 vC1,vC2;varying float vA,vAng,vFlip,vTy,vGl,vPx;
void main(){vec2 q0=gl_PointCoord-.5;q0.y=-q0.y;float cs=cos(vAng),sn=sin(vAng);vec2 q=vec2(cs*q0.x-sn*q0.y,sn*q0.x+cs*q0.y);
 float af=max(abs(vFlip),.10);q.x/=af;float r=length(q);float th=atan(q.x,q.y);float ty=vTy<0.?.5:vTy;float aa=1.8*vPx/af;
 float sd;bool mp=ty<.40;
 if(mp){float lob=pow(abs(cos(2.5*th)),.55);float R=.19+.26*lob;R*=1.+.06*cos(th*15.)*lob;sd=r-R;}
 else if(ty<.75){float y=q.y;float w=.215*sqrt(max(0.,1.-pow(y/.44,2.)))*(1.-.30*max(y,0.)/.44);w*=1.+.08*sin(y*42.+ty*20.)*step(.5,fract(ty*7.));sd=(abs(q.x)-w)*.9;}
 else{float y=q.y+.03;float w=.27*sqrt(max(0.,1.-pow(y/.42,2.)))*(1.-.42*(y+.42)/.84);w*=1.+.05*sin(y*60.);sd=(abs(q.x)-w)*.9;}
 float body=1.-smoothstep(-aa,aa,sd);
 float st=(1.-smoothstep(.010,.010+aa,abs(q.x)))*step(-.49,q.y)*step(q.y,mp?-.05:-.36);
 float a=max(body,st*.95);
 if(vTy<0.){float bl=1.-smoothstep(-.08,.08,sd);a=max(bl,st*.6)*vA;if(a<.003)discard;gl_FragColor=vec4(0.,0.,0.,a);return;}
 vec3 c=mix(vC1,vC2,smoothstep(-.35,.40,q.y+.15*sin(ty*30.)));
 float sp=smoothstep(.75,.97,sin(q.x*23.+ty*50.)*sin(q.y*19.-ty*31.));c*=1.-.28*sp;
 float mid=(1.-smoothstep(0.,.012+aa,abs(q.x)))*step(q.y,.40);
 float side=mp?(1.-smoothstep(0.,.016+aa,abs(sin(2.5*th))*r))*step(.05,r):(1.-smoothstep(0.,.010+aa,abs(fract((q.y-abs(q.x)*1.1)*8.)-.5)/8.))*step(abs(q.x),.17);
 float vein=max(mid,side*.65)*body;c=mix(c,min(c*1.28+vec3(.10,.08,0.),vec3(1.)),vein*.55);
 float rim=smoothstep(-.07,0.,sd)*body;c*=1.-.32*rim;
 if(vFlip<0.)c=mix(c,vec3(dot(c,vec3(.3,.59,.11))),.22)*1.04+.03;
 c*=.80+.30*clamp(vFlip*cos(vAng-.6),-1.,1.);
 float shn=pow(max(0.,1.-abs(q.x*.8+q.y*.6-.08*sin(vAng*2.))*5.),3.)*max(vFlip,0.)*.24;c+=c*shn+vec3(.10,.07,.02)*shn;
 float gl=vGl*exp(-length(q0)*6.)*(1.-smoothstep(.32,.5,length(q0)));
 float al=a*vA;vec3 col=c*al+vec3(1.,.80,.38)*gl*vA*.9;al=max(al,gl*.55*vA);if(al<.003)discard;gl_FragColor=vec4(col,al);}`;
/* ---- GL je Zeichenfläche ---- */
/* Aufbau asynchron (Tiry 17.11.2026: Seite hing kurz beim ersten Wechsel): Shader werden – wo der Browser es kann – im Hintergrund
   übersetzt (KHR_parallel_shader_compile), erst danach wird der Status abgefragt; sonst blockiert die Abfrage den Hauptfaden */
async function mk(cv){const gl=cv.getContext('webgl',{premultipliedAlpha:true,alpha:true,antialias:true,preserveDrawingBuffer:false});if(!gl)return null;
 const pc=gl.getExtension('KHR_parallel_shader_compile');
 const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o};
 const P0=[[VS_Q,FS_Q],[VS_P,FS_P],[VS_L,FS_L]].map(([v,f])=>{const p=gl.createProgram(),a=sh(gl.VERTEX_SHADER,v),b=sh(gl.FRAGMENT_SHADER,f);gl.attachShader(p,a);gl.attachShader(p,b);gl.linkProgram(p);return{p,a,b}});
 if(pc){const t0=performance.now();while(!P0.every(x=>gl.getProgramParameter(x.p,pc.COMPLETION_STATUS_KHR))&&performance.now()-t0<8000)await new Promise(r=>setTimeout(r,30))}
 const pr=({p,a:sv,b:sf})=>{if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error((gl.getShaderInfoLog(sv)||'')+(gl.getShaderInfoLog(sf)||'')+gl.getProgramInfoLog(p));
  const u={},a={};const nu=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<nu;i++){const n=gl.getActiveUniform(p,i).name;u[n]=gl.getUniformLocation(p,n)}
  const na=gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);for(let i=0;i<na;i++){const n=gl.getActiveAttrib(p,i).name;a[n]=gl.getAttribLocation(p,n)}return{p,u,a}};
 const G={gl,q:pr(P0[0]),pt:pr(P0[1])};try{G.lf=pr(P0[2])}catch(e){G.lf=null;console.warn('Laub',e.message)}
 G.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,G.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
 G.nt=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,G.nt);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,NS,NS,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,NZ);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
 G.pb=gl.createBuffer();G.tex=[gl.createTexture(),gl.createTexture()];return G}
function texUp(G,t,cv){const gl=G.gl;gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,cv);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)}
/* ---- Hilfen ---- */
const load=src=>new Promise(res=>{const im=new Image();im.decoding='async';im.onload=()=>res(im);im.onerror=()=>res(null);im.src=src});
/* Box eines Bildes so messen, wie die Seite es zeigen würde (gleiche Klassen, keine Übergänge) */
function measure(tpl,src,root){return new Promise(res=>{const m=tpl.cloneNode(false);m.removeAttribute('id');m.removeAttribute('loading');m.removeAttribute('data-src');m.removeAttribute('hidden');
 m.className=tpl.className.replace(/\b(off|out-l|in-r|swap)\b/g,' ');m.style.cssText='visibility:hidden;transition:none;animation:none;opacity:0';m.alt='';m.setAttribute('aria-hidden','true');
 const done=()=>{/* exakt wie gezeichnet: Bruchteil-Pixel, inkl. transform (Tiry 24.11.2026: Rad sprang nach der Verwandlung) */
  const pe=root||tpl.parentNode,R=m.getBoundingClientRect(),P=pe.getBoundingClientRect(),w=R.width,h=R.height,nw=m.naturalWidth||w,nh=m.naturalHeight||h,fill=getComputedStyle(m).objectFit==='fill';m.remove();
  const s=Math.min(w/nw,h/nh),cw=fill?w:nw*s,ch=fill?h:nh*s,bx=R.left-P.left-pe.clientLeft,by=R.top-P.top-pe.clientTop;res({x:bx+(w-cw)/2,y:by+(h-ch)/2,w:cw,h:ch,by,bh:h})};
 tpl.parentNode.insertBefore(m,tpl);m.onload=()=>(m.decode?m.decode().catch(()=>{}):Promise.resolve()).then(done);m.onerror=done;m.src=src;if(m.complete&&m.naturalWidth)m.onload()})}
function raster(im,r,dpr){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(r.w*dpr));c.height=Math.max(1,Math.round(r.h*dpr));const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(im,0,0,c.width,c.height);return c}
/* Punkte aus den deckenden Pixeln eines Bildes */
function points(im,r,step,N,W,H){const cw=Math.max(2,Math.round(r.w/step)),ch=Math.max(2,Math.round(r.h/step));const c=document.createElement('canvas');c.width=cw;c.height=ch;
 const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,cw,ch);const d=x.getImageData(0,0,cw,ch).data,P=[];const sx=r.w/cw,sy=r.h/ch;
 for(let j=0;j<ch;j++)for(let i=0;i<cw;i++){const o=(j*cw+i)*4;if(d[o+3]>140){const px=r.x+(i+.2+Math.random()*.6)*sx,py=r.y+(j+.2+Math.random()*.6)*sy;P.push([px,py,d[o]/255,d[o+1]/255,d[o+2]/255,keyRaw(px,py,W,H)])}}
 if(!P.length)P.push([r.x+r.w/2,r.y+r.h/2,.5,.5,.5,keyRaw(r.x+r.w/2,r.y+r.h/2,W,H)]);
 const out=new Array(N);if(P.length>=N){for(let i=0;i<N;i++){const j=i+Math.floor(Math.random()*(P.length-i));const t=P[i];P[i]=P[j];P[j]=t;out[i]=P[i]}}else for(let i=0;i<N;i++)out[i]=P[Math.floor(Math.random()*P.length)];
 return out.sort((a,b)=>a[5]-b[5])}
const rfP=s=>{s=String(s||'');const m=s.match(/below\s+(-?[\d.]+)px/);if(!m)return[2,.68,.17];const g=s.match(/([\d.]+)%\s*,\s*rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)\s*\)\s*$/);return[+m[1],g?g[1]/100:.68,g?+g[2]:.17]};
const hex=s=>{s=String(s||'').trim();const m=s.match(/^#?([0-9a-f]{6})$/i);if(m){const n=parseInt(m[1],16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}
 const r=s.match(/rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);return r?[r[1]/255,r[2]/255,r[3]/255]:[.886,.137,.176]};
/* ---- eine Ebene (Rad oder Logo) vorbereiten ---- */
async function layer(root,cv,o,kind){const dpr=Math.min(2,devicePixelRatio||1),RB=root.getBoundingClientRect(),W=RB.width-(root.offsetWidth-root.clientWidth),H=RB.height-(root.offsetHeight-root.clientHeight);
 const [ia,ib,ra,rb]=await Promise.all([load(o.from),load(o.to),measure(o.tplA,o.from,root),measure(o.tplB,o.to,root)]);if(!ia||!ib)throw new Error('Bild');
 if(!cv._G)cv._G=mk(cv);const G=await cv._G;if(!G)throw new Error('WebGL');const lf0=window.HG12_MODE==='herbst'&&G.lf;let ox=0,oy=0,ox2=0,oy2=0;
 if(lf0){const rr=root.getBoundingClientRect(),vw=document.documentElement.clientWidth;ox=Math.max(0,Math.min(W*.6,rr.left-4));ox2=Math.max(0,Math.min(W*.45,vw-rr.right-4));oy=H*.45;oy2=H*.30}
 cv.width=Math.round((W+ox+ox2)*dpr);cv.height=Math.round((H+oy+oy2)*dpr);const chk=()=>{if(o.dead&&o.dead())throw new Error('abgelöst')};chk();
 const yl=()=>new Promise(r=>setTimeout(r,0)).then(chk);texUp(G,G.tex[0],raster(ia,ra,dpr));await yl();texUp(G,G.tex[1],raster(ib,rb,dpr));await yl();
 const lf=lf0?1:0;const area=Math.max(ra.w*ra.h,rb.w*rb.h);const N=lf?Math.round(Math.min(kind==='bike'?1800:650,Math.max(450,area/(kind==='bike'?115:160)))):Math.round(Math.min(kind==='bike'?28000:11000,Math.max(3000,area/(kind==='bike'?6:10))));
 const step=kind==='bike'?1.1:1.4;const A=points(ia,ra,step,N,W,H);await yl();const B=points(ib,rb,step,N,W,H);await yl();
 const dom=P=>{let r=0,g=0,b=0,t=0;for(const q of P){const mx=Math.max(q[2],q[3],q[4]),mn=Math.min(q[2],q[3],q[4]),w=(mx-mn)*(mx-mn)*mx;r+=q[2]*w;g+=q[3]*w;b+=q[4]*w;t+=w}if(t<.5)return[.62,.66,.72];const m=Math.max(r,g,b)/t;const k=Math.min(1.6,.85/Math.max(m,.05));return[r/t*k,g/t*k,b/t*k].map(v=>Math.min(1,v))};const dA=dom(A),dB=dom(B);
 let k0=Infinity,k1=-Infinity;for(const p of A){k0=Math.min(k0,p[5]);k1=Math.max(k1,p[5])}for(const p of B){k0=Math.min(k0,p[5]);k1=Math.max(k1,p[5])}if(k1-k0<.01)k1=k0+.01;
 const f=new Float32Array(N*13);for(let i=0;i<N;i++){const a=A[i],b=B[i],q=i*13;f[q]=a[0];f[q+1]=a[1];f[q+2]=b[0];f[q+3]=b[1];f[q+4]=(a[5]-k0)/(k1-k0);f[q+5]=(b[5]-k0)/(k1-k0);f[q+6]=a[2];f[q+7]=a[3];f[q+8]=a[4];f[q+9]=b[2];f[q+10]=b[3];f[q+11]=b[4];f[q+12]=Math.random()}
 const gl=G.gl;gl.bindBuffer(gl.ARRAY_BUFFER,G.pb);gl.bufferData(gl.ARRAY_BUFFER,f,gl.STATIC_DRAW);
 return{G,N,ra,rb,k0,k1,W,H,dpr,dA,dB,lf,ox,oy,cw:cv.width/dpr,ch:cv.height/dpr,rf:rfP(o.refl),sh:kind==='bike',ps:lf?Math.min(24,Math.max(12,Math.sqrt(area/N)*1.75)):kind==='bike'?1.3:1.6,glow:kind==='bike'?1:.7,refl:!!o.refl&&o.refl!=='none'}}
function draw(L,T,glow){const{G,N,ra,rb,k0,k1,W,H,dpr}=L,gl=G.gl;gl.viewport(0,0,gl.canvas.width,gl.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
 gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
 const Q=G.q;gl.useProgram(Q.p);gl.bindBuffer(gl.ARRAY_BUFFER,G.quad);gl.enableVertexAttribArray(Q.a.aP);gl.vertexAttribPointer(Q.a.aP,2,gl.FLOAT,false,0,0);
 gl.uniform2f(Q.u.uRes,gl.canvas.width,gl.canvas.height);gl.uniform2f(Q.u.uO,L.ox,L.oy);gl.uniform1f(Q.u.uDpr,dpr);gl.uniform2f(Q.u.uCss,W,H);gl.uniform1f(Q.u.uK0,k0);gl.uniform1f(Q.u.uK1,k1);gl.uniform1f(Q.u.uT,T);
 gl.uniform1f(Q.u.uR0,R0);gl.uniform1f(Q.u.uRW,L.lf?.62:RW);gl.uniform1f(Q.u.uF,L.lf?.24:FL);gl.uniform1f(Q.u.uLeaf,L.lf);gl.uniform3fv(Q.u.uEdge,glow);gl.uniform3fv(Q.u.uHolo,HOLO);gl.uniform1f(Q.u.uGlowOn,L.glow);
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,G.nt);gl.uniform1i(Q.u.uN,1);gl.activeTexture(gl.TEXTURE0);gl.uniform1i(Q.u.uTex,0);
 [[0,ra],[1,rb]].forEach(([m,r])=>{gl.bindTexture(gl.TEXTURE_2D,G.tex[m]);gl.uniform1f(Q.u.uMode,m);gl.uniform4f(Q.u.uRect,r.x,r.y,r.w,r.h);gl.uniform2f(Q.u.uBox,r.by,r.bh);gl.uniform3fv(Q.u.uRf,L.rf);
  for(const rf of L.refl?[1,0]:[0]){gl.uniform1f(Q.u.uRefl,rf);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}});
 gl.disableVertexAttribArray(Q.a.aP);
 if(L.lf){const P=G.lf;gl.useProgram(P.p);gl.bindBuffer(gl.ARRAY_BUFFER,G.pb);const S=13*4,at=(n,sz,off)=>{if(P.a[n]==null||P.a[n]<0)return;gl.enableVertexAttribArray(P.a[n]);gl.vertexAttribPointer(P.a[n],sz,gl.FLOAT,false,S,off*4)};
  at('aA',2,0);at('aB',2,2);at('aK',2,4);at('aCA',3,6);at('aCB',3,9);at('aR',1,12);
  gl.uniform2f(P.u.uRes,gl.canvas.width,gl.canvas.height);gl.uniform1f(P.u.uDpr,dpr);gl.uniform1f(P.u.uT,T);gl.uniform1f(P.u.uPs,L.ps);gl.uniform1f(P.u.uR0,R0);gl.uniform1f(P.u.uRW,.62);gl.uniform1f(P.u.uF,.24);
  gl.uniform1f(P.u.uSW,Math.max(ra.w,rb.w));gl.uniform1f(P.u.uDs,VM.dur/1000);gl.uniform2f(P.u.uO,L.ox,L.oy);
  for(const [ph,sh] of L.sh?[[0,1],[1,1],[1,0],[0,0]]:[[1,0],[0,0]]){gl.uniform1f(P.u.uPh,ph);gl.uniform1f(P.u.uSh,sh);gl.drawArrays(gl.POINTS,0,N)}
  ['aA','aB','aK','aCA','aCB','aR'].forEach(n=>{if(P.a[n]!=null&&P.a[n]>=0)gl.disableVertexAttribArray(P.a[n])});return}
 const P=G.pt;gl.useProgram(P.p);gl.bindBuffer(gl.ARRAY_BUFFER,G.pb);const S=13*4,at=(n,sz,off)=>{gl.enableVertexAttribArray(P.a[n]);gl.vertexAttribPointer(P.a[n],sz,gl.FLOAT,false,S,off*4)};
 at('aA',2,0);at('aB',2,2);at('aK',2,4);at('aCA',3,6);at('aCB',3,9);at('aR',1,12);
 gl.uniform2f(P.u.uRes,gl.canvas.width,gl.canvas.height);gl.uniform1f(P.u.uDpr,dpr);gl.uniform1f(P.u.uT,T);gl.uniform1f(P.u.uPs,L.ps);gl.uniform1f(P.u.uGlowOn,L.glow);gl.uniform3fv(P.u.uEdge,glow);gl.uniform3fv(P.u.uHolo,HOLO);
 gl.uniform1f(P.u.uR0,R0);gl.uniform1f(P.u.uRW,RW);gl.uniform1f(P.u.uF,FL);
 gl.uniform2f(P.u.uCA,ra.x+ra.w/2,ra.y+ra.h/2);gl.uniform2f(P.u.uCB,rb.x+rb.w/2,rb.y+rb.h/2);gl.uniform1f(P.u.uSW,Math.max(ra.w,rb.w));gl.uniform3fv(P.u.uDA,L.dA);gl.uniform3fv(P.u.uDB,L.dB);
 /* Schweif: zwei verzögerte, blassere Durchgänge, dann die Partikel selbst */
 for(const [lag,tr] of L.glow?[[.045,.8],[.022,.55],[0,0]]:[[0,0]]){gl.uniform1f(P.u.uLag,lag);gl.uniform1f(P.u.uTrail,tr);gl.drawArrays(gl.POINTS,0,N)}
 ['aA','aB','aK','aCA','aCB','aR'].forEach(n=>gl.disableVertexAttribArray(P.a[n]))}
/* Zeichenflächen je Showroom (bleiben bestehen, im Ruhezustand ausgeblendet) */
function cvFor(root,key,place){root._vm=root._vm||{};let c=root._vm[key];if(!c){c=document.createElement('canvas');c.className='vmcv';c.style.display='none';c.setAttribute('aria-hidden','true');root._vm[key]=c;place(c)}return c}
const cvs=(root,bNew,lgEl)=>{const fl=root.querySelector(':scope>.hfloor');return[cvFor(root,'b',c=>fl?fl.before(c):bNew.after(c)),cvFor(root,'l',c=>lgEl.after(c))]};
/* Vorwärmen im Leerlauf: Grafik-Programme schon fertig, bevor der erste Wechsel kommt */
VM.warm=(root,bikeEl,logoEl)=>{if(!VM.ok||!root||root._vmW)return;root._vmW=1;const go=()=>{try{cvs(root,bikeEl,logoEl).forEach(c=>{if(!c._G)c._G=mk(c).catch(()=>null)})}catch(_){}};window.requestIdleCallback?requestIdleCallback(go,{timeout:2500}):setTimeout(go,600)};
const quiet=(el,fn)=>{el.style.transition='none';fn();requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.transition=''}))};
/* o = {root, bike:{oldEl,newEl,to,from?,alt?}, logo:{el,to,from?,op0?}} – erledigt den kompletten Wechsel */
VM.run=async function(o){const root=o.root,bk=o.bike,lg=o.logo;const bOld=bk.oldEl,bNew=bk.newEl,from=bk.from||bOld.currentSrc||bOld.src,lFrom=lg.from||lg.el.currentSrc||lg.el.src;
 const [cB,cL]=cvs(root,bNew,lg.el);
 const csB=getComputedStyle(bOld),csL=getComputedStyle(lg.el);const op0=lg.op0!=null?lg.op0:csL.opacity;
 const finish=()=>{if(bNew===bOld){if(bNew.getAttribute('src')!==bk.to)bNew.src=bk.to}quiet(bNew,()=>{bNew.classList.remove('off','out-l','in-r');bNew.style.opacity=''});
  if(bOld!==bNew)quiet(bOld,()=>{bOld.classList.add('off');bOld.style.opacity=''});if(bk.alt)bNew.alt=bk.alt;
  quiet(lg.el,()=>{lg.el.style.opacity=''});/* Velo-TV: Zeichenfläche weich ausblenden statt hart tauschen (sonst Ruck: weiches Raster -> scharfes Foto) */cL.style.display='none';cB.style.transition='opacity .4s ease';cB.style.opacity='0';setTimeout(()=>{cB.style.display='none';cB.style.opacity=''},450);root.classList.remove('vmrun');root._vmH=0};
 const tok=root._vmTok=(root._vmTok||0)+1,dead=()=>root._vmTok!==tok;
 try{let Lb,Ll;const prep=Promise.all([layer(root,cB,{from,to:bk.to,tplA:bOld,tplB:bNew,refl:csB.webkitBoxReflect||'none',dead},'bike'),
   layer(root,cL,{from:lFrom,to:lg.to,tplA:lg.el,tplB:lg.el,dead},'logo')]);prep.catch(()=>{});
  let tm;[Lb,Ll]=await Promise.race([prep,new Promise((_,rj)=>{tm=setTimeout(()=>{if(!dead())root._vmTok++;rj(new Error('Zeit'))},window.__vmSW?60000:5000)})]);clearTimeout(tm);
  const pos=L=>'left:'+(-L.ox)+'px;top:'+(-L.oy)+'px;width:'+L.cw+'px;height:'+L.ch+'px';
  cB.style.cssText='position:absolute;'+pos(Lb)+';pointer-events:none;filter:'+csB.filter;
  cL.style.cssText='position:absolute;'+pos(Ll)+';pointer-events:none;mix-blend-mode:'+csL.mixBlendMode+';filter:'+csL.filter+';opacity:'+op0;
  const ac=()=>hex(getComputedStyle(root.closest('.show')||root).getPropertyValue('--ac')||'#E2232D');let glow=[.886,.137,.176];try{glow=ac()}catch(_){}
  draw(Lb,0,glow);draw(Ll,0,glow);root.classList.add('vmrun');
  /* gleicher Takt: Zeichenfläche zeigt exakt das alte Bild, dann echte Bilder still ausblenden */
  quiet(bOld,()=>{bOld.style.opacity='0'});if(bNew!==bOld)bNew.style.opacity='0';quiet(lg.el,()=>{lg.el.style.opacity='0'});
  lg.el.src=lg.to;if(bNew===bOld)bNew.src=bk.to;
  const op1=lg.op1!=null?lg.op1:(()=>{const v=lg.el.style.opacity;lg.el.style.opacity='';const r=getComputedStyle(lg.el).opacity;lg.el.style.opacity=v;return r})();
  cL.style.transition='opacity '+VM.dur+'ms ease';requestAnimationFrame(()=>{cL.style.opacity=op1});
  let fr=0,sd=0;await new Promise(res=>{let tp=performance.now(),Tc=0,gl0=0,hz=0;const f=now=>{fr++;const dt=Math.min(100,Math.max(0,now-tp));tp=now;sd+=dt;if(root._vmH&&!hz){hz=1;cL.style.transition='opacity 350ms ease'}Tc=Math.min(1,Tc+dt/(root._vmH?VM.dur/6:VM.dur));const T=VM.fixT!=null?VM.fixT:Tc;if(!gl0&&T>.05){gl0=1;try{glow=ac()}catch(_){}}draw(Lb,T,glow);draw(Ll,T,glow);if(T<1||VM.fixT!=null&&VM.fixT<1)requestAnimationFrame(f);else res()};requestAnimationFrame(f)});
  if(VM.fixT==null&&!root._vmH&&sd>600&&fr<sd/1000*12){VM.on=false;console.info('Verwandlung: zu langsam auf diesem Gerät, ab jetzt einfacher Wechsel')}
  await Promise.all([bNew.decode?bNew.decode().catch(()=>{}):0,lg.el.decode?lg.el.decode().catch(()=>{}):0]);
  bNew.style.opacity='';finish()}
 catch(e){console.warn('Verwandlung:',e);finish()}};
/* Klick während einer Verwandlung: Rest in ~0,4 s fertig spielen (Tiry 17.11.2026: Klicks gingen verloren) */
VM.hurry=root=>{if(root)root._vmH=1};
/* WebGL vorhanden? */
/* Nur mit echter Grafik-Beschleunigung: Software-Grafik (SwiftShader/llvmpipe, z. B. gesperrter Treiber) friert die Seite
   beim Shader-Bau sekundenlang ein -> dort bleibt der einfache Wechsel (Tiry 17.11.2026: „Seite hängt sich ab und zu auf“) */
try{const t=document.createElement('canvas'),sw=!!window.__vmSW,g=t.getContext('webgl',sw?{}:{failIfMajorPerformanceCaveat:true});VM.ok=!!g;
 if(g&&!sw){const d=g.getExtension('WEBGL_debug_renderer_info'),r=d?String(g.getParameter(d.UNMASKED_RENDERER_WEBGL)):'';if(/swiftshader|llvmpipe|software|basic render/i.test(r))VM.ok=false}
 const lx=g&&g.getExtension('WEBGL_lose_context');if(lx)lx.loseContext()}catch(_){VM.ok=false}
})();

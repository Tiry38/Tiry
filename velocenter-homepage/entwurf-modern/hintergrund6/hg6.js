/* Vorlage „Landschafts-Hintergründe“ (Tiry 21.11.2026) – die ganze Seite ist eine Trekking-Landschaft, live in WebGL gerechnet
   (rein analytisch pro Pixel, keine Bilder, kein Video – läuft auch auf schwachen Grafikchips).
   1 Pfalz-Panorama – Bergketten in 6 Ebenen mit Dunst, Wolken ziehen, vorn Weinberge + Schotterweg, rote Rücklichter fahren den Weg hinauf
   2 Holo-Tal       – dieselbe Landschaft im 2045-Look: Scanner fährt über die Berge, Gipfel-Markierungen, Boden als Höhenlinien-Gitter, roter Track
   3 Wolkenmeer     – Morgen über dem Nebelmeer: Gipfel ragen aus ziehenden Nebelbänken, rote Sonne, vorn Kiefern-Silhouetten
   Maus = Blickwinkel (Parallaxe), Scrollen = Kamera steigt, Klick = rote Welle. */
(function(){
var MODES=[['pfalz','Trekking-Panorama','Berge, Wald, Weinberge, Schotterweg'],['holo','Holo-Tal','Landschaft im 2045-Look'],['nebel','Wolkenmeer','Gipfel über dem Nebel']];
var mode=window.HG6_DEFAULT||'pfalz';
try{var q=new URLSearchParams(location.search).get('hg');if(q)mode=q;else{var s0=localStorage.getItem('vc_hg6');if(s0)mode=s0}}catch(e){}
if(!MODES.some(function(m){return m[0]===mode}))mode='pfalz';
var de=document.documentElement;

function FS(V){return `#extension GL_OES_standard_derivatives : enable
precision highp float;
#define V ${V}
uniform vec2 uR,uM;uniform float uT,uS;uniform vec3 uK;
const vec3 RED=vec3(.886,.137,.176),RDK=vec3(.42,.035,.075);
float h21(vec2 p){p=fract(p*vec2(233.34,851.73));p+=dot(p,p+23.45);return fract(p.x*p.y);}
vec2 g2(vec2 p){float a=h21(p)*6.2831853;return vec2(cos(a),sin(a));}
float nz(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);
 return mix(mix(dot(g2(i),f),dot(g2(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(g2(i+vec2(0,1)),f-vec2(0,1)),dot(g2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float s=0.,a=.5;mat2 r=mat2(.8,.6,-.6,.8);for(int i=0;i<4;i++){s+=a*nz(p);p=r*p*2.03+3.1;a*=.5;}return s;}

/* Kamm-Höhe der Ebene f (0 hinten … 5 vorn), x in Seitenbreiten */
float ridgeN(float f,float x){float s=f*7.31,v=0.,a=.5,xx=x*(1.0+f*.55);
 if(f<2.5){for(int i=0;i<4;i++){float n=1.-abs(nz(vec2(xx,s))*1.55);v+=a*n*n;xx*=2.07;s+=3.1;a*=.47;}return v*1.4-.40;}
 for(int i=0;i<4;i++){v+=a*nz(vec2(xx,s));xx*=2.03;s+=1.7;a*=.5;}return v*1.3;}
vec2 LB(float f){
#if V==2
 return vec2(.50-f*.050,.24-f*.030);
#else
 return vec2(.585-f*.064,.17-f*.018);
#endif
}
float LH(float f,float x){vec2 b=LB(f);
 float h=b.x+b.y*ridgeN(f,x);
 if(f>1.5){float k=60.+f*28.;h+=(.0016+.0011*f)*(nz(vec2(x*k,f*3.))+.55*nz(vec2(x*k*2.3,f*5.))+.6);}
 return h;}

vec3 sky(vec2 q,float A,vec2 sun){float y=q.y;
 vec3 c=mix(vec3(.975,.972,.965),vec3(.80,.835,.875),smoothstep(.40,1.05,y));
#if V==2
 c=mix(vec3(.985,.975,.965),vec3(.78,.81,.86),smoothstep(.38,1.1,y));
#endif
 float d=length((q-sun)*vec2(1.,1.15));c=mix(c,vec3(1.,.995,.985),exp(-d*5.)*.85);
 vec2 cp=vec2(q.x*1.1+uT*.006,y*3.2);float cl=fbm(cp)+.5*fbm(cp*2.3+7.);
 float cm=smoothstep(.12,.58,cl)*smoothstep(.40,.72,y);
 vec3 cc=mix(vec3(.90,.91,.93),vec3(1.),smoothstep(.2,.8,fbm(cp*1.7+vec2(0.,-.4))+.3));
 c=mix(c,cc,cm*.85);c=mix(c,c*vec3(.93,.94,.95),smoothstep(.3,.7,cl)*smoothstep(.40,.72,y)*(1.-smoothstep(.2,.8,fbm(cp*1.7+vec2(0.,-.4))+.3))*.6);
 return c;}

void main(){vec2 uv=gl_FragCoord.xy/uR;float A=uR.x/uR.y;bool mob=A<1.;vec2 q=vec2(uv.x*A,uv.y);
 float x=q.x,y=q.y;float scr=min(uS,4.);float px=1./uR.y;
 float lift=scr*.05;
 if(mob){y=(y-.10)*.85+.10;}
 vec2 sun=vec2(A*.74,.70-scr*.02);
#if V==2
 sun=vec2(A*.80,.53-scr*.03);
#endif
 vec3 hz=vec3(.90,.915,.935);
 vec3 col=sky(vec2(x,y),A,sun);
 float depth=-1.;

#if V==2
 /* Rote Sonne am Horizont */
 float sd=length(vec2(x,y)-sun)-.075;float sunM=smoothstep(px*1.5,-px*1.5,sd);col=mix(col,RED,sunM);
 col=mix(col,col*vec3(.985,.97,.97),exp(-max(sd,0.)*14.)*.0);
#endif

 /* ---------- Vordergrund ---------- */
 bool fg=false;
#if V!=2
 float yT=.205+.030*sin(x*1.6+.6)+.012*nz(vec2(x*3.,1.))-scr*.10;
 if(mob)yT+=.02;
 if(y<yT){fg=true;
  float dy=max(yT-y,.0004);float z=.085/dy;float trav=uT*.30+uS*1.2;float zw=z+trav;
  float cx=mob?A*.58:A*.64;float X=(x-cx)*z;
  float Xp=.11*sin(zw*.42)+.05*sin(zw*1.1+2.)+(mob?0.:.0);
  float dX=X-Xp;float pw=fwidth(X)*.8+.0005;
  float hazeG=smoothstep(.6,9.,z);
#if V==0
  /* Weinberg: Rebzeilen entlang des Weges */
  float rc=dX*48.;float rw=fwidth(rc);float rr=abs(fract(rc)-.5);
  float lf=fbm(vec2(X*90.,zw*40.));float vine=smoothstep(.17+rw+lf*.08,.17-rw+lf*.08,.5-rr);vine=mix(vine,.40,smoothstep(.25,.6,rw));
  float gr=.5+.5*fbm(vec2(X*6.,zw*3.));
  vec3 grass=mix(vec3(.55,.62,.44),vec3(.66,.70,.54),gr);vec3 vineC=mix(vec3(.18,.27,.15),vec3(.33,.42,.24),lf+.45);
  vec3 g=mix(grass,vineC,vine);
  /* Pfosten */
  float post=smoothstep(.02,.0,abs(fract(zw*2.2)-.5)-.47)*smoothstep(.06+rw,.06-rw,.5-rr)*smoothstep(4.,.8,z);g=mix(g,vec3(.30,.29,.27),post*.7);
  /* Schotterweg */
  float pth=smoothstep(.034+pw,.034-pw,abs(dX));
  float tr=smoothstep(.006+pw,.0,abs(abs(dX)-.013))*.35;float grav=.04*nz(vec2(X*90.,zw*60.));
  vec3 pc=vec3(.88,.865,.835)+grav-tr*.25;
  float edge=smoothstep(.050+pw,.034,abs(dX))*(1.-pth);g=mix(g,vec3(.52,.54,.47),edge*.5);
  g=mix(g,pc,pth);
#else
  /* Holo-Boden: Höhenlinien + Gitter + roter Track */
  float hf=fbm(vec2(X*1.3,zw*.9));float cl=hf*16.;float cw=fwidth(cl);
  float con=smoothstep(cw*1.2,0.,abs(fract(cl)-.5)-.5+cw*1.2);
  float gx=X*6.,gz=zw*2.;vec2 gw=fwidth(vec2(gx,gz));
  float grid=max(smoothstep(gw.x,0.,abs(fract(gx)-.5)-.5+gw.x),smoothstep(gw.y,0.,abs(fract(gz)-.5)-.5+gw.y));
  vec3 g=mix(vec3(.90,.905,.92),vec3(.84,.85,.87),hf+.5);
  g=mix(g,vec3(.32,.34,.38),con*.55*(1.-smoothstep(.15,.45,cw))*(1.-hazeG));g=mix(g,vec3(.42,.44,.48),grid*.30*(1.-smoothstep(.3,1.,max(gw.x,gw.y))));
  float pth=smoothstep(.012+pw,.012-pw,abs(dX));float pg=smoothstep(.05+pw,.0,abs(dX));
  g=mix(g,mix(g,vec3(.80,.81,.83),.6),pg*.6);
  float flow=smoothstep(.75,1.,fract(zw*.8-uT*.9));g=mix(g,mix(RDK,RED*1.15,.4+.6*flow),pth);
#endif
  /* Klick-Welle */
  float kt=uT-uK.z;float kz=.085/max(yT-uK.y,.01);float kd=length(vec2((X-(uK.x*A-cx)*kz)*.6,z-kz));
  g=mix(g,RED,step(0.,kt)*exp(-kt*.8)*smoothstep(.06,0.,abs(kd-kt*2.2))*(1.-hazeG)*.85);
  /* Licht & Dunst */
  g*=.92+.10*smoothstep(1.,6.,z);
  col=mix(g,hz,hazeG*.55);
  col=mix(col,vec3(.97),smoothstep(.016,.0,dy)*.0);
 }
#endif

 /* Waldsaum/Hecken auf der Bodenkante */
#if V!=2
 if(!fg){float hh=.010+.012*(nz(vec2(x*9.,5.))*.5+.5)+.006*nz(vec2(x*70.,2.))+.003*nz(vec2(x*190.,7.));
  float yH=yT+hh;if(y<yH){fg=true;float cn=nz(vec2(x,y)*420.)+.5*nz(vec2(x,y)*900.);
   vec3 hc=mix(vec3(.20,.29,.19),vec3(.30,.40,.26),cn*.5+.5);
#if V==1
   hc=mix(vec3(.40,.42,.46),vec3(.50,.52,.56),cn*.5+.5);
#endif
   hc*=.85+.25*smoothstep(yT,yH,y);col=mix(hc,hz,.30);}}
#endif
 /* ---------- Bergebenen ---------- */
 if(!fg){
  for(int i=0;i<6;i++){float f=5.-float(i);
   float par=(uM.x-.5)*.035*(f+1.)+uT*.0018*(f+1.)+f*3.7;
   float yo=-lift*(f+1.)*.7+(uM.y-.5)*.008*(f+1.);
   float sx=mob?1.:1.6/A;float xx=x*sx+par;
   float mo=0.;
#if V!=2
   if(mob)mo=.03;
#endif
   vec2 lb=LB(f);if(y>lb.x+lb.y*1.25+.04+yo+mo)continue;
   float h=LH(f,xx)+yo+mo;
   if(y<h){
    float e=.006;float dy=h-y;float s=(ridgeN(f,xx+e)-ridgeN(f,xx))/e*lb.y*sx*exp(-dy*(14.+f*4.));float tf=f/5.;
    vec3 base=mix(mix(vec3(.60,.66,.74),vec3(.38,.47,.46),smoothstep(0.,.45,tf)),vec3(.17,.27,.18),smoothstep(.40,1.,tf));
#if V==1
    base=mix(vec3(.64,.67,.72),vec3(.34,.37,.41),tf);
#endif
#if V==2
    base=mix(vec3(.60,.64,.70),vec3(.26,.29,.33),tf);
#endif
    float kx=4.+f*2.5;vec2 rp=vec2(xx*kx-dy*kx*clamp(s,-2.,2.)*.9/sx,dy*(15.+f*6.)+f*3.);float r0=fbm(rp),rx=fbm(rp+vec2(.06,0.));
    float gul=1.-abs(nz(vec2((xx-dy*clamp(s,-2.,2.)*.9/sx)*(14.+f*9.),dy*3.5+f)));
    float lit=clamp(.86-s*.30+(rx-r0)*3.2+gul*gul*.035-smoothstep(0.,.16,dy)*.12,.38,1.30);
    vec3 c=base*lit;
    if(f>1.5){float k=150.+f*70.;float cn=nz(vec2(x,y)*k)+.5*nz(vec2(x,y)*k*2.1+4.);c*=.90+.22*cn*(.4+tf);}
    else{c*=1.+.06*fbm(vec2(xx*40.,y*55.));}
    /* Schnee/Fels an den hinteren Gipfeln */
    if(f<1.5){float sn=smoothstep(.035,.0,dy-.01*nz(vec2(xx*40.,y*60.)))*smoothstep(.45,.62,h);c=mix(c,vec3(.96,.965,.975)*(.85+.25*lit),sn*.85);}
    c+=vec3(.10)*smoothstep(.005,.0,dy)*(1.-tf*.6)*smoothstep(-.2,.6,-s+.2);
    /* Luftperspektive + Talnebel */
    float fogA=.64-tf*.54;c=mix(c,hz,fogA);
    float mt=fbm(vec2(xx*2.2-uT*.025,y*7.+f));
    float mist=smoothstep(.015,.11+.015*f,dy)*(.62-tf*.40)*(.65+.55*mt);
    c=mix(c,vec3(.965,.968,.972),clamp(mist,0.,1.));
#if V==1
    /* Scanner + Höhenlinien auf den Bergen + Kammlinie */
    float scx=fract(uT*.045)*1.5*A-.2*A;float sw=exp(-pow((x-scx)*7.,2.));
    float cl=(y-yo)*90.+f*.3;float cw=90.*px;float con=smoothstep(cw*1.5,0.,abs(fract(cl)-.5)-.5+cw*1.5);
    c=mix(c,vec3(.30,.33,.37),con*(.10+.55*sw)*(1.-tf*.5));
    c=mix(c,RED,smoothstep(px*1.6,0.,dy-px*.5)*(.25+.75*sw)*(1.-tf*.3));
    c=mix(c,vec3(1.),sw*.10);
#endif
    col=c;depth=f;break;}
  }
 }

 /* Sonnenstrahlen */
 {vec2 sv=vec2(x,y)-sun;float sa=atan(sv.y,sv.x);float sr=length(sv);
  float ray=pow(max(0.,nz(vec2(sa*9.,uT*.06))*.5+.5+.5*nz(vec2(sa*23.,uT*.09+3.))-.35),2.);
  col=mix(col,vec3(1.,.995,.985),ray*exp(-sr*1.8)*.22*(depth<0.?1.:(1.-depth/5.)));}
#if V==1
 /* Gipfel-Pins (rote Ringe + Leitlinie) */
 for(int k=0;k<3;k++){float fk=float(k);float px0=A*(.52+fk*.20);float f=1.;
  float par=(uM.x-.5)*.035*(f+1.)+uT*.0018*(f+1.)+f*3.7;float yo=-lift*(f+1.)*.7+(uM.y-.5)*.008*(f+1.);
  float hy=LH(f,px0*(mob?1.:1.6/A)+par)+yo+.012;float top=hy+.07+.02*fk;
  float ln=smoothstep(px*1.2,0.,abs(x-px0))*step(hy,y)*step(y,top)*step(.5,fract((y-uT*.03)*90.));
  float rg=smoothstep(px*1.6,0.,abs(length(vec2(x-px0,y-top))-.010))+smoothstep(.0045,.0025,length(vec2(x-px0,y-top)));
  float pul=abs(length(vec2(x-px0,y-hy))-fract(uT*.6+fk*.33)*.04);float pr=smoothstep(px*1.5,0.,pul)*(1.-fract(uT*.6+fk*.33));
  col=mix(col,vec3(.25,.27,.30),ln*.6);col=mix(col,RED,clamp(rg+pr*.8,0.,1.));}
#endif

#if V==2
 /* Nebelmeer */
 float fs=.30+.035*fbm(vec2(x*1.4-uT*.012,uT*.01))+.012*sin(x*3.+uT*.2)-lift*2.2;
 if(mob)fs+=.03;
 float fn=fbm(vec2(x*2.6-uT*.03,y*9.-uT*.02))+.5*fbm(vec2(x*6.-uT*.05,y*20.));
 float fd=smoothstep(fs+.03,fs-.05,y+.03*fn);
 vec3 fogC=mix(vec3(.93,.935,.945),vec3(1.),smoothstep(-.2,.6,fn)*smoothstep(fs-.15,fs,y));
 fogC=mix(fogC,vec3(.86,.87,.89),smoothstep(fs-.05,fs-.30,y)*.6);
 /* rote Sonnenbahn auf den Nebelbänken (nur Linien, kein Rosa) */
 float rs=smoothstep(.10,.0,abs(x-sun.x))*smoothstep(fs-.12,fs,y)*smoothstep(.62,.80,fract(y*55.+fn*2.));
 col=mix(col,fogC,fd);sunM*=(1.-fd)*step(depth,-.5);
 /* Kiefern-Silhouetten vorn rechts */
 float tr=0.,trB=0.;
 for(int row=0;row<2;row++){float rw=float(row);float cw=.020+.008*rw;float ci=floor(x/cw);float sc2=1.-rw*.35;
 for(int j=-1;j<=1;j++){float c=ci+float(j);float r1=h21(vec2(c,1.+rw*9.)),r2=h21(vec2(c,2.+rw*9.)),r3=h21(vec2(c,4.+rw*9.));
  float tx=(c+.5+(r1-.5)*.7)*cw;float H=(.06+.11*r2*r2)*smoothstep(A*.48,A*.88,tx)*sc2;
  float by=.08+.12*smoothstep(A*.50,A*1.0,tx)+.02*nz(vec2(tx*4.,3.))-lift*3.-.012+rw*.035;float ly=(y-by)/max(H,.001);
  float tiers=7.+4.*r3;float jag=.10*nz(vec2(y*420.,c*3.1));
  float w=cw*.85*pow(max(1.-ly,0.),1.05)*(.58+.42*fract(ly*tiers+r1)+jag)+cw*.03;
  float inside=step(0.,ly)*step(ly,1.)*smoothstep(w+px,w-px,abs(x-tx-(ly*ly)*.004*(r1-.5)));
  float trunk=step(-.3,ly)*step(ly,.1)*smoothstep(cw*.07+px,cw*.07-px,abs(x-tx));
  float m=max(inside,trunk)*step(.015,H);if(row==0)tr=max(tr,m);else trB=max(trB,m);}}
 float yr=.08+.12*smoothstep(A*.50,A*1.0,x)+.02*nz(vec2(x*4.,3.))-lift*3.;
 col=mix(col,mix(vec3(.17,.19,.21),fogC,.55),trB*(1.-tr));
 float ground=smoothstep(yr+px,yr-px,y);
 col=mix(col,vec3(.17,.19,.21),max(tr,ground));
#endif

 /* Lesbarkeit links: Milchglas */
 float calm=mob?.50*smoothstep(.18,.55,uv.y):smoothstep(.62,.18,uv.x)*.72;
 col=mix(col,vec3(dot(col,vec3(.3,.59,.11))),smoothstep(.2,.6,calm)*.5);col=mix(col,vec3(.955,.96,.968),calm);
#if V==2
 col=mix(col,RED,sunM*(1.-max(tr,ground)));
#endif
 col*=1.-.06*pow(length(uv-vec2(.5,.5)),2.);
 col+=(h21(gl_FragCoord.xy+fract(uT))-.5)*.012;
 gl_FragColor=vec4(col,1.);}
`;}
var VQ='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

/* ---------- Motor ---------- */
var cv,gl,buf,P={},W=0,H=0,dpr=1,raf,t0=performance.now(),M=[.5,.5],Mt=[.5,.5],sc=0,scT=0,K=[0,0,-99];
function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o}
function prog(v,f){var p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));var u={};['uR','uT','uS','uM','uK'].forEach(function(n){u[n]=gl.getUniformLocation(p,n)});return{p:p,u:u}}
function get(k){if(P[k])return P[k];P[k]=prog(VQ,FS(k==='pfalz'?0:k==='holo'?1:2));return P[k]}
function size(){var big=innerWidth*innerHeight>1.4e6;dpr=Math.min(devicePixelRatio||1,1)*(big?.72:.9);
 var w=Math.round(cv.clientWidth*dpr),h=Math.round(cv.clientHeight*dpr);if(w!==W||h!==H){W=cv.width=w;H=cv.height=h}}
function frame(){raf=requestAnimationFrame(frame);size();var t=(performance.now()-t0)/1000;
 M[0]+=(Mt[0]-M[0])*.05;M[1]+=(Mt[1]-M[1])*.05;scT=scrollY/innerHeight;sc+=(scT-sc)*.12;
 gl.viewport(0,0,W,H);var p=get(mode),u=p.u;gl.useProgram(p.p);
 gl.uniform2f(u.uR,W,H);gl.uniform1f(u.uT,t);gl.uniform1f(u.uS,sc);gl.uniform2f(u.uM,M[0],M[1]);gl.uniform3f(u.uK,K[0],K[1],K[2]);
 gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,3)}
function click(e){if(e.target&&e.target.closest&&e.target.closest('#ueSw'))return;K=[e.clientX/innerWidth,1-e.clientY/innerHeight,(performance.now()-t0)/1000]}
function init(){cv=document.createElement('canvas');cv.id='hg';cv.setAttribute('aria-hidden','true');document.body.insertBefore(cv,document.body.firstChild);
 gl=cv.getContext('webgl',{antialias:false,alpha:false,premultipliedAlpha:false,powerPreference:'high-performance'});
 if(!gl){cv.remove();de.classList.remove('hg3');return}gl.getExtension('OES_standard_derivatives');
 buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);
 addEventListener('pointermove',function(e){Mt=[e.clientX/innerWidth,1-e.clientY/innerHeight]},{passive:true});
 addEventListener('pointerdown',click,{passive:true});
 cv.addEventListener('webglcontextlost',function(e){e.preventDefault();cancelAnimationFrame(raf)});
 cv.addEventListener('webglcontextrestored',function(){P={};buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);frame()});
 try{get(mode)}catch(err){console.error('hg6',err.message)}
 frame();sw()}

/* ---------- Umschalter ---------- */
function sw(){var b=document.createElement('div');b.id='ueSw';b.setAttribute('role','group');b.setAttribute('aria-label','Hintergrund wählen');
 b.innerHTML='<span class="ue-k">Hintergrund</span>'+MODES.map(function(m,i){return'<button type="button" data-hg="'+m[0]+'" aria-pressed="false"><b>'+(i+1)+'</b><span>'+m[1]+'<small>'+m[2]+'</small></span></button>'}).join('');
 document.body.appendChild(b);
 function up(){[].forEach.call(b.querySelectorAll('button'),function(x){var on=x.dataset.hg===mode;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on))})}
 b.addEventListener('click',function(e){var x=e.target.closest('button');if(!x)return;e.stopPropagation();mode=x.dataset.hg;W=0;try{localStorage.setItem('vc_hg6',mode)}catch(_){}try{get(mode)}catch(err){console.error('hg6',err.message)}up();tip()});
 var tt=0;function tip(){var n=document.getElementById('ueTip');if(!n){n=document.createElement('div');n.id='ueTip';document.body.appendChild(n)}
  var i=MODES.findIndex(function(m){return m[0]===mode}),m=MODES[i];n.innerHTML='<b>Hintergrund '+(i+1)+'</b> · '+m[1]+' – Maus bewegen, scrollen, klicken';n.classList.remove('on');void n.offsetWidth;n.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){n.classList.remove('on')},2800)}
 up();setTimeout(tip,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* Vorlage „Echte Landschaften“ (Tiry 21.11.2026) – echte Fotos (Unsplash-Lizenz, frei auch gewerblich, ohne Personen)
   werden per KI-Tiefenkarte zu einer lebenden 3D-Szene: Kamera schwebt (Maus/Neigung), Scrollen = Kamerafahrt ins Bild,
   Wolken/Nebel fließen wie im Video (Cinemagraph per Flow-Map), Klick = rote Lichtwelle läuft durch die Landschaft.
   1 Alpental      – Gletschertal, Bergwald, Wolken ziehen, Talnebel
   2 Wolkenmeer    – Gipfel im Morgenlicht über fließendem Nebelmeer (gespiegelt, Gipfel rechts)
   3 Hochland 2045 – grünes Hochland mit Passstraße, Sonne, Nebelbänke + Holo-Höhenlinien und Scanner
   Bilddaten je Szene: <name>-2400/1400.webp (Foto), <name>-d.png (R = Tiefe, G = Himmel, B = Fließ-Maske). */
(function(){
var MODES=[['tal','Alpental','Echtes Foto · 3D-Tiefe · ziehende Wolken'],['meer','Wolkenmeer','Gipfel über fließendem Nebel'],['pass','Hochland 2045','Passstraße + Holo-Höhenlinien']];
/* je Szene: Fokus (Bild-x, Bild-y von unten), Spiegeln, Fokus-Ebene der Parallaxe, Fließ-Stärke, Sonne (x,y von unten; z = Stärke) */
var CFG={tal:{fxm:.50,fx:.56,fy:.48,fl:0,fp:.30,am:.045,sp:.030,sun:[.95,.98,0]},
 meer:{fxm:.64,fx:.50,fy:.50,fl:1,fp:.28,am:.040,sp:.018,sun:[.22,.60,.55]},
 pass:{fxm:.70,fx:.60,fy:.55,fl:0,fp:.30,am:.040,sp:.022,sun:[.77,.67,.9]}};
var BASE=(window.HG7_BASE||'img/hg7/');
var mode=window.HG7_DEFAULT||'tal';
try{var q=new URLSearchParams(location.search).get('hg');if(q)mode=q;else{var s0=localStorage.getItem('vc_hg7');if(s0)mode=s0}}catch(e){}
if(!MODES.some(function(m){return m[0]===mode}))mode='tal';
var de=document.documentElement;

var FSRC=`#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 uR,uM,uFoc,uImg;uniform float uT,uS,uFl,uFp,uAm,uSp,uFade,uV;uniform vec3 uK,uSun;
uniform sampler2D uP,uD,uE;
const vec3 RED=vec3(.886,.137,.176);
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*nz(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
vec2 fl(vec2 q){return uFl>.5?vec2(1.-q.x,q.y):q;}
vec3 P(vec2 q){return texture2D(uP,fl(q)).rgb;}
vec3 D(vec2 q){return texture2D(uD,fl(q)).rgb;}
void main(){
 vec2 uv=gl_FragCoord.xy/uR;float A=uR.x/uR.y,iA=uImg.x/uImg.y;bool mob=A<.9;
 /* Cover-Ausschnitt mit Überstand für die Kamerabewegung */
 float zoom=1.12+min(uS,3.)*.035;
 vec2 s=A>iA?vec2(1.,iA/A):vec2(A/iA,1.);s/=zoom;
 vec2 c=clamp(uFoc,s*.5,1.-s*.5);vec2 p=c+(uv-.5)*s;
 /* Kamera: Maus + ruhiges Schweben, Scrollen = Fahrt ins Bild (nahe Dinge wachsen schneller) */
 vec2 cam=(uM-.5)*vec2(.030,.016)+vec2(sin(uT*.11),sin(uT*.083+1.))*vec2(.0055,.0028);
 float dol=min(uS,3.)*.055+.012*sin(uT*.17);
 vec2 q=p;for(int i=0;i<5;i++){float d=D(q).r;q=c+(p-c)/(1.+dol*d)+cam*(d-uFp);}
 vec3 dat=D(q);float d=dat.r,sky=dat.g,fm=dat.b;
 /* Fließen (Cinemagraph): zwei phasenversetzte Proben, weich überblendet – Wolken/Nebel ziehen endlos */
 vec2 dir=vec2(1.,.12*sin(q.x*9.+uT*.1))*(.55+.45*nz(q*4.+uT*.02));
 float f1=fract(uT*uSp),f2=fract(uT*uSp+.5);float wv=abs(1.-2.*f1);
 vec2 o=dir*uAm*fm;
 vec3 col=mix(P(q-o*f1),P(q-o*f2),1.-wv);
 /* zusätzliche Nebelschleier (bewegt) auf Fließ-Flächen und im Tal */
 float mist=fbm(vec2(q.x*5.-uT*.035,q.y*14.+uT*.01));
 float band=fm*(1.-sky*.6)*.20+smoothstep(.10,.0,abs(d-.16))*.14*(1.-sky);
 col=mix(col,vec3(.95,.955,.965),band*smoothstep(.35,.85,mist));
 /* Sonne: Glühen + Strahlen nur im Himmel / auf Nebel */
 vec2 sv=(q-uSun.xy)*vec2(iA,1.);float sr=length(sv);
 float ray=pow(max(0.,nz(vec2(atan(sv.y,sv.x)*8.,uT*.05))*.6+.4*nz(vec2(atan(sv.y,sv.x)*21.,uT*.08+3.))-.25),2.);
 float pul=.85+.15*sin(uT*.6);
 col+=vec3(1.,.93,.84)*uSun.z*(exp(-sr*7.)*.35*pul+ray*exp(-sr*2.2)*.20*max(sky,fm*.6));
#if 1
 if(uV>1.5){
  /* Holo 2045: Höhenlinien aus der Tiefe, roter Scanner läuft von nah nach fern, Kanten leuchten */
  vec3 e2=texture2D(uE,fl(q)).rgb;float dh=(e2.r*255.*256.+e2.g*255.)/65535.;
  float dq=sqrt(dh);float l=dq*44.;float w=fwidth(l)*1.1;float con=smoothstep(.5-w,.5-w*.25,abs(fract(l)-.5))*smoothstep(.12,.26,dq);
  float scn=fract(uT*.075);float sb=exp(-pow((dq-(1.-scn))*16.,2.));
  float ed=clamp(length(vec2(dFdx(d),dFdy(d)))*uR.y*.06,0.,1.);
  float land=1.-smoothstep(.2,.6,sky);
  col=mix(col,mix(vec3(.98),RED,sb),con*land*(.38+.62*sb));col+=RED*sb*land*.06;
  col=mix(col,RED,ed*land*.55);
  col=mix(col,col*.84+vec3(.08),land*.25);
  /* feines Rastergitter am Boden */
 }
#endif
 /* Klick: rote Lichtwelle läuft durch die Tiefe (kein Ring am Mauszeiger, Tiry 22.11.2026) */
 float age=uT-uK.z;
 if(age<6.){float fr=1.05-age*.42;float wvv=exp(-pow((d-fr)*24.,2.))*exp(-age*.55)*(1.-smoothstep(.2,.6,sky));
  col=mix(col,RED,clamp(wvv*.85,0.,1.));col+=vec3(1.,.7,.7)*wvv*.15;}
 /* Farbführung Rot/Grau/Weiß: Rosa/Lila raus, leicht entsättigt, klar */
 float lu=dot(col,vec3(.299,.587,.114));
 float pink=clamp(min(col.r,col.b)-col.g,0.,1.)*4.;col=mix(col,vec3(lu*1.02),clamp(pink,0.,.9));
 col=mix(vec3(lu),col,.84);col=(col-.5)*1.05+.5;
 /* Lesbarkeit links: Milchglas (wie die Seite) */
 float calm=mob?.50*smoothstep(.18,.55,uv.y):smoothstep(.62,.16,uv.x)*.74;
 col=mix(col,vec3(dot(col,vec3(.3,.59,.11))),smoothstep(.2,.6,calm)*.5);col=mix(col,vec3(.955,.96,.968),calm);
 col*=1.-.10*pow(length(uv-vec2(.62,.5)),2.);
 col+=(h21(gl_FragCoord.xy+fract(uT))-.5)*.010;
 gl_FragColor=vec4(mix(vec3(.914,.922,.933),col,uFade),1.);}
`;
var VQ='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

/* ---------- Motor ---------- */
var cv,gl,buf,pr,U={},W=0,H=0,dpr=1,raf,t0=performance.now(),M=[.5,.5],Mt=[.5,.5],sc=0,K=[0,0,-99],TX={},fade=0,shown='';
function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o}
function build(){pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VQ));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FSRC));gl.bindAttribLocation(pr,0,'a');gl.linkProgram(pr);
 if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(pr));
 ['uR','uM','uFoc','uImg','uT','uS','uFl','uFp','uAm','uSp','uFade','uV','uK','uSun','uP','uD','uE'].forEach(function(n){U[n]=gl.getUniformLocation(pr,n)});
 buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0)}
function tex(img){var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t}
function load(k){if(TX[k])return;var e=TX[k]={ok:0};var big=Math.max(screen.width,screen.height)*Math.min(devicePixelRatio||1,2)>1700;
 var n=k==='pass'?3:2;function done(){if(--n===0){e.p=tex(e.ip);e.d=tex(e.id);if(e.ih)e.e=tex(e.ih);e.w=e.ip.naturalWidth;e.h=e.ip.naturalHeight;e.ok=1}}
 e.ip=new Image();e.ip.decoding='async';e.ip.onload=done;e.ip.src=BASE+k+'-'+(big?2400:1400)+'.webp';
 e.id=new Image();e.id.onload=done;e.id.src=BASE+k+'-d.png';
 if(k==='pass'){e.ih=new Image();e.ih.onload=done;e.ih.src=BASE+k+'-h.png'}}
function size(){var big=innerWidth*innerHeight>1.4e6;dpr=Math.min(devicePixelRatio||1,1.25)*(big?.8:.95);
 var w=Math.round(cv.clientWidth*dpr),h=Math.round(cv.clientHeight*dpr);if(w!==W||h!==H){W=cv.width=w;H=cv.height=h}}
function frame(){raf=requestAnimationFrame(frame);size();var t=(performance.now()-t0)/1000;
 M[0]+=(Mt[0]-M[0])*.045;M[1]+=(Mt[1]-M[1])*.045;sc+=(scrollY/innerHeight-sc)*.10;
 var e=TX[mode];gl.viewport(0,0,W,H);
 if(!e||!e.ok){gl.clearColor(.914,.922,.933,1);gl.clear(gl.COLOR_BUFFER_BIT);return}
 if(shown!==mode){shown=mode;fade=0}fade=Math.min(1,fade+.025);
 var c=CFG[mode];gl.useProgram(pr);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,e.p);gl.uniform1i(U.uP,0);
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,e.d);gl.uniform1i(U.uD,1);
 gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,e.e||e.d);gl.uniform1i(U.uE,2);
 gl.uniform2f(U.uR,W,H);gl.uniform1f(U.uT,t);gl.uniform1f(U.uS,sc);gl.uniform2f(U.uM,M[0],M[1]);gl.uniform3f(U.uK,K[0],K[1],K[2]);
 gl.uniform2f(U.uImg,e.w,e.h);gl.uniform2f(U.uFoc,W/H<.9?c.fxm:c.fx,c.fy);gl.uniform1f(U.uFl,c.fl);gl.uniform1f(U.uFp,c.fp);gl.uniform1f(U.uAm,c.am);gl.uniform1f(U.uSp,c.sp);
 gl.uniform3f(U.uSun,c.fl?1-c.sun[0]:c.sun[0],c.sun[1],c.sun[2]);gl.uniform1f(U.uFade,fade*fade*(3-2*fade));gl.uniform1f(U.uV,mode==='pass'?2:mode==='meer'?1:0);
 gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,3)}
function click(e){if(e.target&&e.target.closest&&e.target.closest('#ueSw'))return;K=[e.clientX/innerWidth,1-e.clientY/innerHeight,(performance.now()-t0)/1000]}
function init(){cv=document.createElement('canvas');cv.id='hg';cv.setAttribute('aria-hidden','true');document.body.insertBefore(cv,document.body.firstChild);
 gl=cv.getContext('webgl',{antialias:false,alpha:false,premultipliedAlpha:false,powerPreference:'high-performance'});
 if(!gl){cv.remove();de.classList.remove('hg3');return}gl.getExtension('OES_standard_derivatives');
 try{build()}catch(err){console.error('hg7',err.message);cv.remove();de.classList.remove('hg3');return}
 addEventListener('pointermove',function(e){Mt=[e.clientX/innerWidth,1-e.clientY/innerHeight]},{passive:true});
 addEventListener('pointerdown',click,{passive:true});
 /* Handy: Neigen = Blickwinkel */
 addEventListener('deviceorientation',function(e){if(e.gamma==null)return;Mt=[.5+Math.max(-1,Math.min(1,e.gamma/30))*.5,.5+Math.max(-1,Math.min(1,(e.beta-45)/30))*.5]},{passive:true});
 cv.addEventListener('webglcontextlost',function(e){e.preventDefault();cancelAnimationFrame(raf)});
 cv.addEventListener('webglcontextrestored',function(){TX={};shown='';try{build()}catch(err){return}load(mode);frame()});
 load(mode);frame();sw();
 /* übrige Szenen leise vorladen */
 setTimeout(function(){MODES.forEach(function(m){load(m[0])})},4000)}

/* ---------- Umschalter ---------- */
function sw(){var b=document.createElement('div');b.id='ueSw';b.setAttribute('role','group');b.setAttribute('aria-label','Hintergrund wählen');
 b.innerHTML='<span class="ue-k">Hintergrund</span>'+MODES.map(function(m,i){return'<button type="button" data-hg="'+m[0]+'" aria-pressed="false"><b>'+(i+1)+'</b><span>'+m[1]+'<small>'+m[2]+'</small></span></button>'}).join('');
 document.body.appendChild(b);
 function up(){[].forEach.call(b.querySelectorAll('button'),function(x){var on=x.dataset.hg===mode;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on))})}
 b.addEventListener('click',function(e){var x=e.target.closest('button');if(!x)return;e.stopPropagation();mode=x.dataset.hg;try{localStorage.setItem('vc_hg7',mode)}catch(_){}load(mode);up();tip()});
 var tt=0;function tip(){var n=document.getElementById('ueTip');if(!n){n=document.createElement('div');n.id='ueTip';document.body.appendChild(n)}
  var i=MODES.findIndex(function(m){return m[0]===mode}),m=MODES[i];n.innerHTML='<b>Hintergrund '+(i+1)+'</b> · '+m[1]+' – Maus bewegen, scrollen, klicken';n.classList.remove('on');void n.offsetWidth;n.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){n.classList.remove('on')},2800)}
 up();setTimeout(tip,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

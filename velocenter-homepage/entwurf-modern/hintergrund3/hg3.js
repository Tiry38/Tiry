/* Vorlage „Hintergrund 2045“ (Tiry 21.11.2026) – drei komplett verschiedene WebGL-Hintergründe in Rot/Grau/Weiß.
   1 Lichtportal   – 3D-Tunnel aus weißen Paneelen, rote Lichtringe laufen, Scrollen = Flug in den Tunnel, Klick = rote Welle
   2 Datenfeld     – 3D-Landschaft aus Graphit-Punkten + Gitter, rote Impulswellen laufen über das Feld, Kamera fliegt beim Scrollen
   3 Riffelglas    – Wand aus geriffeltem Glas über der ganzen Seite, dahinter rote Lichtkörper + Graphit-Platten, Scrollen schiebt die Szene */
(function(){
var MODES=[['portal','Lichtportal','Tunnel aus Paneelen + rote Lichtringe'],['feld','Datenfeld','3D-Punktlandschaft'],['glas','Riffelglas','Glaswand + rote Lichtkörper']];
var mode=window.HG_DEFAULT||'portal';
try{var q=new URLSearchParams(location.search).get('hg');if(q)mode=q;else{var s0=localStorage.getItem('vc_hg3');if(s0)mode=s0}}catch(e){}
if(!MODES.some(function(m){return m[0]===mode}))mode='portal';
var de=document.documentElement;

var HEAD='precision highp float;uniform vec2 uR;uniform float uT,uS,uD;uniform vec2 uM;uniform vec3 uK;\n'+
'float h21(vec2 p){p=fract(p*vec2(233.34,851.73));p+=dot(p,p+23.45);return fract(p.x*p.y);}\n'+
'vec2 g2(vec2 p){float a=h21(p)*6.2831853;return vec2(cos(a),sin(a));}\n'+
'float nz(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);'+
'return mix(mix(dot(g2(i),f),dot(g2(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(g2(i+vec2(0,1)),f-vec2(0,1)),dot(g2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);}\n'+
'float fbm(vec2 p){float s=0.,a=.5;mat2 r=mat2(.8,.6,-.6,.8);for(int i=0;i<4;i++){s+=a*nz(p);p=r*p*2.03+3.1;a*=.5;}return s;}\n'+
'const vec3 RED=vec3(.886,.137,.176),RDK=vec3(.42,.035,.075),GR=vec3(.20,.215,.24);\n';
var VQ='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

/* 1 Lichtportal */
var FS_PORTAL='#extension GL_OES_standard_derivatives : enable\n'+HEAD+
'void main(){vec2 uv=gl_FragCoord.xy/uR;float A=uR.x/uR.y;vec2 q=vec2(uv.x*A,uv.y);bool mob=A<1.;'+
' vec2 c=mob?vec2(A*.62,.16):vec2(A*.74,.48);c+=(uM-.5)*vec2(.10,.06);vec2 d=q-c;float r=length(d);float ang=atan(d.y,d.x);'+
' float spin=uT*.035+(uM.x-.5)*.25;float z=.34/max(r,.001)+uT*.22+uS*2.4;float N=18.;'+
' float iv=floor(z*1.6),fv=fract(z*1.6);float u=(ang/6.2831853+.5+spin)*N+z*.9+mod(iv,2.)*.5;float fu=fract(u);float iu=floor(u);'+
' float px=1./uR.y;float wu=N/(6.2832*max(r,.001))*px*1.3,wv=1.6*.34/max(r*r,.00001)*px*1.3;'+
' float gU=smoothstep(.008,.008+wu,fu)*smoothstep(.992,.992-wu,fu);float gV=smoothstep(.012,.012+wv,fv)*smoothstep(.988,.988-wv,fv);'+
' float dep=smoothstep(.95,.12,r);float shade=.70+.13*sin(ang-1.9)+.16*dep;shade+=.05*(h21(vec2(iu,iv))-.5)+.07*(fv-.5)+.04*(fu-.5);'+
' float bev=smoothstep(.10,.015,fv)*.16-smoothstep(.80,.985,fv)*.16+smoothstep(.10,.01,fu)*.09-smoothstep(.90,.99,fu)*.09;'+
' vec3 col=vec3(clamp(shade+bev,0.,1.));'+
' float groove=1.-gU*gV;col=mix(col,vec3(.40,.415,.44),groove*.8);float ao=min(smoothstep(.0,.16,fv),smoothstep(1.,.84,fv));col*=.90+.10*ao;'+
' float hot=step(.45,h21(vec2(iv,7.)));float run=smoothstep(.55,1.,sin(ang*1.+uT*.9+iv*1.7)*.5+.5);'+
' float st=smoothstep(.016,.016+wv,fv)*smoothstep(.075+wv,.075,fv);float rl=st*hot;col=mix(col,col*vec3(.80,.80,.82),smoothstep(.16,.075,fv)*(1.-st)*hot*.5);col=mix(col,mix(RDK,RED*1.15,.35+.65*run)*(1.+.25*smoothstep(.02,.05,fv)*smoothstep(.07,.05,fv)),rl);'+
' float rl2=(1.-gU)*step(.86,h21(vec2(iu,3.)))*step(.55,sin(z*1.3-uT*2.)*.5+.5);col=mix(col,RED,rl2*gV);'+
' float kt=uT-uK.z;float kz=z-(uT*.22+uS*2.4);float wave=step(0.,kt)*exp(-kt*.5)*smoothstep(.12,0.,abs(kz-(3.6-kt*2.2)));col=mix(col,RED*1.1,wave*(1.-gV)*1.);'+
' float far=smoothstep(.085,.0,r)+smoothstep(.20,.04,r)*.55;col=mix(col,vec3(1.),clamp(far,0.,1.));'+
' float ring=exp(-pow((r-.055)*90.,2.))*.0;'+
' float calm=mob?.55*smoothstep(.22,.55,uv.y):smoothstep(.66,.30,uv.x)*.86;'+
' col=mix(col,vec3(dot(col,vec3(.3,.59,.11))),smoothstep(.2,.55,calm));col=mix(col,vec3(.955,.96,.968)*(.96+.04*shade),calm);'+
' col*=1.-.07*pow(length(uv-vec2(.5,.45)),2.);gl_FragColor=vec4(col,1.);}';

/* 2 Datenfeld – Himmel/Horizont */
var FS_FELD_BG=HEAD+'uniform float uH;void main(){vec2 uv=gl_FragCoord.xy/uR;float y=uv.y-uH;'+
' vec3 c=mix(vec3(.90,.91,.93),vec3(.985,.987,.99),smoothstep(0.,.6,y));c=mix(c,vec3(.80,.815,.84),smoothstep(0.,-.5,y));'+
' float hz=exp(-abs(y)*48.);c=mix(c,vec3(.34,.36,.40),exp(-abs(y+.012)*90.)*.25);c=mix(c,RED,smoothstep(.0035,0.,abs(y))*.9);'+
' float sw=smoothstep(.9,1.,sin(uv.x*3.+uT*.7)*.5+.5);c=mix(c,RED*1.1,smoothstep(.002,0.,abs(y))*sw);'+
' c=mix(c,c*vec3(.93,.94,.96),smoothstep(.0,-.4,y)*.4);gl_FragColor=vec4(c,1.);}';
var VS_FELD='precision highp float;attribute vec2 a;uniform vec2 uR;uniform float uT,uS;uniform vec2 uM;uniform vec3 uK;uniform float uL,uH;varying float vA,vR,vZ;'+
'float h21(vec2 p){p=fract(p*vec2(233.34,851.73));p+=dot(p,p+23.45);return fract(p.x*p.y);}'+
'vec2 g2(vec2 p){float a=h21(p)*6.2831853;return vec2(cos(a),sin(a));}'+
'float nz(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);return mix(mix(dot(g2(i),f),dot(g2(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(g2(i+vec2(0,1)),f-vec2(0,1)),dot(g2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);}'+
'void main(){float trav=uT*1.4+uS*14.;float z=mod(a.y-trav,64.);float wz=z+trav;float x=a.x;'+
' float h=nz(vec2(x,wz)*.09)*3.2+nz(vec2(x,wz)*.23)*1.1;h*=smoothstep(1.2,9.,abs(x+1.5*sin(wz*.06)));'+
' h+=.35*sin(x*.5+uT*.8)*sin(wz*.3);'+
' float pr=mod(uT,5.5)*9.;float dd=length(vec2(x,z-6.));float ring=exp(-pow(dd-pr,2.)*.35)*(1.-pr/50.);'+
' float kt=uT-uK.z;float kr=exp(-pow(length(vec2(x-uK.x,z-uK.y))-kt*11.,2.)*.4)*exp(-kt*.45)*step(0.,kt);'+
' h+=ring*1.1+kr*1.4;float red=clamp(ring*1.2+kr*1.5+smoothstep(2.2,3.2,h)*.9,0.,1.);'+
' float camH=5.2+uS*1.2;vec3 p=vec3(x,h-camH,z);float f=1.9;float asp=uR.x/uR.y;float sh=asp<1.?.18:0.;float yaw=(uM.x-.5)*.35,pit=atan((uH*2.-1.-sh)/f);'+
' p.xz=mat2(cos(yaw),-sin(yaw),sin(yaw),cos(yaw))*p.xz;p.yz=mat2(cos(pit),-sin(pit),sin(pit),cos(pit))*p.yz;'+
' gl_Position=vec4(p.x*f/max(asp,.0001)*(asp<1.?1.55:1.),p.y*f+sh*p.z,p.z*.01,p.z);'+
' float fog=smoothstep(64.,10.,z)*smoothstep(2.,9.,p.z);vA=fog;vR=red;vZ=p.z;gl_PointSize=clamp(uL*34./p.z,1.3,10.)*(1.+red*.6);}';
var FS_FELD_P='precision highp float;uniform float uP;varying float vA,vR,vZ;void main(){float d=uP>.5?length(gl_PointCoord-.5)*2.:0.;float a=smoothstep(1.,.55,d);'+
' vec3 c=mix(vec3(.22,.235,.26),vec3(.886,.137,.176),vR);float al=vA*a*(uP>.5?(.9+vR*.1):(.24+vR*.4));gl_FragColor=vec4(c,al);}';

/* 3 Riffelglas */
var FS_GLAS=HEAD+'uniform float uF;'+
'float sd(vec2 p,vec2 b,float r){vec2 d=abs(p)-b+r;return length(max(d,0.))+min(max(d.x,d.y),0.)-r;}'+
'vec2 rot(vec2 p,float a){return mat2(cos(a),-sin(a),sin(a),cos(a))*p;}'+
'vec3 orb(vec3 c,vec2 q,vec2 o,float R){float d=length(q-o);float m=smoothstep(R,R*.86,d);'+
' vec3 oc=mix(vec3(1.,.24,.26),RDK,smoothstep(0.,R,length(q-o-vec2(-.25,.3)*R)));c=mix(c,c*.78,smoothstep(R*1.5,R,d)*.6*(1.-m));return mix(c,oc,m);}'+
'vec3 scene(vec2 q){float t=uT*.09;float A=uR.x/uR.y;'+
' vec3 c=mix(vec3(.80,.815,.84),vec3(.985,.987,.99),smoothstep(-.2,1.1,q.y-.25*q.x/A));'+
' vec2 s1=rot(q-vec2(A*.62,.15),-.62);float b1=sd(s1,vec2(2.6,.16),.16);c=mix(c,mix(GR,vec3(.36,.38,.42),smoothstep(-.16,.16,s1.y)),smoothstep(.006,-.006,b1));'+
' vec2 s2=rot(q-vec2(A*.18,-.85),.35);float b2=sd(s2,vec2(1.9,.07),.07);c=mix(c,vec3(.55,.57,.61),smoothstep(.006,-.006,b2));'+
' c=orb(c,q,vec2(A*.80+.10*sin(t*2.1),.62+.10*cos(t*1.7)),.27);'+
' c=orb(c,q,vec2(A*.55+.25*sin(t*1.3+2.),-.55+.18*sin(t*1.9)),.42);'+
' c=orb(c,q,vec2(A*.08+.12*sin(t*1.6+4.),-1.25+.1*cos(t)),.30);'+
' c=orb(c,q,vec2(A*.97,-1.7+.15*sin(t*1.1)),.22);'+
' c=orb(c,q,vec2(uM.x*A,uM.y-uS*.9+.0),.10);'+
' float ls=abs(rot(q-vec2(A*.4,.0),-.62).y);c=mix(c,vec3(1.),smoothstep(.006,0.,ls)*.85);'+
' return c;}'+
'void main(){vec2 uv=gl_FragCoord.xy/uR;float A=uR.x/uR.y;vec2 p=vec2(uv.x*A,uv.y);'+
' float xw=p.x+.022*sin(p.y*3.1+uT*.35)+.012*sin(p.y*7.+uT*.2);float u=fract(xw/uF)*2.-1.;'+
' vec2 q=p;q.y-=uS*.9;q.y+=0.;vec2 off=vec2(-u*uF*1.35,u*u*.012);vec3 col=vec3(0.);'+
' for(int i=0;i<5;i++){float fi=float(i)-2.;col+=scene(q+off+vec2(fi*uF*.06*(.4+abs(u)),fi*.004));}col/=5.;'+
' float fro=A<1.?.62*smoothstep(.15,.45,uv.y):smoothstep(.68,.32,uv.x)*.80;col=mix(col,vec3(dot(col,vec3(.3,.59,.11))),smoothstep(.15,.5,fro));col=mix(col,vec3(.955,.96,.968),.10+fro);'+
' float hl=exp(-pow((u+.55)*5.,2.));col+=vec3(1.)*hl*.16;col*=1.-smoothstep(.72,1.,u)*.16;col=mix(col,vec3(1.),smoothstep(.96,1.,abs(u))*.35);'+
' col*=1.-.08*pow(length(uv-vec2(.5,.45)),2.);gl_FragColor=vec4(col,1.);}';

var cv,gl,P={},buf,gB,gI,gN=0,gLn=0,W=0,H=0,dpr=1,t0=performance.now(),M=[.6,.6],Mt=[.6,.6],K=[0,0,-99],sc=0,scT=0,raf=0;
function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o}
function prog(v,f){var p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));var u={};['uR','uT','uS','uD','uM','uK','uF','uH','uL','uP'].forEach(function(n){u[n]=gl.getUniformLocation(p,n)});return{p:p,u:u}}
function get(k){if(P[k])return P[k];P[k]=k==='portal'?prog(VQ,FS_PORTAL):k==='glas'?prog(VQ,FS_GLAS):k==='fbg'?prog(VQ,FS_FELD_BG):prog(VS_FELD,FS_FELD_P);return P[k]}
function grid(){var nx=150,nz=120,v=new Float32Array(nx*nz*2),i=0,x,z;for(z=0;z<nz;z++)for(x=0;x<nx;x++){v[i++]=(x/(nx-1)-.5)*64;v[i++]=z/nz*64}
 gB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,gB);gl.bufferData(gl.ARRAY_BUFFER,v,gl.STATIC_DRAW);gN=nx*nz;
 var ix=[];for(z=0;z<nz;z++)for(x=0;x<nx-1;x++){if(z%3)continue;ix.push(z*nx+x,z*nx+x+1)}for(x=0;x<nx;x+=3)for(z=0;z<nz-1;z++){ix.push(z*nx+x,(z+1)*nx+x)}
 gI=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gI);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(ix),gl.STATIC_DRAW);gLn=ix.length}
function size(){var big=innerWidth*innerHeight>1.4e6;dpr=Math.min(devicePixelRatio||1,mode==='feld'?2:1)*(mode==='feld'?1:mode==='portal'?(big?.85:1):(big?.62:.8));
 var w=Math.round(cv.clientWidth*dpr),h=Math.round(cv.clientHeight*dpr);if(w!==W||h!==H){W=cv.width=w;H=cv.height=h}}
function uni(o,t){var u=o.u;gl.uniform2f(u.uR,W,H);gl.uniform1f(u.uT,t);gl.uniform1f(u.uS,sc);gl.uniform2f(u.uM,M[0],M[1]);gl.uniform3f(u.uK,K[0],K[1],K[2]);
 if(u.uF)gl.uniform1f(u.uF,Math.max(46,Math.min(78,innerWidth*.045))/innerHeight);if(u.uL)gl.uniform1f(u.uL,dpr*(innerWidth<720?1.2:1))}
function quad(){gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0)}
function frame(){raf=requestAnimationFrame(frame);size();var t=(performance.now()-t0)/1000;
 M[0]+=(Mt[0]-M[0])*.05;M[1]+=(Mt[1]-M[1])*.05;var vh=innerHeight;scT=scrollY/vh;sc+=(scT-sc)*.12;
 gl.viewport(0,0,W,H);
 if(mode==='feld'){var b=get('fbg');gl.useProgram(b.p);uni(b,t);var hz=.80+(M[1]-.5)*.03-Math.min(sc,3)*.02;if(innerWidth<720)hz=.84;gl.uniform1f(b.u.uH,hz);quad();gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLES,0,3);
  var o=get('fp');gl.useProgram(o.p);uni(o,t);gl.uniform1f(o.u.uH,hz);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.bindBuffer(gl.ARRAY_BUFFER,gB);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.uniform1f(o.u.uP,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gI);gl.drawElements(gl.LINES,gLn,gl.UNSIGNED_SHORT,0);gl.uniform1f(o.u.uP,1);gl.drawArrays(gl.POINTS,0,gN);return}
 var p=get(mode);gl.useProgram(p.p);uni(p,t);quad();gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLES,0,3)}
function click(e){var x=e.clientX/innerWidth,y=1-e.clientY/innerHeight,t=(performance.now()-t0)/1000;
 if(mode==='portal')K=[x,y,t];
 else if(mode==='feld')K=[(x-.5)*22,8+(1-y)*14,t];else K=[0,0,t]}
function init(){cv=document.createElement('canvas');cv.id='hg';cv.setAttribute('aria-hidden','true');document.body.insertBefore(cv,document.body.firstChild);
 gl=cv.getContext('webgl',{antialias:true,alpha:false,premultipliedAlpha:false,powerPreference:'high-performance'});
 if(!gl){cv.remove();de.classList.remove('hg3');return}gl.getExtension('OES_standard_derivatives');
 buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);grid();
 addEventListener('pointermove',function(e){Mt=[e.clientX/innerWidth,1-e.clientY/innerHeight]},{passive:true});
 addEventListener('pointerdown',click,{passive:true});
 cv.addEventListener('webglcontextlost',function(e){e.preventDefault();cancelAnimationFrame(raf)});
 cv.addEventListener('webglcontextrestored',function(){P={};buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);grid();frame()});
 try{get(mode)}catch(err){console.error('hg3',err.message)}
 frame();sw()}

/* ---------- Umschalter ---------- */
function sw(){var b=document.createElement('div');b.id='ueSw';b.setAttribute('role','group');b.setAttribute('aria-label','Hintergrund wählen');
 b.innerHTML='<span class="ue-k">Hintergrund</span>'+MODES.map(function(m,i){return'<button type="button" data-hg="'+m[0]+'" aria-pressed="false"><b>'+(i+1)+'</b><span>'+m[1]+'<small>'+m[2]+'</small></span></button>'}).join('');
 document.body.appendChild(b);
 function up(){[].forEach.call(b.querySelectorAll('button'),function(x){var on=x.dataset.hg===mode;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on))})}
 b.addEventListener('click',function(e){var x=e.target.closest('button');if(!x)return;e.stopPropagation();mode=x.dataset.hg;W=0;try{localStorage.setItem('vc_hg3',mode)}catch(_){}try{get(mode==='feld'?'fp':mode);if(mode==='feld')get('fbg')}catch(err){console.error('hg3',err.message)}up();tip()});
 var tt=0;function tip(){var n=document.getElementById('ueTip');if(!n){n=document.createElement('div');n.id='ueTip';document.body.appendChild(n)}
  var i=MODES.findIndex(function(m){return m[0]===mode}),m=MODES[i];n.innerHTML='<b>Hintergrund '+(i+1)+'</b> · '+m[1]+' – Maus bewegen, scrollen, klicken';n.classList.remove('on');void n.offsetWidth;n.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){n.classList.remove('on')},2800)}
 up();setTimeout(tip,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

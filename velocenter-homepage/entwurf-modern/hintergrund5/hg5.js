/* Vorlage „Fahrrad-Hintergründe 2“ (Tiry 21.11.2026) – drei WebGL-Hintergründe in Rot/Grau/Weiß, Technik wie Lichtportal/Datenfeld
   (rein analytisch pro Pixel bzw. ein Punktgitter – kein Raymarching, läuft auch auf schwachen Grafikchips).
   1 Laufrad      – Riesiges Laufrad schräg im Raum, dreht mit dem Scrollen; Speichen, Felge, Bremsscheibe werfen echte Schatten auf die Wand
   2 Trail        – 3D-Punktlandschaft (Pfälzerwald), roter Singletrail schlängelt sich zum Horizont, Rücklicht fährt voraus
   3 Profiltunnel – Flug durch einen Tunnel aus Reifenprofil-Stollen, rote Lichtringe laufen, Scrollen = Fahrt */
(function(){
var MODES=[['rad','Laufrad','Speichen werfen Schatten'],['trail','Trail','Singletrail durch 3D-Landschaft'],['profil','Profiltunnel','Flug durchs Reifenprofil']];
var mode=window.HG5_DEFAULT||'rad';
try{var q=new URLSearchParams(location.search).get('hg');if(q)mode=q;else{var s0=localStorage.getItem('vc_hg5');if(s0)mode=s0}}catch(e){}
if(!MODES.some(function(m){return m[0]===mode}))mode='rad';
var de=document.documentElement;

var HEAD='precision highp float;uniform vec2 uR;uniform float uT,uS;uniform vec2 uM;uniform vec3 uK;\n'+
'float h21(vec2 p){p=fract(p*vec2(233.34,851.73));p+=dot(p,p+23.45);return fract(p.x*p.y);}\n'+
'vec2 g2(vec2 p){float a=h21(p)*6.2831853;return vec2(cos(a),sin(a));}\n'+
'float nz(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);'+
'return mix(mix(dot(g2(i),f),dot(g2(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(g2(i+vec2(0,1)),f-vec2(0,1)),dot(g2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);}\n'+
'const vec3 RED=vec3(.886,.137,.176),RDK=vec3(.42,.035,.075),GR=vec3(.20,.215,.24);\n'+
'vec3 calmIt(vec3 col,vec2 uv,bool mob){float calm=mob?.55*smoothstep(.22,.55,uv.y):smoothstep(.66,.30,uv.x)*.86;'+
' col=mix(col,vec3(dot(col,vec3(.3,.59,.11))),smoothstep(.2,.55,calm));return mix(col,vec3(.955,.96,.968),calm);}\n';
var VQ='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

/* ---------- 1 Laufrad ---------- */
var FS_RAD='#extension GL_OES_standard_derivatives : enable\n'+HEAD+
'const float PI=3.14159265;'+
/* Spokes: tangential gekreuzt, analytisch. Gibt Abstand in Rad-Einheiten zurück */
'float spk(float r,float th,float rh,float ph){float s=sqrt(max(1.-rh*rh/(r*r),0.));float ac=acos(clamp(rh/r,0.,1.));float P=PI/8.;'+
' float a1=mod(th-ac-ph+P*.5,P)-P*.5;float a2=mod(th+ac-ph,P)-P*.5;return r*s*min(abs(a1),abs(a2));}'+
/* Deckung des Rades (für Schatten): Reifen+Felge, Speichen, Nabe, Bremsscheibe */
'float cover(vec2 w,float sp,float pw){float r=length(w);float th=atan(w.y,w.x)+sp;'+
' float ring=smoothstep(.785-pw,.785+pw,r)*smoothstep(1.+pw,1.-pw,r);'+
' float sk=spk(max(r,.11),th,.095,0.)-.007;float spokes=smoothstep(pw,-pw,sk)*step(.10,r)*step(r,.80);'+
' float hub=smoothstep(.125+pw,.125-pw,r);float rot=smoothstep(.215-pw,.215+pw,r)*smoothstep(.36+pw,.36-pw,r);'+
' return max(max(ring,spokes),max(hub,rot*.9));}'+
'void main(){vec2 uv=gl_FragCoord.xy/uR;float A=uR.x/uR.y;bool mob=A<1.;vec2 q=vec2(uv.x*A,uv.y);'+
' vec2 c=mob?vec2(A*.62,.20):vec2(A*.86,.47);float sc=mob?.46:.66;vec2 p=(q-c)/sc;'+
' float yaw=(mob?.42:.62)+(uM.x-.5)*.35+sin(uT*.11)*.04;float pit=(uM.y-.5)*.18-.06;'+
' vec3 rd=normalize(vec3(p,-2.4));vec3 C=vec3(0.,0.,-2.4);'+
' vec3 n=vec3(sin(yaw)*cos(pit),sin(pit),cos(yaw)*cos(pit));vec3 e1=normalize(cross(vec3(0.,1.,0.),n));vec3 e2=cross(n,e1);'+
' float sp=uT*.22+uS*2.6;vec3 L=normalize(vec3(.42,.40,.82));'+
/* Wand */
' float wz=-3.25;float tw=wz/rd.z;vec3 Pw=rd*tw;'+
' vec3 col=mix(vec3(.86,.87,.89),vec3(.975,.978,.983),smoothstep(-1.4,1.2,p.y-.25*p.x));'+
' float tl=dot(C-Pw,n)/dot(L,n);vec3 Ps=Pw+L*tl;vec2 ws=vec2(dot(Ps-C,e1),dot(Ps-C,e2));float blur=.006+tl*.035;'+
' float sh=cover(ws,sp,blur);col*=1.-.20*sh;'+
' float ao=cover(ws*.92,sp,.10)*.0;'+
/* Klick-Welle auf der Wand */
' /* Klick-Ring am Mauszeiger entfernt (Tiry 22.11.2026) */'+
/* Rad */
' float dn=dot(rd,n);float t=dot(C,n)/dn;vec3 P=rd*t;vec2 w=vec2(dot(P-C,e1),dot(P-C,e2));float r=length(w);'+
' float pw=max(length(fwidth(w))*.75,.0008);float th0=atan(w.y,w.x);float th=th0+sp;vec2 wr=r*vec2(cos(th),sin(th));'+
' vec3 wc=col;'+
/* Speichen (silber, mit Glanz) */
' float sk=spk(max(r,.11),th,.095,0.);float sm=smoothstep(.0065+pw,.0065-pw,sk)*step(.10,r)*smoothstep(.81,.79,r);'+
' float hl=.62+.30*pow(max(0.,sin(th0*1.+1.2)),3.);wc=mix(wc,vec3(hl)*vec3(.98,.99,1.),sm);'+
/* Speichenschatten auf der Bremsscheibe-Innenseite */
/* Bremsscheibe: Ring mit Bohrungen + 6 Arme rot */
' float rot=smoothstep(.215-pw,.215+pw,r)*smoothstep(.36+pw,.36-pw,r);'+
' float hu=th*24./(2.*PI);float hv=(r-.24)/.10;vec2 hc=vec2(fract(hu+.5*step(.5,fract(hv*1.5)))-.5,fract(hv*3.)-.5);'+
' float hole=smoothstep(.20+pw*14.,.20-pw*14.,length(hc*vec2(r*2.*PI/24.,.10/3.)*28.))*step(.245,r)*step(r,.335);'+
' float rc=.70+.18*sin(th*1.-th0)+.08*sin(r*180.);vec3 rotC=vec3(rc*.97,rc*.98,rc);rotC=mix(rotC,vec3(.18,.19,.21),hole);'+
' float ad=abs(mod(th*6./(2.*PI),1.)-.5)*(2.*PI/6.)*r;float arm=smoothstep(.016+pw,.016-pw,ad)*smoothstep(.12,.13,r)*smoothstep(.225,.215,r);'+
' wc=mix(wc,vec3(.30,.31,.34),rot*.6*smoothstep(.0,.015,r-.215));wc=mix(wc,rotC,rot);wc=mix(wc,vec3(.30,.31,.34)+.25*pow(max(0.,sin(th0*1.+1.2)),3.),arm);'+
/* Nabe */
' float hub=smoothstep(.125+pw,.125-pw,r);vec2 hn=w/.125;float hz=sqrt(max(0.,1.-dot(hn,hn)));vec3 nn=normalize(vec3(hn,hz*1.5));'+
' float hd=.45+.45*max(dot(nn,normalize(vec3(-.5,.6,.65))),0.)+.35*pow(max(dot(nn,normalize(vec3(-.3,.4,.9))),0.),24.);'+
' wc=mix(wc,vec3(hd*.94,hd*.95,hd*.98),hub);wc=mix(wc,vec3(.12,.13,.15),smoothstep(.028+pw,.028-pw,r));'+
' wc=mix(wc,vec3(.50,.51,.54),smoothstep(.006+pw,.006-pw,abs(r-.11))*.8);'+
/* Felge: gebürstetes Alu, rote Felgenschrift */
' float rim=smoothstep(.785-pw,.785+pw,r)*smoothstep(.865+pw,.865-pw,r);float rs=(r-.785)/.08;'+
' float an=.66+.22*pow(max(0.,cos(th0-2.3)),6.)+.14*pow(max(0.,cos(th0+.9)),10.)+.05*sin(rs*PI)+.03*(h21(vec2(floor(r*900.),3.))-.5);'+
' vec3 rimC=vec3(an*.96,an*.97,an);rimC*=.82+.18*smoothstep(0.,.25,rs)*smoothstep(1.,.75,rs);'+
' float dec=smoothstep(.012+pw,.012-pw,abs(r-.826))*smoothstep(.55,.62,sin(th*3.)*.5+.5);rimC=mix(rimC,RED,dec);'+
' float nip=smoothstep(.006+pw,.006-pw,length(vec2(r-.79,(mod(th+PI/32.,PI/16.)-PI/32.)*.79)));rimC=mix(rimC,vec3(.40,.41,.44),nip);'+
' wc=mix(wc,rimC,rim);'+
/* Reifen: Torus-Schattierung + Stollen an der Außenkante + Lauflicht */
' float ty=smoothstep(.862-pw,.862+pw,r)*smoothstep(1.+pw,1.-pw,r);float ts=clamp((r-.931)/.069,-1.,1.);'+
' vec3 tn=normalize(ts*vec3(cos(th0),sin(th0),0.)+vec3(0.,0.,sqrt(1.-ts*ts)));float td=.07+.17*max(dot(tn,normalize(vec3(-.5,.6,.6))),0.)+.30*pow(max(dot(tn,normalize(vec3(-.35,.5,.8))),0.),18.);'+
' float kn=step(.965,r)*smoothstep(.30,.10,abs(fract(th*36./(2.*PI))-.5));td+=kn*.07*(1.-step(.992,r));'+
' float tg=smoothstep(.003+pw,.003-pw,abs(r-.905));td*=.72;vec3 tyC=vec3(td*.95,td*.97,td)+tg*.06;'+
' float run=pow(max(0.,cos(th0-uT*.9)),40.);tyC=mix(tyC,RED,smoothstep(.0035+pw,.0035-pw,abs(r-.885))*(.55+.45*run));'+
' wc=mix(wc,tyC,ty);'+
/* Bremssattel (steht still, rot) */
' float ca=-.62;float cda=mod(th0-ca+PI,2.*PI)-PI;vec2 cl=vec2(r-.335,cda*.335);vec2 cb=abs(cl)-vec2(.042,.10);float cd=length(max(cb,0.))+min(max(cb.x,cb.y),0.)-.026;'+
' float cal=smoothstep(pw,-pw,cd);vec3 calC=mix(RED*1.08,RDK*1.3,smoothstep(-.12,.12,cl.y-cl.x*1.5));calC+=.22*smoothstep(.012,0.,abs(cd+.010))*smoothstep(-.05,.08,cl.y+cl.x);calC=mix(calC,vec3(.92),smoothstep(.006+pw,.006-pw,abs(length(cl-vec2(0.,.05))-.014))*.8);'+
' wc=mix(wc,calC,cal);'+
' float any=max(max(max(sm,rot),max(hub,rim)),max(ty,cal));col=mix(col,wc,any*step(0.,t));'+
' col=calmIt(col,uv,mob);col*=1.-.06*pow(length(uv-vec2(.5,.45)),2.);gl_FragColor=vec4(col,1.);}';

/* ---------- 2 Trail ---------- */
var FS_TR_BG=HEAD+'uniform float uH;void main(){vec2 uv=gl_FragCoord.xy/uR;float y=uv.y-uH;'+
' vec3 c=mix(vec3(.90,.91,.93),vec3(.985,.987,.99),smoothstep(0.,.6,y));c=mix(c,vec3(.80,.815,.84),smoothstep(0.,-.5,y));'+
' c=mix(c,vec3(.34,.36,.40),exp(-abs(y+.012)*90.)*.22);c=mix(c,vec3(.5,.52,.56),smoothstep(.0025,0.,abs(y))*.5);'+
' float sun=exp(-length((uv-vec2(.70,uH))*vec2(uR.x/uR.y,1.)*vec2(1.,3.))*9.);c=mix(c,vec3(1.),sun*.6);'+
' c=mix(c,c*vec3(.93,.94,.96),smoothstep(.0,-.4,y)*.4);gl_FragColor=vec4(c,1.);}';
var VS_TR='precision highp float;attribute vec2 a;uniform vec2 uR;uniform float uT,uS;uniform vec2 uM;uniform vec3 uK;uniform float uL,uH,uTr;varying float vA,vR,vZ,vW,vC;'+
'float h21(vec2 p){p=fract(p*vec2(233.34,851.73));p+=dot(p,p+23.45);return fract(p.x*p.y);}'+
'vec2 g2(vec2 p){float a=h21(p)*6.2831853;return vec2(cos(a),sin(a));}'+
'float nz(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);return mix(mix(dot(g2(i),f),dot(g2(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(g2(i+vec2(0,1)),f-vec2(0,1)),dot(g2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);}'+
'float xt(float z){return (uR.x<uR.y?.4:1.)*(6.5*sin(z*.05)+2.4*sin(z*.13+1.3));}'+
'float terr(float X,float wz){float d=abs(X-xt(wz));float h=nz(vec2(X,wz)*.055)*6.+nz(vec2(X,wz)*.16)*1.7+(.5-abs(nz(vec2(X,wz)*.09+7.)))*3.;'+
' return h*smoothstep(.5,8.,d)+.25*nz(vec2(X,wz)*.4);}'+
'void main(){float trav=uT*1.2+uS*12.;float z=mod(a.y-trav,64.);float wz=z+trav;float xc=xt(trav+7.);'+
' float X=uTr>.5?xt(wz)+a.x:a.x+xc;float x=X-xc;float h=terr(X,wz)+(uTr>.5?.10:0.);'+
' float kt=uT-uK.z;float kr=exp(-pow(length(vec2(x-uK.x,z-uK.y))-kt*11.,2.)*.4)*exp(-kt*.45)*step(0.,kt);h+=kr*1.3*(1.-uTr);'+
' float lz=5.+mod(uT*4.,30.);float lw=uTr*exp(-pow(z-lz,2.)*.6);vW=lw;'+
' float band=fract(h*.8);vC=(1.-uTr)*smoothstep(.12,0.,min(band,1.-band))*smoothstep(1.2,3.,abs(X-xt(wz)));'+
' float red=clamp(uTr+kr*1.4,0.,1.);'+
' float camH=4.4+uS*1.1;vec3 p=vec3(x,h-camH,z);float f=1.9;float asp=uR.x/uR.y;float sh=asp<1.?.18:0.;'+
' float yaw=(uM.x-.5)*.35+atan(xt(trav+18.)-xc,11.)*.6,pit=atan((uH*2.-1.-sh)/f);'+
' p.xz=mat2(cos(yaw),-sin(yaw),sin(yaw),cos(yaw))*p.xz;p.yz=mat2(cos(pit),-sin(pit),sin(pit),cos(pit))*p.yz;'+
' gl_Position=vec4(p.x*f/max(asp,.0001)*(asp<1.?1.55:1.),p.y*f+sh*p.z,p.z*.01,p.z);'+
' float fog=smoothstep(64.,10.,z)*smoothstep(1.5,7.,p.z);vA=fog;vR=red;vZ=p.z;'+
' gl_PointSize=uTr>.5?clamp(uL*30./p.z,1.8,11.)*(1.+lw*5.):clamp(uL*34./p.z,1.3,10.)*(1.+red*.6+vC*.35);}';
var FS_TR_P='precision highp float;uniform float uP,uTr;varying float vA,vR,vZ,vW,vC;void main(){float d=uP>.5?length(gl_PointCoord-.5)*2.:0.;float a=smoothstep(1.,.55,d);'+
' vec3 c=mix(vec3(.22,.235,.26),vec3(.886,.137,.176),vR);c=mix(c,vec3(.10,.11,.13),vC*.6);'+
' if(vW>.05){float core=smoothstep(.45,.0,d);c=mix(c,vec3(1.),core*vW);a=max(a,smoothstep(1.,0.,d)*vW);}'+
' float al=vA*a*(uP>.5?(uTr>.5?.95:(.85+vC*.15)):(.20+vC*.45+vR*.4));gl_FragColor=vec4(c,al);}';

/* ---------- 3 Profiltunnel ---------- */
var FS_PROFIL='#extension GL_OES_standard_derivatives : enable\n'+HEAD+
'void main(){vec2 uv=gl_FragCoord.xy/uR;float A=uR.x/uR.y;vec2 q=vec2(uv.x*A,uv.y);bool mob=A<1.;'+
' vec2 c=mob?vec2(A*.62,.16):vec2(A*.74,.48);c+=(uM-.5)*vec2(.10,.06);vec2 d=q-c;float r=length(d);float ang=atan(d.y,d.x);'+
' float spin=uT*.02+uS*.18+(uM.x-.5)*.25;float z=.34/max(r,.001)+uT*.30+uS*2.8;float N=14.;'+
' float iv=floor(z*1.25),fv=fract(z*1.25);float chev=abs(fv-.5)*1.1;'+
' float u=(ang/6.2831853+.5+spin)*N+chev+mod(iv,2.)*.5;float fu=fract(u);float iu=floor(u);'+
' float px=1./uR.y;float wv=1.25*.34/max(r*r,.00001)*px*1.3;float wu=N/(6.2832*max(r,.001))*px*1.3+wv*1.1;'+
' float gw=.05,gh=.075;float gU=smoothstep(gw,gw+wu,fu)*smoothstep(1.-gw,1.-gw-wu,fu);float gV=smoothstep(gh,gh+wv,fv)*smoothstep(1.-gh,1.-gh-wv,fv);'+
' float dep=smoothstep(.95,.12,r);float shade=.72+.12*sin(ang-1.9)+.14*dep;shade+=.05*(h21(vec2(iu,iv))-.5);'+
/* Stollen: gewölbt (Licht oben-links auf der Kante), Seitenflanken dunkler */
' float eu=min(fu-gw,1.-gw-fu)/(.5-gw),ev=min(fv-gh,1.-gh-fv)/(.5-gh);float e=clamp(min(eu*1.6,ev*1.3),0.,1.);'+
' float bev=(smoothstep(.0,.35,1.-e))*(.10*sign(.5-fv)+.06*sign(.5-fu));'+
' vec3 col=vec3(clamp(shade+bev-.06*(1.-smoothstep(0.,.4,e)),0.,1.));'+
' float sipe=smoothstep(wu*1.2,wu*.2,abs(fu-.5-(fv-.5)*.0))*step(.5,h21(vec2(iu,iv+5.)))*smoothstep(.18,.30,fv)*smoothstep(.82,.70,fv);col=mix(col,col*.72,sipe);'+
' float groove=1.-gU*gV;col=mix(col,vec3(.36,.375,.40)+.08*dep,groove*.85);'+
' float flank=(1.-gU*gV)*(smoothstep(gh+wv*3.,gh,fv)+smoothstep(1.-gh-wv*3.,1.-gh,fv)+smoothstep(gw+wu*3.,gw,fu)+smoothstep(1.-gw-wu*3.,1.-gw,fu));col=mix(col,vec3(.30,.31,.34),clamp(flank,0.,1.)*.4);'+
/* rote Lichtringe in den Querrillen + rote Stollen laufen */
' float hot=step(.55,h21(vec2(iv,7.)));float runL=smoothstep(.55,1.,sin(ang+uT*1.1+iv*1.7)*.5+.5);'+
' float inG=(1.-gV)*step(.5,fv)*hot;col=mix(col,mix(RDK,RED*1.15,.35+.65*runL),inG*.95);'+
' float rb=gU*gV*step(.93,h21(vec2(iu,iv)))*(.6+.4*sin(uT*2.+iv));col=mix(col,mix(col,RED,.85),rb);'+
' float kt=uT-uK.z;float kz=z-(uT*.30+uS*2.8);float wave=step(0.,kt)*exp(-kt*.5)*smoothstep(.12,0.,abs(kz-(3.6-kt*2.2)));col=mix(col,RED*1.1,wave*(1.-gU*gV));'+
' float far=smoothstep(.085,.0,r)+smoothstep(.22,.04,r)*.55;col=mix(col,vec3(1.),clamp(far,0.,1.));'+
' col=calmIt(col,uv,mob);col*=1.-.07*pow(length(uv-vec2(.5,.45)),2.);gl_FragColor=vec4(col,1.);}';

/* ---------- Motor ---------- */
var cv,gl,buf,P={},W=0,H=0,dpr=1,raf,t0=performance.now(),M=[.5,.5],Mt=[.5,.5],sc=0,scT=0,K=[0,0,-99],gB,gN,gI,gLn,tB,tN;
function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o}
function prog(v,f){var p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));var u={};['uR','uT','uS','uM','uK','uH','uL','uP','uTr'].forEach(function(n){u[n]=gl.getUniformLocation(p,n)});return{p:p,u:u}}
function get(k){if(P[k])return P[k];P[k]=k==='rad'?prog(VQ,FS_RAD):k==='profil'?prog(VQ,FS_PROFIL):k==='tbg'?prog(VQ,FS_TR_BG):prog(VS_TR,FS_TR_P);return P[k]}
function grid(){var nx=150,nz=120,v=new Float32Array(nx*nz*2),i=0,x,z;for(z=0;z<nz;z++)for(x=0;x<nx;x++){v[i++]=(x/(nx-1)-.5)*64;v[i++]=z/nz*64}
 gB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,gB);gl.bufferData(gl.ARRAY_BUFFER,v,gl.STATIC_DRAW);gN=nx*nz;
 var ix=[];for(z=0;z<nz;z++)for(x=0;x<nx-1;x++){if(z%3)continue;ix.push(z*nx+x,z*nx+x+1)}for(x=0;x<nx;x+=3)for(z=0;z<nz-1;z++){ix.push(z*nx+x,(z+1)*nx+x)}
 gI=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gI);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(ix),gl.STATIC_DRAW);gLn=ix.length;
 var nt=1400,tv=new Float32Array(nt*2*5);i=0;for(z=0;z<nt;z++)for(x=-2;x<=2;x++){tv[i++]=x*.11;tv[i++]=z/nt*64}
 tB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,tB);gl.bufferData(gl.ARRAY_BUFFER,tv,gl.STATIC_DRAW);tN=nt*5}
function size(){var big=innerWidth*innerHeight>1.4e6;dpr=Math.min(devicePixelRatio||1,mode==='trail'?2:1)*(mode==='trail'?1:(big?.85:1));
 var w=Math.round(cv.clientWidth*dpr),h=Math.round(cv.clientHeight*dpr);if(w!==W||h!==H){W=cv.width=w;H=cv.height=h}}
function uni(o,t){var u=o.u;gl.uniform2f(u.uR,W,H);gl.uniform1f(u.uT,t);gl.uniform1f(u.uS,sc);gl.uniform2f(u.uM,M[0],M[1]);gl.uniform3f(u.uK,K[0],K[1],K[2]);
 if(u.uL)gl.uniform1f(u.uL,dpr*(innerWidth<720?1.2:1))}
function quad(){gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0)}
function frame(){raf=requestAnimationFrame(frame);size();var t=(performance.now()-t0)/1000;
 M[0]+=(Mt[0]-M[0])*.05;M[1]+=(Mt[1]-M[1])*.05;var vh=innerHeight;scT=scrollY/vh;sc+=(scT-sc)*.12;
 gl.viewport(0,0,W,H);
 if(mode==='trail'){var b=get('tbg');gl.useProgram(b.p);uni(b,t);var hz=.80+(M[1]-.5)*.03-Math.min(sc,3)*.02;if(innerWidth<720)hz=.84;gl.uniform1f(b.u.uH,hz);quad();gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLES,0,3);
  var o=get('tp');gl.useProgram(o.p);uni(o,t);gl.uniform1f(o.u.uH,hz);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.uniform1f(o.u.uTr,0);gl.bindBuffer(gl.ARRAY_BUFFER,gB);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.uniform1f(o.u.uP,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gI);gl.drawElements(gl.LINES,gLn,gl.UNSIGNED_SHORT,0);gl.uniform1f(o.u.uP,1);gl.drawArrays(gl.POINTS,0,gN);
  gl.uniform1f(o.u.uTr,1);gl.bindBuffer(gl.ARRAY_BUFFER,tB);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.POINTS,0,tN);return}
 var p=get(mode);gl.useProgram(p.p);uni(p,t);quad();gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLES,0,3)}
function click(e){if(e.target&&e.target.closest&&e.target.closest('#ueSw'))return;var x=e.clientX/innerWidth,y=1-e.clientY/innerHeight,t=(performance.now()-t0)/1000;
 if(mode==='trail')K=[(x-.5)*22,8+(1-y)*14,t];else K=[x,y,t]}
function init(){cv=document.createElement('canvas');cv.id='hg';cv.setAttribute('aria-hidden','true');document.body.insertBefore(cv,document.body.firstChild);
 gl=cv.getContext('webgl',{antialias:true,alpha:false,premultipliedAlpha:false,powerPreference:'high-performance'});
 if(!gl){cv.remove();de.classList.remove('hg3');return}gl.getExtension('OES_standard_derivatives');
 buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);grid();
 addEventListener('pointermove',function(e){Mt=[e.clientX/innerWidth,1-e.clientY/innerHeight]},{passive:true});
 addEventListener('pointerdown',click,{passive:true});
 cv.addEventListener('webglcontextlost',function(e){e.preventDefault();cancelAnimationFrame(raf)});
 cv.addEventListener('webglcontextrestored',function(){P={};buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);grid();frame()});
 try{prep(mode)}catch(err){console.error('hg5',err.message)}
 frame();sw()}
function prep(m){if(m==='trail'){get('tp');get('tbg')}else get(m)}

/* ---------- Umschalter ---------- */
function sw(){var b=document.createElement('div');b.id='ueSw';b.setAttribute('role','group');b.setAttribute('aria-label','Hintergrund wählen');
 b.innerHTML='<span class="ue-k">Hintergrund</span>'+MODES.map(function(m,i){return'<button type="button" data-hg="'+m[0]+'" aria-pressed="false"><b>'+(i+1)+'</b><span>'+m[1]+'<small>'+m[2]+'</small></span></button>'}).join('');
 document.body.appendChild(b);
 function up(){[].forEach.call(b.querySelectorAll('button'),function(x){var on=x.dataset.hg===mode;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on))})}
 b.addEventListener('click',function(e){var x=e.target.closest('button');if(!x)return;e.stopPropagation();mode=x.dataset.hg;W=0;try{localStorage.setItem('vc_hg5',mode)}catch(_){}try{prep(mode)}catch(err){console.error('hg5',err.message)}up();tip()});
 var tt=0;function tip(){var n=document.getElementById('ueTip');if(!n){n=document.createElement('div');n.id='ueTip';document.body.appendChild(n)}
  var i=MODES.findIndex(function(m){return m[0]===mode}),m=MODES[i];n.innerHTML='<b>Hintergrund '+(i+1)+'</b> · '+m[1]+' – Maus bewegen, scrollen, klicken';n.classList.remove('on');void n.offsetWidth;n.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){n.classList.remove('on')},2800)}
 up();setTimeout(tip,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

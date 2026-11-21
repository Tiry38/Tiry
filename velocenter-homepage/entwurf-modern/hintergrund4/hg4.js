/* Vorlage „Fahrrad-Hintergründe 2045“ (Tiry 21.11.2026) – zehn WebGL-Hintergründe mit Fahrrad-Motiven, Rot/Grau/Weiß.
   Richtung wie Lichtportal/Datenfeld (Vorlage hintergrund3), aber passend zum Fahrradgeschäft.
   1 Ritzel-Tunnel · 2 Laufrad · 3 Höhenkarte Pfalz · 4 Kettenstrom · 5 Windkanal · 6 Akku-Matrix
   7 Motor-Magnetfeld · 8 Getriebe · 9 Reifen · 10 Speichen-Moiré
   Maus = Kamera/Parallaxe, Scrollen = Fahrt/Drehung, Klick = Impuls. */
(function(){
var MODES=[
 ['ritzel','Ritzel-Tunnel','Kassette als 3D-Tunnel'],
 ['laufrad','Laufrad','3D-Rad mit Speichen + Bremsscheibe'],
 ['hoehe','Höhenkarte','Pfalz-Topografie + rote Route'],
 ['kette','Kettenstrom','laufende Fahrradketten'],
 ['wind','Windkanal','Luftstrom um das Rad'],
 ['akku','Akku-Matrix','Zellen + Ladewelle'],
 ['magnet','Motor-Magnetfeld','Feldlinien um den Motor'],
 ['getriebe','Getriebe','kämmende Zahnräder in 3 Ebenen'],
 ['reifen','Reifen','Stollenreifen rollt'],
 ['moire','Speichen-Moiré','zwei Laufräder überlagert']];
var mode=window.HG4_DEFAULT||'ritzel';
try{var q=new URLSearchParams(location.search).get('hg');if(q)mode=q;else{var s0=localStorage.getItem('vc_hg4');if(s0)mode=s0}}catch(e){}
if(!MODES.some(function(m){return m[0]===mode}))mode='ritzel';
var de=document.documentElement;

var NOISE=`
float h21(vec2 p){p=fract(p*vec2(233.34,851.73));p+=dot(p,p+23.45);return fract(p.x*p.y);}
vec2 g2(vec2 p){float a=h21(p)*6.2831853;return vec2(cos(a),sin(a));}
float nz(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);
 return mix(mix(dot(g2(i),f),dot(g2(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(g2(i+vec2(0,1)),f-vec2(0,1)),dot(g2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float s=0.,a=.5;mat2 r=mat2(.8,.6,-.6,.8);for(int i=0;i<4;i++){s+=a*nz(p);p=r*p*2.03+3.1;a*=.5;}return s;}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
const vec3 RED=vec3(.886,.137,.176),RDK=vec3(.42,.035,.075),GR=vec3(.20,.215,.24);
`;
var HEAD='#extension GL_OES_standard_derivatives : enable\nprecision highp float;\nuniform vec2 uR,uM;uniform float uT,uS,uV,uH;uniform vec3 uK,uO;uniform vec2 uA0,uA1,uA2;\n'+NOISE+`
vec3 veil(vec3 c,vec2 uv){float A=uR.x/uR.y;float f=A<1.?.58*smoothstep(.15,.45,uv.y):smoothstep(.68,.30,uv.x)*.82;
 c=mix(c,vec3(dot(c,vec3(.3,.59,.11))),smoothstep(.15,.5,f));return mix(c,vec3(.955,.96,.968),f);}
vec4 fin(vec3 c){vec2 uv=gl_FragCoord.xy/uR;c=veil(c,uv);c*=1.-.07*pow(length(uv-vec2(.5,.45)),2.);return vec4(clamp(c,0.,1.),1.);}
float sdSeg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
float aa(float d,float w){return clamp(.5-d/max(w,1e-5),0.,1.);}
vec3 bgL(vec2 uv){return mix(vec3(.85,.86,.88),vec3(.975,.978,.982),smoothstep(-.1,1.1,uv.y+.25*(1.-uv.x)));}
`;
var VQ='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
var FS={};

/* 1 Ritzel-Tunnel: jede Tunnel-Etage ist ein Ritzel (Zähne, Fenster), abwechselnd gegenläufig, rote Lichtringe in den Spalten */
FS.ritzel=HEAD+`void main(){vec2 uv=gl_FragCoord.xy/uR;float A=uR.x/uR.y;vec2 q=vec2(uv.x*A,uv.y);bool mob=A<1.;
 vec2 c=mob?vec2(A*.62,.16):vec2(A*.74,.48);c+=(uM-.5)*vec2(.08,.05);vec2 d=q-c;float r=max(length(d),.001);float ang=atan(d.y,d.x);
 float px=1./uR.y;float K=1.25;float zz=(.30/r+uT*.12+uS*2.)*K;float iv=floor(zz),fv=fract(zz);float wv=K*.30/(r*r)*px*1.2;
 float dir=mod(iv,2.)*2.-1.;float a2=ang+dir*uT*(.10+.12*h21(vec2(iv,1.)))+iv*.7;
 float nt=floor(26.+16.*h21(vec2(iv,2.)));float tp=fract(a2/6.2831853*nt);float wt=nt/(6.2832*r)*px*1.5;
 float prof=smoothstep(.06-wt,.30+wt,.5-abs(tp-.5));float edge=.42+.16*prof;
 float plate=1.-smoothstep(edge-wv,edge+wv,fv);
 float dep=smoothstep(.95,.12,r);float L=sin(ang-1.9);
 float metal=.70+.13*L+.14*dep+.045*nz(vec2(a2*22.,iv*5.))+.03*(h21(vec2(iv,9.))-.5);
 metal+=smoothstep(edge-.08,edge-.01,fv)*(.14+.10*L);metal-=smoothstep(.10,0.,fv)*.10;
 float hp=fract(a2/6.2831853*5.+.25);float wd=length(vec2((hp-.5)*2.3,(fv-.21)*4.6))-.62;
 float nearR=smoothstep(.62,.40,r);float win=step(.35,h21(vec2(iv,3.)))*(1.-smoothstep(-wv*3.,wv*3.,wd))*nearR;
 vec3 pc=vec3(metal);if(h21(vec2(iv,5.))>.76&&r<.42)pc=RED*(.50+.62*clamp(metal,0.,1.15));
 pc=mix(pc,pc*.55,(1.-smoothstep(0.,wv*4.,-wd))*step(wd,0.)*0.+aa(abs(wd)-.0,wv*6.)*step(.35,h21(vec2(iv,3.)))*.6*nearR);
 float gl=.24+.07*L+.10*dep;gl*=.62+.38*smoothstep(edge,edge+.16,fv);vec3 gc=vec3(gl,gl*1.02,gl*1.08);
 float hot=step(.45,h21(vec2(iv,7.)));float run=smoothstep(.5,1.,sin(ang+uT*1.1+iv*1.9)*.5+.5);
 float st=smoothstep(.74,.74+wv,fv)*smoothstep(.81+wv,.81,fv)*hot;gc=mix(gc,mix(RDK,RED*1.15,.3+.7*run),st);
 vec3 col=mix(gc,pc,plate*(1.-win));
 float kt=uT-uK.z;float kz=zz/K-(uT*.12+uS*2.);float wave=step(0.,kt)*exp(-kt*.5)*smoothstep(.15,0.,abs(kz-(3.4-kt*2.)));col=mix(col,RED*1.1,wave*plate*.9);
 float far=smoothstep(.085,0.,r)+smoothstep(.2,.04,r)*.55;col=mix(col,vec3(1.),clamp(far,0.,1.));
 gl_FragColor=fin(col);}`;

/* 2 Laufrad: echtes 3D-Rad (Ebene im Raum), 32 gekreuzte Speichen, Bremsscheibe, Felge mit Dekor, Stollen, Schatten an der Wand */
FS.laufrad=HEAD+`
vec4 wheel(vec2 w,float sp,float fw,float full){float rho=length(w);float th0=atan(w.y,w.x);vec2 wr=rot(-sp)*w;float th=atan(wr.y,wr.x);
 float Lw=sin(th0+.7);vec3 col=vec3(0.);float cov=0.;
 if(rho<.93){for(int i=0;i<32;i++){float fi=float(i);float side=mod(fi,2.);float a=fi*6.2831853/32.;float off=(side>.5?1.:-1.)*.62;
  vec2 A2=.085*vec2(cos(a),sin(a));vec2 B2=.905*vec2(cos(a+off),sin(a+off));float cv=aa(sdSeg(wr,A2,B2)-.0062,fw);
  if(cv>0.){vec2 dr=normalize(B2-A2);float sh=(side>.5?.84:.60)+.16*dot(rot(sp)*dr,vec2(.6,.8));col=mix(col,vec3(sh,sh*1.01,sh*1.03),cv);cov=max(cov,cv);}}}
 if(full>.5){
  float rot2=aa(abs(rho-.20)-.075,fw);
  if(rot2>0.){float hf=fract(th/6.2831853*18.);float hd=length(vec2((hf-.5)*.2*6.2832/18.,rho-.205))-.011;float hole=aa(hd,fw);
   float m=.70+.18*Lw+.08*smoothstep(.13,.27,rho)-.12*smoothstep(.255,.275,rho);vec3 rc=vec3(m,m*1.01,m*1.03);
   float sw=step(.5,fract(th/6.2831853*6.));rc=mix(rc,rc*.86,aa(abs(rho-.145)-.012,fw));
   col=mix(col,mix(rc,col*.5,hole),rot2);cov=max(cov,rot2*(1.-hole*.6));}
  float arm=0.;for(int i=0;i<6;i++){float a=float(i)*1.0471976;arm=max(arm,aa(sdSeg(wr,vec2(0.),.14*vec2(cos(a),sin(a)))-.018,fw));}
  col=mix(col,vec3(.30,.31,.34)+.08*Lw,arm*step(rho,.15));cov=max(cov,arm*step(rho,.15));
  float hub=aa(rho-.085,fw);col=mix(col,vec3(.28+.10*Lw),hub);float ax=aa(rho-.035,fw);col=mix(col,vec3(.82+.12*Lw),ax);cov=max(cov,hub);}
 float rim=aa(abs(rho-.95)-.05,fw);
 if(rim>0.){float m=.60+.22*Lw+.14*smoothstep(.93,.99,rho)-.12*smoothstep(.925,.905,rho);vec3 rc=vec3(m*.92,m*.94,m*.98);
  float dec=aa(abs(rho-.958)-.016,fw)*step(.36,fract(th/6.2831853*3.));rc=mix(rc,RED*(.62+.45*m),dec*full);
  col=mix(col,rc,rim);cov=max(cov,rim);}
 float tire=aa(abs(rho-1.07)-.07,fw);
 if(tire>0.){float kf=fract(th/6.2831853*84.);float kn=aa(abs(kf-.5)-.26,fw*13.)*smoothstep(1.10,1.115,rho);
  float t=.13+.07*Lw+.05*kn+.07*smoothstep(1.0,1.06,rho)*(1.-smoothstep(1.08,1.14,rho));
  col=mix(col,vec3(t,t,t*1.04),tire);cov=max(cov,tire);}
 return vec4(col,cov);}
void main(){vec2 uv=gl_FragCoord.xy/uR;vec2 p=(gl_FragCoord.xy-.5*uR)/uR.y;bool mob=uR.x<uR.y;
 vec3 ro=vec3(0.,0.,-3.);vec3 rd=normalize(vec3(p,2.2));
 vec3 C=mob?vec3(.28,-1.05,1.3):vec3(1.32,-.02,1.25);
 float yaw=-.62+(uM.x-.5)*.35,pit=.14-(uM.y-.5)*.2;
 vec3 n=vec3(0.,0.,-1.);n.xz=rot(yaw)*n.xz;n.yz=rot(pit)*n.yz;vec3 eu=normalize(cross(vec3(0.,1.,0.),n));vec3 ev=cross(n,eu);
 float Rw=mob?.95:1.12;float t=dot(C-ro,n)/dot(rd,n);vec3 h=ro+rd*t;vec2 w=vec2(dot(h-C,eu),dot(h-C,ev))/Rw;
 float fw=max(fwidth(w.x)+fwidth(w.y),1e-4)*.75;
 float kt=uT-uK.z;float sp=uT*.42+uS*5.+step(0.,kt)*5.*(1.-exp(-kt*1.1));
 vec3 bg=bgL(uv);
 vec3 C2=C+vec3(-.55,-.50,2.4);float t2=dot(C2-ro,n)/dot(rd,n);vec3 h2=ro+rd*t2;vec2 w2=vec2(dot(h2-C2,eu),dot(h2-C2,ev))/(Rw*1.18);
 vec4 sw=wheel(w2,sp,fw*2.5+.018,0.);bg*=1.-.20*sw.a;
 vec4 wc=wheel(w,sp,fw,1.);vec3 col=mix(bg,wc.rgb,wc.a);
 gl_FragColor=fin(col);}`;

/* 3 Höhenkarte: 3D-Gelände (Dreiecksnetz) mit Höhenlinien, rote Tour mit leuchtendem Fahrer-Punkt */
var MESH_NOISE=NOISE+`
float path(float z){return 3.5*sin(z*.045)+1.8*sin(z*.11+1.);}
float hgt(vec2 w){float d=abs(w.x-path(w.y));float h=nz(w*.07)*5.+nz(w*.16+3.)*2.+nz(w*.4)*.5;h=h*.7+1.6;float k=smoothstep(.5,4.5,d);return h*k+.25*(1.-k);}`;
var VS_HOEHE='precision highp float;attribute vec2 a;uniform vec2 uR,uM;uniform float uT,uS,uH;varying vec3 vW;varying float vF;'+MESH_NOISE+`
void main(){float trav=uT*1.1+uS*12.;float x=a.x,z=a.y;float wz=z+trav;float h=hgt(vec2(x,wz));
 float f=1.9;float asp=uR.x/uR.y;float sh=asp<1.?.18:0.;float camH=7.2+uS*1.2;vec3 p=vec3(x-path(trav+8.)*.5,h-camH,z+1.5);
 float yaw=(uM.x-.5)*.3,pit=atan((uH*2.-1.-sh)/f);
 p.xz=mat2(cos(yaw),-sin(yaw),sin(yaw),cos(yaw))*p.xz;p.yz=mat2(cos(pit),-sin(pit),sin(pit),cos(pit))*p.yz;
 gl_Position=vec4(p.x*f/asp*(asp<1.?1.55:1.),p.y*f+sh*p.z,(p.z/45.-1.)*p.z,p.z);
 vW=vec3(x,h,wz);vF=smoothstep(74.,14.,z);}`;
var FS_HOEHE=HEAD.replace('uniform vec2 uR,uM;','uniform vec2 uR,uM;varying vec3 vW;varying float vF;')+`
float path(float z){return 3.5*sin(z*.045)+1.8*sin(z*.11+1.);}
void main(){vec3 nr=normalize(cross(dFdx(vW),dFdy(vW)));if(nr.y<0.)nr=-nr;
 float l=.52+.48*clamp(dot(nr,normalize(vec3(-.6,.65,-.3))),0.,1.);vec3 col=vec3(.93,.935,.945)*l;
 float hc=vW.y*1.7;float fc=max(fwidth(hc),1e-4);float dl=abs(fract(hc+.5)-.5)/fc;float ln=1.-clamp(dl-.35,0.,1.);float mj=step(mod(floor(hc+.5),5.),.5);
 col=mix(col,vec3(.24,.255,.28),ln*(mj>.5?.95:.55));
 float dr=abs(vW.x-path(vW.z));float fr=fwidth(vW.x)+fwidth(vW.z)*.3;float route=1.-smoothstep(.10,.10+fr*1.5,dr);
 col=mix(col,col*vec3(.80,.80,.82),(1.-smoothstep(.1,.6,dr))*(1.-route)*.6);
 float trav=uT*1.1+uS*12.;float rp=trav+16.;float pulse=exp(-pow((vW.z-rp)*.25,2.));
 col=mix(col,mix(RED,RED*1.18,pulse),route);
 float dd=length(vec2(dr,(vW.z-rp)*.7));col=mix(col,vec3(1.),1.-smoothstep(.42,.42+fr*1.5,dd));col=mix(col,RED*1.12,1.-smoothstep(.30,.30+fr*1.5,dd));
 float wp=mod(vW.z,26.)-13.;float wpd=length(vec2(dr,wp*.7));float pin=(1.-smoothstep(.26,.26+fr*1.5,wpd))*step(.5,mod(floor(vW.z/26.),2.));
 col=mix(col,GR,pin);col=mix(col,vec3(1.),pin*(1.-smoothstep(.10,.10+fr*1.5,wpd)));
 vec3 sky=vec3(.965,.968,.975);col=mix(sky,col,vF);gl_FragColor=fin(col);}`;
var FS_HOEHE_BG=HEAD+`void main(){vec2 uv=gl_FragCoord.xy/uR;float y=uv.y-uH;
 vec3 c=mix(vec3(.93,.935,.945),vec3(.985,.987,.99),smoothstep(0.,.5,y));c=mix(c,RED,smoothstep(.003,0.,abs(y-.002))*.85);gl_FragColor=fin(c);}`;

/* 4 Kettenstrom: drei echte Rollenketten (Innen-/Außenlaschen, Nieten, Rollen) in drei Tiefen, laufen mit Schatten */
FS.kette=HEAD+`
vec4 chain(vec2 p,float P,float y0,float a1,float f1,float ph,float spd,float red,float fwx){
 float tt=uT*.12;float y=y0+a1*sin(p.x*f1+ph+tt)+a1*.35*sin(p.x*f1*2.3+ph*1.7-tt);
 float dy=a1*f1*cos(p.x*f1+ph+tt)+a1*.35*f1*2.3*cos(p.x*f1*2.3+ph*1.7-tt);
 float v=(p.y-y)/sqrt(1.+dy*dy)/P;if(abs(v)>.7)return vec4(0.);float u=p.x/P-uT*spd-uS*14./P*.05;
 float fw=fwx/P;vec3 col=vec3(0.);float al=0.;float s=floor(u);
 for(int ps=0;ps<2;ps++){for(int j=-1;j<=1;j++){float k=s+float(j);float odd=mod(k,2.);
  if((ps==0&&odd>.5)||(ps==1&&odd<.5))continue;float lu=u-k-.5;float ou=ps==1?1.:0.;
  float rr=mix(.31,.36,ou);float d1=length(vec2(abs(lu)-.5,v))-rr;float d2=max(abs(v)-mix(.21,.25,ou),abs(lu)-.5);float d=min(d1,d2);
  float cv=aa(d,fw);if(cv<=0.)continue;float bev=smoothstep(0.,.07,-d);float lt=clamp(v/.3,-1.,1.);vec3 pc;
  if(ps==1){float m=.80+.14*lt+.04*sin(lu*3.);pc=red>.5?RED*(.52+.55*m):vec3(m*.93,m*.95,m);}
  else{float m=.38+.12*lt;pc=vec3(m,m*1.02,m*1.07);}
  pc*=.70+.30*bev;pc+=(1.-smoothstep(0.,.04,-d))*.10*max(lt,0.);
  for(int e=0;e<2;e++){float ce=e==0?-.5:.5;float pr=length(vec2(lu-ce,v));
   if(ps==1){float pin=aa(pr-.13,fw);pc=mix(pc,vec3(.80+.15*lt),pin);pc=mix(pc,pc*.55,aa(abs(pr-.135)-.016,fw)*.8);}
   else{pc=mix(pc,pc*.62,aa(abs(pr-.2)-.03,fw));}}
  col=mix(col,pc,cv);al=max(al,cv);}}
 return vec4(col,al);}
void main(){vec2 uv=gl_FragCoord.xy/uR;vec2 p=(gl_FragCoord.xy-.5*uR)/uR.y;float A=uR.x/uR.y;bool mob=A<1.;float px=1./uR.y;
 vec3 col=bgL(uv);vec2 m=(uM-.5);
 vec2 p3=p+m*.012+vec2(0.,uS*.10);vec2 p2=p+m*.025+vec2(0.,uS*.22);vec2 p1=p+m*.045+vec2(0.,uS*.40);
 float sc=mob?.8:1.;
 vec4 c3=chain(p3,.026*sc,mob?.36:.30,.05,3.,1.,.9,0.,px*1.4);col=mix(col,mix(col,c3.rgb,.55),c3.a);
 vec4 s2=chain(p2+vec2(-.008,.012),.045*sc,mob?.05:-.02,.08,2.2,4.,1.5,1.,px*7.);col*=1.-.18*s2.a;
 vec4 c2=chain(p2,.045*sc,mob?.05:-.02,.08,2.2,4.,1.5,1.,px*1.2);col=mix(col,c2.rgb,c2.a);
 vec4 s1=chain(p1+vec2(-.016,.024),.078*sc,mob?-.30:-.30,.11,1.5,2.5,2.4,0.,px*12.);col*=1.-.24*s1.a;
 vec4 c1=chain(p1,.078*sc,mob?-.30:-.30,.11,1.5,2.5,2.4,0.,px*1.1);col=mix(col,c1.rgb,c1.a);
 gl_FragColor=fin(col);}`;

/* 5 Windkanal: Potentialströmung um das Rad (Kreis = Bike-Kreis im Hero), Stromlinien mit wandernden Partikeln, rote Rauchspur, Wirbel im Nachlauf */
FS.wind=HEAD+`void main(){vec2 uv=gl_FragCoord.xy/uR;float A=uR.x/uR.y;vec2 q=vec2(uv.x*A,uv.y);
 vec2 O=uO.xy;float R=uO.z;vec2 x=(q-O)/R;float r2=dot(x,x);float sp=1.+min(abs(uV),3.)*1.5;
 float ir=1./max(r2,1.);float psi=x.y*(1.-ir);float phi=x.x*(1.+ir);
 float wake=smoothstep(.7,2.4,x.x)*exp(-x.y*x.y*.30);
 psi+=.30*wake*sin(x.x*2.1-uT*2.2*sp)*exp(-x.y*x.y*.6)+.16*wake*fbm(vec2(x.x*.7-uT*.8*sp,x.y*1.3));
 psi+=.035*fbm(q*2.5+vec2(-uT*.25,0.));
 float mx=(uM.x*A-O.x)/R,my=(uM.y-O.y)/R;float md=length(x-vec2(mx,my));psi+=.25*exp(-md*md*.8)*sin(md*3.-uT*3.);
 float kt=uT-uK.z;float kd=length(x-vec2(uK.x*A-O.x,uK.y-O.y)/R);psi+=step(0.,kt)*.5*exp(-kt*.9)*exp(-pow(kd-kt*3.,2.)*.8)*sin(kd*4.);
 float hs=psi/.17;float fh=max(fwidth(hs),1e-4);float dl=abs(fract(hs+.5)-.5)/fh;float ln=1.-clamp(dl-.45,0.,1.);float li=floor(hs+.5);
 float ds=fract(phi*.55-uT*.55*sp+h21(vec2(li,2.)));float dash=smoothstep(0.,.04,ds)*smoothstep(.42,.30,ds);
 vec3 col=bgL(uv);
 col*=1.-.05*exp(-(r2-1.)*.8)*step(1.,r2)*smoothstep(0.,-1.,x.x);
 float ln3=1.-clamp(dl-1.2,0.,1.);col=mix(col,vec3(.50,.52,.56),ln*.45);col=mix(col,vec3(.16,.17,.19),ln3*dash);
 float isr=step(abs(li),.5)+step(.84,h21(vec2(li,4.)))*step(1.5,abs(li));
 float wd=fh*(abs(li)<.5?2.6:1.6);float ln2=1.-clamp(dl-.45-(abs(li)<.5?1.2:.4),0.,1.);
 col=mix(col,mix(RDK,RED*1.15,.25+.75*dash),ln2*isr);
 col=mix(col,vec3(.94,.945,.955),aa(sqrt(r2)-1.,fh*.05+.01));
 gl_FragColor=fin(col);}`;

/* 6 Akku-Matrix: geneigte Ebene mit Rundzellen (Hülle, Deckel, Pluspol, Nickelband mit Schweißpunkten), rote Ladewelle */
FS.akku=HEAD+`void main(){vec2 uv=gl_FragCoord.xy/uR;vec2 p=(gl_FragCoord.xy-.5*uR)/uR.y;bool mob=uR.x<uR.y;
 vec3 rd=normalize(vec3(p,1.9));rd.yz=rot(.95+(uM.y-.5)*.12)*rd.yz;rd.xz=rot(.22+(uM.x-.5)*.25)*rd.xz;
 float H=mob?5.2:6.5;float t=H/max(-rd.y,.001);vec2 w=(vec3(0.,H,0.)+rd*t).xz*vec2(1.,1.)+vec2(uT*.35,uT*.22+uS*6.);
 float fw=max(fwidth(w.x)+fwidth(w.y),1e-4)*.7;
 vec2 s=vec2(1.,1.7320508);vec2 a=mod(w,s)-s*.5;vec2 b=mod(w-s*.5,s)-s*.5;vec2 gv=dot(a,a)<dot(b,b)?a:b;vec2 id=w-gv;float rho=length(gv);
 vec3 col=vec3(.17,.18,.20);
 float side=aa(length(gv+vec2(0.,.11))-.46,fw);col=mix(col,vec3(.30,.31,.34)-.10*smoothstep(.2,.46,-gv.y*1.),side);
 float hr=h21(id);vec3 sl=hr>.72?RED*.85:vec3(.40,.415,.45);
 float cap=aa(rho-.46,fw);float an=atan(gv.y,gv.x);
 float m=.78+.10*sin(an*2.+1.2)+.06*cos(an)*0.;vec3 cc=vec3(m,m*1.01,m*1.03);
 cc=mix(cc,sl*(.85+.25*sin(an+2.)),aa(.40-rho,fw));
 cc=mix(cc,cc*.62,aa(abs(rho-.33)-.012,fw));
 float nub=aa(rho-.14,fw);cc=mix(cc,vec3(.90+.08*sin(an+2.2)),nub);cc=mix(cc,cc*.7,aa(abs(rho-.14)-.008,fw));
 float chg=step(0.,sin(id.x*.22-uT*.9+id.y*.08));float pulse=.5+.5*sin(uT*4.+id.x);
 float led=aa(abs(rho-.37)-.02,fw)*chg;cc=mix(cc,mix(RDK,RED*1.15,.4+.6*pulse),led);
 vec3 mr=normalize(vec3((uM-.5)*vec2(uR.x/uR.y,1.),1.9));mr.yz=rot(.95+(uM.y-.5)*.12)*mr.yz;mr.xz=rot(.22+(uM.x-.5)*.25)*mr.xz;
 vec2 mw=(vec3(0.,H,0.)+mr*(H/max(-mr.y,.001))).xz+vec2(uT*.35,uT*.22+uS*6.);float near=1.-smoothstep(.6,2.2,length(id-mw));
 cc=mix(cc,RED*1.1,aa(abs(rho-.37)-.03,fw)*near);
 col=mix(col,cc,cap);
 float strip=aa(abs(gv.y)-.085,fw);float stc=.84+.06*sign(gv.y)*smoothstep(.06,.085,abs(gv.y));vec3 sc=vec3(stc,stc*1.01,stc*1.02);
 for(int i=0;i<4;i++){float fi=float(i);vec2 wpos=vec2((fi<2.?-.12:.12),(mod(fi,2.)<.5?-.035:.035));sc=mix(sc,sc*.72,aa(length(gv-wpos)-.018,fw));}
 col=mix(col,sc,strip*step(.5,mod(floor(id.y/s.y*2.+.25),2.)+.0));
 float fog=smoothstep(9.,30.,t);col=mix(col,vec3(.965,.968,.975),fog);
 gl_FragColor=fin(col);}`;

/* 7 Motor-Magnetfeld: Rotor mit 12 Magneten (N rot / S grau), Stator mit Nuten, Eisenfeilspäne zeigen das echte Dipolfeld */
FS.magnet=HEAD+`
vec2 O;float Rm,rA;
vec2 Bf(vec2 p){vec2 B=vec2(0.);for(int i=0;i<12;i++){float fi=float(i);float a=fi*.5235988+rA;vec2 c=O+Rm*.9*vec2(cos(a),sin(a));
 vec2 m=vec2(cos(a),sin(a))*(mod(fi,2.)*2.-1.);vec2 r=p-c;float l2=max(dot(r,r),.0004);float l=sqrt(l2);vec2 rh=r/l;B+=(3.*dot(m,rh)*rh-m)/(l2*l);}return B;}
void main(){vec2 uv=gl_FragCoord.xy/uR;float A=uR.x/uR.y;vec2 q=vec2(uv.x*A,uv.y);float px=1./uR.y;
 O=uO.xy;Rm=uO.z*.92;float kt=uT-uK.z;rA=uT*.30+uS*2.5+step(0.,kt)*3.*(1.-exp(-kt*.9));
 vec3 col=bgL(uv);float cs=A<1.?.026:.021;vec2 cid=floor(q/cs);vec2 cc=(cid+.5+(vec2(h21(cid),h21(cid+7.))-.5)*.5)*cs;
 vec2 B=Bf(cc);float mg=length(B);vec2 dr=B/max(mg,1e-6);float lm=clamp(log(mg*Rm*Rm*Rm+1e-6)*.22+.55,0.,1.);
 float hl=cs*(.30+.12*lm)*(.85+.15*sin(uT*2.+h21(cid)*6.));float dd=sdSeg(q,cc-dr*hl,cc+dr*hl)-px*(.55+.6*lm);
 float cv=aa(dd,px*1.1);float far=smoothstep(Rm*1.25,Rm*1.4,length(q-O));
 vec3 fc=lm>.80?mix(RDK,RED*1.12,smoothstep(.8,.95,lm)):vec3(.22,.235,.26);col=mix(col,fc,cv*(.30+.70*lm)*far);
 vec2 d=q-O;float rho=length(d)/Rm;float an=atan(d.y,d.x);float fw=px/Rm*1.2;float L=sin(an+.8);
 float st=aa(abs(rho-1.16)-.11,fw);float slot=step(.5,fract(an/6.2831853*24.))*step(rho,1.13);
 vec3 sc=vec3(.34+.10*L+.06*smoothstep(1.05,1.27,rho));sc=mix(sc,vec3(.16),slot*aa(abs(rho-1.10)-.05,fw));
 col=mix(col,sc,st);col=mix(col,vec3(.12),aa(abs(rho-1.025)-.02,fw));
 float ra=an-rA;float seg=fract(ra/6.2831853*12.);float pol=mod(floor(ra/6.2831853*12.),2.);
 float mag=aa(abs(rho-.90)-.10,fw)*aa(abs(seg-.5)-.44,fw*6.);vec3 mc=pol>.5?RED*(.75+.3*L):vec3(.62+.18*L);
 mc*=.82+.18*smoothstep(.80,.97,rho);col=mix(col,mc,mag);
 float core=aa(rho-.79,fw);float hole=aa(length(vec2((fract(ra/6.2831853*6.)-.5)*rho*1.05,rho-.52))-.11,fw);
 vec3 kc=vec3(.74+.14*L+.03*sin(rho*90.));col=mix(col,mix(kc,vec3(.18),hole),core);
 col=mix(col,vec3(.26+.08*L),aa(rho-.20,fw));col=mix(col,vec3(.86+.1*L),aa(rho-.08,fw));
 gl_FragColor=fin(col);}`;

/* 8 Getriebe: drei Ebenen kämmender Zahnräder (Übersetzung korrekt), Fenster, Fasen, Schlagschatten – wird in gears() erzeugt */
function gears(){
 var L=[{a:'uA0',m:.0062,f:.55,g:[[40,0],[18,-.5],[52,.75],[24,-.95],[36,.2]],w:.10},
        {a:'uA1',m:.0095,f:.80,g:[[56,0],[20,1.0],[44,-.25],[16,.6],[64,1.5]],w:.16},
        {a:'uA2',m:.0140,f:1.,g:[[48,0],[22,-.75],[60,.55],[18,1.25]],w:.24}];
 var code='',body='';
 L.forEach(function(l,li){var px=0,py=0,k=1,c=0,prev=null;
  l.g.forEach(function(g,gi){var N=g[0],R=l.m*N/2;
   if(prev){var b=g[1],Rp=l.m*prev.N/2;px+= (Rp+R)*Math.cos(b);py+=(Rp+R)*Math.sin(b);var rt=prev.N/N;var nk=-k*rt,nc=-c*rt+b*(1+rt)+Math.PI/N;k=nk;c=nc}
   prev={N:N};var mat=(li*7+gi*3)%5;var col=mat===1?'RED':(mat===3?'vec3(.36,.37,.40)':'vec3(.80,.81,.83)');
   body+=' gr(q-('+l.a+'+vec2('+px.toFixed(5)+','+py.toFixed(5)+')),'+N+'.,'+l.m.toFixed(5)+','+k.toFixed(6)+'*T+'+c.toFixed(6)+','+col+','+(mat===1?'1.':'0.')+','+l.f.toFixed(2)+',col);\n'})});
 return HEAD+`
float gD(vec2 p,float N,float m,float ro){float r=length(p);float a=atan(p.y,p.x)-ro;float Rp=m*N*.5;
 float f=fract(a*N/6.2831853);float t=abs(f-.5)*2.;float prof=smoothstep(.30,.62,t);float Rt=Rp-1.25*m+2.25*m*prof;float d=(r-Rt)*.8;
 d=max(d,-(r-Rp*.16));
 if(N>30.){float aw=fract((a)*5./6.2831853)-.5;float wd=max(abs(r-Rp*.54)-Rp*.20,(abs(aw)-.30)*6.2831853/5.*r);d=max(d,-wd+m*.0);}
 return d;}
void gr(vec2 p,float N,float m,float ro,vec3 mc,float isRed,float fade,inout vec3 col){
 float px=1./uR.y;float ds=gD(p-vec2(-.006,.010)*fade,N,m,ro);col*=1.-.22*fade*aa(ds,px*10.*fade+.004);
 float dw=gD(p+vec2(-.0030,.0045)*fade,N,m,ro);col=mix(col,mix(vec3(.93),(isRed>.5?RDK*1.3:mc*.48),fade*.75+.25),aa(dw,px*1.1));
 float d=gD(p,N,m,ro);float cv=aa(d,px*1.1);vec2 g=vec2(dFdx(d),dFdy(d));if(cv<=0.)return;
g=g/max(length(g),1e-6);float be=1.-smoothstep(0.,m*1.3,-d);
 float r=length(p);float L=dot(g,normalize(vec2(-.55,.85)));
 vec3 c=isRed>.5?RED*(.62+.25*(p.y/(m*N))):mc*(1.+.06*sin(r*700.))+(p.y/(m*N))*.08;
 c+=be*.28*L;c*=1.-.25*be*(L<0.?-L:0.);
 col=mix(col,mix(vec3(.93,.935,.945),c,fade*.75+.25),cv);}
void main(){vec2 uv=gl_FragCoord.xy/uR;float A=uR.x/uR.y;vec2 q=vec2(uv.x*A,uv.y);float kt=uT-uK.z;
 float T=uT*.22+uS*3.+step(0.,kt)*2.5*(1.-exp(-kt*.8));vec3 col=bgL(uv);
`+body+` gl_FragColor=fin(col);}`}
FS.getriebe=gears();

/* 9 Reifen: Raymarching eines Stollenreifens (Torus + versetzte Stollen), rote Felge, Abdruck-Spur am Boden */
FS.reifen=HEAD+`
float RT=1.75,rt=.40,SP;float MID;
float map(vec3 p){float ry=length(p.yz);vec2 tq=vec2(ry-RT,p.x);float d=length(tq*vec2(1.,1.18))-rt;
 float phi=atan(p.z,p.y)+SP;float psi=atan(p.x*1.18,ry-RT);
 float row=floor(psi*2.2+.5);vec2 c=vec2(phi*46./6.2831853+row*.5,psi*2.2+.5);vec2 g=fract(c)-.5;
 float kb=max(abs(g.x)-.27,abs(g.y)-.30);float kh=.07*smoothstep(.03,-.03,kb)*step(abs(psi),1.2);
 d-=kh;MID=0.;float dr=length(vec2(ry-(RT-rt*.95),p.x))-.13;if(dr<d){d=dr;MID=1.;}return d*.75;}
vec3 nor(vec3 p){vec2 e=vec2(.002,-.002);return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));}
void main(){vec2 uv=gl_FragCoord.xy/uR;vec2 p=(gl_FragCoord.xy-.5*uR)/uR.y;bool mob=uR.x<uR.y;float kt=uT-uK.z;
 SP=uT*.35+uS*3.+step(0.,kt)*3.*(1.-exp(-kt*.8));
 vec3 ro=mob?vec3(-2.4,-.5,-6.4):vec3(-2.9,-.7,-5.6);vec3 ta=vec3(.15,-.55,0.);ro.x+=(uM.x-.5)*.6;ro.y+=(uM.y-.5)*.5;
 vec3 ww=normalize(ta-ro),uu=normalize(cross(ww,vec3(0.,1.,0.))),vv=cross(uu,ww);vec2 pq=p-(mob?vec2(.05,-.18):vec2(.58,-.02));vec3 rd=normalize(pq.x*uu+pq.y*vv+1.9*ww);
 float gy=-RT-rt;float tg=rd.y<0.?(gy-ro.y)/rd.y:1e9;
 vec3 col=bgL(uv);float t=0.;float hit=0.;float b=dot(ro,rd);float cc=dot(ro,ro)-pow(RT+rt+.15,2.);float disc=b*b-cc;
 if(disc>0.){t=max(-b-sqrt(disc),0.);float tmax=-b+sqrt(disc);for(int i=0;i<90;i++){vec3 pp=ro+rd*t;float d=map(pp);if(d<.0015){hit=1.;break;}t+=d;if(t>tmax)break;}}
 if(tg<1e8&&(hit<.5||tg<t)){vec3 gp=ro+rd*tg;float tz=gp.z+SP*RT;float tr=step(abs(gp.x),rt*.9)*step(gp.z,-.2);
  float im=aa(max(abs(fract(tz*46./(6.2831853*RT))-.5)-.24,abs(fract(gp.x*2.2/rt*.5+.5)-.5)-.30),.06)*tr;
  vec3 gc=vec3(.90,.905,.915);gc=mix(gc,gc*.80,im*smoothstep(-14.,-.5,gp.z));
  float sh=exp(-length(vec2(gp.x*1.2,gp.z*.9))*1.4);gc*=1.-.45*sh;col=mix(col,gc,smoothstep(40.,8.,tg));}
 if(hit>.5){vec3 pp=ro+rd*t;vec3 n=nor(pp);vec3 Ld=normalize(vec3(-.5,.8,-.4));float dif=clamp(dot(n,Ld),0.,1.);
  float fr=pow(1.-clamp(dot(n,-rd),0.,1.),3.);float spc=pow(clamp(dot(reflect(rd,n),Ld),0.,1.),24.);
  float ry=length(pp.yz);float psi=atan(pp.x*1.18,ry-RT);
  vec3 c;if(MID>.5){c=RED*(.45+.6*dif)+spc*.35;}
  else{float k=.11+.10*dif+.25*fr+.10*spc;c=vec3(k,k,k*1.05);float band=aa(abs(abs(psi)-1.42)-.05,.02);c=mix(c,RED*(.5+.5*dif),band);}
  col=c;}
 gl_FragColor=fin(col);}`;

/* 10 Speichen-Moiré: zwei Laufräder mit tangential gekreuzten Speichen überlagert, drehen gegenläufig – Interferenzmuster entsteht */
FS.moire=HEAD+`
float spokes(vec2 d,float N,float sp,float hub,float px){float r=length(d);if(r<hub*1.05)return 0.;float a=atan(d.y,d.x);float off=acos(clamp(hub/r,0.,1.));
 float w=px*.55;float l=0.;for(int s=0;s<2;s++){float aa2=a+(s==0?off:-off);float f=fract((aa2/6.2831853+sp)*N);float dd=min(f,1.-f)/N*6.2831853*sqrt(max(r*r-hub*hub,0.));l=max(l,aa(dd-w,px*1.1));}return l;}
void main(){vec2 uv=gl_FragCoord.xy/uR;float A=uR.x/uR.y;vec2 q=vec2(uv.x*A,uv.y);bool mob=A<1.;float px=1./uR.y;
 vec2 c1=mob?vec2(A*.30,.20):vec2(A*.62,.46);vec2 c2=c1+(mob?vec2(.34,.02):vec2(.40,.05))+vec2(.03*sin(uT*.21),.02*cos(uT*.17))+(uM-.5)*.06;
 float Rw=mob?.27:.40;float kt=uT-uK.z;float boost=step(0.,kt)*.15*(1.-exp(-kt));
 vec3 col=bgL(uv);
 vec2 d1=q-c1,d2=q-c2;float r1=length(d1),r2=length(d2);
 float l1=spokes(d1,36.,uT*.012+uS*.25+boost,.035,px)*step(r1,Rw*.93);float l2=spokes(d2,36.,-uT*.010-uS*.2-boost,.035,px)*step(r2,Rw*.93);
 col=mix(col,vec3(.24,.255,.28),l1*.85);col=mix(col,RED,l2*.92);
 for(int k=0;k<2;k++){vec2 dd=k==0?d1:d2;float rr=length(dd);float L=sin(atan(dd.y,dd.x)+.8);vec3 rc=k==0?vec3(.55+.18*L):RED*(.7+.25*L);
  col=mix(col,rc,aa(abs(rr-Rw*.955)-Rw*.03,px*1.2));col=mix(col,vec3(.16+.06*L),aa(abs(rr-Rw*1.04)-Rw*.055,px*1.2));
  col=mix(col,vec3(.30+.1*L),aa(rr-.045,px*1.2));col=mix(col,vec3(.85),aa(rr-.018,px*1.2));}
 gl_FragColor=fin(col);}`;

/* ---------- Motor ---------- */
var cv,gl,P={},buf,gB,gI,gN=0,gLn=0,W=0,H=0,dpr=1,t0=performance.now(),M=[.6,.6],Mt=[.6,.6],K=[0,0,-99],sc=0,scP=0,vel=0,O=[1,.45,.3],oT=0,raf=0;
var SCALE={ritzel:.85,laufrad:.85,hoehe:1,kette:.8,wind:.8,akku:.85,magnet:.9,getriebe:.8,reifen:.6,moire:1};
function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o}
function prog(v,f){var p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));var u={};['uR','uT','uS','uV','uM','uK','uO','uH','uA0','uA1','uA2'].forEach(function(n){u[n]=gl.getUniformLocation(p,n)});return{p:p,u:u}}
function get(k){if(P[k])return P[k];P[k]=k==='hmesh'?prog(VS_HOEHE,FS_HOEHE):k==='hbg'?prog(VQ,FS_HOEHE_BG):prog(VQ,FS[k]);return P[k]}
function grid(){var nx=200,nz=140,v=new Float32Array(nx*nz*2),i=0,x,z;for(z=0;z<nz;z++)for(x=0;x<nx;x++){v[i++]=(x/(nx-1)-.5)*70;v[i++]=Math.pow(z/(nz-1),1.35)*78}
 gB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,gB);gl.bufferData(gl.ARRAY_BUFFER,v,gl.STATIC_DRAW);gN=nx*nz;
 var ix=[];for(z=0;z<nz-1;z++)for(x=0;x<nx-1;x++){var a=z*nx+x;ix.push(a,a+1,a+nx,a+1,a+nx+1,a+nx)}
 gI=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gI);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(ix),gl.STATIC_DRAW);gLn=ix.length}
function size(){var big=innerWidth*innerHeight>1.4e6;dpr=Math.min(devicePixelRatio||1,mode==='hoehe'?2:1.5)*(SCALE[mode]||.8)*(big?.85:1);
 var w=Math.round(cv.clientWidth*dpr),h=Math.round(cv.clientHeight*dpr);if(w!==W||h!==H){W=cv.width=w;H=cv.height=h}}
function findO(){var A=innerWidth/innerHeight,mob=A<1,o=mob?[A*.5,.36,.24]:[A*.735,.45,.29];
 var e=document.querySelector('section.view.enter .hring');if(e){var r=e.getBoundingClientRect();if(r.width>50&&r.bottom>0&&r.top<innerHeight)o=[(r.left+r.width/2)/innerHeight,1-(r.top+r.height/2)/innerHeight,Math.min(r.width,r.height)/2/innerHeight*.96]}
 return o}
function uni(o,t){var u=o.u,A=W/H,mob=A<1;gl.uniform2f(u.uR,W,H);gl.uniform1f(u.uT,t);gl.uniform1f(u.uS,sc);gl.uniform1f(u.uV,vel);gl.uniform2f(u.uM,M[0],M[1]);gl.uniform3f(u.uK,K[0],K[1],K[2]);
 gl.uniform3f(u.uO,O[0],O[1],O[2]);
 if(u.uA0){var sy=sc,m0=(M[0]-.5),m1=(M[1]-.5);
  if(mob){gl.uniform2f(u.uA0,A*.15+m0*.01,.80+sy*.10);gl.uniform2f(u.uA1,A*.80+m0*.02,.10+sy*.22);gl.uniform2f(u.uA2,A*.70+m0*.035,.40+sy*.4)}
  else{gl.uniform2f(u.uA0,A*.66+m0*.012,.86+sy*.10+m1*.01);gl.uniform2f(u.uA1,A*1.02+m0*.025,.16+sy*.22+m1*.02);gl.uniform2f(u.uA2,A*.93+m0*.045,.60+sy*.4+m1*.035)}}}
function quad(){gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0)}
var lt=0;
function frame(){raf=requestAnimationFrame(frame);size();var now=performance.now(),t=(now-t0)/1000,dt=Math.min(.1,(now-lt)/1000||.016);lt=now;
 M[0]+=(Mt[0]-M[0])*.05;M[1]+=(Mt[1]-M[1])*.05;var tgt=scrollY/innerHeight;var ns=sc+(tgt-sc)*.12;vel+=((ns-sc)/dt-vel)*.1;sc=ns;
 if(now-oT>250){oT=now;O=findO()}
 gl.viewport(0,0,W,H);
 if(mode==='hoehe'){var hz=innerWidth<720?.84:.80+(M[1]-.5)*.03;var b=get('hbg');gl.useProgram(b.p);uni(b,t);gl.uniform1f(b.u.uH,hz);quad();gl.disable(gl.DEPTH_TEST);gl.drawArrays(gl.TRIANGLES,0,3);
  var o=get('hmesh');gl.useProgram(o.p);uni(o,t);gl.uniform1f(o.u.uH,hz);gl.enable(gl.DEPTH_TEST);gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.bindBuffer(gl.ARRAY_BUFFER,gB);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gI);gl.drawElements(gl.TRIANGLES,gLn,gl.UNSIGNED_SHORT,0);gl.disable(gl.DEPTH_TEST);return}
 var p=get(mode);gl.useProgram(p.p);uni(p,t);quad();gl.drawArrays(gl.TRIANGLES,0,3)}
function click(e){if(e.target.closest&&e.target.closest('#ueSw'))return;K=[e.clientX/innerWidth,1-e.clientY/innerHeight,(performance.now()-t0)/1000]}
function prep(){try{if(mode==='hoehe'){get('hbg');get('hmesh')}else get(mode)}catch(err){console.error('hg4',mode,err.message)}}
function init(){cv=document.createElement('canvas');cv.id='hg';cv.setAttribute('aria-hidden','true');document.body.insertBefore(cv,document.body.firstChild);
 gl=cv.getContext('webgl',{antialias:true,alpha:false,premultipliedAlpha:false,powerPreference:'high-performance'});
 if(!gl){cv.remove();de.classList.remove('hg3');return}gl.getExtension('OES_standard_derivatives');
 buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);grid();
 addEventListener('pointermove',function(e){Mt=[e.clientX/innerWidth,1-e.clientY/innerHeight]},{passive:true});
 addEventListener('pointerdown',click,{passive:true});
 cv.addEventListener('webglcontextlost',function(e){e.preventDefault();cancelAnimationFrame(raf)});
 cv.addEventListener('webglcontextrestored',function(){P={};buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);grid();prep();frame()});
 prep();frame();sw()}

/* ---------- Umschalter ---------- */
function sw(){var b=document.createElement('div');b.id='ueSw';b.setAttribute('role','group');b.setAttribute('aria-label','Hintergrund wählen');
 b.innerHTML='<span class="ue-k">Hintergrund</span>'+MODES.map(function(m,i){return'<button type="button" data-hg="'+m[0]+'" aria-pressed="false"><b>'+(i+1)+'</b><span>'+m[1]+'<small>'+m[2]+'</small></span></button>'}).join('');
 document.body.appendChild(b);
 function up(){[].forEach.call(b.querySelectorAll('button'),function(x){var on=x.dataset.hg===mode;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on))})}
 b.addEventListener('click',function(e){var x=e.target.closest('button');if(!x)return;mode=x.dataset.hg;W=0;try{localStorage.setItem('vc_hg4',mode)}catch(_){}prep();up();tip()});
 var tt=0;function tip(){var n=document.getElementById('ueTip');if(!n){n=document.createElement('div');n.id='ueTip';document.body.appendChild(n)}
  var i=MODES.findIndex(function(m){return m[0]===mode}),m=MODES[i];n.innerHTML='<b>'+(i+1)+' · '+m[1]+'</b> – '+m[2];n.classList.remove('on');void n.offsetWidth;n.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){n.classList.remove('on')},2800)}
 up();setTimeout(tip,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* 3 · 3D-Titan-Lettern: jeder Buchstabe ist ein massiver 3D-Körper (aus dem Distanzfeld extrudiert, Raymarching pro Pixel).
   Torsionswellen laufen durch das Band und drehen die Schrift einmal komplett um die eigene Achse – dabei sieht man die
   rot glühenden Flanken. Front satiniertes Titan mit Licht, Schatten und Spiegelung. Maus = Buchstaben neigen sich zum Zeiger. */
(function(){
var FS='precision highp float;uniform vec2 uR,uM;uniform float uS,uO,uT,uV,uOv,uD;\n'+LBG.GLSL+'\
const float DZ=6.5;\
float ang(float x){float sx=x/uR.x,a=0.;for(int i=0;i<2;i++){float fi=float(i);float c=fract(uT*(.075+fi*.031)*(1.+uV*.8)+fi*.5)*1.6-.3;\
 a+=6.2831853*smoothstep(c-.07,c+.07,sx)*(fi<.5?1.:-1.);}\
 float dm=(x-uM.x)/uD;a+=uOv*1.05*exp(-dm*dm/9000.)*sign(dm+.001)*min(1.,abs(dm)/40.);return a;}\
float sdf(vec3 p,float a,out vec3 o){float c=cos(a),s=sin(a);o=vec3(p.x,c*p.y+s*p.z,-s*p.y+c*p.z);\
 float d2=tx(o.xy).x;float dz=abs(o.z)-DZ;return min(max(d2,dz),0.)+length(max(vec2(d2,dz),0.))-.6;}\
void main(){vec2 p=gl_FragCoord.xy;float a=ang(p.x);float qx=(p.x+uO)*uS,qy=(p.y-uR.y*.5)*uS;\
 float yy=(p.y-uR.y*.5)/(uR.y*.5);float ay=abs(yy);\
 vec3 bgc=vec3(.016,.016,.02)+vec3(.03,.03,.036)*(1.-ay);bgc+=vec3(1.,.07,.1)*exp(-pow((ay-.985)/.012,2.))*1.1;\
 bgc+=vec3(1.,.08,.1)*exp(-pow(yy/.05,2.))*.025;\
 vec2 tb=tx(vec2(qx,-qy));bgc+=vec3(1.,.08,.1)*exp(-max(tb.x,0.)/7.)*.10*(.4+.6*abs(sin(a)));\
 vec3 col=bgc;float hit=0.;\
 if(abs(qy)<uSP+DZ+22.){vec3 ro=vec3(qx,-qy,30.),rd=vec3(0.,0.,-1.);float z=0.;vec3 o;float m=1e3;\
  for(int i=0;i<56;i++){vec3 q=ro+rd*z;float d=sdf(q,a,o);m=min(m,d);if(d<.08){hit=1.;break;}z+=max(d*.72,.05);if(z>60.)break;}\
  if(hit>0.){vec3 q=ro+rd*z;vec2 e=vec2(.35,0.);vec3 o1;float d0=sdf(q,a,o);\
   vec3 n=normalize(vec3(sdf(q+e.xyy,a,o1)-sdf(q-e.xyy,a,o1),sdf(q+e.yxy,a,o1)-sdf(q-e.yxy,a,o1),sdf(q+e.yyx,a,o1)-sdf(q-e.yyx,a,o1)));\
   float c=cos(a),s=sin(a);vec3 nl=vec3(n.x,c*n.y+s*n.z,-s*n.y+c*n.z);float side=1.-smoothstep(.55,.85,abs(nl.z));\
   vec3 L=normalize(vec3(-.35,-.75,.6));vec3 H=normalize(L+vec3(0.,0.,1.));float df=max(0.,dot(n,L));float sp=pow(max(0.,dot(n,H)),48.);\
   vec3 ml=normalize(vec3(vec2(uM.x-p.x,p.y-uM.y)/uD*.012,.9));float msp=pow(max(0.,dot(n,normalize(ml+vec3(0.,0.,1.)))),70.)*uOv;\
   float red=tx(o.xy).y;vec3 base=mix(vec3(.92,.94,.98),vec3(1.,.13,.16),red);\
   float br=.82+.18*sin(o.x*1.9+o.y*.3);vec3 face=base*(.55+.5*df)*br+vec3(1.)*sp*.75+vec3(1.,.8,.8)*msp*.9;\
   face+=vec3(.6,.65,.75)*pow(max(0.,-n.y),3.)*.25;\
   float ed=smoothstep(-.9,-.1,d0);vec3 flank=vec3(1.,.07,.09)*(.65+.55*df)+vec3(1.,.55,.5)*sp*.6;\
   col=mix(face,flank,side);col+=vec3(1.,.1,.12)*side*.25;col*=.9+.1*ed;}\
  else col+=vec3(1.,.07,.1)*exp(-m*.35)*.22;}\
 float al=smoothstep(1.,.975,ay);gl_FragColor=vec4(col*al,al);}';
LBG.add('3D-Titan-Lettern','Echte 3D-Buchstaben (Raymarching), Torsionswellen, rot glühende Flanken',{cls:'lbY3',fs:FS,dpr:1.25});
})();

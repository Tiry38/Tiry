/* 2 · Hyperloop-Glasröhre: eine massive Glasröhre über die ganze Breite. Sie bricht den echten Herbst-Hintergrund dahinter
   (Bild steht Kopf wie in einem Glasstab, mit Farbzerlegung an den Rändern). Im Vakuum-Kern schwebt die Schrift auf einem
   gewölbten Innenzylinder; rote Licht-Kapseln rasen durch die Röhre und beleuchten die Buchstaben. Maus = Flüssig-Linse. */
(function(){var IM=null,IT=null,IOK=false;
var FS='precision highp float;uniform vec2 uR,uM;uniform float uS,uO,uT,uV,uOv,uD;uniform sampler2D uBg;uniform vec4 uCv,uBx;uniform float uBk;\n'+LBG.GLSL+'\
vec3 bg(vec2 s){vec2 u=(s-uCv.xy)/uCv.zw;return texture2D(uBg,clamp(u,.001,.999)).rgb;}\
void main(){vec2 p=gl_FragCoord.xy;float yy=(p.y-uR.y*.5)/(uR.y*.5);float ay=abs(yy);if(ay>=1.){gl_FragColor=vec4(0.);return;}\
 float nz=sqrt(1.-yy*yy);float sx=p.x/uR.x;vec2 sc=vec2(uBx.x+p.x/uD,uBx.y+uBx.w*.5);float hc=uBx.w;\
 vec3 col;float k=1.55+.25*nz;\
 col.r=bg(sc+vec2(0.,yy*hc*k*1.04)).r;col.g=bg(sc+vec2(0.,yy*hc*k)).g;col.b=bg(sc+vec2(0.,yy*hc*k*.96)).b;\
 col=mix(col,vec3(dot(col,vec3(.3,.5,.2))),.35);\
 float core=smoothstep(.86,.80,ay);col*=mix(.62,.20,core);col+=vec3(.010,.010,.014);\
 float pl=0.,pc=0.;for(int i=0;i<4;i++){float fi=float(i);float sp=.42+fi*.13+uV*.6;float c=fract(-uT*sp*.5+fi*.29)*1.5-.25;float d=sx-c;\
  float hd=exp(-d*d*2600.);float tl=d>0.?exp(-d*7.):0.;float w=hd*1.2+tl*.55;pl+=w*exp(-yy*yy*9.);pc+=w*exp(-pow((ay-.9)/.05,2.))*.6;}\
 float yi=clamp(yy/.80,-1.,1.);float ty=asin(yi)*.80*uR.y*.5;vec2 q=vec2((p.x+uO)*uS,-ty*uS);\
 vec2 m=uM;float g=exp(-pow(length((p-m)/uD)/62.,2.))*uOv;q.x=((m.x+uO)*uS)+(q.x-(m.x+uO)*uS)/(1.+.75*g);q.y/=(1.+.75*g);\
 vec2 t=tx(q);float px=uS/(1.+.75*g);float f=clamp(.5-t.x/(px*1.15),0.,1.)*core;float gl=exp(-max(t.x,0.)/5.)*core;\
 float sh=.62+.38*pow(nz,.7);vec3 tc=mix(vec3(.97,.98,1.),vec3(1.,.14,.17),t.y)*sh;\
 col+=vec3(1.,.08,.1)*gl*(.10+pl*.9)*(1.-f);col=mix(col,tc+vec3(1.,.25,.25)*pl*.55,f);\
 col+=vec3(1.,.09,.11)*pl*.55*(1.-f)+vec3(1.,.75,.75)*pow(pl,3.)*.25+vec3(1.,.1,.12)*pc;\
 col+=vec3(1.)*exp(-pow((yy-.60)/.045,2.))*(.55+.25*sin(sx*9.-uT*.7))+vec3(1.)*exp(-pow((yy-.86)/.03,2.))*.35;\
 col+=vec3(.85,.9,1.)*exp(-pow((yy+.66)/.06,2.))*.12+vec3(1.,.08,.1)*exp(-pow((yy+.93)/.035,2.))*.9;\
 col+=vec3(1.,.9,.9)*g*.10+vec3(1.)*pow(max(0.,1.-length((p-m-vec2(-14.,16.)*uD)/uD)/9.),2.)*uOv*.8*smoothstep(.95,.7,ay);\
 col*=mix(1.,.35,smoothstep(.93,1.,ay));float a=smoothstep(1.,.965,ay);gl_FragColor=vec4(col*a,a);}';
LBG.add('Hyperloop-Glasröhre','Echte Lichtbrechung des Hintergrunds, rote Licht-Kapseln, Maus = Flüssig-Linse',{cls:'lbY2',fs:FS,dpr:1.5,
 init:function(R){var gl=R.gl;IT=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,IT);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([70,50,40,255]));
  [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER].forEach(function(p){gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR)});
  [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(function(p){gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE)});
  IM=new Image();IM.onload=function(){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,IT);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,IM);IOK=true};
  IM.src=(window.HG12_BASE||'img/hg12/')+(window.HG12_MODE||'herbst')+'-1400.webp'},
 frame:function(R,st,dt,W,H,d,r){var gl=R.gl,U=R.U,vw=innerWidth,vh=innerHeight,iw=IOK?IM.naturalWidth:16,ih=IOK?IM.naturalHeight:9,s=Math.max(vw/iw,vh/ih);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,IT);gl.uniform1i(U('uBg'),1);
  gl.uniform4f(U('uCv'),(vw-iw*s)*.5,(vh-ih*s)*.55,iw*s,ih*s);gl.uniform4f(U('uBx'),r.left,r.top,r.width,r.height)}});
})();

/* Vorlage „Herbst, Wein & Polarlicht“ (Tiry 21.11.2026: „nochmal 3 andere … so viel Auswahl wie möglich“ + „noch mehr Innovation in die Hintergründe“).
   Drei große, echte Landschaften mit Straße (Unsplash-Lizenz, frei auch gewerblich), ohne Fahrräder, Personen, Fahrzeuge.
   Neu gegenüber hg10/hg11:
   - Kino-Schärfe: die Kamera stellt live auf die Tiefe unter der Maus scharf (Tiefenunschärfe aus der KI-Tiefenkarte).
   - Wolkenschatten ziehen über das Gelände.
   - Herbstallee: Laub fällt in echter 3D-Tiefe (verschwindet hinter näheren Bäumen), die Maus ist Wind; Lichtstrahlen fallen durch den Dunst.
   - Weinberg: Scrollen = der Tag läuft ab (Morgen → Mittag → Goldene Stunde → Dämmerung), Sonne wandert, Licht färbt sich.
   - Island: Scrollen = es wird Nacht, Sterne gehen auf, rot-weißes Polarlicht wogt über den Bergen.
   Daten je Szene: <name>-2400/1400.webp, <name>-d.png (R Tiefe, G Himmel, B Wolken/Dunst), <name>-m.png (R Pflanzen, G Wasser, B frei). */
(function(){
var MODES=[['herbst','Herbstallee','Laub fällt in 3D, Maus = Wind'],['wein','Weinberg','Scrollen = der Tag vergeht'],['island','Hochland','Scrollen = Polarlicht-Nacht']];
/* je Szene: ty = Kamera schwenkt beim Scrollen, Fokus (Bild-x, Bild-y von unten), Spiegeln, Fokus-Ebene, Wolken (Stärke, Tempo), Wasser (Weg, Tempo), Sonne (x,y von unten; z = Stärke),
   fg = Dunst, sn/sz/sc = Teilchen (Stärke/Größe/Farbe), ld = Laub mit 3D-Verdeckung + Maus-Wind, df = Kino-Schärfe, gr = Lichtstrahlen, cs = Wolkenschatten, dy = Tageslauf, nt = Polarlicht-Nacht */
var CFG={herbst:{ty:[0,-.04],fxm:.50,fx:.50,fy:.55,fl:0,fp:.20,am:.030,sp:.012,wf:[0,0],sun:[.50,.66,.20],fg:1.6,sn:.95,sz:2.2,sc:[.92,.46,.12],ld:1,df:-1,gr:.30,cs:0,dy:0,nt:0},
 wein:{ty:[.02,-.05],fxm:.70,fx:.52,fy:.50,fl:0,fp:.25,am:.060,sp:.016,wf:[0,0],sun:[.62,.90,.18],fg:1,sn:0,ld:0,df:1,gr:0,cs:.42,dy:1,nt:0},
 island:{ty:[.02,-.04],fxm:.62,fx:.50,fy:.50,fl:1,fp:.30,am:.055,sp:.014,wf:[0,0],sun:[.40,.85,.10],fg:1.2,sn:0,ld:0,df:1,gr:0,cs:.32,dy:0,nt:1}};
var BASE=(window.HG12_BASE||'img/hg12/');
var mode=window.HG12_DEFAULT||'herbst';
var FEST=window.HG12_FEST;if(FEST)mode=FEST;else try{var q=new URLSearchParams(location.search).get('hg');if(q)mode=q;else{var s0=localStorage.getItem('vc_hg12');if(s0)mode=s0}}catch(e){}
if(!MODES.some(function(m){return m[0]===mode}))mode='herbst';window.HG12_MODE=mode;
var de=document.documentElement;

var FSRC=`#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 uR,uM,uFoc,uImg;uniform vec2 uTy,uWf;uniform float uFg,uSn,uSz,uLd,uDf,uGr,uCs,uDy,uNt;uniform vec3 uSc;uniform float uT,uS,uFl,uFp,uAm,uSp,uFade,uV;uniform vec3 uK,uSun,uPo;
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
 float zoom=1.10+min(uS,3.)*.09+uPo.z+.025*sin(uT*.15);
 vec2 s=A>iA?vec2(1.,iA/A):vec2(A/iA,1.);s/=zoom;s=min(s,vec2(.90));/* Rand für Parallaxe, nie über die Fotokante */
 vec2 pan=(uM-.5)*vec2(.045,.020)+uPo.xy*1.6+vec2(sin(uT*.13),sin(uT*.097+1.))*vec2(.010,.004);
 vec2 c=clamp(uFoc+pan+uTy*min(uS,2.2),s*.5+.05,1.-s*.5-.05);vec2 p=c+(uv-.5)*s;
 /* Kamera: Maus + ruhiges Schweben, Scrollen = Fahrt ins Bild (nahe Dinge wachsen schneller) */
 vec2 cam=(uM-.5)*vec2(.034,.014)+vec2(sin(uT*.13),sin(uT*.097+1.))*vec2(.006,.002);
 float dol=min(uS,3.)*.045+.010*sin(uT*.19);
 vec2 q=p;for(int i=0;i<6;i++){float d=D(q).r;q=c+(p-c)/(1.+dol*(d-uFp))+cam*(d-uFp);}q=clamp(q,.003,.997);
 vec3 dat=D(q);float d=dat.r,sky=dat.g,fm=dat.b;
 /* Wind im Gras/Büschen (Böen laufen übers Bild) + Wasser kräuselt */
 vec3 mk3=texture2D(uE,fl(q)).rgb;vec2 mk=mk3.rg;
 float gust=.35+.65*smoothstep(-.2,1.,sin(uT*.7-q.x*5.)*.5+.5);
 q.x+=mk.r*(.4+.6*d)*gust*(sin(uT*2.6+q.y*55.+nz(q*9.)*6.)*.0021+sin(uT*1.1+q.x*7.)*.0012);
 q.y+=mk.g*(sin(q.y*1100.-uT*2.4+q.x*35.)*.0006+(nz(vec2(q.x*70.,q.y*420.-uT*1.6))-.5)*.0016);
 /* Fließen (Cinemagraph): zwei phasenversetzte Proben, weich überblendet – Wolken/Nebel ziehen endlos */
 vec2 dir=vec2(1.,.12*sin(q.x*9.+uT*.1))*(.55+.45*nz(q*4.+uT*.02));
 float f1=fract(uT*uSp),f2=fract(uT*uSp+.5);float wv=abs(1.-2.*f1);
 vec2 o=dir*uAm*fm;
 vec2 s1=q-o*f1,s2=q-o*f2;
 float ok=(1.-smoothstep(.06,.14,max(D(s1).r,D(s2).r)))*(1.-smoothstep(.06,.14,d));
 ok*=smoothstep(.55,.95,min(min(D(s1).g,D(s2).g),sky));
 vec3 base=P(q);
 if(uDf!=0.){vec2 pm=c+(uM-.5)*s;float fd=(D(pm).r*2.+D(pm+vec2(.02,0)).r+D(pm-vec2(.02,0)).r+D(pm+vec2(0,.02)).r+D(pm-vec2(0,.02)).r)/6.;
  float rb=abs(uDf)*.0024*smoothstep(.10,.55,abs(d-fd))*(1.-sky);if(uDf<0.)rb*=smoothstep(fd,fd+.08,d);
  if(rb>.0002){vec3 acc=base;float ga=2.39996;for(int i=0;i<10;i++){float fi=float(i)+.5;float rr2=sqrt(fi/10.)*rb;vec2 off=vec2(cos(fi*ga),sin(fi*ga))*rr2*vec2(1.,iA);acc+=P(q+off);}base=acc/11.;}}
 vec3 col=mix(base,mix(P(s1),P(s2),1.-wv),ok);
 /* Herbstallee (Tiry 22.11.2026): Scrollen = die Straße wird nass – Pfützen bilden sich von hinten nach vorne,
    darin spiegeln sich die goldenen Bäume und das Licht, leicht gekräuselt. Das Foto selbst wird nicht verschoben. */
 if(uLd>.5&&q.y<.39&&uS>.001){float vx=.497,n0=max((.6164-q.y)*1.647,.05),z0=1./n0,xw=(q.x-vx)*z0;
  float wet=clamp(uS/1.6,0.,1.);
  float far=(q.y)/.385;
  float wm=smoothstep(0.,.35,wet*1.35-(1.-far)*.9)*(1.-smoothstep(.372,.388,q.y));
  float pn=fbm(vec2(xw*2.6,z0*1.9))*.7+fbm(vec2(xw*7.,z0*5.5))*.3;
  float pud=smoothstep(.62-.22*wet,.70-.22*wet,pn);
  float rip=sin(z0*38.-uT*2.2+fbm(vec2(xw*4.,z0*3.)+uT*.05)*6.)*.0016*(.4+.6*n0);
  vec2 rq=vec2(q.x+rip,.385+(.385-q.y)*1.05+rip*.6);
  vec3 rf=P(clamp(rq,.003,.997));
  float fres=.35+.45*(1.-n0);
  col*=1.-.22*wm;
  col=mix(col,rf*vec3(.86,.84,.82),wm*pud*fres);
  col=mix(col,rf,wm*(1.-pud)*.07);
  float gl=pow(max(0.,nz(vec2(xw*60.,z0*80.+uT*.4))-.55)*2.2,6.);col+=vec3(1.,.93,.8)*gl*wm*pud*.5;}
 /* Wolkenschatten: ziehen mit dem Wind übers Gelände (nicht im Himmel) */
 if(uCs>0.){float cs2=fbm(vec2(q.x*2.4-uT*.022,q.y*5.5+uT*.004));col*=1.-uCs*smoothstep(.48,.66,cs2)*(1.-sky)*(.55+.45*(1.-d));}
 /* Wasser stürzt/rollt abwärts (Wasserfall, Bach, Brandung): zwei Phasen, nur innerhalb der Wasser-Maske */
 if(uWf.x>0.&&mk3.b>.01){float g1=fract(uT*uWf.y),g2=fract(uT*uWf.y+.5);float gw=abs(1.-2.*g1);
  vec2 w1=q+vec2(.0015*sin(q.y*40.+uT),uWf.x*g1),w2=q+vec2(.0015*sin(q.y*40.+uT+2.),uWf.x*g2);
  float wo=min(texture2D(uE,fl(w1)).b,texture2D(uE,fl(w2)).b);
  vec3 wc=mix(P(w1),P(w2),1.-gw);col=mix(col,wc,clamp(mk3.b*smoothstep(.15,.6,wo)*1.1,0.,1.));
  col+=vec3(.06)*mk3.b*smoothstep(.55,.9,nz(vec2(q.x*90.,q.y*160.+uT*uWf.y*9.)));}
 col+=vec3(1.,.98,.94)*mk.g*pow(nz(vec2(q.x*520.,q.y*1300.+uT*2.8)),26.)*1.6*step(D(q).r,.35);
 /* zusätzliche Nebelschleier (bewegt) auf Fließ-Flächen und im Tal */
 float mist=fbm(vec2(q.x*5.-uT*.035,q.y*14.+uT*.01));
 float band=fm*(1.-sky*.6)*.20*uFg+smoothstep(.10,.0,abs(d-.16))*.14*(1.-sky);
 col=mix(col,vec3(.95,.955,.965),clamp(band*smoothstep(.35,.85,mist),0.,.85));
 /* dichte Nebelbank: zweite, gegenläufige Schicht rollt über die Flächen */
 if(uFg>1.2){float m2=fbm(vec2(q.x*2.6+uT*.045,q.y*7.-uT*.012)+mist*.8);
  col=mix(col,vec3(.955,.96,.968),fm*(1.-sky*.5)*smoothstep(.42,.78,m2)*.22*(uFg-1.));}
 /* Teilchen in drei Tiefen: Schnee bzw. Laub. Laub: vorne groß, verschwindet hinter näheren Bäumen (Tiefenkarte), Maus bläst es weg */
 if(uSn>0.){float sn=0.;vec3 lc=vec3(0.);for(int L=0;L<3;L++){float fL=float(L),k=(26.+fL*30.)/uSz/(1.+uLd*.35);
  float Ld=.95-fL*.33;vec2 du=(uv-uM)*vec2(A,1.);float dl=length(du);
  vec2 uvL=uv-uLd*normalize(du+1e-4)*exp(-dl*5.5)*(.10-fL*.025);
  vec2 g=uvL*vec2(A,1.)*k;g.y+=uT*(1.5-fL*.38)*k*.07/uSz+uLd*uS*k*(.16+fL*.05);g.x+=sin(uT*.55+g.y*.045+fL*2.)*(.7+uLd*.8)+(uM.x-.5)*(3.-fL)*1.6+uT*(.25+uLd*.35);
  vec2 id=floor(g),f=fract(g)-.5;float rr=h21(id+fL*17.);
  if(rr>.80){vec2 o3=(vec2(h21(id+3.1),h21(id+5.7))-.5)*.55;vec2 lv=f-o3;float an=uT*(1.2+rr)+rr*20.;lv=mat2(cos(an),-sin(an),sin(an),cos(an))*lv;lv.y*=mix(1.,2.6,step(1.5,uSz));
   float w=smoothstep(mix(.14,.24,uLd)-fL*.03,.0,length(lv))*(1.-fL*.22);
   w*=mix(1.,1.-smoothstep(Ld-.02,Ld+.06,d),uLd);
   float hh=h21(id+9.3);vec3 pc=uLd>.5?mix(mix(vec3(.72,.16,.07),uSc,smoothstep(.0,.5,hh)),vec3(.97,.70,.18),smoothstep(.5,1.,hh)):uSc;
   pc*=.75+.35*abs(sin(an*1.7));sn+=w;lc+=pc*w;}}
  col=mix(col,lc/max(sn,1e-4)*(.88+.12*sin(uT+uv.x*9.)),clamp(sn*uSn,0.,.92));}
 /* Lichtstrahlen: helle Stellen (Dunst/Himmel) streuen zur Sonne hin – Strahlen wandern langsam */
 if(uGr>0.){vec2 dl2=(uSun.xy-q);float acc2=0.,wt=1.;for(int i=0;i<14;i++){vec2 sp2=q+dl2*(float(i)/14.)*.85;vec3 cc=P(sp2);acc2+=smoothstep(.80,.98,dot(cc,vec3(.33)))*wt;wt*=.88;}
  float shim=.65+.35*nz(vec2(atan(dl2.y,dl2.x*iA)*14.,uT*.15));col+=vec3(1.,.86,.62)*acc2/7.*uGr*shim*.55*(1.-smoothstep(.55,.9,dot(col,vec3(.33))))*(1.-smoothstep(.0,.9,length(dl2*vec2(iA,1.))));}
 /* Sonne: Glühen + Strahlen nur im Himmel / auf Nebel */
 vec2 sv=(q-uSun.xy)*vec2(iA,1.);float sr=length(sv);
 float ray=pow(max(0.,nz(vec2(atan(sv.y,sv.x)*8.,uT*.05))*.6+.4*nz(vec2(atan(sv.y,sv.x)*21.,uT*.08+3.))-.25),2.);
 float pul=.85+.15*sin(uT*.6);
 col+=vec3(1.,.93,.84)*uSun.z*(exp(-sr*7.)*.35*pul+ray*exp(-sr*2.2)*.20*max(sky,fm*.6));
 /* Klick: rote Lichtwelle läuft durch die Tiefe (kein Ring am Mauszeiger, Tiry 22.11.2026) */
 float age=uT-uK.z;
 if(uLd>.5){ }else if(age<6.){float fr=1.05-age*.42;float wvv=exp(-pow((d-fr)*24.,2.))*exp(-age*.55)*(1.-smoothstep(.2,.6,sky));
  col=mix(col,RED,clamp(wvv*.85,0.,1.));col+=vec3(1.,.7,.7)*wvv*.15;}
 /* Farbführung Rot/Grau/Weiß: Rosa/Lila raus, leicht entsättigt, klar */
 float lu=dot(col,vec3(.299,.587,.114));
 float pink=clamp(min(col.r,col.b)-col.g,0.,1.)*4.;col=mix(col,vec3(lu*1.02),clamp(pink,0.,.9));
 col=mix(vec3(lu),col,.86);col=(col-.5)*1.05+.5;
 /* Scrollen: Licht wird zum warmen Abend */
 float ev=smoothstep(.2,2.6,uS)*(1.-uDy)*(1.-uNt);col=mix(col,col*vec3(1.10,.97,.86)+vec3(.03,.0,-.01),ev*.55);
 /* Tageslauf (Weinberg): Morgen kühl -> Mittag klar -> Goldene Stunde -> Dämmerung, Himmel glüht am Horizont orange-rot */
 if(uDy>0.){float tg=clamp(uS/2.6,0.,1.);
  vec3 g1=mix(vec3(.94,.98,1.07),vec3(1.),smoothstep(0.,.3,tg));g1=mix(g1,vec3(1.18,.98,.74),smoothstep(.3,.65,tg));g1=mix(g1,vec3(.84,.62,.46),smoothstep(.65,1.,tg));
  float lum2=dot(col,vec3(.3,.59,.11));float gh=smoothstep(.3,.65,tg)*(1.-smoothstep(.75,1.,tg));col=mix(col,pow(col,vec3(1.25)),gh*.8*(1.-sky*.5));col=col*g1;col=mix(col,vec3(lum2)*vec3(.55,.6,.8),smoothstep(.8,1.,tg)*.35*(1.-sky));
  float hz=sky*smoothstep(.35,1.,tg)*(1.-smoothstep(.0,.45,q.y-.45));col=mix(col,col*vec3(1.28,.84,.42)+vec3(.15,.07,0.),hz*.85);col=(col-.5)*(1.+gh*.18)+.5;}
 /* Polarlicht-Nacht (Island): Gelände ins Mondlicht, Himmel Nachtblau, Sterne funkeln, rot-weiße Vorhänge wogen */
 if(uNt>0.){float nn=smoothstep(.25,1.9,uS);
  float lum3=dot(col,vec3(.3,.59,.11));vec3 moon=vec3(.46,.54,.76)*(.08+lum3*.55);
  vec2 aq=q;float au=0.;vec3 auC=vec3(0.);
  for(int j=0;j<3;j++){float fj=float(j);
   float fx=aq.x+.06*fbm(vec2(aq.x*1.3+fj*4.,uT*.035+fj));
   float y0=.585+fj*.055+.08*fbm(vec2(fx*1.6+uT*.03+fj*7.,fj))+.025*sin(fx*7.+uT*.21+fj*2.);
   float up=aq.y-y0;float prof=smoothstep(-.012,.006,up)*exp(-max(up,0.)*(14.-fj*3.));
   float ry=(.55+.45*nz(vec2(fx*13.-uT*.2,fj)))*(.68+.32*pow(nz(vec2(fx*95.+uT*.5+fj*30.,aq.y*1.5)),1.4));
   float br=(.45+.55*smoothstep(.25,.75,fbm(vec2(fx*3.+uT*.06,fj*3.))))*(1.-fj*.22);
   float a1=prof*ry*br;au+=a1;
   auC+=a1*mix(vec3(1.,.84,.58),mix(vec3(.95,.12,.10),vec3(.50,.03,.04),smoothstep(.06,.24,up)),smoothstep(.0,.035,up));}
  auC/=max(au,1e-4);au=clamp(au*.85,0.,1.);
  vec3 skyN=mix(vec3(.05,.06,.11),vec3(.11,.13,.21),smoothstep(1.,.45,q.y));
  vec2 st=q*vec2(iA,1.)*260.;vec2 sid=floor(st);float sh=h21(sid);float star=step(.988,sh)*smoothstep(.35,0.,length(fract(st)-.5))*(.55+.45*sin(uT*(2.+sh*5.)+sh*40.));
  vec3 night=mix(moon,skyN+vec3(star),sky);night=mix(night,night+auC*1.15,au*sky);night+=vec3(.6,.06,.05)*.10*sky*smoothstep(.55,.70,q.y)*(1.-smoothstep(.70,.95,q.y));night+=vec3(.8,.12,.06)*au*.10*(1.-sky)*smoothstep(.3,.7,lum3);
  col=mix(col,night,nn);}
 /* Lesbarkeit links: Milchglas (wie die Seite) */
 float calm=mob?.50*smoothstep(.18,.55,uv.y):smoothstep(.62,.16,uv.x)*.74;
 /* farbtreu (Tiry 22.11.: links nicht mehr schwarz-weiss): Milchglas behaelt die Farben des Fotos, nur heller + flacher */
 vec3 fr=vec3(.95,.955,.962)*.76+col*.28;col=mix(col,fr,min(calm*1.08,.82));
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
 ['uFg','uSn','uSz','uSc','uLd','uDf','uGr','uCs','uDy','uNt','uTy','uWf','uR','uM','uFoc','uImg','uT','uS','uFl','uFp','uAm','uSp','uFade','uV','uK','uSun','uP','uD','uE','uPo'].forEach(function(n){U[n]=gl.getUniformLocation(pr,n)});
 buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0)}
function tex(img){var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t}
function load(k){if(TX[k])return;var e=TX[k]={ok:0};var big=Math.max(screen.width,screen.height)*Math.min(devicePixelRatio||1,2)>1700;
 var n=3;function done(){if(--n===0){e.p=tex(e.ip);e.d=tex(e.id);if(e.ih)e.e=tex(e.ih);e.w=e.ip.naturalWidth;e.h=e.ip.naturalHeight;e.ok=1}}
 e.ip=new Image();e.ip.decoding='async';e.ip.onload=done;e.ip.src=BASE+k+'-'+(big?2400:1400)+'.webp';
 e.id=new Image();e.id.onload=done;e.id.src=BASE+k+'-d.png';
 e.ih=new Image();e.ih.onload=done;e.ih.src=BASE+k+'-m.png'}
/* Qualität passt sich an: ruckelt das Gerät, wird mit weniger Pixeln gerechnet (min. 50 %) */
var QS=1,FT=16,FN=0,TL=0;
function size(){var big=innerWidth*innerHeight>1.4e6;dpr=Math.min(devicePixelRatio||1,1.25)*(big?.8:.95)*QS;
 var w=Math.round(cv.clientWidth*dpr),h=Math.round(cv.clientHeight*dpr);if(w!==W||h!==H){W=cv.width=w;H=cv.height=h}}
var VS=0,Po=[0,0,0],Pv=[0,0,0],Pt=[0,0,0];
function pose(){var h=0,k=(location.hash||'#start')+mode;for(var i=0;i<k.length;i++)h=(h*31+k.charCodeAt(i))|0;h=Math.abs(h);
 Pt=[((h%7)-3)*.010,(((h>>3)%5)-2)*.006,.03+(h>>6)%4*.025];Pv[2]-=.10}
function frame(){raf=requestAnimationFrame(frame);var now=performance.now();if(TL&&!document.hidden){var dt=Math.min(200,now-TL);FT+=(dt-FT)*.05;if(++FN>90){FN=0;if(FT>38&&QS>.5)QS=Math.max(.5,QS-.15);else if(FT<20&&QS<1)QS=Math.min(1,QS+.05)}}TL=now;size();var t=(now-t0)/1000;
 for(var i=0;i<3;i++){Pv[i]+=(Pt[i]-Po[i])*.012;Pv[i]*=.90;Po[i]+=Pv[i]}
 M[0]+=(Mt[0]-M[0])*.045;M[1]+=(Mt[1]-M[1])*.045;var sc0=sc;sc+=(scrollY/innerHeight-sc)*.10;VS+=(Math.min(1.5,Math.abs(sc-sc0)*45)-VS)*.10;
 var e=TX[mode];gl.viewport(0,0,W,H);
 if(!e||!e.ok){gl.clearColor(.914,.922,.933,1);gl.clear(gl.COLOR_BUFFER_BIT);return}
 if(shown!==mode){shown=mode;fade=0}fade=Math.min(1,fade+.025);
 var c=CFG[mode];gl.useProgram(pr);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,e.p);gl.uniform1i(U.uP,0);
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,e.d);gl.uniform1i(U.uD,1);
 gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,e.e||e.d);gl.uniform1i(U.uE,2);
 gl.uniform2f(U.uR,W,H);gl.uniform1f(U.uT,t);gl.uniform1f(U.uS,sc);gl.uniform2f(U.uM,M[0],M[1]);gl.uniform3f(U.uK,K[0],K[1],K[2]);
 gl.uniform2f(U.uImg,e.w,e.h);gl.uniform2f(U.uFoc,W/H<.9?c.fxm:c.fx,c.fy);gl.uniform1f(U.uFl,c.fl);gl.uniform2f(U.uWf,c.wf[0],c.wf[1]);gl.uniform1f(U.uFg,c.fg);gl.uniform1f(U.uSn,c.sn);var sc3=c.sc||[.98,.985,1];gl.uniform1f(U.uSz,c.sz||1);gl.uniform1f(U.uLd,c.ld||0);gl.uniform1f(U.uDf,c.df||0);gl.uniform1f(U.uGr,c.gr||0);gl.uniform1f(U.uCs,c.cs||0);gl.uniform1f(U.uDy,c.dy||0);gl.uniform1f(U.uNt,c.nt||0);gl.uniform3f(U.uSc,sc3[0],sc3[1],sc3[2]);gl.uniform2f(U.uTy,c.ty?c.ty[0]:0,c.ty?c.ty[1]:0);gl.uniform1f(U.uFp,c.fp);gl.uniform1f(U.uAm,c.am);gl.uniform1f(U.uSp,c.sp);
 var sx=c.sun[0],sy=c.sun[1],sz2=c.sun[2];if(c.dy){var tg=Math.max(0,Math.min(1,sc/2.6));sx=.18+.70*tg;sy=.62+.34*Math.sin(Math.PI*Math.min(1,tg*1.15));sz2=c.sun[2]*(1+1.4*tg)}if(c.nt)sz2*=Math.max(0,1-sc/1.2);gl.uniform3f(U.uSun,c.fl?1-sx:sx,sy,sz2);gl.uniform1f(U.uFade,fade*fade*(3-2*fade));gl.uniform1f(U.uV,VS);gl.uniform3f(U.uPo,Po[0],Po[1],Po[2]);
 gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,3)}
/* ---------- Glasplatten hinter freier Schrift (Tiry 22.11.2026: „richtige Glaselemente statt gesprüht“) ----------
   Alle dunklen Texte der aktiven Ansicht + Fußzeile, die nicht schon auf einer eigenen Karte stehen, werden zu Gruppen
   zusammengefasst (Abstand < 2×Luft) und bekommen je eine echte Glasplatte im Stil der Fußzeilen-Karte (Seiten-Koordinaten). */
var GP={el:null,tm:0,last:0};
function mkClip(cs){return cs.webkitBackgroundClip==='text'||cs.backgroundClip==='text'}
/* 0 = keine Fläche · 1 = deckende Fläche (Karte, Bild, Milchglas) · 2 = nur hauchzarte Tönung (Schrift darauf braucht Glas) */
function gpSurf(cs){if(mkClip(cs))return 0;
 if(cs.backdropFilter&&cs.backdropFilter!=='none'||cs.webkitBackdropFilter&&cs.webkitBackdropFilter!=='none')return 1;
 var mx=0,bi=cs.backgroundImage,m,re=/rgba?\(([^)]+)\)/g;if(bi&&bi!=='none'){if(bi.indexOf('url(')>=0)return 1;while(m=re.exec(bi)){m=m[1].split(',');mx=Math.max(mx,m.length>3?+m[3]:1)}}
 m=cs.backgroundColor.match(/[\d.]+/g);if(m&&cs.backgroundColor!=='rgba(0, 0, 0, 0)')mx=Math.max(mx,m.length>3?+m[3]:1);
 return mx>=.55?1:mx>=.04?2:0}
function mkDark(el){for(var e=el,k=0;e&&k<3;e=e.parentElement,k++)if(mkClip(getComputedStyle(e)))return 1;var m=getComputedStyle(el).color.match(/[\d.]+/g);if(!m||m.length>3&&+m[3]<.4)return 0;var f=function(v){v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(+m[0])+.7152*f(+m[1])+.0722*f(+m[2])<.30}
/* Aufbau (Tiry 23.11.2026: nichts darf halb in einer Platte hängen, nichts überlappen, nichts riesig):
   1. Alle sichtbaren Flächen/Bilder der Ansicht sammeln: groß = Karte (bekommt nie eine Platte, Platten halten Abstand), klein = Pille/Knopf/Symbol/Logo.
   2. Dunkle Freitexte bis zu ihrem Inhaltsblock hochsteigen (höchster Vorfahr ohne Karte darin); Nachbar-Blöcke ohne Karte dazwischen = eine Gruppe.
   3. Kleine Elemente der Gruppe (Knöpfe, Pillen, Symbole, Logos in der Nähe) gehören ganz in die Platte.
   4. Platte = Gruppe + Luft, an fremden Elementen und anderen Platten mit Abstand gekappt. */
function gpBuild(){GP.tm=0;GP.last=performance.now();
 var view=document.querySelector('main > section.view:not([hidden])')||document.querySelector('main'),roots=[view,document.querySelector('footer')].filter(Boolean);
 var dw=document.documentElement.clientWidth,sy=scrollY,sx=scrollX,mob=innerWidth<=720,T=[],O=[],PH=[],HO=[],dirty=new Set(),bigEl=new Set(),STOP='section,article,footer';
 function cut(b,c){if(!c)return b;var r=[Math.max(b[0],c[0]),Math.max(b[1],c[1]),Math.min(b[2],c[2]),Math.min(b[3],c[3])];return r[2]-r[0]>4&&r[3]-r[1]>4?r:null}
 function walk(el,root,hid,ox,oy,cl,host){for(var n=el.firstChild;n;n=n.nextSibling){
   if(n.nodeType===3){if(hid||n.textContent.trim().length<2||!mkDark(el))continue;if(host){host.d=1;continue}var r=document.createRange();r.selectNodeContents(n);var q=r.getClientRects(),L=[];
    for(var i=0;i<q.length;i++){var a=q[i];if(a.width>1&&a.height>3){a=cut([a.left+sx-ox,a.top+sy-oy,a.right+sx-ox,a.bottom+sy-oy],cl);if(a)L.push(a)}}if(L.length)T.push({el:el,L:L,root:root});continue}
   if(n.nodeType!==1)continue;var t=n.tagName;if(t==='SCRIPT'||t==='STYLE'||t==='TEMPLATE'||t==='NOSCRIPT'||n.hidden)continue;
   var cs=getComputedStyle(n);if(cs.display==='none'||cs.visibility==='hidden'||cs.position==='fixed')continue;
   var nx=ox,ny=oy,tf=cs.transform;if(tf&&tf!=='none'){var tm=tf.match(/matrix\(([^)]+)\)/);if(tm){tm=tm[1].split(',');nx+=+tm[4]||0;ny+=+tm[5]||0}} /* Einflug-Versatz herausrechnen: gemessen wird die Endlage */
   var ah=hid||n.getAttribute('aria-hidden')==='true',rep=t==='svg'||t==='IMG'||t==='VIDEO'||t==='CANVAS'||t==='IFRAME',sv=gpSurf(cs),frm=t==='INPUT'||t==='TEXTAREA'||t==='SELECT'||t==='BUTTON'&&sv; /* Knöpfe ohne eigene Fläche (Reiter mit Bild + Name) zählen als freier Inhalt */
   if(host){if(!rep&&!frm&&sv!==1)walk(n,root,ah,nx,ny,cl,host);continue}
   if(sv===2&&!rep&&!frm){var q0=n.getBoundingClientRect();if(q0.height>=64&&q0.width>=150&&!(parseFloat(cs.borderTopLeftRadius)>=8))sv=0} /* große Farbwäsche ohne Kartenform = keine Fläche */
   if(rep||frm||sv){var a=n.getBoundingClientRect(),b=cut([a.left+sx-nx,a.top+sy-ny,a.right+sx-nx,a.bottom+sy-ny],cl),w=a.width,h=a.height;if(w<2||h<2||!b)continue;
    var big=frm?0:rep?(h>=130||(cs.objectFit==='cover'||parseFloat(cs.borderTopLeftRadius)>=6)&&h>=60&&w>=100):(h>=64&&w>=150); /* Fotos (zugeschnitten/abgerundet) sind Karten, Logos kleine Elemente */if(cs.position==='absolute'&&(ah&&(!rep||big)||!rep&&+cs.zIndex<0))continue; /* reine Deko-Ebenen */
    var ob={el:n,b:b,big:big,g:null};O.push(ob);if(big&&rep&&cs.objectFit==='cover')PH.push(b);
    if(big&&sv===2&&!rep){ob.r=parseFloat(cs.borderTopLeftRadius)||0;walk(n,root,ah,nx,ny,cl,ob);if(ob.d)HO.push(ob)} /* zart getönte Karte mit dunkler Schrift: Glas in genau ihrer Form */
    if(big){bigEl.add(n);for(var p=n.parentElement;p&&p!==root;p=p.parentElement){if(dirty.has(p))break;dirty.add(p)}}continue}
   if((cs.overflowX==='auto'||cs.overflowX==='scroll')&&n.scrollWidth>n.clientWidth+8){var qs=n.getBoundingClientRect(),bs=cut([qs.left+sx-nx,qs.top+sy-ny,qs.right+sx-nx,qs.bottom+sy-ny],cl);if(!bs)continue;
    var os={el:n,b:bs,big:1,g:null,r:mob?24:28};O.push(os);bigEl.add(n);for(var p2=n.parentElement;p2&&p2!==root;p2=p2.parentElement){if(dirty.has(p2))break;dirty.add(p2)}
    walk(n,root,ah,nx,ny,cl,os);if(os.d)HO.push(os);continue} /* seitlich wischbare Leiste: Inhalt wandert, also eine Platte in Form der ganzen Leiste */
   var c2=cl;if(cs.overflowX!=='visible'||cs.overflowY!=='visible'){var q2=n.getBoundingClientRect();c2=cut([q2.left+sx-nx,q2.top+sy-ny,q2.right+sx-nx,q2.bottom+sy-ny],cl);if(!c2)continue} /* Wisch-Leisten: nur der sichtbare Teil zählt */
   walk(n,root,ah,nx,ny,c2,null)}}
 roots.forEach(function(r){walk(r,r,0,0,0,null,null)});
 function bb(L){var b=[1e9,1e9,-1e9,-1e9];L.forEach(function(a){if(a[0]<b[0])b[0]=a[0];if(a[1]<b[1])b[1]=a[1];if(a[2]>b[2])b[2]=a[2];if(a[3]>b[3])b[3]=a[3]});return b}
 function hit(a,b,e){e=e||0;return a[0]<b[2]-e&&a[2]>b[0]+e&&a[1]<b[3]-e&&a[3]>b[1]+e}
 /* Blöcke (Schrift, die auf einem Foto steht, bekommt keine Platte) */
 var U=[],um=new Map();
 T.forEach(function(t){if(PH.length){t.L=t.L.filter(function(a){var cx=(a[0]+a[2])/2,cy=(a[1]+a[3])/2;return !PH.some(function(b){return cx>b[0]&&cx<b[2]&&cy>b[1]&&cy<b[3]})});if(!t.L.length)return}var p=t.el;while(p.parentElement&&p.parentElement!==t.root&&!dirty.has(p.parentElement)&&!p.matches(STOP))p=p.parentElement;
  var u=um.get(p);if(!u){u={el:p,L:[]};um.set(p,u);U.push(u)}for(var i=0;i<t.L.length;i++)u.L.push(t.L[i])});
 /* Gruppen: Nachbar-Blöcke im selben Elternteil ohne Karte dazwischen */
 var G=[];U.forEach(function(u){var lg=G[G.length-1],ok=0;
  if(lg&&!u.el.matches(STOP)&&lg.last.parentElement===u.el.parentElement){for(var s=lg.last.nextElementSibling;s;s=s.nextElementSibling){if(s===u.el){ok=1;break}if(dirty.has(s)||bigEl.has(s))break}}
  if(ok){lg.units.push(u);lg.last=u.el}else G.push({units:[u],last:u.el})});
 /* Liegt eine Karte mitten im Rechteck einer Gruppe, wird die Gruppe an der größten Lücke geteilt */
 var F=[];
 function split(units){var L=[];units.forEach(function(u){L=L.concat(u.L)});var b=bb(L),bad=0,i;
  if(units.length>1)for(i=0;i<O.length;i++)if(O[i].big&&hit(O[i].b,b,3)){bad=1;break}
  if(!bad){F.push({units:units,U:b,S:[]});return}
  var us=units.map(function(u){return {u:u,b:bb(u.L)}}).sort(function(x,y){return x.b[1]-y.b[1]}),k=1,best=-1e9,mx=us[0].b[3];
  for(i=1;i<us.length;i++){var gap=us[i].b[1]-mx;if(gap>best){best=gap;k=i}if(us[i].b[3]>mx)mx=us[i].b[3]}
  split(us.slice(0,k).map(function(x){return x.u}));split(us.slice(k).map(function(x){return x.u}))}
 G.forEach(function(g){split(g.units)});
 /* Kleine Elemente: gehören zur Gruppe, wenn sie in einem ihrer Blöcke (oder einem Nachbarn ohne Karte) liegen und nah am Inhalt sind */
 var gm=new Map();F.forEach(function(f){f.units.forEach(function(u){gm.set(u.el,f)})});
 F.forEach(function(f){var a=f.units[0].el,z=f.units[f.units.length-1].el,s;if(a.matches(STOP))return;
  for(s=a.previousElementSibling;s&&!dirty.has(s)&&!bigEl.has(s)&&!gm.has(s);s=s.previousElementSibling)gm.set(s,f);
  for(s=a.nextElementSibling;s&&!dirty.has(s)&&!bigEl.has(s);s=s.nextElementSibling){if(!gm.has(s))gm.set(s,f);else if(gm.get(s)!==f)break}});
 O.forEach(function(o){if(o.big)return;for(var p=o.el;p;p=p.parentElement){var f=gm.get(p);if(f){f.S.push(o);return}}});
 var D=70;F.forEach(function(f){var S=f.S,ch=1,u=f.U;while(ch){ch=0;for(var i=0;i<S.length;i++){var o=S[i];if(o.g)continue;
   if(o.b[0]<u[2]+D&&o.b[2]>u[0]-D&&o.b[1]<u[3]+D&&o.b[3]>u[1]-D){o.g=f;ch=1;if(o.b[0]<u[0])u[0]=o.b[0];if(o.b[1]<u[1])u[1]=o.b[1];if(o.b[2]>u[2])u[2]=o.b[2];if(o.b[3]>u[3])u[3]=o.b[3]}}}});
 /* Große Lücken im Inhalt (quer über alle Spalten) teilen eine Gruppe in mehrere Platten: keine Riesen-Flächen */
 var GAP=mob?56:72,F2=[];F.forEach(function(f){var Rr=[];f.units.forEach(function(u){u.L.forEach(function(a){Rr.push({b:a})})});f.S.forEach(function(o){if(o.g===f)Rr.push({b:o.b,o:o})});
  Rr.sort(function(x,y){return x.b[1]-y.b[1]});var cur=null,mx=-1e9;Rr.forEach(function(r){if(!cur||r.b[1]-mx>=GAP){cur={units:f.units,U:[1e9,1e9,-1e9,-1e9],S:[],need:0};F2.push(cur);mx=-1e9}
   if(!r.o||/^(svg|IMG)$/.test(r.o.el.tagName)&&r.o.b[3]-r.o.b[1]>=24)cur.need=1; /* nur Knöpfe/Pillen allein brauchen kein Glas */
   var u=cur.U,b=r.b;if(b[0]<u[0])u[0]=b[0];if(b[1]<u[1])u[1]=b[1];if(b[2]>u[2])u[2]=b[2];if(b[3]>u[3])u[3]=b[3];if(b[3]>mx)mx=b[3];if(r.o){r.o.g=cur;cur.S.push(r.o)}})});F=F2.filter(function(f){if(!f.need)f.S.forEach(function(o){o.g=null});return f.need});
 /* Platten */
 var px=mob?14:30,py=mob?18:28,gp=mob?8:12,mn=6,m=mob?6:14;
 F.forEach(function(f){var u=f.U,P=[u[0]-px,u[1]-py,u[2]+px,u[3]+py],e0=f.units[0].el,wp=e0.closest('.wrap')||e0.querySelector('.wrap');
  if(wp){var wr=wp.getBoundingClientRect(),wc=getComputedStyle(wp),wl=wr.left+sx+(parseFloat(wc.paddingLeft)||0),w2=wr.right+sx-(parseFloat(wc.paddingRight)||0);
   if(w2-wl>40&&u[2]-u[0]>(w2-wl)*.72&&u[0]>=wl-2&&u[2]<=w2+2){P[0]=wl-px;P[2]=w2+px}}
  P[0]=Math.max(m,P[0]);P[2]=Math.min(dw-m,P[2]);
  O.forEach(function(o){if(o.g===f||!hit(o.b,P)||hit(o.b,u,1))return;var b=o.b,c=[],e;
   if(b[3]<=u[1]+1)c.push([b[3]+gp-P[1],1,Math.min(u[1]-mn,b[3]+gp)]);if(b[1]>=u[3]-1)c.push([P[3]-(b[1]-gp),3,Math.max(u[3]+mn,b[1]-gp)]);
   if(b[2]<=u[0]+1)c.push([b[2]+gp-P[0],0,Math.min(u[0]-mn,b[2]+gp)]);if(b[0]>=u[2]-1)c.push([P[2]-(b[0]-gp),2,Math.max(u[2]+mn,b[0]-gp)]);
   if(!c.length)return;c.sort(function(x,y){return x[0]-y[0]});e=c[0];P[e[1]]=e[1]<2?Math.max(P[e[1]],e[2]):Math.min(P[e[1]],e[2])});
  f.P=P});
 /* Platten untereinander: nie überlappen */
 for(var i=0;i<F.length;i++)for(var j=i+1;j<F.length;j++){var A=F[i],B=F[j];if(!A.P||!B.P||!hit(A.P,B.P))continue;var a=A.U,b=B.U,mid;
  if(a[3]<=b[1]){mid=(a[3]+b[1])/2;A.P[3]=Math.min(A.P[3],Math.max(a[3]+mn,mid-gp/2));B.P[1]=Math.max(B.P[1],Math.min(b[1]-mn,mid+gp/2))}
  else if(b[3]<=a[1]){mid=(b[3]+a[1])/2;B.P[3]=Math.min(B.P[3],Math.max(b[3]+mn,mid-gp/2));A.P[1]=Math.max(A.P[1],Math.min(a[1]-mn,mid+gp/2))}
  else if(a[2]<=b[0]){mid=(a[2]+b[0])/2;A.P[2]=Math.min(A.P[2],Math.max(a[2]+mn,mid-gp/2));B.P[0]=Math.max(B.P[0],Math.min(b[0]-mn,mid+gp/2))}
  else if(b[2]<=a[0]){mid=(b[2]+a[0])/2;B.P[2]=Math.min(B.P[2],Math.max(b[2]+mn,mid-gp/2));A.P[0]=Math.max(A.P[0],Math.min(a[0]-mn,mid+gp/2))}
  else{A.P=[Math.min(A.P[0],B.P[0]),Math.min(A.P[1],B.P[1]),Math.max(A.P[2],B.P[2]),Math.max(A.P[3],B.P[3])];A.U=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];B.P=null}}
 var box=GP.el;if(!box){box=GP.el=document.createElement('div');box.id='hgGl';box.setAttribute('aria-hidden','true');document.body.appendChild(box)}
 var h='';GP.dbg=[];HO.forEach(function(o){F.push({P:o.b,U:o.b,units:[{el:o.el}],S:[],r:o.r})});
 F.forEach(function(f){var P=f.P;if(!P||P[2]-P[0]<40||P[3]-P[1]<24)return;var e=f.units[0].el,a=gpPos(e);GP.dbg.push({P:P,U:f.U,f:f,e:e,x:a[0],y:a[1]});
  h+='<div class="hgp" style="left:'+Math.round(P[0])+'px;top:'+Math.round(P[1])+'px;width:'+Math.round(P[2]-P[0])+'px;height:'+Math.round(P[3]-P[1])+'px'+(f.r!=null?';border-radius:'+f.r+'px':'')+'"></div>'});
 box.innerHTML=h;box.classList.remove('off');window.__gp=GP.dbg}
/* Rutscht der Inhalt (Bild lädt, Klappfeld), rücken die Platten sofort mit ihrem Block nach; der genaue Neuaufbau folgt gedrosselt */
/* Lage eines Elements in der Seite ohne Einflug-Versatz (Endlage) */
function gpPos(el){var a=el.getBoundingClientRect(),x=a.left+scrollX,y=a.top+scrollY;for(var p=el;p&&p!==document.body;p=p.parentElement){var tf=getComputedStyle(p).transform;if(tf&&tf!=='none'){var m=tf.match(/matrix\(([^)]+)\)/);if(m){m=m[1].split(',');x-=+m[4]||0;y-=+m[5]||0}}}return [x,y]}
function gpShift(){GP.sh=0;if(!GP.el||!GP.dbg)return;var k=GP.el.children,i,d,a,dx,dy;for(i=0;i<GP.dbg.length&&i<k.length;i++){d=GP.dbg[i];if(!d.e.isConnected)continue;a=gpPos(d.e);
  dx=Math.round(a[0]-d.x);dy=Math.round(a[1]-d.y);k[i].style.transform=dx||dy?'translate('+dx+'px,'+dy+'px)':''}}
function gpSoon(d){if(GP.tm)return;var wait=Math.max(d||400,1200-(performance.now()-GP.last));GP.tm=setTimeout(function(){if(window.requestIdleCallback)requestIdleCallback(gpBuild,{timeout:500});else gpBuild()},wait)}
function gpInit(){gpSoon(200);addEventListener('load',function(){gpSoon(150)});addEventListener('resize',function(){gpSoon(250)});
 addEventListener('hashchange',function(){if(GP.el)GP.el.classList.add('off');gpSoon(900);setTimeout(function(){gpSoon(150)},2200)});
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){gpSoon(150)});
 var mn=document.querySelector('main');if(mn){if(window.ResizeObserver)new ResizeObserver(function(){if(!GP.sh)GP.sh=requestAnimationFrame(gpShift);gpSoon(300)}).observe(mn);
  new MutationObserver(function(){gpSoon(600)}).observe(mn,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','open']})}}
function click(e){if(e.target&&e.target.closest&&e.target.closest('#ueSw'))return;K=[e.clientX/innerWidth,1-e.clientY/innerHeight,(performance.now()-t0)/1000]}
function init(){cv=document.createElement('canvas');cv.id='hg';cv.setAttribute('aria-hidden','true');document.body.insertBefore(cv,document.body.firstChild);
 gl=cv.getContext('webgl',{antialias:false,alpha:false,premultipliedAlpha:false,powerPreference:'high-performance'});
 if(!gl){cv.remove();de.classList.remove('hg3');return}gl.getExtension('OES_standard_derivatives');
 try{build()}catch(err){console.error('hg12',err.message);cv.remove();de.classList.remove('hg3');return}
 addEventListener('pointermove',function(e){Mt=[e.clientX/innerWidth,1-e.clientY/innerHeight]},{passive:true});
 addEventListener('pointerdown',click,{passive:true});
 /* Handy: Neigen = Blickwinkel */
 addEventListener('deviceorientation',function(e){if(e.gamma==null)return;Mt=[.5+Math.max(-1,Math.min(1,e.gamma/30))*.5,.5+Math.max(-1,Math.min(1,(e.beta-45)/30))*.5]},{passive:true});
 cv.addEventListener('webglcontextlost',function(e){e.preventDefault();cancelAnimationFrame(raf)});
 cv.addEventListener('webglcontextrestored',function(){TX={};shown='';try{build()}catch(err){return}load(mode);frame()});
 addEventListener('hashchange',pose);addEventListener('popstate',pose);pose();Po=Pt.slice();Pv=[0,0,0];
 load(mode);gpInit();frame();if(FEST)return;/* Live-Homepage: nur die Herbstallee, kein Umschalter (Tiry 22.11.2026) */sw();
 /* übrige Szenen leise vorladen */
 setTimeout(function(){MODES.forEach(function(m){load(m[0])})},4000)}

/* ---------- Umschalter ---------- */
function sw(){var b=document.createElement('div');b.id='ueSw';b.setAttribute('role','group');b.setAttribute('aria-label','Hintergrund wählen');
 b.innerHTML='<span class="ue-k">Hintergrund</span>'+MODES.map(function(m,i){return'<button type="button" data-hg="'+m[0]+'" aria-pressed="false"><b>'+(i+1)+'</b><span>'+m[1]+'<small>'+m[2]+'</small></span></button>'}).join('');
 document.body.appendChild(b);
 function up(){[].forEach.call(b.querySelectorAll('button'),function(x){var on=x.dataset.hg===mode;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on))})}
 b.addEventListener('click',function(e){var x=e.target.closest('button');if(!x)return;e.stopPropagation();mode=x.dataset.hg;window.HG12_MODE=mode;try{localStorage.setItem('vc_hg12',mode)}catch(_){}load(mode);pose();up();tip()});
 var tt=0;function tip(){var n=document.getElementById('ueTip');if(!n){n=document.createElement('div');n.id='ueTip';document.body.appendChild(n)}
  var i=MODES.findIndex(function(m){return m[0]===mode}),m=MODES[i];n.innerHTML='<b>Hintergrund '+(i+1)+'</b> · '+m[1]+' – '+m[2];n.classList.remove('on');void n.offsetWidth;n.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){n.classList.remove('on')},2800)}
 up();setTimeout(tip,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

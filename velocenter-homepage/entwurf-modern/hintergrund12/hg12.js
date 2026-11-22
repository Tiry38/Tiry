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
   fg = Dunst, sn/sz/sc = Teilchen (Stärke/Größe/Farbe), ld = Laub mit 3D-Verdeckung + Maus-Wind, df = Kino-Schärfe (negativ = nur Nahes unscharf, Ferne bleibt scharf), gr = Lichtstrahlen, cs = Wolkenschatten, dy = Tageslauf, nt = Polarlicht-Nacht */
var CFG={herbst:{ty:[0,-.04],fxm:.50,fx:.50,fy:.55,fl:0,fp:.20,am:.030,sp:.012,wf:[0,0],sun:[.50,.66,.20],fg:1.6,sn:.95,sz:2.2,sc:[.92,.46,.12],ld:1,df:-1,gr:.30,cs:0,dy:0,nt:0},
 wein:{ty:[.02,-.05],fxm:.70,fx:.52,fy:.50,fl:0,fp:.25,am:.060,sp:.016,wf:[0,0],sun:[.62,.90,.18],fg:1,sn:0,ld:0,df:1,gr:0,cs:.42,dy:1,nt:0},
 island:{ty:[.02,-.04],fxm:.62,fx:.50,fy:.50,fl:1,fp:.30,am:.055,sp:.014,wf:[0,0],sun:[.40,.85,.10],fg:1.2,sn:0,ld:0,df:1,gr:0,cs:.32,dy:0,nt:1}};
var BASE=(window.HG12_BASE||'img/hg12/');
var mode=window.HG12_DEFAULT||'herbst';
try{var q=new URLSearchParams(location.search).get('hg');if(q)mode=q;else{var s0=localStorage.getItem('vc_hg12');if(s0)mode=s0}}catch(e){}
if(!MODES.some(function(m){return m[0]===mode}))mode='herbst';
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
  vec2 g=uvL*vec2(A,1.)*k;g.y+=uT*(1.5-fL*.38)*k*.07/uSz;g.x+=sin(uT*.55+g.y*.045+fL*2.)*(.7+uLd*.8)+(uM.x-.5)*(3.-fL)*1.6+uT*(.25+uLd*.35);
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
 if(age<6.&&uLd>.5){
  /* Herbstallee: Scan läuft als ruhiges Band über die Ebene, über die Kuppe und die Straße hinauf bis in den Nebel (keine Wand);
     fein: Kanten/Blätter im Band leuchten zart nach, nur bei genauem Hinsehen */
  float cr=.385,vy=.64;
  float ds=q.y<cr?max(d,(.6164-q.y)*1.647):max(min(d*2.4,.42),.38*(1.-(q.y-cr)/(vy-cr)));
  float fr=1.05-age*.42,dz=ds-fr,ft=exp(-age*.22);
  float bw=mix(46.,24.,clamp(ds,0.,1.));
  float front=exp(-pow(dz*bw,2.));
  float trail=step(0.,dz)*exp(-dz*14.)*(1.-front);
  float sat=max(base.r,max(base.g,base.b))-min(base.r,min(base.g,base.b));
  float tree=0.;
  vec2 ex=vec2(.0014,0.),ey=vec2(0.,.0014);
  float eg=abs(dot(P(q+ex)-P(q-ex),vec3(.33)))+abs(dot(P(q+ey)-P(q-ey),vec3(.33)));
  float edg=smoothstep(.04,.18,eg);
  vec2 gq=q*vec2(uImg.x/uImg.y,1.)*300.;float hp=fract(sin(dot(floor(gq),vec2(127.1,311.7)))*43758.5);
  float pts=step(.965,hp)*smoothstep(.45,.1,length(fract(gq)-.5));
  float m=(1.-smoothstep(vy+.04,vy+.14,q.y))*(1.-tree*.6)*(1.-smoothstep(.6,1.,sky)*.15)*(1.-smoothstep(5.,6.,age));
  /* scharfe Vorderkante + Tiefen-Höhenlinien (folgen Baumformen/Straße) – technisch, aber leise */
  float rim=exp(-pow((dz+.55/bw)*bw*3.2,2.));
  float iso=smoothstep(.55,1.,sin(ds*560.))*smoothstep(0.,.25,front);
  float a1=(front*(.48+.32*edg)+iso*front*.30+trail*(edg*.22+smoothstep(.75,1.,sin(ds*560.))*.10))*ft*m;
  col=mix(col,RED,clamp(a1*.85,0.,1.));
  col+=vec3(1.,.80,.78)*(rim*(.22+.30*edg)+front*.10*edg+pts*front*.55)*ft*m;
 }else if(age<6.){float fr=1.05-age*.42;float wvv=exp(-pow((d-fr)*24.,2.))*exp(-age*.55)*(1.-smoothstep(.2,.6,sky));
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
var Po=[0,0,0],Pv=[0,0,0],Pt=[0,0,0];
function pose(){var h=0,k=(location.hash||'#start')+mode;for(var i=0;i<k.length;i++)h=(h*31+k.charCodeAt(i))|0;h=Math.abs(h);
 Pt=[((h%7)-3)*.010,(((h>>3)%5)-2)*.006,.03+(h>>6)%4*.025];Pv[2]-=.10}
function frame(){raf=requestAnimationFrame(frame);var now=performance.now();if(TL&&!document.hidden){var dt=Math.min(200,now-TL);FT+=(dt-FT)*.05;if(++FN>90){FN=0;if(FT>38&&QS>.5)QS=Math.max(.5,QS-.15);else if(FT<20&&QS<1)QS=Math.min(1,QS+.05)}}TL=now;size();var t=(now-t0)/1000;
 for(var i=0;i<3;i++){Pv[i]+=(Pt[i]-Po[i])*.012;Pv[i]*=.90;Po[i]+=Pv[i]}
 M[0]+=(Mt[0]-M[0])*.045;M[1]+=(Mt[1]-M[1])*.045;sc+=(scrollY/innerHeight-sc)*.10;
 var e=TX[mode];gl.viewport(0,0,W,H);
 if(!e||!e.ok){gl.clearColor(.914,.922,.933,1);gl.clear(gl.COLOR_BUFFER_BIT);return}
 if(shown!==mode){shown=mode;fade=0}fade=Math.min(1,fade+.025);
 var c=CFG[mode];gl.useProgram(pr);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,e.p);gl.uniform1i(U.uP,0);
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,e.d);gl.uniform1i(U.uD,1);
 gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,e.e||e.d);gl.uniform1i(U.uE,2);
 gl.uniform2f(U.uR,W,H);gl.uniform1f(U.uT,t);gl.uniform1f(U.uS,sc);gl.uniform2f(U.uM,M[0],M[1]);gl.uniform3f(U.uK,K[0],K[1],K[2]);
 gl.uniform2f(U.uImg,e.w,e.h);gl.uniform2f(U.uFoc,W/H<.9?c.fxm:c.fx,c.fy);gl.uniform1f(U.uFl,c.fl);gl.uniform2f(U.uWf,c.wf[0],c.wf[1]);gl.uniform1f(U.uFg,c.fg);gl.uniform1f(U.uSn,c.sn);var sc3=c.sc||[.98,.985,1];gl.uniform1f(U.uSz,c.sz||1);gl.uniform1f(U.uLd,c.ld||0);gl.uniform1f(U.uDf,c.df||0);gl.uniform1f(U.uGr,c.gr||0);gl.uniform1f(U.uCs,c.cs||0);gl.uniform1f(U.uDy,c.dy||0);gl.uniform1f(U.uNt,c.nt||0);gl.uniform3f(U.uSc,sc3[0],sc3[1],sc3[2]);gl.uniform2f(U.uTy,c.ty?c.ty[0]:0,c.ty?c.ty[1]:0);gl.uniform1f(U.uFp,c.fp);gl.uniform1f(U.uAm,c.am);gl.uniform1f(U.uSp,c.sp);
 var sx=c.sun[0],sy=c.sun[1],sz2=c.sun[2];if(c.dy){var tg=Math.max(0,Math.min(1,sc/2.6));sx=.18+.70*tg;sy=.62+.34*Math.sin(Math.PI*Math.min(1,tg*1.15));sz2=c.sun[2]*(1+1.4*tg)}if(c.nt)sz2*=Math.max(0,1-sc/1.2);gl.uniform3f(U.uSun,c.fl?1-sx:sx,sy,sz2);gl.uniform1f(U.uFade,fade*fade*(3-2*fade));gl.uniform1f(U.uV,0);gl.uniform3f(U.uPo,Po[0],Po[1],Po[2]);
 gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,3)}
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
 load(mode);frame();sw();
 /* übrige Szenen leise vorladen */
 setTimeout(function(){MODES.forEach(function(m){load(m[0])})},4000)}

/* ---------- Umschalter ---------- */
function sw(){var b=document.createElement('div');b.id='ueSw';b.setAttribute('role','group');b.setAttribute('aria-label','Hintergrund wählen');
 b.innerHTML='<span class="ue-k">Hintergrund</span>'+MODES.map(function(m,i){return'<button type="button" data-hg="'+m[0]+'" aria-pressed="false"><b>'+(i+1)+'</b><span>'+m[1]+'<small>'+m[2]+'</small></span></button>'}).join('');
 document.body.appendChild(b);
 function up(){[].forEach.call(b.querySelectorAll('button'),function(x){var on=x.dataset.hg===mode;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on))})}
 b.addEventListener('click',function(e){var x=e.target.closest('button');if(!x)return;e.stopPropagation();mode=x.dataset.hg;try{localStorage.setItem('vc_hg12',mode)}catch(_){}load(mode);pose();up();tip()});
 var tt=0;function tip(){var n=document.getElementById('ueTip');if(!n){n=document.createElement('div');n.id='ueTip';document.body.appendChild(n)}
  var i=MODES.findIndex(function(m){return m[0]===mode}),m=MODES[i];n.innerHTML='<b>Hintergrund '+(i+1)+'</b> · '+m[1]+' – '+m[2];n.classList.remove('on');void n.offsetWidth;n.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){n.classList.remove('on')},2800)}
 up();setTimeout(tip,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* Vorlage „Regen, blaue Stunde, Pusteblumen“ (Tiry 22.11.2026: mehr Bezug zum E-Bike-Fahren, mit passenden technischen Effekten
   wie das fallende Laub der Herbstallee; keine Fahrräder, Personen, Fahrzeuge; keine Motive aus den Vorlagen 9–14).
   - Regenstraße: nasse Waldstraße. Regen fällt in drei Tiefen (verdeckt von Näherem), Maus = Wind, Spritzer auf dem Asphalt, Tropfen auf der Linse.
   - Blaue Stunde: leere Straße in der Dämmerung. Maus lenkt den Lichtkegel des E-Bike-Scheinwerfers, Linien und Rückstrahler leuchten, Mücken im Licht; Scrollen = Nacht.
   - Pusteblumenweg: Weg durch die Wiese im Gegenlicht. Pusteblumen-Samen schweben in drei Tiefen und leuchten zur Sonne hin, Maus = Wind.
   Abend-/Lichter-Effekte (rl, ls) aus früheren Entwürfen bleiben im Code, sind hier aber aus.
   Technik wie hg13 (Kino-Schärfe, Tiefenkarte, automatische Qualität, Milchglas links farbtreu).
   Daten je Szene: <name>-2400/1400.webp, <name>-d.png (R Tiefe, G Himmel, B Wolken/Dunst), <name>-m.png (R Pflanzen, G Wasser, B nasse/helle Flächen). */
(function(){
var MODES=[['regen','Regenstraße','Regen in 3D · Maus = Wind · Tropfen auf der Linse'],['abend','Blaue Stunde','Maus = E-Bike-Scheinwerfer · Scrollen = Nacht'],['wiese','Pusteblumenweg','Samen schweben im Gegenlicht · Maus = Wind']];
/* je Szene: ty = Kamera schwenkt beim Scrollen, Fokus (Bild-x, Bild-y von unten), Spiegeln, Fokus-Ebene, Wolken (Stärke, Tempo), Sonne (x,y von unten; z = Stärke),
   fg = Dunst, df = Kino-Schärfe, gr = Lichtstrahlen, mo = Pollen im Licht, wr = lebendiges Wasser, dy/rt = Tageslauf/echte Uhrzeit, nt = Nacht (1 Polarlicht, 2 Sternennacht) */
/* ls = Sonnenflecken/Blätterschatten, rl = Abend mit E-Bike-Lichtern; L1 = zwei Rücklichter, L2 = zwei Displays (Bild-x, Bild-y von unten, ungespiegelt) */
var CFG={regen:{ty:[0,-.03],fxm:.50,fx:.50,fy:.40,fl:0,fp:.25,am:.020,sp:.010,wf:[0,0],sun:[.50,.40,0],fg:1.5,sn:0,ld:0,df:-1,gr:0,cs:0,dy:0,nt:0,mo:0,rn:1},
 abend:{ty:[0,-.03],fxm:.50,fx:.50,fy:.40,fl:0,fp:.25,am:.020,sp:.008,wf:[0,0],sun:[.50,.45,0],fg:.6,sn:0,ld:0,df:-1,gr:0,cs:0,dy:0,nt:0,mo:0,hl:1,hz:.325},
 wiese:{ty:[0,-.03],fxm:.45,fx:.50,fy:.45,fl:0,fp:.30,am:.025,sp:.010,wf:[0,0],sun:[.80,.80,.30],fg:1.2,sn:0,ld:0,df:.8,gr:.30,cs:0,dy:0,nt:0,mo:0,pb:1}};
/* echte Uhrzeit -> Tageslicht 0..1 (6 Uhr Morgen, 12 Uhr Mittag, 17 Uhr Goldene Stunde, 20 Uhr Dämmerung); ?zeit=18.5 zum Testen */
function tagZeit(){var h;try{h=parseFloat(new URLSearchParams(location.search).get('zeit'))}catch(e){}if(!(h>=0)){var n=new Date();h=n.getHours()+n.getMinutes()/60}
 var P=[[0,.86],[5,.86],[6.5,0],[12,.3],[15,.42],[17.5,.65],[20,.86],[24,.86]];for(var i=1;i<P.length;i++)if(h<=P[i][0]){var a=P[i-1],b=P[i];return a[1]+(b[1]-a[1])*(h-a[0])/(b[0]-a[0])}return .86}
var TG0=tagZeit();setInterval(function(){TG0=tagZeit()},60000);
var BASE=(window.HG15_BASE||'img/hg15/');
var mode=window.HG15_DEFAULT||'gasse';
try{var q=new URLSearchParams(location.search).get('hg');if(q)mode=q;else{var s0=localStorage.getItem('vc_hg15');if(s0)mode=s0}}catch(e){}
if(!MODES.some(function(m){return m[0]===mode}))mode='gasse';
var de=document.documentElement;

var FSRC=`#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 uR,uM,uFoc,uImg;uniform vec2 uTy,uWf;uniform float uFg,uSn,uSz,uLd,uDf,uGr,uCs,uDy,uNt,uWr,uTg,uMo,uLs,uRl,uRn,uHl,uPb,uHz;uniform vec4 uL1,uL2;uniform vec3 uSc;uniform float uT,uS,uFl,uFp,uAm,uSp,uFade,uV;uniform vec3 uK,uSun,uPo;
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
 /* Wasser lebt: die Maus zieht Wellenringe, ein Klick wirft einen Stein (Ringe laufen nach außen) */
 if(uWr>0.&&mk.g>.02){vec2 pm2=c+(uM-.5)*s;vec2 dm=(q-pm2)*vec2(iA,2.8);float r0=length(dm);
  float rip=sin(r0*110.-uT*6.5)*exp(-r0*6.5)*smoothstep(0.,.025,r0)*smoothstep(.05,.4,texture2D(uE,fl(pm2)).g);
  float ag=uT-uK.z;vec2 dk=(uv-uK.xy)*vec2(A,2.8);float rk=length(dk);float rr1=rk-ag*.16;
  float st1=ag<7.?sin(rr1*95.)*exp(-abs(rr1)*11.)*exp(-ag*.55)*smoothstep(0.,.3,ag):0.;
  q+=(normalize(dm+1e-5)*rip*.0042+normalize(dk+1e-5)*st1*.0075)*mk.g*uWr;
  q.y+=mk.g*uWr*sin(q.x*26.+uT*.9+sin(q.y*40.)*2.)*.0011;}
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
 col+=vec3(1.,.98,.94)*mk.g*pow(nz(vec2(q.x*520.,q.y*1300.+uT*2.8)),26.)*1.6*step(D(q).r,.35)*(1.-uWr);
 if(uWr>0.){float gl2=nz(vec2(q.x*90.+uT*.25,q.y*520.-uT*.9))*nz(vec2(q.x*37.-uT*.1,q.y*210.+uT*.5));col+=vec3(1.,.97,.9)*mk.g*smoothstep(.62,.82,gl2)*.20*smoothstep(.55,.85,dot(col,vec3(.33)));}
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
 /* Pollen/Staub schwebt in zwei Tiefen und leuchtet nur dort auf, wo Licht hinfällt */
 if(uMo>0.){float mo=0.;for(int L=0;L<2;L++){float fL=float(L);vec2 g3=uv*vec2(A,1.)*(15.+fL*11.)+vec2(uT*.035+sin(uT*.13+fL)*.3,uT*(.018+fL*.012));vec2 id3=floor(g3);float hm=h21(id3+fL*13.);
   vec2 o4=vec2(sin(uT*(.35+hm*.5)+hm*30.),cos(uT*(.28+hm*.4)+hm*11.))*.30;float dd3=length(fract(g3)-.5-o4);
   mo+=step(.45,hm)*(smoothstep(.055-fL*.015,0.,dd3)*.9+exp(-dd3*22.)*.25)*(.5+.5*sin(uT*(.8+hm*1.3)+hm*50.));}
  col+=vec3(1.,.93,.72)*mo*uMo*smoothstep(.30,.75,dot(col,vec3(.33)))*.55*(1.-sky);}

 /* Regen: Fäden in drei Tiefen (verschwinden hinter näheren Dingen), Maus = Wind schräg, Spritzer auf nasser Straße, Tropfen auf der Linse */
 if(uRn>0.){col=mix(col,col*vec3(.90,.95,1.02),uRn*.35);float sl=.10+(uM.x-.5)*.55+.05*sin(uT*.3);float rn=0.;
  for(int L=0;L<3;L++){float fL=float(L);float k=70.+fL*65.;vec2 r=vec2(uv.x*A+uv.y*sl,uv.y);
   float gy=(r.y+uT*(2.4-fL*.55))*k*.085;vec2 id=vec2(floor(r.x*k),floor(gy));vec2 f=vec2(fract(r.x*k),fract(gy));float hr=h21(id+fL*7.3);
   if(hr>.42){float xo=.2+.6*h21(id+3.7),s0=h21(id+8.1)*.5,ln=.35+.25*h21(id+1.9);
    float w=smoothstep(.10+fL*.02,0.,abs(f.x-xo))*smoothstep(s0,s0+.06,f.y)*smoothstep(s0+ln,s0+ln-.20,f.y);
    float Ld=.92-fL*.30;w*=1.-smoothstep(Ld-.02,Ld+.05,d);rn+=w*(1.-fL*.25);}}
  col=mix(col,vec3(.86,.90,.95),clamp(rn*.30*uRn,0.,.6));
  float wet=mk3.b*(1.-sky);
  col+=vec3(.85,.9,1.)*wet*smoothstep(.62,.92,nz(vec2(q.x*55.+sl*3.,q.y*360.-uT*2.2)))*.07*uRn;
  float spl=0.;for(int L=0;L<2;L++){float fL=float(L);vec2 g=vec2(uv.x*A,uv.y)*(26.+fL*20.);vec2 id=floor(g);float hs=h21(id+fL*5.);
   float ph=fract(uT*(1.1+hs*.8)+hs*7.);vec2 o=(vec2(h21(id+2.),h21(id+4.))-.5)*.5;vec2 rr=(fract(g)-.5-o)*vec2(1.,2.3);
   spl+=step(.35,hs)*smoothstep(.06,0.,abs(length(rr)-ph*.42))*(1.-ph)*(1.-ph);}
  col+=vec3(.9,.94,1.)*spl*wet*smoothstep(.35,.7,d)*.55*uRn;
  float dr=0.;vec2 dn=vec2(0.);for(int L=0;L<2;L++){float fL=float(L);vec2 g=vec2(uv.x*A,uv.y)*(3.2+fL*2.6);vec2 id=floor(vec2(g.x,0.)+vec2(0.,fL*9.));
   float hd=h21(vec2(floor(g.x),fL*13.));float yy=fract(-uT*(.018+hd*.03)+hd*9.+floor(uT*(.018+hd*.03)+hd*9.)*0.);
   vec2 cpos=vec2(floor(g.x)+.2+.6*hd,(1.-yy)*(3.2+fL*2.6));vec2 rd=(g-cpos)*vec2(1.,.85);float rl=length(rd);float rad=.10+.08*h21(vec2(hd,fL));
   float m1=smoothstep(rad,rad*.75,rl)*step(.45,hd);
   float tr=smoothstep(.025,0.,abs(rd.x+.01*sin(rd.y*20.)))*step(0.,rd.y)*smoothstep(.9,0.,rd.y)*step(.45,hd)*.35;
   dr=max(dr,max(m1,tr));dn+=m1*rd/max(rad,1e-3);}
  if(dr>.001){vec3 rf=P(clamp(q-dn*.035*vec2(1.,iA)-vec2(0.,.02),.003,.997));col=mix(col,rf*1.08+.03,dr*.75*uRn);col+=vec3(1.)*pow(max(0.,1.-length(dn-vec2(-.35,.45))),6.)*dr*.35*uRn;}}
 /* Pusteblumen: Samen mit Schirmchen schweben in drei Tiefen, leuchten im Gegenlicht, verschwinden hinter Näherem; Maus = Wind */
 if(uPb>0.){float pa=0.;vec3 pc2=vec3(0.);for(int L=0;L<3;L++){float fL=float(L);float k=(5.+fL*5.5);
   vec2 du=(uv-uM)*vec2(A,1.);float dl=length(du);vec2 uvL=uv-normalize(du+1e-4)*exp(-dl*5.)*(.09-fL*.025);
   vec2 g=uvL*vec2(A,1.)*k;g.x-=uT*(.16+.10*fL)*k*.35+(uM.x-.5)*(2.5-fL)*1.2;g.y-=uT*(.05+.03*sin(uT*.2+fL))*k*.35;g.y+=sin(g.x*.35+uT*.4+fL)*.35;
   vec2 id=floor(g),f=fract(g)-.5;float hp=h21(id+fL*11.);
   if(hp>.55){vec2 o=(vec2(h21(id+1.3),h21(id+2.9))-.5)*.5+vec2(sin(uT*.7+hp*20.),cos(uT*.6+hp*9.))*.06;vec2 lv=f-o;float an=sin(uT*(.5+hp)+hp*30.)*.5;lv=mat2(cos(an),-sin(an),sin(an),cos(an))*lv;
    float sz=(.085+.04*h21(id+6.))*(1.+fL*.05);float rl=length(lv-vec2(0.,.02));float a=atan(lv.y-.02,lv.x);
    float fil=pow(abs(cos(a*7.+hp*9.)),14.)*smoothstep(sz,sz*.25,rl)*smoothstep(-.02,.03,lv.y-.02+sz*.35);
    float fluff=smoothstep(sz,sz*.15,rl)*.35*smoothstep(-.03,.02,lv.y-.02);
    float stem=smoothstep(.006,0.,abs(lv.x))*step(lv.y,.02)*step(-sz*1.5,lv.y);float seed=smoothstep(.016,0.,length((lv-vec2(0.,-sz*1.5))*vec2(1.6,.8)));
    float blur=fL<.5?1.:0.;float w=max(max(fil,fluff),max(stem*.7,seed*.9));w=mix(w,smoothstep(sz*1.1,0.,rl)*.45,blur*.55);
    float Ld=.95-fL*.30;w*=1.-smoothstep(Ld-.02,Ld+.05,d);w*=1.-fL*.18;
    vec2 sv2=(q-uSun.xy)*vec2(iA,1.);float bk=1.+1.6*exp(-length(sv2)*2.5);
    vec3 cc=mix(vec3(.98,.95,.88),vec3(1.,.86,.60),seed*.0+stem*.6+.2*fL)*bk;pa+=w;pc2+=cc*w;}}
  col=mix(col,pc2/max(pa,1e-4),clamp(pa*.85*uPb,0.,.9));col+=vec3(1.,.85,.55)*pa*.10*uPb;}
 /* Lichtstrahlen: helle Stellen (Dunst/Himmel) streuen zur Sonne hin – Strahlen wandern langsam */
 if(uGr>0.){vec2 dl2=(uSun.xy-q);float acc2=0.,wt=1.;for(int i=0;i<14;i++){vec2 sp2=q+dl2*(float(i)/14.)*.85;vec3 cc=P(sp2);acc2+=smoothstep(.80,.98,dot(cc,vec3(.33)))*wt;wt*=.88;}
  float shim=.65+.35*nz(vec2(atan(dl2.y,dl2.x*iA)*14.,uT*.15));col+=vec3(1.,.86,.62)*acc2/7.*uGr*shim*.55*(1.-smoothstep(.55,.9,dot(col,vec3(.33))))*(1.-smoothstep(.0,.9,length(dl2*vec2(iA,1.))));}
 /* Sonne: Glühen + Strahlen nur im Himmel / auf Nebel */
 vec2 sv=(q-uSun.xy)*vec2(iA,1.);float sr=length(sv);
 float ray=pow(max(0.,nz(vec2(atan(sv.y,sv.x)*8.,uT*.05))*.6+.4*nz(vec2(atan(sv.y,sv.x)*21.,uT*.08+3.))-.25),2.);
 float pul=.85+.15*sin(uT*.6);
 col+=vec3(1.,.93,.84)*uSun.z*(exp(-sr*7.)*.35*pul+ray*exp(-sr*2.2)*.20*max(sky,fm*.6));
/* Sonnenflecken: Licht fällt durch unsichtbares Laub, Schatten wiegen im Wind (Maus = Böe), weiche Ränder */
 if(uLs>0.){float lm=mk3.b*.8+.2;vec2 lq=(q+cam*.6)*vec2(iA,1.)*2.6;float gb=1.+1.6*length(uM-.5);
  vec2 swy=vec2(sin(uT*.50+lq.y*.9)+.5*sin(uT*1.3+lq.x*2.),cos(uT*.41+lq.x*.7))*.075*gb;
  float big=smoothstep(.30,.62,fbm(lq*.8+swy*.5+vec2(uT*.006,0.)));
  vec2 lg2=(lq+swy*1.8)*vec2(4.2,6.0);float sm=fbm(lg2)*.65+nz(lg2*2.1+uT*.05)*.35;
  float lit3=max(big*.55,smoothstep(.54,.60,sm)*(.35+.65*big));float day=1.-smoothstep(.25,1.5,uS);
  col*=mix(1.,mix(.70,1.13,lit3),lm*uLs*day);col+=vec3(.10,.06,.0)*lit3*lm*uLs*day*.55;}
 /* Abend in der Gasse: blaue Stunde, Fenster glüht warm, Bosch-Displays und Rücklichter gehen an (rot = Velocenter) */
 if(uRl>0.){float nn=smoothstep(.30,1.7,uS);
  vec3 du=col*vec3(.30,.37,.58)*.78+vec3(.008,.014,.036);
  vec2 wq=(q-vec2(uFl>.5?1.-.477:.477,.79))*vec2(iA,1.);float pool=exp(-dot(wq,wq)*7.);
  du+=col*vec3(1.30,.74,.36)*pool*.75;du=mix(du,vec3(1.,.66,.30)*(.75+.6*dot(col,vec3(.33))),clamp(mk3.r*1.2,0.,1.));
  float on=smoothstep(.45,.50,nn)*(.75+.25*step(.52,nn)+.25*step(.50,nn)*step(nn,.51));
  vec3 lg=vec3(0.);
  for(int i=0;i<2;i++){vec2 lp2=i==0?uL1.xy:uL1.zw;lp2.x=uFl>.5?1.-lp2.x:lp2.x;vec2 r=(q-lp2)*vec2(iA,1.);float dr=length(r*vec2(.75,1.3));
   lg+=vec3(1.,.07,.04)*(smoothstep(.016,.004,dr)*1.4+exp(-dr*38.)*.55+exp(-dr*9.)*.16);
   vec2 rf=(q-lp2+vec2(0.,.10))*vec2(iA*2.4,.55);lg+=vec3(.9,.05,.03)*exp(-dot(rf,rf)*240.)*.18;
   vec2 dp=i==0?uL2.xy:uL2.zw;dp.x=uFl>.5?1.-dp.x:dp.x;vec2 rd=(q-dp)*vec2(iA,1.);float dd=length(rd*vec2(.8,1.6));
   lg+=vec3(.75,.86,1.)*(smoothstep(.010,.003,dd)*.9+exp(-dd*45.)*.35);}
  col=mix(col,du,nn);col+=lg*on;}

 /* E-Bike-Scheinwerfer (Abblendlicht): Lichtkegel fällt perspektivisch richtig auf die Straße (Bodenebene aus Horizont uHz), Maus = Lenker.
    Linien und Rückstrahler leuchten im Licht auf, weicher Lichtdunst über der Fahrbahn, Mücken nur im Licht; Scrollen = tiefere Nacht, Licht reicht weiter. */
 if(uHl>0.){float nn=smoothstep(.2,2.2,uS);
  float hq=max(uHz-q.y,.002);float Z=1./hq;float X=(q.x-.5)*1.5*Z;
  float th=clamp((uM.x-.5)*1.1,-.55,.55)-.05+.025*sin(uT*.6)+.01*sin(uT*2.3);
  float ang=atan(X-.95,Z)-th;
  float beam=exp(-ang*ang/.028)+.35*exp(-ang*ang/.11);
  float rng=mix(20.,32.,nn);float fall=smoothstep(rng*1.4,rng*.55,Z)*(.55+.75*exp(-pow((Z-8.)/5.5,2.)));
  float Lt=beam*fall*(1.-sky)*smoothstep(0.,.015,uHz-q.y);
  float dark=mix(.62,.30,nn);float lum=dot(col,vec3(.3,.59,.11));vec3 lit=mix(col,vec3(lum)*vec3(1.,.98,.93)*1.25,.75)*(1.+Lt*3.4);float sat=max(col.r,max(col.g,col.b))-min(col.r,min(col.g,col.b));
  float refl=smoothstep(.30,.60,lum)*(1.-smoothstep(.10,.30,sat))*(1.-sky);
  vec3 c2=col*dark+(lit-col*dark)*clamp(Lt,0.,1.);c2+=vec3(1.,.97,.90)*refl*Lt*1.6;
  float rr2=smoothstep(.5,.9,col.r-col.g*.6-col.b*.6)*(1.-sky);c2+=RED*rr2*Lt*1.4;
  float x8=(.95+tan(th)*9.)/(1.5*9.)+.5;float hzg=exp(-pow((q.x-x8)*2.6,2.))*exp(-pow((q.y-uHz+.03)/.09,2.));
  c2+=vec3(.62,.68,.80)*hzg*(.08+.06*nn)*(.85+.15*fbm(vec2(q.x*8.-uT*.08,q.y*20.)));
  float mg=0.;for(int L=0;L<2;L++){float fL=float(L);vec2 g=uv*vec2(A,1.)*(26.+fL*18.)+vec2(sin(uT*.9+fL)*.6,cos(uT*.7)*.5+uT*.12);vec2 id=floor(g);float hm=h21(id+fL*3.);
   vec2 o=vec2(sin(uT*(2.+hm*3.)+hm*40.),cos(uT*(1.7+hm*2.)+hm*13.))*.32;mg+=step(.62,hm)*smoothstep(.06,0.,length(fract(g)-.5-o));}
  c2+=vec3(1.,.96,.86)*mg*smoothstep(.15,.7,Lt+hzg*.3)*step(q.y,uHz+.06)*.8;
  vec2 lg=(uv-vec2(mob?.50:.62,-.05))*vec2(A,1.);c2+=vec3(1.,.97,.92)*exp(-length(lg)*10.)*.30;
  col=mix(col,c2,uHl);}
 /* Klick: rote Lichtwelle läuft durch die Tiefe + Ring am Klickpunkt */
 float age=uT-uK.z;
 if(age<6.){float fr=1.05-age*.42;float wvv=exp(-pow((d-fr)*24.,2.))*exp(-age*.55)*(1.-smoothstep(.2,.6,sky));
  float rg=abs(length((uv-uK.xy)*vec2(A,1.))-age*.55);float ring=smoothstep(.012,0.,rg)*exp(-age*1.2);
  col=mix(col,RED,clamp(wvv*.85+ring*.8,0.,1.));col+=vec3(1.,.7,.7)*wvv*.15;}
 /* Farbführung Rot/Grau/Weiß: Rosa/Lila raus, leicht entsättigt, klar */
 float lu=dot(col,vec3(.299,.587,.114));
 float pink=clamp(min(col.r,col.b)-col.g,0.,1.)*4.;col=mix(col,vec3(lu*1.02),clamp(pink,0.,.9));
 col=mix(vec3(lu),col,.86);col=(col-.5)*1.05+.5;
 /* Scrollen: Licht wird zum warmen Abend */
 float ev=smoothstep(.2,2.6,uS)*(1.-uDy)*(1.-min(uNt,1.))*(1.-uRl)*(1.-uHl);col=mix(col,col*vec3(1.10,.97,.86)+vec3(.03,.0,-.01),ev*.55);
 /* Tageslauf (Weinberg): Morgen kühl -> Mittag klar -> Goldene Stunde -> Dämmerung, Himmel glüht am Horizont orange-rot */
 if(uDy>0.){float tg=clamp(uTg+(1.-uTg)*uS/2.6,0.,1.);
  vec3 g1=mix(vec3(.94,.98,1.07),vec3(1.),smoothstep(0.,.3,tg));g1=mix(g1,vec3(1.18,.98,.74),smoothstep(.3,.65,tg));g1=mix(g1,vec3(.84,.62,.46),smoothstep(.65,1.,tg));
  float lum2=dot(col,vec3(.3,.59,.11));float gh=smoothstep(.3,.65,tg)*(1.-smoothstep(.75,1.,tg));col=mix(col,pow(col,vec3(1.25)),gh*.8*(1.-sky*.5));col=col*g1;col=mix(col,vec3(lum2)*vec3(.55,.6,.8),smoothstep(.8,1.,tg)*.35*(1.-sky));
  float hz=sky*smoothstep(.35,1.,tg)*(1.-smoothstep(.0,.45,q.y-.45));col=mix(col,col*vec3(1.28,.84,.42)+vec3(.15,.07,0.),hz*.85);col=(col-.5)*(1.+gh*.18)+.5;}
 /* Polarlicht-Nacht (Island): Gelände ins Mondlicht, Himmel Nachtblau, Sterne funkeln, rot-weiße Vorhänge wogen */
 if(uNt>0.){float nn=smoothstep(.25,1.9,uS);
  float lum3=dot(col,vec3(.3,.59,.11));vec3 moon=vec3(.46,.54,.76)*(.08+lum3*.55);if(uNt>1.5)moon=mix(moon*.78,col*vec3(.30,.40,.62),.40);
  vec2 aq=q;float au=0.;vec3 auC=vec3(0.);
  for(int j=0;j<3;j++){float fj=float(j);
   float fx=aq.x+.06*fbm(vec2(aq.x*1.3+fj*4.,uT*.035+fj));
   float y0=.585+fj*.055+.08*fbm(vec2(fx*1.6+uT*.03+fj*7.,fj))+.025*sin(fx*7.+uT*.21+fj*2.);
   float up=aq.y-y0;float prof=smoothstep(-.012,.006,up)*exp(-max(up,0.)*(14.-fj*3.));
   float ry=(.55+.45*nz(vec2(fx*13.-uT*.2,fj)))*(.68+.32*pow(nz(vec2(fx*95.+uT*.5+fj*30.,aq.y*1.5)),1.4));
   float br=(.45+.55*smoothstep(.25,.75,fbm(vec2(fx*3.+uT*.06,fj*3.))))*(1.-fj*.22);
   float a1=prof*ry*br;au+=a1;
   auC+=a1*mix(vec3(1.,.84,.58),mix(vec3(.95,.12,.10),vec3(.50,.03,.04),smoothstep(.06,.24,up)),smoothstep(.0,.035,up));}
  auC/=max(au,1e-4);au=clamp(au*.85,0.,1.)*step(uNt,1.5);float st2=step(1.5,uNt);
  vec3 skyN=mix(vec3(.05,.06,.11),vec3(.11,.13,.21),smoothstep(1.,.45,q.y));if(uNt>1.5)skyN=mix(vec3(.035,.045,.075),vec3(.075,.09,.13),smoothstep(1.,.45,q.y));
  vec2 st=q*vec2(iA,1.)*260.;vec2 sid=floor(st);float sh=h21(sid);float star=step(.988,sh)*smoothstep(.35,0.,length(fract(st)-.5))*(.55+.45*sin(uT*(2.+sh*5.)+sh*40.));
  /* Sternennacht (Pfälzerwald): mehr Sterne + Milchstraße, Abendglühen bleibt am Horizont, Sternschnuppe, Glühwürmchen */
  vec2 stb=q*vec2(iA,1.)*150.;float shb=h21(floor(stb)+7.);star+=st2*step(.975,shb)*smoothstep(.30,0.,length(fract(stb)-.5))*(.5+.5*sin(uT*(1.5+shb*4.)+shb*30.))*.8;
  float mw=st2*smoothstep(.42,.75,fbm(vec2((q.x+q.y*.7)*3.,(q.y-q.x*.7)*9.)))*exp(-pow(((q.y-.72)+(q.x-.5)*.45)*5.,2.));skyN+=vec3(.10,.11,.16)*mw;
  vec2 gs=(q-uSun.xy)*vec2(.55,3.4);skyN+=st2*vec3(1.,.40,.06)*exp(-length(gs)*3.0)*.62+st2*vec3(.70,.22,.04)*exp(-max(q.y-uSun.y,0.)*12.)*.26;
  float sT=uT/7.,sI=floor(sT),sF=fract(sT);vec2 sp0=vec2(.25+.6*h21(vec2(sI,3.)),.72+.22*h21(vec2(sI,8.)));vec2 sdr=normalize(vec2(.8,-.38-.3*h21(vec2(sI,5.))));
  vec2 rel=(q-sp0-sdr*sF*1.6)*vec2(iA,1.);float al=dot(rel,sdr*vec2(iA,1.)/length(sdr*vec2(iA,1.)));float pe=length(rel-al*sdr*vec2(iA,1.)/length(sdr*vec2(iA,1.)));
  star+=st2*step(sF,.16)*smoothstep(.0025,0.,pe)*smoothstep(-.09,0.,al)*step(al,0.)*1.6*step(.35,h21(vec2(sI,1.)));
  vec3 night=mix(moon,skyN+vec3(star),sky);
  if(st2>0.){float ff=0.;for(int L=0;L<2;L++){float fL=float(L);vec2 g2=uv*vec2(A,1.)*(7.+fL*5.)+vec2(sin(uT*.21+fL*3.),cos(uT*.17+fL))*.35;vec2 id2=floor(g2);float hr=h21(id2+fL*31.);
    vec2 o2=vec2(sin(uT*(.5+hr)+hr*40.),cos(uT*(.4+hr*.7)+hr*17.))*.28;float bl=smoothstep(.2,.9,sin(uT*(1.1+hr*1.7)+hr*60.)*.5+.5);
    ff+=step(.62,hr)*bl*(exp(-length(fract(g2)-.5-o2)*(26.-fL*8.))+smoothstep(.035,0.,length(fract(g2)-.5-o2))*.8);}
   night+=vec3(.98,.86,.34)*ff*(1.-sky)*smoothstep(.62,.30,q.y)*.9;}night=mix(night,night+auC*1.15,au*sky);night+=(1.-st2)*vec3(.6,.06,.05)*.10*sky*smoothstep(.55,.70,q.y)*(1.-smoothstep(.70,.95,q.y));night+=vec3(.8,.12,.06)*au*.10*(1.-sky)*smoothstep(.3,.7,lum3);
  float pk2=clamp(min(night.r,night.b)-night.g,0.,1.)*5.;night=mix(night,vec3(dot(night,vec3(.3,.59,.11))),clamp(pk2,0.,.9));
  col=mix(col,night,nn);}
 /* Lesbarkeit links: Milchglas (wie die Seite) */
 float calm=mob?.50*smoothstep(.18,.55,uv.y):smoothstep(.68,.18,uv.x)*.78;
 /* farbtreu (Tiry 22.11.: links nicht mehr schwarz-weiss): Milchglas behaelt die Farben des Fotos, nur heller + flacher */
 vec3 fr=vec3(.95,.955,.962)*.76+col*.28;float cl=dot(col,vec3(.3,.59,.11));col=mix(col,fr,min(calm*(1.08+.50*(1.-cl)),.92));/* dunkle Fotos: Schleier dichter, damit die Schrift lesbar bleibt */
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
 ['uRn','uHl','uPb','uHz','uFg','uSn','uSz','uSc','uLd','uDf','uGr','uCs','uDy','uNt','uWr','uTg','uMo','uLs','uRl','uL1','uL2','uTy','uWf','uR','uM','uFoc','uImg','uT','uS','uFl','uFp','uAm','uSp','uFade','uV','uK','uSun','uP','uD','uE','uPo'].forEach(function(n){U[n]=gl.getUniformLocation(pr,n)});
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
 gl.uniform2f(U.uImg,e.w,e.h);gl.uniform2f(U.uFoc,W/H<.9?c.fxm:c.fx,c.fy);gl.uniform1f(U.uFl,c.fl);gl.uniform2f(U.uWf,c.wf[0],c.wf[1]);gl.uniform1f(U.uFg,c.fg);gl.uniform1f(U.uSn,c.sn);var sc3=c.sc||[.98,.985,1];gl.uniform1f(U.uSz,c.sz||1);gl.uniform1f(U.uLd,c.ld||0);gl.uniform1f(U.uDf,c.df||0);gl.uniform1f(U.uGr,c.gr||0);gl.uniform1f(U.uCs,c.cs||0);gl.uniform1f(U.uDy,c.dy||0);gl.uniform1f(U.uWr,c.wr||0);gl.uniform1f(U.uMo,c.mo||0);gl.uniform1f(U.uLs,c.ls||0);gl.uniform1f(U.uRl,c.rl||0);gl.uniform1f(U.uRn,c.rn||0);gl.uniform1f(U.uHl,c.hl||0);gl.uniform1f(U.uPb,c.pb||0);gl.uniform1f(U.uHz,c.hz||.33);var l1=c.L1||[0,0,0,0],l2=c.L2||[0,0,0,0];gl.uniform4f(U.uL1,l1[0],l1[1],l1[2],l1[3]);gl.uniform4f(U.uL2,l2[0],l2[1],l2[2],l2[3]);gl.uniform1f(U.uTg,c.rt?TG0:0);gl.uniform1f(U.uNt,c.nt||0);gl.uniform3f(U.uSc,sc3[0],sc3[1],sc3[2]);gl.uniform2f(U.uTy,c.ty?c.ty[0]:0,c.ty?c.ty[1]:0);gl.uniform1f(U.uFp,c.fp);gl.uniform1f(U.uAm,c.am);gl.uniform1f(U.uSp,c.sp);
 var sx=c.sun[0],sy=c.sun[1],sz2=c.sun[2];if(c.dy){var tz0=c.rt?TG0:0,tg=Math.max(0,Math.min(1,tz0+(1-tz0)*sc/2.6));sx=.18+.70*tg;sy=.62+.34*Math.sin(Math.PI*Math.min(1,tg*1.15));sz2=c.sun[2]*(1+1.4*tg)}if(c.nt)sz2*=Math.max(0,1-sc/1.2);gl.uniform3f(U.uSun,c.fl?1-sx:sx,sy,sz2);gl.uniform1f(U.uFade,fade*fade*(3-2*fade));gl.uniform1f(U.uV,0);gl.uniform3f(U.uPo,Po[0],Po[1],Po[2]);
 gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,3)}
function click(e){if(e.target&&e.target.closest&&e.target.closest('#ueSw'))return;K=[e.clientX/innerWidth,1-e.clientY/innerHeight,(performance.now()-t0)/1000]}
function init(){cv=document.createElement('canvas');cv.id='hg';cv.setAttribute('aria-hidden','true');document.body.insertBefore(cv,document.body.firstChild);
 gl=cv.getContext('webgl',{antialias:false,alpha:false,premultipliedAlpha:false,powerPreference:'high-performance'});
 if(!gl){cv.remove();de.classList.remove('hg3');return}gl.getExtension('OES_standard_derivatives');
 try{build()}catch(err){console.error('hg15',err.message);cv.remove();de.classList.remove('hg3');return}
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
 b.addEventListener('click',function(e){var x=e.target.closest('button');if(!x)return;e.stopPropagation();mode=x.dataset.hg;try{localStorage.setItem('vc_hg15',mode)}catch(_){}load(mode);pose();up();tip()});
 var tt=0;function tip(){var n=document.getElementById('ueTip');if(!n){n=document.createElement('div');n.id='ueTip';document.body.appendChild(n)}
  var i=MODES.findIndex(function(m){return m[0]===mode}),m=MODES[i];n.innerHTML='<b>Hintergrund '+(i+1)+'</b> · '+m[1]+' – '+m[2];n.classList.remove('on');void n.offsetWidth;n.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){n.classList.remove('on')},2800)}
 up();setTimeout(tip,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

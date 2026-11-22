/* 1 · Flüssigmetall: das Band ist eine Fläche aus flüssigem Chrom (Höhenfeld in Echtzeit). Die Buchstaben steigen rechts als
   Chrom-Relief aus dem Metall auf und versinken links wieder. Spiegelung eines Studio-Lichts mit roten Neon-Leisten (Fresnel).
   Maus = Wellen im Metall (gedämpfte Ringwellen), Scrollen = Unruhe in der Oberfläche. */
(function(){var RP=[],last=null,acc=0;
var FS='precision highp float;uniform vec2 uR,uM;uniform float uS,uO,uT,uV,uOv,uD;uniform vec4 uRp[8];\n'+LBG.GLSL+'\
float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+1.),f.x),f.y);}\
vec2 TX(vec2 p){return tx(vec2((p.x+uO)*uS,(uR.y*.5-p.y)*uS));}\
float HF(vec2 p,out float red){vec2 t=TX(p);red=t.y;float xs=p.x/uR.x;\
 float tt=clamp((1.6-t.x)/6.5,0.,1.);float em=smoothstep(1.03,.84,xs)*smoothstep(-.03,.13,xs);\
 float h=sqrt(tt*(2.-tt))*2.8*uD*(.1+.9*em);\
 h+=(n2(p/uD*vec2(.010,.045)+vec2(uT*.22,-uT*.13))-.5)*1.1*uD*(1.+uV*2.5)+(n2(p/uD*vec2(.03,.09)-vec2(uT*.5,0.))-.5)*.8*uD;\
 for(int i=0;i<8;i++){vec4 r=uRp[i];if(r.w>0.){float d=length(p-r.xy)/uD;float a=r.z;float fr=smoothstep(a*150.+14.,a*150.-6.,d);\
  h+=r.w*uD*sin(d*.17-a*9.)*exp(-a*1.8)*exp(-d*.010)*fr;}}\
 float ey=min(p.y,uR.y-p.y)/uD;h-=pow(max(0.,1.-ey/7.5),2.)*9.*uD;return h;}\
vec3 env(vec3 r,float sx){float y=r.y,x=r.x;vec3 c=vec3(.010,.011,.014);\
 c+=vec3(.92,.95,1.)*smoothstep(.05,.75,y)*1.15+vec3(1.)*smoothstep(.04,0.,abs(y-.42))*.8;\
 c+=vec3(.55,.58,.64)*smoothstep(.05,.8,-x)*smoothstep(-.4,.2,y)*.7;\
 c+=vec3(1.,.06,.09)*smoothstep(-.08,-.7,y)*1.25;\
return c;}\
void main(){vec2 p=gl_FragCoord.xy;float e=1.25*uD,rd,r2;float h=HF(p,rd);\
 float hx=HF(p+vec2(e,0.),r2)-HF(p-vec2(e,0.),r2),hy=HF(p+vec2(0.,e),r2)-HF(p-vec2(0.,e),r2);\
 vec3 N=normalize(vec3(-hx/(2.*e),-hy/(2.*e),1.));vec3 V=vec3(0.,0.,1.);vec3 R=reflect(-V,N);float sx=p.x/uR.x;\
 float fr=.55+.45*pow(1.-N.z,1.5);vec3 c=env(R,sx)*fr;\
 vec3 L=normalize(vec3((uM-p)/uR.x*1.2,.55));float sp=pow(max(0.,dot(N,normalize(L+V))),90.)*uOv;c+=vec3(1.)*sp*.9*clamp(h/(2.*uD),0.,1.);\
 vec3 tint=mix(vec3(.93,.95,1.),vec3(1.,.16,.18),rd);float lift=clamp(h/(5.*uD),0.,1.);vec3 lc=(c+vec3(.16,.17,.19))*tint;c=mix(c,lc,lift);\
 c+=vec3(1.,.1,.12)*rd*lift*.10;\
 float ey=min(p.y,uR.y-p.y);float a=smoothstep(0.,1.5*uD,ey);gl_FragColor=vec4(c*a,a);}';
LBG.add('Flüssigmetall','Schrift steigt als Chrom aus flüssigem Metall – Maus wirft Wellen',{cls:'lbY1',fs:FS,dpr:1.5,
 frame:function(R,st,dt,W,H,d,r){acc+=dt;var inb=st.cy>r.top-10&&st.cy<r.bottom+10;
  if(inb){var p=[(st.cx-r.left)*d,(r.bottom-st.cy)*d];if(!last||Math.hypot(p[0]-last[0],p[1]-last[1])>34*d){RP.push([p[0],p[1],0,acc<.6?.8:1.2]);last=p;acc=0}}
  if(!inb)last=null;if(!inb&&acc>2.6){RP.push([W*(.15+Math.random()*.7),H*(.2+Math.random()*.6),0,.7]);acc=0}
  RP.forEach(function(q){q[2]+=dt});RP=RP.filter(function(q){return q[2]<3.2}).slice(-8);var a=new Float32Array(32);RP.forEach(function(q,i){a.set(q,i*4)});
  R.gl.uniform4fv(R.U('uRp'),a)}});
})();

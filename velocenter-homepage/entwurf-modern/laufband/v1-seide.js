/* 1 · Seidenband 3D – zwei echte WebGL-Bänder aus Lack (rot) und Graphit, die sich in Wellen drehen.
   Licht + Satin-Glanzlinien folgen der Drehung, die Schrift liegt auf der Oberfläche, der Zeiger zieht das Band an. */
(function(){var G=null;
var VS='attribute vec2 a;uniform vec2 uR;uniform float uT,uCy,uH,uTl,uAm,uK,uSp,uTw,uPh,uSh,uMx,uMa;varying vec2 vP;varying float vV,vTh,vSl;\
void main(){float x=a.x*uR.x;float ph=a.x*uK*6.2832-uT*uSp+uPh;\
float lift=-exp(-pow((x-uMx)/190.,2.))*uMa;\
float yc=uCy+uTl*(x-uR.x*.5)+uAm*sin(ph)+lift;\
float th=uTw*sin(ph*.72+1.3+uT*.35);float hh=uH*.5*max(.25,cos(th));\
float y=yc+(a.y-.5)*2.*hh+uSh*uH*.38;\
vP=vec2(x,y);vV=a.y;vTh=th;vSl=uTl+uAm*cos(ph)*uK*6.2832/uR.x;\
gl_Position=vec4(x/uR.x*2.-1.,1.-y/uR.y*2.,0.,1.);}';
var FS='precision highp float;uniform sampler2D uX;uniform vec2 uR,uTx;uniform float uOf,uSh,uBk,uMx,uMy,uOv;uniform vec3 uC0,uC1,uC2;varying vec2 vP;varying float vV,vTh,vSl;\
void main(){if(uSh>.5){float s=sin(vV*3.1416);gl_FragColor=vec4(0.,0.,0.,.20*s*s);return;}\
float cs=cos(vTh),sn=sin(vTh);float bul=(vV-.5)*1.15;\
vec3 n=normalize(vec3(-vSl*.8,sn+bul*.55,cs));\
vec3 L=normalize(vec3((uMx-vP.x)/uR.x*1.6*uOv+.25,(vP.y-uMy)/uR.y*1.2*uOv+.55,1.));\
float dif=.42+.58*max(0.,dot(n,L));\
float sat=pow(max(0.,1.-abs(n.y-.42)*2.6),3.)*.55+pow(max(0.,1.-abs(n.y+.25)*4.),6.)*.25;\
vec3 H=normalize(L+vec3(0.,0.,1.));float sp=pow(max(0.,dot(n,H)),70.);\
vec3 col=mix(uC0,uC1,smoothstep(.0,1.,dif))*dif+uC2*sat+vec3(1.)*sp*.55;\
float tv=(vV-.13)/.74;float tu=fract((vP.x+uOf)/uTx.x);\
float t=0.;vec4 tx=vec4(0.);if(tv>0.&&tv<1.){tx=texture2D(uX,vec2(tu,tv));}\
col=mix(col,tx.rgb/max(tx.a,.001)*(.82+.25*dif)+sp*.3,tx.a*(uBk>.5?.85:1.));\
float e=smoothstep(.0,.035,vV)*smoothstep(1.,.965,vV);col+=vec3(1.,.86,.88)*(1.-smoothstep(.0,.05,min(vV,1.-vV)))*.35*(.5+.5*cs);\
gl_FragColor=vec4(col,1.);}';
function sh(gl,t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(o);return o}
function base(){var l=document.querySelector('link[rel="icon"]');return l?l.getAttribute('href').replace('favicon.png',''):''}
/* Schrift-Textur: gleiche Inhalte und Farben wie das echte Laufband */
function tex(txt,outline,img){var F=84,H=112,sk=-.158,c=document.createElement('canvas'),x=c.getContext('2d'),font='900 '+F+'px Outfit,ui-sans-serif,system-ui,sans-serif';
 x.font=font;var items=txt.split('|'),gap=F*.62;
 function parts(it){var out=[];it.toUpperCase().split(/(★|I:SY'S|I:SY|BOSCH|300\+|GOOGLE)/).forEach(function(p){if(!p)return;
  if(p==='GOOGLE')out.push({g:1,t:'GOOGLE'});else if(p==='BOSCH')out.push({b:1,t:'BOSCH'});
  else out.push({t:p.indexOf('I:SY')===0?p.replace('I:SY','i:SY'):p,c:p==='★'||p==='300+'?'#FFC83D':p.indexOf('I:SY')===0?'#FF7A00':null})});return out}
 function wd(p){x.font=font;var w=x.measureText(p.t).width;return p.g?w+F*.6:p.b?w+F*1.25:w}
 var W=0;items.forEach(function(it){parts(it).forEach(function(p){W+=wd(p)});W+=gap*2+F*.5});
 var M=G&&G.max?G.max:4096,sc=Math.min(1,M/W);c.width=Math.ceil(W*sc);c.height=Math.ceil(H*sc);x.scale(sc,sc);x.font=font;x.textBaseline='middle';
 var X=0,y=H*.53;
 function pill(x0,w,fill){x.save();x.transform(1,0,sk,1,-sk*y,0);x.beginPath();var r=F*.42,t=y-F*.48,b=y+F*.44;x.moveTo(x0+r,t);x.lineTo(x0+w-r,t);x.arc(x0+w-r,(t+b)/2,(b-t)/2,-Math.PI/2,Math.PI/2);x.lineTo(x0+r,b);x.arc(x0+r,(t+b)/2,(b-t)/2,Math.PI/2,-Math.PI/2);x.fillStyle=fill;x.fill();x.restore()}
 items.forEach(function(it){parts(it).forEach(function(p){var w=wd(p);
   x.save();x.transform(1,0,sk,1,-sk*y,0);
   if(p.g){x.restore();pill(X,w,outline?'rgba(255,255,255,.18)':'#fff');x.save();x.transform(1,0,sk,1,-sk*y,0);var gx=X+F*.3;['#4285F4','#EA4335','#FBBC05','#4285F4','#34A853','#EA4335'].forEach(function(cc,i){x.fillStyle=cc;x.fillText(p.t[i],gx,y);gx+=x.measureText(p.t[i]).width})}
   else if(p.b){x.restore();pill(X,w,outline?'rgba(255,255,255,.18)':'#fff');x.save();if(img&&img.complete&&img.naturalWidth)x.drawImage(img,0,0,img.naturalHeight,img.naturalHeight,X+F*.34,y-F*.36,F*.72,F*.72);x.transform(1,0,sk,1,-sk*y,0);x.fillStyle='#ED0007';x.fillText(p.t,X+F*1.1,y)}
   else if(outline){x.lineWidth=2.4;x.strokeStyle=p.c||'rgba(255,255,255,.55)';x.strokeText(p.t,X,y)}
   else{x.fillStyle=p.c||'#fff';x.shadowColor='rgba(60,0,10,.35)';x.shadowOffsetY=3;x.shadowBlur=6;x.fillText(p.t,X,y)}
   x.restore();X+=w});
  X+=gap;x.save();x.translate(X+F*.25,y);x.fillStyle='#5EEAD4';x.shadowColor='rgba(94,234,212,.9)';x.shadowBlur=18;var s=F*.3;x.beginPath();
  for(var k=0;k<8;k++){var r=k%2?s*.32:s,a=k*Math.PI/4-Math.PI/2;x.lineTo(Math.cos(a)*r,Math.sin(a)*r)}x.fill();x.restore();X+=F*.5+gap});
 return {c:c,w:W}}
function build(bt){var cv=document.createElement('canvas');cv.className='lbS';cv.setAttribute('aria-hidden','true');bt.appendChild(cv);
 var gl=cv.getContext('webgl',{antialias:true,premultipliedAlpha:false,alpha:true});if(!gl){cv.remove();return null}
 var p=gl.createProgram();gl.attachShader(p,sh(gl,gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);gl.useProgram(p);
 var N=220,d=[];for(var i=0;i<=N;i++){var u=-.03+1.06*i/N;d.push(u,0,u,1)}var bf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(d),gl.STATIC_DRAW);
 var al=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(al);gl.vertexAttribPointer(al,2,gl.FLOAT,false,0,0);
 var U={};['uR','uT','uCy','uH','uTl','uAm','uK','uSp','uTw','uPh','uSh','uMx','uMa','uMy','uOv','uX','uTx','uOf','uBk','uC0','uC1','uC2'].forEach(function(k){U[k]=gl.getUniformLocation(p,k)});
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 var g={cv:cv,gl:gl,U:U,N:N,max:gl.getParameter(gl.MAX_TEXTURE_SIZE),tx:[null,null],tw:[1,1],off:[0,0],src:'',img:new Image(),mx:-1e4,ma:0};
 g.img.onload=function(){g.src=''};g.img.src=base()+'img/zub-bosch.svg';return g}
function upTex(g,bt){var ts=[].map.call(bt.querySelectorAll('.band .tk'),function(t){return t.dataset.t||''});var key=ts.join('#');if(key===g.src)return;g.src=key;
 var gl=g.gl;[0,1].forEach(function(i){var T=tex(ts[i]||'',i===0,g.img);var t=g.tx[i]||gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,T.c);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);g.tx[i]=t;g.tw[i]=T.w})}
LBV.push({name:'Seidenband 3D',info:'Lackband dreht sich in Wellen, Licht folgt der Maus',
 on:function(bt){if(!G){try{G=build(bt)}catch(e){console.error('lbS',e);G=null}}if(G)G.cv.style.display='';G&&(G.src='');
  if(document.fonts&&document.fonts.load)document.fonts.load('900 84px Outfit').then(function(){if(G)G.src=''})},
 off:function(){if(G)G.cv.style.display='none'},
 tick:function(st,dt){if(!G)return;var g=G,gl=g.gl,U=g.U,bt=st.bt,r=g.cv.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
  if(!r.width)return;var W=Math.round(r.width*dpr),H=Math.round(r.height*dpr);if(g.cv.width!==W||g.cv.height!==H){g.cv.width=W;g.cv.height=H;gl.viewport(0,0,W,H)}
  upTex(g,bt);if(!g.tx[0])return;
  var mob=r.width<760,bh=(mob?30:Math.min(58,Math.max(36,r.width*.032)))*dpr,ov=st.over?1:0;
  g.ma+=((st.over?1:0)-g.ma)*Math.min(1,dt*4);var mx=(st.cx-r.left)*dpr,my=(st.cy-r.top)*dpr;
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(U.uR,W,H);gl.uniform1f(U.uT,st.T);gl.uniform1f(U.uMx,mx);gl.uniform1f(U.uMy,my);gl.uniform1f(U.uOv,g.ma);
  var sp=(mob?70:110)*dpr*(1+st.v*1.8);g.off[0]=(g.off[0]-dt*sp*.8)%1e7;g.off[1]=(g.off[1]+dt*sp)%1e7;
  /* hinten: Graphit (Umriss-Schrift), vorne: roter Lack */
  var R=[{i:0,cy:H*.5-bh*.1,tl:.022,am:(5+st.v*5)*dpr,k:1.05,spd:.55,tw:.55,ph:2.1,c0:[.10,.11,.13],c1:[.30,.32,.37],c2:[.55,.58,.66],bk:1},
         {i:1,cy:H*.5+bh*.05,tl:-.028,am:(7+st.v*8)*dpr,k:.85,spd:.75,tw:.7,ph:0,c0:[.36,.02,.07],c1:[.93,.12,.17],c2:[1.,.58,.62],bk:0}];
  R.forEach(function(b){var th=b.i===0?bh*.92:bh;var tsc=th*.74/(112*(g.tw[b.i]>0?1:1));
   gl.uniform1f(U.uCy,b.cy);gl.uniform1f(U.uH,th);gl.uniform1f(U.uTl,b.tl);gl.uniform1f(U.uAm,b.am);gl.uniform1f(U.uK,b.k);gl.uniform1f(U.uSp,b.spd*(1+st.v));
   gl.uniform1f(U.uTw,b.tw*(1+st.v*.25));gl.uniform1f(U.uPh,b.ph);gl.uniform1f(U.uMa,(b.i?16:9)*dpr*g.ma);
   gl.uniform3fv(U.uC0,b.c0);gl.uniform3fv(U.uC1,b.c1);gl.uniform3fv(U.uC2,b.c2);gl.uniform1f(U.uBk,b.bk);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,g.tx[b.i]);gl.uniform1i(U.uX,0);gl.uniform2f(U.uTx,g.tw[b.i]*tsc,0);gl.uniform1f(U.uOf,g.off[b.i]);
   gl.uniform1f(U.uSh,1);gl.drawArrays(gl.TRIANGLE_STRIP,0,(g.N+1)*2);gl.uniform1f(U.uSh,0);gl.drawArrays(gl.TRIANGLE_STRIP,0,(g.N+1)*2)})}});
})();

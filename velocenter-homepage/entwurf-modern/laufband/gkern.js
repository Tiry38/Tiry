/* Gemeinsamer WebGL-Kern der Laufbänder „2200“ (Tiry 22.11.2026: „bahnbrechend, Wunderwerk der Technik“).
   Die Laufband-Schrift wird als Signed-Distance-Field (Felzenszwalb-EDT) in eine Textur gerechnet – wie in Spiele-Engines.
   Damit können die Shader die Buchstaben als echte Geometrie behandeln (Höhe, 3D-Körper, Brechung). Endlos nahtlos (mod). */
(function(){var G=window.LBG={},INF=1e20,BI=null,BOK=false;
G.prog=function(gl,FS){function s(t,x){var o=gl.createShader(t);gl.shaderSource(o,x);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(o);return o}
 var p=gl.createProgram();gl.attachShader(p,s(gl.VERTEX_SHADER,'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));gl.attachShader(p,s(gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw gl.getProgramInfoLog(p);gl.useProgram(p);
 var b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 var l=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);
 var U={};return function(n){if(!(n in U))U[n]=gl.getUniformLocation(p,n);return U[n]}};
/* Schrift-Abfrage im Shader: q = Streifen-Koordinate (Textur-Pixel, y relativ zur Mitte) → (Abstand, Rot-Anteil) */
G.GLSL='uniform sampler2D uTx;uniform vec4 uTA;uniform vec2 uTS;uniform float uSW,uSP;\n\
vec2 tx(vec2 q){float y=q.y+uTA.y*.5;if(y<1.||y>uTA.y-1.)return vec2(uSP,0.);float u=mod(q.x,uSW);float k=floor(u/uTA.x);\n\
vec4 t=texture2D(uTx,vec2(u-k*uTA.x+uTA.z,y+k*uTA.y)/uTS);return vec2((.5-t.r)*2.*uSP,t.g);}\n';
function e1(g,o,st,n,f,v,z){v[0]=0;z[0]=-INF;z[1]=INF;f[0]=g[o];
 for(var q=1,k=0,s=0;q<n;q++){f[q]=g[o+q*st];var q2=q*q;do{var r=v[k];s=(f[q]-f[r]+q2-r*r)/(q-r)/2}while(s<=z[k]&&--k>-1);k++;v[k]=q;z[k]=s;z[k+1]=INF}
 for(q=0,k=0;q<n;q++){while(z[k+1]<q)k++;var r2=v[k],qr=q-r2;g[o+q*st]=f[r2]+qr*qr}}
function edt(g,w,h){var m=Math.max(w,h),f=new Float64Array(m),v=new Uint32Array(m),z=new Float64Array(m+1);
 for(var x=0;x<w;x++)e1(g,x,w,h,f,v,z);for(var y=0;y<h;y++)e1(g,y*w,1,w,f,v,z)}
function bosch(){if(BI)return;var r=document.querySelector('.bands.top .band.a b.tkb');if(!r)return;
 var u=(getComputedStyle(r,'::before').backgroundImage||'').match(/url\(["']?([^"')]+)/);if(!u)return;BI=new Image();BI.onload=function(){BOK=true;G.ver++};BI.src=u[1]}
G.ver=0;
/* Streifen bauen: Großbuchstaben, gesperrt; ★ und 300+ rot; Trenner = roter Strich; Bosch-Emblem als Zeichen */
G.strip=function(txt,need,gl){bosch();var fs=40,ls=fs*.2,RH=84,SP=10,F='600 '+fs+'px Outfit,ui-sans-serif,system-ui,sans-serif',items=txt.split('|').filter(Boolean);
 var c=document.createElement('canvas'),x=c.getContext('2d');x.font=F;
 function runs(it){var o=[];it.toUpperCase().replace(/I:SY/g,'i:SY').split(/(★|300\+)/).forEach(function(p){if(p)o.push([p,p==='★'||p==='300+'])});return o}
 function tw(s){var w=0;for(var i=0;i<s.length;i++)w+=x.measureText(s[i]).width+ls;return w}
 var gap=fs*3.4,one=0;items.forEach(function(it){if(/^BOSCH/i.test(it))one+=fs*1.45;runs(it).forEach(function(q){one+=tw(q[0])});one+=gap});
 var rep=Math.max(1,Math.ceil(need/one)),SW=Math.ceil(one*rep);c.width=SW;c.height=RH;
 var r=document.createElement('canvas');r.width=SW;r.height=RH;var y=r.getContext('2d');
 [x,y].forEach(function(k){k.font=F;k.textBaseline='middle';k.fillStyle='#fff'});var X=0,M=RH/2+1;
 for(var n=0;n<rep;n++)items.forEach(function(it){
  if(/^BOSCH/i.test(it)){if(BOK){var e=document.createElement('canvas');e.width=e.height=fs;var ex=e.getContext('2d');var sq=BI.naturalHeight||BI.height||fs;ex.drawImage(BI,0,0,sq,sq,0,0,fs,fs);
    ex.globalCompositeOperation='source-in';ex.fillStyle='#fff';ex.fillRect(0,0,fs,fs);x.drawImage(e,X,M-fs*.5,fs*.9,fs*.9)}X+=fs*1.45}
  runs(it).forEach(function(q){for(var i=0;i<q[0].length;i++){var ch=q[0][i];x.fillText(ch,X,M);if(q[1])y.fillText(ch,X,M);X+=x.measureText(ch).width+ls}});
  x.fillRect(X+gap*.5-fs*.32,M-2,fs*.64,4);y.fillRect(X+gap*.5-fs*.32,M-2,fs*.64,4);X+=gap});
 var a=x.getImageData(0,0,SW,RH).data,red=y.getImageData(0,0,SW,RH).data,N=SW*RH,go=new Float64Array(N),gi=new Float64Array(N),i;
 for(i=0;i<N;i++){var al=a[i*4+3]/255;go[i]=al===1?0:al===0?INF:Math.pow(Math.max(0,.5-al),2);gi[i]=al===1?INF:al===0?0:Math.pow(Math.max(0,al-.5),2)}
 edt(go,SW,RH);edt(gi,SW,RH);
 var mx=gl.getParameter(gl.MAX_TEXTURE_SIZE),pad=16,RW=Math.min(2048,mx-2*pad),rows=Math.ceil(SW/RW),TW=RW+2*pad,TH=rows*RH;
 if(TH>mx){RW=Math.min(mx-2*pad,4096);rows=Math.ceil(SW/RW);TW=RW+2*pad;TH=rows*RH}
 var out=new Uint8Array(TW*TH*4);
 for(var k=0;k<rows;k++)for(var yy=0;yy<RH;yy++)for(var j=0;j<TW;j++){var sx=((k*RW+j-pad)%SW+SW)%SW,si=yy*SW+sx,o=((k*RH+yy)*TW+j)*4,d=Math.sqrt(go[si])-Math.sqrt(gi[si]);
  out[o]=Math.max(0,Math.min(255,Math.round((.5-d/(2*SP))*255)));out[o+1]=red[si*4+3];out[o+3]=255}
 var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,TW,TH,0,gl.RGBA,gl.UNSIGNED_BYTE,out);
 [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER].forEach(function(p){gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR)});
 [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(function(p){gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE)});
 return {t:t,RW:RW,RH:RH,pad:pad,TW:TW,TH:TH,SW:SW,SP:SP,fs:fs}};
G.bind=function(gl,U,S,unit){gl.activeTexture(gl.TEXTURE0+(unit||0));gl.bindTexture(gl.TEXTURE_2D,S.t);gl.uniform1i(U('uTx'),unit||0);
 gl.uniform4f(U('uTA'),S.RW,S.RH,S.pad,0);gl.uniform2f(U('uTS'),S.TW,S.TH);gl.uniform1f(U('uSW'),S.SW);gl.uniform1f(U('uSP'),S.SP)};
/* Ein Band-Renderer: Canvas, Schrift-Streifen, Lauf-Versatz; jede Variante liefert nur Shader + eigene Uniforms */
G.band=function(o){var R={o:o,cv:null,gl:null,U:null,S:null,key:'',pos:0,ov:0};
 R.on=function(bt){if(!R.cv){var a=bt.querySelector('.band.a');R.cv=document.createElement('canvas');R.cv.className=o.cls;R.cv.setAttribute('aria-hidden','true');a.insertBefore(R.cv,a.firstChild);
   try{R.gl=R.cv.getContext('webgl',{antialias:false,alpha:true,premultipliedAlpha:true});R.U=G.prog(R.gl,o.fs);o.init&&o.init(R)}catch(e){console.error(o.cls,e);R.gl=null}}
  R.cv.style.display='';R.key=''};
 R.off=function(){if(R.cv)R.cv.style.display='none'};
 R.tick=function(st,dt){if(!R.gl)return;var gl=R.gl,r=R.cv.getBoundingClientRect(),d=Math.min(o.dpr||1.5,devicePixelRatio||1),W=Math.round(r.width*d),H=Math.round(r.height*d);if(!W||!H)return;
  if(R.cv.width!==W||R.cv.height!==H){R.cv.width=W;R.cv.height=H;gl.viewport(0,0,W,H)}
  var mob=innerWidth<=980,fc=mob?15:Math.min(23,Math.max(16,innerWidth*.0155)),txt=(st.bt.querySelector('.band.a .tk')||{dataset:{}}).dataset.t||'';
  var key=txt+'|'+Math.round(innerWidth/50)+'|'+G.ver;
  if(key!==R.key&&(!document.fonts||document.fonts.check('600 20px Outfit'))){R.key=key;if(R.S)gl.deleteTexture(R.S.t);R.S=G.strip(txt,innerWidth*40/fc+400,gl)}
  if(!R.S)return;var inb=st.cy>r.top-70&&st.cy<r.bottom+70;R.ov+=((inb?1:0)-R.ov)*Math.min(1,dt*5);
  R.pos+=dt*(mob?52:74)*(1+st.v*1.8);var s=R.S.fs/(fc*d),U=R.U;
  G.bind(gl,U,R.S,0);gl.uniform2f(U('uR'),W,H);gl.uniform1f(U('uS'),s);gl.uniform1f(U('uO'),(R.pos*d)%(R.S.SW/s));gl.uniform1f(U('uT'),st.T);
  gl.uniform1f(U('uV'),st.v);gl.uniform1f(U('uOv'),R.ov);gl.uniform1f(U('uD'),d);gl.uniform2f(U('uM'),(st.cx-r.left)*d,(r.bottom-st.cy)*d);
  o.frame&&o.frame(R,st,dt,W,H,d,r);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)};
 (G.all=G.all||[]).push(R);return R};
G.add=function(name,info,o){var R=G.band(o);LBV.push({name:name,info:info,on:R.on,off:R.off,tick:R.tick})};
})();

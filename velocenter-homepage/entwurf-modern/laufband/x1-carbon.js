/* 1 · Carbon-Plasma: Echtzeit-Shader – 2/2-Köper-Carbongeflecht mit anisotropem Glanz (Licht = Maus, sonst wandernd),
   Klarlack-Reflex, an den Kanten fließt rotes Plasma; Scrollen beschleunigt den Energiefluss. */
(function(){var C=null;
var FS='precision highp float;uniform vec2 uR,uM;uniform float uT,uS,uV,uOv,uD;\
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}\
void main(){vec2 px=gl_FragCoord.xy;vec2 g=px/(uD*5.2);vec2 c=floor(g),f=fract(g);\
bool hz=mod(c.x+c.y,4.)<2.;float a=hz?f.y:f.x;float bul=(a-.5)*2.;\
vec3 N=hz?normalize(vec3(0.,bul*.8,1.)):normalize(vec3(bul*.8,0.,1.));vec3 T=hz?vec3(1.,0.,0.):vec3(0.,1.,0.);\
float fib=.82+.18*sin(a*70.+n(c*2.3)*7.);\
vec2 lp=mix(vec2(uR.x*(.5+.48*sin(uT*.21+uS*1.7)),uR.y*2.2),uM,uOv);\
vec3 L=normalize(vec3((lp-px)/uR.x*1.6,.75));vec3 H=normalize(L+vec3(0.,0.,1.));\
float th=dot(T,H);float an=pow(sqrt(max(0.,1.-th*th)),120.);float sp=pow(max(0.,dot(N,H)),36.);\
float gap=smoothstep(0.,.1,a)*smoothstep(1.,.9,a);\
vec3 col=vec3(.022,.023,.027)*fib+vec3(.55,.58,.66)*(an*.55+sp*.18)*fib*(1.-.5*bul*bul);col*=.5+.5*gap;\
float xs=px.x/uR.x,ys=px.y/uR.y;float cc=exp(-pow((xs-fract(uT*.045))*5.-ys*.9,2.)*10.);col+=vec3(.85,.87,.92)*cc*.07;\
col*=.85+.3*smoothstep(0.,1.,ys);\
float e=min(px.y,uR.y-px.y)/uD;float fl=n(vec2(px.x/uD*.018-uT*2.2*(1.+uV*1.5),ys*4.+uT*.3))*.65+n(vec2(px.x/uD*.07+uT*3.4,ys*12.))*.35;\
float pl=exp(-e*.42)*(.35+fl*1.1);float ps=fract(uT*.13*(1.+uV*2.));float d=xs-ps;pl+=exp(-d*d*260.)*exp(-e*.25)*1.6;\
float mm=exp(-pow(length((px-uM)/uD)/90.,2.))*uOv;pl+=mm*exp(-e*.35)*.9;\
col+=vec3(1.,.07,.12)*pl+vec3(1.,.55,.55)*pow(pl,3.)*.35;\
gl_FragColor=vec4(col,1.);}';
function mk(band){var cv=document.createElement('canvas');cv.className='lbC';band.insertBefore(cv,band.firstChild);
 var gl=cv.getContext('webgl',{antialias:false,alpha:false});if(!gl){cv.remove();return null}
 function s(t,x){var o=gl.createShader(t);gl.shaderSource(o,x);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(o);return o}
 var p=gl.createProgram();gl.attachShader(p,s(gl.VERTEX_SHADER,'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));gl.attachShader(p,s(gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);gl.useProgram(p);
 var b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 var l=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);
 var U={};['uR','uM','uT','uS','uV','uOv','uD'].forEach(function(k){U[k]=gl.getUniformLocation(p,k)});return {cv:cv,gl:gl,U:U,ov:0}}
LBV.push({name:'Carbon-Plasma',info:'Echtzeit-Carbon mit Lichtreflex, rotes Plasma an den Kanten',
 on:function(bt){if(!C){try{C=mk(bt.querySelector('.band.a'))}catch(e){console.error('lbC',e)}}if(C)C.cv.style.display=''},
 off:function(){if(C)C.cv.style.display='none'},
 tick:function(st,dt){if(!C)return;var gl=C.gl,U=C.U,band=C.cv.parentNode,r=band.getBoundingClientRect(),d=Math.min(1.5,devicePixelRatio||1);
  var W=Math.round(band.offsetWidth*d),H=Math.round(band.offsetHeight*d);if(!W)return;if(C.cv.width!==W||C.cv.height!==H){C.cv.width=W;C.cv.height=H;gl.viewport(0,0,W,H)}
  var inb=st.cy>r.top-80&&st.cy<r.bottom+80;C.ov+=((inb?1:0)-C.ov)*Math.min(1,dt*5);
  gl.uniform2f(U.uR,W,H);gl.uniform2f(U.uM,(st.cx-r.left)*d,(r.bottom-st.cy)*d);gl.uniform1f(U.uT,st.T);gl.uniform1f(U.uS,scrollY/innerHeight);
  gl.uniform1f(U.uV,st.v);gl.uniform1f(U.uOv,C.ov);gl.uniform1f(U.uD,d);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}});
})();

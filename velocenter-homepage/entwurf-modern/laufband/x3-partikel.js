/* 3 · Partikel-Schrift: die Schrift besteht aus tausenden Lichtpunkten (WebGL). Rechts setzen sie sich aus rotem Strom zusammen,
   links zerfallen sie zu roter Glut; die Maus ist ein Kraftfeld, das sie wegdrückt. Scrollen = schneller. */
(function(){var P=null;
var VS='attribute vec2 h;attribute vec3 c;attribute vec2 r;uniform vec2 uR,uM;uniform float uOf,uSW,uCy,uT,uV,uOv,uD,uSH;varying vec3 vC;varying float vA;\
void main(){float x=mod(h.x-uOf,uSW)-60.*uD;float y=uCy+(h.y-uSH*.5);float e=x/uR.x;\
float kin=1.-smoothstep(.80,.97,e);float kout=smoothstep(.0,.15,e);float k=1.-min(kin,kout);float L=e<.5?1.:0.;\
vec2 off=vec2((r.x-.5)*(L>.5?-160.:140.)-(L>.5?60.:-90.)*k,(r.y-.5)*110.)*uD*k*k+vec2(sin(uT*2.+r.x*40.),cos(uT*1.7+r.y*30.))*7.*uD*k;\
vec2 p=vec2(x,y)+off;vec2 d=p-uM;float dl=length(d)/uD;float f=max(0.,1.-dl/120.);p+=normalize(d+.001)*f*f*44.*uD*uOv;\
vC=mix(c,vec3(1.,.12,.16),smoothstep(.08,.3,k+f*uOv*.9));vA=1.-k*k*.85;\
gl_PointSize=uD*(1.75+k*1.4+f*uOv*.8);gl_Position=vec4(p.x/uR.x*2.-1.,1.-p.y/uR.y*2.,0.,1.);}';
var FS='precision mediump float;varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.32,d)*vA;gl_FragColor=vec4(vC*a,a);}';
function strip(txt,fs,need){var items=txt.split('|'),c=document.createElement('canvas'),x=c.getContext('2d'),F='600 '+fs+'px Outfit,ui-sans-serif,system-ui,sans-serif',ls=fs*.2,H=Math.ceil(fs*1.6);
 function runs(it){var o=[];it.toUpperCase().replace(/I:SY/g,'i:SY').split(/(★|300\+)/).forEach(function(p){if(p)o.push([p,p==='★'||p==='300+'?'#FF2A36':'#F2F3F5'])});return o}
 x.font=F;function tw(s){return x.measureText(s).width+ls*s.length}
 var seq=[],W=0;while(W<need){items.forEach(function(it){var r=runs(it);r.forEach(function(q){W+=tw(q[0])});W+=fs*3.2;seq.push(r)})}
 c.width=Math.ceil(W);c.height=H;x.font=F;x.textBaseline='middle';var X=0;
 seq.forEach(function(r){r.forEach(function(q){x.fillStyle=q[1];for(var i=0;i<q[0].length;i++){x.fillText(q[0][i],X,H/2);X+=x.measureText(q[0][i]).width+ls}});
  x.fillStyle='#FF2A36';x.fillRect(X+fs*1.6-fs*.5,H/2-1,fs,2);X+=fs*3.2});return {c:c,w:W,h:H}}
function build(bt){var cv=document.createElement('canvas');cv.className='lbP';cv.setAttribute('aria-hidden','true');bt.appendChild(cv);
 var gl=cv.getContext('webgl',{antialias:false,premultipliedAlpha:true,alpha:true});if(!gl){cv.remove();return null}
 function s(t,x){var o=gl.createShader(t);gl.shaderSource(o,x);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(o);return o}
 var p=gl.createProgram();gl.attachShader(p,s(gl.VERTEX_SHADER,VS));gl.attachShader(p,s(gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);gl.useProgram(p);
 var U={};['uR','uM','uOf','uSW','uCy','uT','uV','uOv','uD','uSH'].forEach(function(k){U[k]=gl.getUniformLocation(p,k)});
 gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);return {cv:cv,gl:gl,p:p,U:U,n:0,src:'',off:0,ov:0,buf:gl.createBuffer()}}
function fill(P,txt,d,need){var gl=P.gl,mob=need<900*d,fs=Math.round((mob?14:21)*d*1.1),S=strip(txt,fs,need+400*d),x=S.c.getContext('2d'),im=x.getImageData(0,0,S.c.width,S.c.height).data,st=Math.max(1,Math.round(.85*d)),a=[];
 for(var y=0;y<S.h;y+=st)for(var X=0;X<S.c.width;X+=st){var i=(y*S.c.width+X)*4;if(im[i+3]>110)a.push(X,y,im[i]/255,im[i+1]/255,im[i+2]/255,Math.random(),Math.random())}
 gl.bindBuffer(gl.ARRAY_BUFFER,P.buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);var B=28;
 [['h',2,0],['c',3,8],['r',2,20]].forEach(function(q){var l=gl.getAttribLocation(P.p,q[0]);gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,q[1],gl.FLOAT,false,B,q[2])});
 P.n=a.length/7;P.sw=S.w;P.sh=S.h}
LBV.push({name:'Partikel-Schrift',info:'Schrift aus tausenden Lichtpunkten, Maus = Kraftfeld, Zerfall in rote Glut',
 on:function(bt){if(!P){try{P=build(bt)}catch(e){console.error('lbP',e)}}if(P){P.cv.style.display='';P.src=''}},
 off:function(){if(P)P.cv.style.display='none'},
 tick:function(st,dt){if(!P)return;var gl=P.gl,U=P.U,r=P.cv.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1),W=Math.round(r.width*d),H=Math.round(r.height*d);if(!W)return;
  if(P.cv.width!==W||P.cv.height!==H){P.cv.width=W;P.cv.height=H;gl.viewport(0,0,W,H);P.src=''}
  var txt=st.bt.querySelector('.band.a>.tk').dataset.t||'',key=txt+W;if(key!==P.src&&document.fonts&&document.fonts.check('600 20px Outfit')){P.src=key;fill(P,txt,d,W)}if(!P.n)return;
  var inb=st.cy>r.top&&st.cy<r.bottom;P.ov+=((inb?1:0)-P.ov)*Math.min(1,dt*5);P.off=(P.off+dt*(W<900*d?60:95)*d*(1+st.v*1.8))%P.sw;
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform2f(U.uR,W,H);gl.uniform2f(U.uM,(st.cx-r.left)*d,(st.cy-r.top)*d);gl.uniform1f(U.uOf,P.off);gl.uniform1f(U.uSW,P.sw);
  gl.uniform1f(U.uCy,H/2);gl.uniform1f(U.uT,st.T);gl.uniform1f(U.uV,st.v);gl.uniform1f(U.uOv,P.ov);gl.uniform1f(U.uD,d);gl.uniform1f(U.uSH,P.sh);gl.drawArrays(gl.POINTS,0,P.n)}});
})();

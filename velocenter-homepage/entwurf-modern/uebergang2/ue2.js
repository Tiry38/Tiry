/* Vorlage „Übergänge 2“ (Tiry 21.11.2026): drei Seitenwechsel + drei komplett verschiedene Hintergründe.
   1 Flüssigmetall  – WebGL-Shader: rotes Flüssigmetall überrollt die Seite, darunter erscheint die neue · Hintergrund Bremsscheibe
   2 Waben-Zerfall  – die Seite zerfällt ab dem Klickpunkt in Waben (clip-path path()), Lichtwelle übers Gitter · Hintergrund Waben-Boden
   3 Explosionszeichnung – Kamera kippt in die Schrägansicht, Bauteile heben sich als Ebenen ab, die neue Seite senkt sich ein · Hintergrund Carbon-Monolith
   Ohne View-Transitions-Unterstützung läuft der bisherige Wischer (#wipe). */
(function(){
var MODES=[['guss','Flüssigmetall','Bremsscheibe'],['morph','Waben-Zerfall','Waben-Boden'],['explo','Explosionszeichnung','Carbon-Monolith']],
 BG={guss:'scheibe',morph:'waben',explo:'monolith'};
var mode=window.UE_DEFAULT||'guss';
try{var q=new URLSearchParams(location.search).get('ue');if(q)mode=q;else{var s0=localStorage.getItem('vc_ue2');if(s0)mode=s0}}catch(e){}
if(!MODES.some(function(m){return m[0]===mode}))mode='guss';
var de=document.documentElement,SL=+(window.UE_SLOW||1),PI=Math.PI;
function cl(v){return v<0?0:v>1?1:v}
function bez(x1,y1,x2,y2){function a(p,q){return 1-3*q+3*p}function b(p,q){return 3*q-6*p}function c(p){return 3*p}
 function cal(t,p,q){return((a(p,q)*t+b(p,q))*t+c(p))*t}function sl(t,p,q){return 3*a(p,q)*t*t+2*b(p,q)*t+c(p)}
 return function(x){if(x<=0)return 0;if(x>=1)return 1;var t=x;for(var i=0;i<6;i++){var s=sl(t,x1,x2);if(Math.abs(s)<1e-6)break;t-=(cal(t,x1,x2)-x)/s}return cal(t,y1,y2)}}
var IO=bez(.7,0,.25,1),OUT=bez(.16,1,.3,1);
/* gedämpfte Feder: 0 → 1 mit leichtem Überschwingen */
function spring(om,ze){var wd=om*Math.sqrt(1-ze*ze);return function(t){return 1-Math.exp(-ze*om*t)*(Math.cos(wd*t)+ze*om/wd*Math.sin(wd*t))}}
function linStr(f,n){var a=[];for(var i=0;i<=n;i++){var v=i===n?1:f(i/n);a.push(v.toFixed(4)+' '+(i/n*100).toFixed(2)+'%')}return'linear('+a.join(',')+')'}

/* ================= Hintergründe ================= */
function circ(x,y,r){return'M'+(x+r).toFixed(1)+' '+y.toFixed(1)+'A'+r+' '+r+' 0 1 0 '+(x-r).toFixed(1)+' '+y.toFixed(1)+'A'+r+' '+r+' 0 1 0 '+(x+r).toFixed(1)+' '+y.toFixed(1)+'Z'}
function P(r,a){a=a*PI/180;return(r*Math.cos(a)).toFixed(1)+' '+(r*Math.sin(a)).toFixed(1)}
function win(a0,a1,r0,r1,c){var co=c/r1*180/PI,ci=c/r0*180/PI;
 return'M'+P(r1,a0+co)+'A'+r1+' '+r1+' 0 0 1 '+P(r1,a1-co)+'Q'+P(r1,a1)+' '+P(r1-c,a1)+'L'+P(r0+c,a1)+'Q'+P(r0,a1)+' '+P(r0,a1-ci)+
  'A'+r0+' '+r0+' 0 0 0 '+P(r0,a0+ci)+'Q'+P(r0,a0)+' '+P(r0+c,a0)+'L'+P(r1-c,a0)+'Q'+P(r1,a0)+' '+P(r1,a0+co)+'Z'}
function rotor(){var d='',i,k,j,BR='',HR='';
 for(i=0;i<360;i++){var ta=i*PI/180;BR+='<path d="M'+(162*Math.cos(ta)).toFixed(1)+' '+(162*Math.sin(ta)).toFixed(1)+'L'+(342*Math.cos(ta)).toFixed(1)+' '+(342*Math.sin(ta)).toFixed(1)+'"/>'}
 for(i=0;i<9;i++)HR+='<circle r="'+(64+i*10.5)+'" fill="none" stroke="'+(i%2?'#FFFFFF':'#7E848D')+'" stroke-opacity="'+(i%2?.5:.22)+'" stroke-width="1"/>';
 for(i=0;i<=480;i++){var th=i/480*2*PI,r=470+12*Math.cos(10*th);d+=(i?'L':'M')+(r*Math.cos(th)).toFixed(1)+' '+(r*Math.sin(th)).toFixed(1)}d+='Z'+circ(0,0,326);
 var ho='',hr='';for(k=0;k<30;k++)for(j=0;j<3;j++){var a=(k*12+j*3.6)*PI/180,rr=[370,403,436][j],x=rr*Math.cos(a),y=rr*Math.sin(a);ho+=circ(x,y,7.5);hr+=circ(x,y,9.6)}
 d+=ho;var w=circ(0,0,342);for(k=0;k<5;k++)w+=win(k*72+15,k*72+57,178,300,24);
 var rv='';for(k=0;k<10;k++){var b=k*36*PI/180;rv+='<circle cx="'+(334*Math.cos(b)).toFixed(1)+'" cy="'+(334*Math.sin(b)).toFixed(1)+'" r="12.5" fill="url(#rv)" stroke="#7E848D" stroke-width="1.6"/><circle cx="'+(334*Math.cos(b)).toFixed(1)+'" cy="'+(334*Math.sin(b)).toFixed(1)+'" r="5" fill="#8F959E"/>'}
 var bo='';for(k=0;k<5;k++){var c=(k*72+36)*PI/180,bx=106*Math.cos(c),by=106*Math.sin(c);bo+='<circle cx="'+bx.toFixed(1)+'" cy="'+by.toFixed(1)+'" r="17" fill="#30333A" stroke="#D9DDE2" stroke-width="3.5"/><circle cx="'+bx.toFixed(1)+'" cy="'+by.toFixed(1)+'" r="7" fill="#5B6068"/>'}
 return'<svg viewBox="-500 -500 1000 1000" aria-hidden="true"><defs>'+
  '<radialGradient id="rg" r=".5" cx=".5" cy=".5"><stop offset=".62" stop-color="#D2D6DC"/><stop offset=".78" stop-color="#B9BEC6"/><stop offset=".9" stop-color="#A3A9B2"/><stop offset=".97" stop-color="#8A9099"/></radialGradient>'+
  '<linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4475C"/><stop offset=".42" stop-color="#D3152F"/><stop offset=".78" stop-color="#A30E26"/><stop offset="1" stop-color="#6E0B1D"/></linearGradient>'+
  '<radialGradient id="hg" r=".5"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".6" stop-color="#E4E7EB"/><stop offset="1" stop-color="#A9AFB7"/></radialGradient>'+
  '<radialGradient id="rv" r=".5" cx=".4" cy=".35"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#B9BFC7"/></radialGradient>'+
  '<filter id="bv" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="2.6" result="b"/><feSpecularLighting in="b" surfaceScale="5" specularConstant="1.05" specularExponent="24" lighting-color="#FFFFFF" result="s"><feDistantLight azimuth="225" elevation="38"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/><feDiffuseLighting in="b" surfaceScale="5" diffuseConstant="1" lighting-color="#FFFFFF" result="d"><feDistantLight azimuth="225" elevation="50"/></feDiffuseLighting><feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1.05" k2="0" k3="0" k4="0" result="lit"/><feComposite in="lit" in2="SourceAlpha" operator="in" result="l2"/><feComposite in="l2" in2="s2" operator="arithmetic" k1="0" k2="1" k3=".8" k4="0"/></filter>'+
  '<filter id="ds" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="-5" dy="7" stdDeviation="7" flood-color="#1A0308" flood-opacity=".45"/></filter>'+
  '<pattern id="br" width="1000" height="1000" x="-500" y="-500" patternUnits="userSpaceOnUse"><g transform="translate(500 500)" stroke="#FFFFFF" stroke-opacity=".07" stroke-width="1">'+BR+'</g></pattern></defs>'+
  '<g filter="url(#bv)"><path d="'+d+'" fill="url(#rg)" fill-rule="evenodd"/></g>'+
  '<path d="'+hr+'" fill="none" stroke="#4A4F57" stroke-opacity=".5" stroke-width="2"/>'+
  '<circle r="452" fill="none" stroke="#FFFFFF" stroke-opacity=".35" stroke-width="1.5"/><circle r="344" fill="none" stroke="#5E646D" stroke-opacity=".45" stroke-width="3"/>'+
  '<g filter="url(#ds)"><g filter="url(#bv)"><path d="'+w+'" fill="url(#cg)" fill-rule="evenodd"/></g></g><path d="'+w+'" fill="url(#br)" fill-rule="evenodd"/>'+rv+
  '<g filter="url(#ds)"><g filter="url(#bv)"><circle r="160" fill="url(#hg)"/></g></g>'+HR+'<circle r="132" fill="none" stroke="#8C929B" stroke-opacity=".5" stroke-width="1.6"/>'+bo+
  '<circle r="56" fill="#1F2226" stroke="#DADEE3" stroke-width="5"/><circle r="40" fill="none" stroke="#3C4048" stroke-width="2.5"/></svg>'}
function caliper(){var a0=138,a1=176,r0=352,r1=492,c=34;
 return'<svg class="cal" viewBox="-500 -500 1000 1000" aria-hidden="true"><defs><linearGradient id="kg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5C6068"/><stop offset=".45" stop-color="#2E3136"/><stop offset="1" stop-color="#17181B"/></linearGradient>'+
  '<filter id="kb" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="5" result="b"/><feSpecularLighting in="b" surfaceScale="9" specularConstant="1.2" specularExponent="30" lighting-color="#FFFFFF" result="s"><feDistantLight azimuth="225" elevation="40"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/><feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k1="0" k2="1" k3=".9" k4="0" result="o"/><feDropShadow in="o" dx="-10" dy="16" stdDeviation="12" flood-color="#0E1014" flood-opacity=".5"/></filter></defs>'+
  '<g filter="url(#kb)"><path d="'+win(a0,a1,r0,r1,c)+'" fill="url(#kg)"/></g>'+
  '<linearGradient id="kr" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#F4475C"/><stop offset=".5" stop-color="#C8102E"/><stop offset="1" stop-color="#7A0B1F"/></linearGradient>'+
  '<g filter="url(#kb)"><path d="'+win(a0+7,a1-7,r0+34,r1-34,20)+'" fill="url(#kr)"/></g>'+
  '<circle cx="'+P(r1-22,a0+9).replace(' ','" cy="')+'" r="9" fill="#C9CDD3" stroke="#3A3D43" stroke-width="2"/><circle cx="'+P(r1-22,a1-9).replace(' ','" cy="')+'" r="9" fill="#C9CDD3" stroke="#3A3D43" stroke-width="2"/></svg>'}
function hexTile(){var r=34,w=Math.sqrt(3)*r,h=3*r,C=[[0,0],[w,0],[w/2,1.5*r],[0,h],[w,h]];
 function hx(R,from,to){var s='';C.forEach(function(c){for(var i=from;i<=to;i++){var a=(-90+60*i)*PI/180;s+=(i===from?'M':'L')+(c[0]+R*Math.cos(a)).toFixed(2)+' '+(c[1]+R*Math.sin(a)).toFixed(2)}if(to-from===6)s+='Z'});return s}
 var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+w.toFixed(2)+'" height="'+h+'" viewBox="0 0 '+w.toFixed(2)+' '+h+'"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A3D45" stop-opacity=".55"/><stop offset="1" stop-color="#0E0F12" stop-opacity=".2"/></linearGradient></defs>'+
  '<path fill="#0B0C0E" fill-rule="evenodd" d="M0 0H'+w.toFixed(2)+'V'+h+'H0Z'+hx(30.5,0,6)+'"/>'+
  '<path fill="url(#g)" d="'+hx(30.5,0,6)+'"/>'+
  '<path fill="none" stroke="#FFFFFF" stroke-opacity=".38" stroke-width="1.3" d="'+hx(29,-2,0)+'"/>'+
  '<path fill="none" stroke="#FF5A6A" stroke-opacity=".22" stroke-width="1.2" d="'+hx(29,1,3)+'"/></svg>';
 return'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")'}
var HEX=null,ptrOn=false;
function build(){var m=document.querySelector('main');if(!m)return;var o=m.querySelector(':scope > .bgh');if(o)o.remove();
 var b=BG[mode],d=document.createElement('div');d.className='bgh '+b;d.setAttribute('aria-hidden','true');
 if(b==='scheibe')d.innerHTML='<div class="rt"><i class="sh"></i><div class="scr"><div class="spin">'+rotor()+'</div></div><i class="groove"></i><i class="sheen"></i>'+caliper()+'</div>';
 else if(b==='waben'){if(!HEX)HEX=hexTile();d.style.setProperty('--hex',HEX);d.innerHTML='<div class="wf"><i class="wl c"></i><i class="wl a"></i><i class="wl b"></i><i class="wc"></i><i class="wfog"></i></div><i class="ws"></i>';ptr(d)}
 else d.innerHTML='<i class="moS"></i><div class="mo"><i class="gl"></i><i class="tp"></i><i class="sd"></i><i class="fr"></i></div>';
 m.prepend(d)}
/* Lichtkegel folgt der Maus (nur Waben) */
var pq=0,lx=0,ly=0;
function ptr(d){if(ptrOn)return;ptrOn=true;addEventListener('pointermove',function(e){if(e.pointerType!=='mouse')return;lx=e.clientX;ly=e.clientY;if(pq)return;pq=requestAnimationFrame(function(){pq=0;var h=document.querySelector('.bgh.waben .ws');if(!h)return;
 var r=h.parentNode.getBoundingClientRect();h.classList.add('ptr');h.style.transform='translate('+(lx-r.left)+'px,'+(ly-r.top)+'px)'})},{passive:true})}
function bg(){de.classList.remove('bg-scheibe','bg-waben','bg-monolith');de.classList.add('bgx','bg-'+BG[mode]);build()}

/* ================= Übergänge – gemeinsam ================= */
function names(on){[(mode!=='explo'?['#__x','vthdr']:['header.hdr','vthdr']),['.fab','vtfab'],['#ueSw','vtsw'],['#ueTip','vttip']].forEach(function(x){var e=document.querySelector(x[0]);if(e)e.style.viewTransitionName=on?x[1]:''})}
function A(pe,nm,kf,o){o.pseudoElement='::view-transition-'+pe+'('+nm+')';o.fill='both';return de.animate(kf,o)}
function view(){return document.querySelector('section.view:not([hidden])')}
function inVP(e){var b=e.getBoundingClientRect();return b.width>6&&b.height>6&&b.bottom>0&&b.top<innerHeight&&b.right>0&&b.left<innerWidth}
function okEl(e){var c=getComputedStyle(e);return c.display!=='inline'&&c.display!=='contents'&&c.display!=='none'&&c.visibility!=='hidden'&&+c.opacity>.05}
var named=[];
function nm(e,n){e.style.viewTransitionName=n;named.push(e)}
function unname(){named.forEach(function(e){e.style.viewTransitionName=''});named=[]}
function unvtm(){[].forEach.call(document.querySelectorAll('.vtm'),function(e){e.classList.remove('vtm')})}
function fx2d(){var c=document.createElement('canvas'),d=Math.min(devicePixelRatio||1,1.5);c.id='vtfx';c.setAttribute('aria-hidden','true');
 c.width=Math.round(innerWidth*d);c.height=Math.round(innerHeight*d);document.body.appendChild(c);var g=c.getContext('2d');g.setTransform(d,0,0,d,0,0);return{c:c,g:g}}

/* ================= 1 · Flüssigmetall (WebGL) ================= */
var FRONT='float front(float x){float u=x/uR.x,H=uR.y,tl=clamp(uT/.62,0.,1.);float e=tl<.5?4.*tl*tl*tl:1.-pow(-2.*tl+2.,3.)/2.;'+
 'float y=mix(-.25,1.34,e)*H+H*.03*(.5*sin(u*9.+1.3+uT*5.)+.3*sin(u*17.+4.2-uT*7.)+.2*sin(u*31.+.7+uT*11.));'+
 'for(int i=0;i<7;i++){float f=float(i);float xi=fract(.13+f*.161+uS*.37),wi=.016+.018*fract(f*.73+.21),ai=(.05+.09*fract(f*.53+.4))*H*smoothstep(0.,.45,tl)*(1.-.6*smoothstep(.7,1.,tl));y+=ai*exp(-pow((u-xi)/wi,2.));}return y;}';
function frontJS(x,W,H,T,S){var u=x/W,tl=cl(T/.62),e=tl<.5?4*tl*tl*tl:1-Math.pow(-2*tl+2,3)/2;
 var y=(-.25+1.59*e)*H+H*.03*(.5*Math.sin(u*9+1.3+T*5)+.3*Math.sin(u*17+4.2-T*7)+.2*Math.sin(u*31+.7+T*11));
 function sm(a,b,v){v=cl((v-a)/(b-a));return v*v*(3-2*v)}function fr(v){return v-Math.floor(v)}
 for(var i=0;i<7;i++){var xi=fr(.13+i*.161+S*.37),wi=.016+.018*fr(i*.73+.21),ai=(.05+.09*fr(i*.53+.4))*H*sm(0,.45,tl)*(1-.6*sm(.7,1,tl));y+=ai*Math.exp(-Math.pow((u-xi)/wi,2))}return y}
var FS='precision highp float;uniform vec2 uR,uC;uniform float uT,uS,uK;'+
 'vec2 gh(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return -1.+2.*fract(sin(p)*43758.5453);}'+
 'float gn(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);'+
 'return mix(mix(dot(gh(i),f),dot(gh(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(gh(i+vec2(0,1)),f-vec2(0,1)),dot(gh(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);}'+
 'float hf(vec2 q){vec2 p=q*1.6+vec2(uS*7.,-uT*.9);float h=gn(p)*.62+gn(p*2.1+vec2(3.1,-uT*1.3))*.26+gn(p*4.3-vec2(uT*.8,1.7))*.09;'+
 'h+=.07*sin(q.x*5.2+q.y*2.3+uT*6.)+.05*sin(q.x*-3.1+q.y*6.7-uT*4.)+.018*sin(q.x*17.+q.y*9.-uT*9.);return h;}'+
 'vec3 env(vec3 R){float up=-R.y;vec3 c=mix(vec3(.02,.022,.026),vec3(.34,.35,.38),smoothstep(-.5,.7,up));'+
 'c+=vec3(1.)*smoothstep(.04,0.,abs(up-.40)-.04)*1.5+vec3(1.)*smoothstep(.015,0.,abs(up-.64)-.014)*1.2;'+
 'c+=vec3(.9)*smoothstep(.06,0.,abs(R.x+.48)-.035)*smoothstep(-.3,.3,up)*1.1;'+
 'c+=vec3(.55)*smoothstep(.10,0.,abs(up+.18)-.02);c+=vec3(.7)*smoothstep(.05,0.,abs(R.x-.62)-.025)*smoothstep(.1,.6,up);return c;}'+FRONT+
 'void main(){vec2 px=vec2(gl_FragCoord.x,uR.y*uK-gl_FragCoord.y)/uK;float H=uR.y,y=px.y;float ins=front(px.x)-y;'+
 'if(ins<0.){gl_FragColor=vec4(0.,0.,0.,.38*exp(ins/16.));return;}'+
 'float cov=smoothstep(0.,1.2,ins);vec2 q=px/H;'+
 'float ho=smoothstep(.56,1.,uT);ho=ho*ho*(3.-2.*ho);float rr=ho*length(uR)*1.12;vec2 dq=px-uC;'+
 'float wob=gn(normalize(dq+.001)*3.+vec2(uS*9.,uT*2.))*46.*ho+gn(q*6.+uS)*18.*ho;float hd=length(dq)-rr+wob;'+
 'float e=.0035;float h0=hf(q),hx=hf(q+vec2(e,0.)),hy=hf(q+vec2(0.,e));vec2 g=vec2(hx-h0,hy-h0)/e*.14;'+
 'float lip=exp(-ins/26.);g.y-=lip*.9;'+
 'float men=smoothstep(60.,0.,hd)*step(0.,hd);vec2 dn=normalize(dq+.001);g+=dn*men*men*1.35*step(.001,ho);'+
 'vec3 n=normalize(vec3(-g,1.));vec3 R=reflect(vec3(0.,0.,-1.),n);vec3 L=normalize(vec3(-.5,-.7,.55));'+
 'float dif=max(dot(n,L),0.);float fr=.04+.96*pow(1.-n.z,5.);'+
 'vec3 ev=env(R);vec3 tint=vec3(.88,.055,.10);'+
 'vec3 col=tint*(.05+.30*dif)+ev*tint*1.45;float lum=dot(ev,vec3(.333));col=mix(col,ev,smoothstep(.85,1.15,lum));'+
 'col+=ev*fr*.9+vec3(1.)*pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),90.)*1.2;'+
 'col*=1.-.35*smoothstep(0.,1.,y/H)*(1.-lip);'+
 'float a=cov*smoothstep(0.,1.4,hd);if(hd<0.&&ho>0.){a=0.;}'+
 'if(hd<0.&&ho>0.){float sh=exp(hd/22.)*.42;gl_FragColor=vec4(0.,0.,0.,sh*cov);return;}'+
 'col=col*(1.+col/2.4)/(1.+col);gl_FragColor=vec4(col*a,a);}';
function glFx(){var c=document.createElement('canvas'),K=Math.min(devicePixelRatio||1,1.25),W=innerWidth,H=innerHeight;c.id='vtfx';c.setAttribute('aria-hidden','true');
 c.width=Math.round(W*K);c.height=Math.round(H*K);document.body.appendChild(c);
 var g=c.getContext('webgl',{premultipliedAlpha:true,alpha:true,antialias:false});if(!g)return{c:c,g2:c.getContext('2d'),K:K};
 function sh(t,s){var o=g.createShader(t);g.shaderSource(o,s);g.compileShader(o);return o}
 var p=g.createProgram();g.attachShader(p,sh(g.VERTEX_SHADER,'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));g.attachShader(p,sh(g.FRAGMENT_SHADER,FS));g.linkProgram(p);
 if(!g.getProgramParameter(p,g.LINK_STATUS))return{c:c,g2:null,K:K};
 g.useProgram(p);var bf=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,bf);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),g.STATIC_DRAW);
 var al=g.getAttribLocation(p,'a');g.enableVertexAttribArray(al);g.vertexAttribPointer(al,2,g.FLOAT,false,0,0);g.viewport(0,0,c.width,c.height);
 return{c:c,gl:g,u:{R:g.getUniformLocation(p,'uR'),T:g.getUniformLocation(p,'uT'),S:g.getUniformLocation(p,'uS'),K:g.getUniformLocation(p,'uK'),C:g.getUniformLocation(p,'uC')},K:K}}
var GU={fx:glFx,prep:function(){return{}},go:function(t,F){var W=innerWidth,H=innerHeight,D=1700*SL,S=Math.random(),N=Math.max(40,Math.round(W/16)),KF=64,kf=[];
 for(var k=0;k<=KF;k++){var T=k/KF,a=[];for(var i=0;i<=N;i++){var x=i/N*W;a.push(x.toFixed(1)+'px '+(frontJS(x,W,H,T,S)-16).toFixed(1)+'px')}
  a.push((W+2)+'px '+(H*4)+'px','-2px '+(H*4)+'px');kf.push({clipPath:'polygon('+a.join(',')+')',offset:T})}
 var an=A('old','root',kf,{duration:D,easing:'linear'});
 A('new','root',{transform:['scale(1.035)','scale(1)'],filter:['brightness(.7) saturate(.8)','brightness(1) saturate(1)']},{duration:D,easing:'cubic-bezier(.3,0,.2,1)'});
 if(F.gl){var g=F.gl;g.uniform2f(F.u.R,W,H);g.uniform1f(F.u.S,S);g.uniform1f(F.u.K,F.K);var cp=(LP&&performance.now()-LP[2]<4000)?LP:[W*.5,H*.42];g.uniform2f(F.u.C,cp[0],cp[1]);g.clearColor(0,0,0,0);
  return function(){var T=cl((an.currentTime||0)/D);g.uniform1f(F.u.T,T);g.clear(g.COLOR_BUFFER_BIT);g.drawArrays(g.TRIANGLES,0,3)}}
 var c2=F.g2;if(!c2)return function(){};c2.setTransform(F.K,0,0,F.K,0,0);
 return function(){var T=cl((an.currentTime||0)/D),al=1-cl((T-.45)/.5);c2.clearRect(0,0,W,H);if(al<=0)return;c2.beginPath();c2.moveTo(0,-10);
  for(var i=0;i<=N;i++){var x=i/N*W;c2.lineTo(x,frontJS(x,W,H,T,S))}c2.lineTo(W,-10);c2.closePath();var gr=c2.createLinearGradient(0,0,W*.3,H);
  gr.addColorStop(0,'rgba(110,11,29,'+al+')');gr.addColorStop(.5,'rgba(212,21,47,'+al+')');gr.addColorStop(1,'rgba(160,14,38,'+al+')');c2.fillStyle=gr;c2.fill()}}};

/* ================= 2 · Waben-Zerfall ================= */
/* Die alte Seite zerfällt ab dem Klickpunkt in Waben: jede Wabe kippt, dreht und schrumpft weg (clip-path path() mit
   allen Waben als Unterpfade, WAAPI interpoliert die Punkte), eine Lichtwelle läuft über das Wabengitter voraus,
   darunter taucht die neue Seite aus der Tiefe auf. */
function hexGrid(W,H){var R=Math.max(34,Math.min(58,W/22)),h=Math.sqrt(3)*R,out=[];
 for(var c=-1;c*1.5*R<W+R*2;c++)for(var r=-1;r*h<H+h;r++){out.push([c*1.5*R,r*h+(c&1?h/2:0)])}return{R:R,c:out}}
var MO={fx:fx2d,prep:function(){return{}},
 go:function(t,F,st){var W=innerWidth,H=innerHeight,D=1500*SL,G=hexGrid(W,H),R=G.R,K=36,
  P0=(LP&&performance.now()-LP[2]<4000)?[LP[0],LP[1]]:[W*.5,H*.45],MX=0;
  G.c.forEach(function(c){MX=Math.max(MX,Math.hypot(c[0]-P0[0],c[1]-P0[1]))});
  var T=G.c.map(function(c,i){var d=Math.hypot(c[0]-P0[0],c[1]-P0[1])/MX,j=Math.sin(i*12.9898)*43758.5453;j=j-Math.floor(j);
   var dx=(c[0]-P0[0])/(d*MX||1),dy=(c[1]-P0[1])/(d*MX||1);return{x:c[0],y:c[1],d:d*.56+j*.06,dx:dx,dy:dy,sp:(j-.5)*2}});
  function st_(p,u){var l=cl((u-p.d)/.36),e=l*l*(3-2*l);return{l:l,s:(1-e)*1.012,rot:e*(38+22*p.sp),ox:p.dx*e*e*R*1.3,oy:p.dy*e*e*R*1.3+e*e*R*.5}}
  function hexPts(p,s){var a=[];for(var k=0;k<6;k++){var an=(k*60+s.rot)*PI/180;a.push([p.x+s.ox+R*s.s*Math.cos(an),p.y+s.oy+R*s.s*Math.sin(an)])}return a}
  var kf=[];for(var k=0;k<=K;k++){var u=k/K,d='';T.forEach(function(p){var q=hexPts(p,st_(p,u));d+='M'+q.map(function(v){return v[0].toFixed(1)+' '+v[1].toFixed(1)}).join('L')+'Z'});
   kf.push({offset:u,clipPath:'path("'+d+'")'})}
  var an=A('old','root',kf,{duration:D,easing:'linear'});
  A('new','root',{transform:['scale(1.07)','scale(1)'],filter:['brightness(.45) saturate(.6)','brightness(1) saturate(1)'],transformOrigin:[P0[0]+'px '+P0[1]+'px',P0[0]+'px '+P0[1]+'px']},{duration:D,easing:'cubic-bezier(.3,0,.15,1)'});
  var g=F.g;
  return function(){var u=cl((an.currentTime||0)/D);g.clearRect(0,0,W,H);
   T.forEach(function(p){var pre=cl(1-(p.d-u)/.16);if(pre<=0)return;var s=st_(p,u);if(s.l>=1)return;var q=hexPts(p,s);
    g.beginPath();q.forEach(function(v,i){i?g.lineTo(v[0],v[1]):g.moveTo(v[0],v[1])});g.closePath();
    if(s.l>0){g.save();g.shadowColor='rgba(10,12,16,.55)';g.shadowBlur=18*s.l;g.shadowOffsetY=10*s.l;g.strokeStyle='rgba(20,22,26,'+(.0+.01)+')';g.lineWidth=1;g.stroke();g.restore();
     var gr=g.createLinearGradient(q[3][0],q[3][1],q[0][0],q[0][1]);gr.addColorStop(0,'rgba(255,255,255,'+(.95*(1-s.l))+')');gr.addColorStop(.45,'rgba(226,35,45,'+(1-s.l*.6)+')');gr.addColorStop(1,'rgba(120,14,24,'+(1-s.l*.6)+')');
     g.strokeStyle=gr;g.lineWidth=1.5+2.5*(1-s.l);g.stroke()}
    else{g.strokeStyle='rgba(226,35,45,'+(pre*pre*.85)+')';g.lineWidth=1.3;g.stroke();g.strokeStyle='rgba(255,255,255,'+(pre*pre*pre*.7)+')';g.lineWidth=.8;g.stroke()}})}}};

/* ================= 3 · Explosionszeichnung ================= */
/* Kamera kippt die Seite wie eine Konstruktionszeichnung in die Schrägansicht, die Bauteile heben sich als Ebenen ab
   (Maßlinien, Positionsnummern, Umriss auf der Grundplatte), die neue Seite senkt sich Ebene für Ebene ein. */
var XS='p.eyebrow,h1,h2,h3,p.lead,.row > *,.trust > *,.hvis,.bandimg,.duo img,.wm,.logobox,.card,.srow,.tile,figure,li,.chip,.pill,img';
function pickParts(max){var v=view();if(!v)return[];var W=innerWidth,H=innerHeight,c=[].filter.call(v.querySelectorAll(XS),function(e){if(!inVP(e)||!okEl(e))return false;var b=e.getBoundingClientRect();return b.width*b.height>1500&&b.width*b.height<W*H*.3});
 c.sort(function(a,b){var x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return y.width*y.height-x.width*x.height});
 var r=[];c.forEach(function(e){if(r.length>=max)return;if(r.some(function(o){return o.contains(e)||e.contains(o)}))return;r.push(e)});return r}
var PP=1700,AXX=50,AZZ=-24,SC=.36;
function cam(c){return{a:AXX*c*PI/180,b:(AZZ*c)*PI/180,s:1-SC*c}}
function proj(C,x,y,z,k){var cx=x*k.s,cy=y*k.s,x1=cx*Math.cos(k.b)-cy*Math.sin(k.b),y1=cx*Math.sin(k.b)+cy*Math.cos(k.b),y2=y1*Math.cos(k.a)-z*Math.sin(k.a),z2=y1*Math.sin(k.a)+z*Math.cos(k.a),f=PP/(PP-z2);return[C[0]+x1*f,C[1]+y2*f]}
function tf(c,z){var k=cam(c);return'perspective('+PP+'px) rotateX('+(AXX*c).toFixed(3)+'deg) rotateZ('+(AZZ*c).toFixed(3)+'deg) scale('+k.s.toFixed(4)+') translateZ('+z.toFixed(1)+'px)'}
function geo(list,C){var N=list.length,H=innerHeight;return list.map(function(e,i){var b=e.getBoundingClientRect();
 return{e:e,b:b,x0:b.left-C[0],y0:b.top-C[1],x1:b.right-C[0],y1:b.bottom-C[1],z:H*(.06+.26*(N>1?(N-1-i)/(N-1):1))}})}
var EX={fx:fx2d,prep:function(){var mx=innerWidth>760?12:8,C=[innerWidth/2,innerHeight*.56],o=geo(pickParts(mx),C);o.forEach(function(p,i){p.e.classList.add('vtm');nm(p.e,'x-o'+i)});return{C:C,old:o}},
 after:function(st){var mx=innerWidth>760?12:8,n=geo(pickParts(mx),st.C);n.forEach(function(p,i){p.e.classList.add('vtm');nm(p.e,'x-n'+i)});st.nw=n},
 go:function(t,F,st){var C=st.C,W=innerWidth,H=innerHeight,D=2100*SL,K=48,fS=spring(11,.62);
  /* Kamera: 0–.3 kippen, .3–.62 schweben (leichte Drehung), .62–1 zurück mit Feder */
  function camAt(u){if(u<.3)return IO(u/.3);if(u<.62)return 1;var s=fS((u-.62)/.38*.95);return 1-s}
  function orb(u){return u<.3?0:u<.62?IO((u-.3)/.32)*.06:.06*(1-IO((u-.62)/.38))}
  function oldZ(p,i,u){var a=cl((u-.04-i*.012)/.3),e=IO(a);var up=cl((u-.36-i*.008)/.2);return{z:p.z*e+H*.9*up*up,op:1-cl((u-.40-i*.008)/.14)}}
  function newZ(p,i,u){var a=cl((u-.40)/.18),dn=cl((u-.62-(st.nw.length-1-i)*.014)/.3);var z=p.z+H*.9*(1-IO(a));z=z*(1-fS(dn*.9));return{z:z,op:IO(cl((u-.40)/.14))}}
  function ori(p){return(-p.x0).toFixed(1)+'px '+(-p.y0).toFixed(1)+'px'}
  function rootKF(isOld){var kf=[];for(var k=0;k<=K;k++){var u=k/K,c=camAt(u)+orb(u);kf.push({offset:u,transform:tf(c,0),transformOrigin:C[0]+'px '+C[1]+'px',
    opacity:isOld?1-cl((u-.38)/.16):cl((u-.40)/.16),boxShadow:'0 '+(40*Math.max(0,c)).toFixed(1)+'px '+(90*Math.max(0,c)).toFixed(1)+'px rgba(20,22,28,'+(.28*Math.max(0,c)).toFixed(3)+')',borderRadius:(18*Math.max(0,c)).toFixed(1)+'px'})}return kf}
  var an=A('old','root',rootKF(true),{duration:D,easing:'linear'});A('new','root',rootKF(false),{duration:D,easing:'linear'});
  st.old.forEach(function(p,i){var kf=[];for(var k=0;k<=K;k++){var u=k/K,s=oldZ(p,i,u);kf.push({offset:u,transform:tf(camAt(u)+orb(u),s.z),transformOrigin:ori(p),opacity:s.op})}A('old','x-o'+i,kf,{duration:D,easing:'linear'})});
  st.nw.forEach(function(p,i){var kf=[];for(var k=0;k<=K;k++){var u=k/K,s=newZ(p,i,u);kf.push({offset:u,transform:tf(camAt(u)+orb(u),s.z),transformOrigin:ori(p),opacity:s.op})}A('new','x-n'+i,kf,{duration:D,easing:'linear'})});
  var g=F.g;
  function part(p,i,z,al,k){if(al<=.01)return;var c4=[[p.x0,p.y0],[p.x1,p.y0],[p.x1,p.y1],[p.x0,p.y1]],b=c4.map(function(v){return proj(C,v[0],v[1],0,k)}),a=c4.map(function(v){return proj(C,v[0],v[1],z,k)});
   g.globalAlpha=al;g.setLineDash([4,4]);g.lineWidth=1;g.strokeStyle='#D4152F';g.beginPath();b.forEach(function(v,j){j?g.lineTo(v[0],v[1]):g.moveTo(v[0],v[1])});g.closePath();g.stroke();
   g.strokeStyle='rgba(70,74,82,.75)';g.beginPath();for(var j=0;j<4;j++){g.moveTo(b[j][0],b[j][1]);g.lineTo(a[j][0],a[j][1])}g.stroke();g.setLineDash([]);
   g.fillStyle='#D4152F';for(j=0;j<4;j++){g.beginPath();g.arc(b[j][0],b[j][1],2.2,0,7);g.fill()}
   var t0=a[1];g.strokeStyle='rgba(212,21,47,.35)';g.lineWidth=5;g.beginPath();g.arc(t0[0],t0[1],6.5,0,7);g.stroke();g.fillStyle='#D4152F';g.beginPath();g.arc(t0[0],t0[1],3.2,0,7);g.fill();
   g.font='700 11px Outfit,system-ui,sans-serif';var lab='POS '+('0'+(i+1)).slice(-2)+' · Z '+Math.round(z);var tw=g.measureText(lab).width;
   g.fillStyle='rgba(255,255,255,.9)';g.beginPath();g.roundRect?g.roundRect(t0[0]+10,t0[1]-22,tw+14,18,9):g.rect(t0[0]+10,t0[1]-22,tw+14,18);g.fill();
   g.fillStyle='#2A2D33';g.fillText(lab,t0[0]+17,t0[1]-9);g.globalAlpha=1}
  return function(){var u=cl((an.currentTime||0)/D),c=camAt(u)+orb(u),k=cam(c);g.clearRect(0,0,W,H);if(c<.05)return;
   st.old.forEach(function(p,i){var s=oldZ(p,i,u);part(p,i,s.z,Math.min(1,s.z/60)*s.op*Math.min(1,c*1.5),k)});
   st.nw.forEach(function(p,i){var s=newZ(p,i,u);part(p,i,s.z,Math.min(1,s.z/60)*s.op*Math.min(1,c*1.5),k)})}}};

var RUN={guss:GU,morph:MO,explo:EX},act=null;
var LP=null;addEventListener('pointerdown',function(e){LP=[e.clientX,e.clientY,performance.now()]},true);
window.VTX=function(update,done,v){if(!document.startViewTransition)return false;
 var m=mode,R=RUN[m],F=null,draw=null,raf=0,fin=false,st;
 if(act){try{act.skipTransition()}catch(e){}}
 unname();
 de.classList.add('vtx','vt-'+m);names(true);st=R.prep();
 var t;try{t=document.startViewTransition(function(){unname();unvtm();update();if(R.after)R.after(st);if(R.fx)F=R.fx()})}
 catch(e){unname();de.classList.remove('vtx','vt-'+m);names(false);return false}
 act=t;
 function loop(){if(fin)return;if(draw)draw();raf=requestAnimationFrame(loop)}
 t.ready.then(function(){draw=R.go(t,F,st);if(draw)loop()}).catch(function(){});
 t.finished.catch(function(){}).then(function(){fin=true;cancelAnimationFrame(raf);if(F&&F.c.parentNode)F.c.remove();unname();
  de.classList.remove('vtx','vt-'+m);names(false);if(act===t)act=null;done()});
 return true};

/* ---------- Umschalter ---------- */
function sw(){bg();var b=document.createElement('div');b.id='ueSw';b.setAttribute('role','group');b.setAttribute('aria-label','Vorlage wählen');
 b.innerHTML='<span class="ue-k">Vorlage</span>'+MODES.map(function(m,i){return'<button type="button" data-ue="'+m[0]+'" aria-pressed="false"><b>'+(i+1)+'</b><span>'+m[1]+'<small>'+m[2]+'</small></span></button>'}).join('');
 document.body.appendChild(b);
 function up(){[].forEach.call(b.querySelectorAll('button'),function(x){var on=x.dataset.ue===mode;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on))})}
 b.addEventListener('click',function(e){var x=e.target.closest('button');if(!x)return;mode=x.dataset.ue;try{localStorage.setItem('vc_ue2',mode)}catch(_){}bg();up();tip()});
 var tt=0;function tip(){var n=document.getElementById('ueTip');if(!n){n=document.createElement('div');n.id='ueTip';document.body.appendChild(n)}
  var i=MODES.findIndex(function(m){return m[0]===mode}),m=MODES[i];n.innerHTML='<b>Vorlage '+(i+1)+'</b> · '+m[1]+' · Hintergrund '+m[2]+' – jetzt Menüpunkt antippen';n.classList.remove('on');void n.offsetWidth;n.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){n.classList.remove('on')},2800)}
 up();setTimeout(tip,1200)}
function vst(){var h=location.hash.replace('#','');de.classList.toggle('vstart',!h||h==='start'||h==='top')}vst();addEventListener('hashchange',vst);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sw);else sw();
})();

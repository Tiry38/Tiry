const {chromium}=require('playwright');const fs=require('fs');
const W=640,H=+process.argv[2]||820,N=+process.argv[3]||1;
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:2});
await p.addInitScript(()=>{const g=WebGLRenderingContext.prototype.getParameter;WebGLRenderingContext.prototype.getParameter=function(x){const v=g.call(this,x);return (typeof v==='string'&&/swiftshader|llvmpipe|software/i.test(v))?'ANGLE (NVIDIA GeForce)':v};
 if(window.WebGL2RenderingContext){const g2=WebGL2RenderingContext.prototype.getParameter;WebGL2RenderingContext.prototype.getParameter=function(x){const v=g2.call(this,x);return (typeof v==='string'&&/swiftshader|llvmpipe|software/i.test(v))?'ANGLE (NVIDIA GeForce)':v}}});
await p.addInitScript(()=>{const ss=WebGLRenderingContext.prototype.shaderSource;WebGLRenderingContext.prototype.shaderSource=function(sh,src){
 if(src.includes('uniform float uT')){src=src.split('vec2(sin(uT*.13),sin(uT*.097+1.))').join('vec2(0.)').split('+.025*sin(uT*.15)').join('').split('+.010*sin(uT*.19)').join('').split('vec2 o=dir*uAm*fm;').join('vec2 o=vec2(0.);').split('float gust=.35+.65*smoothstep(-.2,1.,sin(uT*.7-q.x*5.)*.5+.5);').join('float gust=0.;');src=src.replace(/\buT\b/g,'(uT*.1)').replace('uniform float (uT*.1),','uniform float uT,');window.__patched=(window.__patched||0)+1}
 return ss.call(this,sh,src)}});
await p.clock.install();
await p.goto('https://tiry38.github.io/velo-center-web/',{waitUntil:'load'});
await p.clock.runFor(3000);await p.waitForTimeout(2500);
const info=await p.evaluate(()=>{const c=[...document.querySelectorAll('canvas')].map(c=>({id:c.id,cls:c.className,w:c.width,h:c.height,pos:getComputedStyle(c).position,z:getComputedStyle(c).zIndex}));return c});
console.log('patched',await p.evaluate(()=>window.__patched));
await p.addStyleTag({content:'*{visibility:hidden!important} #hg{visibility:visible!important} #snow{display:none!important} html,body{overflow:hidden!important}'});
await p.evaluate(()=>{for(const c of document.querySelectorAll('canvas')){let e=c.parentElement;while(e&&e!==document.body){e.style.visibility='visible';e=e.parentElement}c.style.visibility='visible'}});
fs.mkdirSync('fr/hg',{recursive:true});
for(let i=0;i<N;i++){for(let k=0;k<1;k++){await p.clock.runFor(16);await p.waitForTimeout(60);}await p.screenshot({path:`fr/hg/${String(i).padStart(3,'0')}.png`});}
await b.close();})();

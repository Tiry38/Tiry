const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:600,height:1200},deviceScaleFactor:2});
await p.clock.install();
await p.goto('https://tiry38.github.io/velo-center-web/',{waitUntil:'load'});
await p.clock.runFor(4000);await p.waitForTimeout(1500);
await p.addStyleTag({content:'#deal .cdn,#deal .cta,#snow{display:none!important} *{animation-play-state:paused!important} #deal{clip-path:none!important;-webkit-mask:none!important;mask:none!important;border-radius:0!important} nav,header,[class*="mbar"],[class*="dock"]{visibility:hidden!important} #deal{margin-top:0!important}'});
const d=await p.$('#deal');await d.scrollIntoViewIfNeeded();await p.clock.runFor(2000);await p.waitForTimeout(800);
// verbleibende fixe Leisten finden und ausblenden
await p.evaluate(()=>{for(const e of document.querySelectorAll('body *')){const cs=getComputedStyle(e);if(cs.position==='fixed'&&!e.closest('#deal'))e.style.visibility='hidden'}});
const bb=await d.boundingBox();console.log(bb);
for(let i=0;i<30;i++){await p.clock.runFor(32);await p.waitForTimeout(30);
 await p.screenshot({path:`fr/deal/${String(i).padStart(3,'0')}.png`,clip:{x:bb.x,y:bb.y,width:bb.width,height:bb.height}});}
await b.close();})();

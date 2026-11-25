const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for(const [n,w,d] of [['handy',390,2],['desktop',1280,1]]){const p=await b.newPage({viewport:{width:w,height:900},deviceScaleFactor:d});
await p.goto('file://'+__dirname+'/out/newsletter-dezember-2026.html',{waitUntil:'networkidle'});await p.waitForTimeout(900);
await p.screenshot({path:`shot-${n}.png`,fullPage:true});console.log(n,await p.evaluate(()=>document.documentElement.scrollWidth));await p.close();}
await b.close();})();

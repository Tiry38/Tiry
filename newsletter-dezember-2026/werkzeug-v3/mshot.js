const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for(const [n,w,d] of [['handy',390,2],['desktop',1280,1]]){const p=await b.newPage({viewport:{width:w,height:900},deviceScaleFactor:d});
await p.goto('file://'+__dirname+'/mail/newsletter-dezember-2026.html',{waitUntil:'load'});await p.waitForTimeout(1500);
console.log(n,await p.evaluate(()=>[document.documentElement.scrollWidth,document.body.scrollHeight]));
await p.screenshot({path:`m-${n}.png`,fullPage:true});await p.close();}
await b.close();})();

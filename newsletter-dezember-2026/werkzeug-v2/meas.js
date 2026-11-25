const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();for(const w of [640,390]){const p=await b.newPage({viewport:{width:w,height:900}});
await p.goto('file://'+__dirname+'/out/newsletter-dezember-2026.html');await p.waitForTimeout(500);
console.log(w,await p.evaluate(()=>Math.round(document.querySelector('.bgx').getBoundingClientRect().height)));await p.close()}await b.close()})();

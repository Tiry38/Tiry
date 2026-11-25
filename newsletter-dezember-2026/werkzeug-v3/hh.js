const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:640,height:900}});
await p.goto('file://'+__dirname+'/page.html');await p.waitForTimeout(800);
console.log(await p.evaluate(()=>{const s=[...document.querySelectorAll('section')];const l=s[s.length-1].getBoundingClientRect();return Math.round(l.bottom+scrollY)}));await b.close()})();

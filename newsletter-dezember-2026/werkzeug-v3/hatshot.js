const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:600,height:480},deviceScaleFactor:1});
await p.goto('file://'+__dirname+'/hat.html');await p.waitForTimeout(800);await (await p.$('#c')).screenshot({path:'../a/hat.png',omitBackground:true});await b.close()})();

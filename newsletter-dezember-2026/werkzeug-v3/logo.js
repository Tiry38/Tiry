const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({deviceScaleFactor:2,viewport:{width:400,height:200}});
fs.writeFileSync(__dirname+'/_l.html',`<html><body style="margin:0;background:#E9E3DC"><div id="x" style="width:180px;padding:0"><img src="../a/velocenter-logo.svg" style="width:180px;display:block"></div></body></html>`);
await p.goto('file://'+__dirname+'/_l.html');await p.waitForTimeout(300);await (await p.$('#x')).screenshot({path:'out/fuss-logo.png'});await b.close()})();

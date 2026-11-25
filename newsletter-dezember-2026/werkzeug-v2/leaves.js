const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:640,height:960}});
await p.goto('file://'+__dirname+'/leaves.html');fs.mkdirSync('fr/leaves',{recursive:true});
for(let i=0;i<60;i++){await p.evaluate(f=>draw(f),i);await p.screenshot({path:`fr/leaves/${String(i).padStart(3,'0')}.png`,omitBackground:true});}
await b.close();})();

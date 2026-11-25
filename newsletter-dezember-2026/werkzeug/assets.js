const {chromium}=require('playwright');const fs=require('fs');
const P='#F4EFEA';
const sym={
fb:'<svg viewBox="0 0 24 24" fill="#fff"><path d="M13.5 21v-7.3H16l.4-3h-2.9V8.9c0-.9.3-1.4 1.5-1.4h1.5V4.8c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.2H8v3h2.6V21z"/></svg>',
ig:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.3" cy="6.7" r="1.1" fill="#fff" stroke="none"/></svg>',
wa:'<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg>',
web:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/></svg>'};
(async()=>{const b=await chromium.launch();const p=await b.newPage({deviceScaleFactor:2,viewport:{width:600,height:400}});
fs.mkdirSync('out',{recursive:true});
async function shot(html,w,h,file,bg='transparent'){fs.writeFileSync(__dirname+'/_t.html',`<html><body style="margin:0;background:${bg}"><div id="x" style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;background:${bg}">${html}</div></body></html>`);await p.goto('file://'+__dirname+'/_t.html');
 await p.waitForTimeout(200);await (await p.$('#x')).screenshot({path:'out/'+file,omitBackground:bg==='transparent'});}
for(const k in sym) await shot(`<div style="width:22px;height:22px">${sym[k].replace('<svg','<svg width="22" height="22"')}</div>`,22,22,'ic-'+k+'.png');
const logo=fs.readFileSync('a/velocenter-logo.svg','utf8').replace('<svg','<svg style="width:170px;height:auto"');
await shot(logo,170,89,'logo.png',P);
const lea=['jr','bl','bb','km','rd','er','cb','lb','dd'];
for(const k of lea){const f=fs.existsSync(`a/lea-${k}.svg`)?`a/lea-${k}.svg`:`a/lea-${k}.webp`;
 await shot(`<img src="${f}" style="max-width:112px;max-height:30px">`,120,40,`lea-${k}.png`,P);}
await shot(`<img src="a/logo-targobank.svg" style="max-width:130px;max-height:32px">`,140,40,'logo-targobank.png',P);
await shot(`<img src="a/logo-enra.svg" style="max-width:110px;max-height:32px">`,120,40,'logo-enra.png',P);
await b.close();})();

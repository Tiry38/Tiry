const {chromium}=require('playwright');const fs=require('fs');
const I={
fb:'<path fill="#fff" d="M13.5 21v-7.3H16l.4-3h-2.9V8.9c0-.9.3-1.4 1.5-1.4h1.5V4.8c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.2H8v3h2.6V21z"/>',
ig:'<g fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4.2"/></g><circle cx="17.3" cy="6.7" r="1.1" fill="#fff"/>',
wa:'<path fill="#fff" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/>',
web:'<g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/></g>',
tel:'<path fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
mail:'<g fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></g>',
cal:'<g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></g>',
map:'<g fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></g>',
wrench:'<path fill="none" stroke="#F2D4B0" stroke-width="1.8" stroke-linejoin="round" d="M14.7 6.3a4 4 0 0 0 5 5l-8.4 8.4a2 2 0 0 1-2.8-2.8l8.4-8.4a4 4 0 0 0-2.2-2.2z M14.7 6.3L17 4"/>',
chip:'<g fill="none" stroke="#F2D4B0" stroke-width="1.8"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></g>',
house:'<g fill="none" stroke="#F2D4B0" stroke-width="1.8" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></g>',
bolt:'<path fill="none" stroke="#F2D4B0" stroke-width="1.8" stroke-linejoin="round" d="M13 2L4 14h7l-1 8 9-12h-7z"/>'};
(async()=>{const b=await chromium.launch();const p=await b.newPage({deviceScaleFactor:2,viewport:{width:700,height:500}});
fs.mkdirSync('out',{recursive:true});
async function shot(html,w,h,file,bg){fs.writeFileSync(__dirname+'/_t.html',`<html><head><style>@font-face{font-family:Outfit;src:url(a/outfit-latin.woff2);font-weight:100 900}@font-face{font-family:Sora;src:url(a/sora-latin.woff2);font-weight:100 900}</style></head><body style="margin:0;background:transparent"><div id="x" style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;gap:0;background:${bg||'transparent'}">${html}</div></body></html>`);
 await p.goto('file://'+__dirname+'/_t.html');await p.waitForTimeout(250);await (await p.$('#x')).screenshot({path:'out/'+file,omitBackground:!bg});}
for(const k in I) await shot(`<svg width="20" height="20" viewBox="0 0 24 24">${I[k]}</svg>`,20,20,'i-'+k+'.png');
for(const k of ['wrench','chip','house','bolt']) await shot(`<svg width="30" height="30" viewBox="0 0 24 24">${I[k]}</svg>`,30,30,'f-'+k+'.png');
await shot(`<img src="a/logo-hell.svg" style="width:170px">`,170,89,'logo-d.png');
// Parkschild
await shot(`<div style="width:92px;height:92px;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center"><div style="width:84px;height:84px;border-radius:9px;background:#1E5AA8;color:#fff;font:800 66px/84px Outfit;text-align:center">P</div></div>`,92,92,'parken.png');
// Marken-Band
const mk=['isy','qio','ktm','stevens','vdv','vanraam','gudereit','victoria'];
await shot(`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px 26px;align-items:center;justify-items:center;width:536px">${mk.map(m=>`<img src="a/marke-${m}.svg" style="max-width:110px;max-height:34px">`).join('')}</div>`,560,118,'marken.png','#F4EFEA');
// Leasing-Logos einzeln auf Creme
for(const k of ['jr','bl','bb','dd','cb','km','lb','er','rd']){const f=fs.existsSync(`a/lea-${k}.svg`)?`a/lea-${k}.svg`:`a/lea-${k}.webp`;
 await shot(`<img src="${f}" style="max-width:118px;max-height:32px">`,168,52,`lea-${k}.png`,'#F4EFEA');}
await shot(`<img src="a/logo-targobank.svg" style="max-width:150px;max-height:34px">`,180,52,'logo-targobank.png','#F4EFEA');
await shot(`<img src="a/logo-enra.svg" style="max-width:130px;max-height:36px">`,180,52,'logo-enra.png','#F4EFEA');
await b.close();})();

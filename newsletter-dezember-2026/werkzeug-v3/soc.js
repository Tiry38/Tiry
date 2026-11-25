const {chromium}=require('playwright');const fs=require('fs');
const SO=[['fb','#1877F2','<path fill="#fff" d="M13.5 21v-7.3H16l.4-3h-2.9V8.9c0-.9.3-1.4 1.5-1.4h1.5V4.8c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.2H8v3h2.6V21z"/>'],
 ['ig','#C13584','<g fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4.2"/></g><circle cx="17.3" cy="6.7" r="1.1" fill="#fff"/>'],
 ['wa','#1FA855','<path fill="#fff" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/>'],
 ['hp','#C8102E','<g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/></g>']];
(async()=>{const b=await chromium.launch();const p=await b.newPage({deviceScaleFactor:2,viewport:{width:300,height:200}});
for(const [k,c,svg] of SO){fs.writeFileSync(__dirname+'/_s.html',`<html><body style="margin:0;background:#E9E3DC"><div id="x" style="width:52px;height:52px;border-radius:50%;background:${c};display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="26" height="26">${svg}</svg></div></body></html>`);
 await p.goto('file://'+__dirname+'/_s.html');await (await p.$('#x')).screenshot({path:`out/so-${k}.png`});}
await b.close()})();

const {chromium}=require('playwright');const fs=require('fs');
const IG_BG='radial-gradient(circle at 30% 107%,#fdf497 0%,#fdf497 5%,#fd5949 45%,#d6249f 60%,#285AEB 90%)';
const SO=[
 ['fb','#0866FF','<path fill="#fff" d="M14.2 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H8.1V14h2.8v8z"/>'],
 ['ig',IG_BG,'<g fill="none" stroke="#fff" stroke-width="1.9"><rect x="4" y="4" width="16" height="16" rx="4.6"/><circle cx="12" cy="12" r="3.8"/></g><circle cx="16.6" cy="7.4" r="1.05" fill="#fff"/>'],
 ['wa','#25D366','<path fill="#fff" d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.2 20.8l4.5-1.2A8.8 8.8 0 1 0 12 3.2zm0 1.6a7.2 7.2 0 1 1-3.7 13.4l-.3-.2-2.6.7.7-2.5-.2-.3A7.2 7.2 0 0 1 12 4.8zm-2.9 3.6c-.2 0-.5 0-.7.3-.3.3-1 .9-1 2.2s1 2.5 1.1 2.7c.1.2 1.9 3 4.6 4.1 2.3.9 2.7.7 3.2.7.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3l-1.8-.9c-.3-.1-.4-.1-.6.1l-.8 1c-.2.2-.3.2-.6.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.6-1.5-1.8-.2-.3 0-.4.1-.5l.4-.5.3-.4c.1-.2 0-.3 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4z"/>'],
 ['hp','linear-gradient(135deg,#E2232D,#8E0E26)','<g fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M3.5 9h17"/><circle cx="6.3" cy="7" r=".45" fill="#fff" stroke="none"/><circle cx="8.1" cy="7" r=".45" fill="#fff" stroke="none"/><path d="M10 15.5l4-4M11 11.5h3v3"/></g>']];
(async()=>{const b=await chromium.launch();const p=await b.newPage({deviceScaleFactor:2,viewport:{width:300,height:200}});
for(const [k,c,svg] of SO){fs.writeFileSync(__dirname+'/_s.html',`<html><body style="margin:0;background:#E9E3DC"><div id="x" style="width:52px;height:52px;border-radius:50%;background:${c};display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)"><svg viewBox="0 0 24 24" width="28" height="28">${svg}</svg></div></body></html>`);
 await p.goto('file://'+__dirname+'/_s.html');await (await p.$('#x')).screenshot({path:`out/so-${k}.png`});}
await b.close()})();

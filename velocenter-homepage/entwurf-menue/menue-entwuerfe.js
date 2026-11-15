// 6 Menü-Entwürfe: blendet den echten Kopf aus und setzt einen eigenen ein, dann Screenshots PC + Handy
const {chromium}=require('playwright');const fs=require('fs');
const IT=[['Start','spark',1],['Service','wrench'],['Marken','star'],['Auf Lager','box',0,1],['i:SY Experte','bike'],['i:SY Treffen','heart'],['E-Dreiräder','tri'],['Kontakt','phone']];
const ico=n=>`<svg class="ic"><use href="#i-${n}"/></svg>`;
const live='<em class="lv">LIVE</em>';
const links=(f)=>IT.map(([t,i,on,l],k)=>f(t,i,on,l,k)).join('');
const LOGO='<img class="lg" src="img/velocenter-logo.svg" alt="">';
const STAT='<span class="st"><i></i><b>Zu</b> · ab Mo 9:00</span>';
const TERM=`<a class="tm">${ico('cal')}Termin</a>`;
const COMMON=`.hdr,.mbar{display:none!important}.proto{display:none!important}
#vx{position:fixed;z-index:70;font-family:Outfit,system-ui,sans-serif}
#vx .ic{width:20px;height:20px;flex:none}
#vx a{text-decoration:none;cursor:pointer}
#vx .lv{font:800 9px/1 Outfit;letter-spacing:.08em;font-style:normal;color:#fff;background:#E2232D;border-radius:99px;padding:3px 6px;margin-left:6px}
#vx .lg{height:58px;width:auto;display:block}
#vx .st{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 16px;border-radius:99px;background:#1F2029;color:#fff;font:600 14px/1 Outfit;white-space:nowrap}
#vx .st i{width:10px;height:10px;border-radius:50%;background:#FF6B7A;box-shadow:0 0 0 4px rgba(255,107,122,.25)}
#vx .st b{color:#FF6B7A}
#vx .tm{display:inline-flex;align-items:center;gap:8px;height:46px;padding:0 20px;border-radius:99px;color:#fff;font:700 14px/1 Outfit;letter-spacing:.06em;text-transform:uppercase;background:linear-gradient(120deg,#F4404D,#C8102E 55%,#8E1A6E);box-shadow:0 12px 26px -10px rgba(200,16,46,.7)}
#vx .tm .ic{width:18px;height:18px}
@media (max-width:760px){#vx .hide-m{display:none!important}}`;

const V={
// 1 Neon-Brücke: dunkle volle Leiste, Symbol über Text, Neon-Strahl unter aktivem Punkt
M1:{h:`<header id="vx" class="m1"><div class="in">${LOGO}<nav class="hide-m">${links((t,i,on,l)=>`<a class="${on?'on':''}">${ico(i)}<span>${t}${l?live:''}</span></a>`)}</nav><div class="r">${STAT}${TERM}</div><button class="bg" aria-label="Menü"><i></i><i></i><i></i></button></div></header>`,
c:`#vx.m1{left:0;right:0;top:0;background:linear-gradient(180deg,rgba(18,18,26,.94),rgba(26,24,36,.9));backdrop-filter:blur(20px);box-shadow:0 20px 40px -24px rgba(0,0,0,.7)}
#vx.m1::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent,#E2232D 20%,#C04BFF 50%,#22C3D6 80%,transparent)}
#vx.m1 .in{display:flex;align-items:center;gap:20px;height:96px;padding:0 28px}
#vx.m1 .lg{filter:brightness(1.6) drop-shadow(0 0 14px rgba(226,35,45,.6));height:54px}
#vx.m1 nav{display:flex;gap:2px;margin:0 auto}
#vx.m1 nav a{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 12px 14px;color:rgba(255,255,255,.66);font:600 13.5px/1 Outfit;border-radius:16px}
#vx.m1 nav a .ic{width:22px;height:22px}
#vx.m1 nav a.on{color:#fff}
#vx.m1 nav a.on .ic{color:#FF4D5E;filter:drop-shadow(0 0 8px #FF4D5E)}
#vx.m1 nav a.on::after{content:"";position:absolute;left:18%;right:18%;bottom:-8px;height:3px;border-radius:3px;background:#FF4D5E;box-shadow:0 0 14px 2px #FF4D5E,0 -18px 30px 6px rgba(255,77,94,.25)}
#vx.m1 .r{display:flex;gap:10px;align-items:center}
#vx.m1 .st{background:rgba(255,255,255,.08)}
#vx .bg{display:none}
@media (max-width:760px){#vx.m1 .in{height:70px;padding:0 14px;gap:10px}#vx.m1 .lg{height:40px}#vx.m1 .r{margin-left:auto}#vx.m1 .tm{display:none}#vx .bg{display:grid;gap:5px;place-content:center;width:46px;height:46px;border-radius:14px;border:0;background:rgba(255,255,255,.1)}#vx .bg i{width:20px;height:2px;background:#fff;border-radius:2px}}`},

// 2 Dynamic Island: kleine schwarze Insel, aufgeklappt = Panel mit runden Farb-Blasen
M2:{h:`<header id="vx" class="m2"><div class="isl"><span class="dot"></span><img class="lg" src="img/velocenter-logo.svg" alt=""><span class="cur">Start</span><span class="mn">Menü<svg class="ic"><use href="#i-arrow"/></svg></span>${TERM}</div>
<div class="pan">${links((t,i,on,l,k)=>`<a class="${on?'on':''}" style="--k:${k}"><span class="bub">${ico(i)}</span><span>${t}${l?live:''}</span></a>`)}<div class="pf">${STAT}<span class="ph">${ico('phone')} 07271 78033</span></div></div></header>`,
c:`#vx.m2{left:50%;top:14px;transform:translateX(-50%);width:min(760px,calc(100% - 24px));display:grid;justify-items:center;gap:10px}
#vx.m2 .isl{display:flex;align-items:center;gap:14px;height:62px;padding:0 8px 0 20px;border-radius:99px;background:#0E0E14;box-shadow:0 18px 40px -16px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.08)}
#vx.m2 .dot{width:9px;height:9px;border-radius:50%;background:#34D399;box-shadow:0 0 10px #34D399}
#vx.m2 .lg{height:36px;filter:brightness(1.7)}
#vx.m2 .cur{color:#fff;font:700 16px/1 Outfit;padding-left:14px;border-left:1px solid rgba(255,255,255,.15)}
#vx.m2 .mn{display:inline-flex;align-items:center;gap:6px;color:rgba(255,255,255,.7);font:600 14px/1 Outfit}
#vx.m2 .mn .ic{width:16px;height:16px;transform:rotate(90deg)}
#vx.m2 .tm{height:46px}
#vx.m2 .pan{width:100%;display:grid;grid-template-columns:repeat(4,1fr);gap:18px 10px;padding:24px 22px 18px;border-radius:38px;background:rgba(14,14,20,.92);backdrop-filter:blur(24px);box-shadow:0 30px 60px -24px rgba(0,0,0,.7)}
#vx.m2 .pan>a{display:grid;justify-items:center;gap:8px;color:#fff;font:600 14px/1.2 Outfit;text-align:center}
#vx.m2 .bub{display:grid;place-items:center;width:62px;height:62px;border-radius:50%;--a:calc(var(--k)*45deg);background:conic-gradient(from var(--a),#E2232D,#C04BFF,#22C3D6,#E2232D);box-shadow:0 10px 24px -8px rgba(192,75,255,.6)}
#vx.m2 .bub .ic{width:26px;height:26px;color:#fff}
#vx.m2 a.on .bub{outline:3px solid #fff;outline-offset:3px}
#vx.m2 .pf{grid-column:1/-1;display:flex;justify-content:center;gap:10px;padding-top:6px;border-top:1px solid rgba(255,255,255,.1);margin-top:4px}
#vx.m2 .ph{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 16px;border-radius:99px;background:rgba(255,255,255,.08);color:#fff;font:600 14px/1 Outfit}
@media (max-width:760px){#vx.m2 .cur,#vx.m2 .tm{display:none}#vx.m2 .pan{grid-template-columns:repeat(3,1fr);padding:18px 12px}#vx.m2 .bub{width:52px;height:52px}#vx.m2 .pf{flex-wrap:wrap}}`},

// 3 Seiten-Rail: Menü links senkrecht wie eine App
M3:{h:`<header id="vx" class="m3"><nav class="rail">${LOGO}${links((t,i,on,l)=>`<a class="${on?'on':''}"><span class="b">${ico(i)}</span><span class="t">${t}${l?'<em class="lv">●</em>':''}</span></a>`)}</nav><div class="tr">${STAT}${TERM}</div></header>`,
c:`#vx.m3{inset:0 auto 0 0;pointer-events:none}
#vx.m3 .rail{pointer-events:auto;position:fixed;left:16px;top:16px;bottom:16px;width:104px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 8px;border-radius:40px;background:rgba(255,255,255,.55);backdrop-filter:blur(22px) saturate(1.6);box-shadow:0 24px 50px -24px rgba(40,20,60,.45),inset 0 0 0 1px rgba(255,255,255,.7)}
#vx.m3 .lg{height:auto;width:84px;margin-bottom:10px}
#vx.m3 .rail a{display:grid;justify-items:center;gap:4px;color:#3A3F4E;font:600 11.5px/1.1 Outfit;text-align:center}
#vx.m3 .b{display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:rgba(27,30,37,.06);transition:.3s}
#vx.m3 a.on .b{width:54px;height:54px;color:#fff;background:linear-gradient(135deg,#F4404D,#C8102E 50%,#7A1FA2);box-shadow:0 10px 22px -8px rgba(200,16,46,.8)}
#vx.m3 a.on{color:#C8102E}
#vx.m3 .lv{background:none;color:#E2232D;padding:0;margin-left:2px}
#vx.m3 .tr{pointer-events:auto;position:fixed;right:24px;top:22px;display:flex;gap:10px}
body{padding-left:130px}
@media (max-width:760px){body{padding-left:0}#vx.m3 .rail{top:auto;left:10px;right:10px;bottom:10px;width:auto;height:76px;flex-direction:row;justify-content:space-between;padding:8px 10px;overflow-x:auto}#vx.m3 .lg{display:none}#vx.m3 .t{font-size:10px;white-space:nowrap}#vx.m3 .b{width:38px;height:38px}#vx.m3 a.on .b{width:44px;height:44px}#vx.m3 .tm{display:none}#vx.m3 .tr{right:12px;top:12px}}`},

// 4 Unteres Dock: Menü unten mittig schwebend, oben nur Logo/Status/Termin
M4:{h:`<header id="vx" class="m4"><div class="top">${LOGO}<div class="r">${STAT}${TERM}</div></div><nav class="dock">${links((t,i,on,l,k)=>`<a class="${on?'on':''}" style="--k:${k}"><span class="b">${ico(i)}${l?'<em class="lv">LIVE</em>':''}</span><span class="t">${t}</span></a>`)}</nav></header>`,
c:`#vx.m4{inset:0;pointer-events:none}
#vx.m4 .top{pointer-events:auto;position:fixed;left:0;right:0;top:0;display:flex;align-items:center;justify-content:space-between;padding:16px 28px}
#vx.m4 .r{display:flex;gap:10px}
#vx.m4 .dock{pointer-events:auto;position:fixed;left:50%;bottom:18px;transform:translateX(-50%);display:flex;align-items:flex-end;gap:10px;padding:12px 16px;border-radius:34px;background:rgba(255,255,255,.5);backdrop-filter:blur(24px) saturate(1.7);box-shadow:0 24px 50px -20px rgba(40,20,60,.5),inset 0 0 0 1px rgba(255,255,255,.8)}
#vx.m4 .dock a{display:grid;justify-items:center;gap:6px;color:#2A2E38;font:600 12px/1 Outfit}
#vx.m4 .b{position:relative;display:grid;place-items:center;width:56px;height:56px;border-radius:20px 20px 20px 20px;border-radius:50%;color:#fff;--h:calc(var(--k)*42deg);background:linear-gradient(135deg,hsl(calc(350deg + var(--h)) 85% 58%),hsl(calc(320deg + var(--h)) 75% 45%));box-shadow:0 10px 20px -8px rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.35)}
#vx.m4 .b .ic{width:24px;height:24px}
#vx.m4 a.on .b{width:72px;height:72px;transform:translateY(-10px)}
#vx.m4 a.on .t{transform:translateY(-10px);color:#C8102E}
#vx.m4 a.on::after{content:"";width:6px;height:6px;border-radius:50%;background:#C8102E;margin-top:-6px}
#vx.m4 .lv{position:absolute;top:-6px;right:-10px;margin:0}
@media (max-width:760px){#vx.m4 .top{padding:12px}#vx.m4 .lg{height:40px}#vx.m4 .tm{display:none}#vx.m4 .dock{left:8px;right:8px;transform:none;bottom:10px;gap:4px;padding:10px 8px;overflow-x:auto;justify-content:space-between}#vx.m4 .b{width:40px;height:40px}#vx.m4 a.on .b{width:48px;height:48px}#vx.m4 .t{font-size:10px;white-space:nowrap}}`},

// 5 Farb-Pillen: jeder Bereich eigene Farbe
M5:{h:`<header id="vx" class="m5"><div class="in">${LOGO}<nav class="hide-m">${links((t,i,on,l,k)=>`<a class="${on?'on':''}" style="--c:${['#E2232D','#F97316','#8B5CF6','#16A34A','#EA580C','#DB2777','#0D9488','#2563EB'][k]}">${ico(i)}${t}${l?live:''}</a>`)}</nav><div class="r">${STAT}${TERM}</div></div></header>`,
c:`#vx.m5{left:0;right:0;top:0;padding:14px 20px}
#vx.m5 .in{display:flex;align-items:center;gap:16px;padding:8px 10px 8px 18px;border-radius:99px;background:rgba(255,255,255,.62);backdrop-filter:blur(22px) saturate(1.6);box-shadow:0 18px 40px -20px rgba(40,20,60,.4),inset 0 0 0 1px rgba(255,255,255,.8)}
#vx.m5 .lg{height:46px}
#vx.m5 nav{display:flex;gap:6px;margin:0 auto;flex-wrap:nowrap}
#vx.m5 nav a{display:inline-flex;align-items:center;gap:7px;height:44px;padding:0 14px;border-radius:99px;font:700 14px/1 Outfit;white-space:nowrap;color:color-mix(in srgb,var(--c) 80%,#000);background:color-mix(in srgb,var(--c) 12%,transparent);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--c) 35%,transparent)}
#vx.m5 nav a .ic{width:17px;height:17px}
#vx.m5 nav a.on{color:#fff;background:linear-gradient(135deg,color-mix(in srgb,var(--c) 70%,#fff),var(--c) 50%,color-mix(in srgb,var(--c) 70%,#000));box-shadow:0 10px 22px -8px var(--c)}
#vx.m5 .r{display:flex;gap:8px}
@media (max-width:760px){#vx.m5{padding:10px}#vx.m5 .lg{height:36px}#vx.m5 .tm{display:none}#vx.m5 .r{margin-left:auto}}`},

// 6 Zweistöckig: Info-Band + große Leiste mit flüssigem Verlaufs-Tropfen unter dem aktiven Punkt
M6:{h:`<header id="vx" class="m6"><div class="info"><span>${STAT}</span><span class="hide-m">${ico('phone')} 07271 78033</span><span class="hide-m">${ico('pin')} Hartmannstraße 25 · Wörth am Rhein</span><span class="hide-m">★ 4,8 bei Google</span><span class="so">${ico('ig')}${ico('fb')}${ico('chat')}</span></div>
<div class="main">${LOGO}<nav class="hide-m">${links((t,i,on,l)=>`<a class="${on?'on':''}">${t}${l?live:''}</a>`)}</nav>${TERM}</div></header>`,
c:`#vx.m6{left:0;right:0;top:0}
#vx.m6 .info{display:flex;align-items:center;gap:26px;height:38px;padding:0 28px;background:linear-gradient(90deg,#16161E,#24202F 50%,#16161E);color:rgba(255,255,255,.8);font:500 13px/1 Outfit}
#vx.m6 .info>span{display:inline-flex;align-items:center;gap:7px}
#vx.m6 .info .ic{width:15px;height:15px}
#vx.m6 .info .st{height:26px;padding:0 10px 0 0;background:none;font-size:13px}
#vx.m6 .so{margin-left:auto;gap:14px!important}
#vx.m6 .main{display:flex;align-items:center;gap:24px;height:84px;padding:0 28px;background:rgba(255,255,255,.6);backdrop-filter:blur(22px) saturate(1.6);box-shadow:0 18px 30px -24px rgba(40,20,60,.5)}
#vx.m6 nav{display:flex;gap:4px;margin:0 auto;position:relative}
#vx.m6 nav a{position:relative;z-index:1;padding:14px 16px;font:700 16px/1 Outfit;color:#2A2E38;white-space:nowrap}
#vx.m6 nav a.on{color:#fff}
#vx.m6 nav a.on::before{content:"";position:absolute;z-index:-1;inset:2px -4px;border-radius:60% 40% 55% 45%/55% 50% 50% 45%;background:linear-gradient(120deg,#E2232D,#C04BFF 60%,#22C3D6);box-shadow:0 12px 24px -8px rgba(192,75,255,.6)}
#vx.m6 nav a.on::after{content:"";position:absolute;z-index:-1;width:16px;height:16px;border-radius:50%;right:-14px;top:50%;margin-top:-8px;background:#C04BFF;opacity:.8}
@media (max-width:760px){#vx.m6 .info{padding:0 12px;gap:10px}#vx.m6 .main{height:66px;padding:0 12px}#vx.m6 .lg{height:40px}#vx.m6 .tm{margin-left:auto;height:42px;padding:0 14px}}`}
};

(async()=>{const b=await chromium.launch();fs.mkdirSync(__dirname+'/menu',{recursive:true});
for(const [k,v] of Object.entries(V)){for(const [n,w,h] of [['pc',1440,900],['handy',390,844]]){
 const p=await b.newPage({viewport:{width:w,height:h}});
 await p.goto('http://localhost:8765/index.html',{waitUntil:'load'});
 await p.addStyleTag({content:COMMON+v.c});
 await p.evaluate(h=>document.body.insertAdjacentHTML('afterbegin',h),v.h);
 await p.waitForTimeout(2500);await p.screenshot({path:`${__dirname}/menu/${k}-${n}.png`});await p.close();}}
await b.close();})();

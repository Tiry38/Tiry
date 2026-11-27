import{c as e,d as t,h as n,m as r,p as i,s as a}from"./gmail-CjWf5yLz.js";var o=e=>e.replace(/[&<>"]/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`})[e]),s=[`#5fd38a`,`#4fc3b8`,`#f6c945`,`#f59a3c`,`#ec5a3f`],c=`#1d1a17`,l=`#2a2724`,u=`#6f6a64`,d=`#f4f1ea`,f=`-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;function p(e){return e.replace(/\r/g,``).split(/\n{2,}/).map(e=>e.replace(/\s+$/,``)).filter(e=>e.trim()).map(e=>{let t=e.split(`
`).every(e=>e.startsWith(`>`)),n=o(t?e.split(`
`).map(e=>e.replace(/^>\s?/,``)).join(`
`):e).replace(/(https?:\/\/[^\s<]+)/g,`<a href="$1" style="color:${s[4]};text-decoration:underline">$1</a>`).replace(/\n/g,`<br>`);return t&&(n=`<!--zitat-->${n}`),n})}function m(e){return e>1048576?`${(e/1048576).toFixed(1).replace(`.`,`,`)} MB`:`${Math.max(1,Math.round(e/1024))} KB`}function h(e){return`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>${s.map(t=>`<td width="20%" height="${e}" bgcolor="${t}" style="background:${t};height:${e}px;line-height:${e}px;font-size:1px;mso-line-height-rule:exactly">&nbsp;</td>`).join(``)}</tr></table>`}function g(e,t,n){return`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr>
    <td bgcolor="${n}" style="background:${n};border-radius:10px;mso-padding-alt:10px 18px">
      <a href="${o(t)}" target="_blank" style="display:inline-block;padding:10px 18px;font:700 14px/1.2 ${f};color:${c};text-decoration:none;border-radius:10px">${o(e)}</a>
    </td></tr></table>`}function _(e){let t=p(e.text),n=o(e.text.replace(/\s+/g,` `).slice(0,140)),r=t.map((e,t)=>e.startsWith(`<!--zitat-->`)?`<tr><td style="padding:4px 0 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="4" bgcolor="#d8d2c8" style="background:#d8d2c8;width:4px;font-size:1px">&nbsp;</td>
        <td style="padding:2px 0 2px 14px;font:14px/1.55 ${f};color:${u}">${e.slice(12)}</td></tr></table></td></tr>`:`<tr><td class="tm-p" style="padding:0 0 18px;font:${t===0?`600 19px/1.45`:`400 16px/1.65`} ${f};color:${t===0?c:l}">${e}</td></tr>`).join(``),i=(e.links??[]).filter(e=>e.link&&e.link!==`#`),a=(e.links??[]).filter(e=>!e.link||e.link===`#`),_=[...i.map((e,t)=>({name:e.name,info:`${m(e.groesse)} · zum Herunterladen`,href:e.link,farbe:s[(t+1)%5]})),...a.map((e,t)=>({name:e.name,info:`${m(e.groesse)} · zum Herunterladen`,href:``,farbe:s[(t+1)%5]})),...(e.anhaenge??[]).filter(t=>!(e.links??[]).some(e=>e.name===t.name)).map((e,t)=>({name:e.name,info:`${m(e.groesse)} · im Anhang`,href:``,farbe:s[(t+3)%5]}))],v=_.length?`
    <tr><td style="padding:8px 0 6px;font:700 12px/1 ${f};letter-spacing:1.2px;text-transform:uppercase;color:${u}">${_.length===1?`Datei`:`Dateien`}</td></tr>
    ${_.map(e=>`<tr><td style="padding:0 0 10px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:${d};border-radius:12px" bgcolor="${d}"><tr>
        <td width="6" bgcolor="${e.farbe}" style="background:${e.farbe};width:6px;border-radius:12px 0 0 12px;font-size:1px">&nbsp;</td>
        <td style="padding:14px 16px">
          <div style="font:700 15px/1.3 ${f};color:${c};word-break:break-word">${o(e.name)}</div>
          <div style="font:13px/1.4 ${f};color:${u};padding-top:2px">${o(e.info)}</div>
          ${e.href?`<div style="padding-top:12px">${g(`Herunterladen`,e.href,e.farbe)}</div>`:``}
        </td>
      </tr></table></td></tr>`).join(``)}`:``;return`<!doctype html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta name="x-apple-disable-message-reformatting">
<title>${o(e.betreff)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0;mso-table-rspace:0}
  a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
  @media (max-width:620px){
    .tm-aussen{padding:0!important}
    .tm-karte{border-radius:0!important}
    .tm-innen{padding:26px 22px 8px!important}
    .tm-kopf{padding:26px 22px 22px!important}
    .tm-titel{font-size:24px!important}
  }
  @media (prefers-color-scheme:dark){
    .tm-hg{background:#151311!important}
    .tm-karte,.tm-innen{background:#221f1c!important}
    .tm-p{color:#ece7df!important}
    .tm-fuss{color:#a39d95!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#efebe3;word-spacing:normal" class="tm-hg">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${n}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#efebe3" class="tm-hg" style="background:#efebe3">
<tr><td align="center" class="tm-aussen" style="padding:32px 12px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tm-karte" style="max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden" bgcolor="#ffffff">
  <tr><td>${h(8)}</td></tr>
  <tr><td class="tm-kopf" bgcolor="${c}" style="background:${c};padding:34px 40px 30px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font:700 12px/1 ${f};letter-spacing:1.6px;text-transform:uppercase;color:${s[2]}">Nachricht von ${o(e.vonName)}</td>
      <td rowspan="3" width="64" align="right" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${s.map((e,t)=>`<td width="9" valign="bottom" style="padding-left:3px"><div style="width:9px;height:${[46,30,40,20,34][t]}px;background:${e};border-radius:5px;font-size:1px;line-height:1px">&nbsp;</div></td>`).join(``)}</tr></table>
      </td>
    </tr><tr>
      <td class="tm-titel" style="padding-top:12px;font:800 28px/1.18 ${f};color:#ffffff;letter-spacing:-0.3px">${o(e.betreff||`Neue Nachricht`)}</td>
    </tr><tr>
      <td style="padding-top:18px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${s.map((e,t)=>`<td width="${[44,28,36,18,30][t]}" height="4" bgcolor="${e}" style="background:${e};height:4px;font-size:1px;line-height:4px">&nbsp;</td><td width="6" style="font-size:1px">&nbsp;</td>`).join(``)}</tr></table>
      </td>
    </tr></table>
  </td></tr>
  <tr><td class="tm-innen" style="padding:36px 40px 12px;background:#ffffff" bgcolor="#ffffff">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${r}
      ${v}
    </table>
  </td></tr>
  <tr><td class="tm-innen" style="padding:8px 40px 34px;background:#ffffff" bgcolor="#ffffff">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="36" valign="middle">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${s.map((e,t)=>`<td width="4" valign="bottom" style="padding-right:2px"><div style="width:4px;height:${[18,12,16,8,14][t]}px;background:${e};border-radius:2px;font-size:1px;line-height:1px">&nbsp;</div></td>`).join(``)}</tr></table>
      </td>
      <td valign="middle" class="tm-fuss" style="padding-left:10px;font:700 15px/1.3 ${f};color:${c}">${o(e.vonName)}</td>
    </tr></table>
  </td></tr>
  <tr><td>${h(4)}</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`}var v=[{id:`INBOX`,name:`Posteingang`,art:`system`},{id:`STARRED`,name:`Mit Stern`,art:`system`},{id:`SENT`,name:`Gesendet`,art:`system`},{id:`ALLE`,name:`Alle Mails`,art:`system`},{id:`SPAM`,name:`Spam`,art:`system`},{id:`TRASH`,name:`Papierkorb`,art:`system`}],y=class{gmail;kategorieVon;eigeneAdresse;cache=new Map;volle=new Map;laeuft=new Map;labelNamen=new Map;letzte=[];platz=()=>{};constructor(e,t,n){this.gmail=e,this.kategorieVon=t,this.eigeneAdresse=n}async ordner(){let e=await this.gmail.labels();this.labelNamen.clear();for(let t of e)this.labelNamen.set(t.id,t.name);let t=e.filter(e=>(e.id.startsWith(`Label_`)||!/^[A-Z_]+$/.test(e.id))&&e.name!==`Aufräumer`),n=t.filter(e=>e.name.startsWith(`Aufräumer/`)).map(e=>({id:e.id,name:e.name.slice(10),art:`sorte`})),r=t.filter(e=>!e.name.startsWith(`Aufräumer/`)).map(e=>({id:e.id,name:e.name,art:`firma`})),i=0;try{i=(await this.gmail.labelInfo(`INBOX`)).ungelesen}catch{}return[...v.map(e=>e.id===`INBOX`?{...e,ungelesen:i}:e),...r.sort((e,t)=>e.name.localeCompare(t.name,`de`)),...n.sort((e,t)=>e.name.localeCompare(t.name,`de`))]}zeile(e){let t=n(e.headers.from),r=this.kategorieVon(e.id,e.labelIds);return{id:e.id,threadId:e.threadId,von:t.name||t.adresse,vonAdresse:t.adresse,betreff:i(e.headers.subject??``),vorschau:e.snippet,datum:e.internalDate,ungelesen:e.labelIds.includes(`UNREAD`),stern:e.labelIds.includes(`STARRED`),anhang:/multipart\/mixed/i.test(e.headers[`content-type`]??``),kategorie:r,labelIds:e.labelIds}}async liste(e,t=``,n){let r=e===`ALLE`?null:e,i=await this.gmail.listeOrdner(r,t,n,50),a=Date.now(),o=i.ids.filter(e=>{let t=this.cache.get(e);return!t||a-t.zeit>12e4});if(o.length)for(let e of await this.gmail.holeMetadaten(o))this.cache.set(e.id,{mail:e,zeit:a});if(this.cache.size>3e3)for(let e of[...this.cache.keys()].slice(0,1e3))this.cache.delete(e);return{zeilen:i.ids.map(e=>this.cache.get(e)?.mail).filter(e=>!!e).map(e=>this.zeile(e)),weiter:i.nextPageToken,gesamt:i.geschaetzt}}holeVoll(e){let t=this.volle.get(e);if(t&&Date.now()-t.zeit<6e5)return Promise.resolve(t.roh);let n=this.laeuft.get(e);if(n)return n;let r=this.gmail.holeVoll(e).then(t=>{if(this.volle.set(e,{roh:t,zeit:Date.now()}),this.volle.size>150)for(let e of[...this.volle.keys()].slice(0,50))this.volle.delete(e);return t}).finally(()=>this.laeuft.delete(e));return this.laeuft.set(e,r),r}async vorladen(e){let t=e.filter(e=>!this.volle.has(e)).slice(0,12),n=0;await Promise.all(Array.from({length:Math.min(3,t.length)},async()=>{for(;n<t.length;){let e=t[n++];try{await this.holeVoll(e)}catch{}}}))}async lesen(e){let r=await this.holeVoll(e),a=t(r);if(a.labelIds.includes(`UNREAD`)){this.gmail.modify(e,[],[`UNREAD`]).catch(()=>{}),a.labelIds=a.labelIds.filter(e=>e!==`UNREAD`),r.labelIds=(r.labelIds??[]).filter(e=>e!==`UNREAD`);let t=this.cache.get(e);t&&(t.mail.labelIds=t.mail.labelIds.filter(e=>e!==`UNREAD`))}let o=n(a.headers.from),s=this.kategorieVon(e,a.labelIds),c=s===`phishing`?`Achtung: Diese Mail sieht nach Betrug aus. Klick keine Links an und gib keine Daten ein.`:s===`spam`?`Diese Mail ist wahrscheinlich Spam.`:null;return{...a,von:o.name||o.adresse,vonAdresse:o.adresse,an:a.headers.to??``,cc:a.headers.cc??``,betreff:i(a.headers.subject??``),kategorie:s,warnung:c}}async anhang(e,t){return this.gmail.anhang(e,t.anhangId)}async vorlage(t,i){let a=await this.lesen(t),o=this.eigeneAdresse().toLowerCase(),s=`\n\nAm ${new Date(a.datum).toLocaleString(`de-DE`)} schrieb ${a.von} <${a.vonAdresse}>:\n`+(a.text??(a.html??``).replace(/<style[\s\S]*?<\/style>/gi,``).replace(/<[^>]+>/g,` `).replace(/\s+\n/g,`
`)).split(`
`).map(e=>`> ${e}`).join(`
`),c=a.headers[`reply-to`]||a.headers.from||``,l=[],u=[];return i===`antworten`&&(l=[c]),i===`allen`&&(l=[c],u=[...r(a.an),...r(a.cc)].filter(e=>e.adresse!==o&&e.adresse!==n(c).adresse).map(e=>e.name?`${e.name} <${e.adresse}>`:e.adresse)),{an:l,cc:u,betreff:e(i===`weiter`?`Fwd`:`Re`,a.betreff),text:i===`weiter`?`\n\n---------- Weitergeleitete Nachricht ----------\nVon: ${a.von} <${a.vonAdresse}>\nDatum: ${new Date(a.datum).toLocaleString(`de-DE`)}\nBetreff: ${a.betreff}\n\n${a.text??``}`:s,threadId:i===`weiter`?void 0:a.threadId,inReplyTo:i===`weiter`?void 0:a.headers[`message-id`],references:i===`weiter`?void 0:[a.headers.references,a.headers[`message-id`]].filter(Boolean).join(` `)}}async senden(e){let t=e.an.flatMap(e=>e.split(/[,;]/)).map(e=>e.trim()).filter(Boolean);if(!t.length)throw Error(`Bitte mindestens einen Empfänger eintragen.`);for(let n of[...t,...e.cc??[],...e.bcc??[]])if(!/@[^@\s>]+\.[^@\s>]+/.test(n))throw Error(`„${n}“ ist keine gültige Adresse.`);let n=e.gestaltet===!1?void 0:_({betreff:e.betreff,text:e.text,vonName:e.vonName??`Tiry`,links:e.links,anhaenge:e.anhaenge?.map(e=>({name:e.name,groesse:e.daten.length}))}),r=a({von:this.eigeneAdresse(),an:t,cc:e.cc,bcc:e.bcc,betreff:e.betreff,text:e.text,inReplyTo:e.inReplyTo,references:e.references,anhaenge:e.anhaenge,html:n});await this.gmail.sendeMail(r,e.threadId)}async aktion(e,t){let n=e.map(e=>this.cache.get(e)?.mail).filter(e=>!!e),r=e.filter(e=>!this.cache.has(e)),i=[...n.map(e=>structuredClone(e)),...r.length?await this.gmail.holeMetadaten(r):[]];this.letzte=i.map(e=>({id:e.id,vorher:[...e.labelIds],groesse:e.sizeEstimate??0})),t===`papierkorb`&&this.platz(i.filter(e=>!e.labelIds.includes(`TRASH`)).reduce((e,t)=>e+(t.sizeEstimate??0),0)),await Promise.all(i.map(async e=>{t===`papierkorb`?await this.gmail.trash(e.id):t===`archiv`?await this.gmail.modify(e.id,[],[`INBOX`]):t===`posteingang`?(e.labelIds.includes(`TRASH`)&&await this.gmail.untrash(e.id),await this.gmail.modify(e.id,[`INBOX`],[`SPAM`])):t===`stern`?await this.gmail.modify(e.id,[`STARRED`],[]):t===`sternWeg`?await this.gmail.modify(e.id,[],[`STARRED`]):t===`gelesen`?await this.gmail.modify(e.id,[],[`UNREAD`]):t===`ungelesen`?await this.gmail.modify(e.id,[`UNREAD`],[]):await this.gmail.modify(e.id,[t.ordner],[`INBOX`]),this.cache.delete(e.id),this.volle.delete(e.id)}))}async rueckgaengig(){let e=0;for(let{id:t,vorher:n,groesse:r}of this.letzte){let[i]=await this.gmail.holeMetadaten([t]);if(!i)continue;i.labelIds.includes(`TRASH`)&&!n.includes(`TRASH`)&&(await this.gmail.untrash(t),this.platz(-(r??0)),[i]=await this.gmail.holeMetadaten([t]));let a=n.filter(e=>!i.labelIds.includes(e)&&e!==`TRASH`),o=i.labelIds.filter(e=>!n.includes(e)&&e!==`TRASH`);(a.length||o.length)&&await this.gmail.modify(t,a,o),this.cache.delete(t),e++}return this.letzte=[],e}async ordnerInhalt(e){this.labelNamen.size||await this.ordner();let t=this.labelNamen.get(e)??e,n=(await this.alleIds(e,`is:starred`)).length;return{name:t,gesamt:(await this.gmail.labelInfo(e)).gesamt,stern:n}}async alleIds(e,t=``){let n=[],r;do{let i=await this.gmail.listeOrdner(e,t,r,500);n.push(...i.ids),r=i.nextPageToken}while(r);return[...new Set(n)]}async ordnerLoeschen(e,t=()=>{}){if(/^[A-Z_]+$/.test(e))throw Error(`System-Ordner (Posteingang, Gesendet …) kann man nicht löschen.`);this.labelNamen.size||await this.ordner();let n=this.labelNamen.get(e)??e,r=await this.alleIds(e,`-is:starred`),i=(await this.alleIds(e,`is:starred`)).length,a=0;for(let e=0;e<r.length;e+=100){let n=r.slice(e,e+100);for(let e of await this.gmail.holeMetadaten(n))a+=e.sizeEstimate??0;for(let i=0;i<n.length;i++)await this.gmail.trash(n[i]),this.cache.delete(n[i]),((e+i)%10==9||e+i===r.length-1)&&t(e+i+1,r.length)}return this.platz(a),this.gmail.labelLoeschen&&await this.gmail.labelLoeschen(e),{name:n,papierkorb:r,stern:i,bytes:a}}async ordnerWiederherstellen(e,t){let n;try{n=await this.gmail.labelAnlegen(e)}catch{n=(await this.gmail.labels()).find(t=>t.name===e)?.id??``}let r=0;for(let e of t)try{await this.gmail.untrash(e),n&&await this.gmail.modify(e,[n],[]),r++}catch{}return r}async ordnerAnlegen(e){let t=e.trim().replace(/[\\]/g,` `);if(!t)throw Error(`Name fehlt.`);return this.gmail.labelAnlegen(t)}},b={wichtig:`Wichtig`,persoenlich:`Persönlich`,werbung:`Werbung`,newsletter:`Newsletter`,benachrichtigung:`Benachrichtigung`,spam:`Spam`,phishing:`Phishing`},x=`Tiry's Mails · Stand vom Aufräumer (bitte nicht löschen)`,S=`----- TIRYS-MAILS-STAND -----`,C=`----- ENDE -----`,w=e=>e===`spam`||e===`phishing`?`muell`:e;function T(e){if(e.status===`zu_pruefen`)return{ziel:`pruefen`};if(e.status===`geschuetzt`)return{ziel:`geschuetzt`};if(e.aktionen.includes(`papierkorb`))return{ziel:`papierkorb`};let t=/Ordner „([^“]+)“/.exec(e.begruendung)?.[1];return t?{ziel:`ordner`,ordner:t}:e.aktionen.includes(`archivieren`)?{ziel:`archiv`}:{ziel:`bleibt`}}function E(e,t){let n=JSON.stringify(e),r=`Diesen Entwurf schreibt dein PC-Programm Tiry's Mails – die Handy-App liest daraus die Aufräum-Übersicht.\nBitte nicht löschen und nicht absenden (er wird von selbst aktuell gehalten).\n\n${S}\n${btoa(String.fromCharCode(...new TextEncoder().encode(n))).replace(/.{76}/g,`$&
`)}\n${C}\n`;return[`To: ${t}`,`Subject: =?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(x)))}?=`,`MIME-Version: 1.0`,`Content-Type: text/plain; charset=UTF-8`,`Content-Transfer-Encoding: 8bit`,``,r].join(`\r
`)}function D(e){let t=e.indexOf(S),n=e.indexOf(C);if(t<0||n<t)return null;try{let r=atob(e.slice(t+29,n).replace(/\s+/g,``)),i=JSON.parse(new TextDecoder().decode(Uint8Array.from(r,e=>e.charCodeAt(0))));return i?.v===1?i:null}catch{return null}}export{T as a,E as i,w as n,b as o,D as r,y as s,x as t};
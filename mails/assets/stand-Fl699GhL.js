import{a as e,l as t,o as n}from"./gmail-BTpxwc17.js";function r(e){let t=(e??``).trim(),n=``,r=``,i=t.match(/^(.*)<([^>]+)>\s*$/);i?(n=i[1].trim().replace(/^"(.*)"$/,`$1`).replace(/\\"/g,`"`).trim(),r=i[2].trim()):r=t.replace(/^"|"$/g,``),r=r.toLowerCase();let o=r.includes(`@`)?r.split(`@`).pop().trim():``;return{name:a(n),adresse:r,domain:o}}function i(e){if(!e)return[];let t=[],n=``,i=!1,a=!1;for(let r of e)r===`"`&&(i=!i),r===`<`&&(a=!0),r===`>`&&(a=!1),r===`,`&&!i&&!a?(t.push(n),n=``):n+=r;return n.trim()&&t.push(n),t.map(r).filter(e=>e.adresse.includes(`@`))}function a(e){let t=e=>Uint8Array.from(e,e=>e.charCodeAt(0)&255),n=(e,t)=>{try{return new TextDecoder(t).decode(e)}catch{return new TextDecoder(`utf-8`).decode(e)}};return e.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,(e,r,i,a)=>{try{return i.toUpperCase()===`B`?n(t(atob(a)),r):n(t(a.replace(/_/g,` `).replace(/=([0-9A-F]{2})/gi,(e,t)=>String.fromCharCode(parseInt(t,16)))),r)}catch{return a}})}function o(e,t){if(!e)return null;let n=[...e.matchAll(/<([^>]+)>/g)].map(e=>e[1].trim()),r=n.filter(e=>/^https:\/\//i.test(e)),i=n.filter(e=>/^mailto:/i.test(e));return!r.length&&!i.length?null:{http:r,mailto:i,oneClick:!!t&&/List-Unsubscribe=One-Click/i.test(t)&&r.length>0}}function s(e){let t={spf:null,dkim:null,dmarc:null};if(!e)return t;for(let n of[`spf`,`dkim`,`dmarc`]){let r=e.match(RegExp(`\\b${n}=([a-z]+)`,`i`));r&&(t[n]=r[1].toLowerCase())}return t}function c(e){let t=e.toLowerCase().split(`.`).filter(Boolean);if(t.length<=2)return t.join(`.`);let n=[`co.uk`,`com.au`,`co.at`,`or.at`,`gv.at`,`com.br`,`co.jp`],r=t.slice(-2).join(`.`);return n.includes(r)?t.slice(-3).join(`.`):r}var l=e=>e.replace(/[&<>"]/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`})[e]),u=[`#5fd38a`,`#4fc3b8`,`#f6c945`,`#f59a3c`,`#ec5a3f`],d=`#1d1a17`,f=`#2a2724`,p=`#6f6a64`,m=`#f4f1ea`,h=`-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;function g(e){return e.replace(/\r/g,``).split(/\n{2,}/).map(e=>e.replace(/\s+$/,``)).filter(e=>e.trim()).map(e=>{let t=e.split(`
`).every(e=>e.startsWith(`>`)),n=l(t?e.split(`
`).map(e=>e.replace(/^>\s?/,``)).join(`
`):e).replace(/(https?:\/\/[^\s<]+)/g,`<a href="$1" style="color:${u[4]};text-decoration:underline">$1</a>`).replace(/\n/g,`<br>`);return t&&(n=`<!--zitat-->${n}`),n})}function _(e){return e>1048576?`${(e/1048576).toFixed(1).replace(`.`,`,`)} MB`:`${Math.max(1,Math.round(e/1024))} KB`}function v(e){return`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>${u.map(t=>`<td width="20%" height="${e}" bgcolor="${t}" style="background:${t};height:${e}px;line-height:${e}px;font-size:1px;mso-line-height-rule:exactly">&nbsp;</td>`).join(``)}</tr></table>`}function y(e,t,n){return`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr>
    <td bgcolor="${n}" style="background:${n};border-radius:10px;mso-padding-alt:10px 18px">
      <a href="${l(t)}" target="_blank" style="display:inline-block;padding:10px 18px;font:700 14px/1.2 ${h};color:${d};text-decoration:none;border-radius:10px">${l(e)}</a>
    </td></tr></table>`}function b(e){let t=g(e.text),n=l(e.text.replace(/\s+/g,` `).slice(0,140)),r=t.map((e,t)=>e.startsWith(`<!--zitat-->`)?`<tr><td style="padding:4px 0 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="4" bgcolor="#d8d2c8" style="background:#d8d2c8;width:4px;font-size:1px">&nbsp;</td>
        <td style="padding:2px 0 2px 14px;font:14px/1.55 ${h};color:${p}">${e.slice(12)}</td></tr></table></td></tr>`:`<tr><td class="tm-p" style="padding:0 0 18px;font:${t===0?`600 19px/1.45`:`400 16px/1.65`} ${h};color:${t===0?d:f}">${e}</td></tr>`).join(``),i=(e.links??[]).filter(e=>e.link&&e.link!==`#`),a=(e.links??[]).filter(e=>!e.link||e.link===`#`),o=[...i.map((e,t)=>({name:e.name,info:`${_(e.groesse)} · zum Herunterladen`,href:e.link,farbe:u[(t+1)%5]})),...a.map((e,t)=>({name:e.name,info:`${_(e.groesse)} · zum Herunterladen`,href:``,farbe:u[(t+1)%5]})),...(e.anhaenge??[]).filter(t=>!(e.links??[]).some(e=>e.name===t.name)).map((e,t)=>({name:e.name,info:`${_(e.groesse)} · im Anhang`,href:``,farbe:u[(t+3)%5]}))],s=o.length?`
    <tr><td style="padding:8px 0 6px;font:700 12px/1 ${h};letter-spacing:1.2px;text-transform:uppercase;color:${p}">${o.length===1?`Datei`:`Dateien`}</td></tr>
    ${o.map(e=>`<tr><td style="padding:0 0 10px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:${m};border-radius:12px" bgcolor="${m}"><tr>
        <td width="6" bgcolor="${e.farbe}" style="background:${e.farbe};width:6px;border-radius:12px 0 0 12px;font-size:1px">&nbsp;</td>
        <td style="padding:14px 16px">
          <div style="font:700 15px/1.3 ${h};color:${d};word-break:break-word">${l(e.name)}</div>
          <div style="font:13px/1.4 ${h};color:${p};padding-top:2px">${l(e.info)}</div>
          ${e.href?`<div style="padding-top:12px">${y(`Herunterladen`,e.href,e.farbe)}</div>`:``}
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
<title>${l(e.betreff)}</title>
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
  <tr><td>${v(8)}</td></tr>
  <tr><td class="tm-kopf" bgcolor="${d}" style="background:${d};padding:34px 40px 30px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font:700 12px/1 ${h};letter-spacing:1.6px;text-transform:uppercase;color:${u[2]}">Nachricht von ${l(e.vonName)}</td>
      <td rowspan="3" width="64" align="right" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${u.map((e,t)=>`<td width="9" valign="bottom" style="padding-left:3px"><div style="width:9px;height:${[46,30,40,20,34][t]}px;background:${e};border-radius:5px;font-size:1px;line-height:1px">&nbsp;</div></td>`).join(``)}</tr></table>
      </td>
    </tr><tr>
      <td class="tm-titel" style="padding-top:12px;font:800 28px/1.18 ${h};color:#ffffff;letter-spacing:-0.3px">${l(e.betreff||`Neue Nachricht`)}</td>
    </tr><tr>
      <td style="padding-top:18px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${u.map((e,t)=>`<td width="${[44,28,36,18,30][t]}" height="4" bgcolor="${e}" style="background:${e};height:4px;font-size:1px;line-height:4px">&nbsp;</td><td width="6" style="font-size:1px">&nbsp;</td>`).join(``)}</tr></table>
      </td>
    </tr></table>
  </td></tr>
  <tr><td class="tm-innen" style="padding:36px 40px 12px;background:#ffffff" bgcolor="#ffffff">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${r}
      ${s}
    </table>
  </td></tr>
  <tr><td class="tm-innen" style="padding:8px 40px 34px;background:#ffffff" bgcolor="#ffffff">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="36" valign="middle">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${u.map((e,t)=>`<td width="4" valign="bottom" style="padding-right:2px"><div style="width:4px;height:${[18,12,16,8,14][t]}px;background:${e};border-radius:2px;font-size:1px;line-height:1px">&nbsp;</div></td>`).join(``)}</tr></table>
      </td>
      <td valign="middle" class="tm-fuss" style="padding-left:10px;font:700 15px/1.3 ${h};color:${d}">${l(e.vonName)}</td>
    </tr></table>
  </td></tr>
  <tr><td>${v(4)}</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`}var x=[{id:`INBOX`,name:`Posteingang`,art:`system`},{id:`STARRED`,name:`Mit Stern`,art:`system`},{id:`SENT`,name:`Gesendet`,art:`system`},{id:`ALLE`,name:`Alle Mails`,art:`system`},{id:`SPAM`,name:`Spam`,art:`system`},{id:`TRASH`,name:`Papierkorb`,art:`system`}],S=class{gmail;kategorieVon;eigeneAdresse;cache=new Map;volle=new Map;laeuft=new Map;labelNamen=new Map;letzte=[];platz=()=>{};constructor(e,t,n){this.gmail=e,this.kategorieVon=t,this.eigeneAdresse=n}async ordner(){let e=await this.gmail.labels();this.labelNamen.clear();for(let t of e)this.labelNamen.set(t.id,t.name);let t=e.filter(e=>(e.id.startsWith(`Label_`)||!/^[A-Z_]+$/.test(e.id))&&e.name!==`Aufräumer`),n=t.filter(e=>e.name.startsWith(`Aufräumer/`)).map(e=>({id:e.id,name:e.name.slice(10),art:`sorte`})),r=t.filter(e=>!e.name.startsWith(`Aufräumer/`)).map(e=>({id:e.id,name:e.name,art:`firma`})),i=0;try{i=(await this.gmail.labelInfo(`INBOX`)).ungelesen}catch{}return[...x.map(e=>e.id===`INBOX`?{...e,ungelesen:i}:e),...r.sort((e,t)=>e.name.localeCompare(t.name,`de`)),...n.sort((e,t)=>e.name.localeCompare(t.name,`de`))]}zeile(e){let t=r(e.headers.from),n=this.kategorieVon(e.id,e.labelIds);return{id:e.id,threadId:e.threadId,von:t.name||t.adresse,vonAdresse:t.adresse,betreff:a(e.headers.subject??``),vorschau:e.snippet,datum:e.internalDate,ungelesen:e.labelIds.includes(`UNREAD`),stern:e.labelIds.includes(`STARRED`),anhang:/multipart\/mixed/i.test(e.headers[`content-type`]??``),kategorie:n,labelIds:e.labelIds}}async liste(e,t=``,n){let r=e===`ALLE`?null:e,i=await this.gmail.listeOrdner(r,t,n,50),a=Date.now(),o=i.ids.filter(e=>{let t=this.cache.get(e);return!t||a-t.zeit>12e4});if(o.length)for(let e of await this.gmail.holeMetadaten(o))this.cache.set(e.id,{mail:e,zeit:a});if(this.cache.size>3e3)for(let e of[...this.cache.keys()].slice(0,1e3))this.cache.delete(e);return{zeilen:i.ids.map(e=>this.cache.get(e)?.mail).filter(e=>!!e).map(e=>this.zeile(e)),weiter:i.nextPageToken,gesamt:i.geschaetzt}}holeVoll(e){let t=this.volle.get(e);if(t&&Date.now()-t.zeit<6e5)return Promise.resolve(t.roh);let n=this.laeuft.get(e);if(n)return n;let r=this.gmail.holeVoll(e).then(t=>{if(this.volle.set(e,{roh:t,zeit:Date.now()}),this.volle.size>150)for(let e of[...this.volle.keys()].slice(0,50))this.volle.delete(e);return t}).finally(()=>this.laeuft.delete(e));return this.laeuft.set(e,r),r}async vorladen(e){let t=e.filter(e=>!this.volle.has(e)).slice(0,12),n=0;await Promise.all(Array.from({length:Math.min(3,t.length)},async()=>{for(;n<t.length;){let e=t[n++];try{await this.holeVoll(e)}catch{}}}))}async lesen(e){let n=await this.holeVoll(e),i=t(n);if(i.labelIds.includes(`UNREAD`)){this.gmail.modify(e,[],[`UNREAD`]).catch(()=>{}),i.labelIds=i.labelIds.filter(e=>e!==`UNREAD`),n.labelIds=(n.labelIds??[]).filter(e=>e!==`UNREAD`);let t=this.cache.get(e);t&&(t.mail.labelIds=t.mail.labelIds.filter(e=>e!==`UNREAD`))}let o=r(i.headers.from),s=this.kategorieVon(e,i.labelIds),c=s===`phishing`?`Achtung: Diese Mail sieht nach Betrug aus. Klick keine Links an und gib keine Daten ein.`:s===`spam`?`Diese Mail ist wahrscheinlich Spam.`:null;return{...i,von:o.name||o.adresse,vonAdresse:o.adresse,an:i.headers.to??``,cc:i.headers.cc??``,betreff:a(i.headers.subject??``),kategorie:s,warnung:c}}async anhang(e,t){return this.gmail.anhang(e,t.anhangId)}async vorlage(e,t){let a=await this.lesen(e),o=this.eigeneAdresse().toLowerCase(),s=`\n\nAm ${new Date(a.datum).toLocaleString(`de-DE`)} schrieb ${a.von} <${a.vonAdresse}>:\n`+(a.text??(a.html??``).replace(/<style[\s\S]*?<\/style>/gi,``).replace(/<[^>]+>/g,` `).replace(/\s+\n/g,`
`)).split(`
`).map(e=>`> ${e}`).join(`
`),c=a.headers[`reply-to`]||a.headers.from||``,l=[],u=[];return t===`antworten`&&(l=[c]),t===`allen`&&(l=[c],u=[...i(a.an),...i(a.cc)].filter(e=>e.adresse!==o&&e.adresse!==r(c).adresse).map(e=>e.name?`${e.name} <${e.adresse}>`:e.adresse)),{an:l,cc:u,betreff:n(t===`weiter`?`Fwd`:`Re`,a.betreff),text:t===`weiter`?`\n\n---------- Weitergeleitete Nachricht ----------\nVon: ${a.von} <${a.vonAdresse}>\nDatum: ${new Date(a.datum).toLocaleString(`de-DE`)}\nBetreff: ${a.betreff}\n\n${a.text??``}`:s,threadId:t===`weiter`?void 0:a.threadId,inReplyTo:t===`weiter`?void 0:a.headers[`message-id`],references:t===`weiter`?void 0:[a.headers.references,a.headers[`message-id`]].filter(Boolean).join(` `)}}async senden(t){let n=t.an.flatMap(e=>e.split(/[,;]/)).map(e=>e.trim()).filter(Boolean);if(!n.length)throw Error(`Bitte mindestens einen Empfänger eintragen.`);for(let e of[...n,...t.cc??[],...t.bcc??[]])if(!/@[^@\s>]+\.[^@\s>]+/.test(e))throw Error(`„${e}“ ist keine gültige Adresse.`);let r=t.gestaltet===!1?void 0:b({betreff:t.betreff,text:t.text,vonName:t.vonName??`Tiry`,links:t.links,anhaenge:t.anhaenge?.map(e=>({name:e.name,groesse:e.daten.length}))}),i=e({von:this.eigeneAdresse(),an:n,cc:t.cc,bcc:t.bcc,betreff:t.betreff,text:t.text,inReplyTo:t.inReplyTo,references:t.references,anhaenge:t.anhaenge,html:r});await this.gmail.sendeMail(i,t.threadId)}async aktion(e,t){let n=e.map(e=>this.cache.get(e)?.mail).filter(e=>!!e),r=e.filter(e=>!this.cache.has(e)),i=[...n.map(e=>structuredClone(e)),...r.length?await this.gmail.holeMetadaten(r):[]];this.letzte=i.map(e=>({id:e.id,vorher:[...e.labelIds],groesse:e.sizeEstimate??0})),t===`papierkorb`&&this.platz(i.filter(e=>!e.labelIds.includes(`TRASH`)).reduce((e,t)=>e+(t.sizeEstimate??0),0)),await Promise.all(i.map(async e=>{t===`papierkorb`?await this.gmail.trash(e.id):t===`archiv`?await this.gmail.modify(e.id,[],[`INBOX`]):t===`posteingang`?(e.labelIds.includes(`TRASH`)&&await this.gmail.untrash(e.id),await this.gmail.modify(e.id,[`INBOX`],[`SPAM`])):t===`stern`?await this.gmail.modify(e.id,[`STARRED`],[]):t===`sternWeg`?await this.gmail.modify(e.id,[],[`STARRED`]):t===`gelesen`?await this.gmail.modify(e.id,[],[`UNREAD`]):t===`ungelesen`?await this.gmail.modify(e.id,[`UNREAD`],[]):await this.gmail.modify(e.id,[t.ordner],[`INBOX`]),this.cache.delete(e.id),this.volle.delete(e.id)}))}async rueckgaengig(){let e=0;for(let{id:t,vorher:n,groesse:r}of this.letzte){let[i]=await this.gmail.holeMetadaten([t]);if(!i)continue;i.labelIds.includes(`TRASH`)&&!n.includes(`TRASH`)&&(await this.gmail.untrash(t),this.platz(-(r??0)),[i]=await this.gmail.holeMetadaten([t]));let a=n.filter(e=>!i.labelIds.includes(e)&&e!==`TRASH`),o=i.labelIds.filter(e=>!n.includes(e)&&e!==`TRASH`);(a.length||o.length)&&await this.gmail.modify(t,a,o),this.cache.delete(t),e++}return this.letzte=[],e}async ordnerInhalt(e){this.labelNamen.size||await this.ordner();let t=this.labelNamen.get(e)??e,n=(await this.alleIds(e,`is:starred`)).length;return{name:t,gesamt:(await this.gmail.labelInfo(e)).gesamt,stern:n}}async alleIds(e,t=``){let n=[],r;do{let i=await this.gmail.listeOrdner(e,t,r,500);n.push(...i.ids),r=i.nextPageToken}while(r);return[...new Set(n)]}async ordnerLoeschen(e,t=()=>{}){if(/^[A-Z_]+$/.test(e))throw Error(`System-Ordner (Posteingang, Gesendet …) kann man nicht löschen.`);this.labelNamen.size||await this.ordner();let n=this.labelNamen.get(e)??e,r=await this.alleIds(e,`-is:starred`),i=(await this.alleIds(e,`is:starred`)).length,a=0;for(let e=0;e<r.length;e+=100){let n=r.slice(e,e+100);for(let e of await this.gmail.holeMetadaten(n))a+=e.sizeEstimate??0;for(let i=0;i<n.length;i++)await this.gmail.trash(n[i]),this.cache.delete(n[i]),((e+i)%10==9||e+i===r.length-1)&&t(e+i+1,r.length)}return this.platz(a),this.gmail.labelLoeschen&&await this.gmail.labelLoeschen(e),{name:n,papierkorb:r,stern:i,bytes:a}}async ordnerWiederherstellen(e,t){let n;try{n=await this.gmail.labelAnlegen(e)}catch{n=(await this.gmail.labels()).find(t=>t.name===e)?.id??``}let r=0;for(let e of t)try{await this.gmail.untrash(e),n&&await this.gmail.modify(e,[n],[]),r++}catch{}return r}async ordnerAnlegen(e){let t=e.trim().replace(/[\\]/g,` `);if(!t)throw Error(`Name fehlt.`);return this.gmail.labelAnlegen(t)}},C={wichtig:`Wichtig`,persoenlich:`Persönlich`,werbung:`Werbung`,newsletter:`Newsletter`,benachrichtigung:`Benachrichtigung`,spam:`Spam`,phishing:`Phishing`},w=`Tiry's Mails · Stand vom Aufräumer (bitte nicht löschen)`,T=`----- TIRYS-MAILS-STAND -----`,E=`----- ENDE -----`,D=e=>e===`spam`||e===`phishing`?`muell`:e;function O(e){if(e.status===`zu_pruefen`)return{ziel:`pruefen`};if(e.status===`geschuetzt`)return{ziel:`geschuetzt`};if(e.aktionen.includes(`papierkorb`))return{ziel:`papierkorb`};let t=/Ordner „([^“]+)“/.exec(e.begruendung)?.[1];return t?{ziel:`ordner`,ordner:t}:e.aktionen.includes(`archivieren`)?{ziel:`archiv`}:{ziel:`bleibt`}}function k(e,t){let n=JSON.stringify(e),r=`Diesen Entwurf schreibt dein PC-Programm Tiry's Mails – die Handy-App liest daraus die Aufräum-Übersicht.\nBitte nicht löschen und nicht absenden (er wird von selbst aktuell gehalten).\n\n${T}\n${btoa(String.fromCharCode(...new TextEncoder().encode(n))).replace(/.{76}/g,`$&
`)}\n${E}\n`;return[`To: ${t}`,`Subject: =?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(w)))}?=`,`MIME-Version: 1.0`,`Content-Type: text/plain; charset=UTF-8`,`Content-Transfer-Encoding: 8bit`,``,r].join(`\r
`)}export{S as a,r as c,C as i,s as l,k as n,c as o,O as r,i as s,D as t,o as u};
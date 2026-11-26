// Mail-Vorlage „Spektrum“: aus Tirys Text wird eine gestaltete HTML-Mail.
// Gebaut für alle Mailprogramme (Gmail Web/App, Apple Mail/iOS, Outlook Windows/Mac/Web, Android, Thunderbird):
//  - nur Tabellen-Layout mit Inline-Styles (Outlook rendert mit Word), feste 600 px Breite, fluid auf dem Handy
//  - Farbverlauf als echte Tabellenzellen (CSS-Verläufe fehlen in Outlook) – nichts geht verloren, wenn CSS gestrichen wird
//  - keine externen Bilder (werden oft blockiert), Systemschriften, Hell/Dunkel-Modus bedacht
//  - kleiner als 102 KB, damit Gmail die Mail nicht abschneidet

export interface VorlageDaten {
  betreff: string;
  text: string;
  vonName: string;
  links?: Array<{ name: string; groesse: number; link: string }>;
  anhaenge?: Array<{ name: string; groesse: number }>;
}

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Sortenfarben als feste Hex-Werte (Mailprogramme kennen kein oklch)
const SPEKTRUM = ['#5fd38a', '#4fc3b8', '#f6c945', '#f59a3c', '#ec5a3f'];
const TINTE = '#1d1a17';
const TEXT = '#2a2724';
const GRAU = '#6f6a64';
const PAPIER = '#f4f1ea';
const SCHRIFT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Text → Absätze, Links klickbar, „> “-Zitate als Zitat-Block. */
export function absaetze(text: string): string[] {
  return text.replace(/\r/g, '').split(/\n{2,}/).map((a) => a.replace(/\s+$/, '')).filter((a) => a.trim()).map((a) => {
    const zitat = a.split('\n').every((z) => z.startsWith('>'));
    let inhalt = esc(zitat ? a.split('\n').map((z) => z.replace(/^>\s?/, '')).join('\n') : a)
      .replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:${SPEKTRUM[4]};text-decoration:underline">$1</a>`)
      .replace(/\n/g, '<br>');
    if (zitat) inhalt = `<!--zitat-->${inhalt}`;
    return inhalt;
  });
}

function groesse(n: number) { return n > 1_048_576 ? `${(n / 1_048_576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`; }

/** Die 5-farbige Spektrum-Leiste – echte Zellen, funktioniert überall. */
function spektrumLeiste(hoehe: number) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>${SPEKTRUM.map((f) =>
    `<td width="20%" height="${hoehe}" bgcolor="${f}" style="background:${f};height:${hoehe}px;line-height:${hoehe}px;font-size:1px;mso-line-height-rule:exactly">&nbsp;</td>`).join('')}</tr></table>`;
}

/** Knopf, der in Outlook und überall klickbar ist (Zelle mit Hintergrund + Link). */
function knopf(text: string, href: string, farbe: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr>
    <td bgcolor="${farbe}" style="background:${farbe};border-radius:10px;mso-padding-alt:10px 18px">
      <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:10px 18px;font:700 14px/1.2 ${SCHRIFT};color:${TINTE};text-decoration:none;border-radius:10px">${esc(text)}</a>
    </td></tr></table>`;
}

export function vorlageHtml(d: VorlageDaten): string {
  const teile = absaetze(d.text);
  const vorschauText = esc(d.text.replace(/\s+/g, ' ').slice(0, 140));
  const koerper = teile.map((p, i) => p.startsWith('<!--zitat-->')
    ? `<tr><td style="padding:4px 0 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="4" bgcolor="#d8d2c8" style="background:#d8d2c8;width:4px;font-size:1px">&nbsp;</td>
        <td style="padding:2px 0 2px 14px;font:14px/1.55 ${SCHRIFT};color:${GRAU}">${p.slice(12)}</td></tr></table></td></tr>`
    : `<tr><td class="tm-p" style="padding:0 0 18px;font:${i === 0 ? '600 19px/1.45' : '400 16px/1.65'} ${SCHRIFT};color:${i === 0 ? TINTE : TEXT}">${p}</td></tr>`).join('');

  const links = (d.links ?? []).filter((l) => l.link && l.link !== '#');
  const linkVorschau = (d.links ?? []).filter((l) => !l.link || l.link === '#');
  const dateien = [
    ...links.map((l, i) => ({ name: l.name, info: `${groesse(l.groesse)} · zum Herunterladen`, href: l.link, farbe: SPEKTRUM[(i + 1) % 5] })),
    ...linkVorschau.map((l, i) => ({ name: l.name, info: `${groesse(l.groesse)} · zum Herunterladen`, href: '', farbe: SPEKTRUM[(i + 1) % 5] })),
    ...(d.anhaenge ?? []).filter((a) => !(d.links ?? []).some((l) => l.name === a.name)).map((a, i) => ({ name: a.name, info: `${groesse(a.groesse)} · im Anhang`, href: '', farbe: SPEKTRUM[(i + 3) % 5] })),
  ];
  const dateiBlock = dateien.length ? `
    <tr><td style="padding:8px 0 6px;font:700 12px/1 ${SCHRIFT};letter-spacing:1.2px;text-transform:uppercase;color:${GRAU}">${dateien.length === 1 ? 'Datei' : 'Dateien'}</td></tr>
    ${dateien.map((f) => `<tr><td style="padding:0 0 10px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:${PAPIER};border-radius:12px" bgcolor="${PAPIER}"><tr>
        <td width="6" bgcolor="${f.farbe}" style="background:${f.farbe};width:6px;border-radius:12px 0 0 12px;font-size:1px">&nbsp;</td>
        <td style="padding:14px 16px">
          <div style="font:700 15px/1.3 ${SCHRIFT};color:${TINTE};word-break:break-word">${esc(f.name)}</div>
          <div style="font:13px/1.4 ${SCHRIFT};color:${GRAU};padding-top:2px">${esc(f.info)}</div>
          ${f.href ? `<div style="padding-top:12px">${knopf('Herunterladen', f.href, f.farbe)}</div>` : ''}
        </td>
      </tr></table></td></tr>`).join('')}` : '';

  return `<!doctype html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(d.betreff)}</title>
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
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${vorschauText}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#efebe3" class="tm-hg" style="background:#efebe3">
<tr><td align="center" class="tm-aussen" style="padding:32px 12px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tm-karte" style="max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden" bgcolor="#ffffff">
  <tr><td>${spektrumLeiste(8)}</td></tr>
  <tr><td class="tm-kopf" bgcolor="${TINTE}" style="background:${TINTE};padding:34px 40px 30px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font:700 12px/1 ${SCHRIFT};letter-spacing:1.6px;text-transform:uppercase;color:${SPEKTRUM[2]}">Nachricht von ${esc(d.vonName)}</td>
      <td rowspan="3" width="64" align="right" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${SPEKTRUM.map((f, i) =>
          `<td width="9" valign="bottom" style="padding-left:3px"><div style="width:9px;height:${[46, 30, 40, 20, 34][i]}px;background:${f};border-radius:5px;font-size:1px;line-height:1px">&nbsp;</div></td>`).join('')}</tr></table>
      </td>
    </tr><tr>
      <td class="tm-titel" style="padding-top:12px;font:800 28px/1.18 ${SCHRIFT};color:#ffffff;letter-spacing:-0.3px">${esc(d.betreff || 'Neue Nachricht')}</td>
    </tr><tr>
      <td style="padding-top:18px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${SPEKTRUM.map((f, i) =>
          `<td width="${[44, 28, 36, 18, 30][i]}" height="4" bgcolor="${f}" style="background:${f};height:4px;font-size:1px;line-height:4px">&nbsp;</td><td width="6" style="font-size:1px">&nbsp;</td>`).join('')}</tr></table>
      </td>
    </tr></table>
  </td></tr>
  <tr><td class="tm-innen" style="padding:36px 40px 12px;background:#ffffff" bgcolor="#ffffff">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${koerper}
      ${dateiBlock}
    </table>
  </td></tr>
  <tr><td class="tm-innen" style="padding:8px 40px 34px;background:#ffffff" bgcolor="#ffffff">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="36" valign="middle">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${SPEKTRUM.map((f, i) =>
          `<td width="4" valign="bottom" style="padding-right:2px"><div style="width:4px;height:${[18, 12, 16, 8, 14][i]}px;background:${f};border-radius:2px;font-size:1px;line-height:1px">&nbsp;</div></td>`).join('')}</tr></table>
      </td>
      <td valign="middle" class="tm-fuss" style="padding-left:10px;font:700 15px/1.3 ${SCHRIFT};color:${TINTE}">${esc(d.vonName)}</td>
    </tr></table>
  </td></tr>
  <tr><td>${spektrumLeiste(4)}</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

// Mail-Vorlage: aus Tirys Text wird eine gestaltete HTML-Mail.
// (Erste, schlichte Fassung – die ausgearbeitete Vorlage kommt zum Schluss.)

export interface VorlageDaten {
  betreff: string;
  text: string;
  vonName: string;
  links?: Array<{ name: string; groesse: number; link: string }>;
  anhaenge?: Array<{ name: string; groesse: number }>;
}

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Text → Absätze, Links klickbar. Zitate (> …) bleiben als Zitat erkennbar. */
export function absaetze(text: string): string[] {
  return text.replace(/\r/g, '').split(/\n{2,}/).map((a) => a.trim()).filter(Boolean)
    .map((a) => esc(a).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>'));
}

export function vorlageHtml(d: VorlageDaten): string {
  const teile = absaetze(d.text).map((p) => `<p style="margin:0 0 16px;font:16px/1.6 Arial,Helvetica,sans-serif;color:#1d1f23">${p}</p>`).join('');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.betreff)}</title></head>
<body style="margin:0;padding:0;background:#f2efe8"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2efe8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px"><tr><td style="padding:32px">${teile}</td></tr></table>
</td></tr></table></body></html>`;
}

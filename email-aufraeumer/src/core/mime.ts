// Mails zerlegen (Gmail „full“-Format) und neue Mails als RFC-822 bauen.

export interface Anhang { name: string; mime: string; groesse: number; anhangId: string; cid: string | null; inline: boolean }
export interface VolleMail {
  id: string; threadId: string; labelIds: string[]; datum: number;
  headers: Record<string, string>;
  html: string | null; text: string | null; anhaenge: Anhang[];
}

export function base64urlZuBytes(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
}

function zeichensatz(contentType: string | undefined): string {
  const m = /charset="?([^";\s]+)"?/i.exec(contentType ?? '');
  return (m?.[1] ?? 'utf-8').toLowerCase();
}

export function dekodiere(bytes: Uint8Array, charset: string): string {
  try { return new TextDecoder(charset).decode(bytes); } catch { return new TextDecoder('utf-8').decode(bytes); }
}

function kopf(part: any): Record<string, string> {
  const h: Record<string, string> = {};
  for (const x of part?.headers ?? []) { const k = String(x.name).toLowerCase(); if (h[k] === undefined) h[k] = String(x.value ?? ''); }
  return h;
}

/** Zerlegt die Antwort von messages.get(format: 'full'). */
export function zerlegeVoll(m: any): VolleMail {
  const out: VolleMail = { id: m.id, threadId: m.threadId, labelIds: m.labelIds ?? [], datum: Number(m.internalDate ?? 0), headers: kopf(m.payload), html: null, text: null, anhaenge: [] };
  const lauf = (p: any) => {
    if (!p) return;
    const h = kopf(p);
    const typ = String(p.mimeType ?? '').toLowerCase();
    const dispo = (h['content-disposition'] ?? '').toLowerCase();
    if (p.filename || p.body?.attachmentId) {
      if (p.body?.attachmentId || p.body?.data) {
        out.anhaenge.push({
          name: p.filename || 'anhang', mime: typ || 'application/octet-stream', groesse: Number(p.body?.size ?? 0),
          anhangId: p.body?.attachmentId ?? '', cid: (h['content-id'] ?? '').replace(/[<>]/g, '') || null, inline: dispo.startsWith('inline') || !!h['content-id'],
        });
      }
      return;
    }
    if (typ === 'text/html' && p.body?.data && out.html === null) out.html = dekodiere(base64urlZuBytes(p.body.data), zeichensatz(h['content-type']));
    else if (typ === 'text/plain' && p.body?.data && out.text === null) out.text = dekodiere(base64urlZuBytes(p.body.data), zeichensatz(h['content-type']));
    for (const k of p.parts ?? []) lauf(k);
  };
  lauf(m.payload);
  return out;
}

/** Text → einfaches, sicheres HTML (Links klickbar, Zeilenumbrüche erhalten). */
export function textZuHtml(t: string): string {
  const esc = t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  return `<div style="white-space:pre-wrap;font:15px/1.5 system-ui,sans-serif">${esc.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</div>`;
}

function wort(s: string): string {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}
function adressen(liste: string[]): string {
  return liste.map((a) => a.trim()).filter(Boolean).map((a) => {
    const m = /^(.*)<([^>]+)>$/.exec(a);
    return m ? `${wort(m[1].trim().replace(/^"|"$/g, ''))} <${m[2].trim()}>` : a;
  }).join(', ');
}
function kopfZeileSauber(s: string): string { return s.replace(/[\r\n]+/g, ' '); }

export interface Entwurf {
  von: string; an: string[]; cc?: string[]; bcc?: string[]; betreff: string; text: string;
  inReplyTo?: string; references?: string; threadId?: string;
  anhaenge?: Array<{ name: string; mime: string; daten: Uint8Array }>;
}

/** Baut eine RFC-822-Nachricht (UTF-8, base64), optional mit Anhängen. */
export function baueMail(e: Entwurf): string {
  const zeilen = [
    `From: ${kopfZeileSauber(e.von)}`,
    `To: ${kopfZeileSauber(adressen(e.an))}`,
    ...(e.cc?.length ? [`Cc: ${kopfZeileSauber(adressen(e.cc))}`] : []),
    ...(e.bcc?.length ? [`Bcc: ${kopfZeileSauber(adressen(e.bcc))}`] : []),
    `Subject: ${wort(kopfZeileSauber(e.betreff))}`,
    ...(e.inReplyTo ? [`In-Reply-To: ${kopfZeileSauber(e.inReplyTo)}`] : []),
    ...(e.references ? [`References: ${kopfZeileSauber(e.references)}`] : []),
    'MIME-Version: 1.0',
  ];
  const text64 = Buffer.from(e.text.replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');
  if (!e.anhaenge?.length) {
    return [...zeilen, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', text64].join('\r\n');
  }
  const grenze = `tm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const teile = [
    `--${grenze}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', text64,
    ...e.anhaenge.flatMap((a) => [
      `--${grenze}`, `Content-Type: ${a.mime || 'application/octet-stream'}; name="${wort(a.name).replace(/"/g, '')}"`,
      `Content-Disposition: attachment; filename="${wort(a.name).replace(/"/g, '')}"`, 'Content-Transfer-Encoding: base64', '',
      Buffer.from(a.daten).toString('base64').replace(/.{76}/g, '$&\r\n'),
    ]),
    `--${grenze}--`,
  ];
  return [...zeilen, `Content-Type: multipart/mixed; boundary="${grenze}"`, '', ...teile].join('\r\n');
}

/** „Re: “ / „Fwd: “ nur einmal voranstellen. */
export function betreffMit(praefix: 'Re' | 'Fwd', betreff: string): string {
  const re = praefix === 'Re' ? /^(re|aw|antw)\s*:/i : /^(fwd?|wg|weitergeleitet)\s*:/i;
  return re.test(betreff.trim()) ? betreff : `${praefix}: ${betreff}`;
}

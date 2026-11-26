import { describe, it, expect } from 'vitest';
import { vorlageHtml } from '../src/core/vorlage';

describe('Mail-Vorlage für alle Mailprogramme', () => {
  const html = vorlageHtml({ betreff: 'Grüße <aus> Wörth', text: 'Hallo Mama,\n\nich komme am Sonntag. https://example.com\n\n> alte Mail\n> Zeile 2', vonName: 'Tiry',
    links: [{ name: 'Video.mp4', groesse: 300_000_000, link: 'https://drive.google.com/file/d/x/view' }], anhaenge: [{ name: 'Rechnung.pdf', groesse: 120_000 }] });
  it('nur Tabellen-Layout, keine Techniken, die Outlook/Gmail zerlegen', () => {
    expect(html).not.toMatch(/display:\s*(flex|grid)/i);
    expect(html).not.toMatch(/position:\s*(absolute|fixed)/i);
    expect(html).not.toMatch(/linear-gradient|<script|<img|url\(/i);
    expect(html).toMatch(/<!--\[if mso\]>/);
    expect(html).toMatch(/role="presentation"/);
  });
  it('unter 102 KB (sonst kürzt Gmail)', () => expect(Buffer.byteLength(html)).toBeLessThan(102_000));
  it('Inhalt sicher maskiert, Links, Zitat, Dateien', () => {
    expect(html).toContain('Grüße &lt;aus&gt; Wörth');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('alte Mail<br>Zeile 2');
    expect(html).toContain('Video.mp4');
    expect(html).toContain('286,1 MB · zum Herunterladen');
    expect(html).toContain('Rechnung.pdf');
    expect(html).toContain('im Anhang');
  });
});

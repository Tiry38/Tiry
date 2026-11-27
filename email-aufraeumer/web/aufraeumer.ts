// Aufräumer-Seite der Handy-App: dieselbe Oberfläche wie am PC (src/renderer/app.ts), angetrieben vom Handy-Kern.
import * as an from './anmeldung';
import { erzeugeWebGmail } from './gmailWeb';
import { handyKern } from './aufrKern';
import type { GmailPort } from '../src/core/gmail';

const DEMO = new URLSearchParams(location.search).has('demo');
let gmail: GmailPort;
if (DEMO) {
  const { erzeugeDemo } = await import('../src/main/demo');
  const d = erzeugeDemo(); gmail = d.gmail;
  for (let i = 0; i < 24; i++) d.tropfen();
  setInterval(() => d.tropfen(), 6000);
} else {
  if (!an.token()) { location.replace('./'); throw new Error('nicht angemeldet'); }
  gmail = erzeugeWebGmail(an.token);
}
const kern = await handyKern(gmail);
(window as any).aufraeumer = { rufe: kern.rufe, auf: kern.auf };

// „Postfach“ führt zurück zur Mail-Ansicht der Handy-App (die hat Wischen, Lesen, Schreiben)
document.addEventListener('click', (e) => {
  const b = (e.target as Element).closest?.('[data-ziel="postfach"], [data-gehe="postfach"]');
  if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation();
  void kern.sichern().then(() => location.assign(`./${DEMO ? '?demo' : ''}`));
}, true);
addEventListener('pagehide', () => void kern.sichern());

await import('../src/renderer/app');

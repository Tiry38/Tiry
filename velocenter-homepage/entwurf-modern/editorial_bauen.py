#!/usr/bin/env python3
"""Baut die Vorlage „Editorial“: editorial.html + .css + .js → vorlage-editorial.html (eine Datei, relative img/ fonts/)."""
import json,os,sys
D=os.path.dirname(os.path.abspath(__file__))
AR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
STAR='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>'
CHK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
WINTER=f'''<section class="wn"><div class="wn-in g">
  <div>
    <span class="eyebrow">Winter-Inspektion 2026/27</span>
    <p class="big20">–20<sup>€</sup></p>
    <h3>auf jede Inspektion.</h3>
    <div class="pills"><span class="pill">Gültig nur für Marken-Fahrräder mit Bosch-Antrieb</span></div>
    <div class="pills"><span class="pill">{CHK}Checkliste</span><span class="pill">{CHK}Bosch Servicebericht</span></div>
    <p class="cond">Gültig vom 01.11.2026 bis 28.02.2027, nur solange Termine verfügbar sind. Jetzt ist die Werkstatt entspannt, im Frühling ist dein Rad startklar.</p>
    <div class="cd" aria-label="Noch bis 28.02.2027"><div><b>00</b><small>Tage</small></div><div><b>00</b><small>Std</small></div><div><b>00</b><small>Min</small></div><div><b>00</b><small>Sek</small></div></div>
    <div class="ctas"><a class="btn btn-white" href="#service" data-scroll="termin"><span class="roll"><span data-t="Winter-Termin sichern">Winter-Termin sichern</span></span><span class="ar">{AR}</span></a></div>
  </div>
  <div class="gift"><img src="img/sattelueberzug-560.webp" alt="Sattelüberzug mit Velocenter-Logo" width="560" height="560" loading="lazy" decoding="async"><small>Geschenkt dazu</small><b>Sattelüberzug mit Velocenter-Logo</b></div>
</div></section>'''
VISIT=f'''<section class="vs g">
  <div class="vs-img"><img src="img/laden-eingang-960.webp" alt="Eingang des Velocenter Hessert in der Hartmannstraße" width="960" height="541" loading="lazy" decoding="async"></div>
  <div>
    <span class="eyebrow vs-st">Öffnungszeiten</span>
    <h2 class="addr">Hartmannstraße 25.<span>Wörth am Rhein.</span></h2>
    <ul class="hours"></ul>
    <p class="note">Parkplätze gibt es ca. 100 m entfernt am Friedhof. Zum Be- und Entladen darfst du kurz vor dem Geschäft halten.</p>
    <div class="ctas"><a class="btn btn-red" href="https://www.google.com/maps/dir/?api=1&amp;destination=Hartmannstra%C3%9Fe%2025%2C%2076744%20W%C3%B6rth%20am%20Rhein" target="_blank" rel="noopener"><span class="roll"><span data-t="Route planen">Route planen</span></span><span class="ar">{AR}</span></a><a class="btn btn-light" href="#kontakt"><span class="roll"><span data-t="Kontakt">Kontakt</span></span><span class="ar">{AR}</span></a></div>
  </div>
</section>'''
h=open(os.path.join(D,'editorial.html'),encoding='utf8').read()
h=h.replace('{{WINTER}}',WINTER).replace('{{VISIT}}',VISIT).replace('{{AR}}',AR).replace('{{STARS}}',STAR*5)
h=h.replace('{{CSS}}',open(os.path.join(D,'editorial.css'),encoding='utf8').read())
h=h.replace('{{JS}}',open(os.path.join(D,'editorial.js'),encoding='utf8').read())
best=json.load(open(sys.argv[2] if len(sys.argv)>2 else os.path.join(D,'editorial_bestand.json'),encoding='utf8'))
h=h.replace('{{BESTAND}}',json.dumps(best,ensure_ascii=False).replace('</','<\\/'))
assert '{{' not in h, h[h.find('{{')-50:h.find('{{')+50]
out=sys.argv[1] if len(sys.argv)>1 else os.path.join(D,'vorlage-editorial.html')
open(out,'w',encoding='utf8').write(h)
print(out,len(h))

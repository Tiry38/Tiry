# Markup-Änderungen der Vorlage „plus“ – wird von plus_bauen.py mit exec() ausgeführt (rep/rrep/s stehen bereit).

# ---- Punkt 3: Tiefenebenen hinter allem (Licht von oben, ferne Lichtfläche, Schattenzone unten)
rep('<div class="smoke"></div><div class="grain"></div>',
    '<div class="smoke"></div><div class="grain"></div>'
    '<div class="pl-depth" aria-hidden="true"><i class="pl-l1"></i><i class="pl-l2"></i><i class="pl-l3"></i></div>')

# ---- Punkt 3: Lichtkegel + Kontaktschatten am Rad im Kopf
_h = s.index('id="hvis"')
_a = s.index('<div class="hring"></div>', _h); _a += len('<div class="hring"></div>')
s = s[:_a] + '<div class="pl-cone" aria-hidden="true"></div>' + s[_a:]
_a = s.index('<div class="hfloor"></div>', _h); _a += len('<div class="hfloor"></div>')
assert _a - _h < 5000
s = s[:_a] + '<div class="pl-contact" aria-hidden="true"></div>' + s[_a:]

# ---- Punkt 1: Abschnitts-Köpfe einheitlich – Kicker + Headline im Besuch- und Gutschein-Block sind schon da;
# Gutschein-Kicker als echter Kicker (gleiches Bauteil .eyebrow wie überall)
rep('<span class="gtx"><small>Geschenk-Idee zu Weihnachten</small>',
    '<span class="gtx"><small class="eyebrow">Geschenk-Idee zu <b>Weihnachten</b></small>')

# ---- Punkt 5: Fußzeile kompakt + reich (nur Inhalte, die schon auf der Seite stehen)
fa = s.index('<footer class="foot">')
fb = s.index('</footer>', fa) + len('</footer>')
FOOT = '''<footer class="foot pl-foot">
 <div class="wrap">
  <div class="pf">
   <div class="pf-brand">
    <a class="pf-logo" href="#start" data-r="start" aria-label="Velocenter Hessert – zur Startseite"><img src="img/velocenter-logo.svg" alt="Velocenter Hessert" width="460" height="241" loading="lazy" decoding="async"></a>
    <p>Dein E-Bike &amp; E-Dreirad-Spezialist mit eigener Werkstatt. Familienbetrieb seit 1995.</p>
    <div class="pf-badges"><a href="https://g.page/r/CYlWWOy1HBsvEBM/review" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-star"/></svg><b>4,8</b>&nbsp;bei Google</a><a href="#werkstatt"><svg aria-hidden="true"><use href="#i-wrench"/></svg>Bosch Service Center</a></div>
   </div>
   <div class="pf-col"><h4>Besuch</h4><span>Hartmannstraße 25</span><span>76744 Wörth am Rhein</span><span class="pf-mut">Nähe TÜV · Parkplätze ca. 100 m entfernt am Friedhof</span><a class="pf-lnk" href="https://www.google.com/maps/search/?api=1&amp;query=Velocenter+Hessert+Hartmannstra%C3%9Fe+25+76744+W%C3%B6rth+am+Rhein" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-map"/></svg>Route planen</a></div>
   <div class="pf-col" id="ftHours"><h4>Öffnungszeiten</h4><span><b>Mo, Di, Do, Fr</b></span><span>09:00–12:00 · 14:30–18:00</span><span><b>Sa</b> 09:00–12:00</span><span class="pf-zu">Mi &amp; So geschlossen</span></div>
   <div class="pf-col"><h4>Kontakt</h4><a href="tel:+49727178033"><svg aria-hidden="true"><use href="#i-phone"/></svg>07271 78033</a><a href="https://wa.me/491635343133" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-chat"/></svg>WhatsApp 0163 5343133</a><a href="mailto:info@velo-center.de"><svg aria-hidden="true"><use href="#i-mail"/></svg>info@velo-center.de</a><a href="#termin"><svg aria-hidden="true"><use href="#i-cal"/></svg>Werkstatt-Termin anfragen</a></div>
   <nav class="pf-col pf-nav" aria-label="Seiten"><h4>Seiten</h4><a href="#start" data-r="start">Start</a><a href="#service" data-r="service">Service</a><a href="#marken" data-r="marken">Marken</a><a href="#lager" data-r="lager">Auf Lager</a><a href="#isy" data-r="isy">i:SY Experte</a><a href="#treffen" data-r="treffen">i:SY Treffen</a><a href="#dreirad" data-r="dreirad">E-Dreiräder</a><a href="#kontakt" data-r="kontakt">Kontakt</a></nav>
   <div class="pf-col pf-soc"><h4>Folge uns</h4><div class="soc"><a href="https://www.instagram.com/velocenterhessert/" target="_blank" rel="noopener" aria-label="Instagram"><svg><use href="#i-ig"/></svg></a><a href="https://www.facebook.com/velocenterhessert" target="_blank" rel="noopener" aria-label="Facebook"><svg><use href="#i-fb"/></svg></a><a href="https://wa.me/491635343133" target="_blank" rel="noopener" aria-label="WhatsApp"><svg><use href="#i-chat"/></svg></a></div><span class="pf-mut">@velocenterhessert</span></div>
  </div>
  <p class="fnote">* Aktionspreise gelten nicht bei Leasing &amp; Finanzierung; dafür gilt der reguläre Preis. Alle Preise inkl. MwSt.</p>
  <div class="legalbar"><span>© <span id="yr">2026</span> Velocenter Hessert · Wörth am Rhein</span><span class="pf-legal"><a href="#impressum">Impressum</a><a href="#datenschutz">Datenschutz</a></span></div>
 </div>
</footer>'''
assert s.count('<footer class="foot">') == 1
s = s[:fa] + FOOT + s[fb:]

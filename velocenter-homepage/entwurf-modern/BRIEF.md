# Brief: 3 Design-Vorlagen für die Velocenter-Homepage (Startseite)

Auftraggeber: Tiry (Junior-Chef, Velocenter Hessert, E-Bike-Fachhändler in Wörth am Rhein).
Ziel: eine **Startseiten-Vorlage**, die zeigt, wie die bestehende Homepage (https://tiry38.github.io/velo-center-web/)
**maximal modern** aussehen könnte. Niveau: Hightech-Unternehmen 2026 (Apple Vision Pro, Rivian, Porsche Taycan
Konfigurator, Linear, Vercel, Nothing). **Keine „Billo“-Vorlage, nichts, das nach 1990/Baukasten/WordPress-Theme aussieht.**
Tiry ist extrem kritisch. Lieber eine Sache perfekt als viele halb.

## Pflicht-Farben (alle müssen sichtbar vorkommen)
- **Rot** (Marke): #E2232D / Crimson #C8102E (Akzent, Haupt-Knopf)
- **Weiß**
- **Grau**: Logo-Grau #868282, Graphit #2A2D34 / #1B1E25
- **Eisblau**: z. B. #DCEBF5, #B9D6EA, #7FB4D8, #22B0EE als Licht
- **Perlmutt**: irisierende, schimmernde Fläche (weiß mit Hauch Rosa/Eisblau/Champagner, z. B. #F6F1EC, #EDE6F0, #E3EEF3, Champagner #F0C8A0), animiert schimmernd
Kein Violett/Lila als eigene Akzentfarbe (Perlmutt-Schimmer darf einen Hauch Rosé/Flieder enthalten).

## Harte Design-Regeln (Tiry)
- Glas, Tiefe, Licht, saubere Bewegung, starke Funktionen. Große Radien, organische Formen (Kreise, Pillen), Farbverläufe mit 3+ Farben, sanft animiert, weiche Glows.
- Verboten: Kasten-in-Kasten, eckige Kachelraster im Baukasten-Look, flache Notlösungen, Strich-/Wellenlinien-Deko, bunte Blasen, Spielzeug-Effekte, Alt-Windows-Optik, Clip-Art, Emojis als Deko.
- Kontrast Text ≥ 4.5:1, Tipp-Flächen ≥ 44 px, **kein horizontales Scrollen** (auch nicht bei 360 px).
- **Animationen laufen immer** – KEINE `prefers-reduced-motion`-Regeln einbauen (Tiry-Ausnahme Homepage).
- Eine einzige HTML-Datei, CSS + JS inline, **keine externen Ressourcen** (kein CDN, keine Google Fonts). Schriften lokal: `fonts/outfit-latin.woff2` (Outfit, Variable 100–900) und `fonts/sora-latin.woff2` (Sora, Variable). Weitere Schriften nur, wenn du sie als Datei im Ordner hast – sonst diese beiden.
- `<meta name="robots" content="noindex">` in den Kopf (Vorlage, nicht für Google).
- Bilder mit `width`/`height`, unterhalb des ersten Bildschirms `loading="lazy"`, `decoding="async"`.
- Desktop UND Handy müssen beide bombastisch aussehen. Handy: der Kopf darf nicht 1/5 des Bildschirms fressen; Rad + Headline + Haupt-Knopf auf dem ersten Handy-Bildschirm.

## Bildmaterial (echt, liegt in `img/`, relative Pfade `img/...`)
- Freigestellte Räder (transparent, 1600 px breit): `img/p-isy.webp`, `p-isy2.webp`, `p-isy-orange.webp`, `p-ktm.webp`, `p-gudereit.webp`, `p-qio.webp`, `p-qio-eins-fineline.webp`, `p-vanraam.webp` (E-Dreirad), `p-vdv.webp`, `p-vdv-aebpro.webp`, `p-victoria.webp`, `p-victoria-veloa7.webp`
- Markenlogos (SVG, dunkle Originalfarben): `img/marke-isy.svg`, `marke-ktm.svg`, `marke-gudereit.svg`, `marke-qio.svg`, `marke-stevens.svg`, `marke-vanraam.svg`, `marke-vdv.svg`, `marke-victoria.svg`
- Velocenter-Logo: `img/velocenter-logo.svg` (rot/grau)
- Fotos: `img/fassade.webp` (800×600), `laden-innen.webp`, `laden-eingang.webp` (1280×722), `isy-ausstellung.webp` (1600×1200), `bosch-motor.webp` (1920×450), `treffen-luft.webp`, `sattelueberzug.webp` (freigestellt, Sattelüberzug-Geschenk), Partner: `logo-targobank.svg`, `logo-enra.svg`, `zub-bosch.svg`
- Weitere Rad-Fotos aus dem echten Bestand: `img/show/*.webp` (112 Dateien, z. B. `b2-isy-0.webp`, `b2-ktm-0.webp`; teils freigestellt).
Keine erfundenen Bilder, keine Stockfotos, keine Gesichter.

## Echte Inhalte (nichts dazuerfinden!)
- Velocenter Hessert · Familienbetrieb seit 1995 · Wörth am Rhein
- Kernsatz: „Dein E-Bike & E-Dreirad-Spezialist mit eigener Werkstatt.“ Über 300 E-Bikes zum Probefahren, ehrliche Beratung und ein Bosch Service Center, in dem der Chef noch selbst schraubt.
- Fakten: 4,8 Sterne bei Google, 221 Rezensionen · Bosch Service Center · 300+ E-Bikes vor Ort · Live-Bestand online („Auf Lager“)
- Haupt-Aktion: **Werkstatt-Termin anfragen**; zweite: **E-Bike finden** / Live-Bestand ansehen
- Winter-Aktion 2026/27: **–20 € auf jede Inspektion** + gratis **Sattelüberzug** mit Velocenter-Logo, 01.11.2026–28.02.2027, nur solange Termine verfügbar, auch für E-Dreiräder und Lastenräder. (Nie Prozent, nie „Satteldecke“.)
- Leistungen: Beratung & Probefahrt · Inspektion & Reparatur (Bosch Service Center) · 0 % Finanzierung über die TARGOBANK, bis zu 24 Monate, mit Anzahlung, zum regulären Preis (nicht auf Aktionspreise) · ENRA Versicherung (Diebstahl, Vollkasko mit Verschleiß, Pick-up-Service) · Dienstrad-Leasing (fast alle Leasing-Firmen, z. B. JobRad, Bikeleasing, Company Bike)
- Marken: i:SY, KTM, QiO, Velo de Ville, Van Raam (E-Dreirad Easy Rider), Gudereit, Victoria, Stevens
- Versprechen: „Hier schraubt der Chef noch selbst.“ – Stefan Hessert, Inhaber
- Bewertungen (echt): „Gesagt, getan: Zeitrahmen und Kostenprognose eingehalten. So ist das guter Kundenservice. Weiter so.“ – Bernd M. · „Super Service. Gestern gebracht, heute vormittag abgeholt. Wartung/Inspektion“ – Peter · „Seit wir die Fahrräder haben, einfach einen guten Service.“ – Jürgen K.
- Adresse: Hartmannstraße 25, 76744 Wörth am Rhein. Parkplätze ca. 100 m entfernt am Friedhof; zum Be-/Entladen kurz vor dem Geschäft halten.
- Öffnungszeiten: Mo, Di, Do, Fr 09:00–12:00 & 14:30–18:00 · Sa 09:00–12:00 · **Mi und So geschlossen**. Live-Status (offen/Mittagspause/geschlossen, „öffnet 14:30 Uhr“) per JS aus der Uhrzeit ist ein Plus.
- Telefon 07271 78033 (Link `tel:0727178033`), WhatsApp 0163 5343133 (`https://wa.me/491635343133`), info@velo-center.de, Instagram/Facebook velocenterhessert
- Navigation (8 Reiter): Start · Service · Marken · Auf Lager (LIVE) · i:SY Experte · i:SY Treffen · E-Dreiräder · Kontakt (Links dürfen `#` sein, es ist eine Vorlage)

## Aufbau der Startseite (Reihenfolge darfst du verbessern)
Kopf mit Navi + Öffnungs-Status + Termin-Knopf · Hero (Rad groß, Headline, 2 Aktionen, Fakten) · Schnellzugriffe (Termin, Auf Lager, Winter-Aktion, Öffnungszeiten) · Winter-Aktion · Marken-Showroom (Räder + Logos, interaktiv) · Versprechen + Leistungen · Bewertungen · Besuch (Adresse, Zeiten, Foto Fassade) · Fußzeile. Handy: feste Aktionsleiste unten (Anrufen · Termin · WhatsApp).

## Prüfen (Pflicht, selbst, mehrfach)
- Lokaler Server läuft: `http://localhost:8816/` (Ordner `/tmp/claude-0/-home-user/aa06df28-a730-5a50-9b3b-74be1455e397/scratchpad/live5`, enthält `img/` und `fonts/`).
  Deine Datei nach jedem Stand dorthin kopieren und dort ansehen.
- Playwright: `require('playwright')`, `chromium.launch()` (für WebGL: args `--enable-unsafe-swiftshader`,`--use-angle=swiftshader`). Screenshots bei 1440×900 (alle Bildschirme durchscrollen) und `devices['Pixel 7']` + 360×800. Keine JS-Fehler, kein horizontales Scrollen (`scrollWidth<=innerWidth`).
- Die echte Seite zum Vergleich: Screenshots in `/tmp/claude-0/-home-user/aa06df28-a730-5a50-9b3b-74be1455e397/scratchpad/ist/` (pc-start-*.png, handy-start-*.png). **Deine Vorlage muss sichtbar moderner und hochwertiger sein. Was dagegen abfällt, verbessern, bevor du fertig meldest.**
- Screenshots deiner Vorlage nach `/tmp/claude-0/-home-user/aa06df28-a730-5a50-9b3b-74be1455e397/scratchpad/vorlagen/<buchstabe>/`.

## Liefern
Datei `/home/user/Tiry/velocenter-homepage/entwurf-modern/vorlage-<buchstabe>.html` (relative Pfade `img/…`, `fonts/…`). Nicht committen, nicht pushen, nichts an `index.html` ändern.
Antwort an mich: Konzept in 3 Sätzen, was die Vorlage modern macht, Pfade der finalen Screenshots (1 Desktop-Übersicht, 1 Handy-Übersicht), bekannte Schwächen ehrlich.

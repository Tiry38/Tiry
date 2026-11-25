# Newsletter Dezember 2026 · Velocenter Hessert

**Hochladen in rapidmail:** `newsletter-dezember-2026-rapidmail.zip`
(Mailings → Neues Mailing → Schritt 1 ausfüllen → „Eigenes HTML hochladen“). HTML und alle Bilder liegen flach im ZIP.
Abmeldelink: `{%link_unsubscribe}`. Der Ordner `mail/` enthält dieselben Dateien entpackt.

## Aufbau (Stand 25.11.2026): November-Newsletter mit Homepage-Hintergrund
- Reihenfolge wie im November-Newsletter: Kopf → Winter-Inspektion → Umbau/Räumung → Umbau-Angebote →
  E-Bike-Service → Finanzierung → Versicherung → Leasing → Bitte beachten (Parken) → Marken → Besuch uns → Social.
- **Hintergrund = Herbstallee der Homepage, ein einziges Bild über die ganze Mail** (`hintergrund.jpg`, 640 × 11.520 px):
  oben das Allee-Foto, danach läuft die Straße mit der gelben Mittellinie als Fahrt-Unschärfe nahtlos bis zum Fuß.
  Darüber fällt Laub (`laub.gif`, nahtlose Kachel, läuft in Apple Mail, iOS, Gmail Web, Outlook.com).
  Outlook für Windows zeigt keine Hintergrundbilder → dort dunkler Asphalt-Ton als Fläche.
- **Winter-Aktion = die echte Karte der Homepage** (`deal.gif`, mit fallendem Schnee aufgenommen). Countdown und
  Knopf aus der Aufnahme entfernt (ein eingefrorener Countdown wäre falsch); darunter echte, klickbare Knöpfe.
- **6 Angebote** im Studio-Look: Ersparnis füllt sich rot, Preis rollt von UVP auf den Aktionspreis
  (`x-o1` … `x-o6`, `x-vr`). Erstes GIF-Bild = Endzustand (Outlook).
- Alle Knöpfe verlinkt, mit Hover-Effekt; Links auf die Homepage `tiry38.github.io/velo-center-web`.
- Korrigiert gegenüber November (laut Homepage): Winter-Aktion nur Marken-Fahrräder mit Bosch-Antrieb;
  Finanzierung **mit** Anzahlung und nur zum regulären Preis; ENRA ab ca. 120 € (neu) / ab ca. 70 € (gebraucht);
  Leasing-Logos laut Homepage/Planer (RIDE statt mein-dienstrad.de).

## Fotos fehlen (Donnerstag 26.11.2026)
1. Velo de Ville SEB890 SUV Smart 27,5″ · Pure White · 45 cm · Trapez – seitlich, Antriebsseite
2. Velo de Ville AEB400 Allround 28″ · wine red · 55 cm · Tiefeinsteiger – seitlich, Antriebsseite
Danach freigestellt nach `werkzeug-v2/a/` legen, in `werkzeug-v2/scene.html` bei `S.o2`/`S.o6` `img:` setzen,
`node frames.js o2 o6`, `python3 mkgif.py o2 300 80`, `python3 mkgif.py o6 300 80`, `python3 build2.py`, ZIP neu.

## Sichtbare Platzhalter ([⚠ PRÜFEN])
- Sind alle 6 Räder noch da (Bestand 12.11.)? · Umbau-Räumung bis 70 % im Dezember noch gültig? · Öffnungszeiten 24.12.–06.01.

## Betreff + Vorschautext
1. 6 E-Bikes bis 1.600 € unter UVP · 2. Inspektion 20 € günstiger + Sattelüberzug · 3. E-Dreirad für Mama und Papa: 1.168 € weniger
Vorschautext: „Inspektion 20 € günstiger, Sattelüberzug gratis. Dazu 6 E-Bikes bis 1.600 € unter UVP.“

## Werkzeug
`werkzeug-v2/` (aktuelle Fassung; Fotos/Schriften aus `werkzeug/a/` nach `werkzeug-v2/a/` kopieren, Herbstfoto
`herbst-2400.webp` aus der Homepage `img/hg12/`). `archiv/` = erste Dezember-Fassung „Werkstatt-Auftrag“ (hell).

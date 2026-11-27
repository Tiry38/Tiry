# Newsletter Dezember 2026 · Velocenter Hessert

**Hochladen in rapidmail:** `newsletter-dezember-2026-rapidmail.zip`
(Mailings → Neues Mailing → Schritt 1 ausfüllen → „Eigenes HTML hochladen“). HTML und alle Bilder liegen flach im ZIP.
Abmeldelink: `{%link_unsubscribe}`. Der Ordner `mail/` enthält dieselben Dateien entpackt.

## Aufbau (Stand 25.11.2026, Fassung „Magazin“)
- **Ganz gestaltete Seite statt Baukasten:** `werkzeug-v3/page.html` ist der Newsletter als frei gestaltete Seite
  (Herbstallee + Nebel-Glas laut `DESIGN.md`, Outfit/Sora, Räder ragen aus den Glasflächen, große Zahlen, Abfahrtstafel).
- `render.js` rendert sie (2×) und alle Animationen Bild für Bild, `slice.py` schneidet sie pixelgenau in Stücke:
  jede Knopf-Fläche = eigene verlinkte Zelle, jede Animation = eigene GIF-Zelle; `build4.py` baut das Mail-HTML.
- Bewegt (GIF, alle Mailprogramme): Kopf mit Homepage-Laub (WebGL-Aufnahme), Winter-Karte der Homepage mit Schnee,
  Abfahrtstafel (Preise klappen), rollende Preise je Rad. Hover-Aufhellen der Knöpfe in Apple Mail/iOS.
- Impressum und Abmeldelink als echter Text unten. Bilder gesamt ca. 2,3 MB.
- Hinweis: Mails aus Bildern zeigen bei blockierten Bildern (z. B. Outlook-Standard) zuerst nur die Alt-Texte.
- Korrigiert gegenüber November (laut Homepage): Winter-Aktion nur Marken-Räder mit Bosch-Antrieb; Finanzierung mit Anzahlung,
  nur regulärer Preis; ENRA ab ca. 120 € / 70 €; RIDE statt mein-dienstrad.de.

## Fotos (eingebaut 27.11.2026, Bildlieferung Branch `ccr-782d147e-vm3iq0`, `bildlieferung/QUELLEN.md`)
- FID 5173 SEB890 SUV Smart Pure White → `werkzeug-v3/a/seb890.png` (Studiofoto, Nabe kann abweichen)
- FID 4605 AEB400 wine red → `werkzeug-v3/a/aeb400.png` (Werksbild)
- FID 4815 AEB490 Mocca → `werkzeug-v3/a/aeb490.png` (Werksbild, Farbe angepasst)

## Winter-Karte (27.11.2026)
- Eine durchgehende GIF-Schleife (10 s, 200 Bilder à 50 ms), aufgenommen von der Live-Homepage: `werkzeug-v3/deal2.js`.
  Kristall-Schnee mit den Homepage-Formeln (Frequenzen auf 10 s gerundet, jede Flocke blendet einmal weich), Sattel schwebt (suf 5 s).
  Palette k-means + festes Bayer-Raster (`kmpal.py`) gegen Farbstufen. Ca. 1,1 MB.

## Links (27.11.2026, live geprüft)
- Rad-Knöpfe: `#rad=<slug>~<FID>` öffnet genau dieses Rad (Homepage aad7a6d).
- Probefahrt/Termin: `#termin=<Text>` öffnet das Formular mit passender Art und vorbelegtem Text.
- WhatsApp nur noch bei Ortlieb und beim WhatsApp-Knopf der Winter-Inspektion.

## Sichtbare Platzhalter ([⚠ PRÜFEN])
- keine

## Bestätigt (Tiry 25.11.2026)
- E-Antelao wird ohne Schutzbleche und Gepäckträger verkauft: Foto retuschiert (`werkzeug-v3/retusche.py`, Reifen/Speichen aus sauberen Radbereichen ergänzt). Van Raam = Vorführmodell, reduziert.
- Laub/Schnee als nahtlose Überblend-Schleifen (kein Zurückspringen).
- Alle 6 Räder noch da. Ortlieb Vario PS: Tirys Grafik (80 € statt 169,99 €) unter der Räumung, verlinkt auf WhatsApp-Anfrage.
- Animationen 10× langsamer: Laub (Shader-Zeit ×0,1), Schnee eigener Kristall-Schnee ×0,1, Sattel steht; Preise/Tafel ca. 3× langsamer.
- Umbau-Räumung gilt den ganzen Dezember. Weihnachtspause: letzter Tag Di 22.12.2026, wieder offen Mo 04.01.2027.

## Betreff + Vorschautext
1. 6 E-Bikes bis 1.600 € unter UVP · 2. Inspektion 20 € günstiger + Sattelüberzug · 3. E-Dreirad für Mama und Papa: 1.168 € weniger
Vorschautext: „Inspektion 20 € günstiger, Sattelüberzug gratis. Dazu 6 E-Bikes bis 1.600 € unter UVP.“

## Werkzeug
`werkzeug-v2/` (aktuelle Fassung; Fotos/Schriften aus `werkzeug/a/` nach `werkzeug-v2/a/` kopieren, Herbstfoto
`herbst-2400.webp` aus der Homepage `img/hg12/`). `archiv/` = erste Dezember-Fassung „Werkstatt-Auftrag“ (hell).

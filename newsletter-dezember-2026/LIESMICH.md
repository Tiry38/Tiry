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

## Fotos fehlen (Donnerstag 26.11.2026)
1. Velo de Ville SEB890 SUV Smart 27,5″ · Pure White · 45 cm · Trapez – seitlich, Antriebsseite
2. Velo de Ville AEB400 Allround 28″ · wine red · 55 cm · Tiefeinsteiger – seitlich, Antriebsseite
Danach freigestellt ablegen, in `werkzeug-v3/page.html` im Feld `O` bei Nr. 2 und 6 `img:` setzen,
`node render.js`, `python3 slice.py`, `python3 build4.py`, ZIP neu.

## Sichtbare Platzhalter ([⚠ PRÜFEN])
- keine (Fotos SEB890/AEB400 folgen)

## Bestätigt (Tiry 25.11.2026)
- Alle 6 Räder noch da. Ortlieb Vario PS: Tirys Grafik (80 € statt 169,99 €) unter der Räumung, verlinkt auf WhatsApp-Anfrage.
- Animationen 10× langsamer: Laub (Shader-Zeit ×0,1), Schnee eigener Kristall-Schnee ×0,1, Sattel steht; Preise/Tafel ca. 3× langsamer.
- Umbau-Räumung gilt den ganzen Dezember. Weihnachtspause: letzter Tag Di 22.12.2026, wieder offen Mo 04.01.2027.

## Betreff + Vorschautext
1. 6 E-Bikes bis 1.600 € unter UVP · 2. Inspektion 20 € günstiger + Sattelüberzug · 3. E-Dreirad für Mama und Papa: 1.168 € weniger
Vorschautext: „Inspektion 20 € günstiger, Sattelüberzug gratis. Dazu 6 E-Bikes bis 1.600 € unter UVP.“

## Werkzeug
`werkzeug-v2/` (aktuelle Fassung; Fotos/Schriften aus `werkzeug/a/` nach `werkzeug-v2/a/` kopieren, Herbstfoto
`herbst-2400.webp` aus der Homepage `img/hg12/`). `archiv/` = erste Dezember-Fassung „Werkstatt-Auftrag“ (hell).

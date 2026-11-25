# Newsletter Dezember 2026 · Velocenter Hessert

**Hochladen in rapidmail:** `newsletter-dezember-2026-rapidmail.zip`
(Mailings → Neues Mailing → Schritt 1 ausfüllen → „Eigenes HTML hochladen“). HTML und alle Bilder liegen flach im ZIP.
Abmeldelink: `{%link_unsubscribe}`. Der Ordner `mail/` enthält dieselben Dateien entpackt.

## Aufbau (Stand 25.11.2026, Fassung „Herbstallee“)
- Reihenfolge wie im November: Kopf → Winter-Inspektion → Umbau → Umbau-Angebote → Van Raam → Service → Finanzierung → Versicherung → Leasing → Parken/Marken → Besuch/Social.
- **Kopf = echte Homepage-Szene** (WebGL „Herbstallee“ mit dem Laub der Homepage, aufgenommen mit gesteuerter Uhr, `kopf.gif`),
  darunter das **rote Laufband** wie auf der Homepage (`band.gif`). Beide sitzen pixelgenau auf `hintergrund.jpg`.
- **Ein Hintergrund für die ganze Mail** (`hintergrund.jpg`): Allee → Fahrt-Unschärfe → nach unten heller Herbstnebel,
  an den Rändern Laubbäume. Darüber fallendes Laub im Stil der Homepage (`laub.gif`). Outlook Windows: helle Fläche.
- **Winter-Karte der Homepage** mit Schnee (`deal.gif`), schräge Kanten wie auf der Homepage.
- **Abfahrtstafel** (`tafel.gif`, Fallblatt): 6 Angebote, Preise klappen auf den Aktionspreis.
- Angebotskarten 01–06: Ersparnis füllt sich, Preis rollt (`x-o*.gif`); „Technische Daten“ aufklappbar
  (Apple Mail/iOS/Browser; Gmail/Outlook zeigen sie offen). **0-%-Zähler** (`null.gif`).
- Knöpfe: Glanz läuft durch, Pfeil schiebt, Hover/Tippen (Apple Mail, iOS, Browser). Alle Links auf die Homepage.
- Korrigiert gegenüber November (laut Homepage): Winter-Aktion nur Marken-Räder mit Bosch-Antrieb; Finanzierung mit Anzahlung,
  nur regulärer Preis; ENRA ab ca. 120 € / 70 €; RIDE statt mein-dienstrad.de.
- ZIP ca. 1,9 MB.

## Fotos fehlen (Donnerstag 26.11.2026)
1. Velo de Ville SEB890 SUV Smart 27,5″ · Pure White · 45 cm · Trapez – seitlich, Antriebsseite
2. Velo de Ville AEB400 Allround 28″ · wine red · 55 cm · Tiefeinsteiger – seitlich, Antriebsseite
Danach freigestellt nach `werkzeug-v2/a/` legen, in `werkzeug-v2/scene.html` bei `S.o2`/`S.o6` `img:` setzen,
`node frames.js o2 o6`, `python3 mkgif.py o2 300 80`, `python3 mkgif.py o6 300 80`, `python3 build3.py`, ZIP neu.

## Sichtbare Platzhalter ([⚠ PRÜFEN])
- Sind alle 6 Räder noch da (Bestand 12.11.)? · Umbau-Räumung bis 70 % im Dezember noch gültig? · Öffnungszeiten 24.12.–06.01.

## Betreff + Vorschautext
1. 6 E-Bikes bis 1.600 € unter UVP · 2. Inspektion 20 € günstiger + Sattelüberzug · 3. E-Dreirad für Mama und Papa: 1.168 € weniger
Vorschautext: „Inspektion 20 € günstiger, Sattelüberzug gratis. Dazu 6 E-Bikes bis 1.600 € unter UVP.“

## Werkzeug
`werkzeug-v2/` (aktuelle Fassung; Fotos/Schriften aus `werkzeug/a/` nach `werkzeug-v2/a/` kopieren, Herbstfoto
`herbst-2400.webp` aus der Homepage `img/hg12/`). `archiv/` = erste Dezember-Fassung „Werkstatt-Auftrag“ (hell).

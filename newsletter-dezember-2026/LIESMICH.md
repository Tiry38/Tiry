# Newsletter Dezember 2026 · Velocenter Hessert

**Hochladen in rapidmail:** `newsletter-dezember-2026-rapidmail.zip`
(Mailings → Neues Mailing → Schritt 1 ausfüllen → „Eigenes HTML hochladen“). HTML und alle Bilder liegen flach im ZIP.
Abmeldelink: `{%link_unsubscribe}`. Der Ordner `mail/` enthält dieselben Dateien entpackt.

## Konzept „Werkstatt-Auftrag“
Kraftpapier-Anhänger, wie sie in der Werkstatt am Rad hängen. Aufmacher: Auftragszettel „Winter-Inspektion“ wird von Hand
ausgefüllt, dann knallt der rote Werkstattstempel „−20 €“ drauf, der Sattelüberzug kommt dazu, Herbstblätter fallen.
Jedes Angebot: Preis-Anhänger schwingt ein und dreht sich von UVP auf den Aktionspreis, die Ersparnis füllt sich rot.
Alle GIFs zeigen im ersten Bild schon die fertige Aussage (Outlook Windows zeigt nur Bild 1).

## Stand 25.11.2026
- Bestand: Homepage-Lager = Veloport-Export vom **12.11.2026**. Alle Preise geprüft (`kontrolle/preischeck.txt`).
- Alle Links auf die **neue** Homepage `tiry38.github.io/velo-center-web` – www.velo-center.de zeigt noch die alte Seite.
  Nach der Domain-Umstellung in `werkzeug/build.py` nur `HP` ändern und neu bauen.
- Link-Check: `kontrolle/linkcheck.txt` (Instagram antwortet Prüf-Skripten mit 429, Link ist identisch mit der Homepage).
- GIFs 110–300 KB, gesamt ca. 1,3 MB.

## Fotos fehlen (Donnerstag 26.11.2026)
1. Velo de Ville SEB890 SUV Smart 27,5″ · Pure White · 45 cm · Trapez – seitlich, Antriebsseite, ruhiger Hintergrund
2. Velo de Ville AEB400 Allround 28″ · wine red · 55 cm · Tiefeinsteiger – seitlich, Antriebsseite
Danach: freistellen, als `a/seb890.webp` / `a/aeb400.webp` in `werkzeug/a/` legen, in `scene.html` bei `S.o3`/`S.o6`
`img:` setzen, dann `node frames.js o3 o6`, `python3 mkgif.py o3 300 80`, `python3 mkgif.py o6 300 80`, `python3 build.py`, ZIP neu.

## Sichtbare Platzhalter in der Mail ([⚠ PRÜFEN])
- Sind alle 6 Räder noch da (Bestand 12.11.)?
- Umbau-Räumung bis 70 % (aus dem November-Newsletter) im Dezember noch gültig?
- Öffnungszeiten 24.12.2026 – 06.01.2027.

## Betreff + Vorschautext
1. **6 E-Bikes bis 1.600 € unter UVP** (32)
2. **Inspektion 20 € günstiger + Sattelüberzug** (40)
3. **E-Dreirad für Mama und Papa: 1.168 € weniger** (44)
Vorschautext (im HTML gesetzt): „Inspektion 20 € günstiger, Sattelüberzug gratis. Dazu 6 E-Bikes bis 1.600 € unter UVP.“ (87 Zeichen)

## Neu bauen (werkzeug/)
`node frames.js` (Frames, Chromium) → `python3 mkgif.py <name> 300 80` (braucht gifsicle) → `node assets.js` (Logos/Icons)
→ `python3 build.py` → `node shots2.js` / `node links.js`. Pfade relativ zu `werkzeug/`, Ausgabe in `werkzeug/out/`.

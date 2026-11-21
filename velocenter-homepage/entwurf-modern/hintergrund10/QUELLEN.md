# Quellen – Vorlage „Pässe & Küste“ (hintergrund10)

Tiry 21.11.2026: „lieber wieder solche Landschaften wie vorher (hintergrund7), ein klein bisschen mehr auf Fahrrad spezialisiert, verschiedener“.
Große, echte Landschaften; der Radbezug kommt nur von den Straßen (Pass-Serpentinen, Küstenstraße, Schotterweg).
**Keine Personen, keine Fahrräder.** Autos/Busse auf dem Pass wegretuschiert.

Alle drei Fotos: **Unsplash-Lizenz** (frei, auch gewerblich, ohne Namensnennungspflicht; Namensnennung hier trotzdem).
Alle drei sind freie Unsplash-Fotos (`images.unsplash.com/photo-…`, nicht `plus.unsplash.com`/Unsplash+).

| Szene | Foto | Fotograf | Bearbeitung |
|---|---|---|---|
| 1 Serpentinen (`serp`) | https://unsplash.com/photos/N4AjlQzBqEQ (photo-1753739784971-91f2f7b60b80) | Georg Eiermann | 14 Autos/Busse wegretuschiert, gespiegelt |
| 2 Küstenstraße (`kueste`) | https://unsplash.com/photos/xzmbHQQHxv8 (photo-1527159650678-2307dd6a6e97) | Annie Spratt | – |
| 3 Schotterweg (`gravel`) | https://unsplash.com/photos/gHwDURuSafI (photo-1510158105534-9b01f2462ce1) | Kyle Glenn | rosa Wolken nach Gold/Orange umgefärbt (kein Rosa), gespiegelt |

Tiefenkarten: **Depth Anything V2 Small** (Apache-2.0), lokal gerechnet.

Datenkanäle:
- `<name>-d.png`: R = Tiefe (hell = nah), G = Himmel, B = Wolken ziehen.
- `<name>-m.png`: R = Pflanzen (wiegen im Wind), G = Wasser glitzert, B = Wasser fließt abwärts (Wasserfall/Bach, Brandung).

Bauen: `python3 inject.py <live-index.html> <ziel.html> [serp|kueste|gravel] [--feste-bilder]`, Bilder nach `img/hg10/` neben die Seite.
Bewegung: Maus/Neigen = Kamera, Scrollen = Kamerafahrt + Abendlicht, jeder Seitenwechsel = eigene Kamerafahrt, Klick = rote Lichtwelle.

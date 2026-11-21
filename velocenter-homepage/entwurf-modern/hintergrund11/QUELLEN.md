# Quellen – Vorlage „Nebel, See & Schnee“ (hintergrund11)

Tiry 21.11.2026: „so, die 3 haben wir schonmal gespeichert. nun machst du mir 3 weitere unterschiedliche in diesem style“ (nach hintergrund10 „Pässe & Küste“).
Große, echte Landschaften mit Straße (Radbezug), **keine Personen, keine Fahrräder, keine Fahrzeuge**.

Alle drei Fotos: **Unsplash-Lizenz** (frei, auch gewerblich, ohne Namensnennungspflicht; Namensnennung hier trotzdem).
Alle drei sind freie Unsplash-Fotos (`images.unsplash.com/photo-…`, nicht Unsplash+), am 21.11.2026 auf den Foto-Seiten geprüft.

| Szene | Foto | Fotograf | Bearbeitung |
|---|---|---|---|
| 1 Nebelstraße (`nebel`) | [unsplash.com/photos/4shEriZp-wI](https://unsplash.com/photos/4shEriZp-wI) (photo-1589837568155-30f683a94166) | Robbie Palmer | 11 Baustellen-Fässer am Straßenrand wegretuschiert, gespiegelt |
| 2 Bergsee (`see`) | [unsplash.com/photos/1VLih3VixAY](https://unsplash.com/photos/1VLih3VixAY) (photo-1757536510446-087388eddfa2) | Bart Ros | 1 Person auf der Straße wegretuschiert |
| 3 Winterpass (`winter`) | [unsplash.com/photos/Kvata5juryE](https://unsplash.com/photos/Kvata5juryE) (photo-1635722428227-ade012904438) | Anqi Lu | 1 Auto auf der Straße wegretuschiert |

Tiefenkarten: **Depth Anything V2 Small** (Apache-2.0), lokal gerechnet (Tiefe auf 1.–99,5. Perzentil gespreizt; See 96., wegen Geländer im Vordergrund).

Datenkanäle:
- `<name>-d.png`: R = Tiefe (hell = nah), G = Himmel, B = Wolken ziehen / Nebelflächen.
- `<name>-m.png`: R = Pflanzen/Wald (wiegen im Wind), G = Wasser (kräuselt, glitzert), B = frei.

Neu gegenüber hg10: `fg` = Nebel-Stärke (zweite, gegenläufige Nebelschicht ab fg > 1,2), `sn` = Schneefall in drei Tiefen (Maus schiebt die vorderen Flocken).

Bauen: `python3 inject.py <live-index.html> <ziel.html> [nebel|see|winter] [--feste-bilder]`, Bilder nach `img/hg11/` neben die Seite.
Bewegung: Maus/Neigen = Kamera, Scrollen = Kamerafahrt + Abendlicht, jeder Seitenwechsel = eigene Kamerafahrt, Klick = rote Lichtwelle.

# Hintergrund 15 – Regen, blaue Stunde, Pusteblumen

Tiry, 22.11.2026: Die Landschaften sollen mehr mit E-Bike-Fahren zu tun haben. Jede Szene bekommt einen passenden technischen Effekt, wie das fallende Laub in der Herbstallee.
Auf den Fotos sind keine Fahrräder, Personen oder Fahrzeuge. Kein Motiv kommt aus den Vorlagen 9–14 (Liste in `hintergrund14/QUELLEN.md`, dazu Dünensteg, Heideweg und Zypressentunnel).

| Modus | Foto | Fotograf | Lizenz | Retusche |
|---|---|---|---|---|
| regen – Regenstraße | [Unsplash aPWCvM1mAI0](https://unsplash.com/photos/an-empty-road-surrounded-by-trees-and-bushes-aPWCvM1mAI0) | Tahlia Doyle | Unsplash-Lizenz (frei, kein Unsplash+) | keine |
| abend – Blaue Stunde | [Pexels 35069749](https://www.pexels.com/photo/serene-blue-twilight-over-empty-mountain-road-35069749/) | Idzzzed | Pexels-Lizenz | Warnschild am Horizont und Markierung auf der Fahrbahn entfernt |
| wiese – Pusteblumenweg | [Unsplash i3YiCS6uOL8](https://unsplash.com/photos/dirt-path-through-golden-meadow-i3YiCS6uOL8) | Evgeni Gitlits | Unsplash-Lizenz (frei, kein Unsplash+) | keine |

Beide Lizenzen erlauben gewerbliche Nutzung ohne Namensnennung.
Die Tiefe stammt aus Depth Anything V2. Die Masken sind selbst erzeugt (Skript `prep18.py` im Arbeitsordner).

## Effekte
- **Regenstraße:**
  - Regenfäden fallen in drei Tiefen und verschwinden hinter näheren Bäumen. Die Maus ist der Wind und macht den Regen schräg.
  - Auf der nassen Straße glänzt das Wasser und es gibt Spritzer.
  - Auf der Linse laufen Tropfen herab, die das Bild dahinter verzerren.
- **Blaue Stunde:**
  - Der Scheinwerfer des E-Bikes (Abblendlicht) fällt perspektivisch richtig auf die Straße. Die Maus lenkt ihn wie der Lenker.
  - Mittellinie und Randlinien leuchten im Licht auf. Über der Fahrbahn liegt Lichtdunst, im Lichtkegel tanzen Mücken.
  - Beim Scrollen wird es tiefere Nacht und das Licht reicht weiter.
- **Pusteblumenweg:**
  - Pusteblumen-Samen mit Schirmchen schweben in drei Tiefen. Zur Sonne hin leuchten sie auf. Die Maus ist der Wind und schiebt die Samen weg.
  - Dazu kommen Lichtstrahlen.
- **Für alle:**
  - Die Kino-Schärfe folgt der Maus. Bei Regen und blauer Stunde bleibt die Ferne immer scharf, damit die Straßenlinien nicht doppelt wirken (wie der Fix für die Herbstallee).
  - Die Qualität passt sich automatisch an. Links liegt farbtreues Milchglas.

## Verworfen
- **Dämmerstraße zwischen Baumwänden** (Unsplash Z8kRG52UCc8): Streifen im Himmel, zu ähnlich zur Herbstallee.
- **Pusteblumen-Fotos:** Kein freies Querformat ≥ 4000 px mit Weg und Pusteblumen zusammen. Die Samen erzeugt deshalb der Effekt.

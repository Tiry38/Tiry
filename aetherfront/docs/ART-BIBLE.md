# Aetherfront – Art Bible (M1 „Grafik-Fundament“)

Verbindliche Bildsprache für Welt, Einheiten, Helden und Effekte. Ziel: so nah an einen modernen
Unreal-Engine-5-Look, wie WebGL2/Three.js es erlaubt – **aber immer lesbar**: Spielflächen sind flach (y = 0),
Einheiten heben sich klar vom Boden ab, Effekte erklären Spielmechanik.

Technik-Bezug: Biome sind in `src/render/environment.js` (`BIOMES`, `env.setBiome(id)`) umgesetzt, die
Grading-Werte landen 1:1 in `engine.look` (`src/render/engine.js`). Echte Materialien kommen aus
`web/assets/` (CC0, Liste in `web/assets/LICENSES.md`, Auswahl in `src/render/asset-catalog.js`).

---

## 1. Grundprinzipien

1. **Lesbarkeit vor Detail.** Aus der RTS-Kamera (40–150 m) zählen Silhouette, Farbe und Helligkeitskontrast.
   Details (Normalmaps, Moos, Fugen) wirken in der Heldenkamera (≈ 3 m Höhe) und werden mit Entfernung ausgeblendet.
2. **Werte-Hierarchie (Helligkeit):** Boden mittel-dunkel (Albedo 0,25–0,45) → Einheiten heller/gesättigter →
   Effekte und Gefahren am hellsten (HDR > 2, bloomen). Niemals Boden heller als Einheiten.
3. **Farbe erzählt Zugehörigkeit:** Team- und Fraktionsfarben sind gesättigt, die Welt ist gedämpfter
   (Sättigung der Umgebung max. ~70 % der Einheitenfarben).
4. **Physikalisch plausibel, stilistisch überhöht:** PBR-Materialien (Albedo/Normal/Rauheit/AO), Licht aus HDRI
   (bildbasiert) + Sonne mit weichen Schatten, dazu überhöhte Elemente: leuchtende Runen, Kristalle, Lichtsäulen.
5. **Organische Formen:** Keine Baukasten-Kisten. Felsen gebrochen, Inseln gelappt, Kronen wolkig,
   Gras in feinen, unterschiedlich hohen Halmen.

## 2. Materialsprache

| Material | Quelle | Regeln |
|---|---|---|
| Bahn / Brücke / Königsplateau | `rock_tile_floor` (2,6 m Kachel) | Grauer Granit, Fugen mit Moos (aus AO-Map), Makro-Variation gegen Kachelmuster, Kontrast leicht gedämpft. |
| Inselboden | `leafy_grass` + `forest_ground_04` | Waldboden unter feinem Gras; Erde an Kanten und in Flecken, **Höhenmischung** (hellere Körner ragen durch). |
| Felswände | `cliff_side` triplanar (9 m, fern 23 m) | Schichtgestein, Gesteinsbänder über Vertexfarbe, Moos auf Absätzen und in dunklen Spalten. |
| Ruinen, Säulen, Portale, Bordsteine | `rock_boulder_dry` triplanar | Heller behauener Stein, Moos auf Oberseiten/Fugen (Höhenmischung), Gold als Metall (rau 0,3). |
| Findlinge | `mossy_rock` triplanar | Bemooster Fels, dunkler als Ruinen. |
| Rinde | `bark_brown_02` (objekt-triplanar) | Längsmaserung, Moos am Stammfuß. |
| Laub | `LeafSet024` (ambientCG) | Fotoblätter, teilentsättigt → Farbe kommt aus Baumart × Biom-Tönung; Durchscheinen im Gegenlicht. |
| Kristalle / Magie | prozedural | Emissiv (HDR 1,5–4), Fresnel-Rand, nie auf Spielflächen blendend hell. |
| Einheiten | prozedural (`models.js`) | Mikro-Relief + Fresnel; Fraktionspalette (s. u.). |

Regeln: Rauheit nie < 0,25 außer Metall/Kristall · Albedo nie > 0,8 (kein reines Weiß) · Normalmap-Stärke
nimmt mit Distanz ab (60–260 m) · Texturen ≤ 2k, Kacheln immer mit Makro-Rauschen brechen.

## 3. Fraktions-Paletten & Silhouetten

| Fraktion | Primär | Sekundär | Metall | Glühen | Silhouette (von oben erkennbar) |
|---|---|---|---|---|---|
| Sonnenorden | `#ece4cf` Elfenbein | `#2f5fb3` Königsblau | `#d9b25a` Gold | `#ffd27a` | Breite Schulterplatten, runde Schilde, Heiligenschein-Ringe |
| Wildherz | `#5f8a3c` Moosgrün | `#7a4f2c` Rindenbraun | `#b08d57` Bronze | `#9cff6a` | Geweihe, Blattkränze, organisch-asymmetrisch |
| Ätherschmiede | `#5a6472` Stahlgrau | `#c2763a` Kupfer | `#b9c3cf` Silber | `#40e6ff` | Kantige Panzer, Zahnräder, Kessel-Rücken, Antennen |
| Abgrund | `#2c2440` Nachtviolett | `#6a1f52` Blutviolett | `#80869a` Zinn | `#c06bff` | Dornen, lange Krallen, Schleier/Rauchschweife |
| Schwarmbrut | `#4a5a2a` Chitin-Oliv | `#c8a03a` Ocker | `#7a6a4a` | `#d8ff4a` | Viele Beine, Panzersegmente, flach und breit |
| Glutgeborene | `#3a2422` Schlacke | `#ff6a2a` Glut | `#8a5a3a` | `#ffaa3a` | Glühende Risse, Hörner, Flammenkämme |

**Silhouettenregeln**
- Jede Einheit ist **von oben** an Umriss + Farbfläche erkennbar: mindestens ein großes Formmerkmal
  (Schild, Geweih, Kessel, Flügel) mit ≥ 25 % der Draufsicht-Fläche.
- Größenklassen: Klein (0,6–1 m), Mittel (1–1,6 m), Groß (≥ 2 m), Boss (≥ 3,5 m). Keine zwei Einheiten einer
  Fraktion mit gleicher Größe *und* gleicher Grundform.
- **Team-Kennung:** Bodenring in Teamfarbe (West Blau/Türkis, Ost Rot/Orange) unter jeder Einheit.
- **Held:** goldweiße Lichtsäule (Höhe 6–8 m, 25 % Deckkraft, zum Himmel ausblendend) + doppelter Bodenring mit
  langsam rotierenden Runen. Immer heller als normale Einheiten, nie heller als Gefahren-Telegraphen.
- **Wellen-Anführer:** eigene Aura (pulsierende Halbkugel in der Fraktions-Glühfarbe, Radius = Moral-Aura),
  Krone/Banner über dem Kopf, 1,3× Größe.
- **Gefahren (Bodenwarnungen):** Rot-Orange `#ff4a2a` mit hellem Rand, füllt sich zum Auslösezeitpunkt –
  einzige Farbe, die auf Spielflächen „schreien“ darf.

## 4. Biome (Akte) – Lichtstimmung, Paletten, Grading

Alle Werte entsprechen `BIOMES` in `environment.js`. Sonnenazimut als (x, z), Höhen in Grad.
Die Himmelsfarben für Dunst/Wolkenmeer werden **aus dem HDRI gemessen** und auf `skyTarget` normiert –
dadurch passen Horizont, Nebel und Licht automatisch zusammen.

### Akt 1 – Himmelsinseln (`sky`, Standard)
- **Stimmung:** klarer Nachmittag, große Haufenwolken, frische Luft, Abenteuer.
- **HDRI:** `kloofendal_48d_partly_cloudy_puresky` (Sonne ≈ 48°), Licht 40°, Sonnenfarbe `(1.0, 0.87, 0.70)`, Stärke 3,5.
- **Palette:** Himmelblau `#6f9bd8`, Wolkenweiß `#f2f0ea`, Moosgrün `#4d6b2a`, Granitgrau `#8a8478`, Gold `#e0b45a`, Türkis-Magie `#40e0ff`.
- **Nebel:** Dichte 0,00125, bläulich, Höhennebel 1,0 unter den Inseln.
- **Vegetation:** satt grün (Tönung 1/1/1), Kirschblüten-Akzente.
- **Grading (`engine.look`):** exposure 1,0 · temperature 0,10 · tint 0 · saturation 1,10 · contrast 1,10 ·
  bloom 0,30 (Schwelle 2,4) · rays 0,5 · Schatten leicht kühl, Lichter leicht warm · Vignette 0,20.

### Akt 2 – Wildwald (`wild`)
- **Stimmung:** goldene Stunde, tiefe Sonne durch Dunst, dichtes, uraltes Grün, geheimnisvoll.
- **HDRI:** `kloppenheim_06_puresky` (tiefe Sonne), Licht 30°, Sonne `(1.0, 0.72, 0.46)`, Stärke 3,3.
- **Palette:** Tannengrün `#2f4a2a`, Farn `#5f8a3c`, Bernstein `#e09a40`, Rinde `#5a3a24`, Glühwürmchen `#c8ff6a`.
- **Nebel:** 0,0016, grünlich-warm, Höhennebel 1,25 (dichter Bodendunst).
- **Vegetation:** Tönung `(0.82, 1.08, 0.86)` – kühleres, tieferes Grün; Boden `(0.85, 1.02, 0.85)`.
- **Grading:** exposure 0,98 · temperature 0,22 · tint −0,05 · saturation 1,16 · contrast 1,12 · bloom 0,34
  (Schwelle 2,2) · rays 0,65 (Lichtstrahlen durch Kronen) · Vignette 0,24.

### Akt 3 – Eisen- & Wüstenschmiede (`forge`)
- **Stimmung:** heißer, staubiger Spätnachmittag, Hitzeflimmern, Schmiedeglut, Industrie im Sand.
- **HDRI:** `qwantani_late_afternoon_puresky`, orange getönt `(1.18, 0.86, 0.60)`, Sättigung 0,9; Licht 34°,
  Sonne `(1.0, 0.66, 0.40)`, Stärke 3,8.
- **Palette:** Sand `#c8a070`, Rost `#9a4a2a`, Kupfer `#c2763a`, Stahl `#6a7482`, Glut `#ff7a2a`, Äther-Blau `#40e6ff` als Kontrast.
- **Nebel:** 0,0019, ocker `(1.12, 0.92, 0.74)` – Staubdunst.
- **Vegetation:** verdorrt, Tönung `(1.25, 0.92, 0.55)`; Fels rötlich `(1.12, 0.90, 0.76)`.
- **Grading:** exposure 1,02 · temperature 0,42 · tint 0,04 · saturation 0,98 · contrast 1,16 · bloom 0,38
  (Schwelle 2,0) · rays 0,7 · Vignette 0,26.

### Akt 4 – Abgrund / Schattenwelt (`abyss`)
- **Stimmung:** kaltes Zwielicht, violetter Schleier, bedrohlich still, Magie als einzige warme Lichtquelle.
- **HDRI:** `qwantani_late_afternoon_puresky`, stark violett getönt `(0.62, 0.42, 1.0)`, Sättigung 0,55,
  Helligkeit ×0,5; Licht 32°, Sonne `(0.72, 0.62, 1.0)`, Stärke 2,6.
- **Palette:** Nachtviolett `#2c2440`, Schattenblau `#1a1f3a`, Blutviolett `#6a1f52`, Aschgrau `#5a5868`, Riss-Leuchten `#c06bff`.
- **Nebel:** 0,0021, violett `(0.70, 0.55, 1.05)`, Höhennebel 1,5 (der Abgrund „atmet“ von unten).
- **Vegetation:** entsättigt kalt `(0.62, 0.66, 0.95)`.
- **Grading:** exposure 0,95 · temperature −0,30 · tint 0,28 · saturation 0,92 · contrast 1,20 · bloom 0,48
  (Schwelle 1,8 – Magie glüht stärker) · rays 0,55 · Vignette 0,30.

## 5. Licht-Regeln

- **Sonne:** einzige schattenwerfende Lichtquelle, Höhe 30–40° (lesbare, nicht zu lange Schatten auf den Bahnen).
- **Himmelslicht:** bildbasiert (PMREM aus Himmel + HDRI), Intensität 0,5–0,6; Hemisphäre nur als Füllung (≤ 0,35).
- **Gegenlicht:** kühles Randlicht von der sonnenabgewandten Seite (0,2–0,4) trennt Silhouetten vom Boden.
- **Effektlichter:** keine dynamischen Punktlichter auf Bahnen (Leistung) – Glühen über Emission + Bloom.
- **Umgebungsverdeckung:** GTAO ab „Hoch“, Kontaktschatten an Bordsteinen über Vertex-AO.

## 6. VFX-Sprache

| Kategorie | Form | Farbe | Dauer/Bewegung |
|---|---|---|---|
| Treffer (physisch) | Funken-Kegel, kurze Splitter | Weißgelb `#fff2c0` | 0,15–0,3 s, schnell nach außen |
| Magie | Ringe, Glyphen, Spiralen | Fraktions-Glühfarbe | weich ein-/ausblenden, 0,4–1 s |
| Heilung | aufsteigende Partikel, Kreuz-Glyphe | Grün-Gold `#9cff6a`/`#ffd27a` | langsam steigend |
| Gift/Schwarm | Wolken, Tropfen | Säuregrün `#b8ff3a` | wabernd, am Boden bleibend |
| Feuer/Glut | Flammenzungen, Funkenflug | `#ffaa3a` → `#ff4a1a` | flackernd, nach oben |
| Schatten/Abgrund | Rauchfäden, Risse | `#c06bff` mit dunklem Kern | zieht nach innen (implodierend) |
| Gefahr/Telegraph | gefüllte Bodenfläche mit Rand | `#ff4a2a` | füllt sich bis zum Auslösen, dann Blitz |
| Tod | Zerfall in Partikel + Bodenfleck | Fraktions-Primär, entsättigt | 0,6 s |

Regeln: Effekte bleiben in ihrem Wirkradius · keine Vollbild-Blitze außer König getroffen (`engine.hitFlash`) ·
HDR-Intensität: normale Effekte 1,5–3, Boss/Ultimate bis 6 · in der Heldenkamera Partikel weicher (Distanz-Ausblendung).

## 7. Qualitätsstufen (Zielwerte)

| Stufe | Pixel | Schatten | AO | Gras (Anteil / Ausblenddistanz) | Zielhardware |
|---|---|---|---|---|---|
| Niedrig | 0,75× | aus | aus | 30 % / 85 m | integrierte Intel-GPU, Software |
| Mittel | 1× | 2048 | aus | 50 % / 120 m | Iris Xe, Radeon APU, Apple M1 |
| Hoch | ≤ 1,25× | 2048 | GTAO ½ | 70 % / 150 m | GTX 1060 – RTX 3060 |
| Ultra | ≤ 2× | 4096 | GTAO voll | 100 % / 260 m | RTX 3080+, RX 6800+ |

Die Stufe wird beim ersten Start automatisch gewählt (GPU-Name + Laufzeit-Messung), solange der Spieler
sie nicht selbst einstellt (`qualityAuto` in den Einstellungen).

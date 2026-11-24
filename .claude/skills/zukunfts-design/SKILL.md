---
name: zukunfts-design
description: AUTOMATISCH laden – ohne dass Tiry es sagen muss – sobald irgendetwas Visuelles entsteht oder geändert wird – Website, App, Spiel, Oberfläche, Dashboard, Artifact, Programm-UI, Flyer, Poster, Präsentation, Social-Media-Grafik, Logo, Icon, Video-Look, Farbschema, CSS, HTML, Komponente. Verbietet den KI-Einheitslook (Glaspillen, Verlauf-Blobs, Kachelraster, zentrierter Hero) und erzwingt Zukunfts-Design (20 Jahre voraus) mit allen verfügbaren Design-Skills, Plugins und Werkzeugen.
---

# Zukunfts-Design (Tiry-Standard)

Tiry will kein "modern 2026". Er will Design, das aussieht, als käme es **20 Jahre aus der Zukunft**.
Alles, was eine KI standardmäßig ausspuckt, ist per Definition **veraltet**, weil es jeder schon gesehen hat.

## Regel 0 – Der Milliarden-Test
Vor dem ersten Code fragen: **"Würde eine beliebige KI für einen beliebigen Nutzer genau das bauen?"**
Wenn ja → verwerfen und neu denken. Erste Idee ist fast immer Durchschnitt.

## VERBOTEN (der KI-Einheitslook)
- Glas-Karten / `backdrop-filter`-Pillen als Hauptstilmittel
- Lila-Pink-Blau-Verläufe, Verlauf-Blobs im Hintergrund, "weiche Glows" überall
- Karten-Raster (3 Kacheln nebeneinander), Kasten-in-Kasten, Icon + Überschrift + 2 Zeilen Text
- Zentrierter Hero mit Überschrift, Untertitel, zwei Buttons
- Emojis als Icons, Standard-Icon-Sets ohne Anpassung
- Systemschrift/Inter in einer Größe, gleichmäßige Abstände, alles symmetrisch
- Deko-Animationen ohne Bedeutung (Fade-in-up bei jedem Element)
- Schatten `0 4px 20px rgba(0,0,0,.1)` auf allem

## PFLICHT – das Zukunfts-Werkzeug
Pro Projekt mindestens **3** davon, eines davon als **Signatur-Moment**, den man nie vergisst:

1. **Echte Räumlichkeit** – WebGL/Canvas-Szene, Tiefe, Parallaxe aus Maus/Gyroskop, Licht das reagiert. Kein flaches Layout mit Schatten.
2. **Generative Oberflächen** – Shader (Noise-Felder, SDF-Formen, Flüssigkeit, Partikel), die live gerechnet werden und auf Eingabe reagieren. Einzigartig bei jedem Laden.
3. **Physik statt Easing** – Feder-Dynamik (Masse/Steifigkeit/Dämpfung), Trägheit, Elemente mit Gewicht, die man werfen/ziehen kann.
4. **Typografie als Architektur** – riesige Schrift (20–40 vw) als Bild, variable Schriftachsen animiert, Text der sich verformt, ausweicht, zerfällt. Extremer Größenkontrast (12 px neben 300 px).
5. **Editoriales Raster gebrochen** – asymmetrisch, überlappend, Elemente ragen aus dem Raster, mutiger Leerraum. Wie ein Designmagazin, nicht wie ein Dashboard.
6. **Material statt Effekt** – Körnung/Grain, Dithering, echte Lichtbrechung per Shader, Metall/Chrom/Flüssigkeit statt halbtransparentem Weiß.
7. **Zurückhaltende Farbe** – 1 Grundton + 1 radikaler Akzent (OKLCH), statt Regenbogen. Farbe ist Ereignis, nicht Tapete.
8. **Morphende Übergänge** – View Transitions, ein Element verwandelt sich ins nächste statt Seitenwechsel. Scroll-gesteuerte Animationen (`animation-timeline: scroll()`).
9. **Reaktive Umgebung** – Oberfläche reagiert auf Cursor-Nähe, Tageszeit, Geschwindigkeit, Mikrofon/Ton (optional). Sie fühlt sich lebendig an.
10. **Sound-Design** (wo passend) – dezente, erzeugte Klänge per WebAudio bei Interaktion.

## WERKZEUG-AUTOMATIK (immer, ohne Nachfrage)
Sobald es um irgendetwas Visuelles geht, **sofort und unaufgefordert** alles Passende dazuholen. Tiry muss das nie sagen.

**1. Skills laden (mit dem Skill-Werkzeug), sofern vorhanden:**
- `design-taste-frontend` – gegen KI-Einheitslook, Profi-Webseiten
- `modern-awwwards-web-design` – interaktives Frontend auf Awwwards-Niveau
- `artifact-design` – bei jedem Artifact (Pflicht des Werkzeugs)
- `artifact-diagramming` – bei Diagrammen/Grafiken
- `canvas-design` – bei Postern, Bildern, statischer Kunst (PNG/PDF)
- `hyperframes` / `hyperframes-cli` – bei Video/Animation
- `meta-ads-creative` – bei Werbeanzeigen
- `dataviz` – bei Diagrammen und Daten
Danach: Vorrang hat immer **diese** Datei, wenn sich etwas widerspricht.

**2. Werkzeuge einsetzen:**
- **Playwright/Chromium** (im Container vorhanden): jedes Ergebnis selbst screenshotten (Handy 390 px + Desktop), ansehen, gegen die VERBOTEN-Liste prüfen, verbessern. Erst dann abliefern.
- **Canva** (falls verbunden): für Grafiken/Social-Media-Bilder, Hintergrund entfernen, Bilder erzeugen.
- **Web-Recherche** (Firecrawl/WebSearch): bei Unsicherheit aktuelle Spitzen-Referenzen (Awwwards Site of the Day, aktuelle Shader-/WebGPU-Techniken) nachschlagen – als Anregung, nie kopieren.
- **Bibliotheken** (nur wenn das Projekt externe Skripte erlaubt, exakte Version): three.js, ogl oder WebGPU für 3D/Shader; GSAP für Zeitachsen; Lenis für weiches Scrollen. In Offline-/Eine-Datei-Projekten: alles selbst inline schreiben (WebGL-Shader in ca. 60 Zeilen).

**3. Falls ein Skill/Plugin fehlt:** weitermachen mit den Regeln hier und Tiry in einem Satz sagen, welcher Skill/welches Plugin es noch besser machen würde.

## Technik-Niveau „over 9.000“
Pro Projekt mindestens **eine** echte Technik-Show, die man nicht mit Baukasten-CSS hinbekommt:
- eigener **GLSL-Shader** (Flüssigkeit, Noise, Lichtbrechung, Metaballs) – reagiert auf Finger/Maus
- **3D-Szene** mit echtem Licht und Materialien (WebGL/WebGPU)
- **Partikelsystem** oder Physik-Simulation (Federn, Kollision, Flocking)
- **Text-Physik**: Buchstaben als Körper, die man anstoßen kann
- **Scroll-Choreografie**: eine durchgehende Szene, die sich beim Scrollen verwandelt
- **View-Transition-Morphs** zwischen Ansichten
Immer mit Rückfall (ohne WebGL / reduzierte Bewegung) und 60 fps.

## Ablauf (immer)
1. **Konzept-Satz zuerst:** Eine Metapher/Welt in einem Satz (z. B. "Die Werkstatt als schwebendes Metall-Objekt im Dunkeln, das man drehen kann"). Kein Konzept = kein Code.
2. **Signatur-Moment festlegen:** Was zeigt man jemandem auf dem Handy und sagt "schau mal"?
3. **Werkzeug-Automatik ausführen** (Skills laden, Werkzeuge bereitstellen).
4. **Bauen.** Technik modern: CSS `@property`, `oklch()`, Container Queries, `:has()`, View Transitions, WebGL ohne Bibliothek oder mit erlaubter CDN-Version.
5. **Screenshot machen und hart prüfen** gegen die VERBOTEN-Liste und den Milliarden-Test. Ein Treffer → überarbeiten, nicht abliefern.
6. Tiry in **einem Satz** sagen, was das Signatur-Moment ist.

## Grenzen, die trotzdem gelten
- Lesbarkeit: Kontrast Text ≥ 4.5:1, Tipp-Flächen ≥ 44 px, kein horizontales Scrollen.
- `prefers-reduced-motion`: Bewegung stark reduzieren, aber Design bleibt besonders.
- Leistung: 60 fps auf Mittelklasse-Handy; Shader mit Auflösungsfaktor und Pause im Hintergrund-Tab.
- Projekt-Vorgaben (Velocenter: keine Personen/Gesichter) gehen vor.

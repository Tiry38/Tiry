# Aetherfront

3D-Lane-Defense-Strategiespiel für Windows (Team-Tower-Wars-Genre): Zwei Teams verteidigen je einen König,
jeder Spieler baut Kämpfer auf seiner eigenen Bahn, schickt Söldner zum Gegner und baut seine Wirtschaft auf.
Eigene Welt, eigene Fraktionen und Figuren – Modelle und Effekte werden im Programm erzeugt; Texturen, Himmel, Musik und
Geräusche sind gemeinfreie CC0-Aufnahmen (Quellen in `web/assets/LICENSES.md`), keine Markennamen oder fremden Figuren.

## Spielen

| Was | Befehl (im Ordner `aetherfront/`) |
| --- | --- |
| Abhängigkeiten installieren | `npm install` |
| Spiel starten (Windows-Fenster) | `npm start` |
| Im Browser spielen | `npm run web` → http://localhost:5180 |
| Windows-Installer bauen | `npm run dist` → `dist/Aetherfront-Setup-*.exe` |
| Tests (Regeln, Determinismus, Online-Sync) | `npm test` |
| Rauchtest mit Screenshots | `npm run smoke` (Playwright) |
| Echte CC0-Texturen/HDRIs laden | `node scripts/fetch-assets.mjs` → `web/assets/` (Lizenzen: `web/assets/LICENSES.md`, Art Bible: `docs/ART-BIBLE.md`) |
| Mehrspieler-Server (Vorschau) | `npm run server` (Port 7710) |

Fertige Installer baut GitHub Actions bei jeder Änderung (`.github/workflows/aetherfront-windows.yml`, Artefakt
„Aetherfront-Windows-Installer“; auf `main` zusätzlich als Release).

## Spielablauf (an das Original-Spielprinzip angelehnt)

- **2 Teams** (West/Ost), 1 gegen 1 bis 4 gegen 4, freie Plätze spielen Bots (Leicht/Normal/Schwer).
- **Bauphase** (45 s vor Welle 1, sonst 32 s): Kämpfer auf das 6×8-Bauraster der eigenen Bahn setzen, aufwerten (3 Stufen), verkaufen.
- **Kampf**: Alle Bahnen werden gleichzeitig angegriffen. Kämpfer kämpfen automatisch und stehen nach der Welle geheilt wieder auf ihrem Platz.
- **Bauphase direkt nach dem Wellenende** – keine Zwangspause mehr zu Wellenbeginn.
- **Durchbrüche**: Gegner am Bahnende laufen über die Brücke (+60 % Tempo) zum König des Teams. Nach 70 s Raserei → alle stürmen zum König.
  **Kopfgeld-Abzug**: Wer in einer Welle durchlässt, bekommt für den Rest der Welle weniger Kopfgeld
  (−60 % × Anteil der durchgelassenen Gegner, höchstens −40 %); erledigt der König einen Durchbrecher, teilen sich die
  *übrigen* Mitspieler die Hälfte des Kopfgelds. (Ein Abfangen durch eigene Kämpfer in der Mitte gibt es nicht: Die Bahnen
  enden in Brücken zum König, Kämpfer bleiben auf ihrem Bauraster – die Mitte verteidigt der König mit seinen Fähigkeiten.)
- **Gold**: Kopfgeld pro Gegner + Einkommen nach jeder Welle. **Äther**: von Funken (Arbeitern) gesammelt –
  höchstens 16 Funken, **im 1 gegen 1 höchstens 10**; „Sammeln verbessern“ (N) +25 % je Stufe.
- **Söldner** (Äther): laufen mit der nächsten Welle in die Bahn des Gegners und erhöhen dauerhaft das Einkommen.
  12 Söldner in zwei Reihen: **Kaserne** (1–6) und **Erweiterte Kaserne** (⇧1–⇧6, für 150 Äther freischalten).
  Jeder Typ hat einen **Bestand** (1–3), der sich alle 6–30 s um eins auffüllt; Schattenkrabbler, Klingenraptor und
  Grollhund werden ab Welle 10/12/15 **ausgemustert**.
- **Arena nach Welle 10 und 20**: Kopien aller gebauten Kämpfer beider Teams kämpfen auf der Arena-Insel zwischen den
  Teams (5 s Aufstellung, höchstens 60 s, danach entscheidet der verbliebene Armeewert). Jeder Spieler des Siegerteams
  erhält **150 bzw. 300 Gold**, die Verlierer nichts. Die echten Kämpfer bleiben unverändert auf ihren Plätzen.
  Regel `arena` (in der Kampagne aus).
- **König**: Flächenangriff, Verbesserungen (Leben/Macht/Erneuerung) mit Äther, 3 Team-Heilungen (je 30 %, höchstens
  3000 Leben; Regel „Lang“ +2; verlässt ein Spieler die Partie, verliert sein Team eine Heilung).
  **Fähigkeiten** (Königshalle, je 3 Stufen, Äther, gelten fürs Team): **Stampfer** (F1, Fläche betäuben, 15 s),
  **Schockwelle** (F2, Linie), **Läuterung** (F3, entfernt Champion-Boni), **Feueraura** (dauerhaft Schaden um den König).
  Im 1 gegen 1 wirken Schaden und Betäubung der Fähigkeiten mit 45 % Stärke, weil der König dort nur eine Bahn schützt.
  Bots schalten sie frei und setzen sie ein.
- **30 Wellen**, Bosse auf 10/20/30. Sieg: gegnerischer König fällt – oder gesünderer König nach Welle 30.
  Danach (Endlos) die **Endwellen**: als „Endwelle n“ angezeigt, das ganze Feld wird gezeigt.
- **Übersichten**: **T** Aufwertungs-Übersicht (alle Linien, beide Pfade, Kosten der nächsten Stufen),
  **G** Wirtschaft (Einkommen, Äther/min, Kopfgeld-Faktor, Ausgaben/Einnahmen). Online im Menü: **Unentschieden
  vorschlagen** (alle Menschen müssen zustimmen).
- **Angriff vs. Rüstung**: 5 Angriffsarten × 5 Rüstungsarten (Tabelle im Kodex im Spiel).
- **4 Fraktionen** mit je 5 Kämpferlinien × 3 Stufen (60 Kämpfer), 7 Söldner, 30 Wellen mit eigenen Gegnertypen.

## Spielmodi (Gefecht & Online – der Host wählt)

| Kürzel | Modus | Regel |
| --- | --- | --- |
| AP | Alle wählen | Jeder wählt seine Fraktion (Zufall = Bonusgold) |
| AR | Alle zufällig | Zufällige Fraktion für alle, mit Bonusgold |
| PR | Zufall mit Neu-Würfeln | Zufällige Fraktion + Bonusgold, in der ersten Bauphase einmal neu würfeln |
| HP | Hybrid | 5 zufällige Kämpferlinien aus allen Fraktionen gemischt |
| +CC | Champions | Jeder 4. Gegner ist ein Champion (3× Leben, 3× Kopfgeld); Bosse werden Champions (+25 % Leben, +25 % Schaden, +2 Rüstung) – die Läuterung des Königs entfernt das |

Kombinierbar, z. B. **PRCC** oder **HPCC**. Dazu: Teamgröße 1v1–4v4, 10/20/30 Wellen, Bots für leere Plätze,
Bot-Stärke (Leicht/Normal/Schwer/Extrem) getrennt für Verbündete und Gegner, **Regeln** Normal/Schnell/Lang/Hart/
Gespiegelt/Zufall und **Endlos** (Endwellen, bis ein König fällt).

Feste Draufsicht, keine spielbaren Helden. Steuerung: Kämpfer bauen mit **Q W E R A S D F**, ausgewählten Kämpfer
aufwerten mit **C / V** (die Auswahlkarte zeigt beide Pfade mit Wertevergleich), Söldner **1–6** / **⇧1–⇧6**,
König-Fähigkeiten **F1–F3**, Funke **B**, Sammeln **N**, Königshalle **K**, Heilen **H**, Übersichten **T** / **G**.

## Solo-Kampagne „Chronik des Risses“

24 Missionen in 4 Akten – jede mit einer eigenen Mechanik (Funken anklicken, Leuchtfeuer, Käfige, Treueschwur,
Rammböcke, Ventile, Pakte, Risskerne …; Übersicht in `docs/KAMPAGNE.md`). Missions-Aktionen sind Befehle über
`applyCommand` und damit deterministisch. Du hältst deine Bahn wie gewohnt – aber deine **Söldner** schicken sich nicht zu einem
Mitspieler, sondern stürmen über die Brücke die **Rissfeste** des Rissfürsten Vael’Thar (Rammstoß + Angriff) und
erhöhen dabei dein Einkommen. Missionsziele: **Belagerung** (Feste zerstören, bevor die letzte Welle vorbei ist)
oder **Halten** (alle Wellen überstehen). Der Rissfürst schickt eigene Söldner, Missionen haben Modifikatoren
(Eisenhaut, Champions, enge Schlucht, nur Stufe II, Zeitdruck …). Bis zu 3 Sterne je Mission, Sterne schalten
8 Talente frei, jeder Akt schaltet eine neue Fraktion frei. 3 Schwierigkeitsgrade.

## Technik

- `src/sim/` – deterministische Simulation (20 Ticks/s, eigener Zufallsgenerator, Prüfsumme). Bots laufen in der Simulation.
- `src/net/session.js` – `LocalSession` (Einzelspieler) und `NetSession` (Online-Lockstep).
- `server/relay-server.js` – Relay-Server: Räume, Lobby, Tick-Stempel, Desync-Erkennung. Er verteilt nur Befehle.
- `src/render/` – Three.js: PBR-Materialien, weiche Schatten, Bloom, Ambient Occlusion (Ultra), Farbgrading,
  GPU-Instancing (ein Draw-Call pro Modelltyp), Partikel, prozedurale Modelle (`models.js`) und Welt (`environment.js`).
- `src/audio/audio.js` – Audio-Engine (Web Audio): Orchester-Musik je Stimmung (Menü/Bau/Kampf/Boss/Arena/Sieg/Niederlage) mit Überblendung und Ducking, geschichtete Kampfgeräusche mit Varianten, Stimmenlimit, Entfernungsfilter, Kompressor/Limiter. Aufnahmen (CC0) in `web/assets/audio/`, Quellen in `web/assets/LICENSES.md`, Sprite-Positionen in `src/audio/audio-manifest.js`.
- `src/ui/` – Menüs, HUD, Einstellungen (gespeichert). `electron/` – Windows-Hülle.

## Online mit Freunden

Mehrspieler-Lobby: **Spiel hosten** startet den Relay-Server direkt auf dem PC (Windows-Version), Räume per Code oder
öffentlicher Liste, Schnellsuche, Plätze (Mensch/Bot mit Stärke/geschlossen), Host-Einstellungen (Modus PR/AP/AR/HP + CC,
Regeln, Endlos, Wellen, Bots, Ausgleich), Chat, Einladung kopieren. Im Spiel: Chat mit ↵ (`/t` = Team), Markierung mit
Alt + Klick, Pausenabstimmung im Menü, automatisches Wiederverbinden.

Sammlung (Hauptmenü): Profil-Stufe und Titel, Völker-Meisterschaft mit Bannern, Aufwertungs-Bäume, Erfolge,
tägliche/wöchentliche Herausforderungen, Endlos-Bestenliste – jede Partie zählt.

### Technik dahinter

Die Architektur ist fertig für Online-Partien: Jede Aktion ist ein Befehl, alle Clients rechnen dieselbe Simulation
(Lockstep), der Server stempelt Befehle auf Ticks und vergleicht Prüfsummen. Der Test `test/net.test.mjs` spielt eine
Partie mit zwei Clients über den echten Server und prüft, dass beide identisch bleiben.
Für Spielen über das Internet braucht es einen erreichbaren Server (Portweiterleitung am Host-PC oder ein kleiner VPS,
siehe `SERVER-EINRICHTEN.md`).

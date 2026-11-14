# Aetherfront

3D-Lane-Defense-Strategiespiel für Windows (Team-Tower-Wars-Genre): Zwei Teams verteidigen je einen König,
jeder Spieler baut Kämpfer auf seiner eigenen Bahn, schickt Söldner zum Gegner und baut seine Wirtschaft auf.
Eigene Welt, eigene Fraktionen und Figuren – alle Grafiken, Modelle, Musik und Effekte werden im Programm erzeugt
(keine fremden Assets).

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
- **Durchbrüche**: Gegner am Bahnende laufen zum König des Teams. Nach 70 s Raserei → alle stürmen zum König.
- **Gold**: Kopfgeld pro Gegner + Einkommen nach jeder Welle. **Äther**: von Funken (Arbeitern) gesammelt.
- **Söldner** (Äther): laufen mit der nächsten Welle in die Bahn des Gegners und erhöhen dauerhaft das Einkommen.
- **König**: Flächenangriff, Verbesserungen (Leben/Macht/Erneuerung) mit Äther, 3 Team-Heilungen.
- **30 Wellen**, Bosse auf 10/20/30. Sieg: gegnerischer König fällt – oder gesünderer König nach Welle 30.
- **Angriff vs. Rüstung**: 5 Angriffsarten × 5 Rüstungsarten (Tabelle im Kodex im Spiel).
- **4 Fraktionen** mit je 5 Kämpferlinien × 3 Stufen (60 Kämpfer), 7 Söldner, 30 Wellen mit eigenen Gegnertypen.

## Spielmodi (Gefecht & Online – der Host wählt)

| Kürzel | Modus | Regel |
| --- | --- | --- |
| AP | Alle wählen | Jeder wählt seine Fraktion (Zufall = Bonusgold) |
| AR | Alle zufällig | Zufällige Fraktion für alle, mit Bonusgold |
| PR | Zufall mit Neu-Würfeln | Zufällige Fraktion + Bonusgold, in der ersten Bauphase einmal neu würfeln |
| HP | Hybrid | 5 zufällige Kämpferlinien aus allen Fraktionen gemischt |
| +CC | Champions | Jeder 4. Gegner ist ein Champion (3× Leben, 3× Kopfgeld), Bosse +25 % |

Kombinierbar, z. B. **PRCC** oder **HPCC**. Dazu: Teamgröße 1v1–4v4, 10/20/30 Wellen, Bots für leere Plätze,
Bot-Stärke getrennt für Verbündete und Gegner.

## Solo-Kampagne „Chronik des Risses“

15 Missionen in 4 Akten. Du hältst deine Bahn wie gewohnt – aber deine **Söldner** schicken sich nicht zu einem
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
- `src/audio/audio.js` – live synthetisierte Orchestermusik (Menü/Bau/Kampf/Boss/Sieg/Niederlage) und Effekte (Web Audio).
- `src/ui/` – Menüs, HUD, Einstellungen (gespeichert). `electron/` – Windows-Hülle.

## Online mit Freunden (Stand: vorbereitet)

Die Architektur ist fertig für Online-Partien: Jede Aktion ist ein Befehl, alle Clients rechnen dieselbe Simulation
(Lockstep), der Server stempelt Befehle auf Ticks und vergleicht Prüfsummen. Der Test `test/net.test.mjs` spielt eine
Partie mit zwei Clients über den echten Server und prüft, dass beide identisch bleiben.
Für echtes Spielen über das Internet fehlen noch: ein öffentlich erreichbarer Server (z. B. kleiner VPS),
Wiederverbinden nach Abbruch, Chat-Oberfläche und eine polierte Lobby.

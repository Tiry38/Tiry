# Übergabe – Stand 09.11.2026

Diese Arbeit lief bisher in einer Cloud-Sitzung, die am Repository Velocenter-Planer hing. Ab jetzt geht es
in Sitzungen auf **Tiry38/Tiry** weiter. Alle Dateien liegen in diesem Ordner, Projektleitfaden: `CLAUDE.md`.

## Add-ons – Stand

| Add-on | Version | Zweck | Stand |
|---|---|---|---|
| **LevelPilot** | 4.0.0 | Levelrouten Horde 22–30, Pfeil, Lichtstrahl, Auto-Quests, XP-Cockpit, Flug/Ruhestein-Rat | ausgeliefert, **Spieltest offen** |
| **ProcAlarm** | 2.0.0 | Hexer: Schattentrance (17941) → Alarm über Blizzard-Aura-Slot (zeigt sich auch im Kampf) + Spiel-Ton `AddAuraSound` | ausgeliefert, **Kampftest offen** |
| **EnhanceHUD** | 1.2.0 | Verstärker-Schamanen-HUD (Frost/Feuer-Design) | ausgeliefert |
| **Blitzschild** | 1.2.0 | Blitzschlagschild Ladungen/Zeit | im Kampf nicht möglich (secret values) → Cooldown-Manager „Verfolgte Leisten“ + WA nur außerhalb des Kampfes |
| **MiniPost** | – | Post-Symbol unter der Uhr, andere Minimap-Knöpfe unsichtbar | ausgeliefert, Test offen |
| **ChatHoch** | 1.4.0 | Chat höher, Reiter bündig (ClampRectInsets von ChatFrame1) | ausgeliefert; Tiry hatte noch 1.3.0 geladen |

## LevelPilot 4.0 – was zuletzt gebaut wurde (09.11.)
Tirys Auftrag: „überarbeite das ganze Add-on in allen Bereichen – Funktionen, Sinn, Logik, Übersichtlichkeit,
Design, Netzpunkte, Schnelligkeits-Logik, Verfolgungs-Logik, keine Dauer-Sounds, Strahl wie Waypoint UI, epischer
Amboss-/Schloss-Sound (max. 1–2 s)“.

- **Route.lua (Engine 4):** Zwischenspeicher pro Durchlauf; Questlog-Erkennung fünffach (eigenes Gedächtnis
  `qmem`, Logliste über zwei APIs, `GetLogIndexForQuestID`, `IsOnQuest`, eindeutiger Questname) + Abgleich, wenn
  das Log vollständig gelesen wurde; **stabile Schritt-Schlüssel** (`StepKey`) statt Nummern; Reise-Schritte gelten
  als erledigt, sobald im Abschnitt schon etwas angenommen/abgegeben wurde; Live-Auswahl mit **Hysterese**
  (Wechsel nur bei ≥ 40 m bzw. 25 % besser); „Erledigen“-Ziel = **Mitte der nächsten Gegnergruppe** aus Questie,
  erfüllte Ziel-Arten fallen weg; Wegenetz mit Glättung, im Gelände nur ≤ 20 % Umweg.
- **LevelPilot.lua:** Auto-Annehmen **nur Routen-Quests** (Hinweis im Chat sonst); Liste gruppiert gleiche NPC-
  Aufgaben („2 QUESTS ANNEHMEN“), „Nebenbei“-Hinweis, Entfernung je Zeile, Gehzeit; Fenster im Kampf dezent;
  neuer Strahl (Säule wächst mit der Nähe, Symbol im Leuchtring, Pinpoint nah, Navigator am Rand); Ton-Regeln:
  nur bei neuem Ziel, nie im Kampf/Flug, Ruhe nach Kampf/Landung/Laden, je Ziel einmal, ≥ 4 s Abstand.
- **Fly.lua:** Fliegen gegen Laufen (Flugpunkte aus `C_TaxiMap`, bekannte Punkte gemerkt, Flug am Flugmeister
  automatisch), **Ruhestein-Rat** (gebundener Ort ≈ gleichnamiger Flugpunkt).
- **Sounds:** `Media/beam.ogg` (Amboss, 1,5 s), `lock.ogg` (Schloss), `arrive.ogg`; Generator `tools/snd2.py`.
- **Texturen:** Strahl `wb_*`, Symbolring `ctx_*`; Generator `tools/beam2.py`.
- Befehle: `/lp` (Liste), u. a. `weiter`, `zurueck`, `neu`, `speed`, `gruen`, `flug`, `ton`, `kampf`, `strahl`,
  `marker`, `wege`, `punkt`, `export/import`, `entsperren`; `/way x y Titel`.

### Bekannte Unsicherheiten (nur im Spiel prüfbar)
- Ob Forever `C_TaxiMap.GetTaxiNodesForMap`, Item-Abklingzeit (Ruhestein 6948) und `GetBindLocation` freigibt.
- Flug-/Ruhestein-Zeiten sind Schätzungen (Flug ~30 Yards/s, 20 s Nebenzeit).
- Questbewertung (`qual.py`) ist eine Schätzung – die DB hat keine XP-Werte und keine Dropchancen.
- ProcAlarm 2.0: ob Forever die eigenen Animationen/Restzeit am Aura-Slot annimmt (`/proc diag` → „Teile“).

## Nächste Schritte
1. Tirys Spieltest-Rückmeldung zu LevelPilot 4.0 abwarten und gezielt nachbessern.
2. **Routen 30–40, 40–50, 50–60** mit derselben Werkzeugkette (Konsens + Qualitätsfilter + Generator + Prüfung).
3. ProcAlarm nach `/proc diag`-Screenshot anpassen; ChatHoch 1.4.0 / MiniPost-Rückmeldung.

## Verlauf der wichtigsten Rückmeldungen (Kurzfassung)
- Strahl alt = „Kindergrafik“, Sound alt = „wie Kirby, der Luft einsaugt“ → beides neu (4.0).
- Route schickte zu Orten, an denen er schon war / zu Quests, die er schon hatte → Engine 4.
- „Kackquests“ → Qualitätsfilter + Auto-Annehmen nur Routen-Quests + Rechtsklick sperrt eine Quest dauerhaft.
- Wunsch: Strahl hinter Gegenständen → technisch nicht möglich (so mitgeteilt); umgesetzt: Punkt immer sichtbar,
  Strahl wächst mit der Nähe.

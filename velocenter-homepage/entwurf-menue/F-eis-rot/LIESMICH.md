# Vorlage „Eis & Rot“ mit Menü F (15.11.2026, nicht live)

Gewählt von Tiry aus den 5 Hintergründen (Nr. 3), überarbeitet:
- Grund: gebürstetes Eis-Silber (Stil Variante 5 „Stahl“, heller), weiße Waben, Striche bleiben.
- Striche (15.11.2026, Tiry): Vektor-Flächen per clip-path (gestochen scharf, kein Treppeneffekt), feste Ebene `.strk` am body. Grau = Logo-Grau #868282, Rot = Logo-Rot #CF1A2C, kein Rot-Schimmer. Kopfbereich ausmaskiert (Logo hängt nie im Strich); Startseite: linker Strich zwischen Logo und Showroom, am Handy aus.
- Glasband vor dem Rot: deckend (kein backdrop-filter, sonst rosa Schimmer), Kante zum Rot 3 px Logo-Grau.
- i:SY Experte: Kopfzeile als Perlglas-Leiste mit Verlaufs-Haarlinie über dem Foto.
- Eine flächige Rot-Lasur auf Eis wird rosa, deshalb gibt es keine.
- Rote Ebene oben rechts (`er.js` legt `.erl` in `main`): Glasklinge vorne, Rot mit weißer Lichtkante und Schatten dahinter, scrollt mit.
- Showroom-Kreis ist eine deckende Glas-Bühne vor dem Rot: Das Rot läuft dahinter, nie durch den Kreis. Die Animation bleibt.
- Karten über dem Rot sind deckend.

Bauen: `python3 tools/live_bauen.py <tmp>`, dann `python3 inject.py <tmp>`.

## Rote Fläche – 5 Varianten (15.11.2026)
Umschalter unten mittig (Tasten 1–5), Datei `rv.css` + `rv.js`:
1. **Carbon** – Köper-Gewebe als Struktur, Lichtstreif läuft langsam darüber.
2. **Facetten** – scharfe Dreiecks-Facetten (SVG), Licht von oben rechts.
3. **Info-Kante** – Lauftext entlang der Schnittkante: live geöffnet/geschlossen (Europe/Berlin), Bosch Service Center, 4,8 bei Google · 221 Rezensionen, 300+ E-Bikes, Adresse, Telefon.
4. **Kennzahlen** – 300+ · 4,8 ★ · 1995 rechts im Rot (nicht auf der Startseite, dort steht die Showroom-Scheibe).
5. **Laden-Foto** – echtes Ladenfoto (`laden-innen.webp`) als dunkles Rot-Duoton.
Am Handy: Info-Varianten (3, 4) aus, Strukturen bleiben.

## Rote Fläche – 10 weitere Varianten (15.11.2026)
Umschalter unten mittig mit Gruppen „Runde 1“ (1–5) und „Neu“ (6–15), Pfeiltasten blättern, gemerkt in `localStorage.rv2`.
Dateien `rv2.css` + `rv2.js` + `switch2.css` (der alte Umschalter aus `rv.js` ist abgeschaltet, `rv.js` liefert nur noch `window.erStat`).
6. **Eloxiert** – gebürstetes Alu-Rot (feine lange Schliffspuren + Lichtkante).
7. **Riffelblech** – Werkstatt-Trittblech als Relief.
8. **Reifenprofil** – Stollenprofil mit Lamellen als Relief.
9. **Pyramiden** – kleine Pyramiden-Prägung, Licht von oben links.
10. **Riffelglas** – Glasrippen schräg zur Kante.
11. **Logo-Prägung** – Velocenter-Logo groß als Prägung im Rot.
12. **Technik-Zeichnung** – Raster + Rahmengeometrie-Linien wie eine Konstruktionszeichnung.
13. **Marken** – die 8 Hauptmarken-Logos weiß im Rot.
14. **Kundenstimme** – echte Google-Zitate der Seite (`#qs .q`) wechseln alle 6,5 s, dazu 4,8 ★ · 221 Rezensionen.
15. **Öffnungszeiten** – live „Jetzt geöffnet / Gerade geschlossen“, heutiger Tag hervorgehoben.
Info-Varianten 13–15: nicht auf der Startseite (Showroom) und nicht am Handy. Bekannt: Gudereit-Logo zeigt einfarbig weiß eine volle Scheibe (Emblem).

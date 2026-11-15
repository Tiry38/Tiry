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

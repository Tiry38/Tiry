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

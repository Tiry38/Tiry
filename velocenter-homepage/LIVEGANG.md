# Livegang www.velo-center.de

Stand 13.11.2026. Die Live-Fassung baut `python3 tools/live_bauen.py` aus dem Prototyp (`index.html`).
Der Prototyp bleibt unverändert, Änderungen immer dort machen und neu bauen.

## Schon erledigt (ohne Tiry)
- Bau-Skript `tools/live_bauen.py`: vollständiger HTML-Kopf, Google darf die Seite finden,
  Prototyp-Knopf, Seite „Prototyp-Infos“ und Admin-Zugang raus, nur benutzte Bilder (ca. 91 MB).
- Favicon, Apple-Symbol und Vorschaubild für WhatsApp/Facebook (`live/`).
- `CNAME` (www.velo-center.de), `robots.txt`, `sitemap.xml`, `404.html`.
- Weiterleitungen der alten Coco-Adressen: /service, /hersteller, /isy-experte, /isy-treffen,
  /e-dreiraeder, /kontakt, /impressum, /datenschutz, /velocenter, /blog, /legal/imprint,
  /legal/privacy, /legal/accessibility → passender Bereich der neuen Seite. Alles andere → Startseite.
- Datenschutzerklärung: Hosting (GitHub Pages) eingetragen, Video-Seiten korrigiert, Grammatik.
- Getestet: alle Bereiche am PC und Handy, keine Fehler, keine fehlenden Dateien, kein Überlauf.

## Braucht Tiry / Stefan
1. **Coco-Vertrag (Schlütersche):** Laufzeit und Kündigungsfrist. Erst nach dem Umzug kündigen.
   Klären, wem die Ladenfotos gehören.
2. **IONOS-Zugang:** Wer kann sich bei IONOS anmelden (Domain velo-center.de)? Passwörter nie an Claude.
3. **Datenschutzerklärung prüfen lassen** (Anwalt oder Generator wie eRecht24). Claude ist kein Rechtsberater.
4. **Herstellerbilder/Logos** über die Händlerportale freigeben lassen.
5. **Freigabe** für ein neues öffentliches GitHub-Repo nur für die Webseite (z. B. `Tiry38/velo-center-web`).
   GitHub Pages ist bei privaten Repos nur im Bezahl-Tarif möglich.

## Stand der Antworten (13.11.2026)
- Coco: laut Tiry vermutlich jederzeit kündbar – im Vertrag bestätigen. Fotorechte klären (wer hat fotografiert?).
- IONOS: Zugang hat Stefan. Umstellung macht Tiry im Laden mit Stefans Daten zusammen mit Claude (Claude sieht keine Passwörter).
- Datenschutz: Prüfung mit eRecht24.
- Web-Repo: Tiry hat zugestimmt. Anlegen muss Tiry selbst (GitHub → New repository → `velo-center-web`, Public, leer), dann pusht Claude.

## Ablauf am Umzugstag
1. Claude baut die Live-Fassung und legt sie ins neue Repo, GitHub Pages an (Branch `main`, Wurzel).
2. Testadresse prüfen: `https://tiry38.github.io/<repo>/` (ohne eigene Domain). Stefan schaut drüber.
3. In GitHub Pages die eigene Domain `www.velo-center.de` eintragen.
4. **IONOS → Domains → velo-center.de → DNS** (nur diese Einträge ändern):
   | Typ | Name | Wert |
   |---|---|---|
   | CNAME | www | `tiry38.github.io` |
   | A | @ | `185.199.108.153` |
   | A | @ | `185.199.109.153` |
   | A | @ | `185.199.110.153` |
   | A | @ | `185.199.111.153` |
   Die alten A-Einträge für `@` und `www` (heute `3.123.247.109`, Coco) löschen.
   **MX-Einträge (mx00/mx01.ionos.de) und TXT/SPF nicht anfassen – sonst gehen keine E-Mails mehr.**
5. Warten, bis die Umstellung durch ist (Minuten bis wenige Stunden). Dann in GitHub Pages „Enforce HTTPS“ einschalten.
6. Google Search Console: Domain bestätigen, `https://www.velo-center.de/sitemap.xml` einreichen.
7. Google-Unternehmensprofil: Website-Link prüfen.
8. Erst dann Coco kündigen.

## Bestand aktualisieren (nach dem Livegang)
`python3 tools/bestand_zu_json.py <Veloport-Export.csv>` → `python3 tools/live_bauen.py` → ins Web-Repo.

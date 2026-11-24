---
name: vdv-konfigurator-film
description: Baut Konfigurator-Erklärfilme für E-Bikes (z. B. VELO DE VILLE) im Dark-Mode-Showroom-Stil – Konfigurator live auslesen, Abhängigkeiten testen, freigestellte Renderings exportieren, deterministische HTML-Engine Frame für Frame in 4K/60 rendern, Sounddesign + Musik selbst erzeugen, optionale Google-TTS-Sprecherfassung, Schnittfassungen 60/30/15 s. Verwenden, wenn Tiry einen Produkt-, Konfigurator- oder Werkstattfilm will.
---

# Konfigurator-Film (Tiry-Standard)

Vorlage und Code: `vdv-film/` im Repo `Tiry38/Tiry` (Engine `engine.js`, Daten `data.js`, Werkzeuge `tools/`).

## Ablauf
1. **Live auslesen (Playwright):** Konfigurator öffnen, Cookie-Banner nur nach Tirys OK („Ablehnen“ = technisch notwendig).
   Alle `.question_container` mit `.answer-card-outer[title]` und Preisen in eine Faktentabelle. Optionen per `data-url`
   (fetch im Seitenkontext) setzen, danach Seite neu laden und Preis/Gewicht/sichtbare Gruppen lesen.
2. **Abhängigkeiten testen:** jede Wahl einzeln gegen die Basis diffen (verschwundene/neue Gruppen). Tiry-Regel:
   keine Pakete oder Teile wählen, die andere Komponenten sperren; Range Extender und Frontträger nur erklären.
3. **Renderings:** Konfigurator nutzt Konva → `Konva.stages[0].toDataURL({pixelRatio:4})` liefert pro Schritt ein
   transparentes PNG (3312×2032). Daraus Kontur-Bilder (Kanten) für den „Rad aus Licht“-Aufbau.
4. **Drehbuch:** pro Reiter ein Block: Headline ≤ 4 Wörter, „Was du hier einstellst“ (Kategorien), „Warum das zählt“
   (1 Satz Nutzen), dann sichtbarer Klick, Rad wechselt per Lichtkante, Kamera fährt aufs Bauteil, Preis zählt.
5. **Engine:** `seek(t)` ist reine Funktion der Zeit (Federn als überlagerte Sprungantworten, keine Simulation),
   daher parallel renderbar: `node tools/render.js main 1920 1080 2 60 <out> 3` (DPR 2 = 4K).
6. **Ton:** `tools/audio.py` (Musik 100 BPM + UI-Ticks, mechanische Klicks, Freilauf, Motorsummen, selbst erzeugt),
   `tools/tts.py` für die Sprecherfassung (Chirp3-HD, Proxy injiziert den Schlüssel).
7. **Export:** `tools/encode.sh` – H.264 (Loudnorm −14 LUFS), ProRes, SRT, Thumbnail, Standbilder.
8. **Prüfen:** Standbilder Desktop + Handy gegen `zukunfts-design` (Verbotsliste, Milliarden-Test, Kontrast ≥ 4.5:1),
   jeden Fakt gegen `FAKTEN.md`.

## Look
Dunkler Showroom (#121214), Grain, ein Akzent (VDV-Orange #FF6F00) als Ereignis, Sora/Outfit, riesige Kontur-Typo
hinter dem Rad, eigener Cursor mit Ripple + Klick-Zoom. Kennzeichnung „Konzeptfilm · keine offizielle Werbung“.
Keine Personen, keine Gesichter, Produktbilder gehören dem Hersteller (nicht in öffentliche Repos committen).

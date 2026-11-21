# AVOX – Startseite (Entwurf)

Öffnen: `index.html` über einen lokalen Server (z. B. `python3 -m http.server` in diesem Ordner), dann http://localhost:8000.

- Begrüßung beim Öffnen (einmal pro Sitzung, „Begrüßung nochmal ansehen“ im Fuß), Tageszeit-Stimme, synthetische Klangeffekte (Web Audio, nur nach Klick).
- Stromlinie: Canvas, reagiert über Web Audio auf die echte Stimme und biegt sich zum Mauszeiger (Lichtbogen); KI = Eisblau, Anrufer = warm.
- Live-Demo mit 4 Situationen und „Erkannt“-Karte, Umsatz-Rechner, Pilot-Formular (noch nicht angeschlossen).
- Hörprobe: echte neuronale Stimmen (Piper TTS, CC0), Quellen in `audio/QUELLEN.md`. Reiter per #start, #hoerprobe, #funktionen, #preise, #fragen.
- Schriften (alle SIL OFL 1.1, Lizenzen in `fonts/`): Manrope (Text/Headlines), Michroma (Marke, Zahlen), JetBrains Mono.
- Bewusst nur dunkel, `prefers-reduced-motion`, Tippflächen ≥ 44 px, keine externen Ressourcen, keine Tracker.

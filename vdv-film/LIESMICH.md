# AEB PRO MY2027 – Konfigurator-Film (Konzept-Pitch)

**Konzeptfilm, keine offizielle Werbung von VELO DE VILLE.** Nicht veröffentlichen, bevor VELO DE VILLE zugestimmt hat.
Marken- und Produktbilder gehören VELO DE VILLE. Die Renderings liegen deshalb nicht im Repo (`tools/hole-renderings.js` holt sie neu).

**Konzept:** Ein dunkler, schwebender Showroom. Das AEB PRO wird aus Licht zusammengesetzt, Reiter für Reiter.

**Signatur-Moment:** Die vier Bosch-Motoren steigen mit Feder-Physik aus der Tiefe, ein Lichtscan läuft darüber, das Drehmoment wächst als Typo-Skala (60 → 120 Nm). Nach dem Klick auf den CX morpht der Motor ins Tretlager, und das Rad baut sich von dort aus als Lichtkontur auf.

## Fassungen
| Datei | Format | Länge |
|---|---|---|
| `AEB-PRO-MY27_Hauptfassung_4K60.mp4` | 16:9, 3840×2160, 60 fps, ohne Sprecher | 3:21 |
| `AEB-PRO-MY27_Hauptfassung_Sprecher_4K60.mp4` | dito, mit Google-TTS-Stimme (Chirp3-HD Charon) | 3:21 |
| `AEB-PRO-MY27_Hauptfassung_ohneMusik_4K60.mp4` | dito, nur Soundeffekte | 3:21 |
| `AEB-PRO-MY27_60s_16x9.mp4` / `_1x1.mp4` | 1920×1080 bzw. 1080×1080, 60 fps: Basis + Farbe ausführlich, Fernlicht, Lichtfahrt für den Rest | 0:60 |
| `AEB-PRO-MY27_30s_9x16.mp4` | 1080×1920, 60 fps: Motor, Akku, Automatik, Riemen, Farbe, Lichtfahrt, Preis | 0:30 |
| `AEB-PRO-MY27_15s_9x16.mp4` | 1080×1920, 60 fps: Motor, Farbe, Lichtfahrt, Preis | 0:15 |
| `*_ohneMusik.mp4` | jede Fassung zusätzlich nur mit Soundeffekten | |
| `*_ProRes422LT.mov` | 15 s und 30 s als ProRes 422 LT | |
| `*.srt` | Text-Overlays bzw. Sprechertext als Untertitel | |

## Technik
- `index.html` + `engine.js` + `data.js`: deterministische Engine, `seek(t)` berechnet jedes Bild aus der Zeit.
  Federn = überlagerte Sprungantworten (Masse/Steifigkeit/Dämpfung), Kamera mit Parallaxe, Lichtkante beim Teilewechsel,
  Konva-Renderings aus dem echten Konfigurator, Dark-Mode-Nachbau mit allen 7 Reitern und Original-Optionen.
- `tools/render.js` rendert parallel (Playwright, DPR 2 = 4K), `tools/encode.sh` kodiert (H.264, −14 LUFS; ProRes optional).
- `tools/audio.py`: Musik und Sounddesign komplett selbst synthetisiert (keine Fremdlizenz nötig).
- `tools/tts.py`: Sprecherfassung über Google Text-to-Speech.
- Vorschau im Browser: `index.html?w=1920&h=1080&cut=main` (Schnitte: `main`, `c60`, `c30`, `c15`), dann `__film.seek(Sekunden)`.

Fakten: `FAKTEN.md` · Drehbuch: `DREHBUCH.md`

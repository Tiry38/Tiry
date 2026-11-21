# Stimmen-Labor (AIVOX + Luna)

Ziel: Stimmen, die so menschlich wie möglich klingen – gemeinsam für **AIVOX** (Telefon-KI) und **Luna/Jarvis** (persönliche Assistentin).

## Zwei Methoden im Duell
| | Methode A (Luna-Sitzung) | Methode B (AIVOX-Sitzung, dieser Ordner) |
|---|---|---|
| Technik | ElevenLabs v3 (Cloud), Audio-Tags wie [laughs] | Chatterbox Multilingual (MIT, lokal) + echte CC0-Referenzen |
| Kosten | Abo (Starter ca. 6 $/Monat) | 0 € |
| Ablage Duell | `stimmen-duell/A/` (Branch der Luna-Sitzung) | `stimmen-duell/B/` |

Testsätze T1–T5 stehen in `duell-saetze.json`. Bewertung: Messung (unten) **und** Blindtest durch Tiry – sein Ohr entscheidet.

## Messverfahren
- **Verständlichkeit:** faster-whisper (small) liest zurück, Vergleich mit Soll-Text (0–1).
- **Natürlichkeit:** DNSMOS (Microsoft, im Paket `speechmos`), Mittel aus OVRL und P808 (1–5).
- **Lebendigkeit:** Standardabweichung der Tonhöhe in Halbtönen (librosa pyin). Monotone KI-Stimmen liegen niedrig.

## Erkenntnisse bisher (gemessen)
- Piper: ≈ 2,8 Natürlichkeit – roboterhaft.
- Chatterbox mit **echten** Referenzaufnahmen: ≈ 3,5–3,8. Nie synthetische Stimmen als Referenz nehmen (Klang wird übernommen).
- Satzweises Zusammensetzen, Raumhall, Voice-Conversion: **keine Verbesserung**; VC erfindet teils Wörter.
- Aussprache: Zahlen als Wörter, „SMS“ → „Es-Em-Es“, Marken phonetisch („Ei-Wox“, „Tiri“).
- Mehrere Varianten je Zeile erzeugen und per Messung auswählen lohnt sich.

## Dateien
- `cbgen.py` – Varianten erzeugen (Chatterbox), `pick3.py` – beste Variante wählen, `post3.sh` – Kodierung
- `aivox_voice.py`, `aivox_master.sh` – Versuch „Engine“ (satzweise, Atem, Raum) – nicht besser, nur zur Doku
- `exp2.py` – Vergleich Referenzstile (neutral / amüsiert / gemischt) mit Lebendigkeit
- `ref/` – Referenzstimmen: Thorsten-Voice (CC0), MLS Sprecher 8769 (CC BY 4.0, Pratap et al. 2020)

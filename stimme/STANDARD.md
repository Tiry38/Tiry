# Stimmen-Standard für Luna und AIVOX

Gemeinsame Regeln beider Sitzungen (Luna: Branch `ccr-5a20bb04-mr0zu4`, AIVOX: Branch `claude/charming-volta-lz27vg`).
Stand: 21.11.2026. Luna: Textregeln implementiert in `luna-app/.../SpeechText.kt`. Grundsatz: **Was nicht gemessen oder von Tiry gehört wurde, gilt als ungeprüft.**

## 1. Motoren (Rangfolge)
| Rang | Motor | Einsatz | Kosten | Lizenz | Status |
|---|---|---|---|---|---|
| 1 | Kartoffel-Orpheus 3B (deutsch, natürliche Sprecher, Gefühle) – sobald gemessen gewonnen | AIVOX-Demo/Server, Luna über „Heim-Stimme“ (Stimmserver auf Tirys PC) | 0 € | Llama 3.2 Community, „Built with Llama“ | **im Test** (AIVOX-Sitzung) |
| – | ElevenLabs v4 | **nur optional/Altlast** – Tiry-Entscheid 21.11.2026: kein ElevenLabs | Abo | kommerziell | nicht genutzt |
| 2 | Chatterbox Multilingual + echte Referenz (aktueller Standard bis Rang 1 gewinnt) | lokal/offline | 0 € | MIT | gemessen, Natürlichkeit 3,5–3,8/5 |
| – | Piper, Handy-/Browser-Stimme | nur Notfall | 0 € | – | roboterhaft (≈ 2,8/5) – nicht verwenden |

## 2. ElevenLabs-Einstellungen (Luna, Doku geprüft, Klang ungeprüft)
Stimme „Sarah“ `EXAVITQu4vr4xnSDxMaL` · Modell `eleven_v4` · `language_code: "de"` (nur v3/v4) · stability 0.4 · similarity_boost 0.8 · style 0.5 · speed 1.0 · speaker_boost an · `previous_text`/`next_text` zwischen Abschnitten · `mp3_44100_192` (Rückfall 128). Keine SSML-Pausen bei v3/v4.

## 3. Text-Regeln (für alle Motoren, gemessen hilfreich ✔ / Doku ◇)
- ✔ Zahlen, Uhrzeiten, Beträge als **gesprochene Wörter** („halb elf“, „neunundachtzig Euro“).
- ✔ Abkürzungen ausschreiben, wie man sie spricht: „KI“ → „künstliche Intelligenz“ oder „Ka-I“.
- ✔ **„SMS“ nicht sprechen lassen** (klingt auch als „Es-Em-Es“ komisch – Tiry, 21.11.2026) → umformulieren: „eine kurze Bestätigung aufs Handy“, „eine Nachricht aufs Handy“.
- ✔ Namen phonetisch: „Tiry“ → „Tiri“, „AIVOX“ → „Ei-Wox“. Anzeige-Text bleibt richtig geschrieben.
- ✔ Kurze Sätze (Telefon: max. ~20 Wörter), ein Gedanke pro Satz.
- ✔ Natürliche Gesprächsbausteine: „Klar, einen Moment … ich schau kurz nach.“, „Oh, das ist ärgerlich – aber das kriegen wir hin.“
- ◇ Pausen mit „…“, Betonung mit GROSSBUCHSTABEN, Audio-Tags sparsam (max. 1–2 pro Antwort) – nur ElevenLabs v3/v4.
- Füllwörter bei Wartezeit > 2 s („Sekunde.“, „Mhm, bin dran.“), vorab erzeugt und gecacht (Luna).
- Begrüßungen nach Tageszeit, nie zweimal dieselbe hintereinander (Luna, AIVOX).
- Markdown, Emojis, Links vor der Sprachausgabe entfernen.

## 4. Lokale Pipeline (AIVOX, gemessen)
- Chatterbox: **echte** Referenzaufnahme (nie synthetische!) – Thorsten-Voice CC0. **Gemischte Referenz** (neutral + amüsiert) bei exaggeration 0.5, cfg 0.4: **+30 % Lebendigkeit**, gleiche Natürlichkeit.
- 3 Varianten je Zeile, Auswahl: Verständlichkeit ≥ 0,9 (Whisper), dann höchste Natürlichkeit (DNSMOS).
- **Nicht geholfen:** satzweises Zusammensetzen, Raumhall, Voice-Conversion (erfindet Wörter).
- Anrufer-Stimme im Demo: HD-Telefonklang (Bandpass ~180–6500 Hz).

## 5. Messverfahren (für beide)
Verständlichkeit: faster-whisper small, Vergleich mit Soll-Text (0–1). Natürlichkeit: DNSMOS (OVRL+P808)/2 (1–5). Lebendigkeit: Tonhöhen-Streuung in Halbtönen (librosa pyin). Werkzeuge: `aivox/stimmen-labor/` auf dem AIVOX-Branch. **Endgültig entscheidet Tirys Blindtest.**

## 6. Abstimmungsregel (Tiry, 21.11.2026)
Passiert in **einem** der beiden Chats irgendetwas zur Stimme (Entscheidung von Tiry, Messwert, Code, Einstellung, Fund),
schickt die betroffene Sitzung **sofort** eine Nachricht an die andere:
`STIMME-UPDATE: <was> · <warum> · <Commit/Datei>`.
Sitzungen: AIVOX `session_01AC3hVefvGxsa4HNgSaq8Sg` · Luna `session_01AC3hVeEDxUbkck1rCSq8wC` (per send_message).

## 7. Zwei Charaktere, eine Technik (Tiry, 21.11.2026)
- **AIVOX (Startup, Kunden):** immer kundenfreundlich, ruhig, freundlich-professionell. **Nie** sarkastisch, kein Flirten, keine Gefühls-Tags außer dezentem, freundlichem Ton. Verantwortlich: AIVOX-Sitzung.
- **Luna (privat, nur für Tiry):** charmant, flirtend, sarkastisch erlaubt. Verantwortlich: Luna-Sitzung.
- Gemeinsam: Motoren, Text-Regeln (§3), Messverfahren (§5), Abstimmungsregel (§6). Charakter, Stimme und Tags legt jede Sitzung selbst fest.

## 8. Luna-Entscheid: Google Chirp 3 HD (Tiry, 21.11.2026)
Luna ist primär mobil → Hauptstimme **Google Cloud TTS „Chirp 3 HD“** (Abrechnung nach Nutzung, kein Abo). Rangfolge Luna:
Chirp 3 HD (mobil) → Heim-Stimme = Kartoffel-Stimmserver der AIVOX-Sitzung auf Tirys PC (zu Hause/VPN) → ElevenLabs (Altlast) → Handy-Stimme. Kartoffel ist NICHT verworfen, nur nicht handytauglich (Abschätzung Luna, ungemessen). Umsetzung: `luna-app/.../CloudVoice.kt` (Branch `ccr-5a20bb04-mr0zu4`).
Chirp 3 HD: `de-DE-Chirp3-HD-<Name>`, Pausen per `[pause short|pause|pause long]` im markup-Feld, **keine** Gefühls-Tags. Preise/Gratiskontingent: unverifiziert.
AIVOX: Kartoffel-Orpheus bleibt für AIVOX ein Kandidat (Server/vorproduzierte Demos, kostenlos); Chirp 3 HD ist für AIVOX eine Option mit Nutzungskosten.

## 9. AIVOX-Entscheid: ebenfalls Google Chirp 3 HD (Tiry, 21.11.2026)
Tiry: „Es soll das gleiche Modell laufen wie bei Luna“ – Luna klingt auf dem Handy mit Chirp 3 HD „extrem vertretbar“.
→ **Beide Projekte: Google Cloud TTS Chirp 3 HD.** AIVOX: kundenfreundliche Stimme aus der Chirp-Liste (de-DE), Auswahl per Messung + Tirys Ohr.
Kartoffel-Orpheus und Chatterbox: gestoppt, nur noch Archiv/Notfall.

## 10. Live-Gespräch: Lehren aus Luna (für AIVOX-Telefonie übernehmen)
- Unterbrechungs-Erkennung (Barge-in) erst ab **hörbarer** Wiedergabe eichen, sonst hält das System die eigene Stimme für den Anrufer.
- Bei Verdacht auf Unterbrechung **pausieren und kurz hinhören** statt abbrechen; ohne Sprache an derselben Stelle weiterreden.
- Antwort streamen: **erster fertiger Satz wird sofort gesprochen**; Satzgrenze nur mit Leerzeichen danach (sonst wird „7.30“ getrennt).
- Sprechpausen-Erkennung kurz halten (~700–850 ms). Quelle: Luna, `LunaService.kt`, `BargeIn.kt`, `Brain.kt`.

## 11. AIVOX-Stimme festgelegt (Tiry, 21.11.2026)
Standard **de-DE-Chirp3-HD-Leda**, vom Kunden im Cockpit wählbar (alle 30 Chirp-Stimmen). Demo-Anruferin: Vindemiatrix mit Telefonfilter.
Gemessen: alle 30 Stimmen 0,96 verständlich, Natürlichkeit 3,47–3,89, Leda 3,73 / Lebendigkeit 8,45. Messdaten: `aivox/stimmen-labor/chirp-auswahl/`.
Aussprache-Lehre: Ein-Wort-Antworten mit Namen („Auf Becker.“) werden verschluckt → ganze Phrase („Auf den Namen Becker, bitte.“).
- (Luna, Update) Unterbrechung **wortbasiert** statt pegelbasiert: nur fertige Erkennungsergebnisse mit Signalwörtern („Moment“, „Halt“, „Warte“ …) zählen – 0 Fehlalarme bei Geräuschen gemessen. Für AIVOX-Telefonie übernehmen (Anrufer-Geräusche sollen AIVOX nicht abbrechen). Quelle: Luna `BargeIn.kt`.

## 12. Charakter & Emotion mit Chirp 3 HD (gemessen verständlich, 21.11.2026)
Chirp kennt keine Gefühls-Tags – Charakter entsteht über: **Wortwahl** („Oh je, das ist ärgerlich – aber keine Sorge“), **Pausen** `[pause short]`,
**Sprechtempo je Person** (gestresst 1,12 · müde 0,92 · normal 1,0), **Zögern** („Ähm, …“), Freude („Oh, super!“).
Achtung: Gedankenstrich direkt nach „ja“ wird als „minus“ gelesen → Komma nutzen. Namen in ganze Sätze einbetten („Bitte auf den Namen Becker.“).
AIVOX-Demo: jede Situation eigenes Stimmenpaar (Leda/Achird, Enceladus/Aoede, Pulcherrima/Iapetus, Algenib/Laomedeia). Skript: `aivox/stimmen-labor/charaktere.py`.

## 13. Schwierige Anrufer: Ruhe-Protokoll (AIVOX, Tiry 21.11.2026)
Primär lösen, im Notfall an Geschäft/Chef übergeben: **Zuhören** (Ärger anerkennen, keine Schuld, nicht diskutieren) → **Klären** (Name, Anliegen) →
**Lösen** (Lösung im Rahmen der Werkstatt-Regeln, zwei Optionen) → **Übergeben** (Chef-Wunsch oder keine Einigung: sofort durchstellen, sonst Rückruf in 30 Min, Priorität Rot, Zusammenfassung vorab) →
**Grenzen** (keine Versprechen außerhalb der Regeln, keine Geld-/Rechtsentscheidungen, bei Beleidigung ruhig Grenze setzen und übergeben).
Stimme dabei: ruhiger, etwas langsamer (Tempo 0,96), warm. Demo: Vindemiatrix (AIVOX) / Charon (verärgerter Anrufer, 1,1). Szene s5 in `charaktere.py`.

## 14. Tiefe weibliche Chirp-Stimmen (gemessen von der AIVOX-Sitzung für Luna, 21.11.2026)
Ein Testsatz (ruhig, abendlich), Tempo 1,0 / 0,9. Tonhöhe = Median-Grundfrequenz, Lebendigkeit = Streuung in Halbtönen, Natürlichkeit = DNSMOS (1–5, Messrauschen ca. ±0,1).
| Stimme | Tonhöhe | Lebendigkeit | Natürlichkeit | Tempo 0,9 |
|---|---|---|---|---|
| **Gacrux** | **165 Hz (tiefste)** | 4,5 | 3,58 | 164 Hz · 4,7 · 3,59 |
| Vindemiatrix | 174 Hz | 6,2 | 3,58 | 176 Hz · 6,0 · 3,61 |
| Despina | 176 Hz | 4,2 | 3,74 | 191 Hz · 6,9 · 3,60 |
| Aoede | 183 Hz | 7,1 | 3,49 | 188 Hz · 3,6 · 3,65 |
| Leda | 215 Hz | 3,9 | 3,59 | – |
| Achernar | 233 Hz | 6,0 | 3,59 | – |
| Erinome / Sulafat | 229–233 Hz | ≈4 | 3,40 | – |
Ergebnis: Gacrux ist die tiefste deutsche Chirp-Frauenstimme, Tempo 0,9 kostet keine Natürlichkeit. −5 % Wiedergabe-Tonhöhe ≈ −0,9 Halbtöne → ca. 157 Hz.
Achernar ist hell (233 Hz) und passt nicht zu „tief“. Alternative mit mehr Ausdruck: Vindemiatrix (174 Hz, Lebendigkeit 6). Endgültig entscheidet Tirys Ohr.
Absenkung Gacrux (Tempo 0,9, librosa-Phasenvocoder, DNSMOS): 0 % 3,59 · −5 % 3,06 · −10 % 2,97 · −15 % 2,92 · −20 % 2,83 · −25 % 2,69.
Der Sprung bei −5 % ist vermutlich ein Artefakt des Phasenvocoders (Android nutzt Sonic) – aussagekräftig ist die flache Steigung bis −15 %, danach fällt es deutlicher.
Empfehlung: −10 % gut, −15 % Obergrenze. Chirp 3 HD lehnt den API-Parameter `pitch` ab (HTTP 400, geprüft 21.11.2026) → Absenkung nur clientseitig.

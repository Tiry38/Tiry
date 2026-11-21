# Luna – deine Sprach-Assistentin fürs Handy

Android-App im Stil von J.A.R.V.I.S.: Handy liegt neben dir, du sagst **„Hey Luna“**, sie antwortet
**„Hey Tiry, was gibt's?“** – und erledigt, was du sagst.

## Installieren (einmalig, ca. 5 Minuten)

1. Auf dem Handy GitHub öffnen → Repo **Tiry38/Tiry** → **Releases** → neuestes **„Luna 1.0.x (Android)“** → `Luna-1.0.x.apk` herunterladen.
2. APK öffnen → „Installation aus dieser Quelle zulassen“ → **Installieren**.
3. Luna öffnen → Mikrofon, Benachrichtigungen, Kontakte, Anrufe, SMS, Kalender **erlauben**.
4. Zahnrad → **Rechte** → alle roten Punkte antippen und freigeben:
   - **Bedienungshilfe** (damit Luna tippen, scrollen, lesen, sperren kann).
     Ausgegraut? → Einstellungen → Apps → Luna → ⋮ oben rechts → **„Eingeschränkte Einstellungen zulassen“**, dann nochmal.
   - **Benachrichtigungen lesen**, **Akku-Optimierung aus**, **Über anderen Apps**.
5. Optional, aber empfohlen (Zahnrad):
   - **Claude API-Key** → Luna denkt frei mit, sucht im Netz, bedient fremde Apps, gibt Tipps.
     Key: console.anthropic.com → API Keys. Modell wählbar (Opus 5.5 klügste, Haiku 5.5 schnellste/günstigste).
   - **ElevenLabs API-Key** → Stimme klingt wie ein echter Mensch (Standard „Sarah“, Modell Multilingual v2).
     Key: elevenlabs.io → Profil → API Keys. Gratis-Kontingent vorhanden.
   - **Stimme testen** antippen.

## Benutzen

- **„Hey Luna“** (oder nur „Luna“) → kurz warten, bis sie antwortet → Befehl sagen.
- Danach kannst du direkt weiterreden, ohne erneut „Hey Luna“ (abschaltbar). „Danke“ / „Passt“ beendet das Gespräch.
- Oder: Orb bzw. Mikro-Knopf antippen. In der Benachrichtigung gibt es „Sprechen“ und „Schlafen“.

| Ohne Claude-Key (offline) | Mit Claude-Key zusätzlich |
|---|---|
| Uhrzeit, Datum, Akku | Freies Gespräch, Fragen, Erklärungen |
| Wecker, Timer, Erinnerungen | Websuche (News, Öffnungszeiten, Preise …) |
| Apps öffnen, Anrufen | WhatsApp/SMS diktieren und senden |
| Musik steuern & abspielen | Fremde Apps Schritt für Schritt bedienen |
| Lautstärke, Lautlos, Taschenlampe | Termine lesen und eintragen |
| Wetter, Navigation, Google-Suche | Benachrichtigungen zusammenfassen |
| Zurück, Home, Sperren, Screenshot | Merkt sich Dinge über dich, gibt passende Tipps |

## Ehrliche Grenzen

- **Gesperrter Bildschirm:** Luna hört und spricht, aber Apps öffnen/Anrufen erscheint hinter der Sperre –
  Android lässt keine App die PIN umgehen.
- **Nach Neustart (Android 14+):** Luna einmal antippen, dann hört sie wieder zu (Android-Vorgabe fürs Mikrofon).
- **Akku:** Dauerhaftes Zuhören kostet etwas Akku. „Auch bei ausgeschaltetem Bildschirm zuhören“ ist abschaltbar.
- **Wake-Word:** komplett offline. Getestet mit synthetischen Stimmen: 24/24 erkannt, 4 Fehlalarme in 120 Sätzen
  (fast nur bei klanggleichen Sätzen wie „Lou, na komm“). Empfindlichkeit + „Nur mit Hey“ in den Einstellungen.
- **Datenschutz:** Beim Warten verlässt kein Ton das Handy. Was du nach „Hey Luna“ sagst, geht an die
  Google-Spracherkennung, mit Key an Claude (Anthropic) und für die Stimme an ElevenLabs.

## Technik (für Entwickler)

- Kotlin, minSdk 26, targetSdk 35. Wake-Word: Vosk `vosk-model-small-de-0.15` + Grammatik aus „lu na“ und
  ~2900 häufigen deutschen Wörtern als Ablenker (`assets/wake_words.txt`).
- Gehirn: `anthropic-java` (Werkzeugschleife in `Brain.kt`, 31 Handy-Werkzeuge in `PhoneTools.kt`, Websuche,
  Prompt-Caching, effort `low`, serverseitiger Fallback). Offline: `LocalIntentParser.kt`.
- Steuerung: `LunaAccessibilityService.kt`, Benachrichtigungen: `NotificationService.kt`.
- Bauen: Modell nach `app/src/main/assets/model-de/` entpacken, dann `./gradlew :app:assembleRelease`.
  Tests: `./gradlew :app:testDebugUnitTest` (Parser, Wake-Word, Claude-Schleife gegen Mock-Server, Screenshots nach `app/build/screens/`).
- GitHub Actions (`.github/workflows/luna-apk.yml`) baut bei jeder Änderung eine APK als Release `luna-v1.0.<n>`
  (bewusst **nicht** „latest“, das gehört dem Windows-Programm).
- Signatur: mitgelieferter Debug-Schlüssel `signing/luna-debug.jks` (nur für private Installation). Für einen eigenen
  Schlüssel die Secrets `LUNA_KEYSTORE_B64`, `LUNA_KEYSTORE_PASSWORD`, `LUNA_KEY_ALIAS`, `LUNA_KEY_PASSWORD` setzen
  (danach einmal deinstallieren, weil sich die Signatur ändert).

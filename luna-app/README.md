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
     Key: console.anthropic.com → API Keys. Standard ist **Haiku 5.5** (am schnellsten, unter 1 Cent pro Frage); Sonnet/Opus wählbar.
   - **ElevenLabs API-Key** → Stimme klingt wie ein echter Mensch (Standard „Sarah“, Modell **Eleven v4** mit Deutsch fest
     eingestellt, Kontext zwischen Sätzen, 192 kbit/s, Gefühls-Tags). Lehnt dein Abo etwas ab, passt Luna sich selbst an
     (erst Einstellungen, dann Modell v3 → v2). Stimmen-Galerie zum Probehören in den Einstellungen.
     Key: elevenlabs.io → Profil → API Keys. Gratis-Kontingent vorhanden.
   - **Stimme testen** antippen.

## Oberfläche: Cockpit

Tiefes Schwarz, ruhiges Punkteraster, 3D-Partikelkern mit Orbit-Ringen und Plasmalinie, HUD (Akku, Netz, Uhrzeit).
Beim Sprechen/Zuhören laufen Schallwellen-Ringe aus dem Kern. Acht **Reaktor-Ringe** in zwei Reihen: PC an, Remote,
VPN, Gast-WLAN, Licht, Lautlos, Sperren, Wachmodus – aktive Funktionen leuchten in ihrer Farbe und drehen sich.
Einstellungen rahmenlos: Lichtzeilen statt Knöpfe, HUD-Unterstrich-Felder, Energieknoten als Schalter.

## Ansprechen: wann Luna reagiert

- **„Hey Luna“** (oder „Hallo/Okay Luna“) – immer.
- **„Luna“ allein** mit kurzer Pause – nur, wenn gerade nicht geredet wird.
- **Erwähnung im Satz** („ich hab Luna gebaut“, „Luna ist cool“) – ignoriert.
- Nach dem Aufwecken prüft Luna selbst, ob das Gesagte an sie gerichtet war; wenn nicht, bleibt sie still.
- Befehl in einem Atemzug geht mit „Hey Luna, …“; sonst „Hey Luna“ → Begrüßung abwarten → Befehl.

## Komplette Handy-Steuerung

Luna bedient jede App und jede Systemecke selbst: Bildschirm lesen (mit Koordinaten) oder ansehen (Screenshot),
tippen, lange drücken, wischen, schreiben, Enter, scrollen, Schnelleinstellungen (WLAN, Bluetooth, Flugmodus, Hotspot,
Standort, Nicht stören …), Benachrichtigungen öffnen, beliebige Android-Befehle (Intents), App-Liste, Zwischenablage.
Sie arbeitet Schritt für Schritt, bis die Aufgabe erledigt ist (bis 30 Schritte pro Auftrag).
Sicherheitsregel: Käufe, Löschen, Überweisungen und Nachrichten nur nach deiner Bestätigung.

## Heimnetz: FRITZ!Box & PC (Grundlage steht, Details besprechen wir)

1. FRITZ!Box: Heimnetz → Netzwerk → Netzwerkeinstellungen → **„Zugriff für Anwendungen zulassen“**.
   System → FRITZ!Box-Benutzer → Benutzer mit Passwort (Recht „FRITZ!Box-Einstellungen“).
2. Luna → Zahnrad → **Heimnetz**: Benutzer, Passwort, PC-Name (wie in der FRITZ!Box) eintragen → „Verbindung testen“.
3. PC: Wake-on-LAN im BIOS/UEFI und bei der Netzwerkkarte einschalten (Windows: Geräte-Manager → Netzwerkadapter →
   Energieverwaltung → „Gerät kann den Computer aus dem Ruhezustand aktivieren“). Fernsteuerung: z. B. **RustDesk** oder
   **Chrome Remote Desktop** auf PC und Handy.
4. Unterwegs: FRITZ!Box → Internet → Freigaben → VPN (WireGuard) → Verbindung für dieses Handy anlegen, in der
   **WireGuard-App** importieren, dort Einstellungen → **„Allow remote control apps“** an. Tunnelname in Luna eintragen.

Dann geht z. B.: „Hey Luna, mach meinen PC an“, „Ich will meinen PC fernsteuern“ (VPN → PC wecken → warten →
Fernsteuerungs-App öffnen), „Gast-WLAN an“, „Wer ist im WLAN?“, „Wer hat angerufen?“.

## Luna als System-Assistent

Zahnrad → **„Standard-Assistent festlegen“** → Digitaler Assistent → Luna. Dann startet Luna statt Google Assistant
(langer Druck auf Power-/Home-Taste, auch auf dem Sperrbildschirm). Tiefer geht es ohne Root nicht – eine echte
System-App bräuchte ein gerootetes Handy bzw. eigenes Android.

## Updates (automatisch ab Version 1.0.7)

Luna prüft alle 15 Minuten im Hintergrund (und bei jedem Öffnen) GitHub auf eine neue Version, lädt sie, installiert
sie selbst (nie mitten im Gespräch) und startet sich danach neu.
Beim ersten Mal fragt Android einmal „Apps installieren erlauben?“ und „Installieren?“ – danach (Android 12+)
ohne Rückfrage. Manuell: „Luna, update dich“ oder Einstellungen → Über → „Nach Updates suchen“.

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
| PC an, PC fernsteuern, Gast-WLAN, Geräte, Anrufliste, VPN | „Guck mal“: sieht den Bildschirm als Bild und tippt dann gezielt |

## Stimme: mobil zuerst (Google Chirp 3 HD)

Hauptstimme überall unterwegs: **Google Cloud Text-to-Speech „Chirp 3 HD“** (14 weibliche deutsche Stimmen, z. B. Aoede,
Kore, Leda, Zephyr). Schlüssel: console.cloud.google.com → Projekt → Abrechnung aktivieren (nach Nutzung, kein Abo; Gratis-
Kontingent laut Google-Preisseite) → „Cloud Text-to-Speech API“ aktivieren → API-Schlüssel erstellen → auf „Android-Apps“
(Paket `de.tiry.luna` + SHA-1 aus Lunas Einstellungen) und „Cloud Text-to-Speech API“ beschränken. Reihenfolge der Stimmen:
Google HD → Heim-Stimme (PC, optional) → ElevenLabs (optional) → Handy-Stimme.

## Heim-Stimme (optional): Stimme vom eigenen PC

Kein ElevenLabs nötig. Auf dem PC läuft der **Luna-Stimmserver** (Kartoffel-Orpheus, kostenlos, offline; gebaut von
der AIVOX-Sitzung). Luna holt das Audio über das Heimnetz (unterwegs per VPN). Einrichtung: Zahnrad → „Heim-Stimme (PC)“
→ Adresse (z. B. `tiry-pc.fritz.box`) + Schlüssel vom Server → „Verbindung testen & Stimmen laden“ → Stimme antippen.
Ist der PC aus, spricht Luna vorübergehend mit der Handy-Stimme.
Vertrag „Luna-Stimmserver v1“: `GET /health`, `POST /tts` (JSON → WAV), Port 5055, `Authorization: Bearer <Schlüssel>`.

## Lunas eigenes Gedächtnis und Ich

Luna nutzt Anthropics Memory-Werkzeug mit einem Speicher **nur auf diesem Handy** (`/memories` im privaten App-Speicher):
- `ich.md` – **Luna selbst**: Persönlichkeit, Vorlieben, Meinungen, Running Gags, was bei dir gut ankommt. Sie pflegt
  die Datei selbst und entwickelt sich damit weiter.
- `tiry.md` – **du**: Fakten, Vorlieben, Menschen, Pläne, laufende Themen (alte „Merk dir“-Notizen werden übernommen).
- `tagebuch.md` – kurze Notizen nach Gesprächen, damit sie weiß, wo ihr stehen geblieben seid.
Sie speichert keine Passwörter, PINs oder Kontodaten. Ansehen/Löschen: Einstellungen → Gedächtnis.

## Sicherheit – nur für dich und deine Geräte

- **Schlüssel im Hardware-Tresor:** Claude-, ElevenLabs- und FRITZ!Box-Zugangsdaten sind mit AES-256 im Android-Keystore
  verschlüsselt. Der Schlüssel ist an dieses Handy gebunden – kopierte Daten sind woanders wertlos.
- **Sperrschutz:** Bei gesperrtem Handy macht Luna nichts Heikles (Nachrichten, Anrufe, Bildschirm lesen/steuern,
  FRITZ!Box, PC, VPN, Apps öffnen). Sie fordert erst Fingerabdruck/PIN an.
- **Netzwerk:** Nur verschlüsselte Verbindungen (HTTPS). Einzige Ausnahme: die eigene FRITZ!Box (`fritz.box`, `192.168.178.1`).
- **Kein Backup:** Lunas Daten werden nie in Cloud-Backups oder beim Handywechsel kopiert.
- **Updates:** nur aus `Tiry38/Tiry`, nur mit derselben Signatur (Luna prüft selbst, Android zusätzlich).
- **Empfehlung:** eigenen Signatur-Schlüssel als GitHub-Secret hinterlegen (siehe Technik) – der mitgelieferte
  Debug-Schlüssel liegt öffentlich im Repo.

## Ehrliche Grenzen

- **Gesperrter Bildschirm:** Luna hört und spricht, aber Apps öffnen/Anrufen erscheint hinter der Sperre –
  Android lässt keine App die PIN umgehen.
- **Nach Neustart (Android 14+):** Luna einmal antippen, dann hört sie wieder zu (Android-Vorgabe fürs Mikrofon).
- **Akku:** Dauerhaftes Zuhören kostet etwas Akku. „Auch bei ausgeschaltetem Bildschirm zuhören“ ist abschaltbar.
- **Unterbrechen:** funktioniert über Echo-Unterdrückung des Handys. Bei sehr lauter Wiedergabe kann sich Luna selten
  selbst unterbrechen – dann in den Einstellungen „Luna unterbrechen …“ ausschalten oder leiser stellen.
- **Wake-Word:** komplett offline. Getestet mit synthetischen Stimmen: 24/24 erkannt, 4 Fehlalarme in 120 Sätzen
  (fast nur bei klanggleichen Sätzen wie „Lou, na komm“). Empfindlichkeit + „Nur mit Hey“ in den Einstellungen.
- **Datenschutz:** Beim Warten verlässt kein Ton das Handy. Was du nach „Hey Luna“ sagst, geht an die
  Google-Spracherkennung, mit Key an Claude (Anthropic) und für die Stimme an ElevenLabs.

## Technik (für Entwickler)

- Kotlin, minSdk 26, targetSdk 35. Schriften Michroma + Sora (SIL Open Font License, `assets/licenses/`). Wake-Word: Vosk `vosk-model-small-de-0.15` + Grammatik aus „lu na“ und
  ~2900 häufigen deutschen Wörtern als Ablenker (`assets/wake_words.txt`).
- Gehirn: `anthropic-java` (Werkzeugschleife in `Brain.kt`, 31 Handy-Werkzeuge in `PhoneTools.kt`, Websuche,
  Prompt-Caching, effort `low`, serverseitiger Fallback). Offline: `LocalIntentParser.kt`.
- Steuerung: `LunaAccessibilityService.kt` (inkl. Screenshot), Benachrichtigungen: `NotificationService.kt`,
  FRITZ!Box TR-064 + Wake-on-LAN: `HomeNet.kt`, System-Assistent: `SystemAssistant.kt`.
- Bauen: Modell nach `app/src/main/assets/model-de/` entpacken, dann `./gradlew :app:assembleRelease`.
  Tests: `./gradlew :app:testDebugUnitTest` (Parser, Wake-Word, Claude-Schleife gegen Mock-Server, Screenshots nach `app/build/screens/`).
- GitHub Actions (`.github/workflows/luna-apk.yml`) baut bei jeder Änderung eine APK als Release `luna-v1.0.<n>`
  (bewusst **nicht** „latest“, das gehört dem Windows-Programm).
- Signatur: mitgelieferter Debug-Schlüssel `signing/luna-debug.jks` (nur für private Installation). Für einen eigenen
  Schlüssel die Secrets `LUNA_KEYSTORE_B64`, `LUNA_KEYSTORE_PASSWORD`, `LUNA_KEY_ALIAS`, `LUNA_KEY_PASSWORD` setzen
  (danach einmal deinstallieren, weil sich die Signatur ändert).

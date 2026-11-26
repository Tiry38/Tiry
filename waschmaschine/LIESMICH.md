# Waschmaschine – die App

Eine Android-App für die **Siemens iQ500 WM14UR5EM2** (E-Nr. WM14UR5EM2/50). Sie spricht **direkt** mit der Maschine
(lokales, verschlüsseltes Home-Connect-Protokoll, in Kotlin nachgebaut nach dem Open-Source-Projekt *hcpy*) und
von unterwegs über einen **eingebauten WireGuard-Tunnel** zur FRITZ!Box. Keine Home-Connect-App, kein Server, keine zweite App.

**Download:** https://github.com/Tiry38/Tiry/releases/download/waschmaschine-latest/Waschmaschine.apk

---

## Installation in 3 Schritten

1. **APK laden und installieren** – Link oben auf dem Handy öffnen, `Waschmaschine.apk` antippen.
   Android fragt einmal „Installation aus dieser Quelle erlauben?“ → erlauben.
2. **01 · Waschmaschine verbinden** – App öffnen, Knopf antippen, **einmalig** mit dem Home-Connect-Konto anmelden.
   Die App holt den Geräteschlüssel, sucht die Maschine im WLAN und fragt nach *Benachrichtigungen* (→ Zulassen) und
   *Akku-Optimierung* (→ Zulassen). Beides ist nötig, damit Pop-ups auch bei geschlossener App kommen.
3. **02 · Von unterwegs** – in der FRITZ!Box eine WireGuard-Verbindung anlegen (Klickpfad unten), den QR-Code mit der
   App scannen, die VPN-Frage mit **OK** bestätigen. Fertig – nie wieder einrichten.

Oben in der App steht immer **ZUHAUSE** (direkt im WLAN) oder **UNTERWEGS** (über den Tunnel). Die App wählt selbst.

---

## FRITZ!Box 7690 einrichten (einmalig)

1. Im Browser `http://fritz.box` öffnen und anmelden.
2. **Prüfen, ob die Box von außen erreichbar ist:** *Internet → Online-Monitor*.
   - Steht dort eine **IPv4-Adresse** (keine 100.64.x.x) → alles gut.
   - Steht dort **„DS-Lite“** oder eine Adresse **100.64.x.x–100.127.x.x** → nur über **IPv6** erreichbar.
     Das klappt, wenn das Handy-Netz IPv6 hat (bei Telekom, Vodafone und o2 üblich – im Zweifel testen, siehe Echter Test 2).
     Klappt es nicht: bei Vodafone eine öffentliche IPv4-Adresse anfragen.
3. **MyFRITZ! einschalten:** *Internet → MyFRITZ!-Konto* → registrieren. Dadurch bekommt die Box eine feste Adresse
   `xxxxxxxx.myfritz.net`, die die App automatisch benutzt.
4. **WireGuard-Zugang anlegen:** *Internet → Freigaben → VPN (WireGuard) → Verbindung hinzufügen →
   „Einzelgerät verbinden“* → Name z. B. „Waschmaschine-Handy“ → *Fertigstellen*. Die Box zeigt einen **QR-Code**.
5. In der App **„FRITZ!Box-QR-Code scannen“** → QR-Code abfilmen. Alternativ die angebotene `.conf`-Datei aufs Handy
   laden und **„Konfig-Datei wählen“**.

Die App baut daraus selbst einen **Split-Tunnel**: Durch den Tunnel geht **nur** Verkehr ins Heimnetz
(z. B. `192.168.178.0/24`) und **nur** von dieser App. Alles andere auf dem Handy bleibt unberührt.
Es wird **keine** Portfreigabe außer dem WireGuard-Zugang der FRITZ!Box angelegt.

**Empfehlung:** *Heimnetz → Netzwerk → Waschmaschine → „Diesem Netzwerkgerät immer die gleiche IPv4-Adresse zuweisen“*.
Dann findet die App die Maschine von unterwegs sofort (sonst sucht sie das Heimnetz ab – das dauert ca. 30 s).

---

## Was die App kann

| Bereich | Inhalt |
|---|---|
| Startseite | Status (Aus / Bereit / Läuft / Pause / Fertig / Fehler), Programm, Restzeit, **Fertig um**, Fortschritt, Tür |
| Steuern | Programm, Temperatur, Schleudern, Endzeit, Start / Pause / Weiter / Abbrechen (Abbrechen mit Sicherheitsabfrage) |
| Pop-ups | Fertig · Wäsche seit 30 min drin · Fehler mit Klartext · Verbindung verloren · optional „noch 10 Minuten“ – einzeln abschaltbar |
| Verlauf / Favoriten | Jeder fertige Waschgang wird gespeichert; Lieblingsprogramm mit einem Tipp starten |

**Hintergrund & Akku:** Läuft kein Waschgang, schaut die App alle 15 Minuten kurz nach. Läuft einer, hält ein
Vordergrund-Dienst die Verbindung bis zum Ende (sichtbar als Dauer-Benachrichtigung mit Fortschritt) und beendet sich danach.
Die Endprüfung wird zusätzlich anhand der Restzeit gezielt geplant.

**Sicherheit:** Geräteschlüssel und VPN-Schlüssel liegen nur verschlüsselt auf dem Handy (AES-256-GCM, Schlüssel im
Android Keystore), sind von Backups ausgenommen und stehen **nie** im Repository.

---

## Grenzen (ehrlich)

- **Einmaliger Schlüsselabruf:** Den Geräteschlüssel vergibt BSH beim Koppeln; die Maschine gibt ihn lokal nicht heraus.
  Deshalb einmal die Anmeldung mit dem Home-Connect-Konto – danach nie wieder Cloud.
  **Voraussetzung:** Die Maschine muss in diesem Konto schon gekoppelt sein. War sie das nie, ist die Kopplung einmalig nur
  mit der Home-Connect-App möglich (danach kann die wieder runter).
- **Fernstart** erlaubt die Maschine nur, wenn an ihr vorher **„Fernstart“** aktiviert wurde (Sicherheitsregel von BSH).
  Der allererste Fernstart aus der App fragt zusätzlich nach.
- **Unterwegs** braucht eine erreichbare FRITZ!Box (siehe DS-Lite oben).
- Manche Hersteller (z. B. Xiaomi, Huawei) beenden Hintergrund-Apps trotz Freigabe. Dann zusätzlich in den
  Handy-Einstellungen „Autostart“ für *Waschmaschine* erlauben.
- Die Tabelle der Fehlertexte deckt die häufigen Meldungen ab; unbekannte Meldungen erscheinen mit ihrem Gerätenamen.

---

## Fehlerbehebung

| Meldung in der App | Was tun |
|---|---|
| „Maschine im WLAN nicht gefunden …“ | Maschine einschalten (WLAN-Symbol am Display muss leuchten). Handy im selben WLAN? |
| „Unterwegs ist noch nicht eingerichtet …“ | Einstellungen → *Unterwegs einrichten* → QR-Code scannen. |
| „Der Tunnel nach Hause steht nicht …“ | FRITZ!Box online? MyFRITZ! aktiv? Bei DS-Lite: hat das Handy-Netz IPv6? WireGuard-Verbindung in der Box noch aktiv? |
| „Zuhause erreicht, aber die Maschine antwortet nicht“ | Maschine aus oder hat eine neue IP → feste IP in der FRITZ!Box vergeben (siehe oben). |
| „Die Maschine hat die Verbindung abgelehnt …“ | Schlüssel passt nicht mehr (z. B. nach Neukopplung) → Einstellungen → *Maschine neu koppeln*. |
| Keine Pop-ups bei geschlossener App | Benachrichtigungen erlaubt? Akku-Optimierung für die App aus? (Android-Einstellungen → Apps → Waschmaschine) |
| Anmeldung hängt | Code ist nur kurz gültig – Abbrechen und neu starten. |

---

## Für Entwickler

- Projekt: `waschmaschine/` (Kotlin, Jetpack Compose, minSdk 26). Bau per GitHub Actions (`.github/workflows/waschmaschine.yml`).
- Tests: `./gradlew :app:testDebugUnitTest` – Protokoll gegen eine **simulierte Maschine** (TLS-PSK und AES-HMAC),
  bitgenauer Abgleich mit hcpy, Pop-up-Regeln, Zuhause/Unterwegs-Umschaltung, WireGuard-Import, Bildschirmfotos (Roborazzi → `bildschirme/`).
- Kreuztest gegen OpenSSL (wie im Gerät): Python-Server starten und `KREUZTEST=1 ./gradlew :app:testDebugUnitTest --tests '*OpenSslKreuzTest*'`.
- **Signatur:** Die APK wird mit Tirys eigenem Schlüssel signiert. Er liegt AES-256-verschlüsselt in
  `app/signatur/eigen.keystore.enc`; die Werkstatt (GitHub Actions) entschlüsselt ihn mit dem Secret `WM_SIGNATUR_PASSWORT`.
  Fehlt das Secret, laufen nur die Tests – es wird keine APK veröffentlicht. Passwort NIE ändern oder verlieren:
  Ein anderer Schlüssel bedeutet Neuinstallation + neue Einrichtung.
- **Absturzbericht:** Stürzt die App ab, zeigt sie beim nächsten Start den Grund an („Bericht kopieren“).

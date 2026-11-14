# Server einrichten – Online mit Freunden (kostenlos)

Aetherfront braucht keinen gemieteten Server: **Der PC des Hosts ist der Server** (Menü → Mehrspieler → Spiel hosten,
Port **7710**). Damit Freunde über das Internet hineinkommen, gibt es zwei kostenlose Wege. Weg A ist der einfachste.

## Weg A – Tailscale (ohne Router-Einstellungen, empfohlen)
Tailscale baut ein privates Netz zwischen euren PCs, als säßet ihr im selben WLAN.
1. Jeder Mitspieler öffnet https://tailscale.com/download und installiert **Tailscale für Windows** (kostenlos).
2. Der Host meldet sich an (Google-/Microsoft-Konto reicht) und klickt im Tailscale-Fenster auf **„Invite users“**,
   schickt den Einladungslink an die Freunde.
3. Freunde nehmen die Einladung an und melden sich an.
4. Der Host klickt im Tailscale-Symbol unten rechts auf seinen PC und kopiert die Adresse (beginnt mit **100.**).
5. Im Spiel: Host → **Spiel hosten**. Freunde → **Beitreten**, als Adresse `ws://100.x.y.z:7710` eintragen
   (die kopierte Adresse einsetzen) und den Raum-Code eingeben.

## Weg B – Portfreigabe in der FRITZ!Box (z. B. FRITZ!Box 7690)
1. Im Browser **http://fritz.box** öffnen und anmelden.
2. **Internet → Freigaben → Portfreigaben → „Gerät für Freigaben hinzufügen“**.
3. Bei **Gerät** den Host-PC auswählen → **„Neue Freigabe“ → „Portfreigabe“**.
4. Anwendung: **Andere Anwendung**, Bezeichnung: `Aetherfront`, Protokoll: **TCP**, Port an Gerät: **7710**,
   bis Port: **7710**, Port extern gewünscht: **7710** → **OK** → **Übernehmen**.
5. Unter **Internet → Online-Monitor** steht die **IPv4-Adresse** der FRITZ!Box. Freunde tragen im Spiel
   `ws://DIESE-ADRESSE:7710` ein. (Tipp: Mit einem kostenlosen MyFRITZ!-Konto gibt es eine feste Adresse wie
   `xyz.myfritz.net`, die sich nicht ändert.)
6. Falls Windows fragt, ob Aetherfront im Netzwerk kommunizieren darf: **Zulassen** (privat und öffentlich).

Hinweis Vodafone-Kabel: Manche Anschlüsse haben nur „DS-Lite“ (keine eigene IPv4-Adresse). Dann funktioniert Weg B
nicht – Weg A (Tailscale) geht immer.

## Weg C – Eigener Dauer-Server (optional, für feste Runden)
Auf jedem Rechner mit Node.js 22, der dauerhaft läuft (z. B. ein kostenloser „Always Free“-Server bei Oracle Cloud):
```
git clone <dieses Repository>
cd Tiry/aetherfront
npm install --omit=dev
npm run server
```
Port 7710 (TCP) in der Firewall des Servers öffnen. Alle Spieler tragen `ws://SERVER-ADRESSE:7710` ein.

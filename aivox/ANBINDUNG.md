# AIVOX – Anbindung an jede Werkstatt (ohne Schnittstellen-Risiko)

Stand 21.11.2026. Problem (Tiry): Fahrradwerkstätten arbeiten fast nie mit Google/Outlook, sondern mit einer
Warenwirtschaft (velo.port, Tridata, e-vendo, HIW, Velodata, DoIt7, RADFAK, Approom, Hartje, tricoma, BikeAssistant …).
Öffentliche Termin-Schnittstellen (APIs) dieser Systeme: **nicht gefunden** (Recherche 21.11.2026).

## Grundprinzip: AIVOX braucht keine Schnittstelle, um zu funktionieren
Die Branche kennt das Prinzip bereits: velo.port-Online-Terminbuchung arbeitet mit einem **eigenen Kontingent pro Tag**
(AW-Kontingent + max. Anzahl Online-Termine). AIVOX macht es genauso – nur am Telefon.

### Stufe 1 – Werkstatt-Kontingent (funktioniert in jeder Werkstatt ab Tag 1)
1. Der Händler legt fest: „AIVOX darf pro Tag X Termine vergeben“ (z. B. Mo–Fr je 4 Inspektionen, Express 2) –
   und blockt diese Plätze in seiner Warenwirtschaft einmalig als „AIVOX“-Serie. → **keine Doppelbuchung möglich.**
2. AIVOX bucht nur in diese Plätze. Jede Buchung kommt sofort an:
   - als **Übergabe-Karte** im Cockpit mit allen Daten im Format der Warenwirtschaft (Kunde, Telefon, Rad, Leistung, Termin) –
     Übernehmen dauert ~30 Sekunden, Knopf „übernommen“;
   - parallel als E-Mail (und optional Kalender-Einladung .ics).
3. Ist das Kontingent voll oder die Leistung unklar (z. B. Unfallschaden), nimmt AIVOX einen **Terminwunsch** auf:
   „Die Werkstatt bestätigt Ihnen den Termin heute bis 17 Uhr per Es-Em-Es.“ → Händler tippt im Cockpit „bestätigen“
   oder wählt einen anderen Termin → SMS geht automatisch raus.

### Stufe 2 – Status „Ist mein Rad fertig?“ (ohne Schnittstelle)
- **Fertig-Knopf:** Mechaniker tippt im Cockpit/Handy bei der Auftragsnummer auf „fertig“ (oder scannt den QR-Code auf dem
  Auftragszettel). AIVOX gibt ab dann Auskunft.
- **Mitlesen:** Verschickt die Warenwirtschaft ohnehin Abhol-Mails/SMS, setzt der Händler AIVOX in Kopie (Weiterleitungs-
  adresse) – AIVOX liest Status und Betrag mit. (Je System prüfen.)
- Ohne beides: AIVOX notiert einen Rückruf statt zu raten.

### Stufe 3 – Direkt-Anbindung (Ausbaustufe, je System)
- Ziel: Termine und Auftragsstatus live aus der Warenwirtschaft. Weg: **Partnerschaft mit dem Hersteller** (offizielle
  Schnittstelle), Start mit dem verbreitetsten System im Pilotkreis (velo.port – Pilot Velocenter Hessert nutzt es).
- Bis eine offizielle Schnittstelle existiert: **kein** Mitlesen über inoffizielle Wege (kein Scraping, keine fremden
  Zugangsdaten) – Stufe 1 + 2 decken den Betrieb ab.

## Warum das trägt
- Funktioniert **mit jeder Warenwirtschaft**, auch Papierkalender – keine Abhängigkeit von Dritten.
- Gleicher Ablauf wie die bekannte Online-Terminbuchung → für Händler sofort verständlich.
- Mehraufwand für den Händler: ~30 Sekunden Übernahme je Termin statt ~3–5 Minuten Telefonat (Annahme, im Pilot messen).

## Pilot-Messpunkte (Velocenter Hessert)
Übernahmezeit je Termin · Anteil Terminwünsche vs. Direktbuchung · Fehlbuchungen (Ziel 0) · Anteil Statusfragen mit Antwort.

## Quellen
velo.port Online-Terminbuchungstool: https://support.velocom.de/support/solutions/articles/103000007494-online-terminbuchungstool ·
velo.port Preisliste DE 24.06.2026 · Systeme im Fahrradhandel: https://www.bikes.de/b2b · e-vendo, tricoma, VARIO, Hartje,
FullSystem, Schollware, hgi BikeAssistant (Herstellerseiten) · Tridata Online-Werkstatt: https://www.tri-data.de/produkte/tribike-software/online-werkstatt/

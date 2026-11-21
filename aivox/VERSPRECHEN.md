# AIVOX – Was die Website verspricht und warum es umsetzbar ist

Stand 21.11.2026. Regel: Auf die Website kommt nur, was technisch und rechtlich belegt umsetzbar ist.
Ändert sich ein Baustein (Anbieter, Preis, Recht), diese Liste und die Website gemeinsam anpassen.

| Versprechen | Grundlage | Status |
|---|---|---|
| KI-Hinweis im ersten Satz | EU AI Act Art. 50, gilt seit 02.08.2026 (`wissen/recht.md`) | Pflicht, im Gesprächsablauf fest eingebaut |
| Mitschrift nur mit Einwilligung, sonst Durchstellen/Rückruf | § 201 StGB, DSGVO Art. 6 Abs. 1 lit. a, GDD-Kurzpapier 01/2026 | Ansage-Text steht, Wortlaut vor Start rechtlich prüfen |
| AV-Vertrag, Dienstleister-Liste mit Serverstandort | DSGVO Art. 28; Drittland nur mit Kap.-V-Garantien. EU-US Data Privacy Framework gültig, Berufung C-703/25 P beim EuGH anhängig | Liste vor Start erstellen, Ziel EU-Verarbeitung (Phase 2: Pipecat/LiveKit auf EU-Server) |
| Kein Training mit Kundengesprächen | Claude API trainiert nicht standardmäßig mit API-Daten; übrige Anbieter vertraglich prüfen | Anbieter danach auswählen |
| Durchstellen mit Zusammenfassung | Retell: Warm Transfer mit Übergabe-Nachricht (docs.retellai.com/build/single-multi-prompt/transfer-call) | verfügbar |
| Mehrere Anrufe parallel | Retell: 20 gleichzeitige Gespräche im Startpaket (`wissen/tech.md`) | verfügbar |
| Mailbox bei Störung | Twilio Voice Fallback URL → TwiML mit Aufnahme (twilio.com/docs/usage/security/availability-reliability) | einrichten |
| Rufumleitung verzögert / bei besetzt | FRITZ!Box: Telefonie → Rufbehandlung → Rufumleitung → Art: verzögert / bei besetzt (AVM-Hilfe); GSM **61* / **67* / ##002# | Standard |
| Ortsnummer aus dem Vorwahlbereich | BNetzA Vfg. 25/2006: Ortsnetzbezug nötig → Adressnachweis des Betriebs; Twilio-Prüfung bis 3 Werktage+ | Ablauf mit Kunde |
| Umleitung meist ohne Aufpreis | Weiterleitung = Gespräch vom Kundenanschluss zur deutschen Festnetznummer, in Festnetz-Flatrates üblich | immer mit Tarif des Kunden prüfen, nie pauschal zusagen |
| 3 Stufen: Notizblock, Terminwünsche, Buchen | Reine Konfiguration des Gesprächsablaufs | baubar |
| Termine ohne Schnittstelle (Kontingent + Übergabe-Karte), API wenn vorhanden | `aivox/ANBINDUNG.md` | Stufe 3 nur mit offizieller Hersteller-API |
| 129 €/Monat, 600 Min, bis 200 SMS, Mehrminute 0,15 € | Kosten ≈ 0,08 €/Min (Retell + Haiku) → 600 Min ≈ 48 €; SMS ≈ 0,085 € → 200 SMS ≈ 17 €; Ortsnummer ≈ 1,20 € | **Entwurf** – Preis entscheidet Tiry; Insolvenzregeln beachten (Freigabe vor Einnahmen) |
| Test 14 Tage, endet von selbst | Kein automatischer Übergang ins Abo | so in AGB festhalten |
| Löschfristen, Export, Wochenbericht | Eigene Software (Cockpit) | zu bauen |
| Mehrsprachig | Als „kommt bald“ gekennzeichnet | nicht versprechen, bevor getestet |

Nicht auf die Website: erfundene Kundenzahlen, Bewertungen, „DSGVO-zertifiziert“, „100 % EU-Server“ (stimmt in Phase 1 nicht),
feste Antwortzeiten in Millisekunden, Aussagen zu Tarifkosten Dritter ohne Prüfung.

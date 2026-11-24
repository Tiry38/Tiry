# Homepage-Prototyp – feste Entscheidungen von Tiry

- Noch nichts online stellen. Nur die Vorschau (Artifact) wird aktualisiert.
- Ganze Seite per „du“.
- Nie auf der Seite: interne Daten (EK, Rahmennummer, Lagerort, Bemerkung, Akku-/Schlüsselnummern, Kundendaten), Lagerbestände, Provisionen, „Barkauf“.
- **Kein Hol- und Bringservice** auf der Seite (12.11.2026).
- Keine Standgebühr auf der Seite (12.11.2026).
- Aktionspreise gelten nicht bei Leasing & Finanzierung – überall vermerken.
- Finanzierung TARGOBANK: 0 % Zinsen, bis zu 24 Monate, **mit Anzahlung** (nie „0 € Anzahlung“).
- Erste Inspektion: Empfehlung 500–1.000 km.
- ENRA: E-Bikes bis 10.000 € (Stand enra.eu 12.11.2026). Tarife als Vergleichstabelle; Kosten laut Tiry: Rundumschutz Plus ab ca. 120 €/Jahr, Rundumschutz ab ca. 70 €/Jahr, je nach Fahrzeugwert.
- Winter-Aktion: –20 € auf jede Inspektion (nie Prozent) + Sattelüberzug (nie „Satteldecke“), 01.11.2026–28.02.2027, keine festen Inspektionspreise.
- Bilder immer freigestellt und geschärft.

- Terminformular „Worum geht es?“: Probefahrt, Inspektion, Reparatur, Verfügbarkeit (kein Zubehör, kein Reifen/Schlauch, keine Bosch-Diagnose); „Um welchen Artikel?“ (statt „Rad“): Fahrrad, E-Bike, E-Dreirad, Zubehör (kein Lastenrad) (12.11.2026).
- Kein Hinweis auf ein nächstes i:SY-Treffen (es gibt keins mehr, 12.11.2026).
- Showroom: Van Raam (jeder 5. Wechsel, abwechselnd Easy Rider und Easy Rider Compact Plus), Velo de Ville AEB PRO (ca. jeder 7.), Victoria Veloa 7 (ca. jeder 9.), Stevens E-Juke (ca. jeder 10.) mit festem Bild; alle anderen Wechsel zufällig aus dem Bestand (nur Räder mit Foto, wechselnde Farben, Bilder in img/show/ freigestellt + geschärft) (12.11.2026).
- E-Dreiräder: Easy Rider Compact Plus (zuerst, genauso wichtig) und Easy Rider 3 mit Umschalter; nur Herstellerangaben von vanraam.com, nur offizielle Van-Raam-Videos (keine Videos anderer Händler) (13.11.2026).
- E-Dreiräder: Easy Rider 3 und Compact Plus gleichwertig untereinander (kein Verstecken per Umschalter), Vergleichstabelle oben; „Weltmarktführer“ darf stehen (13.11.2026). Korb-Aktion von Van Raam auf Wunsch von Tiry wieder entfernt (läuft nur bis 15.11.2026).
- Nie ein Dreirad ohne Motor auf der Seite anbieten; kein Grundmodell ohne Motor erwähnen (13.11.2026).
- Showroom startet bei jedem Aufruf mit einem zufälligen Bestandsrad (nicht immer i:SY); Markenleiste zeigt je Marke ein zufälliges Bestandsrad (13.11.2026).
- Showroom: keine Wiederholung desselben Rads (gleiches Modell + Farbe nur einmal im Pool, bildgleiche Dubletten raus); Startbild erst sichtbar, wenn das Zufallsrad steht (13.11.2026).
- Winter-Aktion: Zusatz „nur solange Termine verfügbar sind“ (13.11.2026).
- Showroom-Zufall über crypto (nicht Math.random), zuletzt gezeigte 24 Räder werden im Browser gemerkt (vc_srl) – jeder Besuch eine andere Reihenfolge (13.11.2026).
- Fahrzeugbestand steht nur an einer Stelle: eingebettet in index.html (#bestandData). Update: `python3 tools/bestand_zu_json.py <Veloport-Export.csv>` schreibt direkt dort hinein; data/bestand.json gibt es nicht mehr (13.11.2026).
- Livegang: Live-Fassung nur über tools/live_bauen.py aus index.html bauen; Ablauf und offene Punkte in LIVEGANG.md (13.11.2026).
- Admin (13.11.2026): Live-Seite nur über `/admin` mit Benutzer + Passwort (Firebase Authentication, Rechte über Firestore-Regeln, Spark-Tarif). Kein versteckter 5-Klick auf der Live-Seite. Kein Passwort und kein Passwort-Prüfwert im Code. Prototyp bleibt hinter der claude.ai-Anmeldung.
- Logo Startseite (13.11.2026): kein Reinfliegen der roten Teile, Logo steht sofort da, Schimmer läuft regelmäßig weiter (alle 7 s).
- Admin Bestand (13.11.2026): Knopf „Bearbeiten“ je Rad; je Farbe Verfügbarkeit Angeliefert/Bestellt + Häkchen „Reserviert“ (überschreibt Veloport, bleibt nach Import).
- Öffnungs-Status (13.11.2026, Tiry: keine Extraleiste, „richtig modern“): Graphit-Kapsel im Kopf vor „A+“ (passend zu den dunklen Knöpfen, 2. Fassung 13.11.: kein Regenbogen-Rand mehr), Statusfarbe nur als Licht (Grün/Gelb/Rosé) mit Fortschritts-Ring und Glanz-Schimmer, live aus den Öffnungszeiten (Europe/Berlin), Feiertage RLP = zu, Mittagspause, „Schließt gleich“ ab 30 Min. Maus drüber = Karte mit Wochen-Öffnungszeiten (heute markiert) + Anruf-Knopf. Passt sich dem Platz an (`hdrFit`: zweizeilig → einzeilig → nur Ring; beim Scrollen Social-Symbole aus). Handy: Kurztext ab 375 px, darunter nur Ring; ohne WhatsApp-Symbol im Kopf. „A+“ bleibt rechts (Verschieben bringt im Raster keinen Platz).
- Hero-Überschrift (13.11.2026, Tiry): „Dein E-Bike & E-Dreirad-Spezialist mit eigener Werkstatt.“ (ohne Bindestrich vor „&“, „&“ rot im Verlauf).
- Bestand-Zahl (13.11.2026, Tiry): überall „300+ E-Bikes“ statt „200+ Räder“ (Laufband, Hero-Text, Hero-Chip, Showroom, Vorteile).
- Hero-Schilder (13.11.2026, Tiry): klickbare Glas-Kapseln mit Verlaufsrand, roter Plakette und Pfeil, KOMPAKT (ca. 38 px hoch, eine Zeile – Tiry: größere Fassung „viel zu groß“). „300+ E-Bikes vor Ort“ → Lager, „Probefahrt vor Ort“ → Terminformular mit „Probefahrt“ vorgewählt.
- Leasing-Hinweis (13.11.2026, Tiry): unter den Leasing-Logos Kapsel „Dein Leasing-Anbieter ist nicht dabei? Frag einfach nach – wir arbeiten noch mit weiteren Anbietern zusammen“ mit Knopf „Nachfragen“ → Kontakt.
- Winter-Hinweis im Terminbereich (13.11.2026, Tiry: „schicker“): Kapsel mit Eis-Verlaufsrand, drehender Schneeflocke, Glanz, Tage-Zähler als dunkle Plakette, Pfeil → Aktion. Text bleibt: –20 € je Inspektion + Sattelüberzug, nur solange Termine frei.
- Foto Laden-Eingang (13.11.2026, Tiry): Kartons rechts neben dem Eingang wegretuschiert (Wand, Gras, Pflaster rekonstruiert).
- Rad teilen (13.11.2026, Tiry): Knopf „Teilen“ im Rad-Fenster (Handy: Teilen-Menü, PC: WhatsApp + Link kopiert). Link `#rad=<marke-modell>` öffnet genau dieses Rad im Lager.
- Saison-Schalter (13.11.2026, Tiry): ab 01.03. nach der Winter-Aktion automatisch „Frühjahrs-Check“ (März/April, Kachel 03 + Streifen beim Termin, ohne Preis – Preis/Inhalt legen Stefan/Tiry fest). Außerhalb Winter/Frühjahr Kachel 03 = Inspektion. Winter-Link „Zur Winter-Aktion“ nur im Winter.
- Gutscheine (13.11.2026, Tiry): Band „Gutscheine vom Velocenter – bei uns im Laden erhältlich“ jedes Jahr 10.11.–24.12. auf der Startseite, Klick → Öffnungszeiten. Keine Beträge/Inhalte genannt.
- Unterseiten für Google (13.11.2026, Tiry): Live-Fassung hat echte Seiten /service/, /hersteller/, /lager/, /isy-experte/, /isy-treffen/, /e-dreiraeder/, /kontakt/, /impressum/, /datenschutz/ mit eigenem Titel/Beschreibung/canonical (alte Coco-Adressen bleiben gültig), Sitemap mit allen. Besucher landen danach im gewohnten #-Bereich.
- Umstellung www.velo-center.de (13.11.2026, Tiry): dauert noch, Stefan braucht mehr Zeit – bis dahin nur Testadresse, kein Druck.
- Admin 2.0 (13.11.2026, Tiry: Stefan soll selbst alles ändern können): Seitenleiste neu (Gruppen Überblick/Räder/Homepage/Hilfe & Verlauf, runde Symbol-Kacheln, Verlaufs-Pille, Nutzer-Karte „Hallo, <Name>“, Ladenstatus oben). Neue Reiter: **Öffnungszeiten** (Wochenzeiten mit Pause, 3-Wochen-Vorschau, Ausnahmen = Betriebsferien/Sonderzeiten mit Ankündigung N Tage vorher; gespeichert in `site/einstellungen.zeiten` als Text „09:00-12:00,14:30-18:00“ je Wochentag, `ausnahmen:[{von,bis,zeiten,txt,ank}]`), **Hinweise & Aktionen** (Hinweis-Pille über der Start-Überschrift mit Farbe/Ziel/Zeitraum `meldung`; ohne Hinweis kündigt die Pille automatisch die nächste Ausnahme an; Schalter Winter-Aktion/Gutscheine/Frühjahrs-Check + Gutschein-Text `aktion`), **Protokoll** (`site/protokoll`, letzte 300 Änderungen mit Name + Uhrzeit, jede Speicher-Stelle schreibt mit), **Hilfe** (Schritt-Karten), Übersicht mit Karte „Die Homepage gerade“. Statusanzeige, Öffnungszeiten-Listen, Fußzeile und Schnellzugriff rechnen mit Zeiten + Ausnahmen. Einstellungen werden komplett zusammengeführt gespeichert (keine Felder gehen verloren).
- Analyse (13.11.2026, Tiry): eigene Besucherstatistik ohne Cookies, ohne Speicher beim Besucher, ohne IP: je Tag ein Dokument `stats/JJJJ-MM-TT` mit Summen (bs Besuche, pv Seitenaufrufe, s_ Bereiche, c_ Klicks, b_ Räder, r_ Herkunft, dv_ Gerät, h_ Stunde, sh_ Teilen-Kanal), Hochzählen per REST-commit. Nicht gezählt: Do-Not-Track/GPC, Admin-Geräte (nach Admin-Login, abschaltbar), Bots (webdriver). Regel in `firebase/firestore.rules` (match /stats) **muss Tiry in der Firebase-Konsole veröffentlichen**, sonst zählt nichts. Datenschutz-Absatz „Anonyme Besucherstatistik“ steht in der Live-Fassung.
- Teilen-Fenster (13.11.2026, Tiry): Rad-Fenster → „Teilen“ öffnet Auswahl WhatsApp, E-Mail, SMS, Facebook, Telegram, X, Link kopieren, auf dem Handy zusätzlich „Weitere Apps“ (System-Teilen). Handy = Fenster von unten.
- Bearbeiten-Modus (13.11.2026, Tiry: „Stefan soll komplett alles bearbeiten können“): Admin → „Seite direkt bearbeiten“ (Seitenleiste unten, Übersicht, Hilfe). Jede Überschrift, jeder Absatz, jede Liste der Homepage antippen und tippen; Bild antippen = austauschen (Upload wie Rad-Fotos). Leiste unten: Original · Verwerfen · Speichern · Fertig. Gespeichert in `site/texte` = {ov:{Schlüssel:HTML}, img:{Schlüssel:Bild}} – Schlüssel = Prüfsumme des Original-Texts bzw. der Original-Bildadresse. Nur Fett/Kursiv/Zeilenumbruch erlaubt (alles andere wird beim Speichern und Anzeigen entfernt). Ausgenommen: Formulare, Knöpfe, Links, Öffnungszeiten, Rad-Fenster, Rechner/Finder (haben eigene Admin-Reiter). **Achtung:** Wird ein Text im Code geändert, greift Stefans Änderung an genau diesem Text nicht mehr (alter Schlüssel). Lese-Regel `site/texte` öffentlich – **Firestore-Regeln muss Tiry in der Konsole veröffentlichen.**
- Claude im Admin (13.11.2026, Tiry: „Stefan soll mit Claude schreiben wie ich, sofort live“): Reiter „Claude (KI)“ (Gruppe Homepage). Nachricht → Firestore `claude/<id>` {txt, von, ts, typ auftrag|zurueck, status neu→arbeitet→fertig|nichts|fehler, schritt, antwort, commit} → Admin startet sofort per GitHub-API den Lauf `.github/workflows/homepage-claude.yml` (Repo Tiry38/Tiry, muss auf `main` liegen) mit der Auftrags-ID. Lauf: Claude (Opus, Effort mittel, Abo-Token `CLAUDE_CODE_OAUTH_TOKEN`, nur Lesen/Schreiben von Dateien) ändert `velocenter-homepage/` nach `tools/claude_regeln.md` → Prüfung (nur index.html/ENTSCHEIDUNGEN.md/img erlaubt, Sperrwörter, Bau, `tools/js_pruefen.js`) → Commit auf den Homepage-Zweig → Live-Fassung nach velo-center-web (`WEB_TOKEN`) → Antwort zurück (Bot-Konto `claude@admin.velo-center.de`, `FB_CLAUDE_PW`, darf nur Status/Antwort schreiben). „↩ Rückgängig“ an jeder Antwort = `git revert` des Commits + neu live. Start-Token (Fine-grained, nur „Actions: Read and write“ auf Tiry38/Tiry) in `geheim/github`, nur Admins lesbar. Dauer 2–5 Min. Rechtstexte ändert Claude nicht; Öffnungszeiten/Räder/Hinweise verweist Claude auf die Admin-Reiter.
- Analyse erweitert (13.11.2026, Kevin per Admin-Chat): Zeitraum „Heute“, Kennzahlen Anfragen/Ø Besuche pro Tag/Bester Tag, Karte „Auf einen Blick“ (automatische Erkenntnisse), Vergleichs-Pfeile je Zeile, Karten „Räder geteilt über“ (sh_), „Kontaktwege im Vergleich“, „Besuche je Monat“ (ab 90 Tage), Tabelle „Tag für Tag“ und Knopf „Als Tabelle speichern“ (CSV für Excel). Nur vorhandene Zähldaten, nichts Neues erfasst.
- 13.11.2026 Impressum 1:1 aus der geprüften Fassung von velo-center.de übernommen (Haftungsausschluss, BFSG/BITV-Hinweis, Bildquellen nur Hersteller der neuen Seite). Datenschutz NICHT 1:1 (alte beschreibt COCO, AWS, Google Analytics/Ads/Maps, Kontaktformular – gibt es auf der neuen Seite nicht); übernommen nur Social-Media-Abschnitt (Facebook/Instagram) und Kontakt der Aufsichtsbehörde.
- Bilder-Agent (13.11.2026, Tiry: „dauerhaft Bilder für Auf Lager suchen, prüfen, neue rein, alte raus“): GitHub-Lauf .github/workflows/homepage-bilder.yml, jede Nacht 01:23 UTC + Knopf im Admin → Fotos. Claude (Opus, Effort mittel) sucht je Lauf bis 15 Farben ohne Foto und prüft 6 vorhandene: Herstellerseiten zuerst, Artikelnummern, andere Shops nur zum Finden; übernommen wird nur das offizielle Studio-Herstellerfoto, ein Rad, keine Personen. Werkzeug tools/bilder_agent.py (liste/holen/anwenden/uebernehmen/ablehnen/aufraeumen), Regeln tools/bilder_regeln.md. Sicher (Modell + Farbe eindeutig) = sofort live; unsicher = Freigabe im Admin (Übernehmen/Ablehnen, Abgelehntes nie wieder). Admin-Fotos werden nie angefasst. Foto-Zuordnung steht jetzt in index.html #bilderData (gilt auch für den Firebase-Bestand), data/bilder.json entfällt; Bericht #bilderBericht, Merkzettel data/bilder_status.json. Alte Bilder: unbenutzte Dateien werden gelöscht, Zuordnungen nach 120 Tagen ohne Bestand entfernt.
- **13.11.2026 – Bilder-Agent ohne Freigabe (Tiry):** Alles, was der Agent findet, geht sofort live – auch „unsichere“ Funde (Farbe nicht 100 % schriftlich belegt); diese sind im Admin nur markiert. Notbremse: „✕ Falsch“ am Foto → Foto fliegt raus, Quelle wird gesperrt, nächster Lauf sucht neu.
- **13.11.2026 – Bilder-Agent „✓ Richtig“ (Tiry):** Neben „✕ Falsch“ gibt es „✓ Richtig“: Foto verschwindet aus „Zuletzt neu“ und wird vom Agenten nie mehr ersetzt (`pinned`). Fotos unter „Zuletzt neu“ lassen sich groß ansehen.
- **13.11.2026 – Serviceräder (Tiry):** Im Veloport-Export als Servicerad markierte Räder sind Leih-/Testräder und kommen nie auf die Seite. Einzige Ausnahme: Van-Raam-Vorführrad.
- **13.11.2026 – Gutschein-Band (Tiry):** statt Pillen-Leiste eine gezeichnete Gutscheinkarte (Rot-Violett-Verlauf, Goldschleife, Velocenter-Logo) mit Text, Schlagwörtern und Knopf. Ohne Betrag (keine Angaben erfunden).
- **13.11.2026 – Freistellung:** VdV AEB PRO French Lavender – schwarzer Block unter dem Gepäckträger entfernt; QiO Compact PE Lunar White im Showroom neu aus dem sauberen Lager-Foto (vorher gezackte helle Kanten).
- **13.11.2026 – Vertrauens-Zeile (Tiry):** Google-G + „Google“ in Google-Farben, Bosch-Anker + „Bosch“ in Bosch-Rot, i:SY-Weltrekord-Button (klein, `img/isy-weltrekord-sm.webp`) + „i:SY“ in Orange.
- **13.11.2026 – Bilder-Agent Qualitäts-Runde (Tiry):** nach Suchen/Prüfen jede Nacht 36 Lager-Fotos reihum auf Schärfe, Klarheit und Freistellung (Prüfbögen auf Kontrast-Hintergrund, 6 Fotos je Blick). Mängel → bessere Fassung derselben Farbe suchen. Feste Anzahl statt „1 Stunde“, damit die Abo-Nutzung planbar bleibt; alle Fotos sind in ca. 4 Nächten durch.

- **13.11.2026 – Konfigurations-ID (Velo de Ville):** Veloport-Spalte „Konfigurations-ID“ (bzw. „Velo-ID“) wird gelesen. Der Bilder-Agent lädt die ID im Velo-de-Ville-Konfigurator und übernimmt das exakte, schon freigestellte Radbild (Vorrang vor anderen Funden). Der öffentliche Konfigurator kennt nur die aktuelle Kollektion (V27); V25/V26 → normale Suche.

- **13.11.2026 – Bilder-Agent Laufanzeige:** Nach „Jetzt suchen“ sofort „Startet gerade …“ (bis GitHub den Lauf meldet, max. 4 Min., prüft alle 6 s), danach „Sucht gerade · seit …“ als Pille neben der Überschrift + gesperrter Knopf, bis der Lauf fertig ist (prüft alle 20 s).

- **13.11.2026 – i:SY Experte / Treffen (Tiry):** Reiter i:SY Experte zeigt nur, was UNS auszeichnet (Modellauswahl 100+, Probefahrt mit Testrädern/Wochenende, Beratung, Wartung nach i:SY-Standard, seit 10+ Jahren, auf Messe entdeckt, Premium-Händler D/Benelux laut Pfalz-Express 2022). Keine allgemeinen Markeninfos (Zahlen, Preise, Modelle). Nichts zum Treffen dort – Chronik 2017–2024, Stimmen Kuhlmeier/Schumacher und Presse-Links stehen im Reiter i:SY Treffen. Werbe-Bus „erster und einziger“ bleibt (Tiry bestätigt). Start: „Aus Wörth für Wörth“ inkl. ADFC-Fördermitglied (Tiry bestätigt). Google: 4,8 bei 221 Rezensionen (Stand 13.11.2026). Wir gehören keinem Verbund an (keine ZEG o. ä.).

- **13.11.2026 – i:SY Experte, Fakten von Tiry:** Experte seit 2015, über 1.000 i:SY verkauft (Stand 1.003), Testräder SKYFLY CX/SX, N3.8 ZR F, E5 ZR RT, E5 ZR RT Pop Art, XXL N3.8 (2021), Ersatzteile fast alle auf Lager, Kunden u. a. aus Berlin und Hamburg. Dazu Zitat isy.de („die i:SY Experten von Velocenter Hessert“), Stefan in der Rheinpfalz-Themenwelt 2024 (Fokus Kompakträder, 95 % E-Bikes), Leitsatz vom Bus „Ihr Kompaktrad-Spezialist in Wörth am Rhein“.

- **13.11.2026 – i:SY-Experte-Logo + Auszeichnungen (Tiry):** Offizielles Logo „i:SY Experte 2026“ (von velo-center.de, neu gerechnet scharf: `img/isy-experte-2026.webp`) unter den vier Werten (2015 · 100+ · 2 Tage · 1.000+) im Reiter i:SY Experte, nicht im Kopfbild (Tiry) – darf gezeigt werden (offizieller Experte, hängt im Laden). Dazu „5 Jahre in Folge als i:SY Experte ausgezeichnet“ (2022–2026, Tiry). Ab 2027: neues Logo einsetzen und Jahres-Pille ergänzen.

- **13.11.2026 – i:SY Experte, Bild neben Porsche-Zitat (Tiry):** statt olivem E5 jetzt i:SY N3.8 ZR CX Auto Comfort in **Happy Orange** (`img/p-isy-orange.webp`, Original-Herstellerbild ZEG-CDN, freigestellt). `p-isy2.webp` bleibt im Ordner.
- **13.11.2026 – i:SY Testflotte (Tiry: „muss anders präsentiert sein“):** Testräder nicht mehr als Pillen, sondern eigene Bühne `#tflot` zwischen Porsche-Zitat und „Warum zu uns“: 5 Herstellerbilder (ZEG-CDN) auf farbigen, weich animierten Blobs, gestaffelt, Handy = Wisch-Leiste. Namen nach Tiry: SKYFLY (CX/SX), N3.8 ZR F, E5 ZR RT, E5 ZR RT Pop Art, XXL N3.8. Bilder = aktuelle Modellfarben, nicht zwingend die Farbe des echten Testrads. Link `#tflot` (ALIAS) aus der Zeile „Probefahrt mit Testrädern“.
- **13.11.2026 – Testflotte 6 Räder (Tiry):** Bilder nach Tiry: SKYFLY Carbon-Schwarz + XXL N3.8 Gelb (aus Tirys Bildern freigestellt), N3.8 ZR + E5 ZR RT Gelb (Herstellerbild über eure Artikelnummern 323000580600 / 323000140600), neu N3.8 ZR CX Auto Comfort Berry Red (325800100086), Pop Art bleibt. Raster 3 pro Reihe, mittleres Rad versetzt; Handy = Wisch-Leiste.
- **13.11.2026 – Testflotte bestätigt (Tiry):** SKYFLY als Testrad in CX- **und** SX-Variante (Text „mit CX- und SX-Motor“ bleibt). P12 ZR kommt **nicht** in die Testflotte, obwohl im Veloport-Bestand als Testfahrzeug markiert.
- **13.11.2026 – „5 Jahre in Folge“ (Tiry):** statt Kachel mit Jahres-Pillen: Überschrift + 5 runde i:SY-Experte-Logos (`img/isy-experte-rund.webp`, aus Tirys Bild freigestellt) nebeneinander, Jahrgang rechts unten als dunkle Pille mit oranger Zahl (wie Flagship-Store-Schild), 2026 mit Ring hervorgehoben. Eckiges „Experte 2026“-Logo links bleibt.
- **13.11.2026 – Treffen-Chronik neu (Tiry: „schöner gestalten“, „zu viel Platz“):** statt 5 Kästen ein Zeitstrahl: geschwungene Verlaufslinie (orange→pink→violett) mit wandernden Punkten, je Jahr rundes Foto aus der eigenen Treffen-Galerie (`img/chr-<Jahr>.webp`, Motive ohne erkennbare Gesichter), Jahr groß im Verlauf, Titel + Text; 2024 hervorgehoben mit „283 Rekord“-Plakette. Handy: senkrechte Linie links. Abstände Urkunde → Chronik → Stimmen deutlich verkleinert (`.tsq`, `.tsq2`).
- **13.11.2026 – Lions (Tiry):** Verkaufsstelle des Lions-Adventskalenders auch 2026 → Chip „2025 und 2026“.
- **13.11.2026 – Winter-Aktion-Leiste neu (Tiry: „wesentlich schöner“):** Karte `.wstrip.wcard` im Termin-Bereich: Winternacht-Verlauf mit Schneefall, großes „–20 €“ + „auf jede Inspektion“, pinker Chip „🎁 + Sattelüberzug geschenkt“, „Bis 28.02.2027 · nur solange Termine frei“, Knopf „Jetzt Termin sichern“, Countdown-Ring mit Tagen (`.wsd`, Ein-/Ausblenden über die bestehende Winter-Logik). Nie Prozent.
- **13.11.2026 – Dienstrad-Rechner (Tiry):** Steuerklassen als 1 · 2 · 3 · 4 (keine römischen Zahlen); Klasse 2 mit Entlastungsbetrag 4.260 €, 4 wie 1 (ohne Faktor). Fehler behoben: Ergebnisliste rechts war leer/unlesbar, weil die Klasse `.drl` doppelt vergeben war (Dienstrad-Infoliste) → Rechner-Liste heißt jetzt `.drcl`.
- **13.11.2026 – Dienstrad-Rechner Klasse 5 (Tiry):** Knopf 5 ergänzt (Ehepartner bei 3/5), gerechnet nach der Klasse-5/6-Formel (2×(T(1,25x)−T(0,75x)), mind. 14 %, darüber 42 %/45 %), Grenzwert W1 angenähert → im Kleingedruckten „nur grobe Schätzung“. Klasse 6 bewusst nicht (nur Zweitjob, Dienstrad läuft über Hauptarbeitgeber).
- **13.11.2026 – Dienstrad-Rechner Pakete (Tiry):** neue Auswahl „Versicherung fürs Rad“ (Schon in der Rate / Kommt extra dazu = 0,3 % vom Kaufpreis/Monat, mind. 2,38 €, Satz BusinessBike/ENRA) und „Service-Paket“ (Keins / Inspektion / + Verschleiß / Rundum = JobRad-E-Bike-Pakete 7,90 / 12,90 / 19,90 € netto ×1,19). Werden vor Steuer mit umgewandelt. Quelle: belegte Daten aus Planer `src/ls_rec.js`. Feld „Leasingrate inkl. Versicherung / leer lassen = schätzen“ ersetzt durch „Monatsrate aus deinem Angebot · optional“ mit Klartext-Hinweis.

## 13.11.2026 – Winterkarte im Termin-Bereich wie Start-Aktion, Google-Chip kürzer (Tiry)
- Winterkarte (`.wstrip.wcard`) im Stil von `#deal`, nur kompakt: Anthrazit-Verlauf mit Schnee, rot/violetter Schimmer, kursives „–20 €“ (weiß → rosa), Sattelüberzug mit „Gratis“-Schild, Countdown Tage (rot) / Std / Min / Sek (`.wsd/.wsh/.wsm/.wss`, gleicher Zähler wie Start), roter Knopf „Winter-Termin sichern“. Ring entfernt.
- Start-Chip Google: nur noch „★ 4,8 bei Google“ (ohne Anzahl Rezensionen). Laufband und Bewertungsbereich unverändert.

## 13.11.2026 – Antworten Tiry zu offenen Punkten
- Eckiges Logo „i:SY Experte 2026“ bleibt neben den fünf Kreisen.
- Experte-Jahre 2022–2026 bestätigt.
- Keine besseren Originalbilder für SKYFLY, XXL und das runde Experten-Logo vorhanden – bleiben wie sie sind.
- Chronik-Texte 2017 und 2023 bleiben vorerst so.
- Google-Bewertung automatisch abrufen: angefragt, Weg wird mit Tiry geklärt (Places API per GitHub-Lauf oder über die KI-Zentrale).

## 13.11.2026 – Google-Bewertung automatisch (Tiry: „Weg 1“)
- Abruf über Places API (New) per GitHub-Lauf alle 3 Tage → `google.json` im Web-Repo; Homepage aktualisiert Chip, Bewertungsbereich, Laufband und Admin-Hinweis (`data-g`). Ohne Key/bei Fehler bleiben die Hand-Werte, die Seite zeigt nie einen Fehler; ein fehlgeschlagener Lauf meldet GitHub per Mail.
- Ort wird einmal per Textsuche gefunden (nur Treffer mit „Hartmannstr“ + 76744), danach fest per Place-ID.
- Einrichtung (Google Cloud, Key als GitHub-Secret) siehe LIVEGANG.md.

## 13.11.2026 – Google-Chip verlinkt (Tiry)
- Chip „★ 4,8 bei Google“ auf der Startseite ist ein Link (neuer Tab) zum Google-Unternehmensprofil: Maps-URL mit `query_place_id` (Place-ID aus `google.json`), Hover hebt leicht an.

## 14.11.2026 – Start entschlackt (Tiry)
- Startseite: Bereich „Unser Showroom“ (Marken-Karussell) und Rad-Finder-Teaser entfernt – beides gibt es schon oben, unter Marken bzw. Auf Lager. Rad-Finder bleibt über die Knöpfe auf Lager/Marken erreichbar.
- Showroom steht jetzt fest im Marken-Reiter (`#showroom2`, IDs `m-…`, kein Klonen mehr per JS) mit der Überschrift „Acht Marken. Ein Laden.“
- Start-Chip „i:SY Experte“ ist ein Link zum Reiter i:SY Experte (`#isy`), gleicher Hover wie der Google-Chip (Tiry 14.11.2026).

## 14.11.2026 – „Auf Lager“ heißt jetzt „Im Laden“ (Tiry)
- Menü (oben + Handy), Start-Kachel, alle Knöpfe („Räder im Laden“, „i:SY im Laden ansehen“, Marken-Knopf „Im Laden“, Vergleich/Rad-Finder „Alle Räder im Laden …“), Rad-Finder-Antwort „direkt aus dem Laden“, Wasserzeichen „Laden“, Google-Titel „E-Bikes im Laden · sofort verfügbar · …“, Admin-Texte.
- Adresse neu `/im-laden/` (Sitemap), alte `/lager/` leitet weiter. Interne Route/Hash bleibt `#lager`, Firestore/Daten unverändert.
- „Ersatzteile fast alle auf Lager“ (i:SY) bleibt – meint Teile, nicht den Reiter.

## 14.11.2026 – Live-Bestand auf der Startseite sichtbar (Tiry)
- Start-Optik bleibt. Zusatz: Schild „● Unser Live-Bestand · Jetzt ansehen →“ mit wanderndem Farbrand, Puls-Ring und wippendem Pfeil auf die Kachel „Im Laden“ (folgt der Kachel per ResizeObserver, am Handy im Bild gehalten). Link `#lager`.
- Kachel „Im Laden“: echte Räder aus dem Bestand (nur im Laden, mit Bild) laufen alle 2,8 s in zufälliger Reihenfolge durch (`qlFill`/`qlNext`, nur wenn Start sichtbar), Ladenfoto dahinter abgedunkelt.
- Menü: kleines „● LIVE“-Schild an „Im Laden“ (oben + Handy-Menü).
- Großer Start-Banner „Schau in unseren Laden“ verworfen (Tiry).
- Hinweis: „Live“ = Stand des zuletzt eingespielten Veloport-Exports, nicht sekundengenau.
- Start oben: Chip „Probefahrt vor Ort“ ersetzt durch „LIVE · Unser Live-Bestand · Jetzt ansehen“ (`#hLive`, Link `#lager`), roter Pfeil darunter zeigt automatisch auf die Kachel „Im Laden“ (Winkel per JS). Alter Hinweis über den Kacheln entfernt (14.11.2026).
- Showroom ganz oben (Start): die 7 festen Bilder laufen genau 1× durch, danach nur noch zufällige Bestandsräder mit eigenem Foto (img/show/, nie Katalogbild), zufällige Farben, gleiche Farbe nie zweimal hintereinander; Markenlogo wechselt mit (14.11.2026).
- Kachel „Im Laden“: kein weißes Aufblitzen mehr beim Radwechsel (Bildklassen hießen `in`/`out` und erbten den grünen Hinweis-Kasten `.out` → jetzt `qin`/`qout`). Pfeil am Live-Chip modern: schlanke Leuchtlinie mit wanderndem Licht + runder roter Pfeil-Knopf, zeigt automatisch auf die Kachel (14.11.2026).
- Zufallswechsel nach Marken-Runden (Showroom oben + Kachel „Im Laden“): jede Marke mit eigenem Bestandsfoto kommt pro Runde genau 1× in zufälliger Reihenfolge, nie dieselbe Marke direkt hintereinander, Rad innerhalb der Marke zufällig (`bagNext`). Stevens in der Markenerkennung ergänzt; Victoria-Bestandsfotos (b2-rest-0…5) als Showroom-Fassung in img/show/. Velo de Ville hat kein Bestandsrad mit eigenem Foto und fehlt deshalb im Zufallswechsel (14.11.2026).
- Start aufgeräumt (Tiry): Pille „i:SY Experte“ und Öffnungsstatus („Gerade geschlossen …“) unter den Knöpfen entfernt (stehen beide oben in Navi/Kopfzeile), Pfeil unter dem Live-Chip entfernt. Unter den Knöpfen nur noch Google + Bosch Service Center (14.11.2026).
- „Aus Wörth für Wörth“ neu gestaltet: Glas-Karte mit Farbverlauf-Rand, Kopf „Engagement vor Ort“, je Eintrag Farbkreis mit Symbol, Jahres-Pille, Titel + Zeile (Kinderfasching 2020, Stadtradeln-Rallye 2021, Lions-Adventskalender 2025 · 2026, ADFC Fördermitglied); Inhalte unverändert (14.11.2026).
- „Aus Wörth für Wörth“ nochmal umgebaut (Tiry: passte nicht zu den anderen Elementen): keine Karte/Emojis mehr, gleiche Formensprache wie die Service-Liste daneben (`srow wrow`: getönte Icon-Fläche mit Linien-Symbol, Trennlinien, Jahr als farbige Kleinzeile), Überschrift als Eyebrow wie „Unser Versprechen“; PC zweispaltig, Handy einspaltig (14.11.2026).
- „Unser Versprechen“: Ladenfoto (Blob) unter „Aus Wörth für Wörth“ entfernt – stand allein links und machte viel Leerraum; beide Spalten enden jetzt bündig. Das Foto bleibt Hintergrund der Kachel „Im Laden“ (14.11.2026).
- **Zurück auf „Auf Lager“ (Tiry 14.11.2026, ersetzt den Eintrag „heißt jetzt Im Laden“):** Menü (oben + Handy, mit LIVE-Schild), Start-Kachel „Auf Lager“ („Jetzt auf Lager ansehen“), Knöpfe „Räder auf Lager“, „i:SY auf Lager ansehen“, Marken-Knopf, Rad-Finder, Vergleich, SEO-Titel, Wasserzeichen „Lager“, Admin-Texte wie vor 3ae7ff8. Adresse wieder `/lager/` (Sitemap), `/im-laden/` leitet auf `#lager` weiter. Texte, die wörtlich den Laden meinen („Räder im Laden“ als Zahl, „Bei uns im Laden“, Gutscheine), bleiben.
- Marken-Showroom: Chip „● LIVE · Unser Live-Bestand · Jetzt ansehen“ oben mittig über dem Rad, Link `#lager` (14.11.2026).
- Marken-Showroom sieht jetzt aus wie der Showroom auf Start (Tiry 14.11.2026): gleiche Bausteine `hvis` (Ring, Markenlogo, Rad, Boden-Linie, Chip „300+ E-Bikes vor Ort“ oben rechts, „LIVE · Unser Live-Bestand“ unten links), ohne Pfeile; Marken-Leiste darunter bleibt klickbar, Wischen geht weiter, Info-Zeile mit Marken-Links bleibt. Klasse `mvis`.
- Laufband oben: „4,8 ★ Sterne bei Google“ statt „4,8 ★ · 221 Google-Rezensionen“, Stern gelb (#FFC83D, leichtes Leuchten); Wert kommt weiter automatisch aus google.json (14.11.2026).

## 14.11.2026 – Profi-Feinschliff (Tiry: Punkte 1, 3, 4, 5, 7 + Menü edler)
- Eine Formregel: Knöpfe/Chips = Pille, Icon-Flächen = Kreis, Karten = 28 px Radius.
- Helle Abschnitte ohne eigene Farbtöne (Zonen-Verläufe aus), Abschnitts-Abstand 64–100 px statt 140/168 px.
- Kundenstimmen: drei Karten nebeneinander neben der 4,8 (Sterne gelb), Punkte-Navigation aus; Struktur `#qs .q` bleibt (Admin-Bearbeitung).
- Handy: Logo 200 px, Showroom-Rad direkt unter der Überschrift (Reihenfolge per `display:contents` + `order`).
- ADFC: eigenes Herz-Symbol `i-heart` statt Platzhalter. „Besuch uns“: Zeiten auf heller Glas-Karte.
- Kopf: Menü als Glas-Pille mit Verlaufsrand, aktiver Reiter dunkle Pille; Kopf-Raster `auto 1fr auto`, unsichtbares Logo fällt im Startbereich zusammen → Öffnungsstatus zeigt auf dem Desktop (ab 1400 px) wieder Text.
- Punkt 6 (neue einheitliche Fotos) kommt nach dem Laden-Umbau – nur vorgemerkt.

## 14.11.2026 – Marken-Showroom schneller (Tiry: „dauert ewig“)
- Automatischer Wechsel alle 4 s statt 7 s; Pause bei Maus über dem Showroom entfernt (am PC lag die Maus fast immer drauf → kein Wechsel). Nach Klick/Wischen weiter 20 s Ruhe.

## 14.11.2026 – Marken-Showroom mit Markenrunden (Tiry: ja)
- Automatischer Wechsel nimmt je Runde jede Bestandsmarke einmal (bagNext, eigener Beutel MB), nie dieselbe Marke zweimal hintereinander; feste Einschübe (Van Raam, VdV, Victoria, Stevens) bleiben.

## 14.11.2026 – i:SY Werbe-Bus: Räder drehen, freigestellt (Tiry)
- Fahrt-Animation am Wrapper `.bus`, zwei Räder als eigene runde Scheiben (`img/isy-bus-rad-f/r.webp`: Reifenring gezeichnet, Felge aus dem Foto) drehen mit (1,3 s/Umdrehung, passend zur Fahrgeschwindigkeit); reduced-motion = Stillstand.
- Reifen sauber rund freigestellt (alte flach abgeschnittene Reifenkanten unterhalb der Schwelle entfernt).
- Fenster: Innenraum/Transporter im Hintergrund ersetzt durch dunkel getöntes Glas mit Spiegelstreifen; Fensterrahmen an den im Foto gemessenen Positionen nachgezeichnet, QNV bleibt.
- Original: `img/quelle/isy-bus-original.webp`, Werkzeug: `python3 tools/bus_bearbeiten.py img/quelle/isy-bus-original.webp img`.

## 14.11.2026 – Bus-Fenster professionell neu (Tiry: „sehen schrecklich aus“)
- Flache Kästen mit Streifenmuster verworfen. Neu: Original-Glas aus dem Foto stark weichgezeichnet und dunkel getönt (Licht bleibt echt, Transporter/Innenraum unsichtbar), dunkles Siebdruck-Band über den Scheiben wie beim Original, sanfte Himmelsspiegelung von oben, zwei breite weiche Lichtreflexe, Rahmenstege mit weicher Kante + Innenschatten.
- Regel: Bildbearbeitung erst nach Nahansicht (3-fach Zoom) ausliefern.

## 14.11.2026 – Bus: Front, glatte Kanten, Abgasdampf (Tiry)
- Front exakt nach den Glasformen im Original maskiert: Außenspiegel bleibt original, schräge Unterkante des Fahrerfensters, Säulen durchgehend (vorher Rechteck über die ganze Front).
- Bild in 3-facher Auflösung (2940×759) neu gerechnet: Hochrechnen mit vormultipliziertem Alpha, Außenkante geglättet (Weichzeichnen + weiche Schwelle), Fenster/Rahmen/Räder in hoher Auflösung gezeichnet → keine Treppenkanten mehr auf Retina. Profil-Striche am Reifen entfernt, Lüftungsgitter-Oberkante schräg exakt freigestellt.
- Abgasdampf: 4 weiche graue Wölkchen am Heck, versetzt (2,6 s), wachsen, ziehen nach hinten weg und verblassen; aus bei „weniger Bewegung“.

## 14.11.2026 – Ticker: „4,8 ★ bei Google“ (Tiry: Wort „Sterne“ raus)
- Text und Aktualisierung aus google.json (Regex) angepasst.

## 14.11.2026 – Ticker „Weltrekord 283 i:SY's“ (Tiry)
- „i:SY's“ in kräftigem Orange (#FF7A00, Leuchten), Markenschreibweise ohne Großbuchstaben (Klasse `tko` in tkIt).

## 14.11.2026 – Ticker: Bosch-Pille + i:SY orange (Tiry)
- „Bosch“ im Laufband wie der Chip im Hero: weiße Pille mit kleinem Bosch-Logo (zub-bosch.svg) und roter Schrift #ED0007 (Klasse `tkb`); „i:SY“ in „i:SY Experte“ kräftig orange (`tko`).

## 14.11.2026 – Ticker: Bosch auf einer Linie, 300+ hervorgehoben (Tiry)
- Bosch-Pille saß tiefer: Grundlinie kam vom leeren Logo-Element. Jetzt Pille inline-block auf Text-Grundlinie, Logo als ::before (auf den Ring zugeschnitten).
- „300+“ goldgelb #FFC83D, 1,14-fach, Leuchten (Klasse `tkn`).

## 14.11.2026 – Ticker: Bosch-Pille umschließt nur die Großbuchstaben
- Pille als ::after mit top .02em / bottom .1em (ohne Unterlängen-Raum), Text bleibt auf der Grundlinie → keine optische Verschiebung nach unten mehr.

## 14.11.2026 – Ticker-Trenner neu (Tiry: ✦ wirkt wie KI-Wasserzeichen)
- ✦ ersetzt durch schrägen Doppel-Leuchtstrich (Verlauf Weiß → Gold → Orange, zweiter Strich halbtransparent, leichtes Leuchten), reines CSS am leeren `em`.

## 14.11.2026 – Ticker-Trenner: Funkelstern zurück, in Türkis (Tiry)
- Doppelstrich verworfen; ✦ wieder da, Farbe #5EEAD4 mit Leuchten (nicht rot/gelb/orange, Tiry).

## 14.11.2026 – Ticker: gleiche Schriftlinie, Sterne mittig (Tiry)
- „300+“ (1,14-fach) drückte die Zeile 4 px tiefer → `line-height:0` am `tkn`; gemessen: alle Begriffe Grundlinie identisch.
- Stern war links 12 px / rechts 48 px vom Text entfernt → Span-Innenabstand 0, Stern `padding:0 .72em` → beidseitig gleich.

- 14.11.2026: Showroom-Beleuchtung von oben in Start- und Marken-Showroom: weicher Lichtkegel aus der Decke, Lichtfleck am Boden + Kontaktschatten. Keine sichtbare Lampe (Tiry: „es braucht keine lampe! die BELEUCHTUNG REICHT!“).

- 14.11.2026: Showroom-Beleuchtung wieder komplett entfernt (Tiry: „mach die beleuchtung wieder weg“). Showrooms wie vorher.

- 14.11.2026: Ausgeblendete Räder/Farben (Bestand-Verwaltung) laufen in keinem Showroom mehr. Ursache: Showroom-Liste wurde nur beim ersten Laden gebaut, spätere Ausblendungen aus der Datenbank kamen nicht an. Jetzt bei jeder Bestandsänderung neu (admRefresh → srBuild).

- 14.11.2026: Kennzahlen E-Dreiräder (Compact Plus + Easy Rider 3) neu: Glas-Leiste mit sanft wanderndem Farbschimmer statt weißer Pillen im Rahmen, neue Linien-Symbole im Stil der Seite (Einstieg, Maßpfeile Länge/Innenbein, Speichenrad, Gewicht, Tacho, Akku), Farbstrich je Wert. Desktop 4 bzw. 3 Spalten, Tablet/Handy 2.

- 14.11.2026: Handy: Beim Radwechsel in der Kachel „Auf Lager“ blinkten die unteren Kacheln mit. Ursache: je Wechsel neues Bild-Element (neue Grafik-Ebene, Nachbarkacheln wurden neu gezeichnet). Jetzt zwei feste Bilder im Wechsel + feste Ebenen je Kachel (translateZ, contain:paint, will-change).

- 14.11.2026: Ticker – Bosch-Pille war schief (machte die Kursiv-Neigung mit → Parallelogramm, Bosch-Ring zum Oval verzerrt) und die Buchstaben stießen oben fast an. Jetzt gerade Kapsel (Gegen-Neigung skewX(9deg) an Pille und Logo, Ring wieder rund), Großbuchstaben mittig mit gleichem Rand oben/unten, etwas mehr Innenabstand. Text bleibt kursiv auf der Zeilen-Grundlinie.

## 15.11.2026 – Optik-Runde (Tiry: alle Punkte ja)
- WhatsApp-Knopf am Handy: 54 px, erst sichtbar nach ¾ Bildschirm Scrollen (`body.fabhide`), verdeckt oben nichts mehr.
- Lager-Karten: „Sofort verfügbar“ nur noch als grüner Punkt (Text als Tooltip/aria), „Sonderangebot“ zeigt die Ersparnis („–800 €“ bzw. „bis –1.000 €“, `lgSave`), Leasing-Zeile auf der Karte ersetzt durch „*“ am Preis (Fußnote unter dem Raster bleibt).
- Handy: Lager mit 2 Rädern pro Zeile, kompakte Karten, „Ansehen“ ausgeblendet (ganze Karte klickbar).
- Showroom (Start + Marken): bestelltes Rad → Chip „Bestellt · Kommt bald zu uns · Ansehen“ in Orange statt „LIVE · Unser Live-Bestand“ (`liveSoon`).
- 4,8 bei den Kundenstimmen im Velocenter-Rot statt Braun.
- Abstände: Winter-Band 120 px (Handy 84 px) statt bis 170 px, Kundenstimmen direkt nach „Unser Versprechen“ (24 px).
- Tempo-Linien im Kopf: kein Grau mehr, im Textbereich stark abgeschwächt (Maske), Handy 40 %.
- Schnellzugriff-Kacheln: dunkler Verlauf hinter dem Text; Handy: Bosch-Foto der Kachel „Termin“ nach rechts.
- Handy-Kopf: Social-Symbole weichen zuerst → Öffnungsstatus mit Text („Zu · ab Mo 9:00“) statt nur Ring.
- Marken-Filter: Velo de Ville, Victoria, KTM, i:SY, QiO, Stevens optisch gleich groß/kräftig.
- Handy-Start: Logo zuerst, dann „Familienbetrieb seit 1995“, dann Überschrift.

## 15.11.2026 – UX-Prüfung, Stufe A (ohne Freigabe umgesetzt)
- Skip-Link „Zum Inhalt springen“ (sichtbar bei Tastatur-Fokus).
- Lager-Karte: kein verschachteltes `role=button` mehr, echter Knopf „Ansehen“ mit aria-label; Herz mobil 44 px.
- Telefon im Termin-Hinweis als `tel:`-Link; i:SY-Testflotte per Tastatur fokussierbar.
- Tipp-Flächen ≥ 44 px: Marken-Chips, Footer-Links (Tel., Mail, WhatsApp, Impressum, Datenschutz).
- Kontrast WCAG AA: Orange-Texte #D45200 / #C2410C, Jahres-Knopf, i:SY-Liste, Testflotten-Überschriften; Mini-Texte auf 11 px.
- Schnellzugriff-Kacheln 761–1100 px als 2×2-Raster (vorher gequetscht).
- axe-core: 0 Verstöße auf allen Ansichten bei 1440 und 390 px.

## 15.11.2026 – UX-Prüfung, Stufe B (Tiry: B1–B8 freigegeben)
- **B1** Feste Aktionsleiste unten (Handy ≤720 px und Touch-Geräte bis 1024 px): Anrufen · Termin · WhatsApp; ersetzt dort den WhatsApp-Kreis.
- **B2** Hero: Hauptknopf „Werkstatt-Termin anfragen“, zweiter Knopf „E-Bike finden“.
- **B3** Termin-Formular sendet direkt: „Per WhatsApp senden“ (Haupt) oder „Per E-Mail senden“; Text-Ausgabe nur noch als Ersatz, falls sich nichts öffnet.
- **B4** Weniger Dauer-Bewegung: Tempo-Linien nur ~4 s beim Laden; Puls-Ringe 3× statt endlos; Öffnungs-Ring pulsiert nur bei „offen“; „Live“-Punkt im Menü ruhig. Ticker bleibt.
- **B5** Bilder neu komprimiert (max. 1600 px, WebP q80; 140 Dateien, ~60 → ~45 MB); Hero-Wechselbilder laden erst kurz vor dem Zeigen. Handy-Start 8,6 → 4,2 MB. `img/bestand/` unverändert (Bilder-Agent).
- **B6** Handy-Menü: roter Knopf „07271 78033 anrufen“ ganz oben.
- **B7** Lager: H2 „Sofort verfügbar – E-Bikes auf Lager“.
- **B8** JSON-LD: geo (49.05512, 8.26684 – OpenStreetMap-Eintrag „Velocenter Hessert“), image (og-bild.jpg), hasMap.
- „Meisterwerkstatt“ aus der Google-Beschreibung entfernt → „eigene Werkstatt“ (Stefan hat keinen Meisterbrief). **Nie „Meister…“ verwenden.**
- Fehler behoben: Im offenen Handy-Menü lag das ✕ unter dem Menü (nicht antippbar), Menü war unten abgeschnitten.

## 15.11.2026 – Design-Prüfung: Qualitätskorrekturen (Look unverändert)
- „Bewegung reduzieren“ (Systemeinstellung) gilt jetzt überall: vorher liefen Hintergrund-Blobs, Bänder, Ticker, Verlaufsschrift und Tempo-Linien weiter.
- Footer: WhatsApp-Symbol mittig wie Instagram/Facebook (war durch die 44-px-Regel nach links verrutscht).
- Handy-Menü: Social-Symbole linksbündig mit den Menüpunkten.
- Termin-Formular: beide Sende-Knöpfe gleich breit in einer Reihe, „Per WhatsApp senden“ ohne Umbruch; Tageszeit-Auswahl in einer Zeile.
- Drei Design-Konzepte (Rennlinie / Atelier / Werkstatt-Nacht) als Vorschau gebaut – Wahl durch Tiry offen.

## 15.11.2026 – Hintergrund „Perlmutt“ (Tiry)
- Style und Aufbau des Hintergrunds bleiben (Tiry: „sehr geil“), nur das Rosa raus: Grundverlauf Perle/Lavendel/Eisblau/Champagner, Magenta-Licht → Blau (#2F6FB0), rotes Licht nur noch zart (.16), große rote Lichtflächen → Graphit bzw. sehr zartes Weinrot, `--bg` #F4EFEA. Rot nur noch in Logo/Knöpfen.

## 15.11.2026 – Menüband: verworfene Entwürfe + Qualitäts-Regel (Tiry)
- Verworfen als „unprofessionell/Billo“: 6 Menü-Varianten (Neon-Leiste, Insel, Seiten-Leiste, Dock, Farb-Pillen, zweistöckig), Vollbild-Menü mit rollendem Rad/Reifenspur, flaches Menüband mit Wellenlinie bzw. geradem Strich. Nicht wieder vorschlagen.
- Startseite bleibt wie sie ist; geändert werden darf nur das Menüband oben. Vorbild für Modernität: landonorris.com (aber kein Wasser-Motiv).
- Qualitäts-Regel für alle Vorschläge steht in CLAUDE.md (Abschnitt Homepage).

- 15.11.2026 (Tiry): Menüband-Entwurf „Kapsel“ (dunkle Glas-Kapsel beim Scrollen) verworfen: **kein dunkler Balken**, Farbverläufe mit dunklem Anteil erlaubt. Veränderungen müssen deutlich sichtbar sein, nicht nur eine andere Farbe.
- 15.11.2026 (Tiry): **Menü-Vorschau ist fest eingebaut und live** – beim Drüberfahren am PC (Maus, ab 1181 px) klappt unter dem Menüpunkt eine Übersicht des Reiters auf (Bild, Fakten, Knöpfe). Bleibt bei jedem neuen Menüband erhalten. Knöpfe im Stil der Seite (rot / umrandet), **keine Regenbogen-Knöpfe**. Code: Block „Menü-Vorschau“ am Ende von `<style>` und am Ende des Skripts. Handy/Tablet ohne Vorschau.
- **Menü-Vorschau korrigiert (15.11.2026):** Nach dem ersten Drüberfahren blieb der Inhalt stehen (fehlende Reiter-Reihenfolge `ord` → Skriptfehler). Jede Vorschau zeigt jetzt die echte Seite: Überschrift der Seite, kurzer Text, „Auf dieser Seite“ mit den echten Abschnitten, Bild der Seite. Test: alle Reiter nacheinander ohne Neuladen.
- **Menü-Vorschau Farbe + Lager (15.11.2026, Tiry):** Mehr Struktur und Farbe, aber nicht rosa: jede Vorschau hat eine eigene Farbwelt (Bühne rechts im Verlauf, Nummern-Kreise, Knopf), Überschrift wie auf der Seite (zweiter Teil im Verlauf). **Lager zeigt immer nur 1 Rad** (zwei Räder hingen ineinander) – echte Räder aus dem Bestand (`bestandData`), wechseln alle 2,8 s, mit Preis/Angebot, Zahlen „im Laden / bestellt / Angebote“, „LIVE · Stand <Datum>“.
- **Vorschau-Farbe richtig verstanden (15.11.2026, Tiry):** „Mehr Farbe“ heißt Farbe in der **Fläche** der Vorschau (Eisblau/Lavendel/Champagner-Verlauf + zarte Waben + Lichtstreif), **nicht** farbige Bühnen, Rahmen, Knöpfe oder Nummern – die bleiben ruhig im Seitenstil (rot/weiß). Kein Rosa.

## 15.11.2026 – Look „Eis & Rot“ live (Tiry: „nr 6 ist geil! mach da genau so live!“)
- Live wie die Vorlage `entwurf-menue/F-eis-rot/` mit Variante 6: Menü F (Flüssig-Linse), Grund gebürstetes Eis-Silber mit weißen Waben,
  Logo-Striche (Grau #868282, Rot #CF1A2C, scharf, kein Schimmer, linker Strich bis in die Navi), rote Ebene rechts hinter dem Showroom
  mit Glasklinge und **gebürstetem Eloxal-Rot** (Schliffspuren + Lichtkante). Ohne Umschalter, ohne Info-Varianten.
- Eingebaut als `<style id="eisRot">` direkt nach dem Haupt-Stil und `<script id="eisRotJs">` am Ende von `index.html`.
  Änderungen an diesem Look dort machen (die Vorlagen-Dateien sind nur noch Archiv).
- **Menü-Vorschau ohne rote Kreise (15.11.2026, Tiry: „wirklich sehr unschön“):** „300+“ (Start) und „–20 €“ (Service) sind jetzt
  dunkle Glas-Etiketten `.lbp-tag` wie die Status-Pille im Kopf: große Zahl weiß, „+“/„€“ in Logo-Rot, Trennstrich, kleine Zeile
  („E-Bikes vor Ort · zum Probefahren“ bzw. „Winter-Aktion · auf jede Inspektion“), Lichtkante Rot → Grau, leiser Glanz (aus bei „Bewegung reduzieren“). Keine Kreis-Plaketten mehr.
- **Stichpunkte der Menü-Vorschau ohne Nummern (15.11.2026, Tiry: „moderne Punkte statt Zahlen“):** Liste „Auf dieser Seite“ zeigt
  einen leuchtenden Rot-Punkt (Verlauf #FF5466 → #8E0E26) mit weißem Glas-Hof; beim Drüberfahren wird er zur kurzen Pille, der Text bleibt stehen.
- **Etikett Service mit Zugabe (15.11.2026, Tiry):** „–20 €“-Etikett hat als 3. Zeile „+ Sattelüberzug geschenkt“ („+“ in Logo-Rot), damit die ganze Winter-Aktion drinsteht.
- **KEINE Bestandszahlen auf der Homepage (15.11.2026, Tiry, verbindlich):** keine Anzahl „im Laden / bestellt / Angebote“ o. Ä. öffentlich zeigen –
  auch nicht in der Menü-Vorschau (dort entfernt). `#lgNum` auf der Lager-Seite bleibt `hidden`. Einzelne Räder mit Preis bleiben.
- **Rote Fläche läuft aus dem Bild (15.11.2026, Tiry):** Größe und Form wie vorher, die weiße Glasklinge bleibt **parallel** (kein Keil,
  keine Anpassung an den Kopfbereich – beides hat Tiry verworfen). Die Ebene steht um `--g` über den rechten Rand und ist entsprechend länger:
  Klinge und Rot laufen unten schräg aus dem rechten Bildrand (Rot endet dort spitz), nie mehr waagrecht abgeschnitten.
- **Menü F auf schmalen PCs (15.11.2026):** Bei 1000–1366 px rutschte „Kontakt“ unter die Öffnungs-Pille, weil die feste Menü-F-Größe die
  Verdichtungs-Stufen `tight/tight2/tight3` von `hdrFit()` überschrieb → Stufen haben jetzt Vorrang (geprüft 1000–2560 px, oben + gescrollt).
  Sind die Social-Knöpfe dabei ausgeblendet (`.hdr.nosoc`), ist der linke Strich im Kopfbereich ausgeblendet, damit er nicht durchs Logo läuft.

## 15.11.2026 – Ticker: „Google“ in Google-Farben (Tiry)
- „Google“ in „4,8 ★ bei Google“ als weiße Pille wie die Bosch-Pille, Buchstaben in Google-Farben (G/g blau #4285F4, o/e rot #EA4335,
  o gelb #FBBC05, l grün #34A853), Klasse `tkg` in `tkIt`. Weiße Pille, weil Rot/Blau direkt auf dem roten Band nicht lesbar wären.

## 15.11.2026 – Menü-Sprünge ohne Umweg nach oben (Tiry)
- Klick auf ein Thema im Hover-Menü (z. B. i:SY Experte → „Der erste und einzige i:SY Werbe-Bus“) im gleichen Reiter sprang erst ganz nach oben
  und dann zum Thema. Ursache: der allgemeine Klick-Handler (`href === location.hash` → `go(false)` → nach oben) lief zusätzlich zu `lbJump`.
  Fix: Menü-Panel stoppt das Weiterreichen des Klicks (`e.stopPropagation()`); die Seite gleitet jetzt direkt von der aktuellen Stelle zum Thema.

## 15.11.2026 – Jahrgänge im Menü „i:SY Treffen“ (Tiry)
- Hover-Vorschau i:SY Treffen hat unter „Auf dieser Seite“ die Zeile **„Jahrgänge“**: Glas-Pillen 2024 · 2023 · 2022 · 2019 · 2017
  (neueste zuerst wie die Galerie, 2024 mit ★ und rotem Lichtrand = Weltrekord, Hover = roter Verlauf). Klick springt zur Galerie
  „Bilder & Videos“ (`#tgY`) und filtert direkt auf dieses Jahr (`window.tgYear(y)`, `data-tgy`). Funktion `yr()` + 7. Parameter von `tx()`.

## 15.11.2026 – Hintergrund-Striche ohne Pixel (Tiry: „100 % scharf, keine verpixelten Stellen“)
- Gemessen: die Striche selbst (clip-path) sind sauber kantengeglättet, auch über die Grafikkarte. Verpixelt wirkten zwei Dinge daneben:
  1. Feine 115°-Schliffspuren (Eis-Grund, Glasklinge, Rot) waren 1-px-Linien mit harten Farbstopps → Chrome glättet die nicht → Treppen.
     Jetzt weiche Welle `0 → Spitze bei 2px → 0 bei 4px` (gleiche Optik, keine Treppen). **Nie wieder harte Stopps in schrägen repeating-Verläufen.**
  2. Glasklinge und graue Kante teilten sich exakt dieselbe Kante → Hintergrund schimmerte im Kanten-Pixel durch. Klinge reicht jetzt 12 px unter die Kante
     (`.erg`-Polygon mit `100% calc(100% - 25.75px)`, 25,75 = 12 × 2,146 = tan 65°).
- Vorlage „Metall gebürstet“ für die rote Fläche: `entwurf-menue/metall/` (nur mit `html.mtl`, Umschalter unten, Taste M), online als
  `vorlage-metall.html` im Web-Repo (noindex, nicht in der Sitemap).
- **Tiry: „metallik live“ (15.11.2026)** → Regeln ohne `html.mtl` fest in `index.html` hinter `.erl .erx`, Vorlage-Seite im Web-Repo gelöscht.
  Rote Fläche = Metall gebürstet; nicht auf die alte flache Fassung zurückbauen.

## 15.11.2026 – WhatsApp-/Facebook-Vorschaubild (Tiry)
- Vorschau zeigte kein Bild: `og:image` zeigte auf www.velo-center.de (bis zum Umzug noch Coco → 404). Jetzt `BILD_BASIS` in `tools/live_bauen.py`
  (github.io, leitet nach dem Umzug selbst weiter) für `og:image`, `og:image:secure_url`, `twitter:image` und `og:url`; dazu `og:image:type` + `og:image:alt`.
  `canonical` bleibt www.velo-center.de. Am Umzugstag `BILD_BASIS = BASIS` (steht in LIVEGANG.md).
- `live/og-bild.jpg` neu (1200×630, aus der aktuellen Startseite: Laufband, Logo, Überschrift, Knöpfe, Showroom, Metall-Rot). Ohne Menüleiste und ohne
  Geöffnet/Geschlossen-Anzeige (zeitabhängig). Bei großen Optik-Änderungen der Startseite neu erzeugen (2-fach rendern, Lanczos auf 1200×630).

## 15.11.2026 – Rote Fläche bündig unter dem Laufband (Tiry, Handy)
- Startseite: `.erl` hatte festen Abstand (84/88 px ab `main`), auf Handy/Tablet (≤ ~1024 px) blieb eine Lücke zwischen Laufband und Rot.
  Jetzt setzt ein Skript (`eisRotJs`, nach dem Anlegen von `.erl`) `top` auf die Mitte von `.bands` – dort sind beide Bänder zentriert und decken die
  Oberkante bei jeder Breite ab. Neu berechnet bei Größe, Schrift (A+), Laden und Reiterwechsel; andere Reiter unverändert (CSS-Wert).
- Handy-Animationen: Telefon mit „Bewegung reduzieren“/Energiesparmodus stoppt alle Animationen (Pflichtregel). Mittelweg (ruhige Effekte trotzdem) nur nach Tirys „ja“.

## 15.11.2026 – Animationen immer an + Logo gleichzeitig mit Rad (Tiry)
- **Animationen laufen auf jedem Gerät immer**, auch wenn das Handy „Bewegung reduzieren“/Energiesparen meldet (Tiry: „das Band oben läuft auf dem Handy nicht“).
  Alle 37 `@media (prefers-reduced-motion:reduce)`-Blöcke entfernt, JS-Abfragen raus (`RM=false`, Menü-Vorschau `lgRun`, Menü-Linse `aim`).
  Geprüft: Pixel 7 mit „reduce“ = 21 laufende Animationen, gleich wie ohne (Laufband `run@tk` inkl.). **Nie wieder Reduce-Regeln einbauen.**
- **Logo und Rad kommen gleichzeitig** in beiden Showrooms: Logos werden vorab geladen + dekodiert; Wechsel erst, wenn Rad und Logo bereit sind
  (max. 2,5 s Wartezeit), dann starten beide im selben Frame mit gleicher Dauer (`.hlg` 0,9 s/1,1 s wie `.hb`, Ausblenden 0,3 s; `showroom()` mit `dec`/`rdy`).
- Diagnose: Seite mit `?diag` zeigt unten ein Feld „Bewegung reduzieren AN/AUS · laufende Animationen“ (Klick schließt). Ohne `?diag` unsichtbar.

## 15.11.2026 – Termin-Knöpfe landen direkt im Formular (Tiry, Handy)
- Schleife behoben: Die Winter-Karte im Terminbereich zeigte auf `#deal` (Startseite), deren Knopf „Winter-Termin sichern“ wieder auf `#termin` → man kam nie ans Formular.
  Karte jetzt `href="#termin" data-pre="Winter-Inspektion"` (Inspektion vorgewählt, Text „Winter-Inspektion: “).
- `#termin` springt jetzt direkt auf das Formular `#tf` (ALIAS `termin:['service','tf']`, `#tf{scroll-margin-top:96px}`), nicht mehr auf die Überschrift
  darüber (am Handy lag das Formular ~2 Bildschirme tiefer). Menü-Vorschau „Termin anfragen in 30 Sekunden“ ebenfalls direkt aufs Formular (`lbFind`).
- Geprüft: alle Termin-Knöpfe (Startseite, Service, Marken, i:SY, E-Dreirad, Dienstrad-Rechner, Kopf, untere Leiste, Menü) am Handy (Pixel 7) und PC:
  Formular-Oberkante 74–96 px unter dem Fensterrand, Art + Text werden passend vorbelegt. Winter-Karte 2× hintereinander → jedes Mal Formular.

## 15.11.2026 – Striche dezenter, „Aus Wörth für Wörth“ entfernt (Tiry)
- Hintergrund-Striche (`.strk`): grau `.sa/.sb` Deckkraft .11, rot `.sc` .12 (vorher grau voll, rot .92; Zwischenstand .42/.5 wirkte laut Chefin
  noch wie Durchstreichen über der Schrift). Nur noch ein Hauch, **nie wieder kräftiger**. Form/Position unverändert.
- Abschnitt „Aus Wörth für Wörth“ (Kinderfasching, Stadtradeln, Lions-Adventskalender, ADFC) unter „Unser Versprechen“ komplett gelöscht
  (Tiry: „interessiert keinen“), samt CSS `.woerth/.wrows/.wrow`. Linke Spalte ist sticky → keine Lücke. Nicht wieder einbauen.

## 15.11.2026 – i:SY Experte: rotes Dreieck (Tiry: „hat gar keine Wirkung“)
- Vorher lag `.erl` fest oben (88 px) und fast komplett hinter dem großen Foto – nur ein Rest schaute unten raus.
- **Handy (≤ 760 px):** Rot beginnt jetzt direkt unter dem Foto (Skript in `eisRotJs`, `fit()`: Oberkante = Fotokante rechts bei 94 % wegen clip-path).
- **PC/Tablet (≥ 761 px):** auf diesem Reiter ausgeblendet – unter dem Foto läge es hinter den Zahlen (orange „1.000+“ auf Rot unlesbar).
- Andere Reiter unverändert (Startseite: unter dem Laufband; übrige: CSS-Wert).

## 15.11.2026 – Rotes Dreieck auf allen Reitern so kräftig wie auf Start (Tiry)
- Ursache: Der Seitenkopf `.ph` (alle Reiter außer Start) hatte in `::before` oben rechts einen beigen Lichtschein (85 % 30 %), der genau über
  dem Rot lag und es blass/rosa machte (gemessen Service 192/63/79 statt Start 189/37/68). Schein oben rechts entfernt, links unten bleibt.
- Dazu am PC (≥ 761 px) überall dieselbe Größe wie Start (`--h:min(1200px,135vh)`), Handy unverändert (250 px).
- Ergebnis: Service/Marken/Kontakt 176/31/60 – gleich kräftig wie Start. **Nie wieder Licht/Schein über die rote Fläche legen.**

## 15.11.2026 – Rad-Finder-Angebote + Hänger behoben (Tiry)
- **Rad-Finder-Ergebnis:** Angebotsräder zeigen Schild „% Sonderangebot“ auf dem Bild, alten Preis durchgestrichen, Angebotspreis rot mit *, „Du sparst …“ und „* Angebotspreis, nicht bei Leasing & Finanzierung“. Nie wieder Angebotspreis als normalen Preis zeigen.
- **Hänger („nichts klickbar, nach Aktualisieren geht es“):** Ursache war die Wisch-Sperre beim Reiterwechsel (1 s) – Tipps in dieser Zeit wurden verschluckt, Seite blieb im falschen Reiter. Jetzt wird der Tipp nach der Animation ausgeführt (`pend` im Router).
- Reiterwechsel (auch Zurück-Wischen am Handy) schließt offene Fenster (Rad, Finder, Vergleich); schnelles Zu/Auf öffnet sicher (Schließ-Timer wird abgebrochen); Marken-Showroom-Sperre löst spätestens nach 2,5 s.

## 16.11.2026 – Flüssiger auf schwachen PCs (Tiry: „hängt am Mini-PC“), Optik und Animationen unverändert
- Gemessen mit 4-fach gedrosselter CPU (wie Mini-PC). Alle Animationen laufen weiter (gleiche Liste vorher/nachher geprüft).
- **Scrollen:** Klasse `scr` (Hintergrund steht beim Scrollen still) sitzt jetzt nur an `.sky/.blobs/.ribbons`, nicht mehr an `<html>` –
  vorher rechnete jeder Scroll-Start/-Stopp das Aussehen aller `<i>` der Seite neu (1.680 → 260 Neuberechnungen). Scroll-Handler laufen
  einmal pro Bild (rAF), Hero-Höhe per ResizeObserver statt bei jedem Ereignis messen → Scroll-Ereignisse 104 → 6 ms/s.
- Schnee-Band: kein `getBoundingClientRect` mehr pro Bild. Tempo-Linien: nach dem Ausblenden `visibility:hidden` (keine unsichtbare Vollbild-Ebene).
- **Fehler behoben:** „Abstände Startseite enger“ (15.11.) galt nur außerhalb des Bildschirms (`.apz`) → Abstände sprangen beim Scrollen,
  Seite wurde 226 px länger/kürzer (Ruckeln + Neuaufbau). Jetzt gelten die beschlossenen Werte immer (Winter-Band 120 px / Handy 84 px,
  Kundenstimmen 24 px / Handy 8 px). Nie wieder Abstände an `.apz` hängen – `.apz` heißt nur „außerhalb des Bildschirms“.

## Vorlage Showroom-Verwandlung (16.11.2026, Tiry: „richtig abartig modern“)
- Nur Vorlage: `vorlage-showroom.html` (noindex, nicht in der Sitemap), Quelle `entwurf-menue/morph/` (`inject.py` + `morph.js` + `morph.css` + `panel.js`).
  Bauen: `python3 entwurf-menue/morph/inject.py <live-index.html> <ziel>/vorlage-showroom.html`. **Live-Seite unverändert, bis Tiry freigibt.**
- Technik: WebGL, ~1,8 s. Rad + Markenlogo zerfallen entlang einer Laser-Kante in ein digitales Voxel-Raster
  (Datenpunkte in Velocenter-Rot und Eisblau) und setzen sich als neues Rad/Logo zusammen; Spiegelung im Shader, Ring leuchtet währenddessen.
  Leinwand existiert nur während der Verwandlung; ohne WebGL automatisch der bisherige Wechsel.
- Umschalter unten „Wie jetzt | Verwandlung“ + „Nächstes“ (Tasten V / N), gilt für Start-Showroom und Marken-Showroom.
- **LIVE seit 16.11.2026 (Tiry: „GEIL GEMACHT! mach es live“):** Verwandlung fest in `index.html` (Block `vMorph`/`vMorphJs` + 4 Stellen im Start-/Marken-Showroom), ohne Vorlagen-Umschalter.
  Änderungen am Effekt in `entwurf-menue/morph/morph.js` machen und den `vMorphJs`-Block in `index.html` damit ersetzen.
- **16.11.2026 (Tiry):** Pixel tragen die echten Farben des alten Rads und verlaufen in die des neuen (kein festes Rot/Blau mehr), Kante in Radfarbe; doppelt so viele, feinere Pixel (Raster 3,2 px), 3 Stufen (zerfallen an Ort und Stelle → fliegen → landen und werden scharf), Dauer 2,3 s.
- **16.11.2026 (Tiry: „Pixel-Schwarm wie in Zukunftsfilmen“):** Pixel lösen sich, ziehen sich zu einem wirbelnden Schwarm zusammen (gemeinsames Strömungsfeld, Bogenflug), landen als neues Rad. Farben gesättigt; graue/schwarze Pixel nehmen im Schwarm die Hauptfarbe des Rads an (`dom`, nach Sättigung gewichtet). Dauer 2,6 s.
- **16.11.2026 (Tiry: „nicht so schwunghaft, keine Wirbel“):** Keine Drehung, kein Bogenflug mehr. Der Nano-Schwarm schwirrt an Ort und Stelle (feine Strömungen, Summen) und baut das neue Rad Stück für Stück auf. Große Wirbel nicht wieder einbauen.

## Handy-Navi oben (16.11.2026, Tiry)
- Auf dem Handy (≤ 980 px) steht ganz oben eine wischbare Navi-Leiste (`.mnav`/`#mnt`, Glas-Pille, aktive Seite rot, schiebt sich automatisch auf die aktive Seite). Darunter die bisherige Zeile (Social/Öffnungszeiten/A+/Menü), Höhe 74 px (beim Scrollen 64). Inhalt rückt 62 px nach unten (`#main`). PC unverändert.
- **Öffnungs-Anzeige (16.11.2026, Tiry):** geschlossen/Mittagspause zeigt „öffnet 14:30 Uhr“ (Handy „öffnet 14:30“) statt „ab 14:30 Uhr“ – „ab“ wirkte, als finge die Pause erst an.
- Bei offenem Burger-Menü klappt die Handy-Navi-Leiste weich ein (`body.menu .mnav`), sonst verdeckte sie den Anfang des Menüs (Anruf-Knopf).
- **Neu (16.11.2026 abends, Tiry):** Handy-Kopf = Glas-Fläche mit 8 Reitern in 2 Reihen à 4 (Start · Service · Marken · Auf Lager / i:SY Experte · i:SY Treffen · E-Dreiräder · Kontakt), darunter Zeile mit Social bzw. Logo + Öffnungszeiten + A+. **Burger-Menü auf dem Handy entfernt** (`.hdr .burger` ausgeblendet). Ersetzt die wischbare Leiste. Kopf 176 px, Inhalt `#main` +102 px (Abstand zum Banner wie vorher).
- **Aufgeräumt (16.11.2026 nachts, Tiry: „unordentlich“):** eine deckende helle Kopfzeile (unten 26 px rund), Reiter im festen 4er-Raster (beide Reihen bündig), LIVE als kleines Schild oben rechts an „Auf Lager“, darunter Öffnungszeiten als volle Leiste (lange Texte „Mittagspause · öffnet 14:30 Uhr“, Pfeil ›) + runder A+. Logo und Social im Handy-Kopf ausgeblendet (sie drückten die Öffnungszeiten auf einen Punkt zusammen).
- **Klicks & Hänger (17.11.2026, Tiry: „Markenbilder oft nicht klickbar, Seite hängt ab und zu“):** Marken-Showroom verwarf jeden Klick während einer Verwandlung (`if(busy)return`, ~3 von 4 s) → jetzt wird der Klick gemerkt, die Marke sofort markiert, die laufende Verwandlung in ~0,4 s fertig gespielt (`VM.hurry`) und danach direkt gewechselt. Automatik pausiert, solange die Maus auf der Markenleiste liegt. Handy Auf Lager: mitlaufende Marken-Leiste klebte unter dem 174-px-Kopf → `top` = echte Kopfhöhe (`--hdrH` per ResizeObserver) + 8 px. Verwandlung: Shader-Bau asynchron (KHR_parallel_shader_compile) und im Leerlauf vorgewärmt (`VM.warm`), Rechenarbeit in Häppchen; **Software-Grafik (SwiftShader/llvmpipe) bekommt automatisch den einfachen Wechsel**, unter 12 Bildern/s schaltet sich die Verwandlung für den Besuch ab; Aufbau max. 5 s. Tests mit `window.__vmSW=1` erzwingen die Verwandlung in Software-Grafik.
- **Design „Plus“ live (19.11.2026, Tiry: „Vorlage ist ok, ausliefern, nur die Winteraktion so lassen wie vorher“):** `tools/live_bauen.py` ruft am Ende `entwurf-modern/plus_bauen.py --live <ziel>` auf und legt Plus (Perlmutt-Glas-Design-System, niedriger Handy-Kopf ohne Laufband, Tiefe am Rad, kleine WebP-Varianten per srcset/`PV()`, neue Fußzeile) auf **alle** Seiten. Google bleibt an (robots/canonical unverändert). **Winter-Aktion (`.ice`) bleibt im alten Sternen-Look:** im Live-Modus fliegt der Winter-Block aus `plus.css`, alle allgemeinen Regeln sind per `:not(.ice *)` ausgenommen (Assert prüft das). Plus-Ersetzungen haben Treffer-Asserts → ändert sich die Quelle so, dass eine nicht mehr passt, bricht der Bau ab und nichts geht live (dann `plus_bauen.py`/`plus_markup.py` anpassen). Bilder-Agent löscht die Varianten `-400/-640` nicht mehr, solange das Original benutzt wird. Vorlagen A/B/C gefallen Tiry nicht → vom Web-Repo entfernt (Quellen bleiben in `entwurf-modern/`). Rückweg: velo-center-web auf 1250b36 zurück + Aufruf `plus_design()` in `live_bauen.py` entfernen.
- **Tempo (19.11.2026, Tiry: „extrem flüssiger, Animationen bleiben alle“):** Optik pixelgleich geprüft, alle Animationen laufen weiter. Regeln: **keine Custom Properties an der Wurzel (`documentElement`) pro Bild/Scroll** (`--pl-sy` nur an `.pl-depth`, `--plH` nur an `#main` mit `@property inherits:false`, `--hdrH` nur über eigene Regel `.lgbar`, alles nur bei Änderung); **keine Layout-Eigenschaften (`left`/`top`/`width`) in Keyframes** (Logo-Glanz `.shine::before`, `dealShine`, `hlflow` laufen per `transform`); Tempo-Linien-Canvas: Verlauf je Linie einmal anlegen, dann nur verschieben; **kein flächiges `will-change`** (senkte im Test die Handy-Ruhe-fps 44 → 36). Messung Handy-Scroll mit 4× CPU-Bremse: Start 17 → 46 fps, Lager 11 → 55, Marken 27 → 59, Service 18 → 59, i:SY 29 → 60, E-Dreiräder 20 → 59, Kontakt 31 → 46. Bewusst unverändert (nur mit Optik-Änderung schneller): `background-position`-Animationen (flow, oflow, hcflow, osheen, mnGlanz, gvf) und Unschärfe von Lichthof/Lichtkegel.
- **Menü-Vorschau Lager = hochgeladener Bestand (19.11.2026, Tiry):** Die Vorschau beim Überfahren von „Auf Lager“ las nur den festen Datei-Stand (#bestandData) und zeigte so verkaufte Räder weiter. Jetzt nimmt sie denselben Bestand wie die Seite (`window.vcLager` → `admMerge(admBase())`: Firebase-Upload + Admin-Änderungen/Ausblendungen), nur ohne Datenbank den Datei-Stand, und baut neu, sobald sich der Bestand ändert. Optik unverändert.
- **Kurz-Links für Social Media (20.11.2026, Tiry: WhatsApp-Link zu lang):** `live/links/<name>/index.html` wird von `live_bauen.py` nach `/<name>/` kopiert (noindex, leitet sofort weiter). `/winter/` = WhatsApp-Terminanfrage Winter-Inspektion 2026/27 mit fertigem Text an 01635343133.

## Winter-Aktion: nur Marken-Fahrräder mit Bosch-Antrieb (Tiry 20.11.2026)
- Überall (Winter-Block #deal, Service-Karte, Service-Liste, Start-Kachel, Menü-Vorschau Service): **„Gültig nur für Marken-Fahrräder mit Bosch-Antrieb“** + **„Inklusive ✓ Checkliste ✓ Bosch Servicebericht“**.
- **E-Dreiräder und Lastenräder nicht mehr erwähnt** (wollen wir primär nicht reparieren). Nicht wieder einbauen.
- CSS `.wbk` (Hinweis-Pille) und `.winc` (Inklusive-Pillen) direkt in index.html, weil `.ice` von Plus ausgenommen ist.

## Kurz-Link /winter/ entfernt (Tiry 20.11.2026)
- `/winter/` (tiry38-Adresse) wieder von der Homepage genommen, wird nicht genutzt. Für Social Media direkt wa.me-Links verwenden. `live_bauen.py` kopiert `live/links/*` weiter, falls später nötig.

## 21.11.2026 – Seitenwechsel „Explosionszeichnung“ live (Tiry: „fuck sind diese geil“)
- Aus Vorlage 3 (`entwurf-modern/uebergang2/`) **nur der Übergang** live, Hintergrund der Live-Seite unverändert.
- Ablauf: Kamera kippt die Seite in die Schrägansicht (rotateX 50°, rotateZ −24°), bis zu 12 (Handy 8) Bauteile heben sich als Ebenen ab
  (gestrichelte Hilfslinien, roter Umriss auf der Grundplatte, „POS 01 · Z 241“), neue Seite senkt sich Ebene für Ebene ein, Kamera federt zurück (2,1 s).
- Technik: View Transitions API (`window.VTX` im Router `go()`), Code in `<style id="vtExplo">` + `<script id="vtExploJs">` im Prototyp
  (Quelle: `uebergang2/live-explo.css|js`, aus `ue2.js` herausgelöst). Browser ohne View Transitions = bisheriger Wischer.
- Im Web-Repo direkt in die 10 Seiten eingesetzt (nicht neu gebaut), damit der Bilder-Agent-Stand (`PVV`, Agent-Daten) erhalten bleibt.

## 21.11.2026 – Lichtkegel von oben im Showroom entfernt (Tiry: „sieht blöd aus“)
- `.pl-cone` (Lichtstrahl über dem Rad im Kopf-Showroom) raus: Quelle `entwurf-modern/plus.css` + `plus_markup.py`,
  live direkt in den 10 Seiten des Web-Repos (Commit cee8107). Bodenschatten/Spiegelung bleiben. **Nicht wieder einbauen.**

## 21.11.2026 – Vorschau-Seite zum Verschicken (Tiry: „für meine Mum, genauso animiert, 1/2/3 klickbar“)
- https://tiry38.github.io/velo-center-web/vorschau-landschaften/ = Live-Seite + Vorlage „Pässe & Küste“ (hintergrund10), Umschalter links.
- Nicht verlinkt, `noindex`; Bilder aus `../img/`, Hintergründe in `vorschau-landschaften/hg10/`. Die echte Startseite bleibt unverändert.
- Löschen, wenn nicht mehr gebraucht (Ordner im Web-Repo entfernen).

## 21.11.2026 – Vorlage „Nebel, See & Schnee“ (hintergrund11, Tiry: „3 weitere unterschiedliche in diesem Style“)
- Gleiche Technik wie hintergrund10 (echtes Foto + KI-Tiefenkarte, Live-3D), drei neue Szenen: Nebelstraße (Nebelbank zieht), Bergsee (Wasser kräuselt, Dunst), Winterpass (Schneefall in drei Tiefen).
- Fotos frei (Unsplash-Lizenz), Person/Auto/Baustellenfässer wegretuschiert, Quellen in `entwurf-modern/hintergrund11/QUELLEN.md`.
- Teilbare Vorschau: https://tiry38.github.io/velo-center-web/vorschau-landschaften-2/ (nicht verlinkt, `noindex`). Startseite unverändert.

## 22.11.2026 – Vorlage „Herbst, Wein & Polarlicht“ (hintergrund12, Tiry: „noch mehr Innovation“)
- 3 Modi: Herbstallee (3D-Laub, Maus = Wind, Lichtstrahlen), Weinberg (Scrollen = Tageslauf), Hochland (Scrollen = Polarlicht-Nacht, Gold-Weiß → Rot, kein Pink).
- Neu für alle drei: Kino-Schärfe folgt der Maus, Wolkenschatten, automatische Qualitätsanpassung.
- Fotos frei (Unsplash-Lizenz), ohne Personen/Fahrzeuge, Quellen in `entwurf-modern/hintergrund12/QUELLEN.md`.
- Tiry 22.11.: Linke Seite wirkte schwarz-weiß → Milchglas links ist jetzt farbtreu (nur heller/flacher, keine Entsättigung).
- Vorschau (nicht verlinkt, noindex): https://tiry38.github.io/velo-center-web/vorschau-landschaften-3/ – Live-Seite unverändert.

## 22.11.2026 – Vorlage „Wege ins Grüne“ (hintergrund13)
- Tiry: Hintergründe sollen zur „Fahrrad-Natur“ passen (Wege zum Radfahren). **Region ist egal, es zählt, dass es schön aussieht** – keine Motiv-Suche mehr nach Wörth/Pfalz.
- 3 Modi: Waldweg (Lichtstrahlen, Pollen im Licht), Kanalweg (Wasser reagiert auf Maus und Klick, Morgennebel), Blumenweg (Scrollen = Sternennacht mit Glühwürmchen).
- Fotos frei (Pexels-Lizenz), Quellen in `entwurf-modern/hintergrund13/QUELLEN.md`.
- Milchglas links: farbtreu, bei dunklen Fotos dichter (Schrift bleibt lesbar).
- Vorschau (nicht verlinkt, noindex): https://tiry38.github.io/velo-center-web/vorschau-landschaften-4/ – Live-Seite unverändert.

## 22.11.2026 – Vorschau-Seiten überleben jeden Lauf
- Ursache des Fehlers: Der nächtliche Bilder-Agent räumt das Web-Repo leer und kopiert nur den frischen Bau hinein – alle `vorschau-landschaften*`-Ordner waren weg, die Adresse sprang über `404.html` auf www.velo-center.de.
- Regel: Vorschau-Seiten liegen jetzt in `velocenter-homepage/live/vorschau/<name>/` und werden von `tools/live_bauen.py` mitgebaut. Neue Vorschau **immer dort ablegen**, nie nur ins Web-Repo.

## Hintergrund 14 „Düne, Heide, Zypressen“ (22.11.2026, Vorschau 5)
- Tiry: keine E-Bikes im Bild. Stattdessen Landschaften wie bei den anderen Vorlagen, mit etwas mehr Fahrrad-Bezug.
- **Kein Motiv doppelt:** Vor jeder neuen Vorlage gegen alle bisherigen Motive prüfen (Liste in `entwurf-modern/hintergrund14/QUELLEN.md`). Der Raps-Radweg war versehentlich dasselbe Foto wie in hintergrund9.
- Motive: Dünensteg (Sylt), Heideweg (violett, nicht rosa), Zypressentunnel. Vorschau: `vorschau-landschaften-5/` (nicht verlinkt, noindex).

## Showroom-Wechsel mit Herbstlaub (22.11.2026, Vorschau 3, nur Hintergrund 1 „Herbstallee“)
- **Wunsch von Tiry:**
  - Der Rad- und Logo-Wechsel läuft mit Herbstblättern statt mit dem Nanoschwarm.
  - Die Blätter sollen natürlich wie im Wind fliegen und nicht gezogen werden.
  - Keine Wirbel, es soll wie Zauberei aussehen.
  - Die erste Fassung aus Dreiecken war ihm zu schwach.
- **Umsetzung:** eigenes Grafikprogramm `VS_L`/`FS_L` in `vMorphJs`.
  - **Formen:** Ahorn, Buche/Eiche, Birke, je mit Mittelrippe, Seitenadern, Stiel, Farbverlauf, Flecken und dunklerem, trockenem Rand. Die Rückseite ist matter, dazu kommt Glanz.
  - **Ablauf (Fassung 2, Tiry 22.11.):** Abbau und Neubau gleichzeitig am selben Ort. Jedes Blatt löst sich vom alten Rad, fliegt in einem kurzen, engen Bogen zu seinem Platz im neuen Rad und landet sanft gebremst. Der Showroom ist nie leer, die Radform bleibt die ganze Zeit erkennbar.
  - **Verboten:** Blätterschwall von links, Rad abziehen und neues draufkleben, sichtbare Kanten der Zeichenfläche. Die Zeichenfläche ist im Laub-Modus größer als der Showroom, damit keine Kästen links/rechts zu sehen sind.
  - Nur ca. 20 % Deko-Blätter wehen kurz nach oben weg und blenden aus.
  - **Bewegung:** Die Blätter flattern wie Pendel, kippen (3D-Wenden) und trudeln teils. Einige fliegen auf die Kamera zu (werden größer), andere nach hinten weg.
  - **Effekte:** Beim Loslösen und Landen gibt es ein kurzes goldenes Funkeln. Jedes Blatt wirft einen weichen Schatten auf den Showroom. Am Rand der Zeichenfläche blenden die Blätter weich aus.
- **Farben:**
  - Im Flug Gold, Orange, Rot, Braun und Olivgrün; kein Rosa.
  - Am alten und neuen Pixel trägt jedes Blatt die echte Radfarbe.
- **Weitere Regeln:**
  - Die Dauer bleibt wie bisher (`VM.dur` 2600 ms).
  - Hintergrund 2 und 3 behalten den Nanoschwarm. Umgeschaltet wird über `window.HG12_MODE`.

## Hintergrund 15 „Regen, blaue Stunde, Pusteblumen“ (22.11.2026, Vorschau 6)
- **Wunsch von Tiry:** Landschaften mit mehr E-Bike-Bezug. Jede Szene bekommt einen passenden technischen Effekt (wie das Laub der Herbstallee).
- **Regenstraße:** 3D-Regen, nasse Straße, Tropfen auf der Linse.
- **Blaue Stunde:** E-Bike-Scheinwerfer, mit der Maus lenkbar.
- **Pusteblumenweg:** schwebende Samen im Gegenlicht.
- Quellen stehen in `entwurf-modern/hintergrund15/QUELLEN.md`.
- **Liegt unter:** `vorschau-landschaften-6`. Die echte Homepage bleibt unverändert.

## Kein Klick-Ring am Mauszeiger (22.11.2026, alle Hintergrund-Vorlagen)
- **Tiry:** Der rote Ring direkt am Mauszeiger beim Klick fliegt raus. Die rote Lichtwelle, die beim Klick durch das Bild läuft, bleibt (Tiry: „sau cool“).
- Betroffen: hintergrund5 (Speichenwand), 7, 9–15 und alle Vorschau-Seiten Landschaften 1–6. Nicht wieder einbauen.

## Herbstallee: Klick-Scan bis hinten raus (22.11.2026)
- **Tiry:** Der rote Scan beim Klick soll über die Ebene und die Straße hinten hinauf laufen, keine unsichtbare Wand nach 5 m. Nur Boden und Seiten, nie den Himmel, kein Kreis. Stil so dezent wie vorher, nur detailreicher bei genauem Hinsehen (kein Laser-Look).
- Umsetzung (`hg12.js`, nur Modus herbst): Scan-Tiefe aus der Bodenebene (bis Kuppe) und weiter linear die Straße hinauf bis zum Nebel (`cr=.385`, `vy=.64`), darüber nichts. Im Band leuchten Kanten zart nach, vereinzelte feine Messpunkte; Bäume an den Seiten abgeschwächt.

## Vorschau 3 (Herbstallee) Handy-Kopf mit Burger (22.11.2026)
- **Tiry:** Am Handy nur eine Leiste oben: Öffnungsstatus · A+ · Burger-Menü (aufklappbar). Dadurch ist oben Platz, und der Laufband-Banner läuft am Handy wieder mit (Pflicht). Gilt vorerst nur für diese Vorlage.
- Umsetzung: `<style id="hgMobKopf">` am Ende von `vorschau-landschaften-3/index.html` (blendet `.mnav` aus, zeigt `.burger` mit dem bestehenden Vollbild-Menü `.mnu`, Kopf klappt beim Scrollen nicht mehr ein, `.bands.top` am Handy sichtbar).
- **Nachtrag (Tiry: „vorher detailreicher“, „technisch beeindruckend“):** Scan-Tiefe wieder aus der Tiefenkarte (Bäume als echte Formen), nur ohne Wand: Boden = max(Tiefe, Bodenebene), dahinter max(Tiefe×2,4, Straßen-Rampe). Dazu scharfe helle Vorderkante und feine Tiefen-Höhenlinien in der Welle. Himmel/Kronen oben weiter ausgeblendet.
- **Nachtrag 2 (Tiry): Scan NUR auf der Straße** (Bäume links/rechts und oben waren zu viel). Straßen-Maske: vorne ganzer Asphalt bis zur Kuppe (q.y < .388), dahinter schmaler Korridor um x .497 (Halbbreite .078 → .020) bis in den Nebel (q.y ~.60). Fortschritt entlang der Straße (vorne 70 %, hinten 30 %), 5,6 s, wird nach hinten langsamer. Look: haarfeine weiße Lichtkante, dahinter perspektivisches Holo-Raster (Quer- und Längslinien in Weltkoordinaten), Asphalt-Körnung/Mittellinie leuchten fein auf, blinkende Messpunkte. Hinten nur noch feine Linie statt Fläche.
- **Nachtrag 3 (Tiry):** weiße Lichtkante entfernt (nicht wieder einbauen). Lauf 8,2 s. Mehr Details: zweites Feinraster, dichte Punktwolke (LiDAR-Punkte, werden mit der Entfernung feiner), Kanten der gelben Mittellinie werden rot nachgezeichnet, Asphalt-Körnung leuchtet fein auf.
- **Nachtrag 4 (Tiry):** Hinten im Nebel ist keine Straße mehr → Scan endet am sichtbaren Straßenende (q.y ~.535). Raster/„Kacheln“ am Anfang und Punktmuster entfernt (nicht wieder einbauen); Detail nur noch über aufleuchtende Asphalt-Körnung, nachgezeichnete Mittellinie und sehr vereinzelte feine Punkte im Band.
- **Nachtrag 5 (Tiry): Scan in der Herbstallee komplett entfernt** (Klick macht dort nichts mehr). Stattdessen **Scroll-Fahrt**: Asphalt + Mittellinie werden perspektivisch korrekt Richtung Betrachter verschoben (Weltkoordinate z, zwei Phasen überblendet, nur nahe Straße bis vor die Kuppe), schnelles Scrollen = Bewegungsunschärfe entlang der Straße (`uV` = Scroll-Tempo), fallendes Laub zieht beim Scrollen mit.
- **Nachtrag 6 (Tiry: Scroll-Fahrt zieht einen Schleier):** Fahrt entfernt (nicht wieder einbauen – Foto verschieben/überblenden wirkt wie Schleier). Stattdessen: Scrollen = Straße wird nass, Pfützen entstehen von hinten nach vorne (Weltkoordinaten, fbm), darin gekräuselte Spiegelung der Bäume/des Lichts, Asphalt dunkler, feine Glanzpunkte. Laub zieht beim Scrollen weiter mit.

## Herbstallee live (Tiry 22.11.2026: „so ist es nice … setze das alles genauso live auf die Homepage“)
- Vorschau „Landschaften 3“ ist jetzt die echte Homepage (Startseite + alle Unterseiten): hg12-Hintergrund mit Herbstallee als Standard (Weinberg/Hochland über den Umschalter „Hintergrund 1/2/3“), nasse Straße beim Scrollen, Laub folgt dem Scrollen, kein Klick-Ring, kein Scan, Showroom-Verwandlung mit Blättern, Handy-Kopf (Öffnungsstatus, A+, roter Burger) und Laufband auf dem Handy.
- Fest im Bau: `tools/live_bauen.py` ruft nach `plus_design()` `entwurf-modern/hintergrund12/live_hg12.py` auf. Quellen: `hg12.js`, `hg12.css`, `vmorph-laub.js` (ersetzt den vMorphJs-Block, Hash-Prüfung bricht ab, wenn sich der Block im Prototyp ändert), `hgmob.css`; Bilder nach `img/hg12/`.
- **Korrektur Tiry 22.11.2026 („nur diese eine Vorlage Herbstallee … nicht dass man auf der richtigen Homepage die Vorlagen auswählen kann“):** Live gibt es NUR die Herbstallee, keinen Umschalter „Hintergrund 1/2/3“, kein Hinweis-Schild. `live_hg12.py` setzt `HG12_FEST='herbst'` (ignoriert `?hg=` und gespeicherte Wahl, lädt keine anderen Szenen), nur `herbst-*`-Bilder gehen live. Umschalter gibt es nur in den Vorschau-Seiten.

## Laufband oben – 3 Vorlagen (Tiry 22.11.2026)
- Wunsch: aktuelles Design, nur das Laufband oben neu, „2060“, Rot muss drin bleiben. Quelle `entwurf-modern/laufband/` (`bauen.py <live-index> <ziel>`), Vorschauen `/vorschau-laufband-1..3/` (noindex, nicht verlinkt):
  1. **Glas-Kapsel** – Flüssigglas-Schiene mit rotem Lichtleiter, rote Kristall-Trenner, Kippen zum Zeiger, darunter schmale Daten-Zeile.
  2. **Mikro-LED-Wand** – Canvas-LED-Matrix auf schräger Glasplatte, rote Lichtkante, Zeiger-Lichtkegel, Klick = Lichtwelle, Nachzieh-Spur beim schnellen Scrollen.
  3. **Rot-Metall** – die zwei gekreuzten Bänder als Körper (eloxiertes Rot mit Kante/Bürstung, Rauchglas dahinter), federn beim Scrollen, Lichtläufer am Zeiger, glühender Kreuzungspunkt.
- Alle: Scroll-Tempo beschleunigt das Band (gemeinsam.js). Live bleibt unverändert bis Tiry eine wählt.
- **Nachtrag 22.11.2026 (Tiry: „gefallen mir alle drei nicht“):** Vorlagen immer mit Umschalter 1·2·3 links auf EINER Seite; Bänder laufen immer komplett von Bildschirmrand zu Bildschirmrand (keine Pille mit Enden). Neue Seite `/vorschau-baender/` (`laufband/bauen.py`, `kern.js` + `v1-seide`, `v2-licht`, `v3-magnet`): 1 Seidenband 3D (WebGL-Lackbänder mit Wellen/Drehung/Licht), 2 Lichtspuren (Langzeitbelichtung Rück-/Frontlichter im roten Glasband), 3 Magnet-Lettern (jeder Buchstabe federt zur Maus, Scroll-Welle). Alte Seiten `vorschau-laufband-1..3` abgelehnt.
- **Nachtrag 2 (22.11.2026, Tiry: „zu ähnlich … teils unprofessionell“):** Seidenband/Lichtspuren/Magnet-Lettern verworfen. Neu auf `/vorschau-baender/`: 1 Glas-Monolith (gerade Milchglas-Schiene, unscharfe rote Tiefenebene, roter Lichtleiter), 2 Fokus-Zone (große Geisterschrift ohne Kasten, in der Bildmitte rot gefüllt mit echten Logo-Farben, Haarlinien), 3 Präzisions-Tafel (Anthrazit-Anzeigetafel, Info-Schiene, rote Trennschiene, Positionsnummern, rote Unterkante beim Zeigen). Lehre: keine Text-Umrisse mit Outfit (zeigt innere Überlappungen), nie Rosa durch halbtransparentes Weiß über Rot.

### Laufband-Vorlagen – Nachtrag 3 (Tiry 22.11.2026: „wirkt wie 1990 … wie vom Jahr 2200, Richtung Brabus, rötlicher Akzent“)
- Neue Vorschau `vorschau-baender/` (Umschalter 1·2·3 links), Typografie gemeinsam in `laufband/x-typo.css` (Großbuchstaben, gesperrt, weiß, Rot nur als Akzent):
  1. **Carbon-Plasma** – echtes Sichtcarbon (WebGL, 2/2-Köper), Licht folgt der Maus, rotes Plasma an den Kanten.
  2. **Laser-Gravur** – roter Laser brennt die Schrift im Lauf ein, Funkenflug, glühende Gravur-Zone.
  3. **Partikel-Schrift** – Schrift aus Tausenden Partikeln, setzt sich rechts zusammen, zerfällt links in rote Glut, Maus wirbelt Buchstaben auf.
- Abgelöst: Glas-Monolith, Fokus-Zone, Präzisions-Tafel. Live bleibt unverändert, bis Tiry wählt.

### Laufband-Vorlagen – Nachtrag 4 (Tiry 22.11.2026: „alles Schrott … bahnbrechend, Wunderwerk der Technik“)
- Neuer Kern `laufband/gkern.js`: Schrift wird als Signed-Distance-Field (Felzenszwalb-EDT) in eine Textur gerechnet und vom Shader als Geometrie benutzt; DOM-Text bleibt unsichtbar für Screenreader.
  1. **Flüssigmetall** – Band = Höhenfeld aus flüssigem Chrom, Buchstaben steigen rechts aus dem Metall auf und versinken links; Maus wirft Ringwellen.
  2. **Hyperloop-Glasröhre** – massive Glasröhre bricht den echten Herbst-Hintergrund (mit Farbzerlegung), rote Licht-Kapseln rasen durch, Maus = Flüssig-Linse.
  3. **3D-Titan-Lettern** – echte 3D-Buchstaben per Raymarching, Torsionswellen drehen die Schrift einmal um die eigene Achse, rot glühende Flanken.
- Abgelöst: Carbon-Plasma, Laser-Gravur, Partikel-Schrift. Live bleibt unverändert, bis Tiry wählt.

### Laufband – Neustart „bestehendes Band veredeln“ (Tiry 22.11.2026)
- Tiry: keine der Laufband-Vorlagen nutzbar → alle Band-Vorschauen gelöscht (vorschau-baender, vorschau-laufband-1..3).
- Neu: `vorschau-band/` = das bestehende Doppelband (Aufbau, Schrift, Pillen, Inhalte gleich), nur veredelt, reines CSS (`laufband/z1..z3.css`):
  1. **Satin & Lichtlauf** – Satin-Wölbung, alle 8 s läuft ein Lichtstreif durch, hinteres Band Rauchglas, Funkeln dreht sich.
  2. **Klarlack & Tiefe** – Lack-Glanzkante, laufende Kupferlinien oben/unten, Pillen mit Glasschliff, hinteres Band unscharf (Tiefenschärfe).
  3. **Champagner-Linie** – feine 115°-Riffel der Homepage, Champagner-Doppellinien mit Lichtlauf, Funkeln in Champagner.

### Laufband „Klarlack & Tiefe“ live (Tiry 22.11.2026: „setze Nummer 2 um in live … lösche danach die Vorlagen von den Laufbändern“)
- Live: `laufband/z2.css` über `laufband/live_band.py` (aufgerufen in `tools/live_bauen.py` nach `live_hg12.py`) – Lack-Glanzkante, laufende Kupferlinien, Pillen mit Glasschliff, hinteres Band unscharf. Aufbau/Inhalte des Bands unverändert.
- Alle Laufband-Vorlagen gelöscht (Vorschau `vorschau-band`, Varianten 1/3, Umschalter-Werkzeug).

### Winter-Aktion: Kristall-Schneeflocken + Service ohne i:SY-Blumenbild (Tiry 22.11.2026)
- Statt weißer Punkte fallen in allen –20-€-Aktionen echte kleine Schneeflocken (6 Arme mit Ästen, Sechseck-Kern, scharf als Vektor, drehen sich), nur ganz leichtes Funkeln, kein Glitzern: Canvas `#snow` (Startseite `#deal`) und Winter-Karte `.wcard .wsn` (Service, SVG-Flocken).
- Service: Bild `isy-blumen.webp` (Oval unter der Winter-Karte) entfernt.

### Knöpfe-Prüfung + Klick-Sperre durch Menü-Vorschau behoben (Tiry 22.11.2026)
- Ursache „Inspektion & Reparatur nicht anklickbar“: Die Vorschau-Tafel des Menübands (`#lbp`, fixiert) blieb nach Hover/Klick im Menü unsichtbar über dem Inhalt liegen – ihre zuletzt gezeigte Seite (`.lbp-pg.on`) hatte `pointer-events:auto`. Das blockierte auf allen Seiten alles unterhalb des Menüs.
- Behoben: `.lbp:not(.on),.lbp:not(.on) *{pointer-events:none!important}` + `close()` nimmt auch `.on` von den Vorschauseiten. Nicht zurückbauen.
- Alias `#showroom` zeigte ins Leere → jetzt `marken#showroom2`.
- Gesamtprüfung (PC 1366×768 alle 11 Ansichten mit echtem Mausklick, Handy Pixel 7 Burger-Menü): alle internen Links landen in der richtigen Ansicht/am richtigen Abschnitt, alle Knöpfe reagieren, keine JS-Fehler. 57 externe Links erreichbar (bosch-ebike.com sperrt nur Prüf-Programme mit 403, Seiten sind echt vorhanden). „Gespeicherte Einstellungen löschen“ (Datenschutz) lädt absichtlich neu.

### (ERSETZT 23.11.2026, siehe „Schrift passt sich an“) Lesbarkeit auf dem Herbst-Hintergrund: echte Glasplatten statt Milchglas-Maske (Tiry 22./23.11.2026)
- Verworfen: weichgezeichnete Milchglas-Maske im Shader (Tiry: „sieht aus wie hingesprayt“). Nie wieder Nebel/Maske hinter der Schrift.
- Verworfen (23.11.): Platten nur aus Textzeilen gerechnet – Folge: riesige Flächen, Knöpfe/Pillen/Logos hingen halb in der Platte, Platten überlappten Karten und die Fußzeile. **Regel: nichts hängt halb in einer Platte, keine Platte überlappt eine Karte oder eine andere Platte, keine Riesen-Flächen.**
- Jetzt in `hintergrund12/hg12.js` (`gpBuild`) + `hg12.css` (`#hgGl .hgp`):
  1. Alle sichtbaren Flächen/Bilder der Ansicht werden gesammelt: groß = Karte (Fläche ≥ 150×64, Fotos, Bilder ≥ 130 px hoch), klein = Pille/Knopf/Symbol/Logo. Reine Deko-Ebenen (absolut + aria-hidden bzw. z-index < 0) zählen nicht.
  2. Dunkler Freitext steigt bis zu seinem Inhaltsblock hoch (höchster Vorfahr ohne Karte); Nachbar-Blöcke ohne Karte dazwischen = eine Gruppe. Kleine Elemente der Gruppe (≤ 70 px entfernt) gehören komplett in die Platte.
  3. Lücken ≥ 72 px (Handy 56) quer über alle Spalten teilen eine Gruppe in mehrere Platten. Nur Knöpfe/Pillen allein bekommen keine Platte.
  4. Platte = Gruppe + Luft (30/28 px, Handy 14/18); an fremden Elementen und anderen Platten wird sie mit 12 px (Handy 8) Abstand gekappt. Spaltenbreite nur, wenn der Inhalt > 72 % der Spalte füllt.
  5. Sonderfälle: Schrift auf einem Foto (`object-fit:cover`) bekommt keine Platte · zart getönte Karten mit dunkler Schrift (Zitate i:SY/Treffen) bekommen Glas in exakt ihrer Form · seitlich wischbare Leisten bekommen eine Platte in Form der Leiste · Einflug-Versatz (`.pre`, `.hello`) wird herausgerechnet (gemessen wird die Endlage) · rutscht der Inhalt, rücken die Platten sofort mit (`gpShift`), Neuaufbau folgt gedrosselt.
- „Luft für die Glasplatten“ am Ende von `hg12.css`: mehr Abstand an Stellen, wo Freitext direkt an einer Karte klebte (Fußnote unter der Fußzeile, Showroom-Kopf, Marken-Info, ENRA-Tabelle, Lager-Überschrift, Treffen-Kopf, Start-Logo). Dazu Umbruch langer Links in Rechtstexten am Handy.
- Prüfwerkzeug (Sitzung): automatische Prüfung je Ansicht PC + Handy auf „halb drin“, Platte-auf-Platte, zu enge Ränder, Text ohne Platte – plus Bilder jeder Seite bis zur Fußzeile. Bewusst übrig: Schrift auf Fotos, Urkunden-Reiter und Rekord-Button beim Treffen (liegen gewollt auf dem Bild).
- Service-Symbole (`.srow .ic`, 15 Stück) neu: eigene Duotone-Symbole `#d-*` (bike, wrench, euro, shield, case, box, chat, map, star) in roter Kristall-Kugel mit weißem Ring, Glanz und Lichtring beim Drüberfahren (`plus.css`).

### Leistung: Animationen sparsam, gleiche Optik (Tiry 23.11.2026: „weniger Leistung, kein Ruckeln auf schwachen Geräten, an Qualität nichts verlieren“)
- Gemessen (Chromium ohne Grafikkarte = schwaches Gerät): Hintergrund-Shader und Dauer-Animationen außerhalb des Bildschirms fraßen fast die ganze Rechenzeit (Startseite 2–3 Bilder/s).
- **Spar-Logik** (Ende von `hintergrund12/hg12.js`): jedes Element mit CSS-Animation wird beobachtet (`animationstart` + `getAnimations`); außerhalb des Bildschirms (240 px Vorlauf) bekommt es `.vOff` = Animation angehalten, beim Hereinscrollen läuft sie weiter. Alles Sichtbare läuft immer – das ist **keine** Reduce-Motion-Regel.
- **Glanzläufe** (`plSheen` auf `.gcard/.score/.visit .in/.pf`, `osheen` auf `.ostat`) wandern per `transform` statt `background-position` (`plSheenT`/`osheenT` in `hg12.css`, Flächen mit `overflow:clip`). Bildvergleich alt/neu zu drei Zeitpunkten: keine Abweichung. Nicht auf `background-position` zurückbauen.
- **Leistungs-Regler** im Hintergrund (`gov`): ab < ~38 Bildern/s sinkt erst die Auflösung (bis 50 %), dann wird der Hintergrund nur jedes 2./3./4. Bild gerechnet; jede Stufe wird geprüft und zurückgenommen, wenn sie nichts bringt (z. B. Stromsparmodus). Erholt sich das Gerät, fährt alles wieder hoch. Ohne Grafikkarte (SwiftShader/llvmpipe): stehendes Hintergrundbild, neu nur nach Scrollen/Größenänderung. Stand abfragbar: `HG12_STAT()`.
- Lichtring der Service-Symbole dreht nur beim Drüberfahren (lief vorher unsichtbar dauernd).
- Messwerte Startseite (Testrechner ohne Grafikkarte): PC 2–3 → 32–57 Bilder/s; Handy (4-fach gedrosselt) 4–5 → ~60 im Stand, ~32 beim Scrollen. Mal-Arbeit (RasterTask) Seitenmitte 1.583 → 121 ms/s, unten 1.865 → 14 ms/s.
- Offen/möglich: Laufband-Leuchten `lbPu` (text-shadow, nur oben auf der Startseite) und `flow` (Verlaufsschrift) malen weiter jedes Bild – nur wenn sichtbar.

### Lesbarkeit: Schrift passt sich dem Foto an, keine weißen Kästen (Tiry 23.11.2026: „so viele weiße Kästen zerstören den Look“, „eher was mit der Schrift machen als mit dem Hintergrund“)
- **Alle Glasplatten aus** (`#hgGl{display:none}`). Der Hintergrund bleibt unverändert (kein Nebel, keine Maske – beides abgelehnt).
- `gpBuild` sucht weiter den Freitext, der direkt auf dem Foto liegt, und markiert ihn nur noch: `hgTxL` dunkle Schrift, `hgTxD` helle Schrift, `hgTxG` Verlaufsschrift (Kinder mit transparenter Füllung).
- **Anpassung live (sparsam, nach Mini-PC-Hänger 23.11.):** `txSample` kopiert den Hintergrund direkt nach dem Zeichnen einmal verkleinert auf 48×30 in ein 2D-Canvas (ein kleiner Rücklauf), nur wenn das Scrollen 160 ms steht, nach Aufbau/Größenänderung und alle 2,5 s (bei > 12 ms Rechenzeit alle 8 s). **Nie wieder `gl.readPixels` pro Bild/pro Textblock** – auf Windows-Onboardgrafik (ANGLE/D3D) blockiert jeder Rücklauf, der Mini-PC (N5000) hing komplett. Hell → dunkle Schrift mit feiner weißer Kontur. Dunkel (< 0,63, zurück erst > 0,71) → **weiße Schrift mit feiner dunkler Kontur** (`hgTxW`), Farbwechsel weich 0,45 s.
- Kontur = `-webkit-text-stroke` mit `paint-order:stroke fill` (sitzt hinter den Buchstaben), max(2px, ~0,05em) + kleiner Schatten. **Kein breiter Lichtsaum** (wirkte verschmiert).
- Text in Karten mit eigener Fläche (Hintergrundfarbe > 30 %, Verlauf, deckendes ::before/::after) wird nie markiert (`onCard`); Markierungen, die nicht mehr zutreffen, werden bei jedem Neuaufbau entfernt.
- Abstands-Block „Luft für die Glasplatten“ entfernt.

### Leistung Hintergrund für schwache Geräte, ohne sichtbaren Verlust (Tiry 23.11.2026)
- **Shader schlanker (−26 % Rechenzeit, Pixelvergleich alt/neu bei gleichem Zeitpunkt: Ø 0,3/255, 99 % ≤ 3/255):** Cinemagraph-, Nebel-, Lichtstrahl-, Sonnenstrahl- und Glitzer-Teile werden nur dort gerechnet, wo sie etwas beitragen; Tiefen-Schleife 4 statt 6; Kino-Unschärfe 6 statt 10 Abtastungen, Lichtstrahlen 8 statt 14 – beide mit Zufallsversatz je Pixel (keine Stufen), Gewichte gleich.
- **Regler v2 (`gov`):** prüft jede Sekunde (vorher alle 75 Bilder = auf langsamen PCs Minuten → Seite hing). Reihenfolge: 1. Hintergrund 30 statt 60 Bilder, 2. Auflösung bis 60 %, 3. 20/15 Bilder. Unter 16 Bildern/s: 30 Bilder + 75 % sofort. Jede Stufe wird nach ≥ 15 Bildern geprüft und ggf. zurückgenommen.
- **Schwache Grafik ab Start erkannt (`WEAK`)**: Intel HD/UHD (ohne Iris, z. B. Mini-PC N5000 = UHD 605), Mali-T/G1x–G5x, Adreno ≤ 61x, PowerVR, ≤ 2 Kerne → Hintergrund von Anfang an mit 30 Bildern, bleibt dort.
- Prüfen am Gerät: Konsole `HG12_STAT()` zeigt weak/qs/skip/ft.

### Schrift auf dem Foto: dauerhaft dunkel mit weißer Umrandung (Tiry 23.11.2026: „blinkt ins Weiß“ → „standardmäßig schwarze Schrift mit leicht weißer Umrandung, bei allen“)
- Umschalten nach Hintergrund (`txSample`, `hgTxW`) komplett entfernt – kein Pixel-Lesen mehr. Dunkler Freitext auf dem Foto = `hgTxL`: Umrandung `-webkit-text-stroke:max(2.2px,.06em)` weiß .95 hinter den Buchstaben (`paint-order:stroke fill`) + kleiner weißer Schein. Helle Schrift (`hgTxD`) und Verlaufsschrift (`hgTxG`) wie gehabt. Nicht wieder auf adaptive Farben umstellen.
- **Blinken/Last behoben (23.11.2026):** Die Markierung lief über die alten Platten-Beobachter (ResizeObserver/MutationObserver auf `main`) ständig neu (~75 Klassen-Änderungen/s im Stillstand) und entfernte/setzte Klassen. Jetzt: nur bei Laden, Schriften fertig, Größenänderung, Ansichtswechsel (+1,6 s) und einmalig, wenn ein Element eingeblendet wird (`.pre` → `.in`); **nur hinzufügen, nie wieder entfernen**; `gpBuild` endet nach dem Markieren (kein Plattenbau). Noch nicht eingeblendete `.pre`-Karten werden übersprungen. Gemessen: 0 Änderungen im Stillstand.
- **23.11.2026 – Dienstrad „In 4 Schritten“ (Tiry: „Schrift vergessen“):** Die dünne Verlaufslinie `.flow::before` zwischen den Kreisen zählte in `onCard` als Karte → Schritt-Texte ohne Saum. Pseudo-Ebenen zählen jetzt nur noch als Karte, wenn sie mind. 40 % der Höhe decken. **Beim Ausliefern per Neubau:** vorher `git log` im Web-Repo prüfen – Bilder-Agent-Commits seit dem letzten Bau danach per `git cherry-pick` wieder draufsetzen (sonst dreht der Bau getauschte Lager-Fotos zurück).

## 23.11.2026 – Winter-Aktion Kontrast, Bilder, Kanten (Tiry: „beheb das schonmal“, ohne Wow-Moment)
- Winter-Aktion ohne Pink/Magenta: Akzente Champagner (#F3CFA6/#F6D7B4), „!“ + „GRATIS“ + LIVE-Pille Velocenter-Rot; Pillen dunkles Glas statt Weißschleier.
- Schneeflocken über Textflächen nur noch 12 % sichtbar (`txr`/`TX` im Schnee-Skript) – Schnee läuft weiter, stört aber keine Schrift.
- „–20 €“ nicht mehr abgeschnitten, sichtbare Kante bündig mit der Textkante (84 px PC / 18 px Handy, `margin-left:-.05em`, `transform-origin:0 72%`).
- WhatsApp-Knopf Handyleiste dunkleres Grün (Kontrast). Sattelüberzug in 560 px, Fassade-Kachel 640 px (`plus_varianten.py`/`plus_bauen.py`).
- Schnellzugriff-Kacheln laden ihr Foto erst in Sichtnähe (`.qa:not(.ld) .bg{background-image:none}` + IntersectionObserver). Bosch-Kachel bleibt Original (Panorama 1920×450, kleinere Variante wäre unscharf).
- Bewusst nicht geändert: Bilder, die nur bei 1×-Messung „zu groß“ wirken (Hero-KTM 900 px, Lager-Karten 400 px) – auf Handys mit 3×-Bildschirm genau richtig.

## 23.11.2026 – Rechtsprüfung umgesetzt (Tiry)
- Streichpreise überall mit „UVP“ davor (Lager-Karte, Detail, Rad-Finder, Admin-Vorschau); „regulärer Preis“ bei Leasing/Aktion = UVP. Livegang-Haken `preise` erledigt.
- Bewertungen: bei jedem Besuch 3 zufällige aus dem Pool (`bewRender` mischt), darunter Pflichthinweis § 5b Abs. 3 UWG (`.bwh`). Pool = Admin → Bewertungen (nur echte Google-Texte, unverändert). Hinweis nie entfernen.
- Finanzierung: „effektiver Jahreszins 0,00 %, gebundener Sollzins 0,00 % p. a.“ + Bonität in Fußnote und Kurzkarte.
- „300+ / über 300 E-Bikes“ → überall 250 (Tiry). „Weltmarktführer“ (Van Raam) entfernt – kein Beleg gefunden; jetzt „Spezialrad-Hersteller“. Rahmen-Garantie = „Herstellergarantie von Van Raam“.
- Herstellerfotos: Tiry geht von Nutzungsrecht über Händlerstatus aus (23.11.2026).

### Google-Bewertungen automatisch (Tiry 23.11.2026)
- Die KI-Zentrale (Haupt-PC) holt die Bewertungen über die Google-Schnittstelle und schreibt nach jedem Abruf (höchstens alle 6 Std.) die 5-Sterne-Bewertungen mit deutschem Text (25–320 Zeichen, ohne Links, Name sichtbar) als Vorrat in `site/bewertungen` (seit 23.11. abends alle 5-Sterne mit Text, 8–600 Zeichen, max. 350; vorher max. 40 neueste, Name „Vorname N.“, Feld `g` = Google-Kennung). Startseite zeigt je Besuch 3 zufällige.
- Eigenes Firebase-Konto `bewertungen@admin.velo-center.de`, Regel: darf nur `site/bewertungen` schreiben (Felder score/items/ts/von, ≤ 400 Einträge). Im Admin von Hand eingetragene und „ausgeblendete“ bleiben erhalten.
- Hinweis unter den Bewertungen (§ 5b Abs. 3 UWG, Pflicht, bleibt): „Auswahl echter 5-Sterne-Bewertungen aus unserem Google-Profil. Ob die Verfasser bei uns gekauft haben, prüfen weder wir noch Google.“
- Bewertungen laufen durch (Tiry 23.11.2026): alle 10 s schiebt sich rechts eine neue zufällige Bewertung herein und drückt die linke hinaus (`bwTick`, nur transform/opacity, will-change nur während der Bewegung, Pause bei verstecktem Tab/außer Sicht). Gemessen CPU 4×: 60 Bilder/s, 0 ms Layout.

### Symbole modern (Tiry 23.11.2026: „sehen aus wie WhatsApp-Icons“)
- `.srow .ic`: Glas-Linse (weiß, Tiefe, feiner Kupferrand) statt glänzender roter Kugel mit Lichtfleck; Symbole `e-*` = Kopie der `d-*` mit Rot-Verlauf (`#icg`/`#icf`, userSpaceOnUse). Hover: rote Linse ohne Glanzfleck, Symbol weiß, Lichtring kreist. Glanzkugel nicht wieder einbauen.

### Winterkarte im Termin-Bereich wie Start-Aktion (Tiry 23.11.2026)
- `.wcard` (Service + alle Unterseiten): kein Pink/Magenta mehr – „2026/27“, „–20 €“-Verlauf, „Marken-Fahrräder/Bosch-Antrieb“ in Champagner (#F3CFA6/#F6D7B4), „!“ und „Gratis“ Velocenter-Rot, Pillen dunkles Glas, violetter Schimmer → Grau.
- Schneeflocken über Schrift nur noch 12 % (Maske `.wsn` aus den Textflächen, neu berechnet bei Laden/Schrift/Größe), wie `#snow` auf der Startseite.
- Menü-Vorschau Service: Zeile „Nur Marken-Fahrräder mit Bosch-Antrieb“ Champagner statt Rosa. Übrige Winter-Stellen (Schnellzugriff, Service-Liste) ohne Pink/Schnee – geprüft.

### Symbole realistisch (Tiry 23.11.2026: „mehr Realistik“)
- `.srow .ic` zeigt echte 3D-Renderings statt Linien-Symbolen: `img/ic3d-<name>.webp` (bike, wrench, euro, shield, case, box, map, star, chat; 192 px, zusammen ~45 KB), gerendert mit Three.js (Rotlack mit Klarlack, Chrom, Gummi, Gold, Karton) in Studio-Licht, frei stehend mit weichem Bodenschatten (Klasse `.ic.i3`, 76 px, Handy 62 px). Hover hebt das Objekt leicht an und dreht es. Ersetzt die Glas-Linse von vorher; nicht zurück auf flache Symbole.
- Stufe 2 (Tiry 23.11.2026 nachts: „1000 % realistischer“): Oberflächen mit Struktur (gebürstetes Chrom, Lederkorn mit Ziernaht + Chrom-Ecken/Schlössern, Kartonfaser, Reifenprofil, Rippen-Griff am Schlüssel, geriffelter Münzrand), echter weicher Kontaktschatten im Bild (kein CSS-Schatten mehr), E-Bike mit Schutzblechen, Kettenblatt, Pedal, Gepäckträger, Lampe; Render 768 px → 224 px. Quelle: Scratchpad-Szene (Three.js r159).
- Bewertungs-Lauf ohne Rücksprung (Tiry 23.11.2026 nachts: „links tauchen 1 s später 3 andere auf“): Ursache war der CSS-Übergang beim Aufräumen – alle Karten sprangen eine Kartenbreite zurück und rutschten neu herein. Jetzt Übergänge aus, Verschiebung zurücknehmen, erst nach 2 Bildern Stile löschen. Handy (untereinander): neue Karte startet unter der letzten (vorher 45 px Sprung am Ende).

### Google-Logo an der 4,8-Karte (Tiry 23.11.2026)
- `.score` hat unten rechts eine weiße Glas-Plakette mit dem originalen mehrfarbigen Google-„G“ (`.sgl`, 58 px, Handy 48 px). Oben rechts überdeckte sie am PC die „8“.
- Bewertungskarten alle gleich hoch (Tiry 24.11.2026, „Seite springt hoch und runter“): `bwH()` misst beim Laden, nach den Schriften und bei Fenstergröße alle Bewertungen im Vorrat und setzt `--qh` = längste (gedeckelt PC 50 %, Handy 42 % der Fensterhöhe); längere Texte blenden unten weich aus (`.qcut`). Gemessen: Karten PC 337 px, Handy 276 px konstant über mehrere Wechsel; 4,8-Karte konstant 355×342. Vorher wuchs der Block 261 → 285 → 316 px (Ursache des Springens, nicht die 4,8-Karte).
- **24.11.2026 – Bilder-Agent: zweimal geprüft = endgültig (Tiry):** Ein Lager-Foto, das der Agent in `pruefen` zweimal mit `ok` bewertet (Modell, Jahr, Farbe), gilt automatisch als bestätigt wie Admin „✓ Richtig“ (`OK_AUTO`, Zähler `ok_n`, `auto_bestaetigt` in `data/bilder_status.json`) und wird nie mehr gegen ein anderes Foto getauscht. Die Qualitäts-Runde läuft weiter, darf aber nur eine bessere Fassung derselben Aufnahme nehmen. Bei neuem Foto oder Admin „✕ Falsch“ fällt die Bestätigung weg (das neue Foto muss wieder zweimal durch).

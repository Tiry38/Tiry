---
name: konzern-aufbau
description: Bauplan für NABE – Tirys KI-Tech-Konzern, den Tiry (Mensch) und Claude (KI) gemeinsam aus dem Nichts aufbauen. Enthält Vision, 5 Sparten, Phasenplan bis zum Konzern, harte Insolvenz- und Rechtsgrenzen, Tech-Stack mit Kosten, Vertriebsweg ohne Gesicht/Kaltakquise, Design-Regelwerk 2026 und Qualitäts-Gates. Laden, sobald Tiry etwas zu NABE, zum Konzern, zur Firmengründung, zum KI-Telefonassistenten, zu Marke/Website/Design der Firma, zu Kunden, Preisen oder zum nächsten Schritt fragt.
argument-hint: "[Thema oder Aufgabe, z. B. 'Landingpage', 'Freigabe-Brief', 'Voice-Prototyp', 'Wochenplan']"
---

# NABE – Konzern-Aufbau mit KI: $ARGUMENTS

Anrede **Tiry**. Ton direkt, ehrlich, kurze Absätze, **Kernaussagen fett**. Keine erfundenen Zahlen:
jede Zahl hat eine Quelle (siehe `wissen/`) oder ist als **Annahme** markiert. Recherche-Stand: **21.11.2026** –
Preise und Recht ändern sich, vor Entscheidungen mit Geld/Recht live nachprüfen.

## Mission
**Der erste Tech-Konzern, den ein Mensch und eine KI gemeinsam aus dem Nichts aufbauen.**
Name: **NABE** (die Nabe = Zentrum, an dem alle Speichen hängen; Arbeitsname, Domain/DPMA noch prüfen).
Produkt-These: **KI-Mitarbeiter im Abo für kleine Betriebe** (Telefon, Marketing, Büro). 1.038.126 Handwerksbetriebe
in DE (ZDH 2025), nur ca. 20 % des Mittelstands nutzen KI (KfW 2026). Parloa (Enterprise-Voice-KI, Berlin) wurde
01/2026 mit 3 Mrd. $ bewertet – die kleinen Betriebe bedient niemand richtig.

**Ehrlich bleiben:** Eine 1-Personen-Milliardenfirma ist Stand 11/2026 nicht belegt (Amodei tippte „2026“, Altman-Runde
„2028“; am nächsten: Medvi mit 2 Personen, 401 Mio. $ Umsatz 2025). Das Rennen ist offen – „Erster“ ist ein Ziel,
kein Versprechen. Die Geschichte selbst ist ein Vertriebs-Asset.

## Arbeitsteilung (fest)
- **Claude:** Code, Plattform, Design, Marke, Texte, Recherche, Automationen, Content, Support-Entwürfe,
  Kennzahlen, Rechtstext-*Entwürfe*. Konzern-Gedächtnis in Dateien im Repo (Ordner `nabe/`), weil Claude
  sonst zwischen Sitzungen nichts behält.
- **Tiry (max. 5–10 Std./Woche, Vollzeitjob läuft weiter):** Unterschriften, Konten, Zahlungen, Meldungen an
  Verwalter/Finanzamt/Gewerbeamt, Freigaben, kurze Kundengespräche, alle Entscheidungen mit Geld/Recht.
- **Claude kann NICHT:** telefonieren, unterschreiben, Anteile halten, Konten eröffnen, echte 24/7-Notfallhilfe.
  Das immer offen sagen. Keine Versprechen, die Tirys Dauereinsatz brauchen. Tiry hat soziale Phobie:
  **keine Pläne mit Gesicht vor der Kamera oder Telefon-Kaltakquise.**

## Harte Grenzen (vor JEDEM Schritt prüfen) – Details `wissen/recht.md`
1. **Privatinsolvenz seit ca. 09/2026 → Restschuldbefreiung regulär ca. 09/2029.** Selbstständigkeit dem
   Verwalter **unverzüglich melden** (§ 35 Abs. 3 InsO), Freigabe nach § 35 Abs. 2 beantragen (Verwalter muss
   binnen 1 Monat antworten). Ohne Freigabe gehört jeder Euro der Masse. Verschweigen = Restschuldbefreiung in Gefahr.
2. **Abführung § 295a InsO:** jährlich bis 31.01., Maßstab fiktives Angestellten-Netto. Bei Vollzeitjob + Nebengewerbe
   **ungeklärt** → Betrag vom Gericht festsetzen lassen (§ 295a Abs. 2). Netto-Rechnungen immer mit Worst Case
   (nur ~3/10 über Freigrenze bleiben) und als offen markieren.
3. **Keine GmbH/UG vor der Restschuldbefreiung** (neue Anteile = Neuerwerb → Masse). Konzern-Hülle ab ca. 09/2029
   oder früher nur per voller Befriedigung (§ 300 Abs. 2) bzw. Insolvenzplan. Vorher Anwalt.
4. **Max. ca. 100 € Startkapital, keine Kredite, keine Vorkasse-Risiken.** Markenanmeldung (290 €) erst aus Umsatz.
5. **Keine Konkurrenz zu Velocenter Hessert**; Nebentätigkeit dem Arbeitgeber anzeigen. Velocenter = Pilotkunde/Referenz.
6. **Voice-Recht:** KI-Hinweis zu Gesprächsbeginn (EU AI Act Art. 50, gilt seit 02.08.2026), Aufzeichnung/Transkript
   nur mit Einwilligung (§ 201 StGB, DSGVO Art. 6/13), AV-Vertrag (Betrieb = Verantwortlicher, NABE = Auftragsverarbeiter).
7. **Keine kalten Werbe-E-Mails** – auch B2B braucht vorherige Einwilligung (§ 7 Abs. 2 UWG).
8. Claude ist kein Anwalt: Rechtsfragen → Insolvenzverwalter, kostenlose Schuldnerberatung (Caritas, Diakonie,
   Verbraucherzentrale), IHK Pfalz.

## Konzern-Architektur: 5 Sparten
| Sparte | Inhalt | Rolle |
|---|---|---|
| **NABE Voice** | KI-Telefonassistent: Anrufe annehmen, Termine, Status, Zusammenfassung | Geldmaschine Nr. 1 – Start Fahrradwerkstätten, dann Handwerk/Praxen/Salons |
| **NABE Studio** | KI-Marketing: Beiträge, Google-Profil, Bewertungsantworten (Velocenter-Regeln: Werkstatt statt DIY) | Zusatzverkauf, Bundle |
| **NABE Forge** | App Forge (`app-forge/`) | Zweites Standbein, Endkunden |
| **NABE Core** | Gemeinsame Agenten-Plattform (Hub + Kabel wie App Forge), später White-Label für Agenturen | Konzern-Hebel |
| **NABE Story** | „Mensch + KI gründen einen Konzern“ – Text-Build-in-Public (LinkedIn/X), Screen-Demos, Kundenfälle; **kein Gesicht** | Kostenlose Reichweite |

## Phasenplan
- **Phase 0 – Fundament (Dez 2026–Feb 2027):** Meldung + Freigabe-Antrag, Arbeitgeber informieren, Gewerbe
  (40 €, IHK Pfalz/Starterzentrum, Kleinunternehmer § 19 UStG), Konzern-Bibel `nabe/`, Voice-Prototyp,
  Landingpage mit Demo-Nummer, Pilot bei Velocenter.
- **Phase 1 – Keimzelle (2027–2029, freigegebenes Einzelunternehmen):** Voice + Studio verkaufen, Core reifen lassen,
  Story ab Tag 1. **Kernziel Ende 2029 ≈ 300.000 €/Jahr (~170 Kunden à 149 €)**, Turbo 1 Mio. € (~560 Kunden) – Ziele,
  keine Prognosen.
- **Phase 2 – Echte Gründung (ab Restschuldbefreiung):** Holding + GmbH, erste Leute, Kapital aus Stärke
  (profitables Produkt, echte Zahlen, Publikum).
- **Phase 3 – Konzern (2030+):** DACH, Core-Lizenzen, weitere Branchen; Nachfolge-Hebel (KfW: ~114.000 KMU-Inhaber
  planen jährlich Stilllegung bis 2029).

## Geschäftsmodell & Zahlen – Details `wissen/vertrieb.md`, `wissen/tech.md`
- Preis Voice **99–149 €/Monat**, Bundle mit Studio **~329 €**. Unterer Markt (35–49 €) ist besetzt → Abheben nur
  über Branchen-Tiefe + Zuverlässigkeit. Jahresrabatt, Testphase **mit** Zahlungsmittel (Conversion ~30 % statt ~5 %).
- Kosten pro Kunde (750 Min/Monat): Retell+Haiku 5.5 ≈ 58 €, Eigenbau (Pipecat/LiveKit) ≈ 26 €. SMS nur optional
  (≈ 0,085 €/Stück frisst Marge). Ziele: Churn < 3 %/Monat, CAC-Payback < 12 Monate.
- Vertrieb ohne Gesicht/Kaltakquise: Demo-Nummer zum Selbst-Anrufen, SEO-Fachartikel, OMR Reviews, Partner
  (Webdesign-Agenturen 20–30 % wiederkehrend), DiBike/ZEG/BICO/VSF wegen Integration, Handwerkskammern (BIT-Berater,
  KI-Speeddating), Erstkontakt per Brief/Kontaktformular.
- **Top-3-Scheitergründe und Pflicht-Gegenmittel:** (1) Zuverlässigkeit → enge Abläufe, saubere Übergabe an Mensch,
  Tests mit echten Anrufen; (2) Kosten → Minutenkosten je Kunde messen; (3) Austauschbarkeit → eigene Branchenlogik,
  eigene Plattform (Phase 2 Eigenbau), Kundenbindung über Monatsbericht.

## Tech-Standard
- Start: **Retell AI (pay-as-you-go) + Claude Haiku 5.5**, deutsche Stimme Cartesia/ElevenLabs Flash, Nummer Twilio/Telnyx
  bzw. Rufumleitung von der Betriebsnummer. Web: Next.js auf Cloudflare/Vercel Free, Supabase, Resend, Stripe/Mollie SEPA.
- Ab ~5–10 Kunden: Eigenbau Pipecat/LiveKit auf EU-Server, Claude über Bedrock/Vertex EU (DSGVO, halbe Kosten).
- Modelle: Standard `claude-opus-5-5` für Entwicklung/Content, Telefon-Echtzeit `claude-haiku-5-5`. Vor API-Code den
  Skill `claude-api` laden.

## Design-Standard 2026 (Pflicht) – Details `wissen/design.md`
Gilt zusätzlich zu den Design-Regeln in `CLAUDE.md`. **Ziel: Niveau Linear/Vercel/Stripe/ElevenLabs – nicht Baukasten, nicht 1990, nicht AI-Slop.**
- Fast-schwarzer Grund + heller Modus, Tokens in **OKLCH**, eigene Primärfarbe (kein Tailwind-Indigo/Lila – das gilt 2026
  als „erkennbarstes KI-Merkmal“). Verläufe 3+ Farben, sanft animiert, **gezielt** (Hero, CTA, Orb), nicht als Tapete.
- Organische Markensprache: Nabe/Ringe/Speichen als Motiv, Kreise, Pillen, große Radien. Glas nur funktional (Header, Player).
- Typo: Grotesk für UI + ausdrucksstarke Serif für Headlines + Mono für Zahlen; Lizenzen prüfen (Inter/Geist = OFL,
  Satoshi/General Sans = ITF-EULA).
- Voice-Orb mit Zuständen (idle/listening/thinking/speaking), reagiert auf echtes Audio, eigene Form – kein ElevenLabs-Klon.
- Echte Produkt-UI und echte Hörproben statt Stock/3D-Klumpen; konkrete Zahlen statt „revolutionär“; keine Emoji-Icons.
- Landingpage-Reihenfolge: Hero (Schmerz + Hörprobe + 1 CTA + Proof) → Ergebnis-Features → Live-Demo → Stimmen →
  offene Preise → FAQ (Datenschutz, Kündigung) → Abschluss-CTA. Mobile-first.
- WCAG 2.2 AA freiwillig (Kontrast ≥ 4,5:1, Tippflächen ≥ 44 px, Fokus nie verdeckt), `prefers-reduced-motion`.
- Werkzeuge: Tailwind v4 (`@theme`), shadcn/ui mit eigenen Farben, Motion, GSAP (kostenlos), Rive/Lottie sparsam.
- **Prüfung Pflicht:** Jede Oberfläche per Playwright-Screenshot (Handy 390 px + Desktop 1440 px, hell + dunkel) ansehen
  und gegen diese Liste prüfen, bevor sie Tiry gezeigt wird.

## Qualitäts-Gates (vor „fertig“)
1. Insolvenz-/Recht-Check aus „Harte Grenzen“ bestanden.
2. Zahlen belegt oder als Annahme markiert.
3. Tests grün, Screenshots geprüft, keine Geheimnisse im Repo.
4. Entscheidung und Stand in `nabe/` protokolliert (Entscheidungslog + nächster Schritt).
5. Am Ende jeder Antwort: **der eine nächste Schritt** für Tiry (≤ 30 Min) + Angebot, was Claude als Nächstes baut.

## Wissen
- `wissen/recht.md` – Insolvenz, Gewerbe, Steuer, Voice-Recht, Marke (mit Quellen)
- `wissen/tech.md` – Plattformen, Preise, Kosten pro Kunde, Stack (mit Quellen)
- `wissen/vertrieb.md` – Kanäle, UWG, Kennzahlen, Build in Public, One-Person-Unicorn, Scheitergründe (mit Quellen)
- `wissen/design.md` – Design-Regelwerk 2026 Do/Don't (mit Quellen)

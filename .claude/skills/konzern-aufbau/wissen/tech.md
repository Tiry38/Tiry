# Tech-Stack AVOX Voice (Stand 21.11.2026, USD netto, ≈ 0,87 €/$)

## Voice-Plattformen
| Plattform | Preis/Min | Claude | EU | Start |
|---|---|---|---|---|
| Retell AI (offiziell) | 0,055 Infra + 0,015 TTS + LLM + Tel. ab 0,015 → mit Haiku 5.5 ≈ 0,09 | ja (Haiku 5.5 0,0032/Min) | nicht ausgewiesen | 10 $ Guthaben, 20 parallel |
| ElevenLabs Agents | 0,08 + LLM + Tel. | ja (Sonnet-Modelle) | EU-Datenhaltung nur Enterprise | Free 15 Min |
| Vapi | ≈ 0,10–0,15 gesamt (Dritte) | ja | Region Frankfurt | – |
| Telnyx Voice AI | 0,05 inkl. STT/TTS + LLM + Tel. → ≈ 0,06 | ja | nicht genannt | PAYG |
| Twilio ConversationRelay | 0,07 + Voice-Min | ja (eigenes Backend) | – | – |
| LiveKit Agents | 0 $ bis 1.000 Min, dann ≈ 0,01 + Anbieter | ja | selbst hostbar | 1.000 Min |
| Pipecat (OSS) | nur Server + Anbieter | ja | selbst hostbar | gratis |
| Famulor (DE) | 0,16–0,18 €/Min | – | DE | – |
Latenz-Ziel < 800 ms Antwortbeginn.

## STT/TTS Deutsch
Deepgram Nova-3 Multilingual ≈ 0,0058 $/Min · ElevenLabs Flash v2.5 0,05 $/1.000 Zeichen (beste Stimme) ·
Cartesia Sonic ≈ 0,037 $/1.000 Zeichen. Faustregel ≈ 400 Zeichen TTS je Gesprächsminute → TTS ≈ 0,015–0,02 $/Min.

## Telefonie DE
Twilio Ortsnummer 1,35 $/Monat, eingehend 0,01 $/Min, SIP 0,004 $/Min (Adress- und Identitätsnachweis, Prüfung bis 3 Werktage+).
Telnyx ab 1 $/Monat. Praktisch: **Rufumleitung** von der Betriebsnummer auf die KI-Nummer.

## Claude API (offizielle Preisseite)
Haiku 5.5: 0,10 / 0,50 $ pro Mio. Token (Cache 0,01) → ≈ 0,001–0,003 $/Gesprächsminute.
Sonnet 5.5: 2 / 10 $. Opus 5.5: 4 / 20 $. EU-Verarbeitung über Bedrock/Vertex regional (+10 %).

## Restlicher Stack
Frontend Cloudflare Pages/Vercel Free · Hetzner ab ≈ 5,49 €/Monat (Neuanlagen zeitweise gesperrt) · Supabase Free/Pro 25 $ ·
Stripe Karten ≈ 1,5 % + 0,25 €, **SEPA 0,35 €** (Stripe = Mollie) · Resend Free 3.000 Mails/Monat · SMS ≈ 0,085 € (teuer!) ·
Google Calendar API gratis (Kontingent), Microsoft per OAuth.

## Kosten pro Kunde (300 Anrufe × 2,5 Min = 750 Min)
| | Eigenbau (Pipecat/LiveKit+Twilio+Deepgram+Cartesia+Haiku) | Retell + Haiku 5.5 | ElevenLabs + Sonnet 5.5 |
|---|---|---|---|
| Summe Sprache | ≈ 30 $ (~26 €) | ≈ 67 $ (~58 €) | ≈ 85–90 $ (~75 €) |
SMS zu jedem Anruf +25 € → nur optional/gegen Aufpreis.

## Empfehlung
Phase 1 (1–5 Kunden): Retell PAYG + Haiku 5.5, Cartesia/ElevenLabs-Stimme, Webhooks für Kalender, Next.js + Supabase +
Resend + Stripe SEPA. Fixkosten ≈ 0–10 €/Monat.
Phase 2 (ab 5–10 Kunden): Pipecat/LiveKit auf EU-Server, Claude via Bedrock/Vertex EU → ≈ 0,04 $/Min, DSGVO sauber.
Barge-in und Latenz testen.

## Quellen
platform.claude.com/docs/en/about-claude/pricing · retellai.com/pricing · elevenlabs.io/pricing/agents ·
elevenlabs.io/docs/overview/administration/data-residency · telnyx.com/pricing/voice-ai-agents ·
twilio.com/en-us/voice/pricing/de · twilio.com/en-us/guidelines/de/regulatory · docs.vapi.ai/security-and-privacy/eu-region ·
livekit.com/pricing · github.com/pipecat-ai/pipecat · famulor.io/de/ki-telefonassistent-kosten · deepgram.com/pricing ·
supabase.com/pricing · resend.com · developers.google.com/calendar/pricing · claude.com/regional-compliance ·
docs.hetzner.com (price adjustment)

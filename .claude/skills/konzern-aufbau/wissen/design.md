# Design-Regelwerk NABE 2026 (Stand 21.11.2026)

Leitsatz: **Ruhig, eigenständig, echt.** KI zeigt sich im Produkt, nicht im Slogan. Eigene Effekte und Bildsysteme,
weil KI-Baukästen alles gleich aussehen lassen. Ergänzt die Design-Regeln in `CLAUDE.md`
(dort „Verläufe überall“ → hier präzisiert: Verläufe 3+ Farben, animiert, aber als gezielter Akzent).

## DO
- Fast-schwarzer Grund (nicht #000) + heller Modus; Farb-Tokens in OKLCH; **eigene Primärfarbe** (z. B. Kupfer, Petrol,
  Signal-Orange) statt Indigo.
- Mesh-Verläufe/Orbs mit geringer Deckkraft, lenken auf **einen** Punkt (Hero, CTA, Orb).
- Glas funktional: Sticky Header (`backdrop-filter`), Overlays, Player.
- Organische Markenform: Nabe/Ringe/Speichen-Motiv, Kreise, Pillen, Wellen, große Radien; strenges Raster nur für Produkt-UI.
  Bento nur mit Rangfolge (eine dominante Kachel).
- Echte Produkt-UI als Ausstellungsstück (Anruf-Protokoll, Kalender, Dashboard), echte Hörproben, konkrete Zahlen.
- Typo-Trio: Grotesk (UI) + ausdrucksstarke variable Serif (Headlines, Wärme) + Mono (Zahlen).
- Motion: wenige bedeutungsvolle Mikro-Interaktionen; native Scroll-driven Animations (Baseline seit Firefox 159, 10/2026)
  und View Transitions; immer `prefers-reduced-motion`.
- Voice-Orb mit Zuständen idle/connecting/listening/thinking/speaking/error, reagiert auf echtes Audio, eigene Form/Farbe.
- Logo: Wortmarke „NABE“ mit eigenem Detail (A/B als Nabe) + kompaktes Symbol (App-Icon/Favicon), animierbar wie der Orb.

## DON'T (gilt 2026 als alt/AI-Slop)
- Lila-blaue Verläufe, Tailwind-Standard-Indigo (Gigazine 04/2026: 10,7 % aller Seiten mit lila CTA).
- Inter + zentrierter Hero + drei gleiche Feature-Karten; Stock- und 3D-Klumpen-Illustrationen; Emoji als Icons;
  „revolutionär“, „Powered by AI“.
- Vollflächige satte Verläufe, Text auf Glas, gefrostete Karten als Standard.
- ElevenLabs-Orb 1:1 übernehmen.

## Landingpage (B2B-SaaS)
1. Hero: Schmerz-Headline („Kein Anruf geht mehr verloren“), Lösungs-Subline, 1 CTA, **Hörprobe am Orb**, Proof direkt darunter.
2. Proof verteilt (Logos am Hero, „Server in der EU“ am Formular, Stimmen an Entscheidungspunkten), wenige und konkret.
3. Features als Ergebnisse. 4. Live-Demo (Nummer anrufen/Simulator). 5. Kundenstimmen.
6. **Preise offen.** 7. FAQ (Datenschutz, Einrichtung, Kündigung). 8. Abschluss-CTA.
Mobile-first (Benchmark: 83 % Handy-Besuche). Richtwerte Conversion: Median ≈ 3,8 %, Top-Demo-Seiten 8–15 %.

## Barrierefreiheit
WCAG 2.2 AA: 2.5.8 Ziele ≥ 24 px (wir: 44 px), 2.4.11 Fokus nicht verdeckt (Sticky Header!), Drag-Alternativen,
keine Rätsel-Logins, Kontrast ≥ 4,5:1. BFSG siehe `recht.md`.

## Werkzeuge & Lizenzen
Tailwind v4 (`@theme`, OKLCH) · shadcn/ui (v4, `tw-animate-css`; **Standardfarben ersetzen**) · Motion (MIT, `motion/react`) ·
GSAP 100 % kostenlos inkl. SplitText/MorphSVG (Ausnahme: Webflow-konkurrierende No-Code-Tools) · Rive (Runtime frei,
Free-Exporte mit Splash; Web-Runtime schwer) · Lottie (MIT, leicht) · Spline sparsam.
Schriften: Inter & Geist = SIL OFL 1.1; Satoshi/General Sans = ITF-EULA (Re-Hosting prüfen, fontshare.com/terms).
Erzeugte Einzel-HTML-Apps (App Forge): keine externen Ressourcen – Schriften dort als System-Stack oder eingebettet.

## Prüfroutine
Playwright-Screenshots Handy 390 px + Desktop 1440 px, hell + dunkel; gegen DO/DON'T prüfen; Kontrast messen;
erst dann Tiry zeigen.

## Quellen
webflow.com/blog/web-design-trends-2026 · saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples ·
lazarev.agency/articles/saas-trends-2026 · linear.app/changelog/2026-03-12-ui-refresh · linear.app/blog/linear-liquid-glass ·
indiehackers.com (AI purple problem) · gigazine.net/gsc_news/en/20260423-design-slop · builtin.com/articles/ai-design-slop-era ·
creativebloq.com (Typografie-/Logo-Trends 2026) · vercel.com/font · github.com/vercel/geist-font ·
elevenlabs.io/blog/elevenlabs-ui · ui.elevenlabs.io/docs/components · krishaweb.com/blog/saas-homepage-conversion-best-practices/ ·
instapage.com/blog/b2b-landing-page-best-practices · w3.org/WAI/standards-guidelines/wcag/new-in-22/ ·
web.dev/blog/web-platform-10-2026 · ui.shadcn.com/docs/tailwind-v4 · github.com/motiondivision/motion ·
webflow.com/blog/gsap-becomes-free · gsap.com/community/standard-license/ · rive.app/blog/rive-as-a-lottie-alternative

'use strict';
/**
 * Prompts für Claude. Das Design-System und die Qualitätsregeln stehen in einem
 * stabilen System-Prompt (prompt-caching-freundlich); variable Inhalte kommen in
 * die User-Nachricht.
 */

const DESIGN_RULES = `
# Design-Standard (Pflicht – "bombenmäßig", niemals altbacken)
- Wirkung wie eine Premium-App 2026 (Apple Design Award / Dribbble-Top-Niveau). Verboten: Windows-98-/Baukasten-Look, Standard-Browser-Buttons und -Inputs, harte graue 1px-Kästen, flache graue Flächen, Serifen-Standardschrift, gequetschte Abstände, fehlende Hierarchie, statische Oberfläche ohne Bewegung.
- KEINE Baukasten-Formen: keine Kasten-in-Kasten-Stapel, keine gleichförmigen Kachelraster, keine eckigen Standard-Boxen. Stattdessen organische, fließende Komposition: animierte Blobs (morphende border-radius-Formen), Wellen-Trenner, Kreise, Bubbles, Pillenformen, schwebende Elemente mit Glow, asymmetrische Hero-Bereiche, Tiefe durch Ebenen.
- Coole, lebendige Farbverläufe überall: mehrstufige Verläufe (3+ Farben), sanft animierte Verlaufs-Verschiebung (background-position) auf Überschriften und Primär-Buttons, conic-/radial-gradient-Blobs, Verlaufs-Haarlinien-Ränder (mask-composite), Verläufe in Fortschrittsringen, Balken und Icons.
- Hintergrund: mehrschichtige Verläufe (radiale "Aurora"-Glows + linearer Verlauf) aus der vorgegebenen Palette. Karten: Glassmorphism (backdrop-filter: blur, halbtransparente Fläche, feiner heller Rand), weiche Schatten, Radius 18–28px.
- Primär-Buttons: Verlauf aus den Akzentfarben, Glow-Schatten, Druck-Animation (scale .97). Sekundär: Glas-Stil.
- Typografie: System-Schriften ("Segoe UI Variable", "SF Pro Display", Inter, system-ui, Roboto, sans-serif), klare Skala (z. B. 32/22/17/15/13px), Zahlen mit font-variant-numeric: tabular-nums, großzügige Zeilenhöhe.
- Bewegung: Mikro-Animationen 150–350ms (transform/opacity), sanftes Einblenden von Listenelementen, animierte Fortschrittsringe/-balken; @media (prefers-reduced-motion: reduce) schaltet Animationen ab.
- Layout: mobile-first 360–430px, max-width 480px zentriert, 8px-Raster, safe-area-insets (env()), Tipp-Flächen >= 44px, kein horizontales Scrollen, Bottom-Navigation oder ein klar fokussierter Hauptscreen.
- Scrollbalken ausblenden wie in nativen Apps (scrollbar-width:none; ::-webkit-scrollbar{display:none}), Scrollen bleibt möglich.
- Icons: inline SVG mit einheitlicher Strichstärke. Leere Zustände mit kleiner Illustration und klarer Handlungsaufforderung.
- Kontrast: Text >= 4.5:1. Farben ausschließlich über CSS-Variablen aus der Palette.
`;

const TECH_RULES = `
# Technische Regeln (Pflicht)
- Genau EINE Datei: vollständiges HTML-Dokument mit inline CSS und inline JavaScript. Beginnt mit <!DOCTYPE html>, <html lang="{LANG}">, <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">, sinnvollem <title>.
- Im <head> zusätzlich exakt: <link rel="manifest" href="./manifest.webmanifest"><link rel="icon" href="./icon.svg" type="image/svg+xml">
- Am Ende des Scripts: if ('serviceWorker' in navigator && location.protocol.startsWith('http')) { navigator.serviceWorker.register('./sw.js').catch(function(){}); }
- KEINE externen Ressourcen: keine CDNs, keine Google Fonts, keine externen Bilder, kein fetch ins Internet. Alles funktioniert offline. Keine Tracker, keine Datensammlung.
- Speicherung über localStorage mit Schlüssel-Präfix "{APPID}:", immer in try/catch, mit Standardwerten und Versionsfeld für spätere Migration.
- Kein alert/confirm/prompt – eigene Dialoge/Sheets/Toasts. Kein eval/new Function. Keine Wörter TODO, FIXME, Lorem ipsum, Platzhalter.
- Jedes sichtbare Bedienelement funktioniert. Eingaben werden validiert (leer, negativ, riesig, Text statt Zahl) – nie abstürzen.
- Spiele: <canvas> mit devicePixelRatio-Skalierung, requestAnimationFrame mit Delta-Zeit, Pause bei visibilitychange, Pointer-Events (Touch + Maus), Startbildschirm mit 1-Satz-Anleitung, steigende Schwierigkeit, Game-Over mit Neustart, Highscore gespeichert.
- Barrierefreiheit: semantisches HTML, aria-labels für Icon-Buttons, sichtbarer Fokus.
- Performance: keine Endlosschleifen ohne rAF, keine Speicherlecks durch wiederholte Event-Listener.
- Originalität: keine Kopie bestehender Apps/Spiele, keine Markennamen, keine geschützten Figuren.
- Alle Texte für Nutzer in der Sprache "{LANG}", natürlich und hilfreich, mit echten Inhalten (keine Füllsätze).
`;

function builderSystem({ lang = 'de', appId = 'app', lessons = [] }) {
  const rules = TECH_RULES.replace(/\{LANG\}/g, lang).replace(/\{APPID\}/g, appId);
  const learned = lessons.length
    ? `\n# Gelernte Regeln aus früheren Builds (unbedingt befolgen)\n${lessons.map((l) => `- ${l}`).join('\n')}\n`
    : '';
  return `Du bist ein Weltklasse-Team aus Produktdesigner, UX-Experte und Senior-Frontend-Entwickler. Du baust verkaufsfähige, sinnvolle Handy-Apps als einzelne HTML-Datei (PWA), die später per Capacitor in Google Play und den App Store kommen.
${DESIGN_RULES}
${rules}${learned}
# Ausgabe
Antworte ausschließlich mit dem vollständigen HTML-Dokument, beginnend mit <!DOCTYPE html> und endend mit </html>. Keine Erklärungen davor oder danach.`;
}

const CONCEPT_SYSTEM = `Du bist Produktstratege für Mobile Apps mit Gespür für Märkte, die Geld verdienen. Du entwickelst ORIGINELLE App-Konzepte, die echten Nutzen oder echten Spielspaß bieten, sofort verständlich sind und in eine einzige HTML-Datei passen (keine Server, keine Accounts, keine Internetpflicht).
Regeln:
- Zufällige Startimpulse sind Inspiration, kein Zwang – das Ergebnis MUSS Sinn ergeben. Unsinnige Kombinationen biegst du zu einer schlüssigen Idee um.
- Nutze Marktsignale (Trends), um eine gefragte Nische zu treffen, aber kopiere keine bestehende App, keinen Namen und keine Marke.
- Keine Apps für Kinder unter 13, keine Glücksspiel-, Medizin-Diagnose-, Finanzberatungs- oder Dating-Apps (Store-Richtlinien-Risiko).
- Name: kurz, einprägsam, markenrechtlich unverdächtig (keine bekannten Markennamen), max. 20 Zeichen.
- Sense-Check ehrlich bewerten (1–10). Unter 7 in einem Punkt = Konzept ist nicht gut genug.
- Store-Texte verkaufsstark, ehrlich, ohne falsche Versprechen.`;

function conceptPrompt({ seed, trendHint, existing, lang, feedback }) {
  return `Startimpulse:
- Typ: ${seed.type === 'game' ? 'Spiel' : 'Nützliche App'}
- Bereich: ${seed.category}
- Zielgruppe: ${seed.audience}
- Besonderheit: ${seed.twist}
- Stimmung: ${seed.mood}
${trendHint ? `\nMarktsignal (aktuelle Trends):\n${trendHint}\n` : ''}
Bereits vorhandene Apps (nicht wiederholen): ${existing.length ? existing.join(', ') : 'keine'}
Sprache der App: ${lang}
${feedback ? `\nDein letzter Entwurf war nicht gut genug: ${feedback}\nEntwickle ein BESSERES Konzept.` : ''}
Liefere das Konzept als JSON gemäß Schema. design.background = 3 Hex-Farben für den Hintergrund-Verlauf, design.accent = 2 Hex-Akzentfarben (gut lesbar), design.mode = "dark" oder "light".`;
}

const CONCEPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'tagline', 'type', 'category', 'target_audience', 'problem_or_fun', 'core_loop', 'features', 'screens', 'retention_hook', 'monetization', 'design_direction', 'icon_glyph', 'store_short_description', 'store_full_description', 'keywords', 'design', 'sense_check'],
  properties: {
    name: { type: 'string' },
    tagline: { type: 'string' },
    type: { type: 'string', enum: ['game', 'tool'] },
    category: { type: 'string' },
    target_audience: { type: 'string' },
    problem_or_fun: { type: 'string' },
    core_loop: { type: 'string' },
    features: { type: 'array', items: { type: 'string' } },
    screens: { type: 'array', items: { type: 'string' } },
    retention_hook: { type: 'string' },
    monetization: { type: 'string' },
    design_direction: { type: 'string' },
    icon_glyph: { type: 'string' },
    store_short_description: { type: 'string' },
    store_full_description: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } },
    design: {
      type: 'object',
      additionalProperties: false,
      required: ['mode', 'background', 'accent'],
      properties: {
        mode: { type: 'string', enum: ['dark', 'light'] },
        background: { type: 'array', items: { type: 'string' } },
        accent: { type: 'array', items: { type: 'string' } }
      }
    },
    sense_check: {
      type: 'object',
      additionalProperties: false,
      required: ['usefulness', 'clarity', 'originality', 'feasibility', 'market_fit', 'verdict'],
      properties: {
        usefulness: { type: 'integer' },
        clarity: { type: 'integer' },
        originality: { type: 'integer' },
        feasibility: { type: 'integer' },
        market_fit: { type: 'integer' },
        verdict: { type: 'string' }
      }
    }
  }
};

function buildPrompt({ concept, palette, style, lang }) {
  return `Baue diese App vollständig und in Top-Qualität:

${JSON.stringify(concept, null, 2)}

Farbpalette (als CSS-Variablen verwenden):
- Modus: ${palette.mode}
- Hintergrund-Verlauf: ${palette.bg.join(', ')}
- Akzent-Verlauf: ${palette.accent.join(', ')}  · Glow: ${palette.glow}
- Text: ${palette.text} · gedämpft: ${palette.muted} · Text auf Akzent: ${palette.onAccent}
Stil-Richtung: ${style.name} (Radius ~${style.radius}px, Blur ~${style.blur}px)
Sprache: ${lang}

Alle Features aus dem Konzept müssen funktionieren. Liefere nur das HTML-Dokument.`;
}

function fixPrompt({ html, errors, warnings }) {
  return `Die App hat beim automatischen Test Probleme. Behebe ALLE Fehler (und möglichst die Warnungen), ohne Funktionen zu entfernen oder das Design zu verschlechtern.

Fehler:
${errors.map((e) => `- ${e}`).join('\n') || '- keine'}

Warnungen:
${warnings.map((w) => `- ${w}`).join('\n') || '- keine'}

Aktueller Code:
${html}

Liefere das vollständige, korrigierte HTML-Dokument.`;
}

const REVIEW_SYSTEM = `Du bist ein extrem strenger Design-Juror (Apple Design Award) und UX-Tester. Du bewertest einen Screenshot einer Handy-App plus ihren Code. Du bist ehrlich und kritisch: 9–10 nur für echte Spitzenklasse, 7–8 für gut, darunter für Mittelmaß. Altbackener, blockartiger oder Standard-Browser-Look ergibt maximal 4 Punkte im Design. Baukasten-Optik (gestapelte Kästen, starre Kachelraster, eckige Boxen) ergibt maximal 5 Punkte. Fehlende oder langweilige Farbverläufe ergeben maximal 6 Punkte.`;

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['design', 'ux', 'sense', 'polish', 'bugs', 'improvements', 'summary'],
  properties: {
    design: { type: 'integer' },
    ux: { type: 'integer' },
    sense: { type: 'integer' },
    polish: { type: 'integer' },
    bugs: { type: 'array', items: { type: 'string' } },
    improvements: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' }
  }
};

function reviewPrompt({ concept, html, test }) {
  return `App-Konzept: ${concept.name} – ${concept.tagline}
Kernidee: ${concept.core_loop}

Automatischer Testbericht: ${test.errors.length} Fehler, ${test.warnings.length} Warnungen.
${test.warnings.map((w) => `- ${w}`).join('\n')}

Bewerte (1–10): design (visuelle Qualität, modern, Verläufe, Hierarchie), ux (Bedienbarkeit, Klarheit), sense (ergibt die App Sinn, würde man sie nutzen/bezahlen), polish (Details, Animationen, leere Zustände, Texte).
Nenne konkrete Bugs und die wichtigsten 3–6 Verbesserungen (präzise umsetzbar).

Code:
${html}`;
}

function polishPrompt({ html, review }) {
  return `Ein strenger Design-Juror hat die App bewertet (Design ${review.design}/10, UX ${review.ux}/10, Sinn ${review.sense}/10, Feinschliff ${review.polish}/10).
Urteil: ${review.summary}

Bugs:
${review.bugs.map((b) => `- ${b}`).join('\n') || '- keine'}

Verbesserungen, die du jetzt umsetzt:
${review.improvements.map((b) => `- ${b}`).join('\n')}

Hebe die App auf Spitzenniveau, ohne bestehende Funktionen zu entfernen. Aktueller Code:
${html}

Liefere das vollständige HTML-Dokument.`;
}

const EVOLVE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'title', 'description', 'acceptance'],
  properties: {
    kind: { type: 'string', enum: ['bugfix', 'design', 'ux', 'feature', 'performance', 'content'] },
    title: { type: 'string' },
    description: { type: 'string' },
    acceptance: { type: 'array', items: { type: 'string' } }
  }
};

function evolvePlanPrompt({ meta, test, history }) {
  const last = meta.versions[meta.versions.length - 1] || {};
  return `Du entwickelst die App "${meta.name}" dauerhaft weiter. Wähle die EINE wertvollste nächste Verbesserung.
Priorität: 1) echte Fehler beheben 2) Design/UX auf Spitzenniveau 3) ein neues, passendes Feature, das Nutzer lieben und das zur Kernidee passt (keine Überladung) 4) Performance/Inhalte.

Konzept: ${JSON.stringify(meta.concept)}
Letzte Bewertung: ${last.review ? JSON.stringify(last.review) : 'keine'}
Aktueller Test: ${test.errors.length} Fehler, ${test.warnings.length} Warnungen
${[...test.errors, ...test.warnings].map((x) => `- ${x}`).join('\n')}
Bisherige Änderungen (nicht wiederholen): ${history.join(' | ') || 'keine'}
Zuletzt verworfene Versuche: ${(meta.rejected || []).slice(0, 5).map((r) => `${r.title} (${r.reason})`).join(' | ') || 'keine'}

Antworte als JSON gemäß Schema (kind, title, description, acceptance = prüfbare Kriterien).`;
}

function evolveBuildPrompt({ html, plan }) {
  return `Setze diese Verbesserung um:
Art: ${plan.kind}
Titel: ${plan.title}
Beschreibung: ${plan.description}
Abnahmekriterien:
${plan.acceptance.map((a) => `- ${a}`).join('\n')}

Wichtig: Alle bisherigen Funktionen und gespeicherten Daten (localStorage-Schlüssel) bleiben erhalten; falls sich das Datenformat ändert, migriere alte Daten.

Aktueller Code:
${html}

Liefere das vollständige HTML-Dokument.`;
}

const LESSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['lessons'],
  properties: { lessons: { type: 'array', items: { type: 'string' } } }
};

function lessonPrompt({ errors }) {
  return `Beim automatischen Test einer generierten App traten diese Fehler auf und wurden behoben:
${errors.map((e) => `- ${e}`).join('\n')}

Formuliere 1–2 ALLGEMEINE, kurze Regeln (je max. 200 Zeichen) für künftige Builds, die genau diese Fehlerklasse verhindern. Keine app-spezifischen Details. JSON gemäß Schema.`;
}

module.exports = {
  DESIGN_RULES,
  builderSystem,
  CONCEPT_SYSTEM,
  CONCEPT_SCHEMA,
  conceptPrompt,
  buildPrompt,
  fixPrompt,
  REVIEW_SYSTEM,
  REVIEW_SCHEMA,
  reviewPrompt,
  polishPrompt,
  EVOLVE_SCHEMA,
  evolvePlanPrompt,
  evolveBuildPrompt,
  LESSON_SCHEMA,
  lessonPrompt
};

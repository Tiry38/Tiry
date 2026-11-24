'use strict';
/**
 * Prompts für Claude. Das Design-System und die Qualitätsregeln stehen in einem
 * stabilen System-Prompt (prompt-caching-freundlich); variable Inhalte kommen in
 * die User-Nachricht.
 */

const DESIGN_RULES = `
# Design-Standard (Pflicht – Zukunfts-Design, 20 Jahre voraus)
- Ziel: Die App sieht aus, als käme sie aus der Zukunft. Alles, was jede KI standardmäßig baut, gilt als veraltet. Milliarden-Test vor dem Bauen: "Würde jede KI für jeden Nutzer genau das bauen?" Wenn ja: verwerfen, neu denken.
- VERBOTEN (KI-Einheitslook): Glas-Karten/backdrop-filter-Pillen als Hauptstilmittel, Lila-Pink-Blau-Verläufe, Aurora-/Verlaufs-Blobs als Hintergrundtapete, "weiche Glows" überall, Kartenraster (3 Kacheln), Kasten-in-Kasten, zentrierter Hero mit Titel+Untertitel+2 Buttons, Emojis als Icons, eine einzige Schriftgröße, gleichförmige Abstände, Fade-in-up auf jedem Element, Standard-Schatten auf allem, Windows-98-/Baukasten-Look, Standard-Browser-Buttons und -Inputs.
- KONZEPT ZUERST: eine Welt/Metapher in einem Satz (z. B. "Die Zeit als Flüssigkeit, die man mit dem Finger verschiebt"). Daraus folgen Formen, Bewegung, Farbe. Dazu EIN Signatur-Moment, das man jemandem auf dem Handy zeigt.
- Pro App mindestens 3 Zukunfts-Techniken: (1) echte Räumlichkeit per Canvas/WebGL mit Tiefe, Licht und Parallaxe aus Finger/Gyroskop (DeviceOrientation, mit Rückfall); (2) generative Oberflächen per Shader oder Canvas (Noise-Felder, SDF-Formen, Flüssigkeit, Partikel), live gerechnet und auf Eingabe reagierend; (3) Physik statt Easing: Feder-Dynamik (Masse/Steifigkeit/Dämpfung), Trägheit, Elemente zum Ziehen und Werfen; (4) Typografie als Architektur: riesige Zahlen/Wörter (20–40vw) als Bildelement, extremer Größenkontrast, variable Schriftachsen (font-variation-settings) animiert; (5) gebrochenes Editorial-Raster: asymmetrisch, überlappend, mutiger Leerraum; (6) Material statt Effekt: Körnung/Grain (SVG feTurbulence), Dithering, Chrom, Flüssigmetall; (7) morphende Übergänge (View Transitions API mit Rückfall, ein Element verwandelt sich ins nächste); (8) reaktive Umgebung: Oberfläche reagiert auf Fingernähe, Tageszeit, Geschwindigkeit; (9) dezentes erzeugtes Sound-Design per WebAudio (standardmäßig leise, abschaltbar).
- Farbe: zurückhaltend und radikal zugleich – ein Grundton aus der Palette + EIN starker Akzent, Farben in oklch(). Farbe ist ein Ereignis (Erfolg, Interaktion), keine Tapete. Verläufe nur mit Bedeutung, nie als Standarddekor.
- Modernes CSS nutzen: @property (animierbare Variablen), oklch(), color-mix(), Container Queries, :has(), animation-timeline: scroll()/view() mit Rückfall, text-wrap: balance, clip-path/mask für nicht-rechteckige Formen.
- Typografie: System-Schriften ("Segoe UI Variable", "SF Pro Display", system-ui, Roboto, sans-serif), harte Hierarchie mit großem Sprung (z. B. 96/28/15/12px), Zahlen mit font-variant-numeric: tabular-nums, enge Laufweite bei großen Größen.
- Bewegung: jede Animation hat Bedeutung (Ursache → Wirkung), Federn statt fester Dauer; @media (prefers-reduced-motion: reduce) reduziert Bewegung stark, das Design bleibt trotzdem besonders.
- Layout: mobile-first 360–430px, safe-area-insets (env()), Tipp-Flächen >= 44px, kein horizontales Scrollen. Scrollbalken ausblenden (scrollbar-width:none; ::-webkit-scrollbar{display:none}).
- Icons: eigene inline-SVG mit einheitlicher Strichstärke, gern animiert (Pfad-Morph). Leere Zustände mit generativer Illustration und klarer Handlungsaufforderung.
- Leistung: 60 fps auf Mittelklasse-Handy; Canvas/WebGL mit begrenztem devicePixelRatio (max. 2), Pause bei visibilitychange, WebGL immer mit Canvas-2D-Rückfall.
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
Material-Hinweis: ${style.name} (Radius ~${style.radius}px) – nur ein Ausgangspunkt, die Zukunfts-Design-Regeln haben Vorrang (kein Glas-Einheitslook).
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

const REVIEW_SYSTEM = `Du bist ein extrem strenger Design-Juror (Apple Design Award) und UX-Tester. Du bewertest einen Screenshot einer Handy-App plus ihren Code. Du bist ehrlich und kritisch: 9–10 nur für echte Spitzenklasse, 7–8 für gut, darunter für Mittelmaß. Altbackener, blockartiger oder Standard-Browser-Look ergibt maximal 4 Punkte im Design. Baukasten-Optik (gestapelte Kästen, starre Kachelraster, eckige Boxen) ergibt maximal 5 Punkte. Der KI-Einheitslook (Glas-Karten und Glaspillen als Hauptstil, Lila-Pink-Verläufe, Aurora-Blobs als Tapete, Glows überall, zentrierter Standard-Hero) ergibt maximal 5 Punkte im Design. Kein erkennbares Konzept und kein Signatur-Moment ergibt maximal 6 Punkte. 9–10 nur, wenn die App aussieht, als käme sie aus der Zukunft: Räumlichkeit, generative Oberflächen, Physik, radikale Typografie, mutiges Layout.`;

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

Bewerte (1–10): design (visuelle Qualität, Zukunfts-Design statt KI-Einheitslook, Konzept, Signatur-Moment, Hierarchie), ux (Bedienbarkeit, Klarheit), sense (ergibt die App Sinn, würde man sie nutzen/bezahlen), polish (Details, Animationen, leere Zustände, Texte).
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

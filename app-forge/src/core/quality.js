'use strict';
/**
 * Qualitätsprüfung: statische Code-Analyse + Auswertung des Laufzeit-Tests.
 * Ergebnis: Fehler (blockieren eine Version), Warnungen (kosten Punkte), Score 0–100.
 */

function staticChecks(html) {
  const errors = [];
  const warnings = [];
  const h = String(html || '');
  if (!/^\s*<!doctype html>/i.test(h)) errors.push('Kein <!DOCTYPE html> am Anfang.');
  if (!/<meta[^>]+name=["']viewport["']/i.test(h)) errors.push('Viewport-Meta-Tag fehlt (Handy-Darstellung).');
  if (!/<title>[^<]{2,}<\/title>/i.test(h)) warnings.push('Kein aussagekräftiger <title>.');
  if (!/<html[^>]+lang=/i.test(h)) warnings.push('lang-Attribut am <html> fehlt.');
  const external = h.match(/<(script|link|img|iframe|audio|video|source)[^>]+(src|href)=["']https?:\/\/[^"']+/gi) || [];
  if (external.length) errors.push(`Externe Ressourcen geladen (${external.length}x) – Apps müssen offline und datenschutzfreundlich sein.`);
  if (/@import\s+url\(["']?https?:/i.test(h) || /fonts\.googleapis\.com/i.test(h)) errors.push('Externe Schriften/CSS (z. B. Google Fonts) – DSGVO-Risiko, bitte System-Schriften nutzen.');
  if (/\bfetch\(\s*["']https?:|XMLHttpRequest/i.test(h)) warnings.push('Netzwerkzugriffe im Code – App sollte ohne Internet funktionieren.');
  if (/\b(alert|confirm|prompt)\s*\(/.test(h)) warnings.push('alert/confirm/prompt verwendet – wirkt unmodern, eigene Dialoge nutzen.');
  if (/\beval\s*\(|new Function\s*\(/.test(h)) warnings.push('eval/new Function verwendet – unsicher.');
  if (/lorem ipsum|\bTODO\b|\bFIXME\b|platzhalter/i.test(h)) warnings.push('Platzhalter/TODO im Code – App wirkt unfertig.');
  if (!/gradient\(/i.test(h)) warnings.push('Keine Farbverläufe im Design.');
  if (!/prefers-reduced-motion/i.test(h)) warnings.push('prefers-reduced-motion wird nicht beachtet (Barrierefreiheit).');
  if (!/localStorage/.test(h)) warnings.push('Keine Speicherung (localStorage) – Fortschritt geht verloren.');
  if (h.length > 450000) warnings.push(`Datei sehr groß (${Math.round(h.length / 1024)} KB).`);
  if (h.length < 2500) errors.push('App ist zu klein, um sinnvoll zu sein.');
  return { errors, warnings };
}

function runtimeChecks(run) {
  const errors = [];
  const warnings = [];
  if (!run) return { errors: ['Kein Laufzeittest möglich.'], warnings };
  for (const e of run.consoleErrors || []) errors.push(`Konsole: ${e}`);
  for (const e of run.pageErrors || []) errors.push(`Laufzeitfehler: ${e}`);
  if (run.crashed) errors.push('App ist abgestürzt (Renderer).');
  if (run.loadFailed) errors.push(`Laden fehlgeschlagen: ${run.loadFailed}`);
  const m = run.monkey;
  if (!m) {
    if (!run.loadFailed) errors.push('Interaktionstest konnte nicht laufen (App hängt oder lädt neu).');
    return { errors, warnings };
  }
  for (const e of m.caught || []) errors.push(`Fehler bei Interaktion: ${e}`);
  if (m.interactive === 0 && m.canvas === 0) errors.push('Keine bedienbaren Elemente gefunden.');
  if (m.textLength < 15 && m.canvas === 0) errors.push('Startbildschirm ist praktisch leer.');
  if (m.blankAfter) errors.push('Nach Interaktionen ist der Bildschirm leer (Absturz der Oberfläche).');
  if (m.overflowX) warnings.push('Inhalt ist breiter als der Handy-Bildschirm (horizontales Scrollen).');
  if (m.tinyTapTargets > 2) warnings.push(`${m.tinyTapTargets} Tipp-Flächen kleiner als 30px.`);
  if (m.offscreenInteractive > 0) warnings.push(`${m.offscreenInteractive} Bedienelemente ragen aus dem Bildschirm.`);
  if (m.fontSizeMin < 11) warnings.push(`Sehr kleine Schrift (${m.fontSizeMin}px).`);
  if (!m.usesGradient) warnings.push('Zur Laufzeit keine Farbverläufe sichtbar.');
  return { errors, warnings };
}

function dedupe(list) {
  return [...new Set(list.map((s) => String(s).slice(0, 400)))];
}

/** Kombiniert statische + Laufzeitprüfung zu einem Bericht mit Technik-Score. */
function evaluate(html, run) {
  const s = staticChecks(html);
  const r = runtimeChecks(run);
  const errors = dedupe([...s.errors, ...r.errors]);
  const warnings = dedupe([...s.warnings, ...r.warnings]);
  const tech = Math.max(0, Math.min(100, 100 - errors.length * 22 - warnings.length * 4));
  return { ok: errors.length === 0, errors, warnings, tech, metrics: run && run.monkey ? run.monkey : null, durationMs: run ? run.durationMs : null };
}

/** Gesamtscore: Technik + (falls vorhanden) KI-Design-Review. */
function totalScore(tech, review) {
  if (!review) return Math.round(tech);
  const r = (Number(review.design) + Number(review.ux) + Number(review.sense) + Number(review.polish)) / 4;
  return Math.round(0.4 * tech + 0.6 * Math.max(0, Math.min(10, r)) * 10);
}

module.exports = { staticChecks, runtimeChecks, evaluate, totalScore };

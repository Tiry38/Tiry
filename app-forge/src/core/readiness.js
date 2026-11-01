'use strict';
/**
 * Verkaufsbereitschaft – prüft, ob eine App reif für Google Play / App Store ist.
 * Automatisch prüfbare Punkte + klar markierte manuelle Punkte (Markenrecht, Impressum).
 */
const fs = require('fs');
const path = require('path');

function readiness(meta, versionDir) {
  const v = (meta.versions || []).find((x) => x.n === meta.currentVersion) || {};
  const c = meta.concept || {};
  const has = (f) => {
    try {
      return fs.existsSync(path.join(versionDir, f));
    } catch {
      return false;
    }
  };
  const review = v.review;
  const checks = [
    { id: 'tested', label: 'Fehlerfrei getestet', ok: !!(meta.lastTest && meta.lastTest.ok), hint: 'Test ausführen bzw. Fehler per „Jetzt verbessern“ beheben.' },
    { id: 'score', label: 'Gesamtscore ≥ 75', ok: (meta.score ?? 0) >= 75, hint: `Aktuell ${meta.score ?? 0}. Autopilot weiterlaufen lassen.` },
    { id: 'design', label: 'Design-Note ≥ 8', ok: review ? review.design >= 8 : meta.source === 'offline', hint: review ? `Aktuell ${review.design}/10.` : 'Mit KI-Review bewerten lassen.' },
    { id: 'texts', label: 'Store-Texte vollständig', ok: !!(c.store_short_description && (c.store_full_description || '').length >= 300 && (c.keywords || []).length >= 5), hint: 'Konzept-Texte ergänzen.' },
    { id: 'icons', label: 'Icons 192/512 px', ok: has('icon-192.png') && has('icon-512.png'), hint: 'Neuen Test ausführen – Icons werden dabei erzeugt.' },
    { id: 'screenshot', label: 'Screenshot vorhanden', ok: has('screenshot.png'), hint: 'Test ausführen.' },
    { id: 'offline', label: 'Offline & ohne Tracking', ok: !!(meta.lastTest && !(meta.lastTest.errors || []).some((e) => /Externe/.test(e))), hint: 'Externe Ressourcen entfernen.' },
    { id: 'privacy', label: 'Datenschutzerklärung (im Export)', ok: true, hint: 'Vorlage im Export – mit deinen Daten ausfüllen.' },
    { id: 'trademark', label: 'Name markenrechtlich prüfen (manuell)', ok: false, manual: true, hint: 'Name bei DPMA (register.dpma.de) und EUIPO (euipo.europa.eu) suchen.' }
  ];
  const auto = checks.filter((x) => !x.manual);
  const score = Math.round((auto.filter((x) => x.ok).length / auto.length) * 100);
  return { ready: auto.every((x) => x.ok), score, checks, at: Date.now() };
}

module.exports = { readiness };

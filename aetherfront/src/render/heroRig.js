// Helden-Rig-Anbieter: nutzt das große Modell-Modul (render/heroModels.js), fällt bei Fehlern
// auf das Ersatz-Rig (render/heroFallback.js) mit identischer Schnittstelle zurück.
import * as Fallback from './heroFallback.js';
import * as Real from './heroModels.js';

export function buildHeroRig(modelId, opts) {
  if (Real && Real.buildHero) {
    try { const rig = Real.buildHero(modelId, opts); if (rig && rig.root) { rig.source = 'models'; return rig; } } catch (err) { console.warn('Heldenmodell fehlgeschlagen, Ersatz-Rig:', err); }
  }
  const rig = Fallback.buildHero(modelId, opts);
  rig.source = 'fallback';
  return rig;
}

export function createAnimator(rig) {
  if (rig.source === 'models' && Real && Real.HeroAnimator) return new Real.HeroAnimator(rig);
  return new Fallback.HeroAnimator(rig);
}

export const RIG_SOURCE = Real ? 'models' : 'fallback';

// Automatische Grafikstufe: Erkennung beim ersten Start (GPU-Name, Fähigkeiten) + kurzer Lauf-Benchmark,
// solange der Spieler die Stufe nie selbst gewählt hat (Einstellung qualityAuto).
export const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];

/** Liest den GPU-Namen (WEBGL_debug_renderer_info, falls erlaubt). */
export function gpuName(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
  } catch { return ''; }
}

/** Schätzt die passende Stufe. Liefert { quality, gpu, reason }. */
export function detectQuality(renderer) {
  const gpu = gpuName(renderer);
  const g = gpu.toLowerCase();
  const caps = renderer.capabilities || {};
  const maxTex = caps.maxTextureSize || 4096;
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  const mem = (typeof navigator !== 'undefined' && navigator.deviceMemory) || 8;
  const pick = (quality, reason) => ({ quality, gpu, reason });
  if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(g)) return pick('low', 'Software-Rendering (kein Grafiktreiber)');
  if (maxTex < 8192 || mem <= 2) return pick('low', 'schwache Grafik/Speicher');
  if (/mali|adreno|powervr|videocore/.test(g)) return pick('low', 'Mobil-GPU');
  // Spitzenklasse → ultra
  if (/rtx\s*(30[89]0|40[6-9]0|50\d0)|rtx\s*a[4-6]000|rx\s*(6[89]\d0|7[89]\d0|9070)|radeon pro w7/.test(g)) return pick('ultra', 'Spitzen-GPU');
  // Dedizierte Mittel-/Oberklasse → high
  if (/rtx|gtx\s*(10[6-8]0|16[5-6]0)|rx\s*(5[6-7]00|6[5-7]\d0|7[6-7]\d0|5[78]0|vega)|arc\s*a[57]|apple m\d\s*(pro|max|ultra)/.test(g)) return pick('high', 'dedizierte GPU');
  // Integriert / Einstieg → medium bzw. low
  if (/iris\s*xe|arc|radeon\(tm\)\s*(graphics|\d{3}m)|radeon graphics|apple m\d|apple gpu/.test(g)) return pick('medium', 'integrierte GPU (stark)');
  if (/intel|uhd|hd graphics|gma/.test(g)) return pick('low', 'integrierte GPU');
  if (/nvidia|geforce|radeon|amd/.test(g)) return pick(cores >= 8 ? 'high' : 'medium', 'dedizierte GPU (unbekanntes Modell)');
  return pick('medium', 'unbekannte GPU');
}

/**
 * Laufzeit-Feinabstimmung: misst Bildzeiten (nach Aufwärmphase) und stuft bei Bedarf um.
 * frame(ms) je Bild aufrufen; liefert eine neue Stufe oder null.
 */
export function createAutoTuner(start, { warmup = 45, window = 90, maxChanges = 2 } = {}) {
  let n = 0, changes = 0;
  const samples = [];
  let current = start;
  return {
    get done() { return changes >= maxChanges || n < 0; },
    frame(ms) {
      if (n < 0) return null;
      n++;
      if (n <= warmup) return null;
      samples.push(ms);
      if (samples.length < window) return null;
      const sorted = samples.slice().sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      samples.length = 0;
      n = 0;
      const i = QUALITY_ORDER.indexOf(current);
      let next = null;
      if (median > 34 && i > 0) next = QUALITY_ORDER[i - 1];          // unter ~30 FPS → runter
      else if (median < 9 && i < 2) next = QUALITY_ORDER[i + 1];       // locker über 100 FPS → bis „hoch“ rauf
      if (!next) { n = -1; return null; }
      changes++;
      if (changes >= maxChanges) n = -1;
      current = next;
      return next;
    },
  };
}

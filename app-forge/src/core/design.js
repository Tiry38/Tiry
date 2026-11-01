'use strict';
/**
 * Design system: curated gradient palettes + contrast helpers.
 * Every palette is checked for readable contrast (see test/design.test.js).
 */

const PALETTES = [
  { id: 'aurora', name: 'Aurora', mode: 'dark', bg: ['#0b1026', '#1b1446', '#2a0f3d'], accent: ['#7c3aed', '#06b6d4'], glow: '#22d3ee' },
  { id: 'sunset', name: 'Sunset Blaze', mode: 'dark', bg: ['#1a0b1f', '#3b0d2e', '#4a1414'], accent: ['#f97316', '#ec4899'], glow: '#fb7185' },
  { id: 'ocean', name: 'Deep Ocean', mode: 'dark', bg: ['#03141f', '#06283d', '#0b3b5a'], accent: ['#0ea5e9', '#22c55e'], glow: '#38bdf8' },
  { id: 'neon-lime', name: 'Neon Lime', mode: 'dark', bg: ['#070b07', '#0f1f14', '#13261a'], accent: ['#a3e635', '#22d3ee'], glow: '#bef264' },
  { id: 'royal', name: 'Royal Plum', mode: 'dark', bg: ['#0f0a24', '#1e1147', '#2d1b69'], accent: ['#a855f7', '#f472b6'], glow: '#c084fc' },
  { id: 'midnight-gold', name: 'Midnight Gold', mode: 'dark', bg: ['#0c0a09', '#1c1917', '#292524'], accent: ['#f59e0b', '#ef4444'], glow: '#fbbf24' },
  { id: 'berry', name: 'Berry Smoothie', mode: 'dark', bg: ['#1a0614', '#2e0a24', '#3f0d33'], accent: ['#f43f5e', '#a855f7'], glow: '#fb7185' },
  { id: 'glacier', name: 'Glacier', mode: 'dark', bg: ['#06121f', '#0c2033', '#11304a'], accent: ['#60a5fa', '#a78bfa'], glow: '#93c5fd' },
  { id: 'forest', name: 'Forest Glow', mode: 'dark', bg: ['#04130d', '#082519', '#0d3322'], accent: ['#10b981', '#facc15'], glow: '#34d399' },
  { id: 'lava', name: 'Lava', mode: 'dark', bg: ['#140404', '#2a0808', '#3d0c0c'], accent: ['#ef4444', '#f59e0b'], glow: '#f87171' },
  { id: 'cyber', name: 'Cyber Grape', mode: 'dark', bg: ['#07040f', '#120a2a', '#1a0f3d'], accent: ['#f0abfc', '#22d3ee'], glow: '#e879f9' },
  { id: 'coral', name: 'Coral Night', mode: 'dark', bg: ['#120a10', '#24121c', '#341826'], accent: ['#fb7185', '#fdba74'], glow: '#fda4af' },
  { id: 'peach', name: 'Peach Cream', mode: 'light', bg: ['#fff7ed', '#ffe4e6', '#fef3c7'], accent: ['#c2410c', '#be185d'], glow: '#fb923c' },
  { id: 'mint', name: 'Mint Frost', mode: 'light', bg: ['#ecfdf5', '#e0f2fe', '#f0fdfa'], accent: ['#047857', '#0369a1'], glow: '#34d399' },
  { id: 'lavender', name: 'Lavender Mist', mode: 'light', bg: ['#f5f3ff', '#fae8ff', '#e0e7ff'], accent: ['#6d28d9', '#be185d'], glow: '#c084fc' },
  { id: 'sky', name: 'Clear Sky', mode: 'light', bg: ['#eff6ff', '#e0f2fe', '#f0f9ff'], accent: ['#1d4ed8', '#0e7490'], glow: '#60a5fa' }
];

const STYLES = [
  { id: 'glass', name: 'Glassmorphism', radius: 24, blur: 18, border: 0.14, surface: 0.08 },
  { id: 'soft', name: 'Soft UI', radius: 28, blur: 10, border: 0.08, surface: 0.11 },
  { id: 'bold', name: 'Bold Gradient', radius: 18, blur: 6, border: 0.2, surface: 0.14 }
];

function hexToRgb(hex) {
  const h = String(hex).replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function isHex(v) {
  return typeof v === 'string' && hexToRgb(v) !== null;
}

function luminance(hex) {
  const c = hexToRgb(hex);
  if (!c) return 0;
  const ch = [c.r, c.g, c.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function rgba(hex, alpha) {
  const c = hexToRgb(hex) || { r: 255, g: 255, b: 255 };
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

/** Picks the text colour on accent buttons that stays readable on both gradient stops. */
function onAccentColor(accent) {
  const light = '#ffffff';
  const dark = '#0b0b14';
  const minLight = Math.min(...accent.map((a) => contrast(a, light)));
  const minDark = Math.min(...accent.map((a) => contrast(a, dark)));
  return minLight >= minDark ? light : dark;
}

/** Fills derived tokens (text colours, surfaces) for a palette. */
function resolvePalette(p) {
  const dark = p.mode !== 'light';
  const text = p.text || (dark ? '#f8fafc' : '#14111f');
  const muted = p.muted || (dark ? '#a5adc4' : '#4b4560');
  return {
    ...p,
    text,
    muted,
    onAccent: onAccentColor(p.accent),
    surfaceBase: dark ? '#ffffff' : '#ffffff',
    shadow: dark ? 'rgba(0,0,0,0.45)' : 'rgba(40,20,60,0.14)'
  };
}

/**
 * Builds a palette from AI-suggested colours, falling back to a curated one
 * when the colours are invalid or unreadable.
 */
function paletteFromSuggestion(suggestion, fallback) {
  try {
    if (!suggestion) return resolvePalette(fallback);
    const { mode, background, accent } = suggestion;
    if (!Array.isArray(background) || !Array.isArray(accent)) return resolvePalette(fallback);
    const bg = background.filter(isHex).slice(0, 3);
    const ac = accent.filter(isHex).slice(0, 2);
    if (bg.length < 2 || ac.length < 2) return resolvePalette(fallback);
    while (bg.length < 3) bg.push(bg[bg.length - 1]);
    const p = resolvePalette({ id: 'custom', name: 'Custom', mode: mode === 'light' ? 'light' : 'dark', bg, accent: ac, glow: ac[1] });
    const textOk = bg.every((c) => contrast(c, p.text) >= 7);
    const accentOk = ac.every((c) => contrast(c, p.onAccent) >= 3);
    return textOk && accentOk ? p : resolvePalette(fallback);
  } catch {
    return resolvePalette(fallback);
  }
}

/** CSS custom properties for a palette + style. */
function cssTokens(palette, style) {
  const p = resolvePalette(palette);
  const s = style || STYLES[0];
  const dark = p.mode !== 'light';
  return `:root{
  --bg1:${p.bg[0]};--bg2:${p.bg[1]};--bg3:${p.bg[2]};
  --a1:${p.accent[0]};--a2:${p.accent[1]};--glow:${p.glow};
  --text:${p.text};--muted:${p.muted};--on-accent:${p.onAccent};
  --surface:${dark ? rgba('#ffffff', s.surface) : rgba('#ffffff', 0.62)};
  --surface-strong:${dark ? rgba('#ffffff', s.surface + 0.06) : rgba('#ffffff', 0.85)};
  --border:${dark ? rgba('#ffffff', s.border) : rgba('#1e1b4b', s.border * 0.7)};
  --shadow:${p.shadow};
  --radius:${s.radius}px;--radius-sm:${Math.round(s.radius * 0.6)}px;--blur:${s.blur}px;
  --grad:linear-gradient(135deg,var(--a1),var(--a2));
  --grad-3:linear-gradient(120deg,var(--a1),var(--glow) 50%,var(--a2));
  --grad-flow:linear-gradient(110deg,var(--a1),var(--glow),var(--a2),var(--a1));
  --a1-soft:${rgba(p.accent[0], 0.32)};--a2-soft:${rgba(p.accent[1], 0.3)};--glow-soft:${rgba(p.glow, dark ? 0.34 : 0.4)};
  color-scheme:${dark ? 'dark' : 'light'};
}`;
}

module.exports = { PALETTES, STYLES, hexToRgb, isHex, luminance, contrast, rgba, onAccentColor, resolvePalette, paletteFromSuggestion, cssTokens };

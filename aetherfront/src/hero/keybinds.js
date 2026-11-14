// Tastenbelegung der Heldensteuerung (WoW-Standard), vollständig umbelegbar.
// Eine Bindung ist ein Tastencode (KeyboardEvent.code, unabhängig vom Tastaturlayout) mit optionalem
// Modifikator: 'KeyW', 'Shift+Digit1'. Jede Aktion hat bis zu zwei Bindungen (primär, sekundär).
// Gespeichert in den Einstellungen unter 'keybinds' – nur Abweichungen vom Standard.

export const HERO_ACTIONS = [
  { id: 'moveForward', label: 'Vorwärts laufen', group: 'Bewegung', def: ['KeyW', 'ArrowUp'] },
  { id: 'moveBack', label: 'Rückwärts gehen', group: 'Bewegung', def: ['KeyS', 'ArrowDown'] },
  { id: 'turnLeft', label: 'Nach links drehen', group: 'Bewegung', def: ['KeyA', 'ArrowLeft'] },
  { id: 'turnRight', label: 'Nach rechts drehen', group: 'Bewegung', def: ['KeyD', 'ArrowRight'] },
  { id: 'strafeLeft', label: 'Seitwärts links', group: 'Bewegung', def: ['KeyQ', ''] },
  { id: 'strafeRight', label: 'Seitwärts rechts', group: 'Bewegung', def: ['KeyE', ''] },
  { id: 'jump', label: 'Springen', group: 'Bewegung', def: ['Space', ''] },
  { id: 'autorun', label: 'Automatisch laufen', group: 'Bewegung', def: ['NumLock', 'KeyR'] },
  { id: 'targetNearest', label: 'Nächsten Gegner anvisieren', group: 'Ziel', def: ['Tab', ''] },
  { id: 'ability1', label: 'Fähigkeit 1', group: 'Aktionsleiste', def: ['Digit1', 'Numpad1'] },
  { id: 'ability2', label: 'Fähigkeit 2', group: 'Aktionsleiste', def: ['Digit2', 'Numpad2'] },
  { id: 'ability3', label: 'Fähigkeit 3', group: 'Aktionsleiste', def: ['Digit3', 'Numpad3'] },
  { id: 'ability4', label: 'Fähigkeit 4', group: 'Aktionsleiste', def: ['Digit4', 'Numpad4'] },
  { id: 'ability5', label: 'Fähigkeit 5 (Ultimate ab Stufe 6)', group: 'Aktionsleiste', def: ['Digit5', 'Numpad5'] },
  { id: 'item1', label: 'Gegenstand 1', group: 'Gegenstände', def: ['Shift+Digit1', ''] },
  { id: 'item2', label: 'Gegenstand 2', group: 'Gegenstände', def: ['Shift+Digit2', ''] },
  { id: 'item3', label: 'Gegenstand 3', group: 'Gegenstände', def: ['Shift+Digit3', ''] },
  { id: 'item4', label: 'Gegenstand 4', group: 'Gegenstände', def: ['Shift+Digit4', ''] },
  { id: 'item5', label: 'Gegenstand 5', group: 'Gegenstände', def: ['Shift+Digit5', ''] },
  { id: 'kingHeal', label: 'König heilen', group: 'Team', def: ['KeyH', ''] },
];

export const ACTION_BY_ID = Object.fromEntries(HERO_ACTIONS.map((a) => [a.id, a]));

/** Vollständige Belegung (Standard + gespeicherte Abweichungen) */
export function resolveBinds(settings) {
  const saved = (settings && settings.get('keybinds')) || {};
  const out = {};
  for (const a of HERO_ACTIONS) {
    const s = saved[a.id];
    out[a.id] = Array.isArray(s) ? [s[0] || '', s[1] || ''] : a.def.slice();
  }
  return out;
}

/** Bindung setzen; entfernt dieselbe Taste von anderen Aktionen (keine Doppelbelegung). */
export function setBind(settings, actionId, slot, combo) {
  const all = resolveBinds(settings);
  if (combo) for (const id of Object.keys(all)) for (let i = 0; i < 2; i++) if (all[id][i] === combo) all[id][i] = '';
  all[actionId][slot] = combo || '';
  const diff = {};
  for (const a of HERO_ACTIONS) if (all[a.id][0] !== a.def[0] || all[a.id][1] !== a.def[1]) diff[a.id] = all[a.id];
  settings.set('keybinds', diff);
  return all;
}

export function resetBinds(settings) { settings.set('keybinds', {}); }

const MOD_CODES = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);
export const isModifierCode = (code) => MOD_CODES.has(code);

/** Tastendruck → Bindungs-Text ('Shift+Digit1'); Modifikatoren allein liefern '' */
export function comboFromEvent(e) {
  if (!e.code || MOD_CODES.has(e.code)) return '';
  let s = '';
  if (e.ctrlKey) s += 'Ctrl+';
  if (e.altKey) s += 'Alt+';
  if (e.shiftKey) s += 'Shift+';
  return s + e.code;
}

/** Index: Bindung → Aktion (für schnelles Nachschlagen beim Tastendruck) */
export function bindIndex(binds) {
  const m = new Map();
  for (const [id, arr] of Object.entries(binds)) for (const c of arr) if (c) m.set(c, id);
  return m;
}

const NAMES = {
  Space: 'Leertaste', Tab: 'Tab', NumLock: 'Num', Escape: 'Esc', Enter: '↵', Backspace: '⌫', Backquote: '^',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', CapsLock: 'Feststell', Minus: 'ß', Equal: '´',
  BracketLeft: 'Ü', BracketRight: '+', Semicolon: 'Ö', Quote: 'Ä', Backslash: '#', Comma: ',', Period: '.', Slash: '-',
  IntlBackslash: '<', Delete: 'Entf', Insert: 'Einfg', Home: 'Pos1', End: 'Ende', PageUp: 'Bild↑', PageDown: 'Bild↓',
};
/** Anzeige-Text einer Bindung (deutsches Layout): 'Shift+Digit1' → 'S-1', 'KeyW' → 'W' */
export function comboLabel(combo, short = false) {
  if (!combo) return '';
  const parts = combo.split('+');
  const code = parts.pop();
  let k;
  if (code.startsWith('Key')) k = code.slice(3);
  else if (code.startsWith('Digit')) k = code.slice(5);
  else if (code.startsWith('Numpad')) k = `N${code.slice(6).replace('Add', '+').replace('Subtract', '-').replace('Multiply', '*').replace('Divide', '/').replace('Decimal', ',').replace('Enter', '↵')}`;
  else if (/^F\d+$/.test(code)) k = code;
  else k = NAMES[code] || code;
  // deutsches Layout: Y und Z vertauscht
  if (k === 'Y') k = 'Z'; else if (k === 'Z') k = 'Y';
  const mods = parts.map((m) => (short ? { Shift: 'S', Ctrl: 'C', Alt: 'A' }[m] : { Shift: 'Umschalt', Ctrl: 'Strg', Alt: 'Alt' }[m]));
  return short ? [...mods, k].join('-') : [...mods, k].join(' + ');
}

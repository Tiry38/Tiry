// Eigene, gestochen scharfe SVG-Symbole für die Oberfläche (keine externen Dateien, keine Emojis).
// Alle Symbole nutzen currentColor – die Farbe kommt aus dem CSS.
const svg = (body, vb = '0 0 24 24') => `<svg class="i" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export const I = {
  // Ressourcen
  gold: svg('<ellipse cx="12" cy="16.5" rx="7.5" ry="3" fill="currentColor" opacity=".45"/><ellipse cx="12" cy="12.5" rx="7.5" ry="3" fill="currentColor" opacity=".7"/><ellipse cx="12" cy="8.5" rx="7.5" ry="3" fill="currentColor"/><path d="M4.5 8.5v8M19.5 8.5v8" stroke="currentColor" stroke-width="1.2" opacity=".8"/><ellipse cx="12" cy="8.5" rx="4" ry="1.3" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1"/>'),
  aether: svg('<path d="M12 2l6 8-6 12-6-12z" fill="currentColor" opacity=".55"/><path d="M12 2l6 8h-12z" fill="currentColor"/><path d="M12 2v20M6 10h12" stroke="#fff" stroke-opacity=".55" stroke-width=".9" fill="none"/>'),
  income: svg('<path d="M3.5 18.5l5.5-5.5 3.5 3 8-8.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/><path d="M14.5 7.5h6v6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/><path d="M3 21.5h18" stroke="currentColor" stroke-width="1.2" opacity=".5"/>'),
  value: svg('<path d="M12 2.5l8 3v6.2c0 4.8-3.4 8.3-8 9.8-4.6-1.5-8-5-8-9.8V5.5z" fill="currentColor" opacity=".35"/><path d="M12 2.5l8 3v6.2c0 4.8-3.4 8.3-8 9.8-4.6-1.5-8-5-8-9.8V5.5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 8.5l8 8M16 8.5l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>'),
  // König & Wirtschaft
  crown: svg('<path d="M3 8l4.5 4L12 4.5 16.5 12 21 8l-2 10H5z" fill="currentColor"/><path d="M5 20.5h14" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="13.5" r="1.4" fill="#000" fill-opacity=".45"/>'),
  heal: svg('<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="currentColor" opacity=".3"/><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="miter"/><path d="M11 7h2v4h4v2h-4v4h-2v-4H7v-2h4z" fill="currentColor"/>'),
  worker: svg('<path d="M12 1.5l1.9 6.6 6.6 1.9-6.6 1.9L12 18.5l-1.9-6.6-6.6-1.9 6.6-1.9z" fill="currentColor"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor" opacity=".7"/><circle cx="5" cy="19" r="1.3" fill="currentColor" opacity=".55"/>'),
  hall: svg('<path d="M4 21V10l2-1.5V5h2v2l4-3 4 3V5h2v3.5L20 10v11h-6v-5a2 2 0 00-4 0v5z" fill="currentColor"/><path d="M2.5 21.5h19" stroke="currentColor" stroke-width="1.4"/>'),
  // Werte
  heart: svg('<path d="M12 20.5S3.5 15.3 3.5 9.2A4.4 4.4 0 0112 7a4.4 4.4 0 018.5 2.2c0 6.1-8.5 11.3-8.5 11.3z" fill="currentColor"/>'),
  sword: svg('<path d="M19.5 3.5l-1 4.5L9 17.5 6.5 15 16 5.5z" fill="currentColor"/><path d="M5 13.5l5.5 5.5M4 20l3-3" stroke="currentColor" stroke-width="2" stroke-linecap="square"/>'),
  shield: svg('<path d="M12 2.5l8 3v6.2c0 4.8-3.4 8.3-8 9.8-4.6-1.5-8-5-8-9.8V5.5z" fill="currentColor" opacity=".3"/><path d="M12 2.5l8 3v6.2c0 4.8-3.4 8.3-8 9.8-4.6-1.5-8-5-8-9.8V5.5z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.5v19" stroke="currentColor" stroke-width="1.3" opacity=".7"/>'),
  range: svg('<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2.2"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" stroke-width="1.5"/>'),
  speed: svg('<path d="M13 2L5 13.5h6L10 22l9-12.5h-6z" fill="currentColor"/>'),
  type: svg('<path d="M12 3l9 9-9 9-9-9z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 8l4 4-4 4-4-4z" fill="currentColor"/>'),
  count: svg('<circle cx="8" cy="9" r="3" fill="currentColor"/><circle cx="16" cy="9" r="3" fill="currentColor" opacity=".7"/><path d="M2.5 20c.6-3.6 2.8-5.5 5.5-5.5s4.9 1.9 5.5 5.5zM12.5 14.8c1-.2 2.2-.3 3.5-.3 2.7 0 4.9 1.9 5.5 5.5h-6.4" fill="currentColor" opacity=".85"/>'),
  skull: svg('<path d="M12 2.5c-4.7 0-8 3.2-8 7.6 0 2.6 1.2 4.3 2.7 5.4V19h2.4v-2h1.7v2h2.4v-2h1.7v2h2.4v-3.5c1.5-1.1 2.7-2.8 2.7-5.4 0-4.4-3.3-7.6-8-7.6z" fill="currentColor"/><path d="M8.3 9.3h2.6v2.6H8.3zM13.1 9.3h2.6v2.6h-2.6z" fill="#000" fill-opacity=".7"/>'),
  leak: svg('<path d="M12 3v13M6.5 11l5.5 5.5 5.5-5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/><path d="M4 20.5h16" stroke="currentColor" stroke-width="2"/>'),
  star: svg('<path d="M12 2.2l2.9 6.5 7 .7-5.3 4.7 1.6 6.9L12 17.4 5.8 21l1.6-6.9L2.1 9.4l7-.7z" fill="currentColor"/>'),
  lock: svg('<path d="M7 10.5V8a5 5 0 0110 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 10.5h15v10.5h-15z" fill="currentColor"/><path d="M12 14v3.2" stroke="#000" stroke-opacity=".55" stroke-width="2"/>'),
  check: svg('<path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"/>'),
  dice: svg('<path d="M12 2l9 5v10l-9 5-9-5V7z" fill="currentColor" opacity=".25"/><path d="M12 2l9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="7" r="1.3" fill="currentColor"/><circle cx="7.5" cy="13.5" r="1.2" fill="currentColor"/><circle cx="16.5" cy="13.5" r="1.2" fill="currentColor"/><circle cx="16.5" cy="17.5" r="1.2" fill="currentColor"/>'),
  menu: svg('<path d="M4 6.5h16M4 12h11M4 17.5h16" stroke="currentColor" stroke-width="2" stroke-linecap="square"/>'),
  board: svg('<path d="M4 4h16v16H4z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 9h16M4 14.5h16M10 4v16" stroke="currentColor" stroke-width="1.4"/>'),
  gear: svg('<path d="M10.3 2h3.4l.5 2.7 1.9.8 2.3-1.6 2.4 2.4-1.6 2.3.8 1.9 2.7.5v3.4l-2.7.5-.8 1.9 1.6 2.3-2.4 2.4-2.3-1.6-1.9.8-.5 2.7h-3.4l-.5-2.7-1.9-.8-2.3 1.6-2.4-2.4 1.6-2.3-.8-1.9L2 13.7v-3.4l2.7-.5.8-1.9-1.6-2.3 2.4-2.4 2.3 1.6 1.9-.8z" fill="currentColor"/><circle cx="12" cy="12" r="3.3" fill="#000" fill-opacity=".55"/>'),
  back: svg('<path d="M14.5 5L7.5 12l7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/>'),
  chevron: svg('<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/>'),
  play: svg('<path d="M7 4l13 8-13 8z" fill="currentColor"/>'),
  up: svg('<path d="M12 3l8 8h-5v9H9v-9H4z" fill="currentColor"/>'),
  coinBack: svg('<path d="M4 12h13M11 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/><path d="M20.5 4v16" stroke="currentColor" stroke-width="2"/>'),
  diamond: svg('<path d="M12 3l9 9-9 9-9-9z" fill="currentColor"/>'),
  flag: svg('<path d="M5 21V3" stroke="currentColor" stroke-width="2"/><path d="M6 4h12l-3 4.5 3 4.5H6z" fill="currentColor"/>'),
  siege: svg('<path d="M3 21h18M5 21V9h3v3h2.5V9h3v3H16V9h3v12" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 21v-4.5a2 2 0 014 0V21" fill="currentColor"/>'),
  hold: svg('<path d="M12 2.5l8 3v6.2c0 4.8-3.4 8.3-8 9.8-4.6-1.5-8-5-8-9.8V5.5z" fill="currentColor"/><path d="M8 12l3 3 5-6" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="2.2"/>'),
  globe: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
  book: svg('<path d="M3 5c3-1.3 6-1.3 9 .6V20c-3-1.9-6-1.9-9-.6zM21 5c-3-1.3-6-1.3-9 .6V20c3-1.9 6-1.9 9-.6z" fill="currentColor" opacity=".35"/><path d="M3 5c3-1.3 6-1.3 9 .6 3-1.9 6-1.9 9-.6v14.4c-3-1.3-6-1.3-9 .6-3-1.9-6-1.9-9-.6zM12 5.6V20" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
  swords: svg('<path d="M4 3.5l9.5 9.5-2 2L2 5.5V3.5zM20 3.5L10.5 13l2 2L22 5.5V3.5z" fill="currentColor"/><path d="M6 16.5l-2.5 2.5M18 16.5l2.5 2.5M4.5 14l5.5 5.5M19.5 14L14 19.5" stroke="currentColor" stroke-width="2" stroke-linecap="square"/>'),
  power: svg('<path d="M12 2.5v9" stroke="currentColor" stroke-width="2.4"/><path d="M6.6 5.8a8 8 0 1010.8 0" fill="none" stroke="currentColor" stroke-width="2.2"/>'),
  campaign: svg('<path d="M3 5.5l6-2 6 2 6-2v15l-6 2-6-2-6 2z" fill="currentColor" opacity=".3"/><path d="M3 5.5l6-2 6 2 6-2v15l-6 2-6-2-6 2zM9 3.5v15M15 5.5v15" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
};

/** Kleines Symbol + Wert, z. B. für Wertechips */
export const stat = (icon, html, cls = '') => `<span class="stat ${cls}">${I[icon] || ''}<span>${html}</span></span>`;

// ---------------------------------------------------------------------------------------------
// Fähigkeits-Symbole der Helden (Schlüssel = heroes.js „icon“) und Zustands-Symbole (Buffs/Debuffs).
// Zweifarbig: currentColor (Hauptform) + var(--ic2) (Leuchtakzent), damit sie auf dem Verlaufsgrund
// der Aktionsleiste plastisch wirken.
// ---------------------------------------------------------------------------------------------
const A2 = 'var(--ic2, #fff)';
export const AI = {
  // Kael (Wächter)
  shield: svg(`<path d="M12 2l8.5 3.2v6.4c0 5-3.6 8.7-8.5 10.4-4.9-1.7-8.5-5.4-8.5-10.4V5.2z" fill="currentColor" opacity=".35"/><path d="M12 2l8.5 3.2v6.4c0 5-3.6 8.7-8.5 10.4-4.9-1.7-8.5-5.4-8.5-10.4V5.2z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 6.5l3.5 3.5-3.5 7-3.5-7z" fill="${A2}"/><path d="M2 12h3M19 12h3M4 5l2 2M20 5l-2 2" stroke="${A2}" stroke-width="1.4" opacity=".8"/>`),
  roar: svg(`<path d="M4 9c0-3 2.5-5.5 6-5.5S16 6 16 9v3l-2 2v3H8l-1-3-3-2z" fill="currentColor"/><path d="M8 11.5h5l-1 2.5H9z" fill="#000" fill-opacity=".55"/><path d="M17.5 7.5c1.4 1.2 2.2 2.8 2.2 4.5s-.8 3.3-2.2 4.5M19.5 5c2 1.8 3 4.3 3 7s-1 5.2-3 7" fill="none" stroke="${A2}" stroke-width="1.6" stroke-linecap="round"/>`),
  charge: svg(`<path d="M2 15h7M1 11.5h6M3 8h5" stroke="${A2}" stroke-width="1.6" stroke-linecap="round" opacity=".85"/><path d="M10 6.5l3-2 7.5 4 1.5 5.5-3 5H12l1.5-4L10 13z" fill="currentColor"/><path d="M14.5 9.5l3 1.5-1 3.5" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="1.3"/>`),
  wall: svg(`<path d="M3 21V9l9-6 9 6v12z" fill="currentColor" opacity=".3"/><path d="M5 20.5h14M5 16.5h14M5 12.5h14M9 12.5v4M15 12.5v4M12 16.5v4M7 16.5v4M17 16.5v4" stroke="currentColor" stroke-width="1.6"/><path d="M12 4.5l4 3v3.5h-8V7.5z" fill="${A2}"/>`),
  quake: svg(`<path d="M2 17.5h20" stroke="currentColor" stroke-width="2"/><path d="M12 17.5l-2-3.5 3-2-2-3.5 2-2.5M12 17.5l3 3M12 17.5l-4 3.5M6 17.5l-2 3M18 17.5l2.5 3" fill="none" stroke="${A2}" stroke-width="1.5" stroke-linejoin="bevel"/><path d="M8 4h8l-1 5h-6z" fill="currentColor"/><path d="M11 9h2v3h-2z" fill="currentColor"/>`),
  // Mira (Priesterin)
  light: svg(`<circle cx="12" cy="12" r="4.2" fill="${A2}"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5M4.6 4.6l3.2 3.2M16.2 16.2l3.2 3.2M4.6 19.4l3.2-3.2M16.2 7.8l3.2-3.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`),
  heal: svg(`<path d="M12 21s-8.5-5-8.5-11.2A4.6 4.6 0 0112 7.2a4.6 4.6 0 018.5 2.6C20.5 16 12 21 12 21z" fill="currentColor" opacity=".4"/><path d="M10.5 8.5h3v3h3v3h-3v3h-3v-3h-3v-3h3z" fill="${A2}"/><path d="M3 4.5c1.5-1.5 3-2 4.5-2M21 4.5c-1.5-1.5-3-2-4.5-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`),
  ward: svg(`<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".7"/><circle cx="12" cy="12" r="6.5" fill="currentColor" opacity=".3"/><path d="M12 5.5l1.6 4.9h5.1l-4.1 3 1.6 4.9L12 15.3l-4.2 3 1.6-4.9-4.1-3h5.1z" fill="${A2}"/>`),
  consecrate: svg(`<ellipse cx="12" cy="17" rx="10" ry="4" fill="currentColor" opacity=".35"/><ellipse cx="12" cy="17" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 3v11M8.5 6.5h7" stroke="${A2}" stroke-width="2.2" stroke-linecap="round"/><path d="M5 12l1 3M19 12l-1 3M8 10.5l.5 3.5M16 10.5l-.5 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`),
  rebirth: svg(`<path d="M12 22c-2-2.5-3-5-3-7.5 0-3 3-5 3-8.5 0 3.5 3 5.5 3 8.5 0 2.5-1 5-3 7.5z" fill="${A2}"/><path d="M4 13c0-4.5 3.6-8.5 8-8.5M20 13c0-4.5-3.6-8.5-8-8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 11l1.5 2.5L6 11.2M21.5 11L20 13.5 18 11.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="2.8" r="1.4" fill="currentColor"/>`),
  // Lyra (Jägerin)
  aim: svg(`<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".7"/><path d="M12 1.5v6M12 16.5v6M1.5 12h6M16.5 12h6" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="1.8" fill="${A2}"/>`),
  fan: svg(`<path d="M3 21L12 4M3 21l14-11M3 21l18-3M3 21L6 3" stroke="currentColor" stroke-width="1.5"/><path d="M12 4l-1.4.4.9-2.4zM17 10l-1.1-.6 2.4-.9zM21 18l-1.4-.8 2.5-.3zM6 3l-1.1.9.5-2.5z" fill="${A2}" stroke="${A2}" stroke-width="1.6" stroke-linejoin="round"/>`),
  leap: svg(`<path d="M4 20c1-7 6-12 14-13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.5 2"/><path d="M15.5 4.5l4.5 2.5-3.5 3.5" fill="none" stroke="${A2}" stroke-width="2" stroke-linecap="round"/><circle cx="6" cy="9" r="2.4" fill="currentColor"/><path d="M5 11.5l2.5 4 3-1.5M7.5 15.5l-2 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`),
  herb: svg(`<path d="M12 22V10" stroke="currentColor" stroke-width="1.6"/><path d="M12 14C7 14 4 11 4 6c5 0 8 3 8 8zM12 11c4.5 0 7.5-2.5 7.5-7-4.5 0-7.5 2.5-7.5 7z" fill="currentColor" opacity=".85"/><path d="M12 14c-3 0-5.5-2-6.5-5M12 11c2.5 0 4.5-1.5 5.5-4.5" stroke="${A2}" stroke-width="1.1" fill="none"/><circle cx="18" cy="17" r="2.6" fill="${A2}" opacity=".85"/>`),
  rain: svg(`<path d="M3 3l4 6M8 2l4 6M13 1.5l4 6M18 2.5l4 6M5.5 10l3.5 5.5M11 9.5l3.5 5.5M16 9.5l3.5 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="12" cy="20" rx="9" ry="2.6" fill="${A2}" opacity=".75"/>`),
  // Selene (Magierin)
  lance: svg(`<path d="M3 21L17 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M15 3.5l5.5 5.5-1 1L22 2z" fill="${A2}"/><path d="M14.5 4L20 9.5l-2.5 2.5-5.5-5.5z" fill="currentColor"/><path d="M6 13l-2-2M9 16l-2 2M11 9.5l-3-1" stroke="${A2}" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>`),
  nova: svg(`<path d="M12 2l1.6 6.5L20 6l-4.2 5L22 12l-6.2 1L20 18l-6.4-2.5L12 22l-1.6-6.5L4 18l4.2-5L2 12l6.2-1L4 6l6.4 2.5z" fill="currentColor" opacity=".9"/><circle cx="12" cy="12" r="3.2" fill="${A2}"/>`),
  blink: svg(`<path d="M3 12h6M2 8.5h5M2 15.5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".55"/><circle cx="16" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 1.6"/><path d="M16 7.5l1.3 3.2 3.2 1.3-3.2 1.3L16 16.5l-1.3-3.2-3.2-1.3 3.2-1.3z" fill="${A2}"/>`),
  crystal: svg(`<path d="M12 1.5l5 6-5 15-5-15z" fill="currentColor" opacity=".55"/><path d="M12 1.5l5 6H7z" fill="${A2}"/><path d="M12 1.5v21M7 7.5l5 15 5-15" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4 11l3 2-1.5 4zM20 11l-3 2 1.5 4z" fill="currentColor"/>`),
  meteor: svg(`<path d="M3 3l9 9M7 2l8 8M2 7l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".7"/><circle cx="15.5" cy="15.5" r="5.5" fill="currentColor"/><circle cx="14.5" cy="14.5" r="2.6" fill="${A2}"/><path d="M12 19l1.5-1M18.5 13l1-1.5" stroke="#000" stroke-opacity=".4" stroke-width="1.2"/>`),
  // Brann (Krieger)
  hammer: svg(`<path d="M13.5 9.5L3 20l1.5 1.5L15 11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M11 4.5l4-3 7.5 7.5-3 4z" fill="currentColor"/><path d="M13 5.5l5.5 5.5" stroke="#000" stroke-opacity=".4" stroke-width="1.2"/><path d="M20 1.5l1 2M22.5 4l-2 1M7 6l-2-1" stroke="${A2}" stroke-width="1.6" stroke-linecap="round"/>`),
  spin: svg(`<path d="M12 3a9 9 0 019 9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 21a9 9 0 01-9-9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M21 12l-2.5-2.5M21 12l2-2.8M3 12l2.5 2.5M3 12l-2 2.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 8l8 8M16 8l-8 8" stroke="${A2}" stroke-width="2.2" stroke-linecap="round"/>`),
  rocket: svg(`<path d="M12 2c3 2.5 4.5 6 4.5 10L14 15h-4l-2.5-3C7.5 8 9 4.5 12 2z" fill="currentColor"/><circle cx="12" cy="8.5" r="1.8" fill="${A2}"/><path d="M10 15.5c0 3 2 6.5 2 6.5s2-3.5 2-6.5" fill="${A2}" opacity=".9"/><path d="M7.5 12L5 15.5l3 .5M16.5 12l2.5 3.5-3 .5" fill="currentColor" opacity=".7"/>`),
  victory: svg(`<path d="M12 2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 15.4l-5.2 2.8 1-5.9L3.5 8.2l5.9-.8z" fill="currentColor"/><path d="M12 6.5l1.3 2.7 3 .4-2.2 2 .5 3L12 13.2l-2.6 1.4.5-3-2.2-2 3-.4z" fill="${A2}"/><path d="M6 21h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`),
  orbital: svg(`<path d="M10.5 1.5h3v14h-3z" fill="${A2}" opacity=".9"/><path d="M8.5 1.5v14M15.5 1.5v14" stroke="currentColor" stroke-width="1" opacity=".6"/><ellipse cx="12" cy="18.5" rx="9" ry="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><ellipse cx="12" cy="18.5" rx="4.5" ry="1.6" fill="currentColor"/>`),
  // Varo (Schurke)
  cuts: svg(`<path d="M4 20L18 3l1.5 1.5L6 21.5z" fill="currentColor"/><path d="M20 20L6 3 4.5 4.5 18 21.5z" fill="currentColor" opacity=".75"/><path d="M2.5 12h4M17.5 12h4M12 2v3" stroke="${A2}" stroke-width="1.6" stroke-linecap="round"/>`),
  shadow: svg(`<path d="M5 20c0-6 2-9 5-11-1 3 0 5 2 5-1-3 1-6 4-8-1 3 1 6 1 9 0 3-2 5-6 5z" fill="currentColor"/><circle cx="17" cy="5" r="2" fill="${A2}"/><path d="M2 21.5h20" stroke="currentColor" stroke-width="1.4" opacity=".55"/>`),
  bleed: svg(`<path d="M3 21L17 5l2 2L5 23z" fill="currentColor" opacity=".8"/><path d="M16 10c-1.5 2.5-2.5 4-2.5 5.5a2.5 2.5 0 005 0c0-1.5-1-3-2.5-5.5zM20 3c-.9 1.5-1.5 2.4-1.5 3.3a1.5 1.5 0 003 0c0-.9-.6-1.8-1.5-3.3z" fill="${A2}"/>`),
  recover: svg(`<path d="M4 14c2-1 3-3 3-5a5 5 0 0110 0c0 2 1 4 3 5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 18c2.5 1.5 4.5 2 7 2s4.5-.5 7-2" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".6"/><circle cx="12" cy="9" r="2.6" fill="${A2}"/><path d="M12 13v4" stroke="${A2}" stroke-width="1.6" stroke-linecap="round"/>`),
  // Zustände
  stun: svg(`<path d="M12 4l1.4 3 3.2.4-2.4 2.2.7 3.2L12 11.2l-2.9 1.6.7-3.2-2.4-2.2 3.2-.4z" fill="currentColor"/><ellipse cx="12" cy="17" rx="8" ry="3" fill="none" stroke="${A2}" stroke-width="1.5"/>`),
  slow: svg(`<path d="M12 2v20M4 6l16 12M20 6L4 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="3" fill="${A2}"/>`),
  root: svg(`<path d="M12 2v9c0 3-4 3-6 7M12 11c0 3 4 3 6 7M12 11v11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 6c-2 0-3-1-4-3M16 6c2 0 3-1 4-3" fill="none" stroke="${A2}" stroke-width="1.5" stroke-linecap="round"/>`),
  mark: svg(`<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.2" opacity=".6"/><path d="M12 8l4 4-4 4-4-4z" fill="${A2}"/>`),
  fear: svg(`<path d="M12 3c-4.5 0-7.5 3-7.5 7.5 0 3 1.5 5 3 6V21h9v-4.5c1.5-1 3-3 3-6C19.5 6 16.5 3 12 3z" fill="currentColor" opacity=".85"/><circle cx="9" cy="10.5" r="1.8" fill="${A2}"/><circle cx="15" cy="10.5" r="1.8" fill="${A2}"/><path d="M10 16c1.3-1 2.7-1 4 0" stroke="#000" stroke-opacity=".6" stroke-width="1.4" fill="none"/>`),
  haste: svg(`<path d="M13 2L5 13.5h6L10 22l9-12.5h-6z" fill="currentColor"/><path d="M13 6l-4.5 6.5h4" fill="none" stroke="${A2}" stroke-width="1.3"/>`),
};

/** Klassen-Embleme (Heldenauswahl) */
export const CI = {
  tank: AI.shield, healer: AI.heal, ranged: AI.aim, caster: AI.nova, melee: AI.hammer, assassin: AI.cuts,
};

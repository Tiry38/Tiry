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

// Weltaufteilung (Welteinheiten, y = oben). Gemeinsam genutzt von Simulation und Grafik.
// Zwei Teams (0 = West, 1 = Ost), je bis zu 4 Bahnen. Gegner laufen in -Z → +Z die Bahn hinunter
// und, falls sie durchbrechen ("Leak"), weiter zum König des Teams.

export const CELL = 2;                 // Größe einer Bau-Zelle
export const GRID_COLS = 6;            // Bauraster-Breite (x)
export const GRID_ROWS = 8;            // Bauraster-Länge (z)
export const LANE_WIDTH = 14;          // begehbare Breite der Bahn
export const LANE_SPAWN_Z = -30;       // Gegner erscheinen hier
export const BUILD_Z0 = -8;            // Bauraster von z = -8 ...
export const BUILD_Z1 = BUILD_Z0 + GRID_ROWS * CELL; // ... bis z = +8
export const LANE_END_Z = 26;          // Ende der Bahn → danach Weg zum König
export const KING_Z = 50;              // König-Plateau
export const TEAM_CENTER_X = [-70, 70];
export const LANE_SPACING = 22;
export const LANES_PER_TEAM = 4;

export function laneCenterX(team, slot) {
  // slot 0..3 (0 = außen links aus Sicht von oben); Team West negativ, Team Ost positiv
  return TEAM_CENTER_X[team] + (slot - 1.5) * LANE_SPACING;
}

export function kingPos(team) {
  return { x: TEAM_CENTER_X[team], z: KING_Z };
}

// Mitte einer Bauzelle (col 0..GRID_COLS-1, row 0..GRID_ROWS-1)
export function cellCenter(team, slot, col, row) {
  const x0 = laneCenterX(team, slot) - (GRID_COLS * CELL) / 2;
  return { x: x0 + (col + 0.5) * CELL, z: BUILD_Z0 + (row + 0.5) * CELL };
}

// Welche Bahn-Slots werden bei n Spielern pro Team belegt (mittig zentriert)
export function slotsForTeamSize(n) {
  return [[1], [1, 2], [0, 1, 2], [0, 1, 2, 3]][Math.max(1, Math.min(4, n)) - 1];
}

export const LAYOUT = {
  CELL, GRID_COLS, GRID_ROWS, LANE_WIDTH, LANE_SPAWN_Z, BUILD_Z0, BUILD_Z1, LANE_END_Z, KING_Z,
  TEAM_CENTER_X, LANE_SPACING, LANES_PER_TEAM,
};

// Katalog der echten CC0-Assets (Poly Haven, ambientCG). Einzige Quelle der Wahrheit für
//   scripts/fetch-assets.mjs (Download nach web/assets/) und src/render/assets.js (Laden zur Laufzeit).
// Fehlen Dateien, fällt das Spiel automatisch auf die prozeduralen Texturen zurück.
//
// Felder: slot = Ordnername unter web/assets/textures/, id = Asset-Kennung beim Anbieter,
//   maps = { Laufzeitname: [Anbieter-Map, Auflösung] }, meters = Kantenlänge einer Kachel in Metern (Welt-Tiling).
export const TEXTURE_SETS = [
  { slot: 'floor', source: 'polyhaven', id: 'rock_tile_floor', meters: 3.6, use: 'Bahnen, Brücken, Königsplateau',
    maps: { albedo: ['Diffuse', '2k'], normal: ['nor_gl', '2k'], arm: ['arm', '1k'] } },
  { slot: 'ground', source: 'polyhaven', id: 'leafy_grass', meters: 3.2, use: 'Inselboden unter dem Gras',
    maps: { albedo: ['Diffuse', '1k'], normal: ['nor_gl', '1k'], arm: ['arm', '1k'] } },
  { slot: 'soil', source: 'polyhaven', id: 'forest_ground_04', meters: 2.8, use: 'Erde, Wegränder, Inselkanten',
    maps: { albedo: ['Diffuse', '1k'], normal: ['nor_gl', '1k'], arm: ['arm', '1k'] } },
  { slot: 'cliff', source: 'polyhaven', id: 'cliff_side', meters: 9, use: 'Felswände der Schwebeinseln (triplanar)',
    maps: { albedo: ['Diffuse', '2k'], normal: ['nor_gl', '1k'], arm: ['arm', '1k'] } },
  { slot: 'moss', source: 'polyhaven', id: 'mossy_rock', meters: 3.5, use: 'Moos in Mulden/Spalten, Findlinge',
    maps: { albedo: ['Diffuse', '1k'], normal: ['nor_gl', '1k'], arm: ['arm', '1k'] } },
  { slot: 'stone', source: 'polyhaven', id: 'rock_boulder_dry', meters: 2.2, use: 'Behauener Stein: Säulen, Portale, Bordsteine',
    maps: { albedo: ['Diffuse', '1k'], normal: ['nor_gl', '1k'], arm: ['arm', '1k'] } },
  { slot: 'bark', source: 'polyhaven', id: 'bark_brown_02', meters: 1.6, use: 'Baumrinde',
    maps: { albedo: ['Diffuse', '1k'], normal: ['nor_gl', '1k'] } },
  { slot: 'leaves', source: 'ambientcg', id: 'LeafSet024', variant: '1K-JPG', use: 'Fotoblätter für die Laubkarten der Bäume',
    maps: { albedo: ['Color'], opacity: ['Opacity'] } },
];

// HDRIs (Radiance .hdr, linear). Werden als Himmel (oberer Halbraum) und für Bildbasiertes Licht (PMREM) genutzt.
export const HDRIS = [
  { slot: 'sky_day', source: 'polyhaven', id: 'kloofendal_48d_partly_cloudy_puresky', res: '2k', use: 'Akt 1 – klarer Nachmittag mit Haufenwolken' },
  { slot: 'sky_golden', source: 'polyhaven', id: 'kloppenheim_06_puresky', res: '1k', use: 'Akt 2 – goldene Stunde, tiefe Sonne' },
  { slot: 'sky_haze', source: 'polyhaven', id: 'qwantani_late_afternoon_puresky', res: '1k', use: 'Akt 3/4 – dunstiger Spätnachmittag (Schmiede-Glut, Abgrund-Violett per Grading)' },
];

export const ASSET_ROOT = 'assets';
export const texturePath = (slot, map) => `${ASSET_ROOT}/textures/${slot}/${map}.jpg`;
export const hdriPath = (slot) => `${ASSET_ROOT}/hdri/${slot}.hdr`;

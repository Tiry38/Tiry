// Aether-Forge – Register der Helden-Skulpturen (nur zum Backen; das Spiel lädt die fertigen .afm-Dateien).
import * as kael from './kael.js';
import * as mira from './mira.js';
import * as lyra from './lyra.js';
import * as selene from './selene.js';
import * as brann from './brann.js';
import * as varo from './varo.js';

export const HERO_DESIGNS = {
  kael: { build: kael.build, budgets: [40000, 12000, 4000] },
  mira: { build: mira.build, budgets: [36000, 11000, 3600] },
  lyra: { build: lyra.build, budgets: [36000, 11000, 3600] },
  selene: { build: selene.build, budgets: [36000, 11000, 3600] },
  brann: { build: brann.build, budgets: [40000, 12000, 4000] },
  varo: { build: varo.build, budgets: [36000, 11000, 3600] },
};

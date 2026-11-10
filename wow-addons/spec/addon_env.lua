-- Lädt Tiry's Zentrale frisch in den strengen Forever-Nachbau (tests/wow_mock.lua).
-- opts: auctionator (false = fehlt), prices, skills, level, faction, class, remove = { "C_X.Func", ... }, combat
local E = {}
local ROOT = "TirysZentrale/"

local function tocFiles()
  local files = {}
  for line in io.lines(ROOT .. "TirysZentrale.toc") do
    if not line:match("^##") and line:match("%S") then files[#files + 1] = (line:gsub("\\", "/"):gsub("%s+$", "")) end
  end
  return files
end
E.tocFiles = tocFiles

-- "C_TradeSkillUI.CraftRecipe" -> aus der globalen Umgebung entfernen
local function removePath(path)
  local parts = {}
  for p in path:gmatch("[^%.]+") do parts[#parts + 1] = p end
  if #parts == 1 then _G[parts[1]] = nil return end
  local t = _G[parts[1]]
  for i = 2, #parts - 1 do t = t and t[parts[i]] end
  if type(t) == "table" then t[parts[#parts]] = nil end
end

function E.load(opts)
  opts = opts or {}
  package.loaded.wow_mock = nil
  local W = require("wow_mock")
  W.errors, W.prints, W.timers, W.registered = {}, {}, {}, {}
  W.level, W.faction, W.class, W.money = opts.level or 21, opts.faction or "Horde", opts.class or "ROGUE", opts.money or 50000
  W.skills = opts.skills or {
    { name = "Berufe", isHeader = true, isCollapsed = false },
    { name = "Kürschnerei", skillID = 393, isHeader = false, rank = 102, maxRank = 150 },
    { name = "Lederverarbeitung", skillID = 165, isHeader = false, rank = 110, maxRank = 150 },
  }
  W.itemInfo = opts.itemInfo or {}
  W.prices = opts.prices or { [2318] = 32, [783] = 45, [2319] = 120, [4232] = 160, [2589] = 60, [2592] = 120, [249427] = 4000, [2321] = 25, [2320] = 10 }
  W.known = opts.known or { [2881] = true, [2152] = true, [2164] = true, [2158] = true }
  W.bags = opts.bags or { [0] = {} }
  W.combat = opts.combat
  W.install({ auctionator = opts.auctionator, locale = opts.locale })
  for _, path in ipairs(opts.remove or {}) do removePath(path) end
  TirysZentraleDB, TirysZentraleCharDB = opts.db, nil
  local ns = {}
  for _, f in ipairs(tocFiles()) do
    local chunk = assert(loadfile(ROOT .. f))
    chunk("TirysZentrale", ns)
  end
  W.fire("ADDON_LOADED", "TirysZentrale")
  W.fire("PLAYER_LOGIN")
  W.flush()
  return ns, W
end

-- Letzte Chat-Zeilen als ein Text (zum Suchen)
function E.chat(W)
  return table.concat(W.prints, "\n")
end

return E

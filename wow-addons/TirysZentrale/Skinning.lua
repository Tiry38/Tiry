-- Tiry's Zentrale – Kürschner-Zentrale: Häuten-Rechner, Leder nach Tierlevel, Spezial-Leder,
-- eigene Fundorte (wie GatherMate: merkt sich, wo DU gehäutet/gesammelt hast).
local ADDON, ns = ...

local K = {}
ns.Skin = K

-- Leder je Tierlevel (Classic-Wissen; Forever nutzt dieselben Lederstufen). Item-IDs in der Forever-Datenbank geprüft.
K.TIERS = {
  { from = 1, to = 10, items = { 2934, 2318 }, label = "Verdorbene Lederfetzen & Leichtes Leder" },
  { from = 10, to = 20, items = { 2318, 783 }, label = "Leichtes Leder & Leichter Balg" },
  { from = 20, to = 30, items = { 2319, 4232 }, label = "Mittleres Leder & Mittlerer Balg" },
  { from = 30, to = 40, items = { 4234, 4235 }, label = "Schweres Leder & Schwerer Balg" },
  { from = 40, to = 50, items = { 4304, 8169 }, label = "Dickes Leder & Dicker Balg" },
  { from = 50, to = 61, items = { 8170, 8171 }, label = "Unverwüstliches Leder & Unverwüstlicher Balg" },
}

-- Neu in Forever: seltene Kürschner-Materialien (können von jedem häutbaren Tier fallen)
K.FOREVER = { 249427, 249428, 249429 }

-- Spezial-Leder: Fundorte kommen aus ns.SKIN_SPOTS[itemID]
K.SPECIAL = {
  { id = 4461, who = "Raptoren", lvl = 25 },
  { id = 8167, who = "Schildkröten", lvl = 30 },
  { id = 8154, who = "Skorpide", lvl = 35 },
  { id = 15423, who = "Schimären", lvl = 45 },
  { id = 15419, who = "Bären im Teufelswald", lvl = 47 },
  { id = 15422, who = "Frostsäbler", lvl = 50 },
  { id = 15417, who = "Teufelssaurier (selten, sehr stark)", lvl = 50 },
}

-- Häuten-Formel (Classic): bis Level 10 reicht Skill 1, Level 11–20 braucht (Level−10)×10, danach Level×5
function K.SkillFor(level)
  if level <= 10 then return 1 end
  if level <= 20 then return (level - 10) * 10 end
  return level * 5
end

-- Höchstes Tierlevel, das du mit deinem Skill häuten kannst
function K.MaxLevel(rank)
  rank = rank or ns.ProfRank(ns.PROF.SKINNING)
  if rank <= 0 then return 0 end
  if rank < 100 then return 10 + math.floor(rank / 10) end
  return math.floor(rank / 5)
end

function K.TierFor(level)
  for _, t in ipairs(K.TIERS) do
    if level >= t.from and level < t.to then return t end
  end
  return K.TIERS[#K.TIERS]
end

-- Ideale Tierstufe: höchstes Level, das du häuten UND sicher besiegen kannst (dein Level +1)
function K.TargetLevel()
  local maxSkin = K.MaxLevel()
  local maxFight = ns.player.level + 1
  if maxSkin == 0 then return maxFight, maxSkin end
  return math.min(maxSkin, maxFight), maxSkin
end

-- Häut-Spots passend zur Zielstufe (aus den 5er-Bändern), sortiert nach Dichte, gegnerische Startgebiete raus
function K.Spots(target)
  local out, enemy = {}, (ns.Faction() == "Horde") and "Alliance" or "Horde"
  for start = 1, 56, 5 do
    local band = ns.SKIN_SPOTS and ns.SKIN_SPOTS[start]
    for _, s in ipairs(band or {}) do
      if s.hi <= target + 1 and s.lo >= target - 6 and ns.ZONE_FACTION[s.map] ~= enemy then
        out[#out + 1] = s
      end
    end
  end
  table.sort(out, function(a, b)
    -- höhere Tiere (besseres Leder, mehr Skill) und dichte Stellen zuerst
    local sa, sb = a.n * (1 + a.hi / 60), b.n * (1 + b.hi / 60)
    return sa > sb
  end)
  return out
end

----------------------------------------------------------------------------
-- Eigene Fundorte: wenn neue Sammel-Beute in die Taschen kommt, Position merken
----------------------------------------------------------------------------
local GATHER = {}
for _, id in ipairs({ 2934, 2318, 783, 2319, 4232, 4234, 4235, 4304, 8169, 8170, 8171, 249427, 249428, 249429,
  8167, 8154, 15423, 15419, 15422, 15417, 4461 }) do GATHER[id] = "leather" end
for _, id in ipairs({ 2447, 765, 2449, 785, 2450, 2453, 3355, 3820, 3369, 3356, 3357, 3818, 3821, 3358, 3819, 4625, 8831,
  8836, 8838, 8839, 8845, 8846, 13464, 13463, 13465, 13466, 13467, 13468, 249399 }) do GATHER[id] = "herb" end
for _, id in ipairs({ 2770, 2771, 2775, 2772, 2776, 3858, 7911, 10620, 249391, 2835, 2836, 2838 }) do GATHER[id] = "ore" end
K.GATHER = GATHER

function K.RecordGather(itemID)
  local group = GATHER[itemID]
  if not group or not (C_Map and C_Map.GetBestMapForUnit and C_Map.GetPlayerMapPosition) then return end
  local ok, map, pos = pcall(function()
    local m = C_Map.GetBestMapForUnit("player")
    return m, m and C_Map.GetPlayerMapPosition(m, "player")
  end)
  if not ok or not map or not pos or not pos.GetXY then return end
  local x, y = pos:GetXY()
  if not x or x <= 0 then return end
  ns.char.mySpots = ns.char.mySpots or {}
  local list = ns.char.mySpots[group] or {}
  ns.char.mySpots[group] = list
  table.insert(list, { m = map, x = math.floor(x * 1000 + 0.5) / 10, y = math.floor(y * 1000 + 0.5) / 10, i = itemID, t = time() })
  while #list > 400 do table.remove(list, 1) end
end

-- Deine besten eigenen Stellen: Fundpunkte bündeln (Raster 5 Einheiten)
function K.MySpots(group, limit)
  local list = ns.char.mySpots and ns.char.mySpots[group] or {}
  local cells = {}
  for _, p in ipairs(list) do
    local key = p.m .. ":" .. math.floor(p.x / 5) .. ":" .. math.floor(p.y / 5)
    local c = cells[key]
    if not c then
      c = { map = p.m, sx = 0, sy = 0, n = 0, items = {} }
      cells[key] = c
    end
    c.sx, c.sy, c.n = c.sx + p.x, c.sy + p.y, c.n + 1
    c.items[p.i] = (c.items[p.i] or 0) + 1
  end
  local out = {}
  for _, c in pairs(cells) do
    local names = {}
    for id in pairs(c.items) do names[#names + 1] = ns.Item(id).name end
    table.sort(names)
    out[#out + 1] = { map = c.map, x = c.sx / c.n, y = c.sy / c.n, n = c.n, names = names }
  end
  table.sort(out, function(a, b) return a.n > b.n end)
  while #out > (limit or 3) do table.remove(out) end
  return out, #list
end

-- Beute-Radar meldet neue Items -> Sammelorte merken
ns.Listen("LOOT_GAINED", function(_, itemID)
  if GATHER[itemID] then ns.Safe(K.RecordGather, itemID) end
end)

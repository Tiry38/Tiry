-- Tiry's Zentrale – Unterwegs-Gold: Was bringt das Gebiet, in dem du gerade bist – und die nächsten Gebiete
-- deiner LevelPilot-Route? Kräuter/Erz (mit Beruf), Leder (Kürschnerei, nach Tierlevel), Stoff und Besonderes,
-- bewertet mit deinen Live-Preisen (nach AH-Gebühr) bzw. Händlerpreis. Nur Hinweise, kein Automatismus.
local _, ns = ...
local Z = {}
ns.ZoneGold = Z
local M = ns.Market

-- Gebietsnamen, wie LevelPilot sie in seinen Routen schreibt, -> uiMapID (Forever/Classic-Karten)
Z.ALIAS = {
  ["Orgrimmar"] = 1454, ["Donnerfels"] = 1456, ["Unterstadt"] = 1458,
  ["Brachland"] = 1413, ["Das Brachland"] = 1413,
  ["Hügelland"] = 1424, ["Vorgebirge des Hügellands"] = 1424,
  ["Eschental"] = 1440, ["Düstermarschen"] = 1445, ["Winterquell"] = 1452,
  ["Tausend Nadeln"] = 1441, ["Steinkrallengebirge"] = 1442, ["Desolace"] = 1443,
  ["Arathihochland"] = 1417, ["Schlingendorntal"] = 1434,
}

local PROF_NAME = { [182] = "Kräuterkunde", [186] = "Bergbau", [393] = "Kürschnerei" }

local GROUP_ORDER = { "herb", "ore", "leather", "cloth", "special" }

local function norm(s)
  s = tostring(s or ""):lower()
  s = s:gsub("^das ", ""):gsub("^die ", ""):gsub("^der ", ""):gsub("[%s%-']", "")
  return s
end

local byName
-- uiMapID zu einem Gebietsnamen (LevelPilot-Schreibweise oder Spielname)
function Z.MapForName(name)
  if not name then return nil end
  if Z.ALIAS[name] then return Z.ALIAS[name] end
  if not byName then
    byName = {}
    for map, n in pairs(ns.ZONE_NAMES or {}) do byName[norm(n)] = map end
    for n, map in pairs(Z.ALIAS) do byName[norm(n)] = map end
  end
  return byName[norm(name)]
end

local function bandOf(key)
  for _, b in ipairs(ns.FARM or {}) do
    if b.key == key then return b end
  end
end

-- Lederstufe für ein Tierlevel (Kürschner-Tabelle)
local function leatherFor(level)
  for _, t in ipairs((ns.Skin and ns.Skin.TIERS) or {}) do
    if level >= t.from and level < t.to then return t.items end
  end
  return {}
end

----------------------------------------------------------------------------
-- Index je Karte (einmal gebaut): Gruppen mit Item-IDs, Stufenbereich und bester Stelle
----------------------------------------------------------------------------
local index
local function addGroup(map, group, items, spot, lo, hi)
  local z = index[map]
  if not z then
    z = { map = map, groups = {} }
    index[map] = z
  end
  local g = z.groups[group]
  if not g then
    g = { key = group, items = {}, n = 0 }
    z.groups[group] = g
  end
  for _, id in ipairs(items or {}) do g.items[id] = true end
  g.n = g.n + (spot.n or 0)
  if not g.spot or (spot.n or 0) > (g.spot.n or 0) then g.spot = spot end
  if lo then
    g.lo = math.min(g.lo or lo, lo)
    g.hi = math.max(g.hi or hi or lo, hi or lo)
  end
end

function Z.Index()
  if index then return index end
  index = {}
  for bandKey, band in pairs(ns.SPOTS or {}) do
    local b = bandOf(bandKey)
    local lo, hi = b and b.min, b and (b.max - 1)
    for group, spots in pairs(band) do
      for _, s in ipairs(spots) do
        local items = s.items
        if not items or #items == 0 then
          -- Leder/Stoff/Besonderes: Items aus dem Farm-Guide dieses Levelbereichs
          items = b and b.groups and b.groups[group] or {}
          if group == "leather" and lo then items = leatherFor(math.floor((lo + hi) / 2)) end
        end
        addGroup(s.map, group, items, s, lo, hi)
      end
    end
  end
  -- Kürschner-Fundorte mit echtem Tierlevel (genauer als der Levelbereich) und Spezial-Leder
  for key, spots in pairs(ns.SKIN_SPOTS or {}) do
    for _, s in ipairs(spots) do
      if key < 1000 then
        addGroup(s.map, "leather", leatherFor(math.floor(((s.lo or key) + (s.hi or key)) / 2)), s, s.lo, s.hi)
      else
        addGroup(s.map, "leather", { key }, s, s.lo, s.hi)
      end
    end
  end
  return index
end

----------------------------------------------------------------------------
-- Bewertung mit Live-Preisen
----------------------------------------------------------------------------
-- Wert je Stück: AH nach Gebühr, wenn das mehr bringt als der Händler; sonst Händlerpreis
function Z.UnitValue(id)
  local p = M.Price(id)
  local net = p and M.Net(p)
  local vendor = M.VendorSell(id) or 0
  if net and net > vendor then return net, "ah" end
  if vendor > 0 then return vendor, "vendor" end
  return nil
end

local function usable(group)
  local g = ns.FARM_GROUPS and ns.FARM_GROUPS[group]
  if not (g and g.prof) then return true end
  return ns.HasProf(g.prof)
end

-- Gebiet bewerten. Rückgabe { map, name, groups = { {key, label, usable, items = {{id, value, src}}, best, spot, lo, hi} },
-- score (Summe der besten Stückwerte aller nutzbaren Gruppen), missed (beste Gruppe, für die dir der Beruf fehlt) }
function Z.ForMap(map)
  local z = map and Z.Index()[map]
  if not z then return nil end
  local out = { map = map, name = ns.Maps.ZoneName(map), groups = {}, score = 0 }
  for _, key in ipairs(GROUP_ORDER) do
    local g = z.groups[key]
    if g then
      local items = {}
      for id in pairs(g.items) do
        local v, src = Z.UnitValue(id)
        if v then items[#items + 1] = { id = id, value = v, src = src } end
      end
      table.sort(items, function(a, b)
        if a.value ~= b.value then return a.value > b.value end
        return a.id < b.id
      end)
      if #items > 0 then
        local info = ns.FARM_GROUPS and ns.FARM_GROUPS[key]
        local e = { key = key, label = info and info.label or key, usable = usable(key), items = items,
          best = items[1].value, spot = g.spot, lo = g.lo, hi = g.hi, prof = info and info.prof,
          profName = info and info.prof and PROF_NAME[info.prof] }
        if e.usable then
          out.groups[#out.groups + 1] = e
          out.score = out.score + e.best
        elseif not out.missed or e.best > out.missed.best then
          out.missed = e
        end
      end
    end
  end
  table.sort(out.groups, function(a, b) return a.best > b.best end)
  return out
end

----------------------------------------------------------------------------
-- Wo bist du? (Unterkarten wie Höhlen/Städte -> übergeordnetes Gebiet mit Daten)
----------------------------------------------------------------------------
function Z.CurrentMap()
  if not (C_Map and C_Map.GetBestMapForUnit) then return nil end
  local ok, map = pcall(C_Map.GetBestMapForUnit, "player")
  if not ok or not map then return nil end
  local idx = Z.Index()
  for _ = 1, 4 do
    if idx[map] or (ns.ZONE_NAMES and ns.ZONE_NAMES[map]) then return map end
    local okInfo, info = pcall(C_Map.GetMapInfo, map)
    if not (okInfo and info and info.parentMapID and info.parentMapID > 0) then break end
    map = info.parentMapID
  end
  return map
end

----------------------------------------------------------------------------
-- LevelPilot (nur lesen): aktuelle und nächste Gebiete deiner Route
----------------------------------------------------------------------------
-- Rückgabe: Liste { name, map, level } ab dem aktuellen Abschnitt (ohne Wiederholungen), nil ohne LevelPilot
function Z.RouteZones(max)
  max = max or 3
  local routes, R, db = rawget(_G, "LevelPilot_Routes"), rawget(_G, "LP_Route"), rawget(_G, "LevelPilotDB")
  if type(routes) ~= "table" or type(R) ~= "table" or type(R.Pick) ~= "function" then return nil end
  local okKey, key = pcall(R.Pick, UnitFactionGroup("player"), UnitLevel("player"), type(db) == "table" and db.route or nil)
  local route = okKey and key and routes[key]
  if type(route) ~= "table" or type(route.segs) ~= "table" or type(route.steps) ~= "table" then return nil end
  local plan = type(db) == "table" and type(db.plan) == "table" and db.plan[key]
  local i = type(plan) == "table" and tonumber(plan.i) or nil
  local seg
  if i and #route.steps > 0 then
    local st = route.steps[math.max(1, math.min(i, #route.steps))]
    seg = st and st.seg
  end
  if not seg then
    -- noch kein Plan-Zeiger: erster Abschnitt, der zu deiner Stufe passt
    local lvl = UnitLevel("player") or 1
    for s, sg in ipairs(route.segs) do
      if (sg.l1 or sg.l0 or 0) >= lvl then seg = s break end
    end
  end
  local out, seen = {}, {}
  for s = seg or 1, #route.segs do
    local sg = route.segs[s]
    if sg and sg.z and not seen[sg.z] then
      seen[sg.z] = true
      out[#out + 1] = { name = sg.z, map = Z.MapForName(sg.z), level = sg.l0 }
      if #out >= max then break end
    end
  end
  return out, route.name
end

-- Für die Startseite: aktuelles Gebiet + bis zu 2 nächste Routen-Gebiete (mit Daten), sortiert nach Route
function Z.Overview()
  local here = Z.CurrentMap()
  local cur = here and Z.ForMap(here)
  local nextZones = {}
  local zones, routeName = Z.RouteZones(4)
  for _, rz in ipairs(zones or {}) do
    if rz.map and rz.map ~= here then
      local info = Z.ForMap(rz.map)
      if info and #info.groups > 0 then
        info.name = rz.name -- so wie LevelPilot das Gebiet nennt (gleiche Wörter in beiden Fenstern)
        info.routeLevel = rz.level
        nextZones[#nextZones + 1] = info
        if #nextZones >= 2 then break end
      end
    end
  end
  return { here = cur, hereMap = here, next = nextZones, route = routeName, hasRoute = zones ~= nil }
end

-- Eine Zeile für den Chat / die Karte: "Kräuter: Königsblut 45s · Leder: Mittleres Leder 30s"
function Z.Line(info, maxGroups)
  if not info then return nil end
  local parts = {}
  for i, g in ipairs(info.groups) do
    if i > (maxGroups or 3) then break end
    parts[#parts + 1] = string.format("%s: %s %s", g.label, ns.Item(g.items[1].id).name, ns.Money(g.items[1].value))
  end
  if #parts == 0 then return nil end
  return table.concat(parts, "  ·  ")
end

----------------------------------------------------------------------------
-- Gebietswechsel: einmal pro Gebiet und Sitzung einen kurzen Tipp im Chat (abschaltbar)
----------------------------------------------------------------------------
local told = {}
function Z.ZoneTip()
  if not (ns.settings and ns.settings.zoneTip) then return false end
  local map = Z.CurrentMap()
  if not map or told[map] then return false end
  local info = Z.ForMap(map)
  if not info or info.score < (ns.settings.zoneTipMin or 2000) then return false end
  told[map] = true
  ns.Print(string.format("|cff39ff6bUnterwegs-Gold in %s:|r %s", info.name, Z.Line(info, 3)))
  return true
end

ns.On("ZONE_CHANGED_NEW_AREA", function() ns.Debounce("zonetip", 2, function() ns.Safe(Z.ZoneTip) end) end)

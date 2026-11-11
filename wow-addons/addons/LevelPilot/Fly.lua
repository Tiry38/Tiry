-- LevelPilot · Fly: Lohnt sich der Flug? (Laufzeit gegen Flugzeit zum aktuellen Ziel)
-- Flugpunkte kommen live aus dem Spiel (C_TaxiMap), bekannte Punkte merkt sich das Addon,
-- sobald du einen Flugmeister ansprichst. Laufzeiten ueber das echte Wegenetz (Travel.lua),
-- Flugzeiten ueber das Flugnetz mit Umsteigen (gemessene Direktfluege, eigene Messungen gehen vor).
local F = {}
LP_Fly = F

local RUN, MOUNT = 7.0, 11.2          -- Yards/s zu Fuss / Reittier 60 % (Forever: Reittier erst ab 40)
local FLY = 30.0                      -- Yards/s Greif/Windreiter (Naeherung)
local DETOUR_RUN, DETOUR_FLY = 1.2, 1.45  -- Flugrouten laufen ueber Zwischenpunkte und Kurven
local OVERHEAD = 25                   -- Ansprechen, Abheben, Landen (s)
local MIN_SAVE, MIN_RATIO = 60, 0.88  -- erst ab 1 Min. und 12 % Ersparnis anzeigen (Laufweg ist jetzt echt)
local STICKY_RATIO = 0.94             -- einmal angezeigt: erst weg, wenn die Ersparnis fast verschwindet

local function vec(x, y) if CreateVector2D then return CreateVector2D(x, y) end return { x = x, y = y } end
local function xy(v) if not v then return end if v.GetXY then return v:GetXY() end return v.x, v.y end

local function world(map, x, y)
  local ok, cont, w = pcall(C_Map.GetWorldPosFromMapPos, map, vec(x, y))
  if not ok or not cont or not w then return end
  local wx, wy = xy(w)
  if not wx then return end
  return cont, wx, wy
end

local function continentMap(map)
  local guard = 0
  while map and guard < 8 do
    guard = guard + 1
    local ok, info = pcall(C_Map.GetMapInfo, map)
    if not ok or not info then return end
    if Enum and Enum.UIMapType and info.mapType == Enum.UIMapType.Continent then return map end
    if info.mapType == 2 then return map end
    map = info.parentMapID
  end
end

local function db()
  LevelPilotDB = LevelPilotDB or {}
  LevelPilotDB.fp = LevelPilotDB.fp or {}
  LevelPilotDB.ft = LevelPilotDB.ft or {}   -- gemessene Flugzeiten "von>nach" = Sekunden
  return LevelPilotDB
end

local myFaction
local function factionOK(f)
  if f == nil then return true end
  if not myFaction then myFaction = UnitFactionGroup("player") end
  local E_ = Enum and Enum.FlightPathFaction
  local H = E_ and E_.Horde or 1
  local A = E_ and E_.Alliance or 2
  if f == H then return myFaction == "Horde" end
  if f == A then return myFaction == "Alliance" end
  return true
end

local cache = {}
local function nodes(cmap)
  if cache[cmap] then return cache[cmap] end
  local list = {}
  local ok, raw = pcall(function() return C_TaxiMap.GetTaxiNodesForMap(cmap) end)
  if ok and raw then
    for _, n in ipairs(raw) do
      if n.position and factionOK(n.faction) then
        local px, py = xy(n.position)
        local cont, wx, wy = world(cmap, px, py)
        if cont then
          list[#list + 1] = { id = n.nodeID, name = n.name, cont = cont, wx = wx, wy = wy, map = cmap, x = px, y = py }
        end
      end
    end
  end
  if #list > 0 then cache[cmap] = list end
  return list
end

-- Flugmeister angesprochen: bekannte Punkte merken
function F.Learn()
  local d = db()
  pcall(function()
    local mapID = GetTaxiMapID and GetTaxiMapID()
    local all = C_TaxiMap.GetAllTaxiNodes(mapID)
    local UN = Enum and Enum.FlightPathState and Enum.FlightPathState.Unreachable or 2
    for _, n in ipairs(all or {}) do
      if n.nodeID and n.state ~= UN then d.fp[n.nodeID] = true end
    end
    d.fpSeen = true
  end)
end

local function short(name)
  if not name then return "?" end
  return (name:gsub(",.*$", ""))
end

local last, lastT, lastKey = nil, 0, nil
local shownKey = nil          -- Hysterese: einmal angezeigt, erst bei klar kleinerer Ersparnis wieder weg
local seenSpeed, seenT = nil, 0 -- echtes Lauftempo (Reittier, Geist, Buffs) messen

local function groundSpeed()
  local ok, cur = pcall(GetUnitSpeed, "player")
  local now = GetTime()
  if ok and type(cur) == "number" and cur > 2 and cur < 25 and not (UnitOnTaxi and UnitOnTaxi("player")) then
    local okS, sw = pcall(IsSwimming); if not (okS and sw) then seenSpeed, seenT = cur, now end
  end
  if seenSpeed and now - seenT < 20 then return math.max(RUN, seenSpeed) end
  return (IsMounted and IsMounted()) and MOUNT or RUN
end
F.Speed = groundSpeed

-- Ruhestein bereit? (Gegenstand 6948 vorhanden und ohne Abklingzeit)
local function hearthReady()
  local count = 0
  pcall(function() count = (C_Item and C_Item.GetItemCount and C_Item.GetItemCount(6948)) or (GetItemCount and GetItemCount(6948)) or 0 end)
  if (count or 0) < 1 then return false end
  local ok, start, dur = pcall(function()
    if C_Container and C_Container.GetItemCooldown then return C_Container.GetItemCooldown(6948) end
    return GetItemCooldown(6948)
  end)
  if not ok then return false end
  return (not start) or start == 0 or (start + (dur or 0) - GetTime()) <= 0
end
-- Gebundener Ort -> naechstgelegener Flugpunkt mit gleichem Namen (Gasthaus liegt dort in der Naehe)
local function hearthNode(list)
  local okB, bind = pcall(GetBindLocation)
  if not okB or type(bind) ~= "string" or bind == "" then return end
  local b = bind:lower()
  for _, n in ipairs(list) do
    local nm = (n.name or ""):lower()
    if nm:find(b, 1, true) then return n, bind end
  end
end

-- Bodenweg in Yards (Wegenetz aus der Spielgeometrie, Travel.lua); ohne Netz Luftlinie x 1.25.
-- q ist das stabile Ende (Spieler oder Ziel): eine Wegsuche reicht fuer alle Flugmeister.
local function ground(p, q)
  if LP_Walk and LP_Walk.Ground then
    local ok, d = pcall(LP_Walk.Ground, p, q)
    if ok and d then return d end
  end
  return math.sqrt((p.x - q.x) ^ 2 + (p.y - q.y) ^ 2) * DETOUR_RUN
end

-- Flugzeit a -> b in Sekunden: gemessen (eigener Flug) > Flugnetz mit Umsteigen (nur bekannte Punkte,
-- gemessene Direktfluege aus der Spielgeometrie-Datenbank) > grobe Schaetzung ueber die Luftlinie.
local function airTime(cont, a, b, knownSet, d)
  local m = d.ft[a.id .. ">" .. b.id]
  if m then return m, 1, true end
  if LP_Walk and LP_Walk.FlightTime then
    local ok, t, hops = pcall(LP_Walk.FlightTime, cont, a.id, b.id, knownSet, d.ft)
    if ok and t then return t, hops, true end
  end
  return math.sqrt((a.wx - b.wx) ^ 2 + (a.wy - b.wy) ^ 2) * DETOUR_FLY / FLY + 10, 1, false
end

-- t = { map, x, y } Ziel; liefert Rat oder nil
function F.Advice(t, key)
  if not (t and t.map and t.x) then return nil end
  local now = GetTime()
  if key == lastKey and now - lastT < 2 then return last end
  lastKey, lastT, last = key, now, nil
  if UnitOnTaxi and UnitOnTaxi("player") then return nil end
  if not (LP_Route and LP_Route.PlayerMapPos) then return nil end
  local pmap, px, py = LP_Route.PlayerMapPos()
  if not px then return nil end
  local pc, pwx, pwy = world(pmap, px, py)
  local tc, twx, twy = world(t.map, t.x, t.y)
  if not pc or not tc or pc ~= tc then return nil end
  local P, T = { c = pc, x = pwx, y = pwy }, { c = tc, x = twx, y = twy }
  local straight = math.sqrt((twx - pwx) ^ 2 + (twy - pwy) ^ 2)
  if straight < 400 then return nil end
  local cmap = continentMap(pmap)
  if not cmap then return nil end
  local list = nodes(cmap)
  if #list < 2 then return nil end
  local d = db()
  -- Nur Flugpunkte, die du kennst. Ohne einmal einen Flugmeister angesprochen zu haben, kein Flug-Rat
  -- (sonst empfiehlt der Pilot Punkte, die du noch gar nicht entdeckt hast).
  if not d.fpSeen then return nil end
  local known, knownSet = {}, {}
  for _, n in ipairs(list) do
    if n.cont == pc and d.fp[n.id] then known[#known + 1] = n; knownSet[n.id] = true end
  end
  if #known < 2 then return nil end
  local spd = groundSpeed()
  local runYd = ground(P, T)                       -- echter Laufweg Spieler -> Ziel (Ziel = stabiles Ende)
  local runT = runYd / spd
  -- Kandidaten: die 4 naechsten bekannten Flugmeister am Spieler und am Ziel (nach Luftlinie vorsortiert,
  -- dann echter Laufweg)
  local function dd(n, x, y) return math.sqrt((n.wx - x) ^ 2 + (n.wy - y) ^ 2) end
  local starts, ends = {}, {}
  for i, n in ipairs(known) do starts[i] = n; ends[i] = n end
  table.sort(starts, function(a, b) return dd(a, pwx, pwy) < dd(b, pwx, pwy) end)
  table.sort(ends, function(a, b) return dd(a, twx, twy) < dd(b, twx, twy) end)
  local w1, w2 = {}, {}
  -- Flugmeister/Ziel sind die festen Enden: ihre Wegsuchen bleiben gespeichert, der Spieler wird nur angebunden
  for i = 1, math.min(4, #starts) do local n = starts[i]; w1[n] = ground(P, { c = pc, x = n.wx, y = n.wy }) end
  for i = 1, math.min(4, #ends) do local n = ends[i]; w2[n] = ground({ c = pc, x = n.wx, y = n.wy }, T) end
  local best
  for a, wa in pairs(w1) do
    for b, wb in pairs(w2) do
      if a ~= b then
        local air, hops, sure = airTime(pc, a, b, knownSet, d)
        local tot = wa / spd + air + OVERHEAD + wb / spd
        if not best or tot < best.fly then
          best = { fly = tot, from = a, to = b, walk1 = wa, walk2 = wb, air = air, hops = hops, sure = sure }
        end
      end
    end
  end
  -- Ruhestein als dritte Moeglichkeit (Wirken + Laden ~20 s, Gasthaus ~ beim Flugpunkt, +20 s Puffer)
  local hb
  if hearthReady() then
    local hn, bindName = hearthNode(list)
    if hn and hn.cont == pc then
      local tot = 20 + 20 + ground({ c = pc, x = hn.wx, y = hn.wy }, T) / spd
      hb = { t = tot, name = bindName }
    end
  end
  if best and best.walk1 >= runYd then best = nil end      -- zum Flugmeister weiter als zum Ziel: Unsinn
  if hb and (not best or hb.t < best.fly) then
    local save = runT - hb.t
    local sticky = (shownKey == key)
    if save >= (sticky and MIN_SAVE * 0.5 or MIN_SAVE) and hb.t <= runT * (sticky and STICKY_RATIO or MIN_RATIO) then
      shownKey = key
      last = { kind = "hearth", run = runT, fly = hb.t, save = save, from = hb.name, to = hb.name, sure = true,
        runYd = runYd }
      return last
    end
  end
  if not best then shownKey = nil; return nil end
  local save = runT - best.fly
  local sticky = (shownKey == key)
  local minS, minR = MIN_SAVE, MIN_RATIO
  if sticky then minS, minR = MIN_SAVE * 0.5, STICKY_RATIO end
  if save < minS or best.fly > runT * minR then shownKey = nil; return nil end
  shownKey = key
  last = {
    kind = "fly", run = runT, fly = best.fly, save = save,
    from = short(best.from.name), to = short(best.to.name),
    fmap = best.from.map, fx = best.from.x, fy = best.from.y,
    atFM = best.walk1 < 60, sure = best.sure, hops = best.hops, air = best.air,
    runYd = runYd, walk1 = best.walk1, walk2 = best.walk2,
    measured = d.ft[best.from.id .. ">" .. best.to.id] and true or false,
  }
  return last
end

-- Am Flugmeister: Flug zum empfohlenen Ziel automatisch waehlen (wie Auto-Quest; Umschalt = aus)
local function autoTake()
  local d = db()
  if not (d.auto and F.want) or IsShiftKeyDown() then return end
  pcall(function()
    local mapID = GetTaxiMapID and GetTaxiMapID()
    local CUR = Enum and Enum.FlightPathState and Enum.FlightPathState.Reachable or 1
    for _, n in ipairs(C_TaxiMap.GetAllTaxiNodes(mapID) or {}) do
      if n.name and short(n.name) == F.want and n.state == CUR and n.slotIndex then
        TakeTaxiNode(n.slotIndex)
        print("|cff39ff6bLevelPilot|r: Flug nach " .. F.want .. " gewählt (schneller als laufen).")
        return
      end
    end
  end)
end

-- Flugzeit messen: beim Abflug Start/Ziel merken, bei der Landung Dauer speichern (naechstes Mal exakt)
local flight = nil
local function nodeAtSlot(slot)
  local from, to
  pcall(function()
    local mapID = GetTaxiMapID and GetTaxiMapID()
    local CUR = Enum and Enum.FlightPathState and Enum.FlightPathState.Current or 0
    for _, n in ipairs(C_TaxiMap.GetAllTaxiNodes(mapID) or {}) do
      if n.state == CUR then from = n.nodeID end
      if n.slotIndex == slot then to = n.nodeID end
    end
  end)
  return from, to
end
if hooksecurefunc and TakeTaxiNode then
  pcall(hooksecurefunc, "TakeTaxiNode", function(slot)
    local from, to = nodeAtSlot(slot)
    if from and to and from ~= to then flight = { from = from, to = to, t0 = GetTime(), up = false } end
  end)
end
local function flightTick()
  if not flight then return end
  local on = UnitOnTaxi and UnitOnTaxi("player")
  if on then flight.up = true return end
  if flight.up then
    local dur = GetTime() - flight.t0
    if dur > 10 and dur < 1200 then db().ft[flight.from .. ">" .. flight.to] = math.floor(dur + 0.5) end
    flight = nil
  elseif GetTime() - flight.t0 > 15 then flight = nil end   -- nie abgehoben
end
F.FlightTick = flightTick

local E = CreateFrame("Frame")
pcall(E.RegisterEvent, E, "TAXIMAP_OPENED")
pcall(E.RegisterEvent, E, "PLAYER_CONTROL_GAINED")
pcall(E.RegisterEvent, E, "PLAYER_CONTROL_LOST")
E:SetScript("OnEvent", function(_, ev)
  if ev == "TAXIMAP_OPENED" then
    F.Learn()
    if C_Timer and C_Timer.After then C_Timer.After(0.25, autoTake) else autoTake() end
  else
    if C_Timer and C_Timer.After then C_Timer.After(0.5, flightTick) else flightTick() end
  end
end)

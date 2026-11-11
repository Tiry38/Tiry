-- LevelPilot 5.0.1 · Wegenetz/Flug-Rat: Prüfer-Funde als Dauertest (echtes Wegenetz Walk.lua, echtes Flugnetz)
-- 1. Klippe/Schlucht: Punkt oben darf nicht "direkt" am Knoten unten haengen (Arathi/Sumpfland 4593 -> 4652)
-- 2. getrenntes Teilnetz: Spieler auf einer Insel -> keine Suche ueber das ganze Netz (vorher ~270 ms je Sekunde)
-- 3. Aufzug mit zwei Anschluessen (Unterstadt 6571): beide Verbindungen bekannt
-- 4. bekannte, aber nicht verbundene Flugpunkte -> kein (unmoeglicher) Flug-Rat
-- Aufruf: cd addons/LevelPilot && lua5.1 ../../tests/travel2.lua   (meldet "TRAVEL2 OK")
local fails = 0
local function check(ok, msg) print((ok and "OK    " or "FEHLER") .. "  " .. msg); if not ok then fails = fails + 1 end end
Tm = 1000
function GetTime() return Tm end function time() return 1700000000 + math.floor(Tm) end
local Obj = {}; Obj.__index = function() return function() end end
function CreateFrame() return setmetatable({}, Obj) end
function wipe(t) for k in pairs(t) do t[k] = nil end return t end
CreateVector2D = function(x, y) return { x = x, y = y } end
dofile("../../tests/zones_mock.lua")
ZONES_MOCK[1414] = { 1, 12000, -10000, 12500, -12000 }
ZONES_MOCK[1415] = { 0, 12000, -10000, 6000, -16000 }
PMAP, PX, PY = 1440, 0.1224, 0.338
C_Map = MockCMap()
C_Map.GetBestMapForUnit = function() return PMAP end
C_Map.GetPlayerMapPosition = function() return { x = PX, y = PY } end
SPEED = 7
function GetUnitSpeed() return SPEED end
function IsSwimming() return false end
function IsMounted() return false end
function UnitOnTaxi() return false end
function UnitFactionGroup() return "Horde", "Horde" end
function IsShiftKeyDown() return false end
LOG = {}
C_QuestLog = { GetQuestsOnMap = function() return {} end, GetTitleForQuestID = function() return nil end,
  GetLogIndexForQuestID = function(id) return LOG[id] and 1 or nil end, GetInfo = function() return nil end,
  GetQuestObjectives = function() return {} end, ReadyForTurnIn = function() return false end,
  IsQuestFlaggedCompleted = function() return false end, GetNumQuestLogEntries = function() return 0 end }
dofile("Route.lua") dofile("Nav.lua") dofile("Walk.lua") dofile("Travel.lua")
W, R = LP_Walk, LP_Route
function comps(g)
  local comp, sizes, nc = {}, {}, 0
  for s = 1, g.n do if not comp[s] then
    nc = nc + 1; local st, cnt = { s }, 0; comp[s] = nc
    while #st > 0 do local u = table.remove(st); cnt = cnt + 1
      for k = g.first[u], g.first[u + 1] - 1 do local v = math.floor(g.ew[k] / 4096)
        if not comp[v] then comp[v] = nc; st[#st + 1] = v end end end
    sizes[nc] = cnt end end
  return comp, sizes, nc
end

-- 1. Klippe
do
  local g = W.Graph(0)
  local function pt(k) return { c = 0, x = g.x[k], y = g.y[k] } end
  local a, b = pt(4593), pt(4652)
  local straight = math.sqrt((a.x - b.x) ^ 2 + (a.y - b.y) ^ 2)
  local d, sure = W.Ground(a, b)
  print(string.format("   Klippe 4593 -> 4652: Luftlinie %.0f yd, Bodenweg %.0f yd (Netz 888)", straight, d or -1))
  check(d and d > 700, "Klippe: Bodenweg ueber den echten Weg (> 700 yd), nicht 190 yd quer ueber den Abhang")
  local g1 = W.Graph(1)
  local a2, b2 = { c = 1, x = g1.x[1429], y = g1.y[1429] }, { c = 1, x = g1.x[1508], y = g1.y[1508] }
  local d2 = W.Ground(a2, b2)
  check(d2 and d2 > 2000, string.format("Tausend Nadeln/Tanaris 1429 -> 1508: kein 282-yd-Kurzschluss (%.0f yd)", d2 or -1))
end
-- 2. Insel
do
  local g = W.Graph(1)
  local comp, sizes = comps(g)
  local big, bc = 0, nil
  for c, s in pairs(sizes) do if s > big then big, bc = s, c end end
  local function pt(k) return { c = 1, x = g.x[k] + 3, y = g.y[k] + 3 } end
  local pk
  for k = 1, g.n do
    if comp[k] ~= bc and sizes[comp[k]] >= 3 then
      local ok = false
      for _, cc in ipairs(W.Near({ c = 1, x = g.x[k], y = g.y[k] })) do if comp[cc[1]] == bc then ok = true end end
      if not ok then pk = k break end
    end
  end
  check(pk ~= nil, "Testaufbau: Knoten auf einem abgetrennten Teilnetz gefunden")
  local P = pt(pk)
  local targets = {}
  for k = 1, g.n, 37 do
    if comp[k] == bc then
      local d = math.sqrt((g.x[k] - P.x) ^ 2 + (g.y[k] - P.y) ^ 2)
      if d > 1500 and d < 6000 then targets[#targets + 1] = pt(k) end
    end
    if #targets >= 14 then break end
  end
  W.Flush()
  local t0 = os.clock()
  for pass = 1, 3 do for _, q in ipairs(targets) do Tm = Tm + 0.1; W.Ground(P, q) end end
  local ms = (os.clock() - t0) * 1000
  print(string.format("   Insel: 3 x %d Ziele in %.1f ms", #targets, ms))
  check(#targets >= 10 and ms < 60, "Spieler auf abgetrenntem Teilnetz: 3 Durchlaeufe unter 60 ms (vorher ~800 ms)")
end
-- 3. Aufzug mit zwei Anschluessen
do
  local g = W.Graph(0)
  check(g.link[6571 * 65536 + 6570] and g.link[6571 * 65536 + 6491], "Aufzug Unterstadt: beide Verbindungen von Knoten 6571 bekannt")
end
-- 4. Flug-Rat nur ueber verbundene Flugpunkte
do
  local NAMES = { [11] = "Undercity, Tirisfal", [13] = "Tarren Mill, Hillsbrad", [17] = "Hammerfall, Arathi",
    [20] = "Grom'gol, Stranglethorn", [18] = "Booty Bay, Stranglethorn", [21] = "Kargath, Badlands", [56] = "Stonard, Swamp of Sorrows" }
  local function mapPos(X, Y) local _, v = C_Map.GetMapPosFromWorldPos(0, { x = X, y = Y }, 1415) return v end
  C_TaxiMap = { GetTaxiNodesForMap = function(m)
    local out = {}
    if m ~= 1415 then return out end
    for id, nm in pairs(NAMES) do local t = LevelPilot_Taxi[0].t[id]
      out[#out + 1] = { nodeID = id, name = nm, position = mapPos(t[1], t[2]), faction = 1 } end
    return out end, GetAllTaxiNodes = function() return {} end }
  dofile("Fly.lua")
  -- Horde: kennt Unterstadt/Tarrens Muehle/Hammerfall und kam per Zeppelin nach Grom'gol/Beutebucht, nie in Kargath/Stonard
  LevelPilotDB = { fp = { [11] = true, [13] = true, [17] = true, [20] = true, [18] = true }, ft = {}, fpSeen = true }
  local known = { [11] = true, [13] = true, [17] = true, [20] = true, [18] = true }
  check(W.FlightTime(0, 20, 17, known) == nil, "Grom'gol -> Hammerfall ueber bekannte Punkte: nicht verbunden")
  local gg = LevelPilot_Taxi[0].t[20]
  local _, pp = C_Map.GetMapPosFromWorldPos(0, { x = gg[1] + 20, y = gg[2] }, 1434)
  PMAP, PX, PY = 1434, pp.x, pp.y
  local hf = LevelPilot_Taxi[0].t[17]
  local _, tp = C_Map.GetMapPosFromWorldPos(0, { x = hf[1] + 300, y = hf[2] + 200 }, 1417)
  local a = LP_Fly.Advice({ map = 1417, x = tp.x, y = tp.y }, "arathi")
  check(not a or a.kind ~= "fly" or a.from ~= "Grom'gol", "kein unmoeglicher Flug Grom'gol -> Hammerfall"
    .. (a and (" (Rat: " .. tostring(a.kind) .. " " .. tostring(a.from) .. " -> " .. tostring(a.to) .. ")") or ""))
end
if fails == 0 then print("TRAVEL2 OK") else print(fails .. " FEHLER"); os.exit(1) end

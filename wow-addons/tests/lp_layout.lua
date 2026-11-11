-- LevelPilot 5: echte Fenster-Vorschau im strengen WoW-Nachbau (Forever-Widget-API) + Layout-Prüfung.
-- Szenario: Stufe 24, Sonnenfels (Steinkrallengebirge), volles Questlog mit Altlasten (Dungeon, grau, fremd).
-- Aufruf: lua5.1 tests/lp_layout.lua [ausgabeordner]   -> Bilder: python3 -I tools/render_pages.py <ordner>
-- Exit 0 = keine Layout-Probleme und keine Lua-Fehler; meldet "LP LAYOUT OK".
local HERE = arg[0]:match("^(.*/)") or "./"
package.path = package.path .. ";" .. HERE .. "?.lua"
local OUT = arg[1]
local ROOT = HERE .. "../addons/LevelPilot/"
local W = require("wow_mock")
local L = require("layout")

W.level, W.faction, W.class = 24, "Horde", "SHAMAN"
W.install({})
local G = _G
G.STANDARD_TEXT_FONT = "Fonts\\FRIZQT__.TTF"
G.UnitXP = function() return 17400 end
G.UnitXPMax = function() return 25600 end
G.GetXPExhaustion = function() return 6200 end
G.UnitOnTaxi = function() return false end
G.UnitAffectingCombat = function() return false end
G.UnitGUID = function() return nil end
G.IsMounted = function() return false end
G.IsSwimming = function() return false end
G.GetUnitSpeed = function() return 0, 7, 7, 4.7 end
G.GetPlayerFacing = function() return 0.6 end
G.GetBindLocation = function() return "Sonnenfels" end
G.GetQuestGreenRange = function() return 7 end
G.GetQuestDifficultyColor = function(l)
  local d = l - W.level
  if d >= 3 then return { r = 1, g = 0.1, b = 0.1 } elseif d >= -2 then return { r = 1, g = 1, b = 0 } elseif d >= -7 then return { r = 0.25, g = 0.75, b = 0.25 } end
  return { r = 0.5, g = 0.5, b = 0.5 }
end
G.PlaySoundFile = function() end
G.hooksecurefunc = function() end
G.strsplit = function(sep, s) local out = {} for p in (s .. sep):gmatch("(.-)" .. sep:gsub("%p", "%%%0")) do out[#out + 1] = p end return unpack(out) end
G.bit = { band = function(a, b) local r, p = 0, 1 while a > 0 and b > 0 do if a % 2 == 1 and b % 2 == 1 then r = r + p end a = math.floor(a / 2) b = math.floor(b / 2) p = p * 2 end return r end }
G.CreateVector2D = function(x, y) return { x = x, y = y, GetXY = function(s) return s.x, s.y end } end

-- Karte: Steinkrallengebirge 1442 (Spieler), Brachland 1413 rechts daneben (Weltversatz)
local OFF = { [1442] = 0, [1413] = 1.2, [1440] = 0.2 }
local PX, PY = 0.462, 0.608 -- Sonnenfels
G.C_Map.GetBestMapForUnit = function() return 1442 end
G.C_Map.GetPlayerMapPosition = function() return G.CreateVector2D(PX, PY) end
G.C_Map.GetMapWorldSize = function() return 3200, 2140 end
G.C_Map.GetMapInfo = function(m) return { name = m == 1442 and "Steinkrallengebirge" or "Brachland", parentMapID = 0 } end
G.C_Map.GetWorldPosFromMapPos = function(m, v) return 1, G.CreateVector2D(v.x + (OFF[m] or 0), v.y) end
G.C_Map.GetMapPosFromWorldPos = function(c, v, m) return m, G.CreateVector2D(v.x - (OFF[m] or 0), v.y) end
G.C_SuperTrack.IsSuperTrackingUserWaypoint = function() return W.waypoint ~= nil end
G.C_SuperTrack.IsSuperTrackingAnything = function() return W.waypoint ~= nil end
G.C_SuperTrack.GetSuperTrackedQuestID = function() return 0 end
G.C_Navigation = { GetFrame = function() return nil end, GetDistance = function() return nil end, WasClampedToScreen = function() return false end }
G.C_TaxiMap = { GetAllTaxiNodes = function() return {} end, GetTaxiNodesForMap = function() return {} end }
G.GetTaxiMapID = function() return nil end
G.C_Container.GetItemCooldown = function() return 0, 0, 1 end
G.GetItemCount = function() return 1 end
G.C_GossipInfo = { GetAvailableQuests = function() return {} end, GetActiveQuests = function() return {} end }

-- Route lesen, damit Questlog/Questie zur echten Route passen
dofile(ROOT .. "Routes/Horde_22_30.lua")
local ROUTE = LevelPilot_Routes.horde_22_30
local SEG, NAME, QL = {}, {}, {}
local firstAcc, lastTin = {}, {}
for i, s in ipairs(ROUTE.steps) do
  if s.q then
    SEG[s.q] = SEG[s.q] or s.seg
    NAME[s.q], QL[s.q] = s.n, s.ql
    if s.t == "accept" and not firstAcc[s.q] then firstAcc[s.q] = i end
    if s.t == "turnin" then lastTin[s.q] = i end
  end
end
LevelPilot_Routes = nil -- die TOC lädt die Routen gleich selbst

-- Stand: alles vor Schritt 72 erledigt; im Log: angenommen < 74, Abgabe >= 74
local CUT = 74
local LOG, DONE, READY, TAG, QLV = {}, {}, {}, {}, {}
for q, ti in pairs(lastTin) do
  local ai = firstAcc[q]
  if ti < 72 then DONE[q] = true
  elseif ai and ai < CUT then LOG[q] = true end
end
READY[6284] = true -- Arachnophobia fertig (Abgabe direkt nebenan)
READY[1069] = true -- Spinneneier fertig, Abgabe erst in Camp Taurajo
-- Altlasten im Log: Dungeon-Quest, graue Quest, fremde Quest weit weg
local EXTRA = {
  [914] = { "Leaders of the Fang", 22, 81 },        -- Höhlen des Wehklagens (Dungeon)
  [848] = { "Fungal Spores", 18 },                  -- grau bei Stufe 24
  [5041] = { "Supplies for the Crossroads", 15 },  -- grau
  [1062] = { "Goblin Invaders", 23 },               -- nicht im Plan
}
for q, e in pairs(EXTRA) do LOG[q] = true NAME[q], QLV[q], TAG[q] = e[1], e[2], e[3] and { tagID = e[3], tagName = "Dungeon" } or nil end
-- Questie-Attrappe: Geber/Abgabe je Abschnitt (3 = Sonnenfels, sonst Brachland)
local AREA = { [406] = 1442, [17] = 1413 }
local function spot(q, k)
  local s = SEG[q]
  if q == 1062 then return 17, { 62, 38 } end
  if q == 914 then return 17, { 46, 36 } end
  if s == 3 then return 406, { 46 + ((q * 7 + k) % 5) - 2, 60 + ((q * 3 + k) % 5) - 2 } end
  return 17, { 52 + (q % 9), 50 + (q % 7) }
end
local function logList() local l = {} for q in pairs(LOG) do l[#l + 1] = q end table.sort(l) return l end
local QLOGAPI = {
  GetQuestsOnMap = function(map)
    local out = {}
    for q in pairs(LOG) do if SEG[q] == 3 and map == 1442 then local _, c = spot(q, 2) out[#out + 1] = { questID = q, x = c[1] / 100, y = c[2] / 100, type = 0 } end end
    table.sort(out, function(x, y) return x.questID < y.questID end)
    return out
  end,
  GetTitleForQuestID = function(id) return NAME[id] end,
  GetLogIndexForQuestID = function(id) if not LOG[id] then return nil end for i, q in ipairs(logList()) do if q == id then return i end end end,
  GetInfo = function(i) local q = logList()[i] return q and { questID = q, title = NAME[q] or ("Quest " .. q), isHeader = false, level = QLV[q] or QL[q] or 24, frequency = 0 } or nil end,
  GetNumQuestLogEntries = function() local n = #logList() return n, n end,
  GetQuestObjectives = function(q)
    if READY[q] then return { { text = "erledigt", finished = true, numFulfilled = 1, numRequired = 1, type = "monster" } } end
    return { { text = "Ziel", finished = false, numFulfilled = 3, numRequired = 8, type = "monster" } }
  end,
  ReadyForTurnIn = function(id) return READY[id] or false end,
  IsComplete = function(id) return READY[id] or false end,
  IsOnQuest = function(id) return LOG[id] or false end,
  IsQuestFlaggedCompleted = function(id) return DONE[id] or false end,
  GetMaxNumQuestsCanAccept = function() return 25 end,
  GetQuestTagInfo = function(q) return TAG[q] end,
  CanAbandonQuest = function(q) return LOG[q] ~= nil end,
  GetNextWaypoint = function() return nil end,
  GetSelectedQuest = function() return 0 end,
  SetSelectedQuest = function() end,
  SetAbandonQuest = function() end,
  RequestLoadQuestByID = function() end,
}
G.C_QuestLog = QLOGAPI
G.GetQuestLogRewardXP = function(q) return ({ [914] = 2450, [1062] = 1650 })[q] or 1350 end
G.QuestMapQuestOptions_AbandonQuest = function(q) W.abandoned = q end

G.QuestieLoader = { ImportModule = function(_, n)
  if n == "QuestieDB" then
    return {
      QueryQuestSingle = function(id, key)
        if key == "startedBy" then return { { id * 10 + 1 } } end
        if key == "finishedBy" then return { { id * 10 + 2 } } end
        if key == "name" then return NAME[id] end
        if key == "questLevel" then return QLV[id] or QL[id] end
        if key == "requiredLevel" then return math.max(1, (QLV[id] or QL[id] or 20) - 5) end
      end,
      QueryNPCSingle = function(id, key)
        local q, k = math.floor(id / 10), id % 10
        if key == "spawns" then local a, c = spot(q, k) return { [a] = { c } } end
        if key == "name" then return (k == 1 and "Geber " or "Abgabe ") .. q end
      end,
      QueryObjectSingle = function() return nil end,
      QueryItemSingle = function() return nil end,
    }
  end
  return { GetUiMapIdByAreaId = function(_, a) return AREA[a] end }
end }

-- Add-on laden (TOC-Reihenfolge)
for line in io.lines(ROOT .. "LevelPilot.toc") do
  if not line:match("^##") and line:match("%S") then
    local f = ROOT .. line:gsub("\\", "/"):gsub("%s+$", "")
    assert(loadfile(f))("LevelPilot", {})
  end
end
local fails = 0
local function bad(msg) print("  FEHLER " .. msg) fails = fails + 1 end
local ok, err = pcall(function()
  W.fire("PLAYER_LOGIN")
  W.now = W.now + 1
  W.fire("QUEST_LOG_UPDATE")
  W.flush()
  -- Einstieg wartet bis Questie + Questlog bereit -> Zeit vorspulen und erneut auswerten
  W.now = W.now + 2
  W.fire("QUEST_LOG_UPDATE")
end)
if not ok then bad("Lua-Fehler: " .. tostring(err)) end
for _, e in ipairs(W.errors) do bad("Fehler-Handler: " .. e) end
for _, p in ipairs(W.prints) do print("  CHAT " .. (p:gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", ""))) end

local M = LevelPilotFrame
-- ein paar Bildtakte laufen lassen (Animationen, Schalter-Daumen, Pfeil) – an alle Ereignis-Rahmen
local EVS = (W.registered and W.registered["PLAYER_LOGIN"]) or {}
local function tick(n) for _ = 1, n or 30 do W.now = W.now + 0.05 for _, f in ipairs(EVS) do W.call(f, "OnUpdate", 0.05) end end end
tick()
local function check(name, root)
  local probs = L.problems(root)
  for _, p in ipairs(probs) do bad("[" .. name .. "] " .. p) end
  if OUT then L.dump(root, OUT .. "/" .. name .. ".tsv") end
  return #probs
end
print("== Hauptfenster (Route, Plan-Band, Lagebild)")
check("lp_main", M)
print("== Questlog-Check")
local ok2, err2 = pcall(SlashCmdList.LEVELPILOT, "log")
if not ok2 then bad("Lua-Fehler /lp log: " .. tostring(err2)) end
if LevelPilotLog then check("lp_log", LevelPilotLog) else bad("Questlog-Panel fehlt") end
print("== Ziel wartet auf Stufe (Held-Karte \"WARTET\")")
if LevelPilotLog then LevelPilotLog:Hide() end
do
  local R = LP_Route
  local orig = R.Plan
  R.Plan = function(...)
    local h, l, info = orig(...)
    if l and l[1] then
      R.state[l[1]] = "later"
      for k = 2, #l do if R.state[l[k]] == "open" then R.state[l[k]] = "later" end end
    end
    return nil, l, info
  end
  local okW, errW = pcall(function() W.now = W.now + 2 W.fire("PLAYER_XP_UPDATE") tick() end)
  if not okW then bad("Lua-Fehler Wartet-Ansicht: " .. tostring(errW)) end
  check("lp_wartet", M)
  R.Plan = orig
  W.now = W.now + 2 W.fire("PLAYER_XP_UPDATE") tick()
end
print("== Questmodus")
LevelPilotLog:Hide()
if LevelPilotDB then
  LevelPilotDB.mode = "quests"
  local ok3, err3 = pcall(function() W.now = W.now + 2 W.fire("QUEST_LOG_UPDATE") tick() end)
  if not ok3 then bad("Lua-Fehler Questmodus: " .. tostring(err3)) end
  check("lp_quests", M)
  LevelPilotDB.mode = "route"
end
print(fails == 0 and "LP LAYOUT OK" or ("FEHLER: " .. fails))
if fails > 0 then os.exit(1) end

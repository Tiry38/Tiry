-- Tiry 11.11. (Screenshot 5.1.7): Stufe 27 bei 88 %, in Donnerfels, Route sagt "Grinden: Needles Cougar" 5,5 km weit.
local ROUTE = arg[1] or "Route.lua"
local Tm, CLOCK = 1000, 1700000000
function GetTime() return Tm end
function time() return CLOCK end
function UnitClass() return "Klasse", "X", 7 end
function UnitOnTaxi() return false end
function UnitFactionGroup() return "Horde" end
bit = { band = function(a, b) local r, p = 0, 1 while a > 0 and b > 0 do if a % 2 == 1 and b % 2 == 1 then r = r + p end a = math.floor(a / 2) b = math.floor(b / 2) p = p * 2 end return r end }
local PX, PY = 0.5, 0.5
C_Map = { GetBestMapForUnit = function() return 9999 end, GetPlayerMapPosition = function() return { x = PX, y = PY } end,
  GetMapWorldSize = function() return 30000, 30000 end, GetMapInfo = function() return { parentMapID = 0 } end,
  GetWorldPosFromMapPos = function(m, v) return 1, v end, GetMapPosFromWorldPos = function(c, v, m) return m, v end }
CreateVector2D = function(x, y) return { x = x, y = y } end
local LOG, READY, DONE = {}, {}, {}
C_QuestLog = { GetQuestsOnMap = function() return {} end, GetTitleForQuestID = function() return nil end,
  GetLogIndexForQuestID = function(id) return LOG[id] and 1 or nil end, GetInfo = function() return nil end,
  GetNumQuestLogEntries = function() return 0, 0 end, GetQuestObjectives = function() return {} end,
  ReadyForTurnIn = function(id) return READY[id] or false end, IsQuestFlaggedCompleted = function(id) return DONE[id] or false end }
dofile(ROUTE) dofile("Routes/Horde_22_30.lua") dofile("Routes/Pool_Horde.lua")
local R = LP_Route
local route = LevelPilot_Routes.horde_22_30
local steps = route.steps
-- Spieler am Freiwindposten (0.5/0.5). Nah: Sacred Fire (5062, Ql 27, Vorquest 4865 aus der Route),
-- 1 km: Gerenzo (1096, Vorquest 1095 fehlt -> nie). Alles andere im Pool weit weg (> 20 km).
-- Erwartet (5.1.8): 1. eine verpasste Route-Quest in der Naehe (Troll Charm 6462) wird Extra-Quest, statt sie zu ignorieren;
-- 2. der Weg zum Grind-Platz zaehlt beim Vergleich mit (weit weg -> Quest gewinnt eher).
local NEAR = { [6462] = { 0.505, 0.5, 0.51, 0.5, 0.5, 0.505 } }
local K = { accept = 1, complete = 3, turnin = 5 }
R.StepTarget = function(s)
  local n = s.q and NEAR[s.q]
  if n then local k = K[s.t] or 1 return { map = 9999, x = n[k], y = n[k + 1] } end
  if s.pool then return { map = 9999, x = 0.02 + (s.q % 97) / 400, y = 0.95 } end
  return { map = 9999, x = 0.1, y = 0.1 }
end
for _, s in ipairs(steps) do if s.q then DONE[s.q] = true end end
DONE[6462] = nil                                                      -- Troll Charm verpasst
R.mem = { acc = {}, done = {}, at = {} } R.ScanLog(true)
function UnitXP() return 34300 end
function UnitXPMax() return 38900 end
local plan = { k = "accept:1110" }

local h = R.Plan(route, 27, {}, plan, 6, nil)
local s = steps[h]
print(string.format("missed route quest: hero %s pool=%s detour %s", R.StepKey(s), tostring(s.pool), tostring(R.info.detour)))
-- 2. Grind-Weg: Quest-Rate knapp unter 0,65 x Grind-Tempo; Grind-Ziel weit weg -> Abstecher, Grind-Ziel nah -> nicht
DONE[6462] = true R.mem = { acc = {}, done = {}, at = {} } R.ScanLog(true)
plan.detour, plan.autoT = nil, nil
local realPB = R.PoolBest
local res = {}
for _, far in ipairs({ true, false }) do
  local old = R.StepTarget
  R.StepTarget = function(st) if st.t == "grind" then return { map = 9999, x = far and 0.95 or 0.501, y = 0.5 } end return old(st) end
  plan.detour, plan.autoT = nil, nil Tm, CLOCK = Tm + 30, CLOCK + 30
  local hh = R.Plan(route, 27, {}, plan, 6, nil)
  res[#res + 1] = (far and "far " or "near ") .. R.StepKey(steps[hh]) .. " detour=" .. tostring(R.info.detour)
  R.StepTarget = old
end
print("grind travel: " .. table.concat(res, " | "))

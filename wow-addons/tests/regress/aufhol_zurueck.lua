-- Tiry 11.11. (Screenshot): Stufe 27 bei 61.8 %, Zeiger schon hinter dem Aufhol-Block (Raketenwagenteile ab 28).
-- Erwartet: liegengebliebene Aufhol-Quests kommen zurueck; sind alle erledigt, zaehlt XPNeed bis 28 (nicht bis 30).
-- Tiry 11.11.: Stufe 27 am Ende von Horde 22-30, naechste Quests (Gehaertete Schalen/Salziges Gift) erst ab 28
-- -> 5.1.0 zeigte "WARTET ab Stufe 28" und Grinden. Erwartet: Aufhol-Quests (fill) kommen dran;
-- mit Stufe 28 sind sie weg und der Plan geht normal weiter. Kontrolle: wer im Plan ist, sieht sie nie.
local ROUTE = arg[1] or "Route.lua"
local Tm, CLOCK = 1000, 1700000000
function GetTime() return Tm end
function time() return CLOCK end
function UnitClass() return "Klasse", "X", 7 end
function UnitOnTaxi() return false end
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
dofile(ROUTE) dofile("Routes/Horde_22_30.lua")
local R = LP_Route
local route = LevelPilot_Routes.horde_22_30
local steps = route.steps
local HUB, nHub = {}, 0
local function hubPos(seg)
  local sd = route.segs[seg]; local key = sd.z .. "|" .. sd.hub
  if not HUB[key] then nHub = nHub + 1; HUB[key] = { x = 0.1 + ((nHub - 1) % 8) * 0.1, y = 0.1 + math.floor((nHub - 1) / 8) * 0.1 } end
  return HUB[key]
end
local function target(s)
  local h = hubPos(s.seg)
  if s.t == "complete" or s.t == "grind" then
    local a = ((s.q or 7) * 2.399) % (2 * math.pi)
    return { map = 9999, x = h.x + 0.02 * math.cos(a), y = h.y + 0.02 * math.sin(a) }
  end
  local j = ((s.q or s.npc or 3) % 7) * 0.0003
  return { map = 9999, x = h.x + j, y = h.y - j }
end
R.StepTarget = function(s) return target(s) end
local inRoute = {}
for _, s in ipairs(steps) do if s.q then inRoute[s.q] = true end end
for _, s in ipairs(steps) do for _, p in ipairs(s.pre or {}) do if not inRoute[p] then DONE[p] = true end end
  for _, p in ipairs(s.pres or {}) do if not inRoute[p] then DONE[p] = true end end end
R.mem = { acc = {}, done = {}, at = {} } R.ScanLog(true)

XPCUR, XPMAX = 24000, 38900
function UnitXP() return XPCUR end
function UnitXPMax() return XPMAX end
local function run(extra)
  for k in pairs(DONE) do DONE[k] = nil end
  for _, s in ipairs(steps) do for _, p in ipairs(s.pres or {}) do if not inRoute[p] then DONE[p] = true end end end
  local f1 = 1 while steps[f1] and not steps[f1].fill do f1 = f1 + 1 end   -- erster Aufhol-Schritt
  for i = 1, f1 - 1 do local s = steps[i] if s.q then DONE[s.q] = true end end
  DONE[4904] = true
  for _, q in ipairs(extra) do DONE[q] = true end
  R.mem = { acc = {}, done = {}, at = {} } R.ScanLog(true)
  local plan = { k = "accept:1110" }
  local h = R.Plan(route, 27, {}, plan, 6, nil)
  return h, plan
end
local h, plan = run({})
print(string.format("past block: pointer %s hero %s back %s", plan.k, R.StepKey(steps[h]), tostring(R.info.back)))
h, plan = run({ 5151, 4966, 4770 })
print(string.format("all done: pointer %s hero %s need28 %d", plan.k, R.StepKey(steps[h]), R.XPNeed(27, 28)))
local _, l = R.Plan(route, 27, {}, plan, 6, nil)
local ks = {} for k = 1, math.min(3, #l) do ks[#ks + 1] = R.StepKey(steps[l[k]]) .. "=" .. tostring(R.state[l[k]]) end
print("list: " .. table.concat(ks, " "))

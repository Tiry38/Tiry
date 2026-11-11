-- LevelPilot 5: Plan-Engine (fester Zeiger), Einstieg, Sprung, Questlog-Check, Auto-Annehmen, UI-Pfade
-- Aufruf: cd addons/LevelPilot && lua5.1 ../../tests/plan.lua   (meldet "PLAN TESTS OK", Exit 0)
local Tm, CLOCK = 1000, 1700000000
function GetTime() return Tm end
function time() return CLOCK end
local Obj = {} Obj.__index = function(t, k)
  if type(k) == "string" and k:sub(1, 2) == "__" then return nil end
  if k == "GetWidth" then return function() return 280 end end
  if k == "GetFrameLevel" then return function() return 2 end end
  if k == "GetCenter" then return function() return 400, 300 end end
  if k == "GetEffectiveScale" then return function() return 1 end end
  if k == "GetHeight" then return function() return 30 end end
  if k == "GetText" then return function(s) return rawget(s, "txt") or "" end end
  if k == "IsShown" or k == "IsVisible" then return function(s) return rawget(s, "shown") ~= false end end
  if k == "Show" then return function(s) rawset(s, "shown", true) end end
  if k == "Hide" then return function(s) rawset(s, "shown", false) end end
  if k == "SetShown" then return function(s, v) rawset(s, "shown", v and true or false) end end
  if k == "SetText" then return function(s, v) rawset(s, "txt", v) end end
  if k == "SetScript" then return function(s, n, f) rawset(s, "_" .. n, f) end end
  if k == "GetPoint" then return function() return "CENTER", nil, "CENTER", 0, 0 end end
  if k == "CreateTexture" or k == "CreateFontString" then return function() return setmetatable({}, Obj) end end
  return function() end
end
local frames = {}
function CreateFrame(t, n) local f = setmetatable({}, Obj) frames[#frames + 1] = f if n then _G[n] = f end return f end
UIParent = CreateFrame() STANDARD_TEXT_FONT = "x" GameTooltip = CreateFrame() UISpecialFrames = {}
function tinsert(t, v) table.insert(t, v) end
local chat = {}
DEFAULT_CHAT_FRAME = { AddMessage = function(_, m) chat[#chat + 1] = (m:gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", "")) end }
SlashCmdList = {} function wipe(t) for k in pairs(t) do t[k] = nil end return t end
bit = { band = function(a, b) local r, p = 0, 1 while a > 0 and b > 0 do if a % 2 == 1 and b % 2 == 1 then r = r + p end a = math.floor(a / 2) b = math.floor(b / 2) p = p * 2 end return r end }
local LVL = 24
function UnitXP() return 15000 end function UnitXPMax() return 27300 end function GetXPExhaustion() return 0 end function UnitLevel() return LVL end
function UnitFactionGroup() return "Horde", "Horde" end function UnitClass() return "Schamane", "SHAMAN", 7 end
local TAXI = false
function UnitOnTaxi() return TAXI end function UnitAffectingCombat() return false end
local PX, PY = 0.20, 0.20
C_Map = { GetBestMapForUnit = function() return 1440 end, GetPlayerMapPosition = function() return { x = PX, y = PY } end,
  GetMapWorldSize = function() return 3000, 2000 end, GetMapInfo = function() return { parentMapID = 0 } end,
  GetWorldPosFromMapPos = function(m, v) return 1, v end, GetMapPosFromWorldPos = function(c, v, m) return m, v end }
CreateVector2D = function(x, y) return { x = x, y = y } end
function GetPlayerFacing() return 0 end
-- Questlog
local LOG, READY, DONE, QLVL, XP, TAG = {}, {}, {}, {}, {}, {}
local MAXQ = 25
local function logList() local l = {} for q in pairs(LOG) do l[#l + 1] = q end table.sort(l) return l end
local abandoned = {}
C_QuestLog = { GetQuestsOnMap = function() return {} end, GetTitleForQuestID = function(id) return "Q" .. id end,
  GetLogIndexForQuestID = function(id) return nil end,
  GetInfo = function(i) local l = logList() local q = l[i] return q and { questID = q, title = "Q" .. q, isHeader = false, level = QLVL[q] or 24 } or nil end,
  GetNumQuestLogEntries = function() local n = #logList() return n, n end,
  GetQuestObjectives = function(q) return {} end, ReadyForTurnIn = function(id) return READY[id] or false end,
  IsQuestFlaggedCompleted = function(id) return DONE[id] or false end,
  GetMaxNumQuestsCanAccept = function() return MAXQ end,
  GetQuestTagInfo = function(q) return TAG[q] end,
  CanAbandonQuest = function(q) return LOG[q] ~= nil end }
function GetQuestLogRewardXP(q) return XP[q] or 1000 end
function QuestMapQuestOptions_AbandonQuest(q) abandoned[#abandoned + 1] = q end
function GetQuestDifficultyColor() return { r = 1, g = 1, b = 1 } end
function GetQuestGreenRange() return 7 end
function IsShiftKeyDown() return false end function PlaySound() end function PlaySoundFile() end
-- Questie-Attrappe (Prozent-Koordinaten auf Karte 1440)
local NPC = {
  [701] = { 20, 20 }, [702] = { 70, 30 }, [703] = { 10, 80 }, [900] = { 70, 30 },
  [801] = { 25, 25 }, [802] = { 15, 28 }, [803] = { 22, 30 }, [804] = { 72, 35 }, [805] = { 66, 36 },
  [806] = { 14, 76 }, [807] = { 12, 85 }, [808] = { 8, 74 }, [709] = { 11, 81 }, [710] = { 90, 10 }, [711] = { 50, 50 },
}
local GIVER = { [201] = 701, [202] = 701, [203] = 701, [204] = 701, [301] = 702, [302] = 702, [6462] = 703, [216] = 703, [401] = 703,
  [996] = 709, [995] = 710, [999] = 711, [998] = 711, [997] = 711, [501] = 701 }
local QOBJ = { [201] = 801, [202] = 802, [204] = 803, [301] = 804, [302] = 805, [6462] = 806, [216] = 807, [401] = 808, [999] = 711 }
QuestieLoader = { ImportModule = function(_, n)
  if n == "QuestieDB" then return {
    QueryQuestSingle = function(id, k)
      if k == "startedBy" or k == "finishedBy" then return { { GIVER[id] or 711 } } end
      if k == "name" then return "Q" .. id end
      if k == "objectives" then return QOBJ[id] and { { { QOBJ[id] } } } or {} end
      if k == "requiredClasses" then return id == 501 and 64 or 0 end
    end,
    QueryNPCSingle = function(id, k)
      if k == "spawns" then local p = NPC[id]; if not p then return nil end return { [331] = { p } } end
      if k == "name" then return "NPC" .. id end
    end,
    QueryItemSingle = function() return nil end,
  } end
  return { GetUiMapIdByAreaId = function(_, a) return 1440 end }
end }
dofile("Route.lua") dofile("Fly.lua")
local function S(t, q, seg, l, extra)
  local s = { t = t, q = q, seg = seg, l = l or 22, z = "Test", ql = 22, n = q and ("Q" .. q) or nil }
  for k, v in pairs(extra or {}) do s[k] = v end
  return s
end
LevelPilot_Routes = { test = { name = "Test-Plan", faction = "Horde", min = 1, max = 99, xpm = 300,
  segs = { { z = "Brachland", hub = "Hub A", l0 = 22, l1 = 23 }, { z = "Eschental", hub = "Splitterholz", l0 = 24, l1 = 26 }, { z = "Eschental", hub = "Grind", l0 = 26, l1 = 30 } },
  steps = {
    S("accept", 201, 1), S("accept", 202, 1), S("complete", 201, 1), S("complete", 202, 1), S("turnin", 201, 1), S("turnin", 202, 1),
    S("accept", 203, 1, 23, { rl = 25, ql = 25 }), S("accept", 204, 1, 23), S("complete", 204, 1, 23), S("turnin", 204, 1, 23),
    { t = "fly", l = 24, z = "Eschental", seg = 2, npc = 900, to = "Splitterholz" },
    S("accept", 301, 2, 24), S("accept", 302, 2, 24), S("complete", 301, 2, 24), S("complete", 302, 2, 24), S("turnin", 301, 2, 24), S("turnin", 302, 2, 24),
    { t = "go", l = 25, z = "Eschental", seg = 2, map = 1440, x = 0.10, y = 0.80, to = "Zoram'gar" },
    S("accept", 6462, 2, 25), S("accept", 216, 2, 25), S("accept", 401, 2, 25), S("complete", 6462, 2, 25), S("complete", 216, 2, 25), S("complete", 401, 2, 25),
    S("turnin", 6462, 2, 26), S("turnin", 216, 2, 26), S("turnin", 401, 2, 26),
    { t = "grind", l = 26, z = "Eschental", seg = 3, to = 30, n = "Grinden" },
  } } }
local route = LevelPilot_Routes.test
local R = LP_Route
local fails = 0
local function check(name, cond) print((cond and "  ok   " or "  FAIL ") .. name) if not cond then fails = fails + 1 end end
local function reset() LOG, READY, DONE = {}, {}, {} R.mem = { acc = {}, done = {}, at = {} } R.ScanLog(true) end
local function plan(p, lvl) return R.Plan(route, lvl or LVL, {}, p, 6, nil) end

print("== A: Einstieg")
reset() PX, PY = 0.40, 0.55
local P1 = {}
local h, list, info = plan(P1, 22)
check("ohne Log, Stufe 22: Einstieg bei Schritt 1 (Stufe)", h == 1 and info.entry == "stufe" and P1.k == "accept:201")
reset() PX, PY = 0.10, 0.80
LOG = { [201] = true, [6462] = true, [216] = true } R.ScanLog(true)
local P2 = {}
h, list, info = plan(P2)
check("in Zoram'gar mit Zoram'gar-Quests: Einstieg dort (Schritt 21), Grund 'hier'", h == 21 and info.entry == "hier")
check("alte Quest 201 dahinter -> Erledigen-Schritt 3 'verpasst'", R.state[3] == "missed")
reset() PX, PY = 0.40, 0.55
LOG = { [6462] = true } R.ScanLog(true)
local P3 = {}
h, list, info = plan(P3)
check("weit weg, aber Quest im Log: Einstieg am Log (Schritt 20)", h == 20 and info.entry == "log")
reset() PX, PY = 0.40, 0.55
R.OnTurnedIn(301) R.OnAccepted(6462) LOG = { [6462] = true } R.ScanLog(true)
local P3b = {}
h, list, info = plan(P3b)
check("frische Spur: zuletzt angenommen 6462 -> Einstieg dort", h == 20 and info.entry == "frisch")
-- Abgabe weit hinten im Plan, deren NPC zufaellig hier steht, darf den Einstieg nicht nach vorn ziehen
reset() PX, PY = 0.20, 0.20
LOG = { [204] = true, [6462] = true } R.ScanLog(true)
local origT = R.StepTarget
R.StepTarget = function(s) if s.t == "turnin" and s.q == 6462 then return { map = 1440, x = 0.21, y = 0.21 } end return origT(s) end
local P3c = {}
h, list, info = plan(P3c)
check("Hub A, Quest 204 von hier + spaete Abgabe 6462 nebenan: Einstieg bei 204 (Schritt 9), nicht bei der Abgabe (25)", h == 9 and info.entry == "hier")
reset() PX, PY = 0.20, 0.20
LOG = { [6462] = true } R.ScanLog(true)
local P3d = {}
h, list, info = plan(P3d)
check("nur eine Abgabe hier: Einstieg am Anfang ihres Abschnitts (11..25)", h >= 11 and h <= 25 and info.entry == "hier")
R.StepTarget = origT

print("== B: fester Plan, nur vorwaerts")
reset() PX, PY = 0.20, 0.20
LOG = { [201] = true, [202] = true } R.ScanLog(true)
local P4 = { k = "complete:201", i = 3 }
h = plan(P4)
check("Zeiger auf Erledigen 201", h == 3)
local orig = R.StepDist
R.StepDist = function(s) return (s.q == 202) and 5 or 500 end
h = plan(P4)
check("202 liegt naeher -> Ziel bleibt trotzdem 201 (keine Umsortierung)", h == 3)
R.StepDist = orig
READY[202] = true
h = plan(P4)
check("202 nebenbei fertig -> Ziel bleibt 201, Schritt 4 erledigt", h == 3 and R.state[4] == "done")
READY[201] = true
h = plan(P4)
check("201 fertig -> naechster Plan-Schritt: Abgabe 201 (5)", h == 5 and P4.i == 5)
READY[201] = nil
LOG[201] = nil DONE[201] = true R.ScanLog(true)
h = plan(P4)
check("abgegeben -> weiter zu Abgabe 202 (6), nie zurueck", h == 6)

-- geplante Folge-Schritte: Erledigen/Abgeben einer Quest, die gleich erst angenommen wird, steht in der Liste
reset() PX, PY = 0.70, 0.30
DONE = { [201] = true, [202] = true, [203] = true, [204] = true } R.ScanLog(true)
local P4b = { k = "accept:301", i = 12 }
local h4, l4 = plan(P4b, 24)
local has14 = false
for _, i in ipairs(l4) do if i == 14 then has14 = true end end
check("Ziel Annehmen 301 (12); Liste zeigt 'Erledigen 301' (14) als geplant", h4 == 12 and has14 and R.state[14] == "planned")
check("geplanter Schritt bremst den Zeiger nicht und ist kein Ziel", P4b.i == 12)
PX, PY = 0.20, 0.20

print("== C: Stufe fehlt -> Schritt wartet im Abschnitt, dann vorbei")
reset() DONE = { [201] = true, [202] = true } R.ScanLog(true)
local P5 = { k = "accept:203", i = 7 }
h, list = plan(P5, 23)
check("Annehmen 203 braucht St. 25: Ziel = 204 (8), 203 wartet in der Liste", h == 8 and R.state[7] == "later" and P5.i == 7)
local hasLater = false for _, i in ipairs(list) do if i == 7 then hasLater = true end end
check("wartender Schritt steht in der Liste", hasLater)
DONE[204] = true R.ScanLog(true)
h = plan(P5, 23)
check("Abschnitt fertig -> Zeiger geht vorbei (203 verpasst), Ziel Flug (11)", h == 11 and R.state[7] == "missed")

print("== D: Sprung mit, wenn du nachweislich weiter bist (Tirys Fall)")
reset() PX, PY = 0.10, 0.80
DONE = { [201] = true, [202] = true, [204] = true }
LOG = { [301] = true, [302] = true, [6462] = true, [216] = true } R.ScanLog(true)
local P6 = { k = "complete:301", i = 14, since = CLOCK - 600 }
h, list, info = plan(P6)
check("erster Blick: noch kein Sprung (Wartezeit 3 s)", h == 14 and not info.jumped)
Tm = Tm + 4
h, list, info = plan(P6)
check("nach 3 s: Sprung von 14 auf 21", h == 21 and info.jumped and info.jumped.from == 14 and info.jumped.to == 21)
check("4 offene Schritte dazwischen gezaehlt", info.jumped and info.jumped.n == 4)
check("Splitterholz-Abgaben jetzt 'verpasst'", R.state[16] == "missed" and R.state[17] == "missed")
check("Sprung ist gemerkt (fuer /lp zurueck)", #P6.hist == 1 and P6.hist[1].i == 14)
-- im Vorbeifliegen kein Sprung
reset() PX, PY = 0.10, 0.80
LOG = { [301] = true, [302] = true, [6462] = true } R.ScanLog(true) DONE = { [201] = true, [202] = true, [204] = true }
local P7 = { k = "complete:301", i = 14 }
TAXI = true plan(P7) Tm = Tm + 5 h = plan(P7) TAXI = false
check("auf dem Flug: kein Sprung", h == 14)
-- Plan-Ziel nah -> kein Sprung, auch wenn spaetere Quests im Log sind
PX, PY = 0.71, 0.33
plan(P7) Tm = Tm + 5 h = plan(P7)
check("am Plan-Ziel: kein Sprung", h == 14)
-- Haltezeit nach /lp zurueck
PX, PY = 0.10, 0.80
P7.hold = CLOCK + 1800
plan(P7) Tm = Tm + 5 h = plan(P7)
check("nach Rueckgaengig: 30 min kein automatischer Sprung", h == 14)

print("== E: Questlog-Check")
reset() PX, PY = 0.10, 0.80
DONE = { [201] = true, [204] = true }
LOG = { [202] = true, [6462] = true, [216] = true, [501] = true, [999] = true, [998] = true, [997] = true, [996] = true, [995] = true }
READY = { [996] = true, [995] = true }
QLVL = { [998] = 14 } TAG = { [997] = { tagID = 1, tagName = "Gruppe" } } XP = { [995] = 400, [996] = 900 }
R.ScanLog(true)
local P8 = { k = "accept:401", i = 21 }
h = plan(P8)
local A = R.LogAdvice(route, "test", LVL, P8.i, h, { xpm = 300 })
local cat = {} for _, e in ipairs(A.list) do cat[e.q] = e end
check("Zoram'gar-Quests behalten (im Plan)", cat[6462].cat == "keep" and cat[216].cat == "keep" and cat[6462].step == 22)
check("alte Quest 202 (Ziel weit weg, Teil uebersprungen) -> loeschen", cat[202].cat == "delete" and cat[202].why:find("übersprungen"))
check("Klassenquest behalten", cat[501].cat == "keep" and cat[501].why == "Klassenquest")
check("nicht im Plan -> loeschen", cat[999].cat == "delete" and cat[999].why == "nicht im Plan")
check("graue Quest -> loeschen", cat[998].cat == "delete" and cat[998].why:find("grau"))
check("Gruppenquest -> pruefen", cat[997].cat == "check")
check("fertig, Abgabe ganz nah -> abgeben", cat[996].cat == "turnin")
check("fertig, Abgabe weit, wenig XP -> loeschen", cat[995].cat == "delete" and cat[995].why:find("weit"))
check("Zaehler: 9 belegt, 4 loeschen, 1 abgeben, 1 pruefen, 3 behalten", A.used == 9 and A.del == 4 and A.tin == 1 and A.chk == 1 and A.keep == 3)
check("Reihenfolge: Loeschen zuerst", A.list[1].cat == "delete" and A.list[#A.list].cat == "keep")
XP[995] = 30000
A = R.LogAdvice(route, "test", LVL, P8.i, h, { xpm = 300 })
for _, e in ipairs(A.list) do cat[e.q] = e end
check("fertig, Abgabe weit, aber viel XP -> Umweg lohnt (abgeben)", cat[995].cat == "turnin" and cat[995].why:find("lohnt"))
-- Platzbedarf
MAXQ = 3
reset() PX, PY = 0.70, 0.30 DONE = { [201] = true, [202] = true, [204] = true } LOG = { [501] = true, [6462] = true } R.ScanLog(true)
local P9 = { k = "accept:301", i = 12 }
h = plan(P9)
A = R.LogAdvice(route, "test", LVL, P9.i, h, {})
check("Log wird voll: 2 belegt + 301, 302, 216, 401 vor den Abgaben -> Spitze ueber 3", A.full and A.peak > 3 and A.peakAt ~= nil)
MAXQ = 25
-- Loeschen-Knopf -> Blizzard-Dialog
LOG[999] = true
local ok = R.Abandon(999)
check("Loeschen oeffnet Blizzards Abbrechen-Dialog", ok and abandoned[#abandoned] == 999)
LOG[999] = nil
local ok2 = R.Abandon(12345)
check("nicht abbrechbare Quest -> kein Dialog", not ok2 and abandoned[#abandoned] == 999)

print("== F: Auto-Annehmen nur, was bald dran ist")
reset() DONE = { [201] = true, [202] = true, [204] = true } R.ScanLog(true)
local P10 = { k = "accept:301", i = 12 }
plan(P10)
R.WANT_SPAN = 10
check("Quest am Zeiger (301) -> annehmen", R.Wants(route, 301, P10.i))
check("Quest weit voraus (401, Schritt 21 > 12+10)", not R.Wants(route, 401, 9) )
check("Quest hinter dem Zeiger (201) -> nicht annehmen", not R.Wants(route, 201, P10.i))
R.WANT_SPAN = 60

print("== G: Fenster (LevelPilot.lua): Band, Einstieg-Meldung, Sprung, zurueck, Log-Panel")
reset() PX, PY = 0.10, 0.80
DONE = { [201] = true, [202] = true, [204] = true }
LOG = { [301] = true, [302] = true, [6462] = true, [216] = true }
dofile("LevelPilot.lua")
local E for _, f in ipairs(frames) do if rawget(f, "_OnEvent") and rawget(f, "_OnUpdate") then E = f end end
E._OnEvent(E, "PLAYER_LOGIN")
LevelPilotDB.route = "test"
local function tick(n, dt) for i = 1, (n or 1) do Tm = Tm + (dt or 0.25) E._OnUpdate(E, dt or 0.25) end end
tick(4)
check("vor dem ersten Questlog-Lesen: kein Einstieg (wartet)", next(LevelPilotDB.plan.test or {}) == nil or LevelPilotDB.plan.test.k == nil)
E._OnEvent(E, "QUEST_LOG_UPDATE") tick(1)   -- gebuendelt: Refresh folgt im naechsten Frame
local function chatHas(p) for _, m in ipairs(chat) do if m:find(p) then return true end end return false end
check("Einstieg erkannt und gemeldet", chatHas("Einstieg bei Schritt 21"))
check("Plan gespeichert", LevelPilotDB.plan.test.k == "accept:401")
-- Zeiger von Hand zurueck auf Splitterholz -> Sprung kommt (nach Haltezeit) wieder
SlashCmdList.LEVELPILOT("schritt 14")
check("/lp schritt 14 setzt den Zeiger", LevelPilotDB.plan.test.i == 14)
CLOCK = CLOCK + 2000 tick(20)
check("nach Haltezeit: Plan springt wieder mit (Meldung)", chatHas("Sprung von Schritt 14 auf 21"))
SlashCmdList.LEVELPILOT("zurueck")
tick(20)
check("/lp zurueck: Zeiger wieder 14 und bleibt", LevelPilotDB.plan.test.i == 14)
SlashCmdList.LEVELPILOT("einstieg") tick(2)
check("/lp einstieg: neu erkannt (21)", LevelPilotDB.plan.test.i == 21)
SlashCmdList.LEVELPILOT("log")
check("Log-Panel offen", LevelPilotLog and LevelPilotLog:IsShown())
SlashCmdList.LEVELPILOT("plan")
check("/lp plan meldet Schritt", chatHas("Schritt 21 von 28"))
LevelPilotDB.mode = "quests" tick(5) LevelPilotDB.mode = "route" tick(5)
check("Moduswechsel ohne Fehler", true)
-- Prüfer-Funde 5.0.1 (Fenster/Ereignisse)
SlashCmdList.LEVELPILOT("schritt 14") tick(1)
SlashCmdList.LEVELPILOT("einstieg") tick(2)
check("/lp einstieg (auch Klick aufs Band) neu erkannt", LevelPilotDB.plan.test.i == 21)
SlashCmdList.LEVELPILOT("zurueck") tick(1)
check("/lp einstieg ist umkehrbar: /lp zurueck holt Schritt 14", LevelPilotDB.plan.test.i == 14)
SlashCmdList.LEVELPILOT("speed") SlashCmdList.LEVELPILOT("gruen 8")
SlashCmdList.LEVELPILOT("reset") tick(1)
check("/lp reset: Plan-Engine im Gleichschritt (Speed + Grau-Grenze)",
  R.speed == LevelPilotDB.speed and R.maxDiff == LevelPilotDB.maxDiff and not LevelPilotDB.maxDiffUser)
local hearthN, origH = 0, R.OnHearth
R.OnHearth = function() hearthN = hearthN + 1 end
E._OnEvent(E, "UNIT_SPELLCAST_SUCCEEDED", "player", "Cast-1-2-3", 8690)
R.OnHearth = origH
check("Ruhestein-Zauber wird erkannt (unit, castGUID, spellID)", hearthN == 1)
LevelPilotDB.skipLog = { { r = "andere", k = "accept:1", t = 1 }, { r = "test", k = "accept:2", t = 2 } }
SlashCmdList.LEVELPILOT("neu") tick(2)
check("/lp neu: Rücknahme-Liste anderer Routen bleibt", #LevelPilotDB.skipLog == 1 and LevelPilotDB.skipLog[1].r == "andere")
LevelPilotDB.mode = "quests" tick(2)
if LevelPilotLog:IsShown() then SlashCmdList.LEVELPILOT("log") end
SlashCmdList.LEVELPILOT("log") tick(12, 0.25)
LOG[998] = true R.ScanLog(true) E._OnEvent(E, "QUEST_LOG_UPDATE") tick(12, 0.25)
check("Questlog-Check im Quest-Modus aktualisiert sich (5 Quests)", (LevelPilotLog.num:GetText() or ""):find("ffffff5|r", 1, true) ~= nil)
LOG[998] = nil R.ScanLog(true)
LevelPilotDB.mode = "route" tick(2)
-- Questlog-Ereignisse im Schwall: hoechstens ein Neuaufbau je 0,2 s
local nPlan, origPlan = 0, R.Plan
R.Plan = function(...) nPlan = nPlan + 1 return origPlan(...) end
for _ = 1, 20 do E._OnEvent(E, "QUEST_LOG_UPDATE") end
tick(1, 0.25)
R.Plan = origPlan
check("20 Questlog-Ereignisse am Stück -> 1 Neuaufbau (gebündelt, vorher 20)", nPlan == 1)

print("== I: Prüfer-Funde 5.0.1 (Plan-Engine)")
-- I1: im Hub spaetere Hub-Quest mit angenommen (Auto-Annehmen), Questziele weit weg -> KEIN Sprung
GIVER[611], GIVER[612], GIVER[613] = 701, 701, 701
QOBJ[611], QOBJ[612], QOBJ[613] = 710, 710, 711
local hub = { name = "Hub", faction = "Horde", min = 1, max = 99, steps = {
  S("accept", 611, 1), S("accept", 612, 1), S("complete", 611, 1), S("complete", 612, 1),
  S("turnin", 611, 1), S("turnin", 612, 1), S("accept", 613, 1), S("complete", 613, 1), S("turnin", 613, 1) } }
reset() PX, PY = 0.20, 0.20
LOG = { [611] = true, [612] = true, [613] = true } R.ScanLog(true)
local PH = { k = "complete:611", i = 3 }
R.Plan(hub, 24, {}, PH, 6, nil) Tm = Tm + 4
h, list, info = R.Plan(hub, 24, {}, PH, 6, nil)
check("im Hub mit spaeterer Hub-Quest im Log: kein Sprung (Zeiger bleibt 3)", PH.i == 3 and not info.jumped and R.state[3] == "open")
local adv = R.LogAdvice(hub, "hub", 24, PH.i, h, {})
local delN = 0 for _, e in ipairs(adv.list) do if e.cat == "delete" then delN = delN + 1 end end
check("Questlog-Check rät dort nichts zum Löschen", delN == 0)
-- I1b: Plan-Ziel ohne Koordinaten -> kein Sprung (weit weg ist nicht beurteilbar); eigene Quests (kein Cache)
GIVER[641], GIVER[642], GIVER[643] = 701, 701, 711
QOBJ[641], QOBJ[642], QOBJ[643] = nil, 710, 711
local hubB = { name = "HubB", faction = "Horde", min = 1, max = 99, steps = {
  S("accept", 641, 1), S("accept", 642, 1), S("complete", 641, 1), S("complete", 642, 1),
  S("turnin", 641, 1, 22, { npc = -1 }), S("turnin", 642, 1), S("accept", 643, 1), S("complete", 643, 1), S("turnin", 643, 1) } }
reset() PX, PY = 0.50, 0.50
LOG = { [641] = true, [642] = true, [643] = true } R.ScanLog(true)
check("Testaufbau: Plan-Ziel (complete:641) hat keine Koordinaten", R.StepTarget(hubB.steps[3]) == nil)
local PH2 = { k = "complete:641", i = 3 }
R.Plan(hubB, 24, {}, PH2, 6, nil) Tm = Tm + 4
h, list, info = R.Plan(hubB, 24, {}, PH2, 6, nil)
check("Ziel ohne Koordinaten: kein Sprung", PH2.i == 3 and not info.jumped)
-- I3: Abgabe ohne Questziel-Daten: Pfeilziel bleibt bei jedem Aufruf erhalten (Cache)
GIVER[651] = 701
local tin = S("turnin", 651, 1)
LOG[651] = true R.ScanLog(true)
local g1 = R.GoalTarget(tin) local g2 = R.GoalTarget(tin)
check("GoalTarget liefert auch beim 2. Aufruf (Cache) ein Ziel", g1 ~= nil and g2 ~= nil)
-- I2: Zeiger auf einer verpassten Abgabe klebt nicht fest
GIVER[621], GIVER[622], GIVER[623] = 701, 701, 701
QOBJ[621], QOBJ[622], QOBJ[623] = 801, 801, 801
local r2 = { name = "R2", faction = "Horde", min = 1, max = 99, steps = {
  S("accept", 621, 1), S("complete", 621, 1), S("accept", 622, 1), S("turnin", 621, 1), S("complete", 622, 1), S("turnin", 622, 1),
  S("accept", 623, 1), S("complete", 623, 1), S("turnin", 623, 1) } }
reset() PX, PY = 0.20, 0.20
LOG = { [621] = true, [622] = true } R.ScanLog(true)
local P2 = { k = "turnin:621", i = 4, hold = CLOCK + 1800 }
h = R.Plan(r2, 24, {}, P2, 6, nil)
check("verpasste Abgabe: Zeiger laeuft weiter auf 5 (complete:622)", P2.i == 5 and P2.k == "complete:622" and h == 5)
-- I4: Einstieg im Hub beim 1. Besuch, eine Quest vom 2. Besuch (gleicher Hub) schon im Log
GIVER[631], GIVER[632], GIVER[633], GIVER[635] = 701, 701, 702, 701
local r4 = { name = "R4", faction = "Horde", min = 1, max = 99, steps = {
  S("accept", 631, 1, 22), S("accept", 632, 1, 22), S("complete", 631, 1, 22), S("complete", 632, 1, 22), S("turnin", 631, 1, 22), S("turnin", 632, 1, 22),
  S("accept", 633, 2, 24), S("complete", 633, 2, 24), S("turnin", 633, 2, 24),
  S("accept", 635, 3, 28), S("complete", 635, 3, 28), S("turnin", 635, 3, 28) } }
reset() PX, PY = 0.20, 0.20
LOG = { [631] = true, [635] = true } R.ScanLog(true)
local P4r = {}
h, list, info = R.Plan(r4, 23, {}, P4r, 6, nil)
check("Einstieg beim 1. Hub-Besuch (Schritt 2), nicht beim 2. (10)", P4r.i == 2 and R.state[2] == "open" and info.entry == "hier")
-- I5: Quest aus einer FRUEHEREN Route ist nicht "spaeter im Plan"
reset() LOG = { [201] = true } R.ScanLog(true)
local cur = { name = "Spaeter", faction = "Horde", min = 30, max = 40, steps = { S("accept", 699, 1), S("turnin", 699, 1) } }
adv = R.LogAdvice(cur, "spaeter", 24, 1, nil, {})
check("fruehere Route: löschen mit Grund", adv.list[1] and adv.list[1].cat == "delete" and adv.list[1].why:find("vorigen Route"))
-- I6: Beweis-Wartezeit startet nach Flug/Haltezeit neu
reset() PX, PY = 0.10, 0.80
DONE = { [201] = true, [202] = true, [204] = true }
LOG = { [301] = true, [302] = true, [6462] = true, [216] = true } R.ScanLog(true)
local P8 = { k = "complete:301", i = 14 }
plan(P8) TAXI = true Tm = Tm + 120 plan(P8) TAXI = false
h, list, info = plan(P8)
check("erster Tick nach der Landung: noch kein Sprung", h == 14 and not info.jumped)
Tm = Tm + 4 h, list, info = plan(P8)
check("3 s nach der Landung: Sprung", h == 21 and info.jumped)
-- I7: fehlende Vorquest -> "skip", nicht "wartet auf Stufe"
local sp = S("accept", 874, 1, 22, { rl = 25, pre = { 913 } })
check("Vorquest fehlt, Stufe auch: skip (nicht later)", R.StepDone(sp, 23) == "skip")

print("== H: Rechenzeit auf der echten Route (199 Schritte)")
dofile("Routes/Horde_22_30.lua")
local real = LevelPilot_Routes.horde_22_30
reset()
local P11 = {}
local t0 = os.clock()
for k = 1, 200 do R.Plan(real, 24, {}, P11, 6, nil) end
local ms = (os.clock() - t0) / 200 * 1000
print(string.format("   R.Plan: %.2f ms je Aufruf", ms))
check("unter 3 ms je Aufruf (ohne Questie-Daten)", ms < 3)
local t1 = os.clock()
for k = 1, 50 do R.LogAdvice(real, "horde_22_30", 24, P11.i, nil, {}) end
check("Questlog-Check unter 3 ms", (os.clock() - t1) / 50 * 1000 < 3)

print(fails == 0 and "PLAN TESTS OK" or ("FEHLER: " .. fails))
if fails > 0 then os.exit(1) end

-- LevelPilot 7: RXP-Modus im strengen Forever-Nachbau mit nachgebautem RestedXP (nur die Schnittstellen,
-- die LevelPilot nutzt: RXP.currentGuide, RXPFrame.CurrentStepFrame.framePool, activeWaypoints, arrowFrame, SetStep).
-- Durchlauf eines Guides: Annehmen -> Grind (uebersprungen) -> Erledigen -> Abgeben -> Vorquest fehlt -> Fliegen
-- -> Abgeben ohne Quest im Log -> Ruhestein. Dazu Questlog-Abgleich, Kampfsperre, Guide laden, Umschalten, Groessen-Griff.
-- Aufruf (aus wow-addons/): lua5.1 tests/lp_rxp.lua [ausgabeordner]  -> "LP RXP OK"
local HERE = arg[0]:match("^(.*/)") or "./"
package.path = package.path .. ";" .. HERE .. "?.lua"
local OUT = arg[1]
local ROOT = HERE .. "../addons/LevelPilot/"
local W = require("wow_mock")
local L = require("layout")

W.level, W.faction, W.class = 28, "Horde", "SHAMAN"
W.install({})
local G = _G
local fails, n = 0, 0
local function ok(c, name) n = n + 1 if not c then fails = fails + 1 print("  FEHLER " .. name) end end
local function eq(a, b, name) ok(a == b, name .. " (erwartet " .. tostring(b) .. ", bekommen " .. tostring(a) .. ")") end

G.STANDARD_TEXT_FONT = "Fonts\\FRIZQT__.TTF"
local XP = { cur = 5100, max = 8800 }
G.UnitXP = function() return XP.cur end
G.UnitXPMax = function() return XP.max end
G.GetXPExhaustion = function() return 2200 end
G.UnitOnTaxi = function() return false end
G.UnitAffectingCombat = function() return W.combat == true end
G.UnitGUID = function() return nil end
G.IsMounted = function() return false end
G.IsSwimming = function() return false end
G.GetUnitSpeed = function() return 0, 7, 7, 4.7 end
G.GetPlayerFacing = function() return 0.6 end
G.GetBindLocation = function() return "Freiwindposten" end
G.GetQuestGreenRange = function() return 7 end
G.GetQuestDifficultyColor = function() return { r = 1, g = 1, b = 0 } end
G.PlaySoundFile = function() end
G.strsplit = function(sep, s) local out = {} for p in (s .. sep):gmatch("(.-)" .. sep:gsub("%p", "%%%0")) do out[#out + 1] = p end return unpack(out) end
G.bit = { band = function(a, b) local r, p = 0, 1 while a > 0 and b > 0 do if a % 2 == 1 and b % 2 == 1 then r = r + p end a = math.floor(a / 2) b = math.floor(b / 2) p = p * 2 end return r end }
G.CreateVector2D = function(x, y) return { x = x, y = y, GetXY = function(s) return s.x, s.y end } end

-- Karte: Tausend Nadeln 1441
local PX, PY = 0.46, 0.50
G.C_Map.GetBestMapForUnit = function() return 1441 end
G.C_Map.GetPlayerMapPosition = function() return G.CreateVector2D(PX, PY) end
G.C_Map.GetMapWorldSize = function() return 4400, 2930 end
G.C_Map.GetMapInfo = function(m) return { name = ({ [1441] = "Tausend Nadeln", [1413] = "Brachland" })[m] or "Kalimdor", parentMapID = 0 } end
G.C_Map.GetWorldPosFromMapPos = function(m, v) return 1, G.CreateVector2D(v.x, v.y) end
G.C_Map.GetMapPosFromWorldPos = function(c, v, m) return m, G.CreateVector2D(v.x, v.y) end
G.C_SuperTrack.IsSuperTrackingUserWaypoint = function() return W.waypoint ~= nil end
G.C_SuperTrack.IsSuperTrackingAnything = function() return W.waypoint ~= nil end
G.C_SuperTrack.GetSuperTrackedQuestID = function() return 0 end
G.C_Navigation = { GetFrame = function() return nil end, GetDistance = function() return nil end, WasClampedToScreen = function() return false end }
G.C_TaxiMap = { GetAllTaxiNodes = function() return {} end, GetTaxiNodesForMap = function() return {} end }
G.GetTaxiMapID = function() return nil end
G.C_Container.GetItemCooldown = function() return 0, 0, 1 end
G.GetItemCount = function() return 1 end
G.C_GossipInfo = { GetAvailableQuests = function() return {} end, GetActiveQuests = function() return {} end }

-- Questlog: [id] = true (im Log); DONE = abgegeben; READY = Ziele fertig
local LOG, DONE, READY = {}, {}, {}
local NAME = { [1149] = "Glaubensprüfung", [1150] = "Prüfung des Glaubens", [1197] = "Die heilige Flamme",
  [1196] = "Die heilige Flamme (Teil 1)", [4767] = "Windrufer", [5041] = "Vorräte fürs Wegekreuz" }
local function logList() local l = {} for q in pairs(LOG) do l[#l + 1] = q end table.sort(l) return l end
G.C_QuestLog = {
  GetQuestsOnMap = function() return {} end,
  GetTitleForQuestID = function(id) return NAME[id] end,
  GetLogIndexForQuestID = function(id) if not LOG[id] then return nil end for i, q in ipairs(logList()) do if q == id then return i end end end,
  GetInfo = function(i) local q = logList()[i] return q and { questID = q, title = NAME[q] or ("Quest " .. q), isHeader = false, level = 27, frequency = 0 } or nil end,
  GetNumQuestLogEntries = function() local k = #logList() return k, k end,
  GetQuestObjectives = function(q)
    if READY[q] then return { { text = "Erledigt", finished = true, numFulfilled = 1, numRequired = 1, type = "monster" } } end
    return { { text = "Galak-Späher getötet: 3/8", finished = false, numFulfilled = 3, numRequired = 8, type = "monster" } }
  end,
  ReadyForTurnIn = function(id) return READY[id] or false end,
  IsComplete = function(id) return READY[id] or false end,
  IsOnQuest = function(id) return LOG[id] or false end,
  IsQuestFlaggedCompleted = function(id) return DONE[id] or false end,
  GetMaxNumQuestsCanAccept = function() return 25 end,
  GetQuestTagInfo = function() return nil end,
  CanAbandonQuest = function(q) return LOG[q] ~= nil end,
  GetNextWaypoint = function() return nil end,
  GetSelectedQuest = function() return 0 end,
  SetSelectedQuest = function() end,
  SetAbandonQuest = function() end,
  RequestLoadQuestByID = function() end,
}
G.GetQuestLogRewardXP = function() return 1350 end

-- ---------------------------------------------------------------- RXP-Nachbau
local F = CreateFrame("Frame", "RXPFrame", UIParent)
F:SetSize(300, 392); F:SetPoint("CENTER", UIParent, "CENTER", 0, 0)
F.CurrentStepFrame = CreateFrame("Frame", "RXPFrame_CurrentStep", F)
F.CurrentStepFrame:SetPoint("TOPLEFT", F, "TOPLEFT", 0, 0); F.CurrentStepFrame:SetSize(300, 10)
F.CurrentStepFrame.framePool = {}
local menu = 0
function F.DropDownMenu() menu = menu + 1 end

local ERR = "Interface/AddOns/RXPGuides/Textures/error"
local function E(t) return t end
local function guideSteps()
  return {
    { elements = {
      E { tag = "goto", zone = 1441, x = 46.2, y = 50.7, radius = 15, text = "Lauf zu Kaela", arrow = true, textOnly = true },
      E { tag = "accept", questId = 1149, text = "Annehmen Test of Faith" } } },
    { elements = { E { tag = "xp", level = 29, text = "Grinde bis Stufe 29" } } },
    { elements = {
      E { tag = "goto", zone = 1441, x = 30.0, y = 40.0, radius = 30, arrow = true, textOnly = true, parent = true },
      E { tag = "goto", zone = 1441, x = 32.0, y = 44.0, radius = 30, arrow = true, textOnly = true, parent = true },
      E { tag = "complete", questId = 1149, text = "Töte Galak-Späher" },
      E { tag = "mob", text = "Galak-Späher unterwegs mitnehmen", textOnly = true } } },
    { elements = {
      E { tag = "goto", zone = 1441, x = 46.0, y = 50.8, radius = 15, arrow = true, textOnly = true },
      E { tag = "turnin", questId = 1149, text = "Abgeben Test of Faith" },
      E { tag = "accept", questId = 1197, text = "Annehmen The Sacred Flame", icon = ERR,
        tooltip = "Missing pre-requisites:\n|TInterface/x:0|t The Sacred Flame (1196)" } } },
    { elements = {
      E { tag = "goto", zone = 1441, x = 45.1, y = 49.1, radius = 10, arrow = true, textOnly = true },
      E { tag = "fly", location = "Camp Taurajo", text = "Flieg nach Camp Taurajo" } } },
    { elements = { E { tag = "turnin", questId = 1150, text = "Abgeben Prüfung" } } },
    { elements = { E { tag = "hs", text = "Ruhestein nach Freiwindposten" } } },
  }
end
local guides = {}
local function guide(group, name, extra)
  local g = { group = group, name = name, displayname = name, steps = {} }
  for k, v in pairs(extra or {}) do g[k] = v end
  guides[group .. "||" .. name] = g
  return g
end
local G28 = guide("RestedXP Forever Guide (H)", "28-30 Thousand Needles")
G28.steps = guideSteps()
guide("RestedXP Forever Guide (H)", "26-28 Ashenvale")
guide("RestedXP Forever Dungeon Guide (H)", "28-30 Razorfen Kraul")

local RXP = { guides = guides, settings = { profile = { windowScale = 1, arrowScale = 1 } }, activeWaypoints = {},
  icons = { error = ERR } }
G.RXP = RXP
function RXP.IsGuideActive(g) return true end
function RXP.ReplaceNpcIds(text) return text end
local Render
function RXP.GetGuideProgress() local g = RXP.currentGuide; return g and g.currentStep or 1 end
function RXP.SetStep(k)
  local g = RXP.currentGuide; if not g then return end
  g.currentStep = k
  for i, st in ipairs(g.steps) do
    st.index = i
    if i < k and st.active then st.completed = true end
    st.active = (i == k) or nil
  end
  if Render then Render() end
end
function RXP:LoadGuide(g) self.currentGuide = g; g.currentStep = g.currentStep or 1; RXP.SetStep(g.currentStep) end
function RXP:LoadGuideTable(group, name) self:LoadGuide(guides[group .. "||" .. name]) end
RXP.arrowFrame = CreateFrame("Frame", "RXPG_ARROW", UIParent)
RXP.arrowFrame:SetSize(32, 32); RXP.arrowFrame:SetPoint("TOP", UIParent, "TOP", 0, -80)

local pool = F.CurrentStepFrame.framePool
Render = function()
  local g = RXP.currentGuide
  local act = {}
  for _, st in ipairs(g and g.steps or {}) do if st.active then act[#act + 1] = st end end
  RXP.activeWaypoints = {}
  RXP.arrowFrame.element = nil
  for c, st in ipairs(act) do
    local sf = pool[c]
    if not sf then sf = CreateFrame("Frame", nil, F.CurrentStepFrame); pool[c] = sf; sf.elements = {} end
    sf.step = st
    for j, el in ipairs(st.elements) do
      el.step = st
      local ef = sf.elements[j]
      if not ef then
        ef = CreateFrame("Frame", nil, sf); sf.elements[j] = ef
        ef.button = CreateFrame("CheckButton", nil, ef)
        ef.button:SetScript("PostClick", function(btn)   -- = addon.ActiveStepElementPostClick
          local e = btn:GetParent().element
          if e and not e.optional then e.skip = btn:GetChecked() end
          RXP.updateSteps = true
        end)
      end
      ef.element = el
      ef.button:SetChecked(el.completed or el.skip or false)
      if el.textOnly then ef.button:Hide() else ef.button:Show() end
      ef:Show()
      if el.tag == "goto" and el.arrow then
        RXP.activeWaypoints[#RXP.activeWaypoints + 1] = el
        RXP.arrowFrame.element = RXP.arrowFrame.element or el
      end
    end
    for j = #st.elements + 1, #sf.elements do sf.elements[j]:Hide() end
    sf:Show()
  end
  for c = #act + 1, #pool do pool[c]:Hide(); pool[c].step = nil end
end
-- RXPs eigene Pruefung (vereinfacht): Annehmen/Abgeben/Erledigen nach Questlog, Schritt fertig -> weiter
local function rxpTick()
  local g = RXP.currentGuide
  if not g then return end
  local st = g.steps[g.currentStep]
  if not st then return end
  local allDone = true
  for _, el in ipairs(st.elements) do
    local q = tonumber(el.questId)
    if el.tag == "accept" and q and (LOG[q] or DONE[q]) then el.completed = true end
    if el.tag == "turnin" and q and DONE[q] then el.completed = true end
    if el.tag == "complete" and q and (READY[q] or DONE[q]) then el.completed = true end
    if not el.textOnly and not (el.completed or el.skip) then allDone = false end
  end
  if allDone then RXP.SetStep(g.currentStep + 1) end
end

-- RXPNeon (nur die Schnittstelle, die LevelPilot anfasst)
local neonApply = 0
G.RXPNeon = { Fenster = { Apply = function() neonApply = neonApply + 1 end } }

-- ---------------------------------------------------------------- LevelPilot laden (TOC-Reihenfolge)
for line in io.lines(ROOT .. "LevelPilot.toc") do
  if not line:match("^##") and line:match("%S") then
    assert(loadfile(ROOT .. line:gsub("\\", "/"):gsub("%s+$", "")))("LevelPilot", {})
  end
end
local M = LevelPilotFrame
local EVS = (W.registered and W.registered["PLAYER_LOGIN"]) or {}
local function tick(k) for _ = 1, k or 6 do W.now = W.now + 0.25 for _, f in ipairs(EVS) do W.call(f, "OnUpdate", 0.25) end end end
local function step(k)   -- Spiel + RXP + LevelPilot einen Moment laufen lassen
  for _ = 1, k or 2 do rxpTick(); W.now = W.now + 1; W.fire("QUEST_LOG_UPDATE"); tick(4) end
end
local function texts(root)
  local out = {}
  L.walk(root, function(o)
    if o.GetText and o.IsVisible and o:IsVisible() then local t = o:GetText(); if type(t) == "string" and t ~= "" then out[#out + 1] = t:gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", "") end end
  end)
  return table.concat(out, "\n")
end
local function has(root, s) return texts(root):find(s, 1, true) ~= nil end
local function chat(s) for _, p in ipairs(W.prints) do if p:find(s, 1, true) then return true end end return false end
local function check(name, root)
  local probs = L.problems(root)
  for _, p in ipairs(probs) do ok(false, "[" .. name .. "] " .. p) end
  if OUT then L.dump(root, OUT .. "/" .. name .. ".tsv") end
end
local function hero() local R = LP_Route; local rt = LevelPilot_Routes.rxp; return rt and R.info and R.info.hero and rt.steps[R.info.hero] end
local function rowFor(idx)
  local found
  L.walk(M, function(o) if not found and o.stepIdx == idx and o.IsVisible and o:IsVisible() then found = o end end)
  return found
end

local okRun, err = pcall(function()
  W.fire("PLAYER_LOGIN")
  RXP:LoadGuide(G28)
  W.flush()
  step(1)
end)
ok(okRun, "Lua-Fehler beim Start: " .. tostring(err))

print("== Start: RXP-Guide ist der Plan")
local rt = LevelPilot_Routes.rxp
ok(rt and rt.rxp, "RXP-Route gebaut")
eq(LevelPilotDB.rxp, true, "RXP-Modus Standard an")
eq(LP_Route.info and LP_Route.info.rxp and LP_Route.info.rxp.cur, 1, "RXP-Schritt 1")
local h = hero()
eq(h and h.t, "accept", "JETZT = Annehmen"); eq(h and h.q, 1149, "Quest 1149")
ok(has(M, "Glaubensprüfung"), "deutscher Quest-Titel im Fenster")
ok(has(M, "RXP"), "Kopf zeigt RXP")
ok(has(M, "Thousand Needles") or has(M, "Tausend Nadeln"), "Guide-Name im Band")
ok(not rt or not (function() for _, s in ipairs(rt.steps) do if s.t == "grind" then return true end end end)(), "Grind-Schritt nicht in der Liste")
eq(F:GetAlpha(), 0, "RXP-Fenster unsichtbar"); eq(F:GetScale(), 0.01, "RXP-Fenster winzig")
F:SetAlpha(1); F:SetScale(1)
eq(F:GetAlpha(), 0, "RXP setzt Alpha -> bleibt unsichtbar"); eq(F:GetScale(), 0.01, "RXP setzt Groesse -> bleibt winzig")
eq(RXP.arrowFrame:GetAlpha(), 0, "RXP-Pfeil unsichtbar")
eq(G.RXPNeon.extern, "LevelPilot", "RXPNeon-Fenster aus (extern)"); ok(neonApply > 0, "RXPNeon.Fenster.Apply gerufen")
local wp = LP_RXP.Waypoint(h)
ok(wp and wp.map == 1441 and math.abs(wp.x - 0.462) < 1e-6, "Pfeil-Ziel = RXP-Wegpunkt 46.2,50.7")
ok(W.waypoint and W.waypoint.map == 1441, "Blizzard-Wegpunkt auf RXP-Ziel")
check("lp_rxp_start", M)

print("== Annehmen im Spiel -> Abgleich -> Grind wird uebersprungen")
LOG[1149] = true
W.fire("QUEST_ACCEPTED", 1149)
step(3)
eq(G28.currentStep, 3, "RXP ueber Grind hinweg bei Schritt 3")
ok(G28.steps[2].elements[1].skip == true, "Grind-Haken bei RXP gesetzt (wie Klick)")
ok(chat("Grind-Schritt (Stufe 29) übersprungen"), "Chat: Grind uebersprungen")
h = hero()
eq(h and h.t, "complete", "JETZT = Erledigen"); eq(h and h.q, 1149, "Erledigen 1149")
ok(h and h.note and h.note:find("unterwegs", 1, true), "RXP-Hinweis als Zusatz")
wp = LP_RXP.Waypoint(h)
ok(wp and math.abs(wp.x - 0.30) < 1e-6, "Pfeil folgt RXP-Wegnetz (erster Punkt 30,40)")
ok(has(M, "3/8"), "Ziel-Fortschritt im Fenster")
check("lp_rxp_erledigen", M)

print("== Erledigt + abgegeben -> Vorquest fehlt")
READY[1149] = true
step(2)
eq(G28.currentStep, 4, "RXP bei Schritt 4 (Abgeben)")
h = hero()
eq(h and h.t, "turnin", "JETZT = Abgeben")
LOG[1149], DONE[1149] = nil, true
W.fire("QUEST_TURNED_IN", 1149)
step(2)
h = hero()
eq(h and h.t, "accept", "JETZT = Annehmen 1197"); eq(h and h.q, 1197, "1197")
local warn = LP_Route.info.rxp.warn
eq(warn and warn.head, "VORQUEST FEHLT", "Warnung Vorquest")
ok(warn and warn.miss[1] == "Die heilige Flamme (Teil 1)", "fehlende Vorquest per ID deutsch")
ok(has(M, "VORQUEST FEHLT"), "Fenster zeigt VORQUEST FEHLT")
ok(has(M, "Die heilige Flamme (Teil 1)"), "Fenster nennt die Vorquest")
check("lp_rxp_vorquest", M)

print("== Rechtsklick = Schritt ueberspringen (RXP eins weiter)")
local row = rowFor(LP_Route.info.hero)
ok(row ~= nil, "Zeile der JETZT-Karte gefunden")
if row then W.call(row, "OnClick", "RightButton") end
step(1)
eq(G28.currentStep, 5, "RXP bei Schritt 5 (Fliegen)")
h = hero()
eq(h and h.t, "fly", "JETZT = Fliegen")
ok(has(M, "Camp Taurajo"), "Flugziel im Fenster")

print("== /lp weiter -> Abgeben ohne Quest im Log")
SlashCmdList.LEVELPILOT("weiter"); step(1)
eq(G28.currentStep, 6, "RXP bei Schritt 6")
warn = LP_Route.info.rxp.warn
eq(warn and warn.head, "QUEST NICHT IM LOG", "Warnung nicht im Log")
ok(has(M, "QUEST NICHT IM LOG"), "Fenster zeigt QUEST NICHT IM LOG")
check("lp_rxp_nichtimlog", M)
-- negative ID = RXP ueberspringt selbst -> keine Warnung
G28.steps[6].elements[1].questId = -1150; LP_RXP.Reset(); step(1)
ok(not LP_Route.info.rxp.warn, "skipIfMissing: keine Warnung")
G28.steps[6].elements[1].questId = 1150; LP_RXP.Reset(); step(1)

print("== Kampf: kein Klick bei RXP")
LOG[1150] = true
W.combat = true
step(2)
ok(not G28.steps[6].elements[1].skip, "im Kampf kein Haken")
LOG[1150] = nil
W.combat = false
step(1)

print("== /lp schritt setzt RXP-Schritt")
SlashCmdList.LEVELPILOT("schritt 5"); step(1)
eq(G28.currentStep, 5, "/lp schritt 5")
SlashCmdList.LEVELPILOT("schritt 6"); step(1)
eq(G28.currentStep, 6, "/lp schritt 6")

print("== Linksklick setzt Haken bei RXP")
row = rowFor(LP_Route.info.hero)
if row then W.call(row, "OnClick", "LeftButton") end
step(1)
eq(G28.currentStep, 7, "Haken gesetzt -> RXP weiter zu Schritt 7")
eq(hero() and hero().t, "hearth", "JETZT = Ruhestein")

print("== Questlog-Check: Quest nicht im Guide -> pruefen statt loeschen")
LOG[4767] = true
local adv = LP_Route.LogAdvice(LevelPilot_Routes.rxp, "rxp", 28, LP_Route.info.ptr, LP_Route.info.hero, {})
local a4767
for _, a in ipairs(adv.list) do if a.q == 4767 then a4767 = a end end
eq(a4767 and a4767.cat, "check", "fremde Quest = pruefen")
LOG[4767] = nil

print("== Grinden an/aus")
SlashCmdList.LEVELPILOT("grind an"); step(1)
local hasG = false
for _, s in ipairs(LevelPilot_Routes.rxp.steps) do if s.t == "grind" then hasG = true end end
ok(hasG, "/lp grind an: Grind-Schritt im Plan")
SlashCmdList.LEVELPILOT("grind aus"); step(1)
hasG = false
for _, s in ipairs(LevelPilot_Routes.rxp.steps) do if s.t == "grind" then hasG = true end end
ok(not hasG, "/lp grind aus: Grind wieder raus")

print("== Kein Guide -> Klick aufs Band laedt den passenden")
RXP.currentGuide = nil; LP_RXP.Reset(); step(1)
ok(has(M, "Kein RXP-Guide geladen"), "Leer-Hinweis ohne Guide")
check("lp_rxp_ohneguide", M)
G28.currentStep = 1
for _, st in ipairs(G28.steps) do st.completed, st.active = nil, nil; for _, el in ipairs(st.elements) do el.completed, el.skip, el.lpSynced, el.lpGrind = nil, nil, nil, nil end end
SlashCmdList.LEVELPILOT("guide"); step(1)
ok(RXP.currentGuide == G28, "/lp guide laedt 28-30 (kein Dungeon)")
SlashCmdList.LEVELPILOT("guide")
eq(menu, 1, "Guide passt -> RXP-Guide-Menue")

print("== Umschalten /lp rxp")
SlashCmdList.LEVELPILOT("rxp"); step(1)
eq(LevelPilotDB.rxp, false, "RXP aus")
eq(F:GetAlpha(), 1, "RXP-Fenster wieder sichtbar"); eq(F:GetScale(), 1, "RXP-Fenster normale Groesse")
ok(LevelPilot_Routes.rxp == nil, "RXP-Route weg")
ok(G.RXPNeon.extern == nil, "RXPNeon wieder zustaendig")
SlashCmdList.LEVELPILOT("rxp"); step(1)
eq(LevelPilotDB.rxp, true, "RXP wieder an"); eq(F:GetAlpha(), 0, "RXP-Fenster wieder unsichtbar")

print("== Groessen-Griff (Ecke unten rechts)")
local grip
L.walk(M, function(o) if not grip and o.GetObjectType and o:GetObjectType() == "Button" and o:GetScript("OnMouseDown") and o:GetScript("OnMouseUp") and o:GetWidth() == 18 then grip = o end end)
ok(grip ~= nil, "Griff gefunden")
if grip then
  local e0 = M:GetEffectiveScale()
  local left, top = M:GetLeft() * e0, M:GetTop() * e0
  local wpx = M:GetWidth() * e0
  local CX = left + wpx
  G.GetCursorPosition = function() return CX, 300 end
  W.call(grip, "OnMouseDown", "LeftButton")
  CX = left + wpx * 1.25
  W.call(grip, "OnUpdate", 0.02)
  eq(M:GetScale(), 1.25, "Ziehen: 125 %")
  local e1 = M:GetEffectiveScale()
  ok(math.abs(M:GetLeft() * e1 - left) < 0.5 and math.abs(M:GetTop() * e1 - top) < 0.5, "linke obere Ecke bleibt stehen")
  CX = left + wpx * 3; W.call(grip, "OnUpdate", 0.02); eq(M:GetScale(), 1.6, "Grenze 160 %")
  CX = left; W.call(grip, "OnUpdate", 0.02); eq(M:GetScale(), 0.6, "Grenze 60 %")
  CX = left + wpx * 0.9; W.call(grip, "OnUpdate", 0.02)
  W.call(grip, "OnMouseUp", "LeftButton")
  eq(LevelPilotDB.scale, 0.9, "Groesse gespeichert")
  ok(grip:GetScript("OnUpdate") == nil, "Ziehen endet beim Loslassen")
  W.call(grip, "OnClick", "RightButton")
  eq(M:GetScale(), 1, "Rechtsklick = normale Groesse")
  LevelPilotDB.locked = true
  W.call(grip, "OnMouseDown", "LeftButton"); CX = left + wpx * 1.4; W.call(grip, "OnUpdate", 0.02)
  ok(grip:GetScript("OnUpdate") == nil and M:GetScale() == 1, "gesperrt: keine Groessenaenderung")
  LevelPilotDB.locked = false
end

print("== Ohne RXP: LevelPilots eigene Route")
G.RXP = nil; step(1)
ok(LevelPilot_Routes.rxp == nil, "ohne RXPGuides keine RXP-Route")
ok(LP_Route.info and not LP_Route.info.rxp, "eigener Plan aktiv")
G.RXP = RXP; step(1)
check("lp_rxp_ende", M)

for _, e in ipairs(W.errors) do ok(false, "Fehler-Handler: " .. e) end
print(fails == 0 and ("LP RXP OK (" .. n .. " Pruefungen)") or ("FEHLER: " .. fails .. " von " .. n))
if fails > 0 then os.exit(1) end

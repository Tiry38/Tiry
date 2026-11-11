-- RXPNeon: Test im strengen Forever-Nachbau mit nachgebautem RestedXP (nur die Schnittstellen, die RXPNeon nutzt).
-- Aufruf aus addons/RXPNeon: lua5.1 ../../tests/rxn.lua [ausgabeordner fuer Vorschau]  -> "RXN TESTS OK"
local HERE = arg[0]:match("^(.*/)") or "./"
package.path = package.path .. ";" .. HERE .. "?.lua"
local OUT = arg[1]
local W = require("wow_mock")
local L = require("layout")
W.class, W.level, W.faction = "SHAMAN", 28, "Horde"
W.install({})
local G = _G
local fails, n = 0, 0
local say = function(x) io.stdout:write(x, "\n") end
local function ok(c, name) n = n + 1 if not c then fails = fails + 1 say("FEHLER: " .. name) end end
local function eq(a, b, name) ok(a == b, name .. "\n   erwartet: " .. tostring(b) .. "\n   bekommen: " .. tostring(a)) end
G.print = function(...) local t = {} for i = 1, select("#", ...) do t[#t + 1] = tostring(select(i, ...)) end table.insert(W.prints, table.concat(t, " ")) end
G.UnitClass = function() return "Schamane", W.class end
G.CLASS_ICON_TCOORDS = { SHAMAN = { 0.25, 0.49609375, 0.25, 0.5 } }
local XP = { cur = 5100, max = 8800, rest = 2200 }
G.UnitXP = function() return XP.cur end
G.UnitXPMax = function() return XP.max end
G.GetXPExhaustion = function() return XP.rest end
local QL = {}       -- Questlog des Spielers: [id] = "on" | "done"
G.C_QuestLog = { IsOnQuest = function(id) return QL[id] == "on" end, IsQuestFlaggedCompleted = function(id) return QL[id] == "done" end }
local C = "|cFF39FF6B"   -- so liegen RXP-Farbcodes beim Anzeigen vor (Hex statt RXP_..._)

-- ---------------------------------------------------------------- RXP-Nachbau (Fenster wie GuideWindow.lua v1)
local F = CreateFrame("Frame", "RXPFrame", UIParent)
F:SetSize(300, 392); F:SetPoint("CENTER", UIParent, "CENTER", 0, 0); F:SetFrameStrata("BACKGROUND")
F.BottomFrame = CreateFrame("Frame", "RXPFrame_bottomFrame", F)
F.BottomFrame:SetPoint("TOPLEFT", F, "TOPLEFT", 3, -3); F.BottomFrame:SetPoint("BOTTOMRIGHT", F, "BOTTOMRIGHT", -3, 14)
F.GuideName = CreateFrame("Frame", "RXPFrameGuideName", F)
F.GuideName:SetPoint("BOTTOMLEFT", F.BottomFrame, "TOPLEFT", 0, -9); F.GuideName:SetPoint("BOTTOMRIGHT", F.BottomFrame, "TOPRIGHT", 0, -9)
F.GuideName:SetHeight(35); F.GuideName:SetFrameLevel(6)
F.GuideName.text = F.GuideName:CreateFontString(nil, "OVERLAY")
F.GuideName.text:SetFont("Fonts\\FRIZQT__.TTF", 11, ""); F.GuideName.text:SetPoint("LEFT", F.GuideName, "LEFT", 29, 0); F.GuideName.text:SetPoint("RIGHT", F.GuideName, "RIGHT", 0, 0)
F.GuideName.text:SetJustifyH("CENTER")
F.GuideName.icon = F.GuideName:CreateTexture(nil, "ARTWORK"); F.GuideName.icon:SetPoint("CENTER", F.GuideName, "LEFT", 16, 0); F.GuideName.icon:SetSize(42, 42)
F.GuideName.icon:SetTexture("Interface\\AddOns\\RXPNeon\\Media\\rxp_logo-64")
F.GuideName.classIcon = F.GuideName:CreateTexture(nil, "OVERLAY"); F.GuideName.classIcon:SetPoint("CENTER", F.GuideName.icon, "BOTTOMRIGHT", -4, 10); F.GuideName.classIcon:SetSize(24, 24)
F.Footer = CreateFrame("Frame", "RXPFrameFooter", F)
F.Footer:SetPoint("BOTTOMLEFT", F, "BOTTOMLEFT", 3, 0); F.Footer:SetPoint("BOTTOMRIGHT", F, "BOTTOMRIGHT", -3, 0); F.Footer:SetHeight(20); F.Footer:SetFrameLevel(6)
F.Footer.text = F.GuideName:CreateFontString(nil, "OVERLAY"); F.Footer.text:SetFont("Fonts\\FRIZQT__.TTF", 9, "")
F.Footer.text:SetPoint("LEFT", F.Footer, "LEFT", 40, 1); F.Footer.text:SetText("RXP Beta v4.11.35 0/0")
-- aktive Schritte sitzen bei RXP (Standard "top") UEBER der Kopfzeile
F.CurrentStepFrame = CreateFrame("Frame", "RXPFrame_CurrentStep", F)
F.CurrentStepFrame:SetPoint("BOTTOMLEFT", F.GuideName, "TOPLEFT", 0, 4); F.CurrentStepFrame:SetPoint("BOTTOMRIGHT", F.GuideName, "TOPRIGHT", 0, 4)
F.CurrentStepFrame:SetHeight(10); F.CurrentStepFrame.framePool = {}
F.ScrollChild = CreateFrame("Frame", "RXPFrame_steps", F.BottomFrame)
F.ScrollChild:SetPoint("TOPLEFT", F.BottomFrame, "TOPLEFT", 6, -30); F.ScrollChild:SetPoint("BOTTOMRIGHT", F.BottomFrame, "BOTTOMRIGHT", -20, 8)
F.ScrollChild.framePool = {}
local visuals = 0
function F:UpdateVisuals() visuals = visuals + 1 end
local menuOpened = 0
function F.DropDownMenu() menuOpened = menuOpened + 1 end

local guides = {}
local function guide(group, name, extra)
  local g = { group = group, name = name, displayname = name, steps = {} }
  for k, v in pairs(extra or {}) do g[k] = v end
  guides[group .. "||" .. name] = g
  return g
end
guide("RestedXP Forever Guide (H)", "26-28 Ashenvale", { subgroup = "Speedrun Guide 22-30" })
guide("RestedXP Forever Guide (H)", "28-30 Thousand Needles", { subgroup = "Speedrun Guide 22-30" })
guide("RestedXP Forever Guide (H)", "30-33 Hillsbrad/Arathi", { subgroup = "Speedrun Guide 30-40" })
guide("RestedXP Forever Dungeon Guide (H)", "28-30 Razorfen Kraul")
guide("RestedXP Horde Mage AoE", "26-31 Duskwood Part 2 Mage AoE", { mageOnly = true })
guide("RestedXP Forever Guide (A)", "28-30 Duskwood", { alliance = true })

local rendered = {}
local RXP = {
  themes = {}, guides = guides,
  settings = { profile = { activeTheme = "RXP Blue", windowScale = 1, arrowScale = 1, guideFontSize = 9 } },
  v2 = { IsGuideWindowEnabled = function() return false end },
}
G.RXP = RXP
function RXP:RegisterTheme(t) assert(t.name and t.author, "Theme ohne Name/Autor") self.themes[t.name] = t end
function RXP.RenderFrame() rendered[#rendered + 1] = RXP.settings.profile.activeTheme; F:UpdateVisuals() end
function RXP.SetupArrow() end
function RXP.IsGuideActive(g) return not g.mageOnly and not g.alliance end
function RXP.ReplaceNpcIds(text, element) return (text:gsub("npc:(.-):(%d+)", "%1")) end
RXP.settings.ReplaceColors = function(el) end
local Render   -- baut die aktiven Schritte wie RXP
function RXP.GetGuideProgress() local g = RXP.currentGuide; return g and g.currentStep or 1 end
function RXP.SetStep(n)
  local g = RXP.currentGuide; if not g then return end
  g.currentStep = n
  for i, st in ipairs(g.steps) do st.index = i; st.active = (i == n) or (st.sticky and i < n and not st.completed) or nil end
  if Render then Render() end
end
function RXP:LoadGuide(g) self.currentGuide = g; if g.currentStep then RXP.SetStep(g.currentStep) end end
function RXP:LoadGuideTable(group, name) self:LoadGuide(guides[group .. "||" .. name]) end
RXP.arrowFrame = CreateFrame("Frame", "RXPG_ARROW", UIParent)
RXP.arrowFrame:SetSize(32, 32); RXP.arrowFrame:SetPoint("TOP", UIParent, "TOP", 0, -80)
RXP.arrowFrame.texture = RXP.arrowFrame:CreateTexture(nil, "ARTWORK"); RXP.arrowFrame.texture:SetAllPoints()
RXP.arrowFrame.texture:SetTexture("Interface\\AddOns\\RXPNeon\\Media\\rxp_navigation_arrow-1")
RXP.arrowFrame.text = RXP.arrowFrame:CreateFontString(nil, "OVERLAY")
RXP.arrowFrame.text:SetFont("Fonts\\FRIZQT__.TTF", 9, "OUTLINE"); RXP.arrowFrame.text:SetPoint("TOP", RXP.arrowFrame, "BOTTOM", 0, -5)

-- Aktive Schritte zeichnen wie RXP (GuideWindow.lua): Schritt-Rahmen mit .step, .number, .elements[j] (.button = CheckButton)
local pool = F.CurrentStepFrame.framePool
local function newElement(sf)
  local ef = CreateFrame("Frame", nil, sf)
  ef:SetHeight(16)
  ef.button = CreateFrame("CheckButton", nil, ef)
  ef.button:SetSize(12, 12); ef.button:SetPoint("TOPLEFT", ef, "TOPLEFT", 6, -1)
  ef.button:SetScript("PostClick", function(btn)          -- = addon.ActiveStepElementPostClick
    local el = btn:GetParent().element
    if el and not el.optional then el.skip = btn:GetChecked() end
    RXP.updateSteps = true
  end)
  ef.text = ef:CreateFontString(nil, "OVERLAY"); ef.text:SetFont("Fonts\\ARIALN.TTF", 11, "")
  ef.text:SetPoint("TOPLEFT", ef.button, "TOPRIGHT", 11, -1); ef.text:SetPoint("RIGHT", sf, "RIGHT", -5, 0)
  ef.text:SetJustifyH("LEFT")
  return ef
end
Render = function()
  local g = RXP.currentGuide
  local act = {}
  for _, st in ipairs(g and g.steps or {}) do if st.active then act[#act + 1] = st end end
  for c, st in ipairs(act) do
    local sf = pool[c]
    if not sf then
      sf = CreateFrame("Frame", nil, F.CurrentStepFrame); pool[c] = sf
      sf.number = CreateFrame("Frame", nil, sf); sf.number:SetPoint("BOTTOMLEFT", sf, "TOPLEFT", 3, -6)
      sf.number.text = sf.number:CreateFontString(nil, "OVERLAY"); sf.number.text:SetFont("Fonts\\ARIALN.TTF", 11, "")
      sf.number.text:SetPoint("CENTER", sf.number, "CENTER", 0, 0)
      sf.elements = {}
    end
    sf:ClearAllPoints()
    if c == 1 then sf:SetPoint("TOPLEFT", F.CurrentStepFrame, 0, 0); sf:SetPoint("TOPRIGHT", F.CurrentStepFrame, 0, 0)
    else sf:SetPoint("TOPLEFT", pool[c - 1], "BOTTOMLEFT", 0, -5); sf:SetPoint("TOPRIGHT", pool[c - 1], "BOTTOMRIGHT", 0, -5) end
    sf.step = st
    sf.number.text:SetText(st.title or ("Step " .. st.index))
    sf.number:SetSize(sf.number.text:GetStringWidth() + 10, 17)
    for j, el in ipairs(st.elements) do
      el.step = st
      local ef = sf.elements[j] or newElement(sf); sf.elements[j] = ef
      ef.element = el
      ef:ClearAllPoints()
      if j == 1 then ef:SetPoint("TOPLEFT", sf, 0, -10); ef:SetPoint("TOPRIGHT", sf, 0, -10)
      else ef:SetPoint("TOPLEFT", sf.elements[j - 1], "BOTTOMLEFT", 0, 0); ef:SetPoint("TOPRIGHT", sf.elements[j - 1], "BOTTOMRIGHT", 0, 0) end
      ef:Show()
      if el.text then
        ef:SetAlpha(1)
        if el.textOnly then ef.button:SetChecked(true); ef.button:Hide(); el.completed = true
        else ef.button:Show(); ef.button:SetChecked(el.completed or el.skip) end
      else
        ef:SetAlpha(0); ef.button:Hide(); ef:SetHeight(1)
      end
    end
    for j = #st.elements + 1, #sf.elements do sf.elements[j]:Hide() end
    sf:SetAlpha(1); sf:Show()
  end
  for c = #act + 1, #pool do pool[c]:Hide() end
  F.CurrentStepFrame.UpdateText()
end
-- wie RXP: Texte der aktiven Schritte OHNE Element durch ReplaceNpcIds
function F.CurrentStepFrame.UpdateText()
  for _, sf in ipairs(pool) do
    if sf:IsShown() then
      local h = 18
      for j, el in ipairs(sf.step.elements) do
        local ef = sf.elements[j]
        if el.text then ef.text:SetText(RXP.ReplaceNpcIds(el.text)); local eh = math.ceil(ef.text:GetStringHeight() * 1.1) + 1; ef:SetHeight(eh); h = h + eh end
      end
      sf:SetHeight(h)
    end
  end
end

-- ---------------------------------------------------------------- Add-on laden (Reihenfolge wie TOC)
for _, f in ipairs({ "Namen.lua", "Phrasen.lua", "Deutsch.lua", "RXPNeon.lua", "Fenster.lua", "Pfeil.lua" }) do
  local chunk = assert(loadfile(f)); chunk("RXPNeon", {})
end
local N = RXPNeon
W.fire("ADDON_LOADED", "RXPNeon")
W.fire("PLAYER_LOGIN")
W.flush()
ok(#W.errors == 0, "Fehler beim Start: " .. tostring(W.errors[1]))

-- Theme + Aktivierung
ok(RXP.themes["Tiry Neon"] ~= nil, "Theme registriert")
eq(RXP.settings.profile.activeTheme, "Tiry Neon", "Theme aktiv")
eq(RXPNeonDB.altesTheme, "RXP Blue", "altes Theme gemerkt")
ok(#rendered >= 1 and visuals >= 1, "Fenster neu gezeichnet")
eq(RXP.themes["Tiry Neon"].texturePath, "Interface/AddOns/RXPNeon/Media/", "Texturpfad")
-- jede Textur, die RXP ueber den Theme-Pfad anfragt, muss es geben
for _, name in ipairs({ "rxp-banner", "rxp-borders", "rxp_logo-64", "rxp_cog-32", "rxp-btn-blank-32", "rxp-checked-32",
  "rxp_navigation_arrow-1", "white_circle", "map_active_step_target_icon", "Scrollbar/Knob", "Scrollbar/Up-Normal",
  "Scrollbar/Up-Highlight", "Scrollbar/Up-Pushed", "Scrollbar/Up-Disabled", "Scrollbar/Down-Normal", "Scrollbar/Down-Highlight",
  "Scrollbar/Down-Pushed", "Scrollbar/Down-Disabled" }) do
  local f = io.open("Media/" .. name .. ".tga", "rb")
  ok(f ~= nil, "Textur fehlt: " .. name); if f then f:close() end
end

-- ---------------------------------------------------------------- Uebersetzung
local T = function(s, el) return RXP.ReplaceNpcIds(s, el) end
eq(T("Talk to " .. C .. "Arch Druid Hamuul Runetotem|r"), "Sprich mit " .. C .. "Erzdruide Hamuul Runetotem|r", "NPC-Name + Sprich mit")
eq(T("Accept The Sacred Flame", { tag = "accept", questId = 1196, step = {} }), "Annehmen: Die heilige Flamme", "Quest annehmen (ID)")
eq(T(C .. "Turn in The Sacred Flame|r", { tag = "turnin", questId = 1195, step = {} }), C .. "Abgeben: Die heilige Flamme|r", "Quest abgeben mit Farbe")
eq(T("Fly to Thunder Bluff"), "Flieg nach Thunder Bluff", "Flug (deutscher Client sagt Thunder Bluff)")
eq(T("Travel to Thousand Needles"), "Reise nach Tausend Nadeln", "Ort uebersetzt")
eq(T("Get the Freewind Post flight path"), "Hol dir den Flugpunkt Freiwindposten", "Flugpunkt-Muster")
eq(T("Kill " .. C .. "Galak Scouts|r. Loot them for their " .. C .. "Wanted Poster|r"),
  "Töte " .. C .. "Späher der Galak|r. Plündere sie für " .. C .. "Steckbrief|r", "Töten + Plündern, Mehrzahl-Name")
eq(T("Kill " .. C .. "Galak Scouts|r and " .. C .. "Galak Wranglers|r"), "Töte " .. C .. "Späher der Galak|r und " .. C .. "Zänker der Galak|r", "und")
eq(T("Train your class spells"), "Lerne deine Klassenzauber", "ganzer Satz")
eq(T("Grind to 1100+/8800xp"), "Grinde bis 1100+/8800 EP", "Grinden + EP")
eq(T("|TInterface/worldmap/chatbubble_64grey.blp:20|tTalk to " .. C .. "Zangen|r"), "|TInterface/worldmap/chatbubble_64grey.blp:20|tSprich mit " .. C .. "Zangen|r", "Symbol direkt vor Wort")
eq(T("Sprich mit Grunzer"), "Sprich mit Grunzer", "Deutsch bleibt Deutsch")
eq(T("Set your Hearthstone to Freewind Post"), "Setz deinen Ruhestein auf Freiwindposten", "Ruhestein")
eq(T("Use the |T1:0|t[Unlit Torch] on the ground"), "Benutze |T1:0|t[Unlit Torch] am Boden", "Klammer-Name unbekannt bleibt")
eq(T("Loot [Henrig Lonebrow's Journal] on the ground"), "Plündere [Henrik Lonebrows Tagebuch] am Boden", "Item in Klammern")
eq(T("Talk to " .. C .. "npc:Grunt Logmar:4048|r"), "Sprich mit " .. C .. "Grunzer Logmar|r", "RXP-NPC-ID wird vorher ersetzt")
-- Kopfzeile
F.GuideName.text:SetText("28-30 Thousand Needles\nSpeedrun Guide 22-30")
eq(F.GuideName.text:GetText(), "28-30 Tausend Nadeln\nSpeedrun Guide 22-30", "Kopfzeile deutsch")
-- Schritt-Titel/Pfeiltext: nur Schritte, Quest-Elemente bleiben unberuehrt
local step = { elements = {}, title = "Travel to Thousand Needles", arrowtext = "Fly to Freewind Post" }
RXP.settings.ReplaceColors(step)
eq(step.title, "Reise nach Tausend Nadeln", "Schritt-Titel")
eq(step.arrowtext, "Flieg nach Freiwindposten", "Pfeil-Text")
local qel = { tag = "accept", questId = 1196, title = "Supplies and Spices" }
RXP.settings.ReplaceColors(qel)
eq(qel.title, "Supplies and Spices", "Quest-Element-Titel unveraendert (RXP gleicht Questnamen ab)")
-- Guide-Menue
eq(RXP.GuideNames and RXP.GuideNames["28-30 Thousand Needles"], "28-30 Tausend Nadeln", "Menue: Guide-Name")
eq(RXP.GuideNames and RXP.GuideNames["RestedXP Forever Guide (H)"], "RestedXP Forever Guide (Horde)", "Menue: Gruppe")

-- ---------------------------------------------------------------- Guide-Tipp fuer Stufe 28
local g = N.Recommend(28)
eq(g and g.name, "28-30 Thousand Needles", "Empfehlung Stufe 28 (kein Dungeon/Mage/Allianz)")
eq(N.Recommend(30) and N.Recommend(30).name, "30-33 Hillsbrad/Arathi", "Stufe 30: naechster Abschnitt")
ok(N.Recommend(5) == nil, "keine Empfehlung ohne passenden Guide")

-- ---------------------------------------------------------------- Neon-Fenster mit echtem Guide-Ablauf
local TN = guides["RestedXP Forever Guide (H)||28-30 Thousand Needles"]
local function fill(n) return { elements = { { tag = "goto", text = "Travel to Thousand Needles" } }, completed = true } end
TN.steps = {}
for i = 1, 10 do TN.steps[i] = fill(i) end
TN.steps[11] = { sticky = true, elements = { { tag = "complete", questId = 4841, text = "Kill " .. C .. "Galak Scouts|r. Loot them for their " .. C .. "Wanted Poster|r" } } }
TN.steps[12] = { elements = {
  { text = "Talk to " .. C .. "Zangen Stonehoof|r", textOnly = true },
  { tag = "turnin", questId = 1195, text = "Turn in The Sacred Flame", completed = true },
  { tag = "accept", questId = 1196, text = "Accept The Sacred Flame" } } }
TN.steps[13] = { elements = { { tag = "fly", text = "Fly to Freewind Post" } } }
TN.steps[14] = { hidewindow = true, elements = { { tag = "goto", text = "Versteckt" } } }
TN.steps[15] = { elements = { { tag = "fp", text = "Get the Freewind Post flight path" } } }
TN.steps[16] = { optional = true, elements = { { text = "Optional" } } }
TN.steps[17] = { level = 40, elements = { { tag = "accept", text = "Accept Zu hoch" } } }
TN.steps[18] = { elements = { { tag = "home", text = "Set your Hearthstone to Freewind Post" } } }
TN.steps[19] = { elements = { { tag = "trainer", text = "Train your class spells" } } }
TN.steps[20] = { elements = { { tag = "xp", text = "Grind to 1100+/8800xp" } } }
RXP:LoadGuideTable("RestedXP Forever Guide (H)", "28-30 Thousand Needles")
F.GuideName.text:SetText("28-30 Thousand Needles\nSpeedrun Guide 22-30")
local af = RXP.arrowFrame
af.element = { step = TN.steps[12] }; af.distance = 86; af:Show()
af.text:SetText("Talk to Zangen Stonehoof\n(86yd)")
RXP.SetStep(12)
local win = N.Fenster.Frame()
local function tick() W.call(win, "OnUpdate", 0.6) end
tick()
ok(#W.errors == 0, "Fehler beim Zeichnen: " .. tostring(W.errors[1]))
ok(win and win:IsShown(), "Neon-Fenster sichtbar")

-- RXP-Fenster: unsichtbar, aber NICHT versteckt (sonst pausiert RXP Auto-Annehmen + Schritt-Pruefung)
ok(F:IsShown() and F:GetAlpha() == 0 and F:GetScale() < 0.05, "RXP-Fenster unsichtbar, aber gezeigt")
F:SetScale(1); F:SetAlpha(1)
ok(F:GetScale() < 0.05 and F:GetAlpha() == 0, "RXP setzt Groesse/Deckkraft zurueck -> sofort wieder unsichtbar")

-- RXPs eigene Texte der aktiven Schritte (ohne Element): Quest-Titel trotzdem deutsch
local sf12 = F.CurrentStepFrame.framePool[2]
eq(sf12.step, TN.steps[12], "Schritt 12 ist zweiter aktiver Rahmen (11 klebt)")
eq(sf12.elements[3].text:GetText(), "Annehmen: Die heilige Flamme", "RXP-Text ohne Element: Annehmen deutsch")
eq(sf12.elements[2].text:GetText(), "Abgeben: Die heilige Flamme", "RXP-Text ohne Element: Abgeben deutsch")

-- Inhalt des Fensters
local function strip(s) return (s:gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", "")) end
local function vis(root, out)
  out = out or {}
  for _, c in ipairs(root.__children or {}) do
    if c:IsVisible() then
      if c.GetText and c:GetText() and c:GetText() ~= "" then out[#out + 1] = strip(c:GetText()) end
      vis(c, out)
    end
  end
  return out
end
local function has(t, s) for _, v in ipairs(t) do if v:find(s, 1, true) then return true end end return false end
local function find(root, s)
  for _, c in ipairs(root.__children or {}) do
    if c:IsVisible() then
      if c.GetText and c:GetText() and strip(c:GetText()) == s then return c end
      local r = find(c, s); if r then return r end
    end
  end
end
local t = vis(win)
local want = { "28", "Tausend Nadeln", "STUFE 28–30", "SPEEDRUN 22-30", "5100 / 8800 EP", "58 %", "Erholt 25 %",
  "SCHRITT 12 / 20", "ANNEHMEN", "SCHRITT 12", "Sprich mit Zangen", "Abgeben: Die heilige Flamme", "Annehmen: Die heilige Flamme",
  "AUCH AKTIV · ERLEDIGEN", "Galak", "ALS NÄCHSTES", "Flieg nach Freiwindposten", "#13", "#15", "#18", "#19",
  "GUIDE WÄHLEN", "DEUTSCH", "86 m" }
for _, s in ipairs(want) do ok(has(t, s), "Fenster zeigt: " .. s) end
for _, s in ipairs({ "#14", "#16", "#17", "#20", "Versteckt", "ERLEDIGT · WEITER" }) do ok(not has(t, s), "Fenster zeigt NICHT: " .. s) end
ok(not has(t, "Accept") and not has(t, "Turn in"), "kein Englisch in Quest-Zeilen")
if OUT then L.dump(win, OUT .. "/rxn_fenster.tsv", { levels = true, noHover = true }) end
local probs = L.problems(win)
ok(#probs == 0, "Layout Fenster: " .. tostring(probs[1]))

-- Tirys Fall (11.11.): Quest bei Zangen erst angenommen, Phiole noch leer -> RXP wartet beim Abgeben.
-- Das Fenster sagt klar, warum, und was fehlt.
local OBJ = {}
G.C_QuestLog.GetQuestObjectives = function(id) return OBJ[id] end
local tin = TN.steps[12].elements[2]
tin.completed = nil
QL[1195] = "on"
OBJ[1195] = { { text = "Gefüllte geätzte Phiole: 0/1", finished = false, numFulfilled = 0, numRequired = 1 } }
Render(); N.Fenster.Dirty(); tick()
t = vis(win)
ok(has(t, "ABGEBEN GEHT NOCH NICHT"), "Warnung: Abgeben geht noch nicht")
ok(has(t, "• Gefüllte geätzte Phiole: 0/1"), "Warnung nennt das offene Ziel")
ok(has(t, "Mondbrunnen in Eschental"), "Warnung nennt, wo die Phiole gefuellt wird")
ok(has(t, "Oder mit › überspringen"), "Warnung nennt Ueberspringen")
ok(not tin.skip, "kein automatischer Haken beim Abgeben")
if OUT then L.dump(win, OUT .. "/rxn_offen.tsv", { levels = true, noHover = true }) end
probs = L.problems(win)
ok(#probs == 0, "Layout offene Quest: " .. tostring(probs[1]))
eq(#W.errors, 0, "keine Fehler bei offener Quest")
-- Phiole gefuellt -> Warnung weg (Abgeben bleibt offen, bis RXP/Spiel es meldet)
OBJ[1195][1].finished = true; OBJ[1195][1].text = "Gefüllte geätzte Phiole: 1/1"
W.fire("QUEST_LOG_UPDATE"); tick()
t = vis(win)
ok(not has(t, "ABGEBEN GEHT NOCH NICHT"), "Ziel erfuellt -> Warnung weg")
-- ohne GetQuestObjectives (andere Client-Version): keine Warnung, kein Fehler
G.C_QuestLog.GetQuestObjectives = nil
OBJ[1195][1].finished = false
N.Fenster.Dirty(); tick()
ok(not has(vis(win), "ABGEBEN GEHT NOCH NICHT") and #W.errors == 0, "ohne Ziel-API: still")
QL[1195] = nil; tin.completed = true
Render(); N.Fenster.Dirty(); tick()

-- Questlog-Abgleich: Spiel sagt "angenommen", RXP hat noch keinen Haken -> Haken bei RXP setzen
local acc = TN.steps[12].elements[3]
ok(not acc.skip and not sf12.elements[3].button:GetChecked(), "vorher: Annehmen offen")
QL[1196] = "on"
W.fire("QUEST_ACCEPTED", 1196)
tick()
ok(acc.skip == true and sf12.elements[3].button:GetChecked(), "Abgleich: Haken bei RXP gesetzt")
tick()
t = vis(win)
ok(has(t, "ERLEDIGT · WEITER") and has(t, "ALLES ERLEDIGT"), "alles erledigt -> WEITER-Knopf")
if OUT then L.dump(win, OUT .. "/rxn_weiter.tsv", { levels = true, noHover = true }) end
probs = L.problems(win)
ok(#probs == 0, "Layout Weiter: " .. tostring(probs[1]))
W.call(find(win, "ERLEDIGT · WEITER  ›"):GetParent(), "OnClick")
eq(RXP.GetGuideProgress(), 13, "WEITER springt zu Schritt 13")
tick()
t = vis(win)
ok(has(t, "FLIEGEN") and has(t, "SCHRITT 13 / 20"), "Schritt 13: Fliegen")
-- Klick auf eine Zeile setzt den Haken bei RXP
W.call(find(win, "Flieg nach Freiwindposten"):GetParent(), "OnClick")
ok(TN.steps[13].elements[1].skip == true, "Zeilen-Klick hakt bei RXP ab")

-- Pfeil
eq(af:GetWidth(), 44, "Pfeil groesser")
af:SetSize(32, 32)
eq(af:GetWidth(), 44, "RXP setzt Groesse zurueck -> wieder Neon-Groesse")
ok(af.text:GetAlpha() == 0 and not af.text:IsShown(), "RXP-Pfeiltext unsichtbar")
af.element = { step = TN.steps[13] }; af.distance = 245
af.text:SetText("Fly to Freewind Post\n(245yd)")
local PF = N.Pfeil.P
eq(strip(PF.dist:GetText()), "245 m", "Pfeil: Entfernung")
eq(PF.title:GetText(), "Flieg nach Freiwindposten", "Pfeil: Ziel deutsch")
af.texture:SetRotation(1.25)
eq(PF.aglow.__rot, 1.25, "Pfeil-Leuchten dreht mit")
af.text:SetText("~")
ok(not PF.pill:IsShown(), "falscher Kontinent: keine Entfernung")
af.text:SetText("Fly to Freewind Post\n(245yd)"); af.texture:SetRotation(0.45)
if OUT then L.dump(af, OUT .. "/rxn_pfeil.tsv", { levels = true, noHover = true }) end

-- Guide-Tipp sitzt im Neon-Fenster
TN.currentStep = 13
RXP:LoadGuide(guide("RestedXP Forever Guide (H)", "1-6 Durotar", { currentStep = 1,
  steps = { { elements = { { text = "Talk to " .. C .. "Gornek|r", textOnly = true }, { tag = "accept", questId = 4641, text = "Accept Your Place In The World" } } } } }))
N.UpdateTipp(); tick()
local tipp = N.TippButton()
ok(tipp:GetParent() == win and tipp:IsVisible(), "Tipp im Neon-Fenster")
t = vis(win)
ok(has(t, "GUIDE FÜR STUFE 28 LADEN") and has(t, "28-30 Tausend Nadeln"), "Tipp-Text")
if OUT then L.dump(win, OUT .. "/rxn_tipp.tsv", { levels = true, noHover = true }) end
probs = L.problems(win)
ok(#probs == 0, "Layout Tipp: " .. tostring(probs[1]))
W.call(tipp, "OnClick")
eq(RXP.currentGuide and RXP.currentGuide.name, "28-30 Thousand Needles", "Klick laedt den passenden Guide")
-- im Kampf wird nichts geladen
RXP.currentGuide = nil; W.combat = true
N.LoadRecommended()
ok(RXP.currentGuide == nil, "im Kampf kein Laden"); W.combat = false
-- ohne Guide: klare Ansage + Guide-Menue
N.UpdateTipp(); tick()
t = vis(win)
ok(has(t, "KEIN GUIDE GELADEN"), "ohne Guide: Hinweis")
W.call(find(win, "GUIDE WÄHLEN"):GetParent(), "OnClick")
eq(menuOpened, 1, "GUIDE WÄHLEN oeffnet RXP-Menue")
RXP:LoadGuideTable("RestedXP Forever Guide (H)", "28-30 Thousand Needles"); RXP.SetStep(13); tick()

-- ---------------------------------------------------------------- Befehle
SlashCmdList.RXPNEON("fenster rxp")
ok(not win:IsShown() and F:GetAlpha() == 1 and F:GetScale() == 1, "/rxn fenster rxp: RXP-Original zurueck")
ok(tipp:GetParent() == F.BottomFrame, "Tipp zurueck ins RXP-Fenster")
SlashCmdList.RXPNEON("fenster neon")
ok(win:IsShown() and F:GetAlpha() == 0, "/rxn fenster neon")
SlashCmdList.RXPNEON("groesse 1,3")
eq(win:GetScale(), 1.3, "/rxn groesse 1,3")
SlashCmdList.RXPNEON("größe 9")
eq(win:GetScale(), 1.6, "/rxn größe: Obergrenze")
SlashCmdList.RXPNEON("reset")
eq(win:GetScale(), 1, "/rxn reset")
SlashCmdList.RXPNEON("aus")
eq(RXP.settings.profile.activeTheme, "RXP Blue", "/rxn aus -> altes Theme")
ok(not win:IsShown() and F:GetAlpha() == 1, "/rxn aus: RXP-Original")
eq(af:GetWidth(), 32, "/rxn aus: Pfeil Originalgroesse")
ok(af.text:GetAlpha() == 1 and af.text:IsShown() and not N.Pfeil.P.dial:IsShown(), "/rxn aus: RXP-Pfeiltext zurueck")
SlashCmdList.RXPNEON("an")
eq(RXP.settings.profile.activeTheme, "Tiry Neon", "/rxn an")
ok(win:IsShown() and F:GetAlpha() == 0 and af:GetWidth() == 44, "/rxn an: Neon zurueck")
SlashCmdList.RXPNEON("englisch")
eq(T("Train your class spells"), "Train your class spells", "/rxn englisch")
SlashCmdList.RXPNEON("deutsch")
eq(T("Train your class spells"), "Lerne deine Klassenzauber", "/rxn deutsch")
SlashCmdList.RXPNEON("")
ok(W.prints[#W.prints]:find("/rxn tipp", 1, true) ~= nil, "Hilfe ausgegeben")
-- RXP-Original-Modus: alter Skin weiter vorhanden
SlashCmdList.RXPNEON("fenster rxp")
ok(F.BottomFrame.rxn and F.BottomFrame.rxn.body:IsShown(), "RXP-Modus: Glas-Skin")
SlashCmdList.RXPNEON("fenster neon")
ok(#W.errors == 0, "Fehler gesamt: " .. tostring(W.errors[1]))

if fails > 0 then say(fails .. " von " .. n .. " Pruefungen fehlgeschlagen") os.exit(1) end
say("RXN TESTS OK (" .. n .. " Pruefungen)")

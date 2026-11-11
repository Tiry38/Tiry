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
F.CurrentStepFrame = CreateFrame("Frame", nil, F)
F.CurrentStepFrame:SetPoint("TOPLEFT", F.BottomFrame, "TOPLEFT", 6, -34); F.CurrentStepFrame:SetPoint("TOPRIGHT", F.BottomFrame, "TOPRIGHT", -6, -34)
F.CurrentStepFrame:SetHeight(150); F.CurrentStepFrame.framePool = {}
F.ScrollChild = CreateFrame("Frame", "RXPFrame_steps", F.BottomFrame)
F.ScrollChild:SetPoint("TOPLEFT", F.BottomFrame, "TOPLEFT", 6, -196); F.ScrollChild:SetPoint("BOTTOMRIGHT", F.BottomFrame, "BOTTOMRIGHT", -20, 8)
F.ScrollChild.framePool = {}
local visuals = 0
function F:UpdateVisuals() visuals = visuals + 1 end

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
  themes = {}, guides = guides, settings = { profile = { activeTheme = "RXP Blue" } },
  v2 = { IsGuideWindowEnabled = function() return false end },
}
G.RXP = RXP
function RXP:RegisterTheme(t) assert(t.name and t.author, "Theme ohne Name/Autor") self.themes[t.name] = t end
function RXP.RenderFrame() rendered[#rendered + 1] = RXP.settings.profile.activeTheme; F:UpdateVisuals() end
function RXP.SetupArrow() end
function RXP.IsGuideActive(g) return not g.mageOnly and not g.alliance end
function RXP.ReplaceNpcIds(text, element) return (text:gsub("npc:(.-):(%d+)", "%1")) end
RXP.settings.ReplaceColors = function(el) end
function RXP.SetStep() end
function RXP:LoadGuide(g) self.currentGuide = g end
function RXP:LoadGuideTable(group, name) self:LoadGuide(guides[group .. "||" .. name]) end
RXP.arrowFrame = CreateFrame("Frame", "RXPG_ARROW", UIParent)
RXP.arrowFrame:SetSize(32, 32); RXP.arrowFrame:SetPoint("TOP", UIParent, "TOP", 0, -80)
RXP.arrowFrame.texture = RXP.arrowFrame:CreateTexture(nil, "ARTWORK"); RXP.arrowFrame.texture:SetAllPoints()
RXP.arrowFrame.texture:SetTexture("Interface\\AddOns\\RXPNeon\\Media\\rxp_navigation_arrow-1")
RXP.arrowFrame.text = RXP.arrowFrame:CreateFontString(nil, "OVERLAY")
RXP.arrowFrame.text:SetFont("Fonts\\FRIZQT__.TTF", 9, "OUTLINE"); RXP.arrowFrame.text:SetPoint("TOP", RXP.arrowFrame, "BOTTOM", 0, -5)

-- ---------------------------------------------------------------- Add-on laden (Reihenfolge wie TOC)
for _, f in ipairs({ "Namen.lua", "Phrasen.lua", "Deutsch.lua", "RXPNeon.lua" }) do
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

-- Fenster mit Schritten fuellen (wie RXP es nach dem Laden tut)
local function stepFrame(i, title, lines)
  local sf = F.CurrentStepFrame.framePool[i] or CreateFrame("Frame", nil, F.CurrentStepFrame)
  F.CurrentStepFrame.framePool[i] = sf
  sf:ClearAllPoints()
  if i == 1 then sf:SetPoint("TOPLEFT", F.CurrentStepFrame, "TOPLEFT", 0, 0); sf:SetPoint("TOPRIGHT", F.CurrentStepFrame, "TOPRIGHT", 0, 0)
  else sf:SetPoint("TOPLEFT", F.CurrentStepFrame.framePool[i - 1], "BOTTOMLEFT", 0, -9); sf:SetPoint("TOPRIGHT", F.CurrentStepFrame.framePool[i - 1], "BOTTOMRIGHT", 0, -9) end
  sf.number = sf.number or CreateFrame("Frame", nil, sf)
  sf.number:SetPoint("TOPLEFT", sf, "TOPLEFT", 7, 5)
  sf.number.text = sf.number.text or sf.number:CreateFontString(nil, "OVERLAY")
  sf.number.text:SetFont("Fonts\\ARIALN.TTF", 11, ""); sf.number.text:SetPoint("CENTER", sf.number, "CENTER", 2, 1); sf.number.text:SetText(title)
  sf.number:SetSize(sf.number.text:GetStringWidth() + 10, 17)
  sf.elements = sf.elements or {}
  local y = -14
  for j, line in ipairs(lines) do
    local ef = sf.elements[j] or CreateFrame("Frame", nil, sf); sf.elements[j] = ef
    ef:SetPoint("TOPLEFT", sf, "TOPLEFT", 6, y); ef:SetPoint("TOPRIGHT", sf, "TOPRIGHT", -6, y); ef:SetHeight(16)
    ef.button = ef.button or CreateFrame("Button", nil, ef)
    ef.button:SetSize(12, 12); ef.button:SetPoint("LEFT", ef, "LEFT", 2, 0)
    ef.button.tex = ef.button.tex or ef.button:CreateTexture(nil, "ARTWORK"); ef.button.tex:SetAllPoints()
    ef.button.tex:SetTexture("Interface\\AddOns\\RXPNeon\\Media\\" .. (line[2] and "rxp-checked-32" or "rxp-btn-blank-32"))
    ef.text = ef.text or ef:CreateFontString(nil, "OVERLAY")
    ef.text:SetFont("Fonts\\ARIALN.TTF", 12, ""); ef.text:SetPoint("LEFT", ef.button, "RIGHT", 6, 0); ef.text:SetPoint("RIGHT", ef, "RIGHT", -2, 0)
    ef.text:SetJustifyH("LEFT"); ef.text:SetText(RXP.ReplaceNpcIds(line[1], line[3]))
    y = y - 18
  end
  sf:SetHeight(-y + 4)
end
RXP:LoadGuideTable("RestedXP Forever Guide (H)", "28-30 Thousand Needles")
RXP.currentGuide.steps = { {}, {}, {} }
F.GuideName.text:SetText("28-30 Thousand Needles\nSpeedrun Guide 22-30")
stepFrame(1, "Schritt 12", {
  { "|TInterface\\AddOns\\RXPNeon\\Media\\dot:12|tTalk to " .. C .. "Zangen Stonehoof|r", false },
  { "Turn in The Sacred Flame", true, { tag = "turnin", questId = 1195, step = {} } },
  { "Accept The Sacred Flame", false, { tag = "accept", questId = 1196, step = {} } } })
stepFrame(2, "Schritt 13", { { "Fly to Freewind Post", false } })
stepFrame(3, "Schritt 14", { { "Kill " .. C .. "Galak Scouts|r. Loot them for their " .. C .. "Wanted Poster|r", false } })
for i, txt in ipairs({ "Get the Freewind Post flight path", "Set your Hearthstone to Freewind Post", "Travel to Thousand Needles", "Train your class spells" }) do
  local row = F.ScrollChild.framePool[i] or CreateFrame("Frame", nil, F.ScrollChild); F.ScrollChild.framePool[i] = row
  row:SetPoint("TOPLEFT", F.ScrollChild, "TOPLEFT", 2, -3 - (i - 1) * 22); row:SetPoint("TOPRIGHT", F.ScrollChild, "TOPRIGHT", 2, -3 - (i - 1) * 22)
  row:SetHeight(20); row:EnableMouse(true)
  row.text = row.text or row:CreateFontString(nil, "OVERLAY")
  row.text:SetFont("Fonts\\ARIALN.TTF", 11, ""); row.text:SetPoint("LEFT", row, "LEFT", 6, 0); row.text:SetPoint("RIGHT", row, "RIGHT", -6, 0)
  row.text:SetJustifyH("LEFT"); row.text:SetText((i + 14) .. "  " .. RXP.ReplaceNpcIds(txt))
end
RXP.SetStep(12)   -- Hook: Skin + Tipp
ok(#W.errors == 0, "Fehler beim Zeichnen: " .. tostring(W.errors[1]))
ok(F.BottomFrame.rxn and F.BottomFrame.rxn.body:IsShown(), "Hauptflaeche hat Glas-Skin")
ok(F.CurrentStepFrame.framePool[1].rxn and F.CurrentStepFrame.framePool[1].number.rxn, "Schritt + Nummer haben Skin")
ok(F.ScrollChild.framePool[1].rxn and F.ScrollChild.framePool[1].rxn.hl, "Zeile hat Hover-Glow")

-- Tipp: Guide passt -> kein Tipp; falscher Guide (1-6) -> Tipp, Klick laedt den passenden
local function tippBtn() for _, c in ipairs(F.BottomFrame.__children) do if c.__kind == "Button" then return c end end end
ok(tippBtn() and not tippBtn():IsShown(), "kein Tipp, wenn der Guide zur Stufe passt")
if OUT then L.dump(F, OUT .. "/rxn_fenster.tsv", { levels = true }) end
local probs = L.problems(F)
ok(#probs == 0, "Layout: " .. tostring(probs[1]))

RXP.currentGuide = guide("RestedXP Forever Guide (H)", "1-6 Durotar", { steps = { {} } })
N.UpdateTipp()
ok(tippBtn():IsShown(), "Tipp bei unpassendem Guide (1-6 mit Stufe 28)")
local function texts(f) local t = {} for _, r in ipairs(f.__children or {}) do if r.GetText and r:GetText() then t[#t + 1] = r:GetText() end end return table.concat(t, " | ") end
ok(texts(tippBtn()):find("GUIDE FÜR STUFE 28 LADEN", 1, true) and texts(tippBtn()):find("28-30 Tausend Nadeln", 1, true), "Tipp-Text: " .. texts(tippBtn()))
if OUT then L.dump(F, OUT .. "/rxn_tipp.tsv", { levels = true }) end
W.call(tippBtn(), "OnClick")
eq(RXP.currentGuide and RXP.currentGuide.name, "28-30 Thousand Needles", "Klick laedt den passenden Guide")
-- im Kampf wird nichts geladen
RXP.currentGuide = nil; W.combat = true
N.LoadRecommended()
ok(RXP.currentGuide == nil, "im Kampf kein Laden"); W.combat = false

-- ---------------------------------------------------------------- Befehle
SlashCmdList.RXPNEON("aus")
eq(RXP.settings.profile.activeTheme, "RXP Blue", "/rxn aus -> altes Theme")
ok(not F.BottomFrame.rxn.body:IsShown(), "/rxn aus versteckt den Skin")
SlashCmdList.RXPNEON("an")
eq(RXP.settings.profile.activeTheme, "Tiry Neon", "/rxn an")
ok(F.BottomFrame.rxn.body:IsShown(), "/rxn an zeigt den Skin")
SlashCmdList.RXPNEON("englisch")
eq(T("Train your class spells"), "Train your class spells", "/rxn englisch")
SlashCmdList.RXPNEON("deutsch")
eq(T("Train your class spells"), "Lerne deine Klassenzauber", "/rxn deutsch")
SlashCmdList.RXPNEON("")
ok(W.prints[#W.prints]:find("/rxn tipp", 1, true) ~= nil, "Hilfe ausgegeben")
-- Arrow
ok(RXP.arrowFrame.rxnGlow ~= nil, "Pfeil hat Glow")
ok(#W.errors == 0, "Fehler gesamt: " .. tostring(W.errors[1]))

if fails > 0 then say(fails .. " von " .. n .. " Pruefungen fehlgeschlagen") os.exit(1) end
say("RXN TESTS OK (" .. n .. " Pruefungen)")

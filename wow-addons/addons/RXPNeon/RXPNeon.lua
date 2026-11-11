-- RXPNeon 1.0.0 (Tiry): Neon-Glas-Optik und deutsche Schritt-Texte fuer RestedXP Guides (RXPGuides).
-- Eigenes Zusatz-Add-on: aendert RXP nicht, sondern nutzt dessen Theme-Schnittstelle und haengt sich an
-- oeffentliche Funktionen (hooksecurefunc / Wrapper). Ohne RXPGuides tut es nichts.
local VERSION = "1.0.0"
local ADDON = ...
RXPNeon = RXPNeon or {}
local N = RXPNeon
N.VERSION = VERSION

local MEDIA = "Interface\\AddOns\\RXPNeon\\Media\\"
local THEME_NAME = "Tiry Neon"
local FONT = "Fonts\\ARIALN.TTF"
local GREEN = { 0.224, 1.0, 0.420 }  -- #39FF6B
local TEAL = { 0.176, 0.886, 0.902 } -- #2DE2E6
local DEF = { skin = true, deutsch = true, tipp = true }
local DB

local function P(msg) print("|cff39ff6bRXP|r|cff2de2e6Neon|r: " .. tostring(msg)) end
N.P = P
local function RXP() return _G.RXP end
N.RXP = RXP

-- ---------------------------------------------------------------- Hilfen fuer Flaechen
local SLICE
local function CanSlice()
  if SLICE == nil then
    local t = UIParent:CreateTexture(); SLICE = t.SetTextureSliceMargins ~= nil; t:Hide()
  end
  return SLICE
end
local function Col(r, g, b, a) return CreateColor and CreateColor(r, g, b, a or 1) end
local function Grad(t, dir, c1, c2)
  t:SetVertexColor(1, 1, 1, 1)
  if t.SetGradient and CreateColor then
    pcall(t.SetGradient, t, dir, Col(c1[1], c1[2], c1[3], c1[4]), Col(c2[1], c2[2], c2[3], c2[4]))
  else
    t:SetVertexColor(c1[1], c1[2], c1[3], c1[4] or 1)
  end
end
-- runde Flaeche (9-Slice aus card/card_s), inset < 0 = groesser als der Rahmen
local function Card(f, layer, sub, small, inset)
  local t = f:CreateTexture(nil, layer or "BACKGROUND", nil, sub or 0)
  t:SetTexture(MEDIA .. (small and "card_s" or "card"))
  local i = inset or 0
  t:SetPoint("TOPLEFT", i, -i); t:SetPoint("BOTTOMRIGHT", -i, i)
  if CanSlice() then
    local m = small and 8 or 14
    pcall(t.SetTextureSliceMargins, t, m, m, m, m); pcall(t.SetTextureSliceMode, t, 0)
  end
  return t
end
N.Card, N.Grad = Card, Grad

local BODY_TOP = { 0.085, 0.095, 0.115, 0.95 }
local BODY_BOT = { 0.035, 0.040, 0.050, 0.95 }
local RIM_L = { GREEN[1], GREEN[2], GREEN[3], 0.85 }
local RIM_R = { TEAL[1], TEAL[2], TEAL[3], 0.85 }

-- Skin-Arten: panel (Hauptflaeche), head (Kopf-Kapsel), foot (Fuss), step (aktiver Schritt),
-- badge (Schritt-Nummer), row (Zeile in der Schrittliste)
local function Skin(f, kind)
  if not f or not f.CreateTexture then return end
  local s = f.rxn
  if not s then
    s = { kind = kind }
    f.rxn = s
    if kind == "panel" then
      s.glow = f:CreateTexture(nil, "BACKGROUND", nil, -8)
      s.glow:SetTexture(MEDIA .. "glow"); s.glow:SetPoint("TOPLEFT", -22, 22); s.glow:SetPoint("BOTTOMRIGHT", 22, -22)
      s.glow:SetVertexColor(GREEN[1], GREEN[2], GREEN[3], 0.10)
      s.rim = Card(f, "BACKGROUND", -7, false, -1); Grad(s.rim, "HORIZONTAL", RIM_L, RIM_R)
      s.body = Card(f, "BACKGROUND", -6, false, 0); Grad(s.body, "VERTICAL", BODY_BOT, BODY_TOP)
      s.sheen = Card(f, "BACKGROUND", -5, false, 0); s.sheen:ClearAllPoints()
      s.sheen:SetPoint("TOPLEFT"); s.sheen:SetPoint("TOPRIGHT"); s.sheen:SetHeight(46)
      Grad(s.sheen, "VERTICAL", { 1, 1, 1, 0 }, { 1, 1, 1, 0.05 })
    elseif kind == "head" then
      s.glow = f:CreateTexture(nil, "BACKGROUND", nil, -8)
      s.glow:SetTexture(MEDIA .. "glow"); s.glow:SetPoint("TOPLEFT", -16, 14); s.glow:SetPoint("BOTTOMRIGHT", 16, -14)
      s.glow:SetVertexColor(TEAL[1], TEAL[2], TEAL[3], 0.16)
      s.rim = Card(f, "BACKGROUND", -7, false, -1); Grad(s.rim, "HORIZONTAL", RIM_L, RIM_R)
      s.body = Card(f, "BACKGROUND", -6, false, 0)
      Grad(s.body, "HORIZONTAL", { 0.055, 0.12, 0.09, 0.97 }, { 0.05, 0.10, 0.12, 0.97 })
      s.line = Card(f, "BACKGROUND", -5, true, 0); s.line:ClearAllPoints()
      s.line:SetPoint("BOTTOMLEFT", 40, 3); s.line:SetPoint("BOTTOMRIGHT", -14, 3); s.line:SetHeight(3)
      Grad(s.line, "HORIZONTAL", { GREEN[1], GREEN[2], GREEN[3], 0.9 }, { TEAL[1], TEAL[2], TEAL[3], 0.2 })
    elseif kind == "foot" then
      -- RXP haengt den Fusstext an die Kopfzeile (gleiche Ebene 6) – Skin eine Ebene tiefer, sonst deckt er den Text zu
      local under = CreateFrame("Frame", nil, f)
      under:SetAllPoints(f); under:SetFrameLevel(math.max(1, f:GetFrameLevel() - 1))
      s.under = under
      s.body = Card(under, "BACKGROUND", -6, true, 0)
      Grad(s.body, "HORIZONTAL", { 0.06, 0.07, 0.085, 0.92 }, { 0.045, 0.05, 0.06, 0.92 })
    elseif kind == "step" then
      s.body = Card(f, "BACKGROUND", -6, true, 0)
      Grad(s.body, "VERTICAL", { 0.07, 0.08, 0.095, 0.93 }, { 0.11, 0.125, 0.145, 0.93 })
      s.bar = Card(f, "BACKGROUND", -5, true, 0); s.bar:ClearAllPoints()
      s.bar:SetPoint("TOPLEFT", 3, -6); s.bar:SetPoint("BOTTOMLEFT", 3, 6); s.bar:SetWidth(3)
      Grad(s.bar, "VERTICAL", { TEAL[1], TEAL[2], TEAL[3], 1 }, { GREEN[1], GREEN[2], GREEN[3], 1 })
    elseif kind == "badge" then
      s.body = Card(f, "BACKGROUND", -6, true, 0)
      Grad(s.body, "HORIZONTAL", { GREEN[1], GREEN[2], GREEN[3], 1 }, { TEAL[1], TEAL[2], TEAL[3], 1 })
    elseif kind == "row" then
      s.body = Card(f, "BACKGROUND", -6, true, 0)
      s.body:SetVertexColor(1, 1, 1, 0.035)
      s.hl = Card(f, "HIGHLIGHT", 0, true, 0)
      Grad(s.hl, "HORIZONTAL", { GREEN[1], GREEN[2], GREEN[3], 0.16 }, { TEAL[1], TEAL[2], TEAL[3], 0.06 })
    end
  end
  local on = DB and DB.skin
  -- RXPs eckige Hintergrundflaeche unter dem Skin unsichtbar machen (RXP setzt sie bei jedem Neuzeichnen neu)
  if on and f.SetBackdropColor and f.GetBackdrop and f:GetBackdrop() then
    f:SetBackdropColor(0, 0, 0, 0)
    if f.SetBackdropBorderColor then f:SetBackdropBorderColor(0, 0, 0, 0) end
  end
  for k, t in pairs(s) do
    if type(t) == "table" and t.SetShown then t:SetShown(on and true or false) end
  end
  return s
end
N.Skin = Skin

local function TextStyle(fs, size, r, g, b)
  if not fs then return end
  if size then fs:SetFont(FONT, size, "") end
  fs:SetShadowColor(0, 0, 0, 0.9); fs:SetShadowOffset(1, -1)
  if r then fs:SetTextColor(r, g, b) end
end

-- ---------------------------------------------------------------- Theme
N.THEME = {
  name = THEME_NAME, author = "Tiry", displayName = "Tiry Neon",
  background = { 0.05, 0.06, 0.075, 0.92 }, -- Nebenfenster (Tracker, Item-Knopf): dunkles Glas; Hauptfenster zeichnet der Skin rund
  bottomFrameBG = { 0, 0, 0, 0 },
  bottomFrameHighlight = { 0, 0, 0, 0 },
  mapPins = { GREEN[1], GREEN[2], GREEN[3], 1 },
  tooltip = "|cFF39FF6B",
  texturePath = "Interface/AddOns/RXPNeon/Media/",
  headerTexture = "none",
  font = FONT,
  textColor = { 0.93, 0.96, 0.95 },
  applicable = function() return true end,
  bgTextures = { edge = "Interface/BUTTONS/WHITE8X8", bottom = "Interface/BUTTONS/WHITE8X8" },
  edges = { edge = MEDIA .. "rxp-borders", guideName = MEDIA .. "rxp-borders" },
}

-- ---------------------------------------------------------------- Skin anwenden
local function ClassIcon(tex)
  if not tex then return end
  local _, class = UnitClass("player")
  local c = class and CLASS_ICON_TCOORDS and CLASS_ICON_TCOORDS[class]
  if c then
    tex:SetTexture("Interface\\TargetingFrame\\UI-Classes-Circles")
    tex:SetTexCoord(c[1], c[2], c[3], c[4])
  end
end

function N.SkinMain()
  local F = _G.RXPFrame
  if not (F and DB) then return end
  local r = RXP()
  if r and r.v2 and r.v2.IsGuideWindowEnabled and r.v2:IsGuideWindowEnabled() then return end
  Skin(F.BottomFrame, "panel"); Skin(F.GuideName, "head"); Skin(F.Footer, "foot")
  local G = F.GuideName
  if not DB.skin then
    if G and G.icon then G.icon:SetSize(42, 42) end
    if G and G.classIcon then G.classIcon:SetSize(24, 24) end
    return
  end
  if G then
    TextStyle(G.text, 14, 1, 1, 1)
    if G.icon then G.icon:SetSize(34, 34) end
    if G.classIcon then ClassIcon(G.classIcon); G.classIcon:SetSize(18, 18) end
  end
  if F.Footer and F.Footer.text then TextStyle(F.Footer.text, 10, 0.55, 0.62, 0.6) end
  if F.activeItemFrame then Skin(F.activeItemFrame, "step") end
end

function N.SkinSteps()
  local F = _G.RXPFrame
  if not (F and DB) then return end
  local r = RXP()
  if r and r.v2 and r.v2.IsGuideWindowEnabled and r.v2:IsGuideWindowEnabled() then return end
  local on = DB.skin
  local pool = F.CurrentStepFrame and F.CurrentStepFrame.framePool
  for _, sf in ipairs(pool or {}) do
    Skin(sf, "step")
    if sf.number then
      Skin(sf.number, "badge")
      if on and sf.number.text then TextStyle(sf.number.text, nil, 0.03, 0.08, 0.06); sf.number.text:SetShadowOffset(0, 0) end
    end
    if on then
      for _, ef in ipairs(sf.elements or {}) do
        if ef.text then TextStyle(ef.text, nil) end  -- Groesse bleibt RXPs Einstellung (Zeilenhoehen!)
      end
    end
  end
  local rows = F.ScrollChild and F.ScrollChild.framePool
  for _, row in ipairs(rows or {}) do
    Skin(row, "row")
    if on and row.text then TextStyle(row.text, nil) end
  end
end

function N.SkinArrow()
  local r = RXP(); local af = r and r.arrowFrame
  if not (af and DB and DB.skin) then return end
  if not af.rxnGlow then
    af.rxnGlow = af:CreateTexture(nil, "BACKGROUND")
    af.rxnGlow:SetTexture(MEDIA .. "glow"); af.rxnGlow:SetPoint("CENTER"); af.rxnGlow:SetSize(76, 76)
    af.rxnGlow:SetVertexColor(GREEN[1], GREEN[2], GREEN[3], 0.30); af.rxnGlow:SetBlendMode("ADD")
  end
  af:SetSize(40, 40)
  if af.text then
    af.text:SetFont(FONT, 13, "OUTLINE")
    af.text:SetTextColor(0.93, 0.96, 0.95)
  end
end

-- ---------------------------------------------------------------- Deutsch: Hooks
local function TranslateGuideNames()
  local r = RXP()
  if not (r and r.guides and DB.deutsch) then return end
  r.GuideNames = r.GuideNames or {}
  local GN = r.GuideNames
  local function add(s)
    if type(s) ~= "string" or s == "" or GN[s] then return end
    local d = N.T(s)
    if d ~= s then GN[s] = d end
  end
  for _, g in pairs(r.guides) do
    if type(g) == "table" then
      add(g.displayname); add(g.name); add(g.subgroup)
      if type(g.group) == "string" then
        local grp = g.group:gsub("^%*", "")
        if not GN[grp] then
          local d = grp:gsub("Guide %(H%)", "Guide (Horde)"):gsub("Guide %(A%)", "Guide (Allianz)")
            :gsub("Speedrun Guide", "Speedrun-Guide"):gsub("Dungeon Guide", "Dungeon-Guide"):gsub("Dungeon Quests", "Dungeon-Quests")
          if d ~= grp then GN[grp] = d end
        end
      end
    end
  end
end
N.TranslateGuideNames = TranslateGuideNames

local hooked = false
local function InstallHooks()
  local r = RXP()
  if hooked or not r then return end
  hooked = true
  -- 1) Jeder angezeigte Schritt-Text laeuft durch ReplaceNpcIds -> danach uebersetzen
  if type(r.ReplaceNpcIds) == "function" then
    local orig = r.ReplaceNpcIds
    r.ReplaceNpcIds = function(text, element)
      local out = orig(text, element)
      if DB and DB.deutsch and type(out) == "string" then
        local ok, t = pcall(N.T, out, element)
        if ok and t then return t end
      end
      return out
    end
  end
  -- 2) Schritt-Titel / Pfeil-Text (nur Schritte, nie Quest-Elemente: deren Titel braucht RXP zum Abgleich)
  if r.settings and type(r.settings.ReplaceColors) == "function" then
    hooksecurefunc(r.settings, "ReplaceColors", function(el)
      if not (DB and DB.deutsch) or type(el) ~= "table" or not el.elements then return end
      for _, k in ipairs({ "title", "arrowtext" }) do
        local v = el[k]
        if type(v) == "string" and v ~= "" and el["rxn_" .. k] ~= v then
          local ok, t = pcall(N.T, v)
          if ok and t then el[k] = t; el["rxn_" .. k] = t end
        end
      end
    end)
  end
  -- 3) Kopfzeile (Guide-Name)
  local G = _G.RXPFrame and _G.RXPFrame.GuideName
  if G and G.text then
    local busy
    hooksecurefunc(G.text, "SetText", function(fs, s)
      if busy or not (DB and DB.deutsch) or type(s) ~= "string" then return end
      local ok, t = pcall(N.T, s)
      if ok and t and t ~= s then busy = true; fs:SetText(t); busy = false end
    end)
  end
  -- 4) Skin nach jedem Neuzeichnen
  if _G.RXPFrame and _G.RXPFrame.UpdateVisuals then hooksecurefunc(_G.RXPFrame, "UpdateVisuals", function() N.SkinMain() end) end
  if type(r.SetStep) == "function" then hooksecurefunc(r, "SetStep", function() N.SkinSteps(); N.UpdateTipp() end) end
  if type(r.LoadGuide) == "function" then hooksecurefunc(r, "LoadGuide", function() N.SkinSteps(); N.UpdateTipp() end) end
  if type(r.SetupArrow) == "function" then hooksecurefunc(r, "SetupArrow", function() N.SkinArrow() end) end
end
N.InstallHooks = InstallHooks

-- ---------------------------------------------------------------- Theme aktivieren
function N.Apply()
  local r = RXP()
  if not (r and r.RegisterTheme and r.settings and r.settings.profile) then return false end
  if not (r.themes and r.themes[THEME_NAME]) then r:RegisterTheme(N.THEME) end
  local prof = r.settings.profile
  if DB.skin then
    if prof.activeTheme ~= THEME_NAME then DB.altesTheme = prof.activeTheme end
    prof.activeTheme = THEME_NAME
  elseif prof.activeTheme == THEME_NAME then
    prof.activeTheme = DB.altesTheme or "RXP Blue"
  end
  TranslateGuideNames()
  if not InCombatLockdown() then
    pcall(r.RenderFrame)            -- Theme laden, Fenster neu zeichnen, Guide-Menue neu (deutsche Namen)
    if r.SetupArrow then pcall(r.SetupArrow) end
  end
  N.SkinMain(); N.SkinSteps(); N.SkinArrow(); N.UpdateTipp()
  return true
end

-- ---------------------------------------------------------------- Guide-Empfehlung fuer die eigene Stufe
-- Liefert guide (oder nil): Name "a-b Gebiet", a <= Stufe <= b, fuer Klasse/Fraktion aktiv (RXP prueft das),
-- bevorzugt deutsche Route (lang/deDE), dann der Haupt-Speedrun-Guide, keine Dungeon-/Klassen-Sonderwege.
function N.Recommend(level)
  local r = RXP()
  if not (r and r.guides) then return end
  level = level or UnitLevel("player")
  local best, bestScore
  for _, g in pairs(r.guides) do
    if type(g) == "table" and type(g.name) == "string" and not g.chapter then
      local a, b = g.name:match("^(%d+)%-(%d+)%s")
      a, b = tonumber(a), tonumber(b)
      if a and b and a <= level and level <= b then
        local ok, active = true, true
        if r.IsGuideActive then ok, active = pcall(r.IsGuideActive, g) end
        local grp = type(g.group) == "string" and g.group or ""
        if ok and active and not grp:find("Dungeon") and not grp:find("Survival") then
          local score = a                      -- naeher an der eigenen Stufe = besser
          if grp:find("Route") then score = score + 300           -- deutsche RXP-Route
          elseif grp:find("Forever Guide") then score = score + 200 end
          if g.name:find("AoE") or grp:find("AoE") or grp:find("Mage") then score = score - 150 end
          if level == b and b > a then score = score - 20 end  -- am Ende des Abschnitts: naechster passt besser
          if not bestScore or score > bestScore then best, bestScore = g, score end
        end
      end
    end
  end
  return best
end

local function GuideFits(g, level)
  if not (g and type(g.name) == "string") then return false end
  local a, b = g.name:match("^(%d+)%-(%d+)%s")
  a, b = tonumber(a), tonumber(b)
  if not (a and b) then return true end   -- unbekanntes Format: nicht draengeln
  return level >= a - 1 and level <= b + 1
end
N.GuideFits = GuideFits

function N.LoadRecommended()
  local r = RXP()
  local g = N.Recommend()
  if not g then P("Kein passender Guide fuer Stufe " .. UnitLevel("player") .. " gefunden."); return end
  if InCombatLockdown() then P("Nach dem Kampf nochmal klicken."); return end
  if r.LoadGuideTable then
    r:LoadGuideTable(g.group, g.name)
  elseif r.LoadGuide then
    r:LoadGuide(g)
  end
  P("Guide geladen: |cff39ff6b" .. N.T(g.name) .. "|r")
end

local tipp
function N.UpdateTipp()
  local F = _G.RXPFrame
  if not (F and DB) then return end
  if not tipp then
    tipp = CreateFrame("Button", nil, F.BottomFrame or F)
    -- unten im Fenster: der aktuelle Schritt bleibt lesbar; Ebene klar ueber Schritten und Zeilen
    tipp:SetSize(236, 46); tipp:SetPoint("BOTTOM", F.BottomFrame or F, "BOTTOM", 0, 14)
    tipp:SetFrameLevel((F.GuideName and F.GuideName:GetFrameLevel() or 6) + 14)
    tipp.glow = tipp:CreateTexture(nil, "BACKGROUND", nil, -8)
    tipp.glow:SetTexture(MEDIA .. "glow"); tipp.glow:SetPoint("TOPLEFT", -18, 16); tipp.glow:SetPoint("BOTTOMRIGHT", 18, -16)
    tipp.glow:SetVertexColor(GREEN[1], GREEN[2], GREEN[3], 0.35)
    tipp.body = Card(tipp, "BACKGROUND", -6, false, 0)
    Grad(tipp.body, "HORIZONTAL", { GREEN[1], GREEN[2], GREEN[3], 1 }, { TEAL[1], TEAL[2], TEAL[3], 1 })
    tipp.hl = Card(tipp, "HIGHLIGHT", 0, false, 0); tipp.hl:SetVertexColor(1, 1, 1, 0.18)
    tipp.top = tipp:CreateFontString(nil, "OVERLAY"); TextStyle(tipp.top, 11, 0.03, 0.10, 0.07)
    tipp.top:SetShadowOffset(0, 0); tipp.top:SetPoint("TOP", 0, -8)
    tipp.name = tipp:CreateFontString(nil, "OVERLAY"); TextStyle(tipp.name, 14, 0.02, 0.06, 0.04)
    tipp.name:SetShadowOffset(0, 0); tipp.name:SetPoint("BOTTOM", 0, 8); tipp.name:SetWidth(220)
    tipp:SetScript("OnClick", function() N.LoadRecommended() end)
  end
  local r = RXP()
  local lvl = UnitLevel("player")
  local cur = r and r.currentGuide
  local need = DB.tipp and not (cur and cur.steps and #cur.steps > 0 and GuideFits(cur, lvl))
  local g = need and N.Recommend(lvl)
  if g and not (cur and cur.name == g.name) then
    tipp.top:SetText("GUIDE FÜR STUFE " .. lvl .. " LADEN")
    tipp.name:SetText(N.T(g.name))
    tipp:Show()
  else
    tipp:Hide()
  end
end

-- ---------------------------------------------------------------- Start
local ev = CreateFrame("Frame")
ev:RegisterEvent("ADDON_LOADED")
ev:RegisterEvent("PLAYER_LOGIN")
ev:RegisterEvent("PLAYER_LEVEL_UP")
ev:SetScript("OnEvent", function(_, e, a1)
  if e == "ADDON_LOADED" and a1 == ADDON then
    RXPNeonDB = RXPNeonDB or {}
    DB = RXPNeonDB
    for k, v in pairs(DEF) do if DB[k] == nil then DB[k] = v end end
    N.DB = DB
  elseif e == "PLAYER_LOGIN" then
    if not RXP() then P("RestedXP Guides (RXPGuides) fehlt oder ist aus – RXPNeon bleibt inaktiv."); return end
    local function go()
      local ok, err = pcall(function() InstallHooks(); N.Apply() end)
      if not ok then P("Fehler beim Start: " .. tostring(err)) end
    end
    if C_Timer and C_Timer.After then C_Timer.After(0.5, go) else go() end
  elseif e == "PLAYER_LEVEL_UP" then
    if C_Timer and C_Timer.After then C_Timer.After(1, N.UpdateTipp) else N.UpdateTipp() end
  end
end)

SLASH_RXPNEON1 = "/rxn"
SLASH_RXPNEON2 = "/rxpneon"
SlashCmdList.RXPNEON = function(msg)
  msg = (msg or ""):lower():gsub("^%s+", ""):gsub("%s+$", "")
  if not DB then return end
  if msg == "aus" or msg == "skin aus" then
    DB.skin = false; N.Apply(); P("Neon-Optik |cffff5555aus|r (RXP-Standard).")
  elseif msg == "an" or msg == "skin an" then
    DB.skin = true; N.Apply(); P("Neon-Optik |cff39ff6ban|r.")
  elseif msg == "deutsch aus" or msg == "englisch" then
    DB.deutsch = false; N.ClearCache(); N.Apply(); P("Schritt-Texte: |cffff5555Original (englisch)|r. /reload für alte Texte im Fenster.")
  elseif msg == "deutsch" or msg == "deutsch an" then
    DB.deutsch = true; N.ClearCache(); N.Apply(); P("Schritt-Texte: |cff39ff6bdeutsch|r.")
  elseif msg == "guide" or msg == "laden" then
    N.LoadRecommended()
  elseif msg == "tipp aus" then
    DB.tipp = false; N.UpdateTipp(); P("Guide-Tipp aus.")
  elseif msg == "tipp an" or msg == "tipp" then
    DB.tipp = true; N.UpdateTipp(); P("Guide-Tipp an.")
  else
    local g = N.Recommend()
    P("Version " .. VERSION .. " – Befehle:")
    print("  /rxn an | aus – Neon-Optik   ·   /rxn deutsch | englisch – Schritt-Texte")
    print("  /rxn guide – passenden Guide laden" .. (g and (" (|cff39ff6b" .. N.T(g.name) .. "|r)") or ""))
    print("  /rxn tipp an | aus – Guide-Tipp im Fenster   ·   Schriftgröße: RXP-Optionen")
  end
end

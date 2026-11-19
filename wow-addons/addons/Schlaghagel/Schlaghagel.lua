-- Schlaghagel 1.3.0 - Proc-Anzeigen fuer den Verstaerker-Schamanen
--   Schlaghagel          Buff 16257 (Forever: einzige Buff-ID, 15 s, 3 Ladungen;
--                        Talent 16256 mit 6/12/18/24/30 %) - ab 1.2 mit Hagelsturm-Animation
--   Waffe des Mahlstroms Buff 408505 (30 s, bis 5 Stapel, je Stapel -20 % Zauberzeit/Mana des
--                        naechsten Blitzschlags; Talent 408498, 5 Raenge) - neu in 1.1, eigene Anzeige
--                        ueber dem Charakter; ab 1.4 Blitzsturm-Animation im Stil des Hagelsturms
--   Spieldaten: simc-forever SpellDataDump/allspells.txt, Build 70862
--
-- WoW Forever sperrt Aura-Daten im Kampf (Midnight-Regeln, "secret values"). Ein Add-on
-- (und auch WeakAuras) darf Buffs im Kampf NICHT lesen.
--
-- Loesung (Blizzards offizieller Weg, Forever-Client-Code Blizzard_AuraContainer):
--  * Je Proc ein Blizzard-Aura-Slot (CustomAuraContainerTemplate, AddAuraSlot mit
--    includeSpellIDs = {[id] = true}). Das SPIEL zeigt den Slot nur, solange der Buff
--    aktiv ist - auch im Kampf. Unsere Anzeige haengt als Kind daran, das Spiel setzt Symbol,
--    Ablauf-Kreis, Restzeit und Ladungen/Stapel selbst und startet die Animationen
--    (AddAuraShownAnimation: Start beim Erscheinen, Stopp beim Verschwinden).
--  * Kein Ton. Das Add-on selbst liest im Kampf nichts.
-- Aufbau nur ausserhalb des Kampfes (der Slot ist fuer Add-ons gesperrt, solange Auren geheim sind).

local VERSION = "1.5.0"
local SIZE = 76
local MEDIA = "Interface\\AddOns\\Schlaghagel\\Media\\"

-- Reihenfolge = Reihenfolge der Anzeigen. Position/Groesse von "hagel" liegen (wie in 1.0) direkt in der DB.
local PROFILES = {
  SHAMAN = {
    {
      key = "hagel", id = 16257, dur = 15, name = "Schlaghagel", icon = "Interface\\Icons\\Ability_GhoulFrenzy",
      glow = { 0.20, 0.78, 1, 0.85 }, count = { 1, 0.82, 0.3 }, demo = "3",
      x = 0, y = -150, frame = "Schlaghagel", fx = "hagel",     -- Hagelsturm-Animation (1.2)
    },
    {
      key = "mahl", id = 408505, dur = 30, name = "Waffe des Mahlstroms", icon = "Interface\\Icons\\Spell_Nature_Lightning",
      glow = { 0.55, 0.40, 1, 0.80 }, count = { 0.86, 0.95, 1 }, demo = "5",
      minStacks = 5,   -- 1.3: erst ab 5 Stapeln zeigen (Blizzard-Stapelschwelle), ohne Stapelzahl, Restzeit mittig
      x = 0, y = 120, frame = "SchlaghagelMahl", fx = "strom",   -- ueber dem Charakter (Bildmitte, hoeher)
    },
  },
}
local PROCS, BYKEY = {}, {}                   -- aktive Procs (nach ADDON_LOADED)
local DEF = { x = 0, y = -150, scale = 1 }
local DB

-- ---------- Helfer ----------
local function msg(t) print("|cff4dd9ffSchlag|r|cffffd24dhagel|r: " .. t) end

local function plain(v)
  if v == nil then return nil end
  if issecretvalue then
    local ok, s = pcall(issecretvalue, v)
    if not ok or s then return nil end
  end
  return v
end

local function noMouse(r)
  pcall(r.EnableMouse, r, false)
  if r.SetMouseClickEnabled then pcall(r.SetMouseClickEnabled, r, false) end
  if r.SetMouseMotionEnabled then pcall(r.SetMouseMotionEnabled, r, false) end
end

local function inCombat() return InCombatLockdown and InCombatLockdown() end


-- Speicherplatz je Proc: "hagel" = DB selbst (kompatibel zu 1.0), sonst DB[key]
local function store(pr)
  if pr.key == "hagel" then return DB end
  return DB[pr.key]
end

-- ---------- Anker (Position, Groesse, Ziehen) ----------
local function place(pr)
  local st = store(pr)
  pr.A:SetScale(st.scale)
  pr.A:ClearAllPoints()
  pr.A:SetPoint("CENTER", UIParent, "CENTER", st.x / st.scale, st.y / st.scale)
end

local function makeAnchor(pr)
  local A = CreateFrame("Frame", pr.frame .. "Anchor", UIParent)
  A:SetSize(SIZE, SIZE)
  A:SetFrameStrata("HIGH")
  A:SetMovable(true)
  A:SetClampedToScreen(true)
  A:EnableMouse(false)
  A:RegisterForDrag("LeftButton")
  A:SetScript("OnDragStart", function(s) s:StartMoving() end)
  A:SetScript("OnDragStop", function(s)
    s:StopMovingOrSizing()
    local cx, cy = s:GetCenter()
    local ux, uy = UIParent:GetCenter()
    local sc = s:GetScale()
    local st = store(pr)
    st.x, st.y = math.floor(cx * sc - ux + 0.5), math.floor(cy * sc - uy + 0.5)
    place(pr)
  end)
  pr.A = A
end

-- ---------- Effekt-Optik: Hagelsturm (Schlaghagel) und Blitzsturm (Waffe des Mahlstroms, 1.4) ----------
-- Gleiche Bildsprache, keine Kreise/Ringe/Drehungen: Schnitte im Takt quer ueber das Symbol, jeder mit Treffer-Funke;
-- Partikel-Lagen (Hagel faellt / Funken steigen), Tempo-Striche links/rechts flackern; beim Erscheinen Lichtblitz +
-- Funken-Explosion. Jede Dauerschleife in eigener AnimationGroup (eigener Takt).
local function fxTex(V, icon, layer, sub, file, size, r, g, b, a)
  local t = V:CreateTexture(nil, layer, nil, sub)
  t:SetTexture(MEDIA .. file)
  t:SetPoint("CENTER", icon, "CENTER")
  t:SetSize(size, size)
  t:SetBlendMode("ADD")
  t:SetVertexColor(r, g, b, 1)
  t:SetAlpha(a)
  return t
end
local function setScale(a, s0, s1)
  pcall(function() a:SetScaleFrom(s0, s0) a:SetScaleTo(s1, s1) end)
end

local STYLES = {
  hagel = {   -- Hagel der Schlaege: 3 Klingen-Schnitte "Ta-ta-ta" (= 3 Ladungen), Hagel prasselt schraeg herab
    cut = "hagel_cut", cutSize = 2.5, cycle = 1.2, cutScale = { 0.85, 1.15 },
    cuts = {   -- Drehung (Grad, gegen den Uhrzeigersinn), Versatz im Takt (s), Funke (x, y) relativ zum Symbol
      { 32, 0.00, 13, 7 }, { -32, 0.12, -12, 6 }, { 6, 0.24, 3, -10 },
    },
    cutCol = { 1, 0.97, 0.82 }, sparkCol = { 0.75, 0.95, 1 },
    parts = {  -- Textur, Breite, Hoehe (x SIZE), Weg dx, dy, Takt, Alpha, Farbe
      { "hagel_fall1", 2.6, 1.35, 7, -30, 0.95, 0.85, 0.70, 0.92, 1 },
      { "hagel_fall2", 2.3, 1.25, 6, -26, 1.25, 0.70, 0.85, 0.97, 1 },
    },
    speedCol = { 1, 0.84, 0.40 }, speed = { 0.09, 0.11 },
    flashCol = { 0.80, 0.95, 1 }, burstCol = { 1, 0.90, 0.55 },
  },
  blitz = {   -- Blitzsturm: 5 Blitz-Schnitte "Ta-ta-ta-ta-ta" (= 5 Stapel), elektrische Funken steigen auf
    cut = "blitz_slash", cutSize = 2.5, cycle = 1.5, cutScale = { 0.90, 1.12 },
    cuts = {
      { 30, 0.00, 13, 7 }, { -34, 0.10, -12, 6 }, { 8, 0.20, 3, -10 }, { -62, 0.30, -6, -12 }, { 64, 0.40, 8, 12 },
    },
    cutCol = { 0.78, 0.88, 1 }, sparkCol = { 0.62, 0.78, 1 },
    parts = {
      { "blitz_rise1", 2.6, 1.35, -5, 30, 1.00, 0.90, 0.45, 0.80, 1 },
      { "blitz_rise2", 2.3, 1.25, 4, 26, 1.30, 0.80, 0.72, 0.55, 1 },
    },
    speedCol = { 0.40, 0.68, 1 }, speed = { 0.08, 0.10 },
    flashCol = { 0.55, 0.70, 1 }, burstCol = { 0.70, 0.82, 1 },
  },
}

local function sturm(V, icon, st)
  local function tex(...) return fxTex(V, icon, ...) end
  local flash = tex("OVERLAY", 4, "strom_glow", SIZE * 3.0, st.flashCol[1], st.flashCol[2], st.flashCol[3], 0)

  local groups = {}
  -- Partikel: Lage bewegt sich (Versatz), blendet ein und aus; zwei Lagen mit eigenem Takt -> durchgehend
  local function layer(file, w, h, dx, dy, d, a, r, g, b)
    local t = tex("BACKGROUND", 3, file, w, r, g, b, 0)
    t:SetSize(w, h)
    t:ClearAllPoints()
    t:SetPoint("CENTER", icon, "CENTER", -dx / 2, -dy / 2)
    local grp = V:CreateAnimationGroup()
    grp:SetLooping("REPEAT")
    local inA = grp:CreateAnimation("Alpha")
    inA:SetTarget(t) inA:SetFromAlpha(0) inA:SetToAlpha(a) inA:SetDuration(d * 0.18) inA:SetOrder(1)
    local m1 = grp:CreateAnimation("Translation")
    m1:SetTarget(t) m1:SetOffset(dx * 0.18, dy * 0.18) m1:SetDuration(d * 0.18) m1:SetOrder(1)
    local m2 = grp:CreateAnimation("Translation")
    m2:SetTarget(t) m2:SetOffset(dx * 0.54, dy * 0.54) m2:SetDuration(d * 0.54) m2:SetOrder(2)
    local outA = grp:CreateAnimation("Alpha")
    outA:SetTarget(t) outA:SetFromAlpha(a) outA:SetToAlpha(0) outA:SetDuration(d * 0.28) outA:SetOrder(3)
    local m3 = grp:CreateAnimation("Translation")
    m3:SetTarget(t) m3:SetOffset(dx * 0.28, dy * 0.28) m3:SetDuration(d * 0.28) m3:SetOrder(3)
    groups[#groups + 1] = grp
    return t
  end
  local p1, p2 = st.parts[1], st.parts[2]
  local fall1 = layer(p1[1], SIZE * p1[2], SIZE * p1[3], p1[4], p1[5], p1[6], p1[7], p1[8], p1[9], p1[10])
  local fall2 = layer(p2[1], SIZE * p2[2], SIZE * p2[3], p2[4], p2[5], p2[6], p2[7], p2[8], p2[9], p2[10])

  -- Tempo-Striche links (zeigen zum Symbol) und rechts (gespiegelt), flackern versetzt
  local function speed(side, d)
    local t = V:CreateTexture(nil, "BACKGROUND", nil, 4)
    t:SetTexture(MEDIA .. "hagel_speed")
    t:SetSize(SIZE * 0.95, SIZE * 0.95)
    t:SetPoint(side == -1 and "RIGHT" or "LEFT", icon, side == -1 and "LEFT" or "RIGHT", side * -4, 0)
    t:SetBlendMode("ADD")
    t:SetVertexColor(st.speedCol[1], st.speedCol[2], st.speedCol[3], 1)
    t:SetAlpha(0.9)
    if side == 1 then t:SetTexCoord(1, 0, 0, 1) end
    local x = V:CreateAnimationGroup()
    x:SetLooping("BOUNCE")
    local a = x:CreateAnimation("Alpha")
    a:SetTarget(t) a:SetFromAlpha(0.95) a:SetToAlpha(0.15) a:SetDuration(d) a:SetSmoothing("IN_OUT")
    groups[#groups + 1] = x
    return t
  end
  local speedL, speedR = speed(-1, st.speed[1]), speed(1, st.speed[2])

  -- Schnitte: aufblitzen (0,04 s), dann nachziehen und verblassen (0,26 s); Funke springt mit
  local cuts = {}
  local cc, sc0 = st.cutCol, st.sparkCol
  for _, c in ipairs(st.cuts) do
    local t = tex("OVERLAY", 3, st.cut, SIZE * st.cutSize, cc[1], cc[2], cc[3], 0)
    t:SetRotation(math.rad(c[1]))
    local sp = tex("OVERLAY", 4, "hagel_spark", SIZE * 0.95, sc0[1], sc0[2], sc0[3], 0)
    sp:ClearAllPoints()
    sp:SetPoint("CENTER", icon, "CENTER", c[3], c[4])
    sp:SetRotation(math.rad(c[1] * 1.7))
    local g = V:CreateAnimationGroup()
    g:SetLooping("REPEAT")
    local on = g:CreateAnimation("Alpha")
    on:SetTarget(t) on:SetFromAlpha(0) on:SetToAlpha(1) on:SetDuration(0.04) on:SetStartDelay(c[2]) on:SetOrder(1)
    local son = g:CreateAnimation("Alpha")
    son:SetTarget(sp) son:SetFromAlpha(0) son:SetToAlpha(1) son:SetDuration(0.04) son:SetStartDelay(c[2]) son:SetOrder(1)
    local off = g:CreateAnimation("Alpha")
    off:SetTarget(t) off:SetFromAlpha(1) off:SetToAlpha(0) off:SetDuration(0.26) off:SetSmoothing("IN") off:SetOrder(2)
    off:SetEndDelay(math.max(0.05, st.cycle - c[2] - 0.30))
    local sc = g:CreateAnimation("Scale")
    sc:SetTarget(t) setScale(sc, st.cutScale[1], st.cutScale[2]) sc:SetDuration(0.26) sc:SetSmoothing("OUT") sc:SetOrder(2)
    local soff = g:CreateAnimation("Alpha")
    soff:SetTarget(sp) soff:SetFromAlpha(1) soff:SetToAlpha(0) soff:SetDuration(0.20) soff:SetSmoothing("OUT") soff:SetOrder(2)
    local ssc = g:CreateAnimation("Scale")
    ssc:SetTarget(sp) setScale(ssc, 0.6, 1.5) ssc:SetDuration(0.20) ssc:SetSmoothing("OUT") ssc:SetOrder(2)
    groups[#groups + 1] = g
    cuts[#cuts + 1] = t
  end

  -- Einschlag beim Erscheinen: Lichtblitz + grosse Funken-Explosion
  local strike = V:CreateAnimationGroup()
  local bc = st.burstCol
  local burst = tex("OVERLAY", 4, "hagel_spark", SIZE * 1.6, bc[1], bc[2], bc[3], 0)
  local f1 = strike:CreateAnimation("Alpha")
  f1:SetTarget(flash) f1:SetFromAlpha(1) f1:SetToAlpha(0) f1:SetDuration(0.45) f1:SetSmoothing("OUT")
  local b1 = strike:CreateAnimation("Alpha")
  b1:SetTarget(burst) b1:SetFromAlpha(1) b1:SetToAlpha(0) b1:SetDuration(0.50) b1:SetSmoothing("OUT")
  local b2 = strike:CreateAnimation("Scale")
  b2:SetTarget(burst) setScale(b2, 0.5, 2.2) b2:SetDuration(0.50) b2:SetSmoothing("OUT")
  groups[#groups + 1] = strike

  return groups, { flash = flash, fall1 = fall1, fall2 = fall2, speedL = speedL, speedR = speedR, cuts = cuts, burst = burst }
end

-- ---------- Optik (einmal fuer den Live-Slot, einmal fuer Vorschau/Test) ----------
-- Farbiger Glow, rundes Symbol mit Ablauf-Kreis, grosse Ladungen/Stapel in der Mitte, Restzeit klein darunter (kein Titel/Hinweis).
local function build(parent, pr)
  local V = CreateFrame("Frame", nil, parent)
  noMouse(V)
  V:SetSize(SIZE, SIZE)
  V:SetPoint("CENTER", pr.A, "CENTER")
  V:SetFrameStrata("HIGH")

  local glow = V:CreateTexture(nil, "BACKGROUND")
  if pr.fx then
    glow:SetTexture(MEDIA .. "strom_glow")
    glow:SetSize(SIZE * 2.5, SIZE * 2.5)
  else
    glow:SetTexture("Interface\\GLUES\\Models\\UI_Draenei\\GenericGlow64")
    glow:SetSize(SIZE * 2.3, SIZE * 2.3)
  end
  glow:SetPoint("CENTER")
  glow:SetBlendMode("ADD")
  glow:SetVertexColor(pr.glow[1], pr.glow[2], pr.glow[3], pr.glow[4])

  local icon = V:CreateTexture(nil, "ARTWORK")
  icon:SetAllPoints()
  icon:SetTexCoord(0.08, 0.92, 0.08, 0.92)
  local okTex, tex = pcall(function() return C_Spell and C_Spell.GetSpellTexture and C_Spell.GetSpellTexture(pr.id) end)
  icon:SetTexture((okTex and plain(tex)) or pr.icon)
  pcall(function()
    local m = V:CreateMaskTexture()
    m:SetTexture("Interface\\CharacterFrame\\TempPortraitAlphaMask", "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
    m:SetAllPoints(icon)
    icon:AddMaskTexture(m)
  end)

  local fx, fxT
  if pr.fx == "strom" then fx, fxT = sturm(V, icon, STYLES.blitz)
  elseif pr.fx == "hagel" then fx, fxT = sturm(V, icon, STYLES.hagel) end

  local cd = CreateFrame("Cooldown", nil, V, "CooldownFrameTemplate")
  cd:SetAllPoints(icon)
  cd:SetReverse(true)
  noMouse(cd)
  pcall(function() cd:SetHideCountdownNumbers(true) end)
  pcall(function() cd:SetDrawEdge(false) end)
  pcall(function() cd:SetSwipeTexture("Interface\\CharacterFrame\\TempPortraitAlphaMask") end)
  pcall(function() cd:SetSwipeColor(0, 0, 0, 0.55) end)

  local txt = CreateFrame("Frame", nil, V)   -- Text ueber dem Ablauf-Kreis
  txt:SetAllPoints(V)
  txt:SetFrameLevel(cd:GetFrameLevel() + 2)
  noMouse(txt)

  local timer = txt:CreateFontString(nil, "OVERLAY")
  local count
  if pr.minStacks then                        -- Mahlstrom (1.3): keine Stapelzahl, Restzeit gross in der Mitte
    timer:SetFont(STANDARD_TEXT_FONT, 24, "THICKOUTLINE")
    timer:SetPoint("CENTER", icon, "CENTER", 0, 0)
    timer:SetTextColor(pr.count[1], pr.count[2], pr.count[3])
  else
    count = txt:CreateFontString(nil, "OVERLAY")
    count:SetFont(STANDARD_TEXT_FONT, 30, "THICKOUTLINE")
    count:SetPoint("CENTER", icon, "CENTER", 0, 4)
    count:SetTextColor(pr.count[1], pr.count[2], pr.count[3])
    timer:SetFont(STANDARD_TEXT_FONT, 12, "OUTLINE")
    timer:SetPoint("BOTTOM", icon, "BOTTOM", 0, 5)
    timer:SetTextColor(0.75, 0.93, 1)
  end

  -- Ohne Titel/Hinweis (1.2.1): nur Symbol, Ablauf-Kreis, Ladungen/Stapel, Restzeit und Animation

  -- Pulsieren (Symbol + Glow blinken, Ganzes atmet) - wie Schlaghagel
  local pulse = V:CreateAnimationGroup()
  pulse:SetLooping("BOUNCE")
  local a1 = pulse:CreateAnimation("Alpha")
  a1:SetTarget(glow) a1:SetFromAlpha(1) a1:SetToAlpha(0.25) a1:SetDuration(0.32) a1:SetSmoothing("IN_OUT")
  local a2 = pulse:CreateAnimation("Alpha")
  a2:SetTarget(icon) a2:SetFromAlpha(1) a2:SetToAlpha(0.55) a2:SetDuration(0.32) a2:SetSmoothing("IN_OUT")
  local a3 = pulse:CreateAnimation("Scale")
  a3:SetTarget(V)
  pcall(function() a3:SetScaleFrom(1, 1) a3:SetScaleTo(1.12, 1.12) end)
  pcall(function() if not a3.SetScaleFrom then a3:SetScale(1.12, 1.12) end end)
  a3:SetDuration(0.32) a3:SetSmoothing("IN_OUT")

  return { V = V, icon = icon, cd = cd, timer = timer, count = count, pulse = pulse, fx = fx or {}, fxTex = fxT }
end

-- ---------- Live: Blizzard-Aura-Slot je Proc ----------
local function initSlot(pr, button)
  noMouse(button)
  button:SetSize(SIZE, SIZE)
  button:ClearAllPoints()
  button:SetPoint("CENTER", pr.A, "CENTER")
  pr.live.parts = {}
  local function hook(name, fn)
    local ok, err = pcall(fn)
    pr.live.parts[#pr.live.parts + 1] = name .. (ok and " |cff40ff59ok|r" or (" |cffff5555FEHLER|r " .. tostring(err)))
    return ok
  end
  -- Stapelschwelle (Mahlstrom): die ganze Anzeige haengt an einer unsichtbaren StatusBar, die Blizzards
  -- Aura-Knopf als "Application Bar" fuehrt. Das Spiel zeigt sie nur bei Stapeln >= minApplications
  -- (Blizzard_CustomAuraButton ApplyApplicationBar: SetShown(applications >= minApplications)) - auch im Kampf.
  -- Schlaegt das fehl, bleibt die Leiste sichtbar = Anzeige ab dem ersten Stapel (sicherer Rueckfall).
  local gate, strike
  local parent = button
  if pr.minStacks and store(pr).ab5 ~= false then
    gate = CreateFrame("StatusBar", nil, button)
    gate:SetAllPoints(button)
    pcall(function() gate:SetStatusBarTexture("Interface\\Buttons\\WHITE8X8") gate:SetStatusBarColor(0, 0, 0, 0) end)
    noMouse(gate)
    parent = gate
  end
  local p = build(parent, pr)
  hook("Symbol", function() button:SetIcon(p.icon) end)
  hook("Ablauf", function() button:SetDurationCooldown(p.cd) end)
  hook("Restzeit", function() button:SetDurationText(p.timer) end)
  if p.count then hook("Ladungen", function() button:SetApplicationCount(p.count) end) end
  if gate then
    hook("Ab " .. pr.minStacks .. " Stapeln", function()
      button:SetApplicationBar(gate, { minApplications = pr.minStacks, maxApplications = pr.minStacks })
    end)
  end
  if DB.blink then hook("Blinken", function() button:AddAuraShownAnimation(p.pulse) end) end
  if #p.fx > 0 and DB.strom ~= false then
    local loops = p.fx
    if gate then            -- Einschlag erst, wenn die Schwelle erreicht ist (Leiste erscheint), nicht beim 1. Stapel
      loops = {}
      for i = 1, #p.fx - 1 do loops[i] = p.fx[i] end
      strike = p.fx[#p.fx]
      -- 1.3.1: WoW stoppt Animationen, solange die Schwelle (1-4 Stapel) versteckt ist. Beim Erreichen
      -- der 5 deshalb alle Schleifen (Plasma-Ring, Blitzboegen, Blitze, Blinken) neu starten, nicht nur den Einschlag.
      local again = {}
      for i = 1, #loops do again[i] = loops[i] end
      if DB.blink then again[#again + 1] = p.pulse end
      gate:SetScript("OnShow", function()
        for _, g in ipairs(again) do pcall(g.Stop, g) pcall(g.Play, g) end
        pcall(strike.Play, strike)
      end)
      gate:SetScript("OnHide", function()
        for _, g in ipairs(again) do pcall(g.Stop, g) end
      end)
    end
    hook(pr.fx == "strom" and "Strom" or "Hagelsturm", function() for _, g in ipairs(loops) do button:AddAuraShownAnimation(g) end end)
  end
end

local function buildLive(pr)
  local L = pr.live
  if L.state == "an" then return true end
  if store(pr).aus then L.state, L.why = "aus", "ausgeschaltet (/hagel " .. pr.key .. ")" return false end
  if inCombat() then L.state, L.why = "wartet", "im Kampf - Aufbau nach dem Kampf" return false end
  if C_AddOns and C_AddOns.IsAddOnLoaded and C_AddOns.LoadAddOn and not C_AddOns.IsAddOnLoaded("Blizzard_AuraContainer") then
    pcall(C_AddOns.LoadAddOn, "Blizzard_AuraContainer")
  end
  if C_XMLUtil and C_XMLUtil.GetTemplateInfo and not C_XMLUtil.GetTemplateInfo("CustomAuraContainerTemplate") then
    L.state, L.why = "fehlt", "Client hat keinen Blizzard-Aura-Container"
    return false
  end
  local ok, err = pcall(function()
    local c = L.container
    if not c then
      c = CreateFrame("AuraContainer", pr.frame .. "AuraContainer", pr.A, "CustomAuraContainerTemplate")
      c:SetSize(1, 1)
      c:SetPoint("CENTER", pr.A, "CENTER")
      c:SetUnit("player")
      L.slot = c:AddAuraSlot("schlaghagel_" .. pr.key, "HELPFUL", {
        candidateFilters = { includeSpellIDs = { [pr.id] = true } },
        initializeFrame = function(b) initSlot(pr, b) end,
      })
      L.container = c
    end
    c:Show()
    pcall(c.UpdateAllAuras, c)
  end)
  if ok then L.state, L.why = "an", nil else L.state, L.why = "fehlt", tostring(err) end
  return ok
end

-- ausschalten: Container verstecken (nur ausserhalb des Kampfes)
local function hideLive(pr)
  local L = pr.live
  if L.container and not inCombat() then pcall(L.container.Hide, L.container) end
  L.state, L.why = "aus", "ausgeschaltet (/hagel " .. pr.key .. ")"
end

-- ---------- Vorschau / Test (eigene Kopie, nicht der Live-Slot) ----------
local function makePreview(pr)
  local P = CreateFrame("Frame", pr.frame .. "Preview", pr.A)
  P:SetAllPoints(pr.A)
  P:Hide()
  pr.P, pr.tEnd = P, 0
  pr.prev = build(P, pr)
  P:SetScript("OnUpdate", function(s)
    local left = pr.tEnd - GetTime()
    if left <= 0 then
      if DB and DB.unlocked then pr.prev.timer:SetText("") return end
      s:Hide() pr.prev.pulse:Stop()
      for _, g in ipairs(pr.prev.fx) do g:Stop() end
      return
    end
    pr.prev.timer:SetText(left >= 3 and string.format("%d", math.ceil(left)) or string.format("%.1f", left))
  end)
end

local function preview(pr, seconds)
  if not pr.prev then return false end
  pr.tEnd = GetTime() + seconds
  pcall(function() pr.prev.cd:SetCooldown(GetTime(), seconds) end)
  if pr.prev.count then pr.prev.count:SetText(pr.demo) end
  pr.P:Show()
  if DB.blink then pr.prev.pulse:Play() else pr.prev.pulse:Stop() end
  for _, g in ipairs(pr.prev.fx) do if DB.strom ~= false then g:Play() else g:Stop() end end
  return true
end

-- ---------- Ereignisse ----------
local E = CreateFrame("Frame")
E:RegisterEvent("ADDON_LOADED")
E:RegisterEvent("PLAYER_LOGIN")
E:RegisterEvent("PLAYER_REGEN_ENABLED")

E:SetScript("OnEvent", function(_, ev, a1)
  if ev == "ADDON_LOADED" then
    if a1 ~= "Schlaghagel" then return end
    SchlaghagelDB = SchlaghagelDB or {}
    DB = SchlaghagelDB
    for k, v in pairs(DEF) do if DB[k] == nil then DB[k] = v end end
    DB.unlocked = nil
    if DB.strom == nil then DB.strom = true end
    if DB.blink == nil then DB.blink = true end
    local _, cls = UnitClass("player")
    for k in pairs(BYKEY) do BYKEY[k] = nil end
    for i = #PROCS, 1, -1 do PROCS[i] = nil end
    for _, pr in ipairs(PROFILES[cls] or {}) do
      if pr.key ~= "hagel" then
        DB[pr.key] = type(DB[pr.key]) == "table" and DB[pr.key] or {}
        local st = DB[pr.key]
        if st.x == nil then st.x = pr.x end
        if st.y == nil then st.y = pr.y end
        if st.scale == nil then st.scale = 1 end
      end
      pr.live = { state = "aus", parts = {} }
      PROCS[#PROCS + 1] = pr
      BYKEY[pr.key] = pr
      makeAnchor(pr)
      makePreview(pr)
      place(pr)
      buildLive(pr)                               -- so frueh wie moeglich (Blizzard: bis PLAYER_LOGIN konfigurieren)
    end
  elseif ev == "PLAYER_LOGIN" then
    if #PROCS == 0 then return end                -- andere Klassen als Schamane: still
    local parts = {}
    for _, pr in ipairs(PROCS) do
      buildLive(pr)
      local L = pr.live
      parts[#parts + 1] = "|cffffd24d" .. pr.name .. "|r " .. (L.state == "an" and "|cff40ff59bereit|r" or ("|cffff5555" .. L.state .. "|r"))
    end
    msg(VERSION .. " " .. table.concat(parts, " · ") .. " - auch im Kampf. |cffaaaaaa/hagel test · /hagel unlock · /hagel diag|r")
  elseif ev == "PLAYER_REGEN_ENABLED" then
    for _, pr in ipairs(PROCS) do
      if store(pr).aus then
        if pr.live.container and pr.live.container:IsShown() then hideLive(pr) end
      elseif pr.live.state ~= "an" then
        buildLive(pr)
      end
    end
  end
end)

-- ---------- Befehle ----------
-- welcher Proc ist gemeint? "mahl"/"mahlstrom"/"strom" bzw. "hagel"/"schlag"/"schlaghagel"; nil = alle
local ALIAS = { mahl = "mahl", mahlstrom = "mahl", maelstrom = "mahl", hagel = "hagel", schlag = "hagel", schlaghagel = "hagel" }
local function pick(words)
  for _, w in ipairs(words) do if ALIAS[w] and BYKEY[ALIAS[w]] then return { BYKEY[ALIAS[w]] } end end
  return PROCS
end

SLASH_SCHLAGHAGEL1 = "/hagel"
SLASH_SCHLAGHAGEL2 = "/schlaghagel"
SlashCmdList.SCHLAGHAGEL = function(arg)
  arg = (arg or ""):lower():gsub("^%s+", ""):gsub("%s+$", "")
  local words = {}
  for w in arg:gmatch("%S+") do words[#words + 1] = w end
  local cmd = words[1] or ""
  if #PROCS == 0 then msg("nur fuer Schamanen.") return end
  local num
  for _, w in ipairs(words) do num = num or tonumber((w:gsub(",", "."))) end
  if cmd == "test" then
    for _, pr in ipairs(pick(words)) do preview(pr, pr.dur) end
  elseif cmd == "unlock" then
    if inCombat() then msg("erst nach dem Kampf.") return end
    DB.unlocked = true
    for _, pr in ipairs(PROCS) do pr.A:EnableMouse(true) preview(pr, pr.dur) end
    msg("frei - Anzeigen mit links ziehen, danach |cff40ff59/hagel lock|r")
  elseif cmd == "lock" then
    DB.unlocked = nil
    for _, pr in ipairs(PROCS) do pr.A:EnableMouse(false) pr.tEnd = 0 end
    msg("fixiert.")
  elseif cmd == "groesse" or cmd == "größe" or cmd == "size" then
    if inCombat() then msg("erst nach dem Kampf.") return end
    if num and num >= 0.5 and num <= 2.5 then
      local names = {}
      for _, pr in ipairs(pick(words)) do store(pr).scale = num place(pr) names[#names + 1] = pr.name end
      msg("Groesse " .. num .. " (" .. table.concat(names, ", ") .. ")")
    else
      msg("/hagel groesse 0.5 - 2.5  (nur eine: /hagel groesse mahl 1.3)")
    end
  elseif ALIAS[cmd] and BYKEY[ALIAS[cmd]] and #words == 1 then   -- /hagel mahl = an/aus
    local pr = BYKEY[ALIAS[cmd]]
    local st = store(pr)
    if inCombat() then msg("erst nach dem Kampf.") return end
    st.aus = not st.aus or nil
    if st.aus then hideLive(pr) else pr.live.state = "aus"; buildLive(pr) end
    msg(pr.name .. ": " .. (st.aus and "|cffff5555aus|r" or "|cff40ff59an|r"))
  elseif cmd == "blinken" or cmd == "blink" then
    DB.blink = not DB.blink
    msg("Blinken " .. (DB.blink and "|cff40ff59an|r" or "|cffff5555aus|r") .. " - im Kampf ab |cff40ff59/reload|r (Vorschau sofort).")
    for _, pr in ipairs(PROCS) do preview(pr, 3) end
  elseif cmd == "ab5" or cmd == "stapel" then
    local pr = BYKEY.mahl
    if not pr then msg("Nur fuer Schamanen (Waffe des Mahlstroms).") return end
    local st = store(pr)
    st.ab5 = st.ab5 == false
    msg("Mahlstrom " .. (st.ab5 and "erst ab |cff40ff595 Stapeln|r" or "ab dem |cffffd24dersten Stapel|r") .. " - gilt ab |cff40ff59/reload|r (ausserhalb des Kampfes).")
  elseif cmd == "strom" or cmd == "blitz" or cmd == "effekte" or cmd == "fx" then
    DB.strom = not DB.strom
    msg("Effekt-Animationen (Hagelsturm + Strom) " .. (DB.strom and "|cff40ff59an|r" or "|cffff5555aus|r") .. " - im Kampf ab |cff40ff59/reload|r (Vorschau sofort).")
    for _, pr in ipairs(PROCS) do preview(pr, 3) end
  elseif cmd == "reset" then
    if inCombat() then msg("erst nach dem Kampf.") return end
    for _, pr in ipairs(pick(words)) do
      local st = store(pr)
      st.x, st.y, st.scale = pr.x, pr.y, 1
      place(pr)
    end
    msg("Position zurueckgesetzt.")
  elseif cmd == "diag" then
    msg("Version " .. VERSION .. " · Blinken " .. (DB.blink and "an" or "aus") .. " · Effekte " .. (DB.strom and "an" or "aus"))
    for _, pr in ipairs(PROCS) do
      local L = pr.live
      msg(pr.name .. " (Buff " .. pr.id .. "): " .. (L.state == "an" and "|cff40ff59aktiv|r (zeigt sich auch im Kampf)" or ("|cffff5555" .. L.state .. "|r " .. tostring(L.why or ""))))
      if #L.parts > 0 then msg("   Teile: " .. table.concat(L.parts, ", ")) end
      if inCombat() then
        msg("   Im Kampf: Buff-Abfrage gesperrt (normal).")
      else
        local ok, a = pcall(function() return C_UnitAuras.GetPlayerAuraBySpellID(pr.id) end)
        msg("   gerade aktiv: " .. (ok and (a and "|cff40ff59ja|r" or "nein") or "|cffff5555gesperrt|r"))
      end
    end
  else
    msg("|cff40ff59/hagel test|r Vorschau · |cff40ff59unlock|r/|cff40ff59lock|r verschieben · |cff40ff59groesse 1.3|r (|cff40ff59groesse mahl 1.3|r nur Mahlstrom)")
    msg("|cff40ff59/hagel mahl|r bzw. |cff40ff59schlag|r an/aus · |cff40ff59blinken|r · |cff40ff59effekte|r (Hagelsturm/Strom) · |cff40ff59ab5|r (Mahlstrom erst ab 5 Stapeln) · |cff40ff59reset|r · |cff40ff59diag|r")
  end
end

-- Schlaghagel 1.1.0 - Proc-Anzeigen fuer den Verstaerker-Schamanen
--   Schlaghagel          Buff 16257 (Forever: einzige Buff-ID, 15 s, 3 Ladungen;
--                        Talent 16256 mit 6/12/18/24/30 %)
--   Waffe des Mahlstroms Buff 408505 (30 s, bis 5 Stapel, je Stapel -20 % Zauberzeit/Mana des
--                        naechsten Blitzschlags; Talent 408498, 5 Raenge) - neu in 1.1, eigene Anzeige
--                        ueber dem Charakter, Blitz-/Strom-Animation
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

local VERSION = "1.1.0"
local SIZE = 76
local MEDIA = "Interface\\AddOns\\Schlaghagel\\Media\\"

-- Reihenfolge = Reihenfolge der Anzeigen. Position/Groesse von "hagel" liegen (wie in 1.0) direkt in der DB.
local PROFILES = {
  SHAMAN = {
    {
      key = "hagel", id = 16257, dur = 15, name = "Schlaghagel", icon = "Interface\\Icons\\Ability_GhoulFrenzy",
      glow = { 0.15, 0.75, 1, 0.85 }, top = "|cff4dd9ffSCHLAG|r|cffffd24dHAGEL!|r",
      sub = "|cffbfeeffAngriffstempo hoch|r", count = { 1, 0.82, 0.3 }, demo = "3",
      x = 0, y = -150, frame = "Schlaghagel",
    },
    {
      key = "mahl", id = 408505, dur = 30, name = "Waffe des Mahlstroms", icon = "Interface\\Icons\\Spell_Nature_Lightning",
      glow = { 0.55, 0.40, 1, 0.80 }, top = nil, topText = "MAHLSTROM!",
      sub = "|cffd9ccffBlitzschlag schneller|r", count = { 0.86, 0.95, 1 }, demo = "5",
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

-- Text mit Farbverlauf (Violett -> Tuerkis -> Weiss), Buchstabe fuer Buchstabe
local function gradText(t, stops)
  local out, n = {}, #t
  for i = 1, n do
    local f = n > 1 and (i - 1) / (n - 1) * (#stops - 1) or 0
    local k = math.min(#stops - 1, math.floor(f))
    local a, b, u = stops[k + 1], stops[math.min(#stops, k + 2)], f - k
    out[#out + 1] = string.format("|cff%02x%02x%02x%s|r", math.floor((a[1] + (b[1] - a[1]) * u) * 255),
      math.floor((a[2] + (b[2] - a[2]) * u) * 255), math.floor((a[3] + (b[3] - a[3]) * u) * 255), t:sub(i, i))
  end
  return table.concat(out)
end
local STROM_TEXT = { { 0.72, 0.50, 1 }, { 0.30, 0.85, 1 }, { 0.92, 0.97, 1 } }

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

-- ---------- Strom-Optik (Waffe des Mahlstroms) ----------
-- Plasma-Ring (dreht langsam), zwei zackige Blitzboegen (gegenlaeufig, flackern), sechs Blitze, die
-- reihum vom Symbol nach aussen zucken, und ein Einschlag-Blitz beim Erscheinen.
local BOLTS = {   -- Winkel (Grad, 0 = oben; nur seitlich, damit Titel/Hinweis lesbar bleiben), Textur, Takt (s), Versatz (s)
  { 55, 1, 1.15, 0.00 }, { 92, 2, 1.30, 0.55 }, { 128, 3, 1.05, 0.20 },
  { 232, 1, 1.40, 0.80 }, { 268, 2, 1.20, 0.35 }, { 305, 3, 1.25, 0.95 },
}
local function strom(V, icon)
  local function tex(layer, sub, file, size, r, g, b, a)
    local t = V:CreateTexture(nil, layer, nil, sub)
    t:SetTexture(MEDIA .. file)
    t:SetPoint("CENTER", icon, "CENTER")
    t:SetSize(size, size)
    t:SetBlendMode("ADD")
    t:SetVertexColor(r, g, b, 1)
    t:SetAlpha(a)
    return t
  end
  local plasma = tex("BACKGROUND", 2, "strom_plasma", SIZE * 1.62, 0.42, 0.50, 1, 0.85)
  local arc2 = tex("OVERLAY", 1, "strom_arc2", SIZE * 1.42, 0.68, 0.48, 1, 0.9)
  local arc1 = tex("OVERLAY", 2, "strom_arc1", SIZE * 1.30, 0.70, 0.95, 1, 1)
  local flash = tex("OVERLAY", 4, "strom_glow", SIZE * 3.0, 0.85, 0.90, 1, 0)

  local groups = {}
  -- Dauerschleifen: je Textur eine eigene Gruppe, damit jede in ihrem Takt weiterlaeuft
  local function loop(mode) local g = V:CreateAnimationGroup() g:SetLooping(mode) groups[#groups + 1] = g return g end
  local function rot(t, deg, d)
    local r = loop("REPEAT"):CreateAnimation("Rotation")
    r:SetTarget(t) r:SetDegrees(deg) r:SetDuration(d)
  end
  rot(plasma, -360, 6.6)                     -- negativ = im Uhrzeigersinn
  rot(arc1, -360, 2.2)
  rot(arc2, 360, 3.3)
  local function fl(t, a0, a1, d)
    local x = loop("BOUNCE"):CreateAnimation("Alpha")
    x:SetTarget(t) x:SetFromAlpha(a0) x:SetToAlpha(a1) x:SetDuration(d)
  end
  fl(arc1, 1, 0.30, 0.07)
  fl(arc2, 0.90, 0.20, 0.11)

  -- Blitze: kurz an (0,05 s), ausklingen (0,16 s), Pause bis zum naechsten Takt
  for _, b in ipairs(BOLTS) do
    local t = tex("OVERLAY", 3, "strom_bolt" .. b[2], SIZE * 2.6, 0.80, 0.90, 1, 0)
    t:SetRotation(math.rad(-b[1]))           -- Textur zeigt nach oben, SetRotation dreht gegen den Uhrzeigersinn
    local g = V:CreateAnimationGroup()
    g:SetLooping("REPEAT")
    local on = g:CreateAnimation("Alpha")
    on:SetTarget(t) on:SetFromAlpha(0) on:SetToAlpha(1) on:SetDuration(0.05) on:SetStartDelay(b[4]) on:SetOrder(1)
    local off = g:CreateAnimation("Alpha")
    off:SetTarget(t) off:SetFromAlpha(1) off:SetToAlpha(0) off:SetDuration(0.16) off:SetOrder(2)
    off:SetEndDelay(math.max(0.05, b[3] - b[4] - 0.21))
    groups[#groups + 1] = g
  end

  -- Einschlag beim Erscheinen: heller Blitz + Ring, der nach aussen schlaegt
  local strike = V:CreateAnimationGroup()
  local ring = tex("OVERLAY", 4, "strom_arc2", SIZE * 1.42, 0.85, 0.92, 1, 0)
  local f1 = strike:CreateAnimation("Alpha")
  f1:SetTarget(flash) f1:SetFromAlpha(1) f1:SetToAlpha(0) f1:SetDuration(0.45) f1:SetSmoothing("OUT")
  local r1 = strike:CreateAnimation("Alpha")
  r1:SetTarget(ring) r1:SetFromAlpha(1) r1:SetToAlpha(0) r1:SetDuration(0.40) r1:SetSmoothing("OUT")
  local r2 = strike:CreateAnimation("Scale")
  r2:SetTarget(ring)
  pcall(function() r2:SetScaleFrom(0.7, 0.7) r2:SetScaleTo(1.9, 1.9) end)
  r2:SetDuration(0.40) r2:SetSmoothing("OUT")
  groups[#groups + 1] = strike

  return groups, { plasma = plasma, arc1 = arc1, arc2 = arc2, flash = flash, ring = ring }
end

-- ---------- Optik (einmal fuer den Live-Slot, einmal fuer Vorschau/Test) ----------
-- Farbiger Glow, rundes Symbol mit Ablauf-Kreis, Titel oben, Hinweis unten,
-- grosse Ladungen/Stapel in der Mitte, Restzeit klein darunter.
local function build(parent, pr)
  local V = CreateFrame("Frame", nil, parent)
  noMouse(V)
  V:SetSize(SIZE, SIZE)
  V:SetPoint("CENTER", pr.A, "CENTER")
  V:SetFrameStrata("HIGH")

  local glow = V:CreateTexture(nil, "BACKGROUND")
  if pr.fx == "strom" then
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

  local fx, fxTex
  if pr.fx == "strom" then fx, fxTex = strom(V, icon) end

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
  local count = txt:CreateFontString(nil, "OVERLAY")
  count:SetFont(STANDARD_TEXT_FONT, 30, "THICKOUTLINE")
  count:SetPoint("CENTER", icon, "CENTER", 0, 4)
  count:SetTextColor(pr.count[1], pr.count[2], pr.count[3])
  timer:SetFont(STANDARD_TEXT_FONT, 12, "OUTLINE")
  timer:SetPoint("BOTTOM", icon, "BOTTOM", 0, 5)
  timer:SetTextColor(0.75, 0.93, 1)

  local top = txt:CreateFontString(nil, "OVERLAY")
  top:SetFont(STANDARD_TEXT_FONT, 21, "OUTLINE")
  top:SetPoint("BOTTOM", V, "TOP", 0, pr.fx and 22 or 12)
  top:SetShadowOffset(2, -2)
  top:SetText(pr.top or gradText(pr.topText, STROM_TEXT))

  local sub = txt:CreateFontString(nil, "OVERLAY")
  sub:SetFont(STANDARD_TEXT_FONT, 12, "OUTLINE")
  sub:SetPoint("TOP", V, "BOTTOM", 0, pr.fx and -18 or -9)
  sub:SetText(pr.sub)

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

  return { V = V, icon = icon, cd = cd, timer = timer, count = count, pulse = pulse, fx = fx or {}, fxTex = fxTex }
end

-- ---------- Live: Blizzard-Aura-Slot je Proc ----------
local function initSlot(pr, button)
  noMouse(button)
  button:SetSize(SIZE, SIZE)
  button:ClearAllPoints()
  button:SetPoint("CENTER", pr.A, "CENTER")
  local p = build(button, pr)
  pr.live.parts = {}
  local function hook(name, fn)
    local ok, err = pcall(fn)
    pr.live.parts[#pr.live.parts + 1] = name .. (ok and " |cff40ff59ok|r" or (" |cffff5555FEHLER|r " .. tostring(err)))
  end
  hook("Symbol", function() button:SetIcon(p.icon) end)
  hook("Ablauf", function() button:SetDurationCooldown(p.cd) end)
  hook("Restzeit", function() button:SetDurationText(p.timer) end)
  hook(pr.fx and "Stapel" or "Ladungen", function() button:SetApplicationCount(p.count) end)
  if DB.blink then hook("Blinken", function() button:AddAuraShownAnimation(p.pulse) end) end
  if #p.fx > 0 and DB.strom ~= false then
    hook("Strom", function() for _, g in ipairs(p.fx) do button:AddAuraShownAnimation(g) end end)
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
  pr.prev.count:SetText(pr.demo)
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
  elseif cmd == "strom" or cmd == "blitz" then
    DB.strom = not DB.strom
    msg("Strom-Animation (Mahlstrom) " .. (DB.strom and "|cff40ff59an|r" or "|cffff5555aus|r") .. " - im Kampf ab |cff40ff59/reload|r (Vorschau sofort).")
    if BYKEY.mahl then preview(BYKEY.mahl, 3) end
  elseif cmd == "reset" then
    if inCombat() then msg("erst nach dem Kampf.") return end
    for _, pr in ipairs(pick(words)) do
      local st = store(pr)
      st.x, st.y, st.scale = pr.x, pr.y, 1
      place(pr)
    end
    msg("Position zurueckgesetzt.")
  elseif cmd == "diag" then
    msg("Version " .. VERSION .. " · Blinken " .. (DB.blink and "an" or "aus") .. " · Strom " .. (DB.strom and "an" or "aus"))
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
    msg("|cff40ff59/hagel mahl|r bzw. |cff40ff59schlag|r an/aus · |cff40ff59blinken|r · |cff40ff59strom|r (Blitz-Animation) · |cff40ff59reset|r · |cff40ff59diag|r")
  end
end

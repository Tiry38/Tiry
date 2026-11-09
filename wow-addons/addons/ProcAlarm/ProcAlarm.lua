-- ProcAlarm 2.0.0 - Schattentrance (Hexenmeister)
--
-- Warum neu: WoW Forever sperrt Aura-Daten im Kampf (Midnight-Regeln, "secret values").
-- Ein Add-on darf die Schattentrance im Kampf NICHT lesen. Version 1.x hat es ueber
-- Umwege versucht (Zauberzeit, Leuchten, Kampftext) - die sind im Kampf ebenfalls gesperrt.
--
-- Loesung (Blizzards offizieller Weg, Forever-Client-Code Blizzard_AuraContainer):
--  * Anzeige: ein Blizzard-Aura-Slot (CustomAuraContainerTemplate, AddAuraSlot mit
--    includeSpellIDs = {[17941] = true}). Das SPIEL zeigt den Slot nur, solange die
--    Schattentrance aktiv ist - auch im Kampf. Unser Alarm haengt als Kind daran, das Spiel
--    setzt Symbol, Ablauf-Kreis und Restzeit selbst und startet unsere Animationen.
--  * Ton: C_UnitAuras.AddAuraSound - das Spiel spielt ihn ab, sobald der Buff kommt.
--  * Das Add-on selbst liest im Kampf nichts.
-- Aufbau nur ausserhalb des Kampfes (der Slot ist fuer Add-ons gesperrt, solange Auren geheim sind).

local VERSION = "2.0.0"
local TRANCE = 17941                       -- Buff "Schattentrance" (in Forever bestaetigt)
local TRANCE_SET = { [TRANCE] = true }     -- includeSpellIDs ist eine Menge, keine Liste
local DUR = 10
local SIZE = 76
local SOUNDFILE = "Interface\\AddOns\\ProcAlarm\\Media\\trance.ogg"
local ICON = "Interface\\Icons\\Spell_Shadow_Twilight"
local DEF = { x = 0, y = -150, scale = 1, sound = true }

local DB
local live = { state = "aus", why = nil, slot = nil, container = nil, soundID = nil, soundWhy = nil, parts = {} }

-- ---------- Helfer ----------
local function msg(t) print("|cffb04dffProc|r|cff40ff59Alarm|r: " .. t) end

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

local function encounterLock()
  if not (C_RestrictedActions and C_RestrictedActions.IsAddOnRestrictionActive and Enum and Enum.AddOnRestrictionType) then
    return false
  end
  local ok, r = pcall(C_RestrictedActions.IsAddOnRestrictionActive, Enum.AddOnRestrictionType.Encounter)
  return ok and plain(r) == true
end

-- ---------- Anker (Position, Groesse, Ziehen) ----------
local A = CreateFrame("Frame", "ProcAlarmAnchor", UIParent)
A:SetSize(SIZE, SIZE)
A:SetFrameStrata("HIGH")
A:SetMovable(true)
A:SetClampedToScreen(true)
A:EnableMouse(false)
A:RegisterForDrag("LeftButton")

local function place()
  A:SetScale(DB.scale)
  A:ClearAllPoints()
  A:SetPoint("CENTER", UIParent, "CENTER", DB.x / DB.scale, DB.y / DB.scale)
end

A:SetScript("OnDragStart", function(s) s:StartMoving() end)
A:SetScript("OnDragStop", function(s)
  s:StopMovingOrSizing()
  local cx, cy = s:GetCenter()
  local ux, uy = UIParent:GetCenter()
  local sc = s:GetScale()
  DB.x, DB.y = math.floor(cx * sc - ux + 0.5), math.floor(cy * sc - uy + 0.5)
  place()
end)

-- ---------- Optik (einmal fuer den Live-Slot, einmal fuer Vorschau/Test) ----------
-- Neon-Violett-Glow, drehender gruener Sternring, rundes Symbol mit Ablauf-Kreis,
-- grosse Restzeit, "SCHATTENTRANCE!" oben, "Schattenblitz sofort" unten.
local function build(parent)
  local V = CreateFrame("Frame", nil, parent)
  noMouse(V)
  V:SetSize(SIZE, SIZE)
  V:SetPoint("CENTER", A, "CENTER")
  V:SetFrameStrata("HIGH")

  local glow = V:CreateTexture(nil, "BACKGROUND")
  glow:SetTexture("Interface\\GLUES\\Models\\UI_Draenei\\GenericGlow64")
  glow:SetPoint("CENTER")
  glow:SetSize(SIZE * 2.3, SIZE * 2.3)
  glow:SetBlendMode("ADD")
  glow:SetVertexColor(0.65, 0.25, 1, 0.95)

  local ring = V:CreateTexture(nil, "BORDER")
  ring:SetTexture("Interface\\Cooldown\\star4")
  ring:SetPoint("CENTER")
  ring:SetSize(SIZE * 2, SIZE * 2)
  ring:SetBlendMode("ADD")
  ring:SetVertexColor(0.22, 1, 0.42, 0.85)

  local icon = V:CreateTexture(nil, "ARTWORK")
  icon:SetAllPoints()
  icon:SetTexCoord(0.08, 0.92, 0.08, 0.92)
  local okTex, tex = pcall(function() return C_Spell and C_Spell.GetSpellTexture and C_Spell.GetSpellTexture(TRANCE) end)
  icon:SetTexture((okTex and plain(tex)) or ICON)
  pcall(function()
    local m = V:CreateMaskTexture()
    m:SetTexture("Interface\\CharacterFrame\\TempPortraitAlphaMask", "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
    m:SetAllPoints(icon)
    icon:AddMaskTexture(m)
  end)

  local edge = V:CreateTexture(nil, "OVERLAY")
  edge:SetTexture("Interface\\GLUES\\Models\\UI_Draenei\\GenericGlow64")
  edge:SetPoint("CENTER")
  edge:SetSize(SIZE * 1.25, SIZE * 1.25)
  edge:SetBlendMode("ADD")
  edge:SetVertexColor(0.22, 1, 0.42, 0.55)

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
  timer:SetFont(STANDARD_TEXT_FONT, 24, "THICKOUTLINE")
  timer:SetPoint("CENTER", icon, "CENTER", 0, 0)
  timer:SetTextColor(0.22, 1, 0.42)

  local top = txt:CreateFontString(nil, "OVERLAY")
  top:SetFont(STANDARD_TEXT_FONT, 21, "OUTLINE")
  top:SetPoint("BOTTOM", V, "TOP", 0, 12)
  top:SetShadowOffset(2, -2)
  top:SetText("|cffc77dffSCHATTEN|r|cff39ff6bTRANCE!|r")

  local sub = txt:CreateFontString(nil, "OVERLAY")
  sub:SetFont(STANDARD_TEXT_FONT, 12, "OUTLINE")
  sub:SetPoint("TOP", V, "BOTTOM", 0, -9)
  sub:SetText("|cffe0c8ffSchattenblitz sofort|r")

  -- Pulsieren (Symbol + Glow blinken, Ganzes atmet)
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

  -- Sternring dreht sich
  local spin = V:CreateAnimationGroup()
  spin:SetLooping("REPEAT")
  local r1 = spin:CreateAnimation("Rotation")
  r1:SetTarget(ring) r1:SetDegrees(-360) r1:SetDuration(2.4)

  -- Einschlag beim Auftauchen (einmal)
  local pop = V:CreateAnimationGroup()
  local p1 = pop:CreateAnimation("Scale")
  p1:SetTarget(edge)
  pcall(function() p1:SetScaleFrom(2.4, 2.4) p1:SetScaleTo(1, 1) end)
  pcall(function() if not p1.SetScaleFrom then p1:SetScale(0.42, 0.42) end end)
  p1:SetDuration(0.28) p1:SetSmoothing("OUT")

  return { V = V, icon = icon, cd = cd, timer = timer, pulse = pulse, spin = spin, pop = pop }
end

-- ---------- Live: Blizzard-Aura-Slot ----------
local function initSlot(button)
  noMouse(button)
  button:SetSize(SIZE, SIZE)
  button:ClearAllPoints()
  button:SetPoint("CENTER", A, "CENTER")
  local p = build(button)
  live.parts = {}
  local function hook(name, fn)
    local ok, err = pcall(fn)
    live.parts[#live.parts + 1] = name .. (ok and " |cff40ff59ok|r" or (" |cffff5555FEHLER|r " .. tostring(err)))
  end
  hook("Symbol", function() button:SetIcon(p.icon) end)
  hook("Ablauf", function() button:SetDurationCooldown(p.cd) end)
  hook("Restzeit", function() button:SetDurationText(p.timer) end)
  hook("Blinken", function() button:AddAuraShownAnimation(p.pulse) end)
  hook("Ring", function() button:AddAuraShownAnimation(p.spin) end)
  hook("Einschlag", function() button:AddAuraShownAnimation(p.pop) end)
end

local function buildLive()
  if live.state == "an" then return true end
  if inCombat() then live.state, live.why = "wartet", "im Kampf - Aufbau nach dem Kampf" return false end
  if C_AddOns and C_AddOns.IsAddOnLoaded and C_AddOns.LoadAddOn and not C_AddOns.IsAddOnLoaded("Blizzard_AuraContainer") then
    pcall(C_AddOns.LoadAddOn, "Blizzard_AuraContainer")
  end
  if C_XMLUtil and C_XMLUtil.GetTemplateInfo and not C_XMLUtil.GetTemplateInfo("CustomAuraContainerTemplate") then
    live.state, live.why = "fehlt", "Client hat keinen Blizzard-Aura-Container"
    return false
  end
  local ok, err = pcall(function()
    local c = CreateFrame("AuraContainer", "ProcAlarmAuraContainer", A, "CustomAuraContainerTemplate")
    c:SetSize(1, 1)
    c:SetPoint("CENTER", A, "CENTER")
    c:SetUnit("player")
    live.slot = c:AddAuraSlot("procalarm_trance", "HELPFUL", {
      candidateFilters = { includeSpellIDs = TRANCE_SET },
      initializeFrame = initSlot,
    })
    c:Show()
    pcall(c.UpdateAllAuras, c)
    live.container = c
  end)
  if ok then live.state, live.why = "an", nil else live.state, live.why = "fehlt", tostring(err) end
  return ok
end

-- ---------- Live: Ton durch das Spiel ----------
local function soundOff()
  if live.soundID and C_UnitAuras and C_UnitAuras.RemoveAuraSound then
    pcall(C_UnitAuras.RemoveAuraSound, live.soundID)
  end
  live.soundID = nil
end

local function soundApply()
  soundOff()
  live.soundWhy = nil
  if not DB.sound then live.soundWhy = "aus (/proc sound)" return end
  if not (C_UnitAuras and C_UnitAuras.AddAuraSound) then live.soundWhy = "Client kann keine Aura-Toene" return end
  if encounterLock() then live.soundWhy = "Bosskampf - wird danach eingetragen" live.soundPending = true return end
  live.soundPending = false
  local trig = (Enum and Enum.UnitAuraSoundTrigger and Enum.UnitAuraSoundTrigger.Added) or 0
  local ok, id = pcall(C_UnitAuras.AddAuraSound, trig, {
    unitToken = "player", spellID = TRANCE, soundFileName = SOUNDFILE,
    outputChannel = "Master", throttleSeconds = 1,
  })
  if ok and id then live.soundID = id else live.soundWhy = ok and "vom Spiel abgelehnt" or tostring(id) end
end

-- ---------- Vorschau / Test (eigene Kopie, nicht der Live-Slot) ----------
local P = CreateFrame("Frame", "ProcAlarmPreview", A)
P:SetAllPoints(A)
P:Hide()
local prev = build(P)
local tEnd = 0
P:SetScript("OnUpdate", function(s)
  local left = tEnd - GetTime()
  if left <= 0 then
    if DB and DB.unlocked then prev.timer:SetText("") return end
    s:Hide() prev.pulse:Stop() prev.spin:Stop()
    return
  end
  prev.timer:SetText(left >= 3 and string.format("%d", math.ceil(left)) or string.format("%.1f", left))
end)

local function preview(seconds)
  tEnd = GetTime() + seconds
  pcall(function() prev.cd:SetCooldown(GetTime(), seconds) end)
  P:Show() prev.pop:Play() prev.pulse:Play() prev.spin:Play()
end

-- ---------- Ereignisse ----------
local E = CreateFrame("Frame")
E:RegisterEvent("ADDON_LOADED")
E:RegisterEvent("PLAYER_LOGIN")
E:RegisterEvent("PLAYER_REGEN_ENABLED")
pcall(E.RegisterEvent, E, "ENCOUNTER_END")

E:SetScript("OnEvent", function(_, ev, a1)
  if ev == "ADDON_LOADED" then
    if a1 ~= "ProcAlarm" then return end
    ProcAlarmDB = ProcAlarmDB or {}
    DB = ProcAlarmDB
    for k, v in pairs(DEF) do if DB[k] == nil then DB[k] = v end end
    DB.lock, DB.unlocked = nil, nil              -- Altlast 1.x / nie fest gespeichert
    place()
    buildLive()                                   -- so frueh wie moeglich (Blizzard: bis PLAYER_LOGIN konfigurieren)
  elseif ev == "PLAYER_LOGIN" then
    buildLive()
    soundApply()
    local st = live.state == "an" and "|cff40ff59bereit|r" or ("|cffff5555" .. live.state .. "|r")
    msg(VERSION .. " " .. st .. " - Ausloeser: |cffc77dffSchattentrance|r. |cffaaaaaa/proc test · /proc unlock · /proc diag|r")
  elseif ev == "PLAYER_REGEN_ENABLED" then
    if live.state ~= "an" then buildLive() end
    if live.soundPending then soundApply() end
  elseif ev == "ENCOUNTER_END" then
    if live.soundPending then soundApply() end
  end
end)

-- ---------- Befehle ----------
SLASH_PROCALARM1 = "/proc"
SLASH_PROCALARM2 = "/procalarm"
SlashCmdList.PROCALARM = function(arg)
  arg = (arg or ""):lower():gsub("^%s+", ""):gsub("%s+$", "")
  local cmd, val = arg:match("^(%S*)%s*(.-)$")
  if cmd == "test" then
    preview(DUR)
    if DB.sound then pcall(PlaySoundFile, SOUNDFILE, "Master") end
  elseif cmd == "unlock" then
    if inCombat() then msg("erst nach dem Kampf.") return end
    DB.unlocked = true
    A:EnableMouse(true)
    preview(DUR)
    msg("frei - Alarm mit links ziehen, danach |cff40ff59/proc lock|r")
  elseif cmd == "lock" then
    DB.unlocked = nil
    A:EnableMouse(false)
    tEnd = 0
    msg("fixiert.")
  elseif cmd == "groesse" or cmd == "size" then
    local n = tonumber(val)
    if inCombat() then msg("erst nach dem Kampf.") return end
    if n and n >= 0.5 and n <= 2.5 then DB.scale = n place() msg("Groesse " .. n) else msg("/proc groesse 0.5 - 2.5") end
  elseif cmd == "sound" then
    DB.sound = not DB.sound
    soundApply()
    msg("Ton " .. (DB.sound and "|cff40ff59an|r" or "|cffff5555aus|r"))
  elseif cmd == "reset" then
    if inCombat() then msg("erst nach dem Kampf.") return end
    DB.x, DB.y, DB.scale = DEF.x, DEF.y, DEF.scale
    place() msg("Position zurueckgesetzt.")
  elseif cmd == "diag" then
    msg("Version " .. VERSION .. " · Ausloeser Buff " .. TRANCE)
    msg("Blizzard-Aura-Slot: " .. (live.state == "an" and "|cff40ff59aktiv|r (zeigt sich auch im Kampf)" or ("|cffff5555" .. live.state .. "|r " .. tostring(live.why or ""))))
    if #live.parts > 0 then msg("Teile: " .. table.concat(live.parts, ", ")) end
    msg("Spiel-Ton: " .. (live.soundID and "|cff40ff59eingetragen|r" or ("|cffff5555nein|r " .. tostring(live.soundWhy or ""))))
    if inCombat() then
      msg("Im Kampf: Buff-Abfrage gesperrt (normal).")
    else
      local ok, a = pcall(function() return C_UnitAuras.GetPlayerAuraBySpellID(TRANCE) end)
      msg("Schattentrance gerade aktiv: " .. (ok and (a and "|cff40ff59ja|r" or "nein") or "|cffff5555gesperrt|r"))
    end
  else
    msg("|cff40ff59/proc test|r Vorschau · |cff40ff59unlock|r/|cff40ff59lock|r verschieben · |cff40ff59groesse 1.3|r · |cff40ff59sound|r · |cff40ff59reset|r · |cff40ff59diag|r")
  end
end

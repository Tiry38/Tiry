-- ProcAlarm 1.1.0 - Schattentrance (Hexenmeister)
-- Mehrere Erkennungswege, weil WoW Forever im Kampf Aura-Daten sperrt:
--  1) Schattenblitz-Zauberzeit = 0 (Schattentrance macht ihn sofort)
--  2) Blizzard-Leuchten am Schattenblitz (SPELL_ACTIVATION_OVERLAY_GLOW_SHOW)
--  3) Blizzard-Bildschirm-Overlay (SPELL_ACTIVATION_OVERLAY_SHOW)
--  4) Aura-Abfrage (ausserhalb des Kampfes, liefert exakte Restzeit)
--  5) Kampftext "+Schattentrance" (falls Aura-Kampftext an ist)

local TRANCE = 17941
local DUR = 10
local SB = { 25307, 11661, 11660, 11659, 7641, 1106, 1088, 705, 695, 686 }
local SBSET = {}
for _, id in ipairs(SB) do SBSET[id] = true end
local ICON = "Interface\\Icons\\Spell_Shadow_Twilight"
local DEF = { x = 0, y = -150, scale = 1, sound = true, lock = true }

local DB
local on, onSrc, tStart, tEnd = false, nil, 0, 0
local lastHit = {}

-- ---------- Helfer ----------
local function plain(v)
  if v == nil then return nil end
  if issecretvalue then
    local ok, s = pcall(issecretvalue, v)
    if not ok or s then return nil end
  end
  return v
end

local function msg(t) print("|cffb04dffProc|r|cff40ff59Alarm|r: " .. t) end

local function bestSB()
  for _, id in ipairs(SB) do
    local ok, k = pcall(IsPlayerSpell, id)
    if ok and plain(k) then return id end
    if IsSpellKnown then
      ok, k = pcall(IsSpellKnown, id)
      if ok and plain(k) then return id end
    end
  end
end

local function isSB(id)
  id = plain(id)
  if not id then return false end
  local ok, r = pcall(function() return SBSET[id] == true end)
  return ok and r
end

-- ---------- Anzeige ----------
local F = CreateFrame("Frame", "ProcAlarmFrame", UIParent)
F:SetSize(76, 76)
F:SetFrameStrata("HIGH")
F:Hide()
F.test = false

local glow = F:CreateTexture(nil, "BACKGROUND")
glow:SetTexture("Interface\\GLUES\\Models\\UI_Draenei\\GenericGlow64")
glow:SetPoint("CENTER")
glow:SetSize(170, 170)
glow:SetBlendMode("ADD")
glow:SetVertexColor(0.65, 0.25, 1, 0.9)

local ring = F:CreateTexture(nil, "BORDER")
ring:SetTexture("Interface\\Cooldown\\star4")
ring:SetPoint("CENTER")
ring:SetSize(150, 150)
ring:SetBlendMode("ADD")
ring:SetVertexColor(0.55, 1, 0.35, 0.8)

local icon = F:CreateTexture(nil, "ARTWORK")
icon:SetAllPoints()
icon:SetTexCoord(0.08, 0.92, 0.08, 0.92)
local okTex, tex = pcall(function() return C_Spell and C_Spell.GetSpellTexture and C_Spell.GetSpellTexture(TRANCE) end)
icon:SetTexture((okTex and plain(tex)) or ICON)
pcall(function()
  local m = F:CreateMaskTexture()
  m:SetTexture("Interface\\CharacterFrame\\TempPortraitAlphaMask", "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
  m:SetAllPoints(icon)
  icon:AddMaskTexture(m)
end)

local cd = CreateFrame("Cooldown", nil, F, "CooldownFrameTemplate")
cd:SetAllPoints(icon)
cd:SetReverse(true)
pcall(function() cd:SetHideCountdownNumbers(true) end)
pcall(function() cd:SetSwipeTexture("Interface\\CharacterFrame\\TempPortraitAlphaMask") end)
cd:SetSwipeColor(0, 0, 0, 0.55)

local top = F:CreateFontString(nil, "OVERLAY")
top:SetFont(STANDARD_TEXT_FONT, 22, "OUTLINE")
top:SetPoint("BOTTOM", F, "TOP", 0, 10)
top:SetText("|cffb04dffSCHATTENTRANCE!|r")
top:SetShadowOffset(2, -2)

local timer = F:CreateFontString(nil, "OVERLAY")
timer:SetFont(STANDARD_TEXT_FONT, 26, "THICKOUTLINE")
timer:SetPoint("CENTER", icon, "CENTER", 0, 0)
timer:SetTextColor(0.25, 1, 0.35)

local sub = F:CreateFontString(nil, "OVERLAY")
sub:SetFont(STANDARD_TEXT_FONT, 12, "OUTLINE")
sub:SetPoint("TOP", F, "BOTTOM", 0, -8)
sub:SetText("|cffd9b3ffSchattenblitz sofort|r")

-- Blinken + Pulsieren
local ag = F:CreateAnimationGroup()
ag:SetLooping("BOUNCE")
local a1 = ag:CreateAnimation("Alpha")
a1:SetFromAlpha(1) a1:SetToAlpha(0.35) a1:SetDuration(0.32) a1:SetSmoothing("IN_OUT")
local s1 = ag:CreateAnimation("Scale")
pcall(function() s1:SetScaleFrom(1, 1) s1:SetScaleTo(1.12, 1.12) end)
pcall(function() if not s1.SetScaleFrom then s1:SetScale(1.12, 1.12) end end)
s1:SetDuration(0.32) s1:SetSmoothing("IN_OUT")

local spin = F:CreateAnimationGroup()
spin:SetLooping("REPEAT")
local r1 = spin:CreateAnimation("Rotation")
r1:SetTarget(ring) r1:SetDegrees(-360) r1:SetDuration(2.4)

-- Ziehen
F:SetMovable(true)
F:EnableMouse(false)
F:RegisterForDrag("LeftButton")
F:SetScript("OnDragStart", function(s) s:StartMoving() end)
F:SetScript("OnDragStop", function(s)
  s:StopMovingOrSizing()
  local cx, cy = s:GetCenter()
  local ux, uy = UIParent:GetCenter()
  local sc = s:GetScale()
  DB.x, DB.y = math.floor(cx * sc - ux + 0.5), math.floor(cy * sc - uy + 0.5)
  s:ClearAllPoints()
  s:SetPoint("CENTER", UIParent, "CENTER", DB.x / sc, DB.y / sc)
end)

local function place()
  F:SetScale(DB.scale)
  F:ClearAllPoints()
  F:SetPoint("CENTER", UIParent, "CENTER", DB.x / DB.scale, DB.y / DB.scale)
end

local function sound()
  if not DB.sound then return end
  pcall(PlaySound, (SOUNDKIT and SOUNDKIT.RAID_WARNING) or 8959, "Master")
end

local function Show(src, exp)
  lastHit[src] = GetTime()
  local now = GetTime()
  if exp and exp > now then tEnd = exp elseif not on then tEnd = now + DUR end
  if not on then
    on, onSrc, tStart = true, src, now
    pcall(function() cd:SetCooldown(tEnd - DUR, DUR) end)
    F:Show() ag:Play() spin:Play()
    sound()
  end
end

local function Hide()
  if not on and not F.test then return end
  on, onSrc, F.test = false, nil, false
  ag:Stop() spin:Stop() F:SetAlpha(1)
  if DB and DB.lock then F:Hide() end
end

-- ---------- Erkennung ----------
local function auraCheck()
  local ok, a = pcall(function()
    if C_UnitAuras and C_UnitAuras.GetPlayerAuraBySpellID then
      return C_UnitAuras.GetPlayerAuraBySpellID(TRANCE)
    end
  end)
  if not ok then return nil end          -- im Kampf gesperrt
  if a == nil then return false end      -- sicher: kein Buff
  local exp = plain(a.expirationTime)
  return true, exp
end

local function castTimeCheck()
  local id = bestSB()
  if not id then return nil end
  local ok, ct = pcall(function()
    if C_Spell and C_Spell.GetSpellInfo then
      local i = C_Spell.GetSpellInfo(id)
      return i and i.castTime
    elseif GetSpellInfo then
      return select(4, GetSpellInfo(id))
    end
  end)
  ct = ok and plain(ct)
  if type(ct) ~= "number" then return nil end
  return ct == 0
end

local acc = 0
F.poll = CreateFrame("Frame")
F.poll:SetScript("OnUpdate", function(_, el)
  acc = acc + el
  if acc < 0.08 then return end
  acc = 0
  local now = GetTime()

  local has, exp = auraCheck()
  local inst = castTimeCheck()

  if has == true then
    Show("aura", exp)
    if exp then tEnd = exp end
  elseif inst == true then
    Show("zauberzeit")
  end

  if on and not F.test then
    -- sichere Aus-Signale
    if has == false and onSrc ~= "overlay" and onSrc ~= "leuchten" then Hide()
    elseif has == nil and inst == false and (onSrc == "zauberzeit" or onSrc == "aura") then Hide()
    elseif now > tEnd + 0.3 then Hide() end
  end

  if on or F.test then
    local left = tEnd - now
    if left < 0 then left = 0 end
    timer:SetText(left >= 3 and string.format("%d", math.ceil(left)) or string.format("%.1f", left))
    if F.test and left <= 0 then Hide() end
  end
end)

local E = CreateFrame("Frame")
E:RegisterEvent("ADDON_LOADED")
E:RegisterEvent("PLAYER_LOGIN")
pcall(E.RegisterEvent, E, "SPELL_ACTIVATION_OVERLAY_GLOW_SHOW")
pcall(E.RegisterEvent, E, "SPELL_ACTIVATION_OVERLAY_GLOW_HIDE")
pcall(E.RegisterEvent, E, "SPELL_ACTIVATION_OVERLAY_SHOW")
pcall(E.RegisterEvent, E, "SPELL_ACTIVATION_OVERLAY_HIDE")
pcall(E.RegisterEvent, E, "COMBAT_TEXT_UPDATE")
pcall(E.RegisterUnitEvent, E, "UNIT_SPELLCAST_SUCCEEDED", "player")

E:SetScript("OnEvent", function(_, ev, a1, a2, a3)
  if ev == "ADDON_LOADED" then
    if a1 ~= "ProcAlarm" then return end
    ProcAlarmDB = ProcAlarmDB or {}
    DB = ProcAlarmDB
    for k, v in pairs(DEF) do if DB[k] == nil then DB[k] = v end end
    place()
  elseif ev == "PLAYER_LOGIN" then
    msg("geladen - Ausloeser: |cffb04dffSchattentrance|r. |cffaaaaaa/proc test · /proc unlock · /proc diag|r")
  elseif ev == "SPELL_ACTIVATION_OVERLAY_GLOW_SHOW" then
    if isSB(a1) then Show("leuchten") end
  elseif ev == "SPELL_ACTIVATION_OVERLAY_GLOW_HIDE" then
    if isSB(a1) and onSrc == "leuchten" then Hide() end
  elseif ev == "SPELL_ACTIVATION_OVERLAY_SHOW" then
    local id = plain(a1)
    if id == TRANCE then Show("overlay") end
  elseif ev == "SPELL_ACTIVATION_OVERLAY_HIDE" then
    local id = plain(a1)
    if (id == nil or id == TRANCE) and onSrc == "overlay" then Hide() end
  elseif ev == "COMBAT_TEXT_UPDATE" then
    if plain(a1) ~= "SPELL_AURA_START" then return end
    local ok, name = pcall(function() return GetCurrentCombatTextEventInfo() end)
    name = ok and plain(name)
    local okN, tn = pcall(function() return C_Spell.GetSpellName(TRANCE) end)
    tn = okN and plain(tn) or "Schattentrance"
    if name and (name == tn or name == "Schattentrance" or name == "Shadow Trance") then Show("kampftext") end
  elseif ev == "UNIT_SPELLCAST_SUCCEEDED" then
    -- Schattenblitz verbraucht die Trance
    if on and isSB(a3) and GetTime() - tStart > 0.15 then Hide() end
  end
end)

-- ---------- Befehle ----------
SLASH_PROCALARM1 = "/proc"
SLASH_PROCALARM2 = "/procalarm"
SlashCmdList.PROCALARM = function(arg)
  arg = (arg or ""):lower():gsub("^%s+", ""):gsub("%s+$", "")
  local cmd, val = arg:match("^(%S*)%s*(.-)$")
  if cmd == "test" then
    Hide()
    F.test = true
    tStart, tEnd = GetTime(), GetTime() + DUR
    pcall(function() cd:SetCooldown(tStart, DUR) end)
    F:Show() ag:Play() spin:Play() sound()
  elseif cmd == "unlock" then
    DB.lock = false
    F:EnableMouse(true) F:Show() F:SetAlpha(1)
    timer:SetText("") msg("frei - Icon mit links ziehen, danach |cff40ff59/proc lock|r")
  elseif cmd == "lock" then
    DB.lock = true
    F:EnableMouse(false)
    if not on and not F.test then F:Hide() end
    msg("fixiert.")
  elseif cmd == "groesse" or cmd == "size" then
    local n = tonumber(val)
    if n and n >= 0.5 and n <= 2.5 then DB.scale = n place() msg("Groesse " .. n) else msg("/proc groesse 0.5 - 2.5") end
  elseif cmd == "sound" then
    DB.sound = not DB.sound
    msg("Ton " .. (DB.sound and "|cff40ff59an|r" or "|cffff5555aus|r"))
  elseif cmd == "reset" then
    DB.x, DB.y, DB.scale = DEF.x, DEF.y, DEF.scale
    place() msg("Position zurueckgesetzt.")
  elseif cmd == "diag" then
    local id = bestSB()
    local has, exp = auraCheck()
    local inst = castTimeCheck()
    msg("Schattenblitz-Rang-ID: " .. tostring(id))
    msg("Aura-Abfrage: " .. (has == nil and "|cffff5555gesperrt|r" or tostring(has)))
    msg("Zauberzeit 0: " .. (inst == nil and "|cffff5555gesperrt|r" or tostring(inst)))
    local list = {}
    for k, t in pairs(lastHit) do list[#list + 1] = k .. " vor " .. math.floor(GetTime() - t) .. "s" end
    msg("Zuletzt erkannt: " .. (#list > 0 and table.concat(list, ", ") or "noch nie"))
  else
    msg("|cff40ff59/proc test|r Vorschau · |cff40ff59unlock|r/|cff40ff59lock|r verschieben · |cff40ff59groesse 1.3|r · |cff40ff59sound|r · |cff40ff59reset|r · |cff40ff59diag|r")
  end
end

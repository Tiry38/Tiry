-- KampfWerk: Zahlen-Studio. Zwei Wege fuer die Zahlen ueber Gegnern:
--  1) Blizzard-Kampfzahlen in einer anderen Schrift: das Spiel liest die globale Variable DAMAGE_TEXT_FONT beim
--     Betreten der Welt (Blizzard_Fonts_Shared/GameFonts.xml). Gilt fuer Schaden UND Heilung gemeinsam (eine Schrift),
--     Farben legt das Spiel fest. Wirkt nach dem naechsten Einloggen.
--  2) Eigene Neon-Zahlen: KampfWerk zeichnet Schaden und Heilung selbst - Schrift, Farbe, Groesse, Rand, Bewegung
--     fuer Schaden und Heilung getrennt. Quelle: Ereignis UNIT_COMBAT (Betrag ist geheim -> nur ueber
--     AbbreviateLargeNumbers/SetText durchgereicht). Es zeigt jeden Treffer am Ziel bzw. an dir.
local _, ns = ...
local UI = ns.UI
local secret = ns.IsSecret
local Numbers = {}
ns.Numbers = Numbers

local Z = ns.MEDIA .. "Zahlen\\"
Numbers.FONTS = {
  { key = "spiel", label = "Spiel-Standard" },
  { key = "neon", label = "Neon 2045", file = Z .. "Orbitron-Black.ttf" },
  { key = "cyber", label = "Cyber Schmal", file = ns.MEDIA .. "Fonts\\Rajdhani-Bold.ttf" },
  { key = "bebas", label = "Bebas Neue", file = Z .. "BebasNeue-Regular.ttf" },
  { key = "anton", label = "Anton", file = Z .. "Anton-Regular.ttf" },
  { key = "russo", label = "Russo One", file = Z .. "RussoOne-Regular.ttf" },
  { key = "bangers", label = "Bangers (Comic)", file = Z .. "Bangers-Regular.ttf" },
  { key = "blackops", label = "Black Ops", file = Z .. "BlackOpsOne-Regular.ttf" },
  { key = "audiowide", label = "Audiowide", file = Z .. "Audiowide-Regular.ttf" },
  { key = "righteous", label = "Righteous", file = Z .. "Righteous-Regular.ttf" },
  { key = "pixel", label = "Pixel 8-Bit", file = Z .. "PressStart2P-Regular.ttf" },
  { key = "bungee", label = "Bungee", file = Z .. "Bungee-Regular.ttf" },
  { key = "luckiest", label = "Luckiest Guy", file = Z .. "LuckiestGuy-Regular.ttf" },
  { key = "lilita", label = "Lilita One", file = Z .. "LilitaOne-Regular.ttf" },
  { key = "titan", label = "Titan One", file = Z .. "TitanOne-Regular.ttf" },
  { key = "marker", label = "Marker", file = Z .. "PermanentMarker-Regular.ttf" },
  { key = "chakra", label = "Chakra Petch", file = Z .. "ChakraPetch-Bold.ttf" },
  { key = "teko", label = "Teko", file = Z .. "Teko-SemiBold.ttf" },
  { key = "oxanium", label = "Oxanium", file = Z .. "Oxanium-Bold.ttf" },
  { key = "glitch", label = "Glitch", file = Z .. "RubikGlitch-Regular.ttf" },
  { key = "horror", label = "Horror", file = Z .. "Creepster-Regular.ttf" },
  { key = "friz", label = "WoW Klassik", file = "Fonts\\FRIZQT__.TTF" },
  { key = "morpheus", label = "WoW Morpheus", file = "Fonts\\MORPHEUS.TTF" },
  { key = "skurri", label = "WoW Skurri", file = "Fonts\\SKURRI.TTF" },
}
Numbers.FONT = {}
for _, f in ipairs(Numbers.FONTS) do Numbers.FONT[f.key] = f end

Numbers.SWATCHES = {
  { 1.00, 0.82, 0.22 }, { 1.00, 0.55, 0.12 }, { 1.00, 0.30, 0.25 }, { 1.00, 0.24, 0.76 }, { 0.70, 0.40, 1.00 },
  { 0.30, 0.60, 1.00 }, { 0.20, 0.90, 1.00 }, { 0.15, 0.95, 0.85 }, { 0.22, 1.00, 0.42 }, { 0.70, 1.00, 0.30 },
  { 1.00, 1.00, 1.00 }, { 0.80, 0.85, 0.90 },
}
Numbers.STYLES = {
  { value = "kontur", label = "Kontur" }, { value = "dick", label = "Dicker Rand" },
  { value = "schatten", label = "Schatten" }, { value = "neon", label = "Neon-Glow" },
}
Numbers.ANIMS = { { value = "steigen", label = "Steigen" }, { value = "bogen", label = "Bogen" }, { value = "pop", label = "Pop" } }

local function N() return ns.DB.numbers end

function Numbers.FontFile(key)
  local f = Numbers.FONT[key]
  if f and f.file then return f.file end
  return STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF"
end

local function flags(style)
  if style == "dick" then return "THICKOUTLINE" end
  if style == "kontur" or style == "neon" then return "OUTLINE" end
  return ""
end
Numbers.Flags = flags

----------------------------------------------------------------------------
-- 1) Blizzard-Kampfzahlen: Schrift, Groesse, an/aus
----------------------------------------------------------------------------
function Numbers.EarlyFont()
  local key = ns.DB and N().blizzFont
  local f = key and Numbers.FONT[key]
  if f and f.file then DAMAGE_TEXT_FONT = f.file end
  Numbers.loadedFont = (f and f.file) and key or "spiel"
end

-- Ist die gewaehlte Schrift schon die, mit der dieses Einloggen gestartet ist?
function Numbers.BlizzFontActive()
  local key = N().blizzFont
  if not key or key == "aus" then key = "spiel" end
  return Numbers.loadedFont == key
end

local function cvarExists(name)
  return C_CVar and C_CVar.GetCVar and C_CVar.GetCVar(name) ~= nil
end
Numbers.CVarExists = cvarExists

-- Setzen + Rueckwert pruefen; Ergebnis fuer /kw diag merken (C_CVar.SetCVar, sonst altes SetCVar)
Numbers.cvLog = {}
local function trySet(name, value)
  local ok, res = pcall(C_CVar.SetCVar, name, value)
  local now = C_CVar.GetCVar(name)
  if now ~= value and SetCVar then
    pcall(SetCVar, name, value)
    now = C_CVar.GetCVar(name)
  end
  local good = now == value
  Numbers.cvLog[name] = { want = value, got = now, ok = good, err = (not ok) and tostring(res) or nil }
  if not good and not Numbers.warned then
    Numbers.warned = true
    ns.Print("|cffff5050WoW laesst KampfWerk die Einstellung " .. name .. " nicht aendern|r (" .. tostring(now)
      .. "). Bitte |cff39ff6b/kw diag|r ausfuehren und mir zeigen.")
  end
  return good
end

local function setCVar(name, value)
  if not cvarExists(name) then return false end
  if InCombatLockdown and InCombatLockdown() then
    ns.OutOfCombat(function() trySet(name, value) end)
    return true
  end
  return trySet(name, value)
end

-- Forever-Namen (Blizzard_SettingsDefinitions_Frame/Mainline/CombatOverrides.lua): mit "_v2"; alte Namen als Rueckfall
Numbers.CV_DAMAGE = { "floatingCombatTextCombatDamage_v2", "floatingCombatTextCombatDamage" }
Numbers.CV_HEAL = { "floatingCombatTextCombatHealing_v2", "floatingCombatTextCombatHealing" }
-- Namensplaketten freundlicher Spieler (Blizzard_SettingsDefinitions_Frame/Nameplates.lua): nur dort kann ein Add-on
-- Zahlen ueber einem Freund zeigen. "Nur Name" haelt sie schlank.
Numbers.CV_FRIENDS = "nameplateShowFriendlyPlayers"
Numbers.CV_ONLYNAME = "nameplateShowOnlyNameForFriendlyPlayerUnits"

local function setFirst(list, value)
  for _, name in ipairs(list) do
    if cvarExists(name) then return setCVar(name, value) end
  end
  return false
end

-- In Instanzen sperrt WoW die Plaketten freundlicher Spieler fuer Add-ons ("forbidden") -> dort keine eigenen
-- Heilzahlen ueber Freunden moeglich; Blizzards Heilzahlen bleiben dann an, unsere Heilzahlen schweigen.
function Numbers.InInstance()
  if not IsInInstance then return false end
  local inside, kind = IsInInstance()
  return inside and kind ~= "none" and true or false
end

-- Instanz: Freundes-Plaketten gesperrt -> eigene Heilzahlen an der Gruppenanzeige (groupHeal, Standard an),
-- sonst Blizzards Heilzahlen
function Numbers.OwnHeal()
  local n = N()
  return n.own and n.heal.on and (not Numbers.InInstance() or n.groupHeal ~= false)
end

function Numbers.ApplyBlizzard()
  local n = N()
  if cvarExists("WorldTextScale") then setCVar("WorldTextScale", tostring(n.worldScale or 1)) end
  -- Blizzard-Zahlen nur aendern, wenn Tiry den Schalter benutzt hat (sonst bleibt seine Spiel-Einstellung)
  if n.blizzDamageSet then setFirst(Numbers.CV_DAMAGE, n.hideBlizzDamage and "0" or "1") end
  if n.blizzHealSet then
    local hide = n.hideBlizzHeal and not (n.own and Numbers.InInstance() and n.groupHeal == false)
    setFirst(Numbers.CV_HEAL, hide and "0" or "1")
  end
  Numbers.ApplyFriendPlates()
end

-- Freundes-Plaketten (nur Name) fuer die Heilzahlen; alte Werte merken und beim Ausschalten zurueckgeben
function Numbers.ApplyFriendPlates()
  local n = N()
  local want = n.own and n.heal.on and n.friendPlates ~= false
  if not (cvarExists(Numbers.CV_FRIENDS) and C_CVar.GetCVar) then return end
  if want then
    if not n.platesSaved then
      n.platesSaved = { show = C_CVar.GetCVar(Numbers.CV_FRIENDS), only = cvarExists(Numbers.CV_ONLYNAME) and C_CVar.GetCVar(Numbers.CV_ONLYNAME) or nil }
    end
    setCVar(Numbers.CV_FRIENDS, "1")
    if cvarExists(Numbers.CV_ONLYNAME) then setCVar(Numbers.CV_ONLYNAME, "1") end
  elseif n.platesSaved then
    local sv = n.platesSaved
    n.platesSaved = nil
    if sv.show then setCVar(Numbers.CV_FRIENDS, sv.show) end
    if sv.only and cvarExists(Numbers.CV_ONLYNAME) then setCVar(Numbers.CV_ONLYNAME, sv.only) end
  end
end

-- Eigene Zahlen an/aus. An = Blizzards Schadens- und Heilzahlen aus (sonst stehen beide da und Tiry sieht
-- nur die Blizzard-Schrift), aus = Blizzards Zahlen wieder an.
function Numbers.SetOwn(on)
  local n = N()
  n.own = on and true or false
  n.hideBlizzDamage, n.hideBlizzHeal = n.own, n.own
  n.blizzDamageSet, n.blizzHealSet = true, true
  Numbers.ApplyBlizzard()
  if not n.own then Numbers.Clear() end
end

----------------------------------------------------------------------------
-- 2) Eigene Neon-Zahlen
----------------------------------------------------------------------------
local pool, active = {}, {}
Numbers.MAX = 24
Numbers.lanes = setmetatable({}, { __mode = "k" })

local function newText()
  local f = CreateFrame("Frame", nil, UIParent)
  f:SetFrameStrata("MEDIUM")
  f:SetSize(240, 60)
  f:EnableMouse(false)
  f.glow = f:CreateTexture(nil, "BACKGROUND")
  f.glow:SetTexture(UI.TEX.glow)
  f.glow:SetBlendMode("ADD")
  f.glow:SetPoint("CENTER")
  f.text = f:CreateFontString(nil, "OVERLAY")
  f.text:SetPoint("CENTER", 0, 0)
  f.prefix = f:CreateFontString(nil, "OVERLAY")
  f.prefix:SetPoint("RIGHT", f.text, "LEFT", -1, 0)
  local ag = f:CreateAnimationGroup()
  f.ag = ag
  f.move = ag:CreateAnimation("Translation")
  f.scale = ag:CreateAnimation("Scale")
  f.fadeIn = ag:CreateAnimation("Alpha")
  f.fadeOut = ag:CreateAnimation("Alpha")
  ag:SetScript("OnFinished", function() Numbers.Recycle(f) end)
  return f
end

-- Zahl weg + zurueck in den Vorrat (auch wenn die Animation nie fertig wird)
function Numbers.Recycle(f)
  if f.free then return end
  f.free = true
  f.ag:Stop()
  f:Hide()
  for i, a in ipairs(active) do if a == f then table.remove(active, i) break end end
  pool[#pool + 1] = f
end

-- alle sichtbaren Zahlen sofort weg (Ausschalten, Vorschau)
function Numbers.Clear()
  while #active > 0 do Numbers.Recycle(active[#active]) end
end

local function setup(f, kind, crit)
  local n = N()
  local o = n[kind]
  local size = math.floor((o.size or 24) * (crit and (o.critScale or 1.5) or 1) + 0.5)
  local file = Numbers.FontFile(o.font)
  local fl = flags(o.style)
  for _, fs in ipairs({ f.text, f.prefix }) do
    if not pcall(fs.SetFont, fs, file, size, fl) then pcall(fs.SetFont, fs, STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF", size, fl) end
    local c = crit and o.crit or o.color
    fs:SetTextColor(c[1], c[2], c[3], 1)
    if o.style == "schatten" then
      fs:SetShadowColor(0, 0, 0, 0.9)
      fs:SetShadowOffset(2, -2)
    else
      fs:SetShadowColor(0, 0, 0, 0)
      fs:SetShadowOffset(0, 0)
    end
  end
  local c = crit and o.crit or o.color
  f.glow:SetShown(o.style == "neon")
  f.glow:SetSize(size * 5, size * 2.4)
  f.glow:SetVertexColor(c[1], c[2], c[3], 0.45)
  -- Bewegung
  local anim = n.anim or "steigen"
  local dx = anim == "bogen" and ((math.random() < 0.5) and -60 or 60) or 0
  local dy = anim == "pop" and 18 or 70
  f.move:SetOffset(dx, dy)
  f.move:SetDuration(anim == "pop" and 1.0 or 1.25)
  f.move:SetSmoothing("OUT")
  local s0 = (crit or anim == "pop") and 1.7 or 1.15
  f.scale:SetScaleFrom(s0, s0)
  f.scale:SetScaleTo(1, 1)
  f.scale:SetDuration(0.22)
  f.scale:SetSmoothing("OUT")
  f.fadeIn:SetFromAlpha(0) f.fadeIn:SetToAlpha(1) f.fadeIn:SetDuration(0.08)
  f.fadeOut:SetFromAlpha(1) f.fadeOut:SetToAlpha(0) f.fadeOut:SetDuration(0.45)
  f.fadeOut:SetStartDelay(anim == "pop" and 0.6 or 0.8)
end

function Numbers.PlateFor(unit)
  if not (C_NamePlate and C_NamePlate.GetNamePlateForUnit) then return nil end
  local ok, p = pcall(C_NamePlate.GetNamePlateForUnit, unit)
  return ok and p or nil
end

-- Gruppenanzeige zu party1-4 / raid1-40 (Blizzard_UnitFrame: CompactPartyFrameMemberN, CompactRaidGroupXMemberY,
-- CompactRaidFrameN, PartyFrame.MemberFrameN; jeweils Feld .unit)
local function frameShows(fr, unit)
  return fr and fr.unit == unit and fr.IsVisible and fr:IsVisible()
end
function Numbers.GroupFrame(unit)
  for i = 1, 5 do
    local fr = _G["CompactPartyFrameMember" .. i]
    if frameShows(fr, unit) then return fr end
  end
  if PartyFrame then
    for i = 1, 4 do
      local fr = PartyFrame["MemberFrame" .. i]
      if frameShows(fr, unit) then return fr end
    end
  end
  for g = 1, 8 do
    for i = 1, 5 do
      local fr = _G["CompactRaidGroup" .. g .. "Member" .. i]
      if frameShows(fr, unit) then return fr end
    end
  end
  for i = 1, 40 do
    local fr = _G["CompactRaidFrame" .. i]
    if frameShows(fr, unit) then return fr end
  end
end

local function anchorFor(unit, kind)
  local plate
  if (unit == "target" or unit:match("^nameplate%d+$")) and C_NamePlate and C_NamePlate.GetNamePlateForUnit then
    local ok, p = pcall(C_NamePlate.GetNamePlateForUnit, unit)
    if ok then plate = p end
  end
  if plate then return plate, 0, 34 end
  if unit == "player" or kind == "heal" then return UIParent, 0, 60 end
  return UIParent, 0, 170
end

-- Eine Zahl zeigen. amount darf geheim sein (nur durchgereicht).
function Numbers.Show(unit, kind, amount, crit, at)
  local n = N()
  if not n.own or not n[kind] or not n[kind].on then return end
  -- Fehler bis 1.3.4: die aelteste wurde nur angehalten, nie versteckt -> blieb dauerhaft stehen
  if #active >= Numbers.MAX then Numbers.Recycle(active[1]) end
  local f = table.remove(pool) or newText()
  f.free = false
  setup(f, kind, crit)
  local text = (ns.DB.look.numbers == "voll" and BreakUpLargeNumbers and not secret(amount)) and BreakUpLargeNumbers(amount)
    or (AbbreviateLargeNumbers and AbbreviateLargeNumbers(amount)) or tostring(amount)
  f.text:SetText(text)
  f.prefix:SetText(kind == "heal" and "+" or "")
  local anchor, x, y = anchorFor(unit, kind)
  if at then anchor, x, y = at, 0, 0 end
  -- viele Treffer am selben Ort: abwechselnd links/rechts und gestaffelt nach oben statt alle uebereinander
  local lane = (Numbers.lanes[anchor] or 0) % 4
  Numbers.lanes[anchor] = lane + 1
  x = x + ((lane % 2 == 0) and -1 or 1) * (14 + lane * 10)
  y = y + lane * 14
  f:SetScale(at and 0.75 or 1)   -- an der Gruppenanzeige etwas kleiner
  f:ClearAllPoints()
  f:SetPoint("CENTER", anchor, "CENTER", x + math.random(-8, 8), y + math.random(-3, 3))
  f:SetAlpha(1)
  f:Show()
  active[#active + 1] = f
  f.ag:Stop()
  f.ag:Play()
  -- Sicherung: spaetestens nach 2,5 s weg (Animation kann im Spiel haengen, z. B. wenn die Plakette verschwindet)
  local token = (f.token or 0) + 1
  f.token = token
  if C_Timer and C_Timer.After then
    C_Timer.After(2.5, function() if f.token == token then Numbers.Recycle(f) end end)
  end
end

local function isTarget(unit)
  if unit == "target" then return true end
  if not (UnitIsUnit and UnitExists and UnitExists("target")) then return false end
  local same = UnitIsUnit(unit, "target")
  if secret(same) then return true end   -- unklar -> wie Ziel behandeln (nicht doppelt zeigen)
  return same == true
end

local function isPlayer(unit)
  if not (UnitIsUnit) then return false end
  local same = UnitIsUnit(unit, "player")
  if secret(same) then return false end
  return same == true
end

-- Zaehler fuer /kw diag: welche Einheiten liefern UNIT_COMBAT (nur Klartext-Teile)
Numbers.seen = {}
local function count(unit, event)
  if secret(unit) or secret(event) or type(unit) ~= "string" then return end
  local kind = unit:match("^(%a+)") or unit
  local k = kind .. ":" .. tostring(event)
  Numbers.seen[k] = (Numbers.seen[k] or 0) + 1
end

function Numbers.OnCombat(_, unit, event, flagText, amount)
  count(unit, event)
  local n = N()
  if not n.own or secret(unit) or secret(event) then return end
  local crit = not secret(flagText) and flagText == "CRITICAL"
  local plate = type(unit) == "string" and unit:match("^nameplate%d+$")
  if event == "WOUND" then
    -- Schaden an Gegnern: am Ziel; an anderen Namensplaketten nur, wenn sie nicht das Ziel sind (sonst doppelt)
    -- allEnemies aus: nur dein Ziel (weniger Gewusel in der Gruppe)
    if unit == "target" or (plate and N().allEnemies ~= false and not isTarget(unit)) then Numbers.Show(unit, "damage", amount, crit) end
  elseif event == "HEAL" then
    -- ueber dir, deinem Ziel und jedem Freund mit Namensplakette (Freundes-Plaketten schaltet KampfWerk ein);
    -- in Instanzen zeigt Blizzard die Heilzahlen (Plaketten dort fuer Add-ons gesperrt)
    if not Numbers.OwnHeal() or type(unit) ~= "string" then return end
    local group = unit:match("^party%d$") or unit:match("^raid%d+$")
    if Numbers.InInstance() then
      -- Plaketten gesperrt: du selbst in der Mitte, Gruppenmitglieder an ihrer Gruppenanzeige
      if unit == "player" then Numbers.Show(unit, "heal", amount, crit)
      elseif group then
        local fr = Numbers.GroupFrame(unit)
        if fr then Numbers.Show(unit, "heal", amount, crit, fr) end
      end
      return
    end
    if unit == "player" then
      Numbers.Show(unit, "heal", amount, crit)
    elseif (unit == "target" or (plate and not isTarget(unit))) and not isPlayer(unit) then
      -- ueber der Plakette; ohne Plakette (zu weit weg) nicht irgendwo in der Mitte
      if Numbers.PlateFor(unit) then Numbers.Show(unit, "heal", amount, crit) end
    end
  end
end

-- Probe in der Bildschirmmitte (Einstellungen)
function Numbers.Test()
  local was = N().own
  N().own = true
  Numbers.Show("test", "damage", 12345, false)
  Numbers.Show("test", "damage", 48210, true)
  Numbers.Show("player", "heal", 6789, false)
  Numbers.Show("player", "heal", 15320, true)
  N().own = was
end

function Numbers.Init()
  Numbers.ApplyBlizzard()
  if not Numbers.hooked then
    Numbers.hooked = true
    ns.On("UNIT_COMBAT", Numbers.OnCombat)
    -- Instanz rein/raus: Blizzards Heilzahlen dort an, draussen wieder unsere
    ns.On("PLAYER_ENTERING_WORLD", function() Numbers.ApplyBlizzard() end)
  end
end

-- /kw diag: alles, was fuer die Zahlen zaehlt, in den Chat
function Numbers.Diag()
  local n = N()
  local P = ns.Print
  P("KampfWerk " .. tostring(ns.VERSION) .. " - Zahlen-Diagnose")
  P(("eigene Zahlen: %s | Schaden: %s | Heilung: %s | Freundes-Namen: %s | Instanz: %s | Gruppenanzeige: %s"):format(
    tostring(n.own), tostring(n.damage.on), tostring(n.heal.on), tostring(n.friendPlates ~= false), tostring(Numbers.InInstance()), tostring(n.groupHeal ~= false)))
  local names = { Numbers.CV_DAMAGE[1], Numbers.CV_DAMAGE[2], Numbers.CV_HEAL[1], Numbers.CV_HEAL[2],
    Numbers.CV_FRIENDS, Numbers.CV_ONLYNAME, "enableFloatingCombatText", "WorldTextScale" }
  for _, name in ipairs(names) do
    local v = C_CVar and C_CVar.GetCVar and C_CVar.GetCVar(name)
    local log = Numbers.cvLog[name]
    P(("  %s = %s%s"):format(name, v == nil and "|cffff5050fehlt|r" or tostring(v),
      log and ("  (gesetzt %s -> %s%s)"):format(log.want, tostring(log.got), log.err and (" Fehler: " .. log.err) or "") or ""))
  end
  local any = false
  for k, c in pairs(Numbers.seen) do P("  UNIT_COMBAT " .. k .. " x" .. c) any = true end
  if not any then P("  UNIT_COMBAT: noch kein Ereignis (einmal kaempfen/heilen, dann erneut /kw diag)") end
  P("  Fehler: " .. #ns.errors .. (#ns.errors > 0 and " (/kw fehler)" or ""))
end

-- Schlaghagel 1.0 - Simulation (Klasse per Umgebungsvariable PROC_CLASS=SHAMAN|WARLOCK; Standard SHAMAN): Blizzard-Aura-Slot (CustomAuraContainerTemplate), Kampf-Sperre, kein Ton.
-- Aufruf aus addons/:  cd addons && lua5.1 ../tests/proc.lua
local CLASS = os.getenv("PROC_CLASS") or "SHAMAN"
local ID = ({ SHAMAN = 16257 })[CLASS]
function UnitClass() return "x", CLASS end
local T = 0; function GetTime() return T end
local fails, oks = 0, 0
local function check(c, name) if c then oks = oks + 1 else fails = fails + 1; print_("FEHLER: " .. name) end end
local out = {}
print_ = print
function print(s) out[#out + 1] = tostring(s) end
local function said(p) for _, l in ipairs(out) do if l:find(p, 1, true) then return true end end return false end

local function obj(kind)
  local o = { _kind = kind, _shown = true, _scripts = {} }
  return setmetatable(o, { __index = function(t, k)
    return function(self, ...)
      if k == "GetCenter" then return 100, 100 end
      if k == "GetScale" or k == "GetFrameLevel" then return 1 end
      if k == "CreateAnimationGroup" then local g = obj("ag"); g.playing = false
        rawset(g, "Play", function(s) s.playing = true end); rawset(g, "Stop", function(s) s.playing = false end); return g end
      if k == "CreateAnimation" or k == "CreateTexture" or k == "CreateFontString" or k == "CreateMaskTexture" then return obj(k) end
      if k == "SetScript" then local a = { ... }; t._scripts[a[1]] = a[2]; return end
      if k == "Show" then t._shown = true return end
      if k == "Hide" then t._shown = false return end
      if k == "IsShown" then return t._shown end
      if k == "SetText" then t._text = (...) return end
    end
  end })
end

local incombat, encounter = false, false
function InCombatLockdown() return incombat end
UIParent = obj("UIParent"); STANDARD_TEXT_FONT = "x"; SlashCmdList = {}
local played = {}
function PlaySoundFile(f) played[#played + 1] = f end
C_Spell = { GetSpellTexture = function() return 136223 end }
C_AddOns = { IsAddOnLoaded = function() return false end, LoadAddOn = function(n) loadedAC = n end }
C_XMLUtil = { GetTemplateInfo = function(n) return n == "CustomAuraContainerTemplate" and {} or nil end }
Enum = { UnitAuraSoundTrigger = { Added = 0 }, AddOnRestrictionType = { Encounter = 1 } }
C_RestrictedActions = { IsAddOnRestrictionActive = function() return encounter end }
local buff = false
local sounds, soundSeq = {}, 0
C_UnitAuras = {
  GetPlayerAuraBySpellID = function(id) if incombat then error("secret") end return (buff and id == ID) and {} or nil end,
  AddAuraSound = function(trig, info) soundSeq = soundSeq + 1; sounds[soundSeq] = info; return soundSeq end,
  RemoveAuraSound = function(id) sounds[id] = nil end,
}

-- Blizzard-Aura-Container nachgebaut: Slot-Knopf wird vom "Spiel" gezeigt, solange der Buff da ist.
local slotBtn, slotOpts, containers = nil, nil, 0
local frames = {}
function CreateFrame(kind, name, parent, tpl)
  local f = obj(kind); frames[#frames + 1] = f
  if kind == "AuraContainer" then
    containers = containers + 1
    rawset(f, "AddAuraSlot", function(self, key, filter, opts)
      slotOpts = opts
      local b = obj("AuraButton"); b._shown = false; b.anims = {}
      rawset(b, "SetIcon", function(s, x) s.icon = x end)
      rawset(b, "SetDurationCooldown", function(s, x) s.cd = x end)
      rawset(b, "SetDurationText", function(s, x) s.text = x end)
      rawset(b, "AddAuraShownAnimation", function(s, g) s.anims[#s.anims + 1] = g end)
      rawset(b, "SetApplicationCount", function(s, x) s.count = x end)
      opts.initializeFrame(b)
      slotBtn = b
      return b
    end)
  end
  return f
end
local function gameAura(on)   -- so wie CustomAuraButtonPrivateMixin:ApplyVisibility
  buff = on
  if not slotBtn then return end
  local inc = slotOpts.candidateFilters.includeSpellIDs
  local match = on and inc[ID] == true
  local was = slotBtn._shown
  slotBtn._shown = match
  if match and not was then for _, g in ipairs(slotBtn.anims) do g:Play() end
  elseif not match then for _, g in ipairs(slotBtn.anims) do g:Stop() end end
end

dofile("Schlaghagel/Schlaghagel.lua")
local E = frames[#frames]
local P = _G.SchlaghagelPreview or nil
local function ev(...) E._scripts.OnEvent(E, ...) end

-- 0) Klasse ohne Proc (z. B. Magier): still, kein Aufbau, kein Fehler
if not ID then
  ev("ADDON_LOADED", "Schlaghagel"); ev("PLAYER_LOGIN"); ev("PLAYER_REGEN_ENABLED")
  check(containers == 0 and #out == 0, "andere Klasse: nichts gebaut, keine Meldung")
  SlashCmdList.SCHLAGHAGEL("test")
  check(said("nur fuer Schamanen"), "andere Klasse: Hinweis bei /hagel")
  print_(string.format("%s: %d ok, %d Fehler", CLASS, oks, fails))
  if fails > 0 then os.exit(1) end
  print_("HAGEL TESTS OK") os.exit(0)
end
-- 1) /reload mitten im Kampf: kein Aufbau, wartet
incombat = true
ev("ADDON_LOADED", "Schlaghagel")
check(containers == 0, "kein Aufbau im Kampf")
ev("PLAYER_LOGIN")
check(said("wartet"), "Login-Meldung nennt 'wartet'")
-- 2) Kampfende: Aufbau
incombat = false
ev("PLAYER_REGEN_ENABLED")
check(containers == 1, "Container nach Kampfende gebaut")
check(loadedAC == "Blizzard_AuraContainer", "Blizzard_AuraContainer geladen")
check(slotOpts and slotOpts.candidateFilters.includeSpellIDs[ID] == true, "Filter = Menge {[ID]=true}")
local n = 0 for _ in pairs(slotOpts.candidateFilters.includeSpellIDs) do n = n + 1 end
check(n == 1, "genau eine Buff-ID")
check(slotBtn.icon and slotBtn.cd and slotBtn.text, "Symbol/Ablauf/Restzeit an Blizzard uebergeben")
check(#slotBtn.anims == 1, "Blinken standardmaessig an (wie ProcAlarm)")
check(rawget(slotBtn, "count") ~= nil, "Ladungen an Blizzard uebergeben")
check(said("Schlaghagel"), "Login nennt Schlaghagel")
ev("PLAYER_REGEN_ENABLED")
check(containers == 1, "nicht doppelt gebaut")
-- 3) Proc im Kampf: das Spiel zeigt, Add-on liest nichts
incombat = true
gameAura(true)
check(slotBtn._shown, "Slot sichtbar bei Schlaghagel im Kampf")
check(slotBtn.anims[1].playing, "Blinken laeuft im Kampf")
gameAura(false)
check(not slotBtn._shown and not slotBtn.anims[1].playing, "weg nach Verbrauch/Ablauf, Blinken gestoppt")
-- 4) kein Ton (Kampf vorbei)
incombat = false
check(next(sounds) == nil and #played == 0, "kein Ton eingetragen")
-- 5) Diagnose, Test, Verschieben
out = {}
buff = true
SlashCmdList.SCHLAGHAGEL("diag")
check(said("aktiv") and said("Symbol") and not said("Ton"), "diag meldet Slot/Teile, kein Ton")
check(said("gerade aktiv: |cff40ff59ja"), "diag erkennt Buff ausserhalb des Kampfes")
out = {}
incombat = true
SlashCmdList.SCHLAGHAGEL("diag")
check(said("gesperrt (normal)"), "diag im Kampf ohne Fehler")
incombat = false
SlashCmdList.SCHLAGHAGEL("test")
check(#played == 0 and next(sounds) == nil, "Test ohne Ton")
SlashCmdList.SCHLAGHAGEL("unlock"); SlashCmdList.SCHLAGHAGEL("lock"); SlashCmdList.SCHLAGHAGEL("groesse 1.4"); SlashCmdList.SCHLAGHAGEL("reset"); SlashCmdList.SCHLAGHAGEL("")
check(SchlaghagelDB.scale == 1 and SchlaghagelDB.unlocked == nil, "reset/lock")
local b0 = SchlaghagelDB.blink
SlashCmdList.SCHLAGHAGEL("blinken")
check(SchlaghagelDB.blink == not b0 and said("/reload"), "blinken umschalten")
print_(string.format("%s: %d ok, %d Fehler", CLASS, oks, fails))
if fails > 0 then os.exit(1) end
print_("HAGEL TESTS OK")

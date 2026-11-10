-- ProcAlarm 2.1 - Simulation: Blizzard-Aura-Slot (CustomAuraContainerTemplate), Kampf-Sperre, kein Ton.
-- Aufruf aus addons/:  cd addons && lua5.1 ../tests/proc.lua
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
  GetPlayerAuraBySpellID = function(id) if incombat then error("secret") end return (buff and id == 17941) and {} or nil end,
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
  local match = on and inc[17941] == true
  local was = slotBtn._shown
  slotBtn._shown = match
  if match and not was then for _, g in ipairs(slotBtn.anims) do g:Play() end
  elseif not match then for _, g in ipairs(slotBtn.anims) do g:Stop() end end
end

dofile("ProcAlarm/ProcAlarm.lua")
local E = frames[#frames]
local P = _G.ProcAlarmPreview or nil
local function ev(...) E._scripts.OnEvent(E, ...) end

-- 1) /reload mitten im Kampf: kein Aufbau, wartet
incombat = true
ev("ADDON_LOADED", "ProcAlarm")
check(containers == 0, "kein Aufbau im Kampf")
ev("PLAYER_LOGIN")
check(said("wartet"), "Login-Meldung nennt 'wartet'")
-- 2) Kampfende: Aufbau
incombat = false
ev("PLAYER_REGEN_ENABLED")
check(containers == 1, "Container nach Kampfende gebaut")
check(loadedAC == "Blizzard_AuraContainer", "Blizzard_AuraContainer geladen")
check(slotOpts and slotOpts.candidateFilters.includeSpellIDs[17941] == true, "Filter = Menge {[17941]=true}")
check(slotBtn.icon and slotBtn.cd and slotBtn.text, "Symbol/Ablauf/Restzeit an Blizzard uebergeben")
check(#slotBtn.anims == 1, "nur Blinken registriert (kein Ring)")
ev("PLAYER_REGEN_ENABLED")
check(containers == 1, "nicht doppelt gebaut")
-- 3) Proc im Kampf: das Spiel zeigt, Add-on liest nichts
incombat = true
gameAura(true)
check(slotBtn._shown, "Slot sichtbar bei Schattentrance im Kampf")
check(slotBtn.anims[1].playing, "Blinken laeuft")
gameAura(false)
check(not slotBtn._shown and not slotBtn.anims[1].playing, "weg nach Schattenblitz/Ablauf")
-- 4) kein Ton (Kampf vorbei)
incombat = false
check(next(sounds) == nil and #played == 0, "kein Ton eingetragen")
-- 5) Diagnose, Test, Verschieben
out = {}
buff = true
SlashCmdList.PROCALARM("diag")
check(said("aktiv") and said("Symbol") and not said("Ton"), "diag meldet Slot/Teile, kein Ton")
check(said("gerade aktiv: |cff40ff59ja"), "diag erkennt Buff ausserhalb des Kampfes")
out = {}
incombat = true
SlashCmdList.PROCALARM("diag")
check(said("gesperrt (normal)"), "diag im Kampf ohne Fehler")
incombat = false
SlashCmdList.PROCALARM("test")
check(#played == 0 and next(sounds) == nil, "Test ohne Ton")
SlashCmdList.PROCALARM("unlock"); SlashCmdList.PROCALARM("lock"); SlashCmdList.PROCALARM("groesse 1.4"); SlashCmdList.PROCALARM("reset"); SlashCmdList.PROCALARM("")
check(ProcAlarmDB.scale == 1 and ProcAlarmDB.unlocked == nil, "reset/lock")
print_(string.format("%d ok, %d Fehler", oks, fails))
if fails > 0 then os.exit(1) end
print_("PROC TESTS OK")

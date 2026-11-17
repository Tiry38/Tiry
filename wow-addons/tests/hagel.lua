-- Schlaghagel 1.1 - Simulation (Schlaghagel + Waffe des Mahlstroms) (Klasse per Umgebungsvariable PROC_CLASS=SHAMAN|WARLOCK; Standard SHAMAN): Blizzard-Aura-Slot (CustomAuraContainerTemplate), Kampf-Sperre, kein Ton.
-- Aufruf aus addons/:  cd addons && lua5.1 ../tests/proc.lua
local CLASS = os.getenv("PROC_CLASS") or "SHAMAN"
local ID = ({ SHAMAN = 16257 })[CLASS]
local MAHL = 408505
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
local buff = {}
local sounds, soundSeq = {}, 0
C_UnitAuras = {
  GetPlayerAuraBySpellID = function(id) if incombat then error("secret") end return (buff[id]) and {} or nil end,
  AddAuraSound = function(trig, info) soundSeq = soundSeq + 1; sounds[soundSeq] = info; return soundSeq end,
  RemoveAuraSound = function(id) sounds[id] = nil end,
}

-- Blizzard-Aura-Container nachgebaut: je Container ein Slot-Knopf, vom "Spiel" gezeigt, solange sein Buff da ist.
local slots, containers = {}, 0          -- slots[buffID] = { btn, opts, container }
local frames = {}
function CreateFrame(kind, name, parent, tpl)
  local f = obj(kind); frames[#frames + 1] = f
  if name then _G[name] = f end
  if kind == "AuraContainer" then
    containers = containers + 1
    rawset(f, "AddAuraSlot", function(self, key, filter, opts)
      local b = obj("AuraButton"); b._shown = false; b.anims = {}
      rawset(b, "SetIcon", function(s, x) s.icon = x end)
      rawset(b, "SetDurationCooldown", function(s, x) s.cd = x end)
      rawset(b, "SetDurationText", function(s, x) s.text = x end)
      rawset(b, "AddAuraShownAnimation", function(s, g) s.anims[#s.anims + 1] = g end)
      rawset(b, "SetApplicationCount", function(s, x) s.count = x end)
      opts.initializeFrame(b)
      local id = next(opts.candidateFilters.includeSpellIDs)
      slots[id] = { btn = b, opts = opts, container = f, key = key }
      return b
    end)
  end
  return f
end
local function gameAura(id, on)   -- so wie CustomAuraButtonPrivateMixin:ApplyVisibility
  buff[id] = on or nil
  local s = slots[id]
  if not s then return end
  local b = s.btn
  local match = on and s.opts.candidateFilters.includeSpellIDs[id] == true and s.container._shown
  local was = b._shown
  b._shown = match and true or false
  if match and not was then for _, g in ipairs(b.anims) do g:Play() end
  elseif not match then for _, g in ipairs(b.anims) do g:Stop() end end
end

dofile("Schlaghagel/Schlaghagel.lua")
local E = frames[#frames]
local function ev(...) E._scripts.OnEvent(E, ...) end

-- 0) Klasse ohne Proc (z. B. Hexer): still, kein Aufbau, kein Fehler
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
-- 2) Kampfende: Aufbau beider Anzeigen
incombat = false
ev("PLAYER_REGEN_ENABLED")
check(containers == 2, "zwei Container nach Kampfende gebaut (" .. containers .. ")")
check(loadedAC == "Blizzard_AuraContainer", "Blizzard_AuraContainer geladen")
for _, id in ipairs({ ID, MAHL }) do
  local s = slots[id]
  check(s ~= nil, "Slot fuer Buff " .. id)
  if s then
    local n = 0 for _ in pairs(s.opts.candidateFilters.includeSpellIDs) do n = n + 1 end
    check(n == 1, "genau eine Buff-ID je Slot (" .. id .. ")")
    check(s.btn.icon and s.btn.cd and s.btn.text and rawget(s.btn, "count") ~= nil, "Symbol/Ablauf/Restzeit/Ladungen an Blizzard (" .. id .. ")")
  end
end
check(#slots[ID].btn.anims == 1, "Schlaghagel: nur Blinken")
check(#slots[MAHL].btn.anims == 1 + 5 + 6 + 1, "Mahlstrom: Blinken + 5 Strom-Schleifen + 6 Blitze + Einschlag (" .. #slots[MAHL].btn.anims .. ")")
check(_G.SchlaghagelAnchor and _G.SchlaghagelMahlAnchor, "zwei Anker")
check(SchlaghagelDB.mahl and SchlaghagelDB.mahl.y == 120 and SchlaghagelDB.y == -150, "Mahlstrom ueber dem Charakter, Schlaghagel darunter")
check(said("Schlaghagel") and said("Waffe des Mahlstroms"), "Login nennt beide")
ev("PLAYER_REGEN_ENABLED")
check(containers == 2, "nicht doppelt gebaut")
-- 3) Procs im Kampf: das Spiel zeigt, Add-on liest nichts; beide unabhaengig
incombat = true
gameAura(MAHL, true)
check(slots[MAHL].btn._shown and not slots[ID].btn._shown, "nur Mahlstrom sichtbar")
local allPlay = true for _, g in ipairs(slots[MAHL].btn.anims) do allPlay = allPlay and g.playing end
check(allPlay, "Strom-Animation laeuft im Kampf")
gameAura(ID, true)
check(slots[ID].btn._shown and slots[ID].btn.anims[1].playing, "Schlaghagel dazu, blinkt")
gameAura(MAHL, false)
local anyPlay = false for _, g in ipairs(slots[MAHL].btn.anims) do anyPlay = anyPlay or g.playing end
check(not slots[MAHL].btn._shown and not anyPlay and slots[ID].btn._shown, "Mahlstrom weg (Blitzschlag), Animation aus, Schlaghagel bleibt")
gameAura(ID, false)
-- 4) kein Ton (Kampf vorbei)
incombat = false
check(next(sounds) == nil and #played == 0, "kein Ton eingetragen")
-- 5) Diagnose, Test, Verschieben, Groesse je Anzeige
out = {}
buff[MAHL] = true
SlashCmdList.SCHLAGHAGEL("diag")
check(said("aktiv") and said("Symbol") and said("Strom") and not said("Ton"), "diag meldet Slots/Teile, kein Ton")
check(said("gerade aktiv: |cff40ff59ja"), "diag erkennt Buff ausserhalb des Kampfes")
out = {}
incombat = true
SlashCmdList.SCHLAGHAGEL("diag")
check(said("gesperrt (normal)"), "diag im Kampf ohne Fehler")
SlashCmdList.SCHLAGHAGEL("mahl")
check(said("erst nach dem Kampf") and not SchlaghagelDB.mahl.aus, "an/aus im Kampf gesperrt")
incombat = false
SlashCmdList.SCHLAGHAGEL("test")
check(#played == 0 and next(sounds) == nil, "Test ohne Ton")
check(_G.SchlaghagelPreview._shown and _G.SchlaghagelMahlPreview._shown, "Test zeigt beide")
SlashCmdList.SCHLAGHAGEL("groesse mahl 1,6")
check(SchlaghagelDB.mahl.scale == 1.6 and SchlaghagelDB.scale == 1, "Groesse nur Mahlstrom")
SlashCmdList.SCHLAGHAGEL("groesse 1.2")
check(SchlaghagelDB.mahl.scale == 1.2 and SchlaghagelDB.scale == 1.2, "Groesse beide")
SlashCmdList.SCHLAGHAGEL("unlock"); SlashCmdList.SCHLAGHAGEL("lock"); SlashCmdList.SCHLAGHAGEL("groesse 1.4"); SlashCmdList.SCHLAGHAGEL("reset"); SlashCmdList.SCHLAGHAGEL("")
check(SchlaghagelDB.scale == 1 and SchlaghagelDB.mahl.scale == 1 and SchlaghagelDB.unlocked == nil, "reset/lock")
check(SchlaghagelDB.mahl.y == 120 and SchlaghagelDB.y == -150, "reset = Standardplaetze")
-- Ziehen speichert je Anzeige
_G.SchlaghagelMahlAnchor._scripts.OnDragStop(_G.SchlaghagelMahlAnchor)
check(SchlaghagelDB.mahl.x == 0 and SchlaghagelDB.mahl.y == 0 and SchlaghagelDB.y == -150, "Ziehen speichert nur Mahlstrom")
-- an/aus
out = {}
SlashCmdList.SCHLAGHAGEL("mahl")
check(SchlaghagelDB.mahl.aus and not slots[MAHL].container._shown and said("aus"), "Mahlstrom aus")
gameAura(MAHL, true)
check(not slots[MAHL].btn._shown, "aus: kein Proc-Bild")
gameAura(MAHL, false)
SlashCmdList.SCHLAGHAGEL("mahl")
check(not SchlaghagelDB.mahl.aus and slots[MAHL].container._shown and containers == 2, "Mahlstrom wieder an, ohne neuen Container")
local b0 = SchlaghagelDB.blink
SlashCmdList.SCHLAGHAGEL("blinken")
check(SchlaghagelDB.blink == not b0 and said("/reload"), "blinken umschalten")
SlashCmdList.SCHLAGHAGEL("strom")
check(SchlaghagelDB.strom == false, "Strom-Animation aus")
-- Neu laden mit 1.0-Daten: Schlaghagel-Platz bleibt, Mahlstrom bekommt Standard
SchlaghagelDB = { x = 33, y = -99, scale = 1.3, blink = false }
containers, slots = 0, {}
ev("ADDON_LOADED", "Schlaghagel")
check(SchlaghagelDB.x == 33 and SchlaghagelDB.scale == 1.3 and SchlaghagelDB.blink == false, "1.0-Einstellungen bleiben")
check(SchlaghagelDB.mahl.y == 120 and SchlaghagelDB.strom == true, "Mahlstrom-Standard ergaenzt")
-- ausgeschaltet gespeichert -> kein Aufbau
SchlaghagelDB = { mahl = { aus = true } }
slots = {}
local c0 = containers
ev("ADDON_LOADED", "Schlaghagel")
check(slots[MAHL] == nil and slots[ID] ~= nil, "ausgeschaltet: kein Mahlstrom-Slot, Schlaghagel schon")
out = {} SlashCmdList.SCHLAGHAGEL("diag")
check(said("ausgeschaltet") and not said("Waffe des Mahlstroms (Buff 408505): |cff40ff59"), "diag nennt aus")
local n = 0 for _ in pairs(slots) do n = n + 1 end
check(n == 1, "keine doppelten Anzeigen nach Neuladen")
print_(string.format("%s: %d ok, %d Fehler", CLASS, oks, fails))
if fails > 0 then os.exit(1) end
print_("HAGEL TESTS OK")

-- WindBaem 1.0 - Simulation: Aura-Ton beim Spiel anmelden (C_UnitAuras.AddAuraSound), Kampf-/Bosssperre,
-- Umschalten von Klang/Waffe/Totem/Pause, Abmelden ohne Doppel-Eintraege, Befehle.
-- Aufruf aus addons/WindBaem:  lua5.1 ../../tests/wb.lua   -> "WB TESTS OK"
local oks, fails = 0, 0
local function check(c, name) if c then oks = oks + 1 else fails = fails + 1; io.stderr:write("FEHLER: " .. name .. "\n") end end
local out = {}
local print_ = print
function print(s) out[#out + 1] = tostring(s) end
local function said(p) for _, l in ipairs(out) do if l:find(p, 1, true) then return true end end return false end

-- erlaubte Ereignisse/Methoden aus dem strengen Forever-Nachbau
local HERE = arg[0]:match("^(.*/)") or "./"
local EVENTS = dofile(HERE .. "forever_events.lua")
local evset = {}
for k, v in pairs(EVENTS) do if type(k) == "number" then evset[v] = true else evset[k] = true end end

local frames = {}
function CreateFrame()
  local f = { ev = {} }
  function f.RegisterEvent(self, e)
    if not evset[e] then error("unbekanntes Ereignis " .. e) end
    self.ev[e] = true
  end
  function f.SetScript(self, k, fn) self[k] = fn end
  frames[#frames + 1] = f
  return f
end
local function fire(e, ...) for _, f in ipairs(frames) do if f.ev[e] and f.OnEvent then f.OnEvent(f, e, ...) end end end

local incombat, encounter = false, false
function InCombatLockdown() return incombat end
Enum = { UnitAuraSoundTrigger = { Added = 0, ApplicationsIncreased = 1, Removed = 2 }, AddOnRestrictionType = { Encounter = 1 } }
C_RestrictedActions = { IsAddOnRestrictionActive = function(t) return t == 1 and encounter end }

-- Spiel-Seite: angemeldete Toene; im Kampf lehnt das Spiel ab (HasRestrictions)
local reg, nextId, played = {}, 100, {}
local function count() local n = 0 for _ in pairs(reg) do n = n + 1 end return n end
C_UnitAuras = {
  AddAuraSound = function(trig, s)
    if incombat or encounter then error("restricted") end
    assert(trig == 0, "Ausloeser Added")
    assert(s.unitToken == "player" and type(s.spellID) == "number", "unit/spellID")
    assert(type(s.soundFileName) == "string" and s.soundFileName:match("^Interface\\AddOns\\WindBaem\\Media\\%a+%.ogg$"), "Datei")
    assert(s.throttleSeconds >= 0 and s.throttleSeconds <= 5, "throttle 0-5")
    nextId = nextId + 1; reg[nextId] = s; return nextId
  end,
  RemoveAuraSound = function(id) reg[id] = nil end,
}
function PlaySoundFile(f, ch) played[#played + 1] = f .. "|" .. tostring(ch) end
SlashCmdList = {}

dofile("WindBaem.lua")
local W = WindBaem
local function cmd(s) SlashCmdList.WINDBAEM(s) end
local function ids() local t = {} for _, s in pairs(reg) do t[s.spellID] = s end return t end

-- Dateien vorhanden
for _, n in ipairs({ "pling", "tick", "wusch" }) do
  local f = io.open("Media/" .. n .. ".ogg", "rb"); check(f ~= nil, "Media/" .. n .. ".ogg fehlt"); if f then f:close() end
end
-- Spell-IDs: genau die 7 Proc-Auren (Waffe R1-4, Totem R1-3)
check(#W.WEAPON == 4 and #W.TOTEM == 3, "7 Proc-IDs")

fire("ADDON_LOADED", "Anderes")
check(WindBaemDB == nil, "fremdes ADDON_LOADED ignoriert")
fire("ADDON_LOADED", "WindBaem")
check(WindBaemDB and WindBaemDB.on == true and WindBaemDB.ton == "pling" and WindBaemDB.pause == 0, "Standardwerte")
fire("PLAYER_LOGIN")
check(count() == 7, "7 Toene angemeldet: " .. count())
local t = ids()
for _, id in ipairs({ 8233, 8236, 10484, 16361, 8516, 10608, 10610 }) do check(t[id] ~= nil, "ID " .. id .. " angemeldet") end
check(t[8233].soundFileName:find("pling.ogg", 1, true) and t[8233].outputChannel == "SFX", "pling.ogg auf SFX (Effekte-Regler)")
check(said("bereit"), "Login-Meldung bereit")

-- Klang wechseln: keine Doppel-Eintraege, neue Datei, Test-Ton
cmd("ton wusch")
check(count() == 7, "nach Klangwechsel weiter 7 (keine Doppelten)")
check(ids()[16361].soundFileName:find("wusch.ogg", 1, true), "wusch.ogg aktiv")
check(played[#played]:find("wusch.ogg|SFX", 1, true), "Klangwechsel spielt Probe")
cmd("ton quatsch"); check(WindBaemDB.ton == "wusch", "unbekannter Klang ignoriert")

-- Totem aus / Waffe aus
cmd("totem"); check(count() == 4 and not ids()[8516], "Totem aus -> 4")
cmd("waffe"); check(count() == 0, "beides aus -> 0")
cmd("waffe"); cmd("totem"); check(count() == 7, "beides wieder an -> 7")

-- Kanal
cmd("kanal master"); check(ids()[8233].outputChannel == "Master" and played[#played]:find("|Master", 1, true), "Kanal Master")
cmd("kanal quatsch"); check(WindBaemDB.kanal == "Master", "unbekannter Kanal ignoriert")
cmd("kanal sfx"); check(ids()[8233].outputChannel == "SFX", "Kanal SFX")

-- Pause
cmd("pause 2"); check(ids()[8233].throttleSeconds == 2, "Pause 2 s")
cmd("pause 9"); check(WindBaemDB.pause == 2, "Pause > 5 abgelehnt")
cmd("pause 0")

-- aus/an
cmd("aus"); check(count() == 0, "aus -> abgemeldet")
cmd("an"); check(count() == 7, "an -> 7")

-- Kampf: nichts anfassen, danach eintragen
incombat = true
cmd("ton tick")
check(count() == 7 and ids()[8233].soundFileName:find("wusch.ogg", 1, true), "im Kampf bleibt alles wie es war")
check(W.Live().pending, "im Kampf: vorgemerkt")
incombat = false; fire("PLAYER_REGEN_ENABLED")
check(count() == 7 and ids()[8233].soundFileName:find("tick.ogg", 1, true), "nach dem Kampf neu eingetragen (tick)")

-- Bosskampf-Sperre beim Login (/reload im Raid)
for k in pairs(reg) do reg[k] = nil end
encounter = true; W.Apply()
check(count() == 0 and W.Live().pending, "Bosskampf: vorgemerkt")
encounter = false; fire("ENCOUNTER_END")
check(count() == 7, "nach ENCOUNTER_END eingetragen")

-- Test-Befehl, Diag, Hilfe
local n0 = #played; cmd("test"); check(#played == n0 + 1 and played[#played]:find("tick.ogg", 1, true), "/wb test spielt")
out = {}; cmd("diag"); check(said("eingetragen: 7 von 7"), "diag")
out = {}; cmd(""); check(said("/wb ton pling"), "Hilfe")

-- Umstieg von 1.0/1.1: braam/baem + Master -> pling + SFX
WindBaemDB = { on = true, ton = "braam", kanal = "Master", waffe = true, totem = true, pause = 0 }
fire("ADDON_LOADED", "WindBaem")
check(WindBaemDB.ton == "pling" and WindBaemDB.kanal == "SFX" and WindBaemDB.ver == 110, "1.0-Einstellungen umgestellt")
WindBaemDB.kanal = "Master"; fire("ADDON_LOADED", "WindBaem")
check(WindBaemDB.kanal == "Master", "eigene Kanalwahl nach 1.1 bleibt")
for k in pairs(reg) do reg[k] = nil end; W.Off(); W.Apply()

WindBaemDB.ton = "baem"; fire("ADDON_LOADED", "WindBaem"); check(WindBaemDB.ton == "pling", "1.1-Klang baem -> pling")
WindBaemDB.ton = "tick"; fire("ADDON_LOADED", "WindBaem"); check(WindBaemDB.ton == "tick", "eigene Klangwahl bleibt")

-- Client ohne AddAuraSound
local keep = C_UnitAuras.AddAuraSound; C_UnitAuras.AddAuraSound = nil
W.Apply(); check(count() == 0 and W.Live().why:find("keine Aura", 1, true), "ohne API: Grund")
C_UnitAuras.AddAuraSound = keep

-- Spiel lehnt ab
C_UnitAuras.AddAuraSound = function() return nil end
W.Apply(); check(W.Count() == 0 and W.Live().why:find("abgelehnt", 1, true), "abgelehnt: Grund")
C_UnitAuras.AddAuraSound = keep

print = print_
if fails > 0 then print(fails .. " Fehler, " .. oks .. " ok"); os.exit(1) end
print("WB TESTS OK (" .. oks .. " Pruefungen)")

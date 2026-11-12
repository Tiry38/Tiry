-- WindBaem 1.2.0 (Tiry): kurzer, leiser Hinweiston bei jedem Windzorn-Proc - auch im Kampf.
--
-- Warum keine WeakAura: WoW Forever sperrt im Kampf Aura-Daten und den Kampflog fuer Add-ons
-- ("secret values"), WeakAuras-Forever fuehrt keinen eigenen Code aus. Eine WeakAura wuerde
-- im Kampf also nie ausloesen.
--
-- Loesung (Blizzards offizieller Weg): C_UnitAuras.AddAuraSound. Wir melden dem SPIEL einmal
-- (ausserhalb des Kampfes) "spiel diesen Ton, wenn diese Aura auf mir landet" - abspielen tut
-- das Spiel selbst, auch im Kampf. Das Add-on liest im Kampf nichts.
--
-- Windzorn-Proc = kurze, unsichtbare Aura auf dir (Angriffskraft + Extra-Angriff, 1-1,5 s).
-- Spell-IDs aus den Forever-Spieldaten (simc-forever 1.60.1.70862, Effekt "Extra Attacks"):
--   Waffe des Windzorns  Rang 1-4: 8233, 8236, 10484, 16361
--   Totem des Windzorns  Rang 1-3: 8516, 10608, 10610

local VERSION = "1.2.0"
local MEDIA = "Interface\\AddOns\\WindBaem\\Media\\"

WindBaem = WindBaem or {}
local W = WindBaem

W.WEAPON = { 8233, 8236, 10484, 16361 }
W.TOTEM = { 8516, 10608, 10610 }
W.SOUNDS = { pling = "weicher Pling", tick = "sanftes Tick (am unauffälligsten)", wusch = "kurzer Windhauch" }
W.KANAL = { sfx = "SFX", master = "Master", dialog = "Dialog" }

-- Kanal SFX = folgt dem Regler "Effekte" in den Spiel-Toneinstellungen
local DEF = { on = true, ton = "pling", waffe = true, totem = true, pause = 0, kanal = "SFX" }
local DB
local live = { ids = {}, pending = false, why = nil }

local function msg(t) print("|cff39ff6bWind|r|cff2de2e6Bääm|r: " .. tostring(t)) end

local function plain(v)
  if v == nil then return nil end
  if issecretvalue then
    local ok, s = pcall(issecretvalue, v)
    if not ok or s then return nil end
  end
  return v
end

local function inCombat() return InCombatLockdown and InCombatLockdown() end

local function encounterLock()
  if not (C_RestrictedActions and C_RestrictedActions.IsAddOnRestrictionActive and Enum and Enum.AddOnRestrictionType) then
    return false
  end
  local ok, r = pcall(C_RestrictedActions.IsAddOnRestrictionActive, Enum.AddOnRestrictionType.Encounter)
  return ok and plain(r) == true
end

function W.File() return MEDIA .. ((DB and W.SOUNDS[DB.ton]) and DB.ton or "pling") .. ".ogg" end

function W.IDs()
  local t = {}
  if DB.waffe then for _, id in ipairs(W.WEAPON) do t[#t + 1] = id end end
  if DB.totem then for _, id in ipairs(W.TOTEM) do t[#t + 1] = id end end
  return t
end

-- alle eingetragenen Toene beim Spiel wieder abmelden
function W.Off()
  if C_UnitAuras and C_UnitAuras.RemoveAuraSound then
    for _, sid in pairs(live.ids) do pcall(C_UnitAuras.RemoveAuraSound, sid) end
  end
  live.ids = {}
end

-- Toene beim Spiel anmelden (nur ausserhalb von Kampf/Bosskampf; sonst danach)
function W.Apply()
  if inCombat() or encounterLock() then          -- nichts anfassen, nach dem Kampf neu eintragen
    live.pending = true; live.why = "im Kampf – wird danach eingetragen"; return
  end
  W.Off()
  live.why, live.pending = nil, false
  if not DB.on then live.why = "aus (/wb an)" return end
  if not (C_UnitAuras and C_UnitAuras.AddAuraSound) then live.why = "Client kann keine Aura-Töne" return end
  local trig = (Enum and Enum.UnitAuraSoundTrigger and Enum.UnitAuraSoundTrigger.Added) or 0
  local bad, err = 0, nil
  for _, id in ipairs(W.IDs()) do
    local ok, sid = pcall(C_UnitAuras.AddAuraSound, trig, {
      unitToken = "player", spellID = id, soundFileName = W.File(),
      outputChannel = DB.kanal, throttleSeconds = DB.pause,
    })
    if ok and sid then live.ids[id] = sid else bad = bad + 1; err = ok and "vom Spiel abgelehnt" or tostring(sid) end
  end
  if bad > 0 then live.why = bad .. " nicht eingetragen: " .. tostring(err) end
end

function W.Count() local n = 0 for _ in pairs(live.ids) do n = n + 1 end return n end
function W.Live() return live end

function W.Test() pcall(PlaySoundFile, W.File(), DB.kanal) end

-- ---------- Ereignisse ----------
local E = CreateFrame("Frame")
E:RegisterEvent("ADDON_LOADED")
E:RegisterEvent("PLAYER_LOGIN")
E:RegisterEvent("PLAYER_REGEN_ENABLED")
pcall(E.RegisterEvent, E, "ENCOUNTER_END")

E:SetScript("OnEvent", function(_, ev, a1)
  if ev == "ADDON_LOADED" then
    if a1 ~= "WindBaem" then return end
    WindBaemDB = WindBaemDB or {}
    DB = WindBaemDB
    for k, v in pairs(DEF) do if DB[k] == nil then DB[k] = v end end
    if not W.SOUNDS[DB.ton] then DB.ton = "pling" end     -- 1.0/1.1: braam/baem/hoch gibt es nicht mehr
    if (DB.ver or 0) < 110 then DB.kanal = "SFX"; DB.ver = 110 end   -- 1.0 lief auf Master (zu laut)
  elseif ev == "PLAYER_LOGIN" then
    W.Apply()
    local st = (W.Count() > 0) and ("|cff39ff6bbereit|r (" .. W.Count() .. " Windzorn-Auren)") or ("|cffff5555" .. tostring(live.why) .. "|r")
    msg(VERSION .. " " .. st .. ". |cffaaaaaa/wb test · /wb hilfe|r")
  elseif ev == "PLAYER_REGEN_ENABLED" or ev == "ENCOUNTER_END" then
    if live.pending then W.Apply() end
  end
end)

-- ---------- Befehle ----------
local HELP = {
  "|cffffffff/wb test|r – Ton jetzt abspielen",
  "|cffffffff/wb an|r / |cffffffffaus|r – Ton ein/aus",
  "|cffffffff/wb ton pling|r, |cfffffffftick|r oder |cffffffffwusch|r – Klang wählen",
  "|cffffffff/wb kanal sfx|r / |cffffffffmaster|r / |cffffffffdialog|r – welcher Lautstärke-Regler gilt (Standard: Effekte)",
  "|cffffffff/wb waffe|r / |cfffffffftotem|r – Waffen- bzw. Totem-Windzorn an/aus",
  "|cffffffff/wb pause 0-5|r – Mindestabstand in Sekunden (0 = jeder Proc)",
  "|cffffffff/wb diag|r – Status",
}

SLASH_WINDBAEM1 = "/wb"
SLASH_WINDBAEM2 = "/windbaem"
SlashCmdList.WINDBAEM = function(arg)
  if not DB then return end
  arg = (arg or ""):lower():gsub("^%s+", ""):gsub("%s+$", "")
  local cmd, val = arg:match("^(%S*)%s*(.-)$")
  local function set(f)
    f()
    W.Apply()
  end
  if cmd == "test" then
    W.Test()
  elseif cmd == "an" or cmd == "aus" then
    set(function() DB.on = (cmd == "an") end)
    msg(DB.on and "an" or "aus")
  elseif cmd == "ton" then
    if W.SOUNDS[val] then
      set(function() DB.ton = val end); W.Test(); msg("Klang: " .. W.SOUNDS[val])
    else
      msg("/wb ton pling | tick | wusch")
    end
  elseif cmd == "kanal" then
    if W.KANAL[val] then
      set(function() DB.kanal = W.KANAL[val] end); W.Test(); msg("Lautstärke-Regler: " .. DB.kanal)
    else
      msg("/wb kanal sfx | master | dialog")
    end
  elseif cmd == "waffe" or cmd == "totem" then
    set(function() DB[cmd] = not DB[cmd] end)
    msg((cmd == "waffe" and "Waffe des Windzorns" or "Totem des Windzorns") .. ": " .. (DB[cmd] and "an" or "aus"))
  elseif cmd == "pause" then
    local n = tonumber(val)
    if n and n >= 0 and n <= 5 then set(function() DB.pause = n end); msg("Mindestabstand " .. n .. " s")
    else msg("/wb pause 0-5") end
  elseif cmd == "diag" then
    msg(VERSION .. " · " .. (DB.on and "an" or "aus") .. " · Klang " .. DB.ton .. " · Pause " .. DB.pause .. " s · Regler " .. DB.kanal)
    msg("eingetragen: " .. W.Count() .. " von " .. #W.IDs() .. (live.why and (" · " .. live.why) or ""))
  else
    msg(VERSION .. " – Ton bei Windzorn-Proc, auch im Kampf:")
    for _, l in ipairs(HELP) do print("   " .. l) end
  end
end

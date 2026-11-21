-- KampfWerk 1.0.0 (Tiry): Schadensmeter im "2045"-Neon-Glas (wie ChatWerk). Ein grosses Fenster, in der Mitte
-- geteilt; jeder Teil zeigt, was du willst (Schaden, Heilung, Kicks, Aggro ...), laesst sich loesen, frei schieben
-- und an den Ecken ziehen. Dazu das Zahlen-Studio: Schriften/Farben der Schadens- und Heilzahlen.
--
-- Forever-Grenzen (Blizzard-Code Forever, API-Doku DamageMeter/CombatLog/Unit/Localization):
--  * Daten kommen aus C_DamageMeter (Blizzards eigener Meter). Im Kampf sind sie "geheim" (SecretWhenInCombat):
--    Add-ons duerfen sie dann NICHT rechnen, vergleichen oder sortieren - nur an Blizzard-Funktionen durchreichen,
--    die das ausdruecklich erlauben: FontString:SetText, StatusBar:SetValue/SetMinMaxValues, AbbreviateLargeNumbers.
--    Die Reihenfolge liefert Blizzard schon sortiert. Prozente rechnet KampfWerk nur ausserhalb des Kampfes.
--  * Der Kampflog (COMBAT_LOG_EVENT_UNFILTERED) ist fuer Add-ons gesperrt (HasRestrictions) -> kein eigenes Mitzaehlen.
--  * Aggro: UnitDetailedThreatSituation, Werte evtl. geheim -> nur Balken/Text durchreichen, Reihenfolge eingefroren.
local ADDON, ns = ...
KampfWerk = ns
ns.NAME = ADDON or "KampfWerk"
ns.VERSION = "1.3.3"
ns.MEDIA = "Interface\\AddOns\\KampfWerk\\Media\\"
local MEDIA = ns.MEDIA

----------------------------------------------------------------------------
-- Helfer
----------------------------------------------------------------------------
local function secret(v) return issecretvalue ~= nil and issecretvalue(v) == true end
ns.IsSecret = secret

function ns.Clamp(v, lo, hi) if v < lo then return lo elseif v > hi then return hi end return v end

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cff39ff6bKampf|r|cff2de2e6Werk|r: " .. tostring(msg))
end

ns.errors = {}
function ns.Safe(fn, ...)
  local n, args = select("#", ...), { ... }
  local ok, a, b, c, d = xpcall(function() return fn(unpack(args, 1, n)) end, function(e)
    local msg = tostring(e) .. (debugstack and ("\n" .. debugstack(2, 6, 0)) or "")
    if #ns.errors < 30 then ns.errors[#ns.errors + 1] = msg end
    return msg
  end)
  if ok then return a, b, c, d end
end

-- Fuer Widgets.lua (ItemIcon) - im Meter nicht benutzt
function ns.Item(id)
  local icon = C_Item and C_Item.GetItemIconByID and C_Item.GetItemIconByID(id)
  return { icon = icon or 134400, quality = 1 }
end

local function copy(t)
  if type(t) ~= "table" then return t end
  local o = {}
  for k, v in pairs(t) do o[k] = copy(v) end
  return o
end
ns.Copy = copy

-- fehlende Standardwerte einmischen (nie ueberschreiben, was Tiry eingestellt hat)
local function merge(dst, src)
  for k, v in pairs(src) do
    if dst[k] == nil then dst[k] = copy(v)
    elseif type(v) == "table" and type(dst[k]) == "table" and not v[1] then merge(dst[k], v) end
  end
end

----------------------------------------------------------------------------
-- Farbthemen + Hintergruende
----------------------------------------------------------------------------
ns.THEMES = {
  { key = "neon", label = "Neon", c = { { 0.224, 1.00, 0.42 }, { 0.15, 0.95, 0.85 }, { 0.16, 0.70, 1.00 } } },
  { key = "cyber", label = "Cyber-Pink", c = { { 1.00, 0.24, 0.76 }, { 0.62, 0.32, 1.00 }, { 0.20, 0.86, 1.00 } } },
  { key = "glut", label = "Glut", c = { { 1.00, 0.86, 0.26 }, { 1.00, 0.46, 0.10 }, { 0.96, 0.18, 0.22 } } },
  { key = "frost", label = "Frost", c = { { 0.86, 0.97, 1.00 }, { 0.40, 0.80, 1.00 }, { 0.48, 0.48, 1.00 } } },
  { key = "teufel", label = "Teufel", c = { { 0.82, 1.00, 0.22 }, { 0.32, 1.00, 0.22 }, { 0.10, 0.72, 0.36 } } },
  { key = "arkan", label = "Arkan", c = { { 0.96, 0.46, 1.00 }, { 0.62, 0.36, 1.00 }, { 0.32, 0.52, 1.00 } } },
  { key = "gold", label = "Gold", c = { { 1.00, 0.95, 0.70 }, { 1.00, 0.80, 0.30 }, { 0.88, 0.56, 0.16 } } },
  { key = "blut", label = "Blut", c = { { 1.00, 0.38, 0.38 }, { 0.84, 0.10, 0.22 }, { 0.56, 0.08, 0.38 } } },
  { key = "chrom", label = "Chrom", c = { { 1.00, 1.00, 1.00 }, { 0.72, 0.78, 0.82 }, { 0.48, 0.54, 0.60 } } },
}
ns.THEME = {}
for _, t in ipairs(ns.THEMES) do ns.THEME[t.key] = t end

-- Hintergruende: eigene (prozedural erzeugt, tools/kampfwerk_media.py) + drei klassische Blizzard-Texturen aus dem Spiel
ns.BACKGROUNDS = {
  { key = "glas", label = "2045-Glas" },
  { key = "arkan", label = "Arkan", file = MEDIA .. "bg_arkan" },
  { key = "nacht", label = "Nordlicht", file = MEDIA .. "bg_nacht" },
  { key = "teufel", label = "Teufelsfeuer", file = MEDIA .. "bg_teufel" },
  { key = "frost", label = "Frost", file = MEDIA .. "bg_frost" },
  { key = "glut", label = "Glut", file = MEDIA .. "bg_glut" },
  { key = "horde", label = "Horde", file = MEDIA .. "bg_horde" },
  { key = "allianz", label = "Allianz", file = MEDIA .. "bg_allianz" },
  { key = "leder", label = "Leder", file = MEDIA .. "bg_leder" },
  { key = "stein", label = "Stein", file = MEDIA .. "bg_stein" },
  { key = "karbon", label = "Karbon", file = MEDIA .. "bg_karbon" },
  -- cover = Bild mit Motiv: Seitenverhaeltnis bleibt, Motiv rechts sichtbar (ausgeschnitten statt verzerrt)
  { key = "psi", label = "Psi-Sturm", file = MEDIA .. "bg_psi", cover = 2 },
  { key = "eigen", label = "Eigenes Bild", file = MEDIA .. "eigenes_bild", cover = 2 },
  { key = "b_dialog", label = "WoW: Dialog", file = "Interface\\DialogFrame\\UI-DialogBox-Background-Dark", tile = 64 },
  { key = "b_marmor", label = "WoW: Marmor", file = "Interface\\FrameGeneral\\UI-Background-Marble", tile = 256 },
  { key = "b_fels", label = "WoW: Fels", file = "Interface\\FrameGeneral\\UI-Background-Rock", tile = 256 },
}
ns.BG = {}
for _, b in ipairs(ns.BACKGROUNDS) do ns.BG[b.key] = b end

function ns.Theme()
  local t = ns.THEME[ns.DB and ns.DB.look.theme or "neon"] or ns.THEMES[1]
  return t.c
end

----------------------------------------------------------------------------
-- Gespeicherte Einstellungen
----------------------------------------------------------------------------
local DEFAULTS = {
  v = 100,
  frame = { x = 420, y = 40, w = 600, h = 210, locked = false },
  look = { bg = "glas", theme = "neon", alpha = 0.78, bgAlpha = 0.55, barH = 20, gap = 3, font = 13,
           barColor = "klasse", barStyle = "glanz", numbers = "kurz",
           textColor = { 1, 1, 1 }, textStyle = "kontur", textBold = false },
  showSelf = true,
  hideBlizzard = false,
  animations = true,
  alwaysHeader = false,
  barFade = 5,
  numbers = {
    blizzFont = "aus",          -- Schrift der Blizzard-Kampfzahlen ueber Gegnern ("aus" = Spiel-Standard)
    worldScale = 1.0,
    own = false,                -- eigene Neon-Zahlen (Schaden/Heilung getrennt einstellbar)
    hideBlizzDamage = false,
    hideBlizzHeal = false,
    friendPlates = true,        -- Namensplaketten freundlicher Spieler (nur Name) -> Heilzahlen ueber Freunden
    anim = "steigen",
    damage = { on = true, font = "bangers", size = 26, color = { 1.00, 0.82, 0.22 }, crit = { 1.00, 0.36, 0.20 },
               style = "dick", critScale = 1.5 },
    heal = { on = true, font = "lilita", size = 22, color = { 0.30, 1.00, 0.50 }, crit = { 0.60, 1.00, 0.80 },
             style = "kontur", critScale = 1.35 },
  },
}

function ns.NewPane(view)
  local db = ns.DB
  db.nextPane = (db.nextPane or 0) + 1
  local p = { id = db.nextPane, view = view or "damage", session = "current", docked = true, share = 1 }
  db.panes[#db.panes + 1] = p
  return p
end

function ns.PaneById(id)
  for i, p in ipairs(ns.DB.panes) do if p.id == id then return p, i end end
end

local function initDB()
  KampfWerkDB = KampfWerkDB or {}
  local db = KampfWerkDB
  local fresh = db.v == nil
  merge(db, DEFAULTS)
  ns.DB = db
  if fresh or type(db.panes) ~= "table" or #db.panes == 0 then
    -- Start wie auf Tirys Bild: links gewirkte Heilung, rechts verursachter Schaden
    db.panes = {}
    db.nextPane = 0
    ns.NewPane("heal")
    ns.NewPane("damage")
  end
  for _, p in ipairs(db.panes) do
    p.session = p.session or "current"
    p.share = p.share or 1
    if p.docked == nil then p.docked = true end
  end
  if not ns.THEME[db.look.theme] then db.look.theme = "neon" end
  if not ns.BG[db.look.bg] then db.look.bg = "glas" end
  -- 1.3.1: hat Tiry im Zahlen-Studio schon eine Schrift gewaehlt, aber die eigenen Zahlen waren noch aus
  -- (Standard), sah er nur Blizzards Zahlen -> einmalig einschalten
  if (db.v or 0) < 131 and not fresh then
    local n, d = db.numbers, DEFAULTS.numbers
    if not n.own and (n.damage.font ~= d.damage.font or n.heal.font ~= d.heal.font) then
      n.own, n.hideBlizzDamage, n.hideBlizzHeal, n.blizzDamageSet, n.blizzHealSet = true, true, true, true, true
    end
  end
  db.v = 131
end
ns.InitDB = initDB

----------------------------------------------------------------------------
-- Ereignisse
----------------------------------------------------------------------------
local E = CreateFrame("Frame")
ns.EventFrame = E
local handlers = {}
function ns.On(event, fn)
  handlers[event] = handlers[event] or {}
  table.insert(handlers[event], fn)
  E:RegisterEvent(event)
end
E:SetScript("OnEvent", function(_, event, ...)
  for _, fn in ipairs(handlers[event] or {}) do ns.Safe(fn, event, ...) end
end)

-- Arbeit, die im Kampf gesperrt ist (Frames bauen), nach dem Kampf nachholen
local afterCombat = {}
function ns.OutOfCombat(fn)
  if InCombatLockdown and InCombatLockdown() then afterCombat[#afterCombat + 1] = fn else ns.Safe(fn) end
end
ns.On("PLAYER_REGEN_ENABLED", function()
  local list = afterCombat
  afterCombat = {}
  for _, fn in ipairs(list) do ns.Safe(fn) end
end)

ns.On("ADDON_LOADED", function(_, name)
  if name ~= ns.NAME then return end
  initDB()
  -- Schrift der Blizzard-Kampfzahlen muss frueh stehen: das Spiel liest DAMAGE_TEXT_FONT beim Betreten der Welt
  if ns.Numbers and ns.Numbers.EarlyFont then ns.Numbers.EarlyFont() end
end)

ns.On("PLAYER_LOGIN", function()
  if not ns.DB then initDB() end
  ns.ready = true
  if ns.Meter then ns.Meter.Build() end
  if ns.Numbers then ns.Numbers.Init() end
  if ns.Blizzard then ns.Blizzard.Apply() end
end)

----------------------------------------------------------------------------
-- Slash-Befehle
----------------------------------------------------------------------------
SLASH_KAMPFWERK1 = "/kw"
SLASH_KAMPFWERK2 = "/kampfwerk"
SlashCmdList.KAMPFWERK = function(msg)
  msg = strtrim((msg or ""):lower())
  if msg == "" or msg == "optionen" or msg == "einstellungen" then
    if ns.Config then ns.Config.Open() end
  elseif msg == "hilfe" or msg == "help" then
    ns.Print("v" .. ns.VERSION .. " - |cff39ff6b/kw|r Einstellungen · |cff39ff6b/kw zahlen|r Zahlen-Studio · "
      .. "|cff39ff6b/kw reset|r Kampfdaten leeren · |cff39ff6b/kw an|r / |cff39ff6baus|r Fenster zeigen/verstecken · "
      .. "|cff39ff6b/kw sperren|r Fenster sperren/frei · |cff39ff6b/kw neu|r weiterer Teil · "
      .. "|cff39ff6b/kw eins|r / |cff39ff6bzwei|r / |cff39ff6bdrei|r ein Fenster oder geteilt · "
      .. "|cff39ff6b/kw diag|r Zahlen-Diagnose")
  elseif msg == "zahlen" then
    if ns.Config then ns.Config.Open("zahlen") end
  elseif msg == "reset" then
    if ns.Data then ns.Data.Reset() end
  elseif msg == "an" then
    ns.DB.hidden = false
    if ns.Meter then ns.Meter.Apply() end
  elseif msg == "aus" then
    ns.DB.hidden = true
    if ns.Meter then ns.Meter.Apply() end
  elseif msg == "sperren" then
    ns.DB.frame.locked = not ns.DB.frame.locked
    ns.Print(ns.DB.frame.locked and "Fenster gesperrt." or "Fenster frei.")
    if ns.Meter then ns.Meter.Apply() end
  elseif msg == "eins" or msg == "zwei" or msg == "drei" or msg == "1" or msg == "2" or msg == "3" then
    local n = ({ eins = 1, zwei = 2, drei = 3 })[msg] or tonumber(msg)
    if ns.Meter then ns.Meter.SetCount(n) end
    ns.Print(n == 1 and "Ein Fenster." or (n .. " Teile."))
  elseif msg == "neu" then
    ns.NewPane("kicks")
    if ns.Meter then ns.Meter.Rebuild() end
  elseif msg == "diag" then
    if ns.Numbers then ns.Numbers.Diag() end
  elseif msg == "fehler" then
    if #ns.errors == 0 then ns.Print("Keine Fehler.") end
    for _, e in ipairs(ns.errors) do ns.Print(e) end
  else
    ns.Print("Unbekannt. |cff39ff6b/kw hilfe|r zeigt alle Befehle.")
  end
end

-- Tiry's Zentrale – Kern: Namensraum, Ereignisse, Speicher, Hilfsfunktionen
-- Zielclient: World of Warcraft: Forever 1.60.1 (Interface 16001, moderne API)
local ADDON, ns = ...

ns.name = ADDON
ns.version = (C_AddOns and C_AddOns.GetAddOnMetadata and C_AddOns.GetAddOnMetadata(ADDON, "Version")) or "1.0.0"
ns.MEDIA = "Interface\\AddOns\\" .. ADDON .. "\\Media\\"

TirysZentrale = ns -- einziger Namens-Export (für Slash-Befehl, Addon-Menü und Fehlersuche)

----------------------------------------------------------------------------
-- Sicheres Aufrufen: ein Fehler in einem Modul legt nie das ganze Addon lahm
----------------------------------------------------------------------------
-- Eigene Fehleranzeige: Manche Clients zeigen Lua-Fehler gar nicht an. Fehler aus Tiry's Zentrale
-- erscheinen deshalb im Chat und werden gespeichert (/tz fehler zeigt sie). Andere Addons bleiben unberührt.
local errlog, shown = {}, {}
function ns.LogError(err)
  local msg = tostring(err or "?"):gsub("^.-AddOns[\\/]", "")
  local log = (TirysZentraleDB and type(TirysZentraleDB) == "table") and TirysZentraleDB or nil
  local list = log and (type(log.errorLog) == "table" and log.errorLog or {}) or errlog
  if log then log.errorLog = list end
  for _, e in ipairs(list) do
    if e.msg == msg then e.count, e.time = (e.count or 1) + 1, time() return end
  end
  table.insert(list, 1, { msg = msg, time = time(), count = 1, version = ns.version })
  while #list > 20 do table.remove(list) end
  if not shown[msg] and DEFAULT_CHAT_FRAME then
    shown[msg] = true
    DEFAULT_CHAT_FRAME:AddMessage("|cffff6b81Tiry's Zentrale – Fehler:|r " .. msg:sub(1, 160) .. "  |cff93a39d(/tz fehler zeigt alle)|r")
  end
end

function ns.ErrorLog()
  return (TirysZentraleDB and TirysZentraleDB.errorLog) or errlog
end

-- In die globale Fehlerbehandlung einklinken (Kette: der bisherige Handler läuft immer weiter)
if seterrorhandler and geterrorhandler then
  local previous = geterrorhandler()
  seterrorhandler(function(msg, ...)
    if not ns.skipLog and type(msg) == "string" and msg:find("TirysZentrale", 1, true) then pcall(ns.LogError, msg) end
    if previous then return previous(msg, ...) end
  end)
end

-- Der Fehler-Handler läuft innerhalb von xpcall, damit BugSack & Co. den vollen Stack sehen.
-- Forever reicht Fehler nicht zuverlässig an eigene Handler durch -> hier SELBST protokollieren.
local function handler(err)
  pcall(ns.LogError, err)
  local h = geterrorhandler and geterrorhandler()
  if h then
    ns.skipLog = true -- nicht doppelt zählen, falls unser Ketten-Handler mitläuft
    pcall(h, err)
    ns.skipLog = nil
  end
  return err
end

function ns.Safe(fn, ...)
  local n, args = select("#", ...), { ... }
  local ok, a, b, c, d, e = xpcall(function() return fn(unpack(args, 1, n)) end, handler)
  if not ok then return nil end
  return a, b, c, d, e
end

----------------------------------------------------------------------------
-- Ereignis-Verteiler
----------------------------------------------------------------------------
local eventFrame = CreateFrame("Frame")
local listeners = {}

function ns.On(event, fn)
  if not listeners[event] then
    listeners[event] = {}
    -- Unbekannte Ereignisse würden einen Fehler werfen -> abgesichert registrieren
    local ok, registered = pcall(eventFrame.RegisterEvent, eventFrame, event)
    if not ok or registered == false then
      listeners[event] = nil
      return false
    end
  end
  table.insert(listeners[event], fn)
  return true
end

eventFrame:SetScript("OnEvent", function(_, event, ...)
  local list = listeners[event]
  if not list then return end
  for i = 1, #list do
    ns.Safe(list[i], event, ...)
  end
end)

-- Interne Nachrichten zwischen Modulen (z. B. "PRICES_UPDATED")
local messages = {}
function ns.Listen(msg, fn)
  messages[msg] = messages[msg] or {}
  table.insert(messages[msg], fn)
end

function ns.Fire(msg, ...)
  local list = messages[msg]
  if not list then return end
  for i = 1, #list do
    ns.Safe(list[i], msg, ...)
  end
end

-- Mehrfach-Auslöser bündeln (z. B. viele Item-Daten auf einmal)
local pending = {}
function ns.Debounce(key, delay, fn)
  if pending[key] then return end
  pending[key] = true
  C_Timer.After(delay, function()
    pending[key] = nil
    ns.Safe(fn)
  end)
end

----------------------------------------------------------------------------
-- Gespeicherte Daten
----------------------------------------------------------------------------
local DEFAULTS = {
  minimap = { show = true, angle = 205 },
  scale = 1.0,
  animations = true,
  merchantAlert = true,
  autoJunk = true,     -- grauen Schrott beim Händler automatisch verkaufen
  lootAlerts = true,   -- Beute-Radar: Warnung bei wertvoller Beute
  lootAlertMin = 5000, -- ab 50 Silber AH-Wert melden
  ahHint = true,       -- beim Öffnen des AH sagen, was eingestellt werden sollte
  merchantPanel = true, -- Händler-Panel neben dem Händlerfenster
  autoRepair = true,    -- beim Händler automatisch reparieren
  tooltipInfo = true,   -- Zusatzinfos im Item-Tooltip
  -- Craft-Filter: Empfehlung wächst mit jedem Level; die Faktoren sind dein persönlicher Stil (1 = Empfehlung)
  craft = { marginFactor = 1, profitFactor = 1, onlySafe = true, onlySkill = false, perRecipe = 2, freshOnly = true, skipSlow = true },
  shopAutoOpen = true,  -- Einkaufsfenster beim Öffnen des AH zeigen, wenn noch etwas fehlt
  ahCut = 5,          -- Prozent, den das Auktionshaus beim Verkauf einbehält
  showOnlyMyLevel = false,
  expertMode = false,  -- Preisformeln im Craft-Planer zeigen (für Profis)
  faction = "AUTO",   -- AUTO / Alliance / Horde
  welcomeShown = false,
  lastPage = "home",
}

local function applyDefaults(target, defaults)
  for k, v in pairs(defaults) do
    if type(v) == "table" then
      if type(target[k]) ~= "table" then target[k] = {} end
      applyDefaults(target[k], v)
    elseif target[k] == nil then
      target[k] = v
    end
  end
end

-- Alle Einstellungen auf Standard (Fensterposition, Seite und Begrüßung bleiben erhalten)
local KEEP = { point = true, shopPoint = true, welcomeShown = true, lastPage = true }
function ns.ResetSettings()
  for k in pairs(ns.settings) do
    if not KEEP[k] then ns.settings[k] = nil end
  end
  applyDefaults(ns.settings, DEFAULTS)
  ns.Fire("SETTINGS_RESET")
end

ns.On("ADDON_LOADED", function(_, name)
  if name ~= ADDON then return end
  TirysZentraleDB = type(TirysZentraleDB) == "table" and TirysZentraleDB or {}
  TirysZentraleCharDB = type(TirysZentraleCharDB) == "table" and TirysZentraleCharDB or {}
  applyDefaults(TirysZentraleDB, { settings = DEFAULTS, vendorBuy = {} })
  applyDefaults(TirysZentraleCharDB, { days = {}, sessions = {} })
  ns.db = TirysZentraleDB
  ns.settings = TirysZentraleDB.settings
  ns.char = TirysZentraleCharDB
  ns.Fire("DB_READY")
end)

ns.On("PLAYER_LOGIN", function()
  ns.loggedIn = true
  ns.UpdatePlayer()
  ns.Fire("LOGIN")
end)

----------------------------------------------------------------------------
-- Spielerdaten
----------------------------------------------------------------------------
ns.player = { name = "", level = 1, faction = "Alliance", class = "" }

function ns.UpdatePlayer()
  local p = ns.player
  p.name = UnitName("player") or ""
  p.level = UnitLevel("player") or 1
  p.faction = UnitFactionGroup("player") or "Alliance"
  local _, classFile = UnitClass("player")
  p.class = classFile or ""
end

function ns.Faction()
  local s = ns.settings
  if s and (s.faction == "Alliance" or s.faction == "Horde") then
    return s.faction
  end
  return ns.player.faction
end

ns.On("PLAYER_LEVEL_UP", function(_, level)
  ns.player.level = tonumber(level) or UnitLevel("player")
  ns.Fire("PLAYER_CHANGED")
end)

----------------------------------------------------------------------------
-- Berufe (Forever: C_SkillInfo; Fallback: alte globale API)
----------------------------------------------------------------------------
ns.PROF = {
  HERBALISM = 182, MINING = 186, SKINNING = 393,
  TAILORING = 197, ALCHEMY = 171, BLACKSMITHING = 164, LEATHERWORKING = 165,
  ENGINEERING = 202, ENCHANTING = 333,
  COOKING = 185, FIRST_AID = 129, FISHING = 356,
}
local KNOWN_PROF = {}
for _, id in pairs(ns.PROF) do KNOWN_PROF[id] = true end

ns.professions = {} -- [skillID] = { name, rank, maxRank }

local function readSkillLines()
  local result = {}
  -- Bevorzugt: direkt nach Skill-ID fragen (ändert nichts am Skill-Fenster des Spielers)
  if C_SkillInfo and C_SkillInfo.GetSkillLineInfoByID then
    for id in pairs(KNOWN_PROF) do
      local ok, info = pcall(C_SkillInfo.GetSkillLineInfoByID, id)
      if ok and info and info.name and info.name ~= "" and (info.maxRank or 0) > 0 then
        result[id] = { name = info.name, rank = info.rank or 0, maxRank = info.maxRank or 0 }
      end
    end
    if next(result) then return result end
  end
  if C_SkillInfo and C_SkillInfo.GetNumSkillLines and C_SkillInfo.GetSkillLineInfo then
    -- Zusammengeklappte Überschriften verstecken ihre Zeilen -> von hinten nach vorn aufklappen
    if C_SkillInfo.ExpandSkillHeader then
      for i = C_SkillInfo.GetNumSkillLines(), 1, -1 do
        local info = C_SkillInfo.GetSkillLineInfo(i)
        if info and info.isHeader and info.isCollapsed then
          C_SkillInfo.ExpandSkillHeader(i)
        end
      end
    end
    for i = 1, C_SkillInfo.GetNumSkillLines() do
      local info = C_SkillInfo.GetSkillLineInfo(i)
      if info and not info.isHeader and info.skillID and KNOWN_PROF[info.skillID] then
        result[info.skillID] = { name = info.name, rank = info.rank or 0, maxRank = info.maxRank or 0 }
      end
    end
  elseif GetProfessions and GetProfessionInfo then
    for _, index in pairs({ GetProfessions() }) do
      if index then
        local name, _, rank, maxRank, _, _, skillLine = GetProfessionInfo(index)
        if skillLine and KNOWN_PROF[skillLine] then
          result[skillLine] = { name = name, rank = rank or 0, maxRank = maxRank or 0 }
        end
      end
    end
  end
  return result
end

function ns.UpdateProfessions()
  local found = readSkillLines()
  ns.professions = found or {}
  ns.Fire("PROFESSIONS_CHANGED")
end

function ns.HasProf(id)
  return ns.professions[id] ~= nil
end

function ns.ProfRank(id)
  local p = ns.professions[id]
  return p and p.rank or 0
end

ns.On("SKILL_LINES_CHANGED", function()
  ns.Debounce("skills", 0.5, ns.UpdateProfessions)
end)
ns.Listen("LOGIN", function()
  C_Timer.After(2, function() ns.Safe(ns.UpdateProfessions) end)
end)

----------------------------------------------------------------------------
-- Item-Daten (lokalisierte Namen, Symbole, Händler-Verkaufspreise)
----------------------------------------------------------------------------
local itemCache = {}

local GetItemInfo = (C_Item and C_Item.GetItemInfo) or GetItemInfo
local GetItemIconByID = (C_Item and C_Item.GetItemIconByID) or GetItemIcon
local RequestLoad = C_Item and C_Item.RequestLoadItemDataByID

function ns.Item(id)
  local c = itemCache[id]
  if c and c.loaded then return c end
  c = c or { id = id }
  local name, link, quality, _, _, _, _, stack, _, icon, sellPrice = GetItemInfo(id)
  if name then
    c.name, c.link, c.quality, c.stack, c.icon, c.sell, c.loaded = name, link, quality, stack, icon, sellPrice or 0, true
  else
    local static = ns.ITEMS and ns.ITEMS[id]
    local db = (not static) and ns.DB and ns.DB.Get(id)
    if db then static = { de = db.name, q = db.q, sell = db.sell, stack = db.stack } end
    c.name = c.name or (static and static.de) or ("Item " .. id)
    c.icon = c.icon or (db and db.icon ~= 0 and db.icon) or (GetItemIconByID and GetItemIconByID(id)) or 134400 -- Fragezeichen-Symbol
    c.quality = c.quality or (static and static.q) or 1
    c.sell = c.sell or (static and static.sell) or 0
    c.stack = c.stack or (static and static.stack) or 20
    if RequestLoad and not c.requested then
      c.requested = true
      RequestLoad(id)
    end
  end
  itemCache[id] = c
  return c
end

local function onItemData(_, itemID, success)
  if itemID and itemCache[itemID] and success ~= false then
    itemCache[itemID].loaded = nil
    ns.Debounce("items", 0.4, function() ns.Fire("ITEMS_UPDATED") end)
  end
end
ns.On("GET_ITEM_INFO_RECEIVED", onItemData)
ns.On("ITEM_DATA_LOAD_RESULT", onItemData)

----------------------------------------------------------------------------
-- Formatierung
----------------------------------------------------------------------------
local GOLD_C, SILVER_C, COPPER_C = "|cffffd24a", "|cffd5d9e6", "|cffe8a066"

-- Kompakt mit echten Münz-Symbolen aus dem Spiel (keine "k"-Abkürzung, die man als "Tausend" liest)
local ICON_G, ICON_S, ICON_C = "|A:coin-gold:11:11:1:0|a", "|A:coin-silver:11:11:1:0|a", "|A:coin-copper:11:11:1:0|a"
function ns.Money(copper, opts)
  if copper == nil then return "|cff8a9a94–|r" end
  local neg = copper < 0
  copper = math.floor(math.abs(copper) + 0.5)
  local g = math.floor(copper / 10000)
  local s = math.floor((copper % 10000) / 100)
  local c = copper % 100
  local parts = {}
  if g > 0 then
    local gs = tostring(g)
    if g >= 1000 then
      gs = gs:reverse():gsub("(%d%d%d)", "%1."):reverse():gsub("^%.", "")
    end
    parts[#parts + 1] = GOLD_C .. gs .. "|r" .. ICON_G
  end
  if s > 0 and (g < 100 or (opts and opts.full)) then parts[#parts + 1] = SILVER_C .. s .. "|r" .. ICON_S end
  if c > 0 and g == 0 and (s < 10 or (opts and opts.full)) then parts[#parts + 1] = COPPER_C .. c .. "|r" .. ICON_C end
  if #parts == 0 then parts[1] = COPPER_C .. "0|r" .. ICON_C end
  local out = table.concat(parts, " ")
  if neg then out = "|cffff6b81-|r" .. out end
  return out
end

function ns.Plural(n, one, many)
  return n == 1 and one or many
end

function ns.Today()
  return date("%Y-%m-%d")
end

function ns.Clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

-- Kampf-Sperre: Käufe, Verkäufe und Craften nie im Kampf (Blizzard sperrt dort viele Aktionen)
function ns.InCombat()
  return InCombatLockdown and InCombatLockdown() or false
end

function ns.CombatBlocked()
  if ns.InCombat() then
    ns.Print("|cffff6b81Im Kampf gesperrt|r – bitte nach dem Kampf nochmal klicken.")
    return true
  end
  return false
end

-- Kurze Chat-Meldung im Addon-Stil
function ns.Print(msg)
  local frame = DEFAULT_CHAT_FRAME
  if frame then
    frame:AddMessage("|cff8cff4dTiry's|r |cff26ff73Zentrale|r: " .. msg)
  end
end

-- Item-Link in den Chat/ins Eingabefeld legen (Forever: ChatFrameUtil)
function ns.LinkItem(id)
  local item = ns.Item(id)
  if not item.link then return false end
  if HandleModifiedItemClick and HandleModifiedItemClick(item.link) then return true end
  if ChatFrameUtil and ChatFrameUtil.InsertLink then
    return ChatFrameUtil.InsertLink(item.link)
  elseif ChatEdit_InsertLink then
    return ChatEdit_InsertLink(item.link)
  end
  return false
end

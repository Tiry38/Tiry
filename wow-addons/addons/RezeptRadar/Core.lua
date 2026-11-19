-- RezeptRadar 1.0 – Kern: Namensraum, Ereignisse, Speicher, Berufe, Items, Geld, Befehle
-- Eine Aufgabe: nach einem AH-Scan zeigen, welche Koch- und Lederverarbeitungs-Rezepte sich zu kaufen lohnen.
-- Zielclient: World of Warcraft: Forever (Interface 16001, moderne API)
local ADDON, ns = ...

ns.name = ADDON
ns.version = (C_AddOns and C_AddOns.GetAddOnMetadata and C_AddOns.GetAddOnMetadata(ADDON, "Version")) or "7.0.0"
ns.MEDIA = "Interface\\AddOns\\" .. ADDON .. "\\Media\\"

RezeptRadar = ns -- einziger Namens-Export (Slash-Befehl, Addon-Menü, Tastenbelegung, Fehlersuche)

----------------------------------------------------------------------------
-- Sicheres Aufrufen: ein Fehler legt nie das ganze Add-on lahm (Meldung einmal im Chat, Liste per /rr fehler)
----------------------------------------------------------------------------
local errlog, shown = {}, {}
function ns.LogError(err)
  local msg = tostring(err or "?"):gsub("^.-AddOns[\\/]", "")
  local db = type(RezeptRadarDB) == "table" and RezeptRadarDB or nil
  local list = db and (type(db.errorLog) == "table" and db.errorLog or {}) or errlog
  if db then db.errorLog = list end
  for _, e in ipairs(list) do
    if e.msg == msg then e.count, e.time = (e.count or 1) + 1, time() return end
  end
  table.insert(list, 1, { msg = msg, time = time(), count = 1, version = ns.version })
  while #list > 20 do table.remove(list) end
  if not shown[msg] and DEFAULT_CHAT_FRAME then
    shown[msg] = true
    DEFAULT_CHAT_FRAME:AddMessage("|cffff6b81RezeptRadar – Fehler:|r " .. msg:sub(1, 160) .. "  |cff93a39d(/rr fehler zeigt alle)|r")
  end
end

function ns.ErrorLog()
  return (type(RezeptRadarDB) == "table" and RezeptRadarDB.errorLog) or errlog
end

local function handler(err)
  pcall(ns.LogError, err)
  local h = geterrorhandler and geterrorhandler()
  if h then pcall(h, err) end
  return err
end

function ns.Safe(fn, ...)
  local n, args = select("#", ...), { ... }
  local ok, a, b, c, d = xpcall(function() return fn(unpack(args, 1, n)) end, handler)
  if not ok then return nil end
  return a, b, c, d
end

----------------------------------------------------------------------------
-- Ereignisse (Spiel) und Nachrichten (intern)
----------------------------------------------------------------------------
local eventFrame = CreateFrame("Frame")
local listeners = {}

function ns.On(event, fn)
  if not listeners[event] then
    listeners[event] = {}
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
  for i = 1, #list do ns.Safe(list[i], event, ...) end
end)

local messages = {}
function ns.Listen(msg, fn)
  messages[msg] = messages[msg] or {}
  table.insert(messages[msg], fn)
end

function ns.Fire(msg, ...)
  local list = messages[msg]
  if not list then return end
  for i = 1, #list do ns.Safe(list[i], msg, ...) end
end

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
-- Speicher. 7.0 ist ein Neubau: alte Daten (6.x) werden verworfen, nur Fensterposition und Größe bleiben.
----------------------------------------------------------------------------
ns.DB_VERSION = 7
local DEFAULTS = {
  prof = "ALL",        -- ALL / COOKING / LEATHERWORKING
  range = "now",       -- now = jetzt lernbar, soon = bis +25 Skill, all = alle
  skillOnly = false,   -- nur Rezepte, die noch Skillpunkte bringen
  minimap = { show = true, angle = 205 },
  scale = 1,
  animations = true,
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

ns.On("ADDON_LOADED", function(_, name)
  if name ~= ADDON then return end
  local db = type(RezeptRadarDB) == "table" and RezeptRadarDB or {}
  if db.v ~= ns.DB_VERSION then
    local old = type(db.settings) == "table" and db.settings or {}
    db = { v = ns.DB_VERSION, settings = { point = old.point, scale = old.scale } }
  end
  applyDefaults(db, { settings = DEFAULTS, vendor = {}, ah = {} })
  RezeptRadarDB = db
  local char = type(RezeptRadarCharDB) == "table" and RezeptRadarCharDB or {}
  if char.v ~= ns.DB_VERSION then
    -- gelernte Rezepte aus dem Berufsfenster-Scan (6.x) übernehmen: die sind weiter richtig
    char = { v = ns.DB_VERSION, learned = type(char.learned) == "table" and char.learned or {} }
  end
  applyDefaults(char, { learned = {}, seen = {} })
  RezeptRadarCharDB = char
  ns.db, ns.settings, ns.char = db, db.settings, char
  ns.Fire("DB_READY")
end)

ns.On("PLAYER_LOGIN", function()
  ns.loggedIn = true
  ns.Fire("LOGIN")
end)

function ns.Faction()
  local f = UnitFactionGroup and UnitFactionGroup("player")
  return f == "Horde" and "H" or "A"
end

----------------------------------------------------------------------------
-- Berufe: nur Kochkunst (185) und Lederverarbeitung (165)
----------------------------------------------------------------------------
ns.PROF = { COOKING = 185, LEATHERWORKING = 165 }
ns.PROF_ORDER = { "COOKING", "LEATHERWORKING" }
ns.PROF_LABEL = { COOKING = "Kochkunst", LEATHERWORKING = "Lederverarbeitung" }
local KNOWN_PROF = { [185] = true, [165] = true }

ns.professions = {} -- [skillID] = { name, rank, maxRank }

local function readSkillLines()
  local result = {}
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
    if C_SkillInfo.ExpandSkillHeader then -- zugeklappte Überschriften verstecken ihre Zeilen
      for i = C_SkillInfo.GetNumSkillLines(), 1, -1 do
        local info = C_SkillInfo.GetSkillLineInfo(i)
        if info and info.isHeader and info.isCollapsed then C_SkillInfo.ExpandSkillHeader(i) end
      end
    end
    for i = 1, C_SkillInfo.GetNumSkillLines() do
      local info = C_SkillInfo.GetSkillLineInfo(i)
      if info and not info.isHeader and info.skillID and KNOWN_PROF[info.skillID] then
        result[info.skillID] = { name = info.name, rank = info.rank or 0, maxRank = info.maxRank or 0 }
      end
    end
  end
  return result
end

function ns.UpdateProfessions()
  ns.professions = readSkillLines() or {}
  ns.Fire("PROFESSIONS_CHANGED")
end

function ns.HasProf(key) return ns.professions[ns.PROF[key] or key] ~= nil end
function ns.ProfRank(key)
  local p = ns.professions[ns.PROF[key] or key]
  return p and p.rank or 0
end

ns.On("SKILL_LINES_CHANGED", function() ns.Debounce("skills", 0.5, ns.UpdateProfessions) end)
ns.Listen("LOGIN", function()
  ns.UpdateProfessions()
  C_Timer.After(2, function() ns.Safe(ns.UpdateProfessions) end)
end)

----------------------------------------------------------------------------
-- Items: Spiel-Daten, sonst die mitgelieferten (Data_Craft.lua: Name, Qualität, Symbol, Händlerpreis, Bindung)
----------------------------------------------------------------------------
local itemCache = {}
local GetItemInfo = C_Item and C_Item.GetItemInfo
local RequestLoad = C_Item and C_Item.RequestLoadItemDataByID

function ns.Item(id)
  local c = itemCache[id]
  if c and c.loaded then return c end
  c = c or { id = id }
  local s = ns.CRAFT_ITEMS and ns.CRAFT_ITEMS[id]
  local name, link, quality, icon, sell
  if GetItemInfo then
    local r = { GetItemInfo(id) }
    name, link, quality, icon, sell = r[1], r[2], r[3], r[10], r[11]
  end
  local hot = ns.HOTFIX and ns.HOTFIX.sell and ns.HOTFIX.sell[id]
  local hbind = ns.HOTFIX and ns.HOTFIX.bind and ns.HOTFIX.bind[id]
  c.bind = hbind or (s and s[5]) or 0
  if name then
    c.name, c.link, c.quality, c.icon, c.sell, c.loaded = name, link, quality, icon, hot or sell or (s and s[4]) or 0, true
  else
    c.name = (s and s[1]) or ("Item " .. id)
    c.quality = (s and s[2]) or 1
    c.icon = (s and s[3] ~= 0 and s[3]) or 134400
    c.sell = hot or (s and s[4]) or 0
    if RequestLoad and not c.requested then
      c.requested = true
      pcall(RequestLoad, id)
    end
  end
  itemCache[id] = c
  return c
end

local function onItemData(_, itemID, success)
  local c = itemID and itemCache[itemID]
  if c and not c.loaded and success ~= false then
    ns.Debounce("items", 0.4, function() ns.Fire("ITEMS_UPDATED") end)
  end
end
ns.On("GET_ITEM_INFO_RECEIVED", onItemData)
ns.On("ITEM_DATA_LOAD_RESULT", onItemData)

----------------------------------------------------------------------------
-- Geld und Texte
----------------------------------------------------------------------------
local GOLD_C, SILVER_C, COPPER_C = "|cffffd24a", "|cffd5d9e6", "|cffe8a066"
local ICON_G, ICON_S, ICON_C = "|A:coin-gold:11:11:1:0|a", "|A:coin-silver:11:11:1:0|a", "|A:coin-copper:11:11:1:0|a"
function ns.Money(copper)
  if copper == nil then return "|cff8a9a94–|r" end
  local neg = copper < 0
  copper = math.floor(math.abs(copper) + 0.5)
  local g, s, c = math.floor(copper / 10000), math.floor((copper % 10000) / 100), copper % 100
  local parts = {}
  if g > 0 then
    local gs = tostring(g)
    if g >= 1000 then gs = gs:reverse():gsub("(%d%d%d)", "%1."):reverse():gsub("^%.", "") end
    parts[#parts + 1] = GOLD_C .. gs .. "|r" .. ICON_G
  end
  if s > 0 and g < 100 then parts[#parts + 1] = SILVER_C .. s .. "|r" .. ICON_S end
  if c > 0 and g == 0 and s < 10 then parts[#parts + 1] = COPPER_C .. c .. "|r" .. ICON_C end
  if #parts == 0 then parts[1] = COPPER_C .. "0|r" .. ICON_C end
  local out = table.concat(parts, " ")
  if neg then out = "|cffff6b81-|r" .. out end
  return out
end

-- "vor 12 Min." / "vor 3 Std." / "vor 2 Tagen"
function ns.Ago(t)
  if not t then return "noch nie" end
  local d = math.max(0, time() - t)
  if d < 90 then return "gerade eben" end
  if d < 3600 then return string.format("vor %d Min.", math.floor(d / 60 + 0.5)) end
  if d < 86400 * 2 then return string.format("vor %d Std.", math.floor(d / 3600 + 0.5)) end
  return string.format("vor %d Tagen", math.floor(d / 86400 + 0.5))
end

function ns.Clamp(v, lo, hi)
  if v < lo then return lo end
  if v > hi then return hi end
  return v
end

function ns.Print(msg)
  if DEFAULT_CHAT_FRAME then DEFAULT_CHAT_FRAME:AddMessage("|cff39ff6bRezept|r|cff2de2e6Radar|r: " .. msg) end
end

-- Item-Link in den Chat/ins Eingabefeld legen
function ns.LinkItem(id)
  local item = ns.Item(id)
  if not item.link then return false end
  if HandleModifiedItemClick and HandleModifiedItemClick(item.link) then return true end
  if ChatFrameUtil and ChatFrameUtil.InsertLink then return ChatFrameUtil.InsertLink(item.link) end
  if ChatEdit_InsertLink then return ChatEdit_InsertLink(item.link) end
  return false
end

----------------------------------------------------------------------------
-- Befehle (/tz bleibt als Alias der alten Zentrale): /rr (Fenster), /rr scan, /rr fehler, /rr reset
----------------------------------------------------------------------------
SLASH_REZEPTRADAR1, SLASH_REZEPTRADAR2, SLASH_REZEPTRADAR3 = "/rr", "/rezept", "/tz"
SlashCmdList.REZEPTRADAR = function(msg)
  msg = (msg or ""):lower():gsub("^%s+", ""):gsub("%s+$", "")
  if msg == "fehler" or msg == "errors" then
    local log = ns.ErrorLog()
    if #log == 0 then ns.Print("Keine Fehler gespeichert.") return end
    for i, e in ipairs(log) do
      ns.Print(string.format("%d) %s (%dx, %s)", i, e.msg:sub(1, 200), e.count or 1, e.version or "?"))
    end
  elseif msg == "scan" then
    local ok, why = ns.Scan.Start()
    if not ok then ns.Print(why) end
  elseif msg == "reset" then
    ns.settings.point = nil
    if ns.UI and ns.UI.ResetPosition then ns.UI.ResetPosition() end
    ns.Print("Fensterposition zurückgesetzt.")
  elseif msg == "hilfe" or msg == "help" or msg == "?" then
    ns.Print("|cff39ff6b/rr|r Fenster  ·  |cff39ff6b/rr scan|r AH-Scan (AH offen)  ·  |cff39ff6b/rr reset|r Fensterposition  ·  |cff39ff6b/rr fehler|r Fehlerliste")
  else
    if ns.UI and ns.UI.ToggleWindow then ns.UI.ToggleWindow() end
  end
end

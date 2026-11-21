-- ChatWerk 1.0.0 (Tiry): eigene Chatfenster fuer WoW Forever - frei platzierbar, frei in der Groesse,
-- jedes Fenster zeigt nur, was in seiner Liste angehakt ist. Klassenfarben, Zeitstempel, kurze Kanalnamen,
-- anklickbare Links, Spam-Filter, Stichwort-Alarm, Verlauf. Auktionshaus und Gold immer detailliert (Auction.lua).
--
-- Forever-Grenzen (Blizzard-Code Forever/Blizzard_ChatFrameBase + API-Doku ChatInfoDocumentation):
--  * Im "Chat-Lockdown" (Kampf in Instanzen) sind Text, Name und GUID der CHAT_MSG-Ereignisse geheim
--    (SecretInChatMessagingLockdown). Add-ons duerfen sie dann nicht lesen/vergleichen/verketten.
--    ChatWerk zeigt sie trotzdem an: ScrollingMessageFrame:AddMessage laeuft ueber Blizzards
--    ScrollingMessageFrameSecureMixin ("as-if untainted") - nur ohne Namen/Farben/Filter.
--  * Ereignisname, Kanalname/-nummer sind nie geheim -> die Kategorie-Zuordnung klappt immer.
local ADDON, ns = ...
ChatWerk = ns
ns.NAME = ADDON or "ChatWerk"
ns.VERSION = "1.2.1"
local VERSION = ns.VERSION
ns.MEDIA = "Interface\\AddOns\\ChatWerk\\Media\\"

----------------------------------------------------------------------------
-- Helfer
----------------------------------------------------------------------------
local function secret(v) return issecretvalue ~= nil and issecretvalue(v) == true end
ns.IsSecret = secret

function ns.Clamp(v, lo, hi) if v < lo then return lo elseif v > hi then return hi end return v end

function ns.Print(msg)
  local text = "|cff39ff6bChat|r|cff2de2e6Werk|r: " .. tostring(msg)
  if ns.Emit and ns.ready then
    ns.Emit("addons", text, 1, 1, 1, { force = true })
  else
    DEFAULT_CHAT_FRAME:AddMessage(text)
  end
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

-- Fuer Widgets.lua (aus RezeptRadar uebernommen): Item-Grunddaten
function ns.Item(id)
  local icon = C_Item and C_Item.GetItemIconByID and C_Item.GetItemIconByID(id)
  local q
  if C_Item and C_Item.GetItemInfo then q = select(3, C_Item.GetItemInfo(id)) end
  return { icon = icon or 134400, quality = q or 1 }
end

-- Lua-Muster aus Blizzards Formatstrings (z. B. ERR_AUCTION_SOLD_S = "... %s ...")
function ns.ToPattern(fmt)
  if type(fmt) ~= "string" or fmt == "" then return nil end
  local p = fmt:gsub("%%%d*%$?([sd])", function(c) return c == "s" and "\001" or "\002" end)
  p = p:gsub("[%(%)%.%%%+%-%*%?%[%]%^%$]", "%%%0")
  p = p:gsub("\001", "(.-)"):gsub("\002", "(%%d+)")
  return "^" .. p .. "$"
end

-- Gold: 12g 30s 5k mit Muenzfarben, kompakt
local GOLD, SILV, COPP = "|cffffd24d", "|cffc7d2da", "|cffd98c4a"
function ns.Money(c, signed)
  if type(c) ~= "number" then return "?" end
  local neg = c < 0
  c = math.floor(math.abs(c) + 0.5)
  local g, s, k = math.floor(c / 10000), math.floor(c / 100) % 100, c % 100
  local parts = {}
  if g > 0 then parts[#parts + 1] = (BreakUpLargeNumbers and BreakUpLargeNumbers(g) or tostring(g)) .. GOLD .. "g|r" end
  if s > 0 then parts[#parts + 1] = s .. SILV .. "s|r" end
  if k > 0 or #parts == 0 then parts[#parts + 1] = k .. COPP .. "k|r" end
  local out = table.concat(parts, " ")
  if signed then out = (neg and "|cffff7080-|r" or "|cff39ff6b+|r") .. out elseif neg then out = "-" .. out end
  return out
end

----------------------------------------------------------------------------
-- Kategorien (die Auswahlliste je Fenster). Reihenfolge = Anzeige in den Einstellungen.
----------------------------------------------------------------------------
ns.GROUPS = {
  { key = "talk", label = "Gespraeche" },
  { key = "chan", label = "Kanaele" },
  { key = "ah", label = "Auktionshaus & Gold" },
  { key = "reward", label = "Beute & Fortschritt" },
  { key = "social", label = "Freunde, Gilde, Gruppe" },
  { key = "npc", label = "NPCs & Bosse" },
  { key = "sys", label = "System & Add-ons" },
}
ns.CATS = {
  -- Gespraeche
  { "say", "talk", "Sagen" }, { "yell", "talk", "Schreien" }, { "emote", "talk", "Emotes" },
  { "whisper", "talk", "Fluestern (rein + raus)" }, { "bnet", "talk", "Battle.net-Fluestern" },
  { "party", "talk", "Gruppe" }, { "raid", "talk", "Schlachtzug" }, { "raidwarn", "talk", "Schlachtzugswarnung" },
  { "instance", "talk", "Instanz-Chat" }, { "guild", "talk", "Gilde" }, { "officer", "talk", "Offiziere" },
  -- Kanaele: dynamisch je Kanal (ch:<Name>) + diese Meldungen
  { "chan_notice", "chan", "Kanal betreten/verlassen", "Meldungen, wenn du oder andere einen Kanal betreten oder verlassen." },
  -- Auktionshaus & Gold
  { "ah_sold", "ah", "AH: Verkauft (mit Preis)", "Sofort beim Verkauf: Item + Stueckpreis/Preis aus deinem Angebot." }, { "ah_mail", "ah", "AH: Post-Abrechnung", "Beim Briefkasten: Kaeufer, Menge, Preis, AH-Gebuehr, Kaution zurueck, Erloes." },
  { "ah_posted", "ah", "AH: Eingestellt", "Menge, Stueckpreis, Summe, Dauer, Kaution und Erloes nach 5 % Gebuehr." }, { "ah_bought", "ah", "AH: Gekauft / Gebot", "Gekaufte Menge, Stueckpreis und Summe bzw. dein Gebot." },
  { "ah_outbid", "ah", "AH: Ueberboten" }, { "ah_won", "ah", "AH: Gewonnen" }, { "ah_expired", "ah", "AH: Abgelaufen" },
  { "ah_cancel", "ah", "AH: Abgebrochen" }, { "vendor", "ah", "Haendler & Reparatur", "Jedes verkaufte/gekaufte Item mit Preis, Reparaturkosten, Bilanz beim Schliessen." },
  { "gold_mail", "ah", "Gold aus dem Briefkasten" }, { "gold_trade", "ah", "Handel mit Spielern" },
  { "gold_other", "ah", "Sonstige Goldbewegungen", "Flugmeister, Lehrer, Gildenbank und alles andere - mit neuem Kontostand." }, { "money", "ah", "Erbeutetes Gold" },
  -- Beute & Fortschritt
  { "loot_self", "reward", "Eigene Beute (mit Wert)" }, { "loot_other", "reward", "Beute anderer" },
  { "loot_roll", "reward", "Bedarf/Gier-Wuerfe" }, { "crafted", "reward", "Hergestellt" },
  { "currency", "reward", "Waehrungen" }, { "xp", "reward", "Erfahrung" }, { "rep", "reward", "Ruf" },
  { "honor", "reward", "Ehre" }, { "skill", "reward", "Fertigkeiten / Berufe" }, { "learned", "reward", "Gelernt (Zauber, Rezepte)" },
  { "quest", "reward", "Quests & Belohnungen", "Angenommen, abgeschlossen, abgegeben mit EP und Gold." }, { "achievement", "reward", "Erfolge" },
  { "tradeskill", "reward", "Berufe anderer Spieler" },
  -- Freunde, Gilde, Gruppe
  { "friends", "social", "Freunde online/offline" }, { "guild_sys", "social", "Gilden-Meldungen" },
  { "group_sys", "social", "Gruppen-Meldungen", "Beitreten, verlassen, neuer Leiter, Schlachtzug umgewandelt ..." }, { "roll", "social", "Wuerfeln (/wuerfeln)" },
  { "afk", "social", "AFK/DND-Status" },
  -- NPCs
  { "npc_say", "npc", "NPC sagt/schreit" }, { "npc_emote", "npc", "NPC-Emotes, Boss-Emotes" },
  { "npc_whisper", "npc", "NPC/Boss fluestert" },
  -- System
  { "sys_other", "sys", "Sonstige Systemmeldungen" }, { "addons", "sys", "Ausgaben von Add-ons", "Alles, was andere Add-ons in den Chat schreiben (sonst unsichtbar, wenn der Blizzard-Chat aus ist)." },
  { "ignored", "sys", "Ignoriert / gefiltert" },
}
ns.CAT = {}
for i, c in ipairs(ns.CATS) do
  c.key, c.group, c.label, c.tip, c.order = c[1], c[2], c[3], c[4], i
  ns.CAT[c.key] = c
end

-- Ereignis -> Kategorie (Kanaele, System, Beute: eigene Zuordnung weiter unten)
local EV = {
  CHAT_MSG_SAY = "say", CHAT_MSG_YELL = "yell", CHAT_MSG_EMOTE = "emote", CHAT_MSG_TEXT_EMOTE = "emote",
  CHAT_MSG_WHISPER = "whisper", CHAT_MSG_WHISPER_INFORM = "whisper", CHAT_MSG_AFK = "whisper", CHAT_MSG_DND = "whisper",
  CHAT_MSG_BN_WHISPER = "bnet", CHAT_MSG_BN_WHISPER_INFORM = "bnet", CHAT_MSG_BN_INLINE_TOAST_ALERT = "friends",
  CHAT_MSG_PARTY = "party", CHAT_MSG_PARTY_LEADER = "party",
  CHAT_MSG_RAID = "raid", CHAT_MSG_RAID_LEADER = "raid", CHAT_MSG_RAID_WARNING = "raidwarn",
  CHAT_MSG_INSTANCE_CHAT = "instance", CHAT_MSG_INSTANCE_CHAT_LEADER = "instance",
  CHAT_MSG_GUILD = "guild", CHAT_MSG_OFFICER = "officer",
  CHAT_MSG_GUILD_ACHIEVEMENT = "achievement", CHAT_MSG_ACHIEVEMENT = "achievement",
  CHAT_MSG_CHANNEL_NOTICE = "chan_notice", CHAT_MSG_CHANNEL_NOTICE_USER = "chan_notice",
  CHAT_MSG_CHANNEL_JOIN = "chan_notice", CHAT_MSG_CHANNEL_LEAVE = "chan_notice",
  CHAT_MSG_MONEY = "money", CHAT_MSG_CURRENCY = "currency", CHAT_MSG_COMBAT_XP_GAIN = "xp",
  CHAT_MSG_COMBAT_FACTION_CHANGE = "rep", CHAT_MSG_COMBAT_HONOR_GAIN = "honor", CHAT_MSG_SKILL = "skill",
  CHAT_MSG_TRADESKILLS = "tradeskill", CHAT_MSG_OPENING = "sys_other", CHAT_MSG_COMBAT_MISC_INFO = "sys_other",
  CHAT_MSG_MONSTER_SAY = "npc_say", CHAT_MSG_MONSTER_YELL = "npc_say", CHAT_MSG_MONSTER_PARTY = "npc_say",
  CHAT_MSG_MONSTER_EMOTE = "npc_emote", CHAT_MSG_RAID_BOSS_EMOTE = "npc_emote",
  CHAT_MSG_MONSTER_WHISPER = "npc_whisper", CHAT_MSG_RAID_BOSS_WHISPER = "npc_whisper",
  CHAT_MSG_IGNORED = "ignored", CHAT_MSG_FILTERED = "ignored", CHAT_MSG_RESTRICTED = "ignored",
  CHAT_MSG_SYSTEM = "sys_other", CHAT_MSG_LOOT = "loot_other", CHAT_MSG_CHANNEL = "chan",
}
ns.EV = EV

-- Systemmeldungen fein aufteilen: Blizzards Formatstrings (GlobalStrings) -> Kategorie
local SYS = {
  ah_sold = { "ERR_AUCTION_SOLD_S" }, ah_outbid = { "ERR_AUCTION_OUTBID_S" }, ah_won = { "ERR_AUCTION_WON_S" },
  ah_expired = { "ERR_AUCTION_EXPIRED_S" }, ah_cancel = { "ERR_AUCTION_REMOVED_S", "ERR_AUCTION_REMOVED" },
  ah_posted = { "ERR_AUCTION_STARTED" }, ah_bought = { "ERR_AUCTION_BID_PLACED" },
  friends = { "ERR_FRIEND_ONLINE_SS", "ERR_FRIEND_OFFLINE_S", "ERR_FRIEND_ADDED_S", "ERR_FRIEND_REMOVED_S" },
  guild_sys = { "ERR_GUILD_JOIN_S", "ERR_GUILD_LEAVE_S", "ERR_GUILD_REMOVE_SS", "ERR_GUILD_PROMOTE_SSS",
    "ERR_GUILD_DEMOTE_SSS", "ERR_GUILD_LEADER_CHANGED_SS", "ERR_GUILD_DISBANDED" },
  group_sys = { "ERR_JOINED_GROUP_S", "ERR_LEFT_GROUP_S", "ERR_LEFT_GROUP_YOU", "ERR_RAID_MEMBER_ADDED_S",
    "ERR_RAID_MEMBER_REMOVED_S", "ERR_RAID_YOU_JOINED", "ERR_RAID_YOU_LEFT", "ERR_INVITE_PLAYER_S", "ERR_DECLINE_GROUP_S",
    "ERR_NEW_LEADER_S", "ERR_NEW_LEADER_YOU", "ERR_GROUP_DISBANDED", "ERR_PARTY_CONVERTED_TO_RAID",
    "ERR_RAID_CONVERTED_TO_PARTY", "ERR_DUNGEON_DIFFICULTY_CHANGED_S", "ERR_INSTANCE_GROUP_ADDED_S",
    "ERR_INSTANCE_GROUP_REMOVED_S", "ERR_PLAYER_JOINED_BATTLE_D", "ERR_PLAYER_LEFT_BATTLE_D" },
  roll = { "RANDOM_ROLL_RESULT" },
  afk = { "MARKED_AFK", "MARKED_AFK_MESSAGE", "CLEARED_AFK", "MARKED_DND", "CLEARED_DND" },
  quest = { "ERR_QUEST_ACCEPTED_S", "ERR_QUEST_COMPLETE_S", "ERR_QUEST_FAILED_S", "ERR_QUEST_REWARD_EXP_I",
    "ERR_QUEST_REWARD_MONEY_S", "ERR_QUEST_REWARD_ITEM_S", "ERR_QUEST_REWARD_ITEM_MULT_IS", "ERR_QUEST_ABANDONED_S" },
  learned = { "ERR_LEARN_SPELL_S", "ERR_LEARN_ABILITY_S", "ERR_LEARN_RECIPE_S", "ERR_LEARN_TRANSMOG_S",
    "ERR_SPELL_UNLEARNED_S", "ERR_SKILL_GAINED_S", "ERR_PROFICIENCY_GAINED_S" },
  xp = { "ERR_ZONE_EXPLORED_XP", "ERR_ZONE_EXPLORED" },
}
local LOOT = {
  loot_self = { "LOOT_ITEM_SELF", "LOOT_ITEM_SELF_MULTIPLE", "LOOT_ITEM_PUSHED_SELF", "LOOT_ITEM_PUSHED_SELF_MULTIPLE",
    "LOOT_ITEM_REFUND", "LOOT_ITEM_REFUND_MULTIPLE", "LOOT_ITEM_BONUS_ROLL_SELF", "LOOT_ITEM_BONUS_ROLL_SELF_MULTIPLE" },
  crafted = { "LOOT_ITEM_CREATED_SELF", "LOOT_ITEM_CREATED_SELF_MULTIPLE" },
  loot_roll = { "LOOT_ROLL_NEED", "LOOT_ROLL_GREED", "LOOT_ROLL_PASSED", "LOOT_ROLL_WON", "LOOT_ROLL_ROLLED_NEED",
    "LOOT_ROLL_ROLLED_GREED", "LOOT_ROLL_ALL_PASSED", "LOOT_ROLL_DISENCHANT", "LOOT_ROLL_ROLLED_DE", "LOOT_ROLL_NEED_SELF",
    "LOOT_ROLL_GREED_SELF", "LOOT_ROLL_PASSED_SELF", "LOOT_ROLL_PASSED_AUTO", "LOOT_ROLL_PASSED_SELF_AUTO",
    "LOOT_ROLL_DISENCHANT_SELF", "LOOT_ROLL_YOU_WON", "LOOT_ROLL_STARTED", "LOOT_ROLL_TRANSMOG",
    "LOOT_ROLL_ROLLED_TRANSMOG", "LOOT_ROLL_TRANSMOG_SELF", "LOOT_ROLL_WON_NO_SPAM_NEED",
    "LOOT_ROLL_WON_NO_SPAM_GREED", "LOOT_ROLL_WON_NO_SPAM_DE", "LOOT_ROLL_LOST_ROLL", "LOOT_ROLL_INELIGIBLE_REASON1" },
}
local compiled
local function compile()
  compiled = { sys = {}, loot = {} }
  for dst, src in pairs({ sys = SYS, loot = LOOT }) do
    for cat, names in pairs(src) do
      for _, n in ipairs(names) do
        local p = ns.ToPattern(_G[n])
        if p then
          local list = compiled[dst]
          list[#list + 1] = { p = p, cat = cat, g = n }
        end
      end
    end
    -- laengere (spezifischere) Muster zuerst, damit z. B. MARKED_AFK_MESSAGE vor MARKED_AFK greift
    table.sort(compiled[dst], function(a, b) return #a.p > #b.p end)
  end
end
-- Liefert Kategorie und Name des Formatstrings + Fundstuecke (z. B. Itemlink)
function ns.Classify(kind, text)
  if not compiled then compile() end
  for _, e in ipairs(compiled[kind]) do
    local a, b, c = text:match(e.p)
    if a ~= nil or text:find(e.p) then return e.cat, e.g, a, b, c end
  end
end

----------------------------------------------------------------------------
-- Einstellungen
----------------------------------------------------------------------------
local DEFAULT_MAIN = {
  "say", "yell", "emote", "whisper", "bnet", "party", "raid", "raidwarn", "instance", "guild", "officer",
  "chan_notice", "friends", "guild_sys", "group_sys", "roll", "afk", "sys_other", "addons", "ignored", "npc_whisper",
  "achievement",
}
local DEFAULT_TRADE = {
  "ah_sold", "ah_mail", "ah_posted", "ah_bought", "ah_outbid", "ah_won", "ah_expired", "ah_cancel", "vendor",
  "gold_mail", "gold_trade", "gold_other", "money", "loot_self", "loot_roll", "crafted", "currency", "xp", "rep",
  "honor", "skill", "learned", "quest",
}
local DEFAULT_GUILD = { "guild", "officer", "guild_sys" }
local function catSet(list) local s = {} for _, k in ipairs(list) do s[k] = true end return s end

-- Ein Reiter im grossen Chatfenster: Name + was er zeigt (Kategorien, Kanaele)
function ns.NewWindow(name, cats)
  local DB = ns.DB
  DB.nextId = (DB.nextId or 0) + 1
  local win = { id = DB.nextId, name = name or ("Chat " .. (#DB.windows + 1)), cats = cats or {}, chans = {}, newChannels = false }
  DB.windows[#DB.windows + 1] = win
  return win
end

local DEFAULTS = {
  hideBlizzard = true, classColors = true, channelStyle = "name", timestamp = "%H:%M", links = true, spam = true,
  lootPrices = true, keywords = "", ownName = true, soundWhisper = true, soundKeyword = true, history = true,
  historyLines = 150, nameBrackets = false, mouseFade = false, font = "tech", animations = true,
}

local function initDB()
  ChatWerkDB = ChatWerkDB or {}
  ChatWerkCharDB = ChatWerkCharDB or {}
  local DB = ChatWerkDB
  for k, v in pairs(DEFAULTS) do if DB[k] == nil then DB[k] = v end end
  ns.DB, ns.CDB = DB, ChatWerkCharDB
  ns.CDB.hist = ns.CDB.hist or {}
  ns.CDB.posts = ns.CDB.posts or {}
  if not DB.windows or #DB.windows == 0 then
    -- Start: ein Fenster, drei Reiter
    DB.windows = {}
    DB.v = 120
    local main = ns.NewWindow("Allgemein", catSet(DEFAULT_MAIN))
    main.newChannels = true
    main.chans["ch:Handel"] = false
    local trade = ns.NewWindow("Handel", catSet(DEFAULT_TRADE))
    trade.chans["ch:Handel"] = true
    ns.NewWindow("Gilde", catSet(DEFAULT_GUILD))
    DB.active = main.id
  end
  if (DB.v or 100) < 110 then
    -- 1.0 -> 1.1: die einzelnen Fenster werden Reiter im grossen Fenster (Lage/Groesse/Aussehen vom ersten),
    -- Kanalnamen ausgeschrieben, damit vorne immer klar steht, woher die Zeile kommt
    DB.v = 110
    local w1 = DB.windows[1]
    DB.frame = DB.frame or { x = w1.x, y = w1.y, w = math.max(w1.w or 520, 520), h = math.max(w1.h or 230, 230),
      alpha = w1.alpha, font = w1.font, fade = w1.fade, locked = w1.locked }
    for _, w in ipairs(DB.windows) do
      w.x, w.y, w.w, w.h, w.alpha, w.font, w.fade, w.locked = nil, nil, nil, nil, nil, nil, nil, nil
    end
    if DB.channelStyle == "kurz" then DB.channelStyle = "name" end
    DB.active = DB.editWin or w1.id
    DB.editWin = nil
  end
  if (DB.v or 100) < 120 then
    -- 1.2 "2045": neue Tech-Schrift im Chat (wer bewusst die Spielschrift hatte, behaelt sie)
    DB.v = 120
    if DB.font == nil or DB.font == "poppins" then DB.font = "tech" end
  end
  DB.frame = DB.frame or {}
  for k, v in pairs({ x = 16, y = 40, w = 520, h = 230, alpha = 0.62, font = 13, fade = 0, locked = false, barFade = 5 }) do
    if DB.frame[k] == nil then DB.frame[k] = v end
  end
  if not ns.WindowById(DB.active) then DB.active = DB.windows[1].id end
  -- neue Kategorien aus spaeteren Versionen: nicht automatisch einschalten (nur was Tiry will)
end

function ns.WindowById(id)
  for i, w in ipairs(ns.DB.windows) do if w.id == id then return w, i end end
end

-- Will das Fenster diese Kategorie? Kanaele: ch:<Name>, unbekannte Kanaele -> newChannels
function ns.Wants(win, cat, chanKey)
  if chanKey then
    local v = win.chans[chanKey]
    if v == nil then return win.newChannels == true end
    return v == true
  end
  return win.cats[cat] == true
end

----------------------------------------------------------------------------
-- Ausgabe an die Fenster (+ Verlauf)
----------------------------------------------------------------------------
local function stamp()
  local fmt = ns.DB.timestamp
  if not fmt or fmt == "" or fmt == "aus" then return "" end
  return "|cff4fb3a4" .. date(fmt) .. "|r "
end
ns.Stamp = stamp

-- opts: chan (Kanal-Schluessel), secret (Text ist geheim: nur anzeigen), force (in alle Fenster mit "addons")
function ns.Emit(cat, text, r, g, b, opts)
  opts = opts or {}
  local DB = ns.DB
  if not DB then return end
  local isSecret = opts.secret or secret(text)
  local line = text
  if not isSecret then line = stamp() .. text end
  local hit = false
  for _, win in ipairs(DB.windows) do
    if ns.Wants(win, cat, opts.chan) then
      hit = true
      local W = ns.Windows and ns.Windows[win.id]
      if W then
        if isSecret then W:Add(text, r, g, b, true) else W:Add(line, r, g, b) end
      end
      if not isSecret and DB.history then
        local h = ns.CDB.hist[win.id] or {}
        ns.CDB.hist[win.id] = h
        h[#h + 1] = { line, r or 1, g or 1, b or 1 }
        local max = DB.historyLines or 150
        while #h > max do table.remove(h, 1) end
      end
    end
  end
  -- Ausgaben von ChatWerk selbst nie verschlucken: notfalls in den gerade offenen Reiter
  if not hit and opts.force and DB.windows[1] then
    local W = ns.Windows and (ns.Windows[DB.active] or ns.Windows[DB.windows[1].id])
    if W then W:Add(line, r, g, b) end
  end
  return hit
end

----------------------------------------------------------------------------
-- Formatierung
----------------------------------------------------------------------------
local classCache = {}   -- Name (kurz) -> Klasse (englisch), aus GUIDs gelernt
ns.classCache = classCache

local function classHex(class)
  if not class then return nil end
  local c
  if C_ClassColor and C_ClassColor.GetClassColor then
    local ok, col = pcall(C_ClassColor.GetClassColor, class)
    if ok and col then c = col end
  end
  c = c or (RAID_CLASS_COLORS and RAID_CLASS_COLORS[class])
  if not c then return nil end
  if c.colorStr then return "|c" .. c.colorStr end
  return string.format("|cff%02x%02x%02x", math.floor(c.r * 255), math.floor(c.g * 255), math.floor(c.b * 255))
end
ns.ClassHex = classHex

local function shortName(name)
  if type(name) ~= "string" or name == "" then return name end
  if Ambiguate then
    local ok, s = pcall(Ambiguate, name, "short")
    if ok and type(s) == "string" then return s end
  end
  return (name:gsub("%-.*$", ""))
end
ns.ShortName = shortName

local function classOf(name, guid)
  local class
  if type(guid) == "string" and guid ~= "" and GetPlayerInfoByGUID then
    local ok, _, eng = pcall(GetPlayerInfoByGUID, guid)
    if ok and eng then class = eng end
  end
  local short = shortName(name)
  if class and short then classCache[short] = class end
  return class or (short and classCache[short])
end
ns.ClassOf = classOf

-- Farbiger, anklickbarer Name (Links-Klick fluestern, Rechts-Klick Menue - SetItemRef von Blizzard)
function ns.NameLink(name, guid, lineID, chatType, chatTarget, bnID)
  if type(name) ~= "string" or name == "" then return "" end
  local disp = shortName(name)
  if ns.DB.classColors and not bnID then
    local hex = classHex(classOf(name, guid))
    if hex then disp = hex .. disp .. "|r" end
  end
  if ns.DB.nameBrackets then disp = "[" .. disp .. "]" end
  if bnID then
    return string.format("|HBNplayer:%s:%s:%s:%s:%s|h%s|h", name, tostring(bnID), tostring(lineID or 0),
      chatType or "BN_WHISPER", chatTarget or name, disp)
  end
  return string.format("|Hplayer:%s:%s:%s:%s|h%s|h", name, tostring(lineID or 0), chatType or "SAY", chatTarget or "", disp)
end

local TAGS = {
  GUILD = { "G", "Gilde" }, OFFICER = { "O", "Offizier" }, PARTY = { "P", "Gruppe" }, PARTY_LEADER = { "PL", "Gruppenleiter" },
  RAID = { "R", "Schlachtzug" }, RAID_LEADER = { "RL", "Schlachtzugsleiter" }, RAID_WARNING = { "RW", "Schlachtzugswarnung" },
  INSTANCE_CHAT = { "I", "Instanz" }, INSTANCE_CHAT_LEADER = { "IL", "Instanzleiter" },
}
-- nur bei ausgeschriebenen Kanalnamen: auch Sagen/Schreien bekommen vorne ihre Herkunft
local SAYTAGS = { SAY = "Sagen", YELL = "Schreien" }
local LINKTYPE = { PARTY_LEADER = "PARTY", RAID_LEADER = "RAID", RAID_WARNING = "RAID_WARNING", INSTANCE_CHAT_LEADER = "INSTANCE_CHAT" }
local CHAN_SHORT = {
  ["allgemein"] = "A", ["general"] = "A", ["handel"] = "H", ["trade"] = "H", ["lokaleverteidigung"] = "LV",
  ["localdefense"] = "LV", ["suchenachgruppe"] = "LFG", ["lookingforgroup"] = "LFG", ["weltverteidigung"] = "WV",
  ["worlddefense"] = "WV", ["gildenrekrutierung"] = "GR", ["guildrecruitment"] = "GR", ["neulingschat"] = "N",
  ["newcomerchat"] = "N", ["dienste"] = "D", ["services"] = "D",
}
function ns.ChannelBase(channelName, baseName)
  local b = (type(baseName) == "string" and baseName ~= "") and baseName or channelName or ""
  b = b:gsub("^%d+%.%s*", ""):gsub("%s+%-%s+.*$", "")
  return b
end
function ns.ChannelTag(num, base)
  local style = ns.DB.channelStyle
  local label
  if style == "nummer" then label = tostring(num)
  elseif style == "voll" then label = num .. ". " .. base
  elseif style == "name" then label = base ~= "" and base or ("Kanal " .. num)
  else
    local key = base:lower():gsub("[%s%-_]", "")
    local s = CHAN_SHORT[key]
    if not s then s = (#base <= 6) and base or base:sub(1, 5) end
    label = num .. "·" .. s
  end
  return string.format("|Hchannel:channel:%d|h[%s]|h", tonumber(num) or 0, label)
end
local function typeTag(chatType)
  local t = TAGS[chatType]
  if not t then return "" end
  local long = ns.DB.channelStyle == "voll" or ns.DB.channelStyle == "name"
  local label = long and t[2] or t[1]
  return string.format("|Hchannel:%s|h[%s]|h ", LINKTYPE[chatType] or chatType, label)
end
local function sayTag(chatType)
  if ns.DB.channelStyle ~= "name" then return "" end
  return string.format("|Hchannel:%s|h[%s]|h ", chatType, SAYTAGS[chatType])
end

-- Links im Text: http(s)/www anklickbar (Kopierfenster)
local function linkify(text)
  if not ns.DB.links or text:find("|H", 1, true) and not text:find("https?://") and not text:find("www%.") then return text end
  local function wrap(u) return "|cff26f2d9|Hcwurl:" .. u .. "|h[" .. u .. "]|h|r" end
  text = text:gsub("(https?://[%w%._~:/%?#%[%]@!%$&'%(%)%*%+,;=%%%-]+)", wrap)
  text = text:gsub("(%f[%w]www%.[%w%-]+%.[%a][%w%._~:/%?#@!%$&%*%+,;=%%%-]*)", function(u)
    return wrap(u)
  end)
  return text
end
ns.Linkify = linkify

-- Stichwoerter (+ eigener Name) hervorheben; nur ausserhalb von Links
local function caseless(word)
  return (word:gsub("%a", function(c) return "[" .. c:lower() .. c:upper() .. "]" end):gsub("([%(%)%.%+%-%*%?%^%$])", "%%%1"))
end
function ns.Keywords()
  local list = {}
  for w in (ns.DB.keywords or ""):gmatch("[^,;]+") do
    w = w:gsub("^%s+", ""):gsub("%s+$", "")
    if #w >= 2 then list[#list + 1] = w end
  end
  if ns.DB.ownName and UnitName then
    local me = UnitName("player")
    if type(me) == "string" and me ~= "" then list[#list + 1] = me end
  end
  return list
end
local function highlight(text)
  local hit = false
  for _, w in ipairs(ns.Keywords()) do
    local p = "%f[%w]" .. caseless(w) .. "%f[%W]"
    if text:find(p) then
      hit = true
      if not text:find("|H", 1, true) then text = text:gsub(p, "|cffffd24d%0|r") end
    end
  end
  return text, hit
end
ns.Highlight = highlight

local function playSound(kind)
  if not PlaySound or not SOUNDKIT then return end
  local id = kind == "whisper" and SOUNDKIT.TELL_MESSAGE or (SOUNDKIT.RAID_WARNING or SOUNDKIT.TELL_MESSAGE)
  if id then pcall(PlaySound, id, "Master") end
end

-- Spam-Filter: gleicher Absender + gleicher Text innerhalb von 60 s in Kanaelen/Sagen/Schreien
local recent = {}
local function isSpam(sender, text)
  if not ns.DB.spam then return false end
  local now = GetTime()
  local key = sender .. "\001" .. text
  local last = recent[key]
  recent[key] = now
  if math.random(1, 40) == 1 then for k, t in pairs(recent) do if now - t > 120 then recent[k] = nil end end end
  return last ~= nil and now - last < 60
end
ns.IsSpam = isSpam

local function typeColor(chatType)
  local info = ChatTypeInfo and ChatTypeInfo[chatType]
  if info then return info.r, info.g, info.b end
  return 1, 1, 1
end
ns.TypeColor = typeColor

local SPECIAL = { AFK = "|cffff9b4d<AFK>|r ", DND = "|cffff9b4d<DND>|r ", GM = "|cff00b4ff<GM>|r ", DEV = "|cff00b4ff<Dev>|r " }

----------------------------------------------------------------------------
-- Ereignis-Verarbeitung
----------------------------------------------------------------------------
local systemSeen = {}   -- zuletzt verarbeitete Systemtexte (gegen Doppelte aus dem Blizzard-Hook)
ns.systemSeen = systemSeen

function ns.OnChat(event, ...)
  local text, sender, lang, chanName, _, flags, _, chanNum, chanBase, _, lineID, guid, bnID = ...
  local chatType = event:sub(10)
  local cat = EV[event]
  if not cat then return end
  local chanKey
  local r, g, b
  if chatType == "CHANNEL" then
    local base = ns.ChannelBase(chanName, chanBase)
    chanKey = "ch:" .. base
    ns.SeeChannel(base)
    r, g, b = typeColor("CHANNEL" .. tostring(chanNum or ""))
  else
    r, g, b = typeColor(chatType)
  end

  -- Chat-Lockdown: Text/Name geheim -> nur anzeigen (Kategorie stimmt trotzdem)
  if secret(text) or secret(sender) or secret(guid) then
    if chatType == "SYSTEM" or chatType == "LOOT" then cat = cat end
    ns.Emit(cat, text, r, g, b, { chan = chanKey, secret = true })
    return
  end
  text = text or ""

  -- feine Zuordnung
  local extra
  if chatType == "SYSTEM" then
    systemSeen[text] = GetTime()
    local c, gname, a = ns.Classify("sys", text)
    if c then cat = c end
    if ns.AH and ns.AH.System then
      local repl = ns.AH.System(cat, gname, text, a)
      if repl == false then return end
      if repl then text = repl end
    end
    if cat == "friends" and ns.FriendLine then text = ns.FriendLine(gname, text, a) or text end
  elseif chatType == "LOOT" then
    local c = ns.Classify("loot", text)
    if c then cat = c
    elseif guid and UnitGUID and guid == UnitGUID("player") then cat = "loot_self" end
    if (cat == "loot_self" or cat == "crafted") and ns.DB.lootPrices and ns.LootValue then extra = ns.LootValue(text) end
    if cat == "loot_other" or cat == "loot_roll" then
      -- Pluendernden in Klassenfarbe einfaerben
      if type(sender) == "string" and sender ~= "" and ns.DB.classColors then
        local hex = classHex(classOf(sender, guid))
        local s = shortName(sender)
        if hex and s and not text:find("|H", 1, true) then
          text = text:gsub("%f[%w]" .. s:gsub("([%(%)%.%+%-%*%?%^%$%[%]])", "%%%1") .. "%f[%W]", hex .. s .. "|r", 1)
        elseif hex and s then
          local first, rest = text:match("^(.-)(|H.*)$")
          if first then
            text = first:gsub("%f[%w]" .. s:gsub("([%(%)%.%+%-%*%?%^%$%[%]])", "%%%1") .. "%f[%W]", hex .. s .. "|r", 1) .. rest
          end
        end
      end
    end
  end

  -- Anzeige bauen
  local out
  local name = sender
  local isMe = UnitName and type(name) == "string" and shortName(name) == UnitName("player")
  if chatType == "SAY" or chatType == "YELL" or chatType == "CHANNEL" or chatType == "EMOTE" then
    if not isMe and isSpam(name or "", text) then return end
  end
  local lang2 = ""
  if type(lang) == "string" and lang ~= "" and GetDefaultLanguage and lang ~= GetDefaultLanguage() then
    lang2 = "|cff9fb3ad[" .. lang .. "]|r "
  end
  local special = (type(flags) == "string" and SPECIAL[flags]) or ""
  local body = text
  local alert = false
  local isChat = cat == "say" or cat == "yell" or cat == "whisper" or cat == "bnet" or cat == "party" or cat == "raid"
    or cat == "raidwarn" or cat == "instance" or cat == "guild" or cat == "officer" or chatType == "CHANNEL" or cat == "emote"
  if isChat then
    body = linkify(body)
    if not isMe then body, alert = highlight(body) end
  end

  if chatType == "CHANNEL" then
    out = ns.ChannelTag(chanNum or 0, ns.ChannelBase(chanName, chanBase)) .. " " .. special
      .. ns.NameLink(name, guid, lineID, "CHANNEL", chanNum) .. ": " .. lang2 .. body
  elseif chatType == "SAY" then
    out = sayTag("SAY") .. special .. ns.NameLink(name, guid, lineID, "SAY") .. ": " .. lang2 .. body
  elseif chatType == "YELL" then
    out = sayTag("YELL") .. special .. ns.NameLink(name, guid, lineID, "YELL") .. " schreit: " .. lang2 .. body
  elseif chatType == "EMOTE" then
    out = special .. ns.NameLink(name, guid, lineID, "EMOTE") .. " " .. body
  elseif chatType == "TEXT_EMOTE" then
    local s = shortName(name)
    local hex = ns.DB.classColors and classHex(classOf(name, guid))
    if s and hex and not body:find("|H", 1, true) then
      body = body:gsub("%f[%w]" .. s:gsub("([%(%)%.%+%-%*%?%^%$%[%]])", "%%%1") .. "%f[%W]", hex .. s .. "|r", 1)
    end
    out = body
  elseif chatType == "WHISPER" then
    out = "|cffff8af0»|r " .. special .. ns.NameLink(name, guid, lineID, "WHISPER", name) .. " fluestert: " .. lang2 .. body
    if ns.DB.soundWhisper then playSound("whisper") end
  elseif chatType == "WHISPER_INFORM" then
    out = "|cffff8af0«|r An " .. ns.NameLink(name, guid, lineID, "WHISPER", name) .. ": " .. body
  elseif chatType == "BN_WHISPER" then
    out = "|cff00c8ff»|r " .. ns.NameLink(name, nil, lineID, "BN_WHISPER", name, bnID or 0) .. " fluestert: " .. body
    if ns.DB.soundWhisper then playSound("whisper") end
  elseif chatType == "BN_WHISPER_INFORM" then
    out = "|cff00c8ff«|r An " .. ns.NameLink(name, nil, lineID, "BN_WHISPER", name, bnID or 0) .. ": " .. body
  elseif chatType == "AFK" or chatType == "DND" then
    out = ns.NameLink(name, guid, lineID, "WHISPER", name) .. " ist " .. chatType .. ": " .. body
  elseif TAGS[chatType] then
    out = typeTag(chatType) .. special .. ns.NameLink(name, guid, lineID, LINKTYPE[chatType] or chatType) .. ": " .. lang2 .. body
  elseif chatType == "MONSTER_SAY" or chatType == "MONSTER_PARTY" then
    out = "|cffd8c9a3" .. tostring(name) .. "|r sagt: " .. body:format(name or "")
  elseif chatType == "MONSTER_YELL" then
    out = "|cffd8c9a3" .. tostring(name) .. "|r schreit: " .. body:format(name or "")
  elseif chatType == "MONSTER_WHISPER" or chatType == "RAID_BOSS_WHISPER" then
    out = "|cffd8c9a3" .. tostring(name) .. "|r fluestert: " .. body:format(name or "")
  elseif chatType == "MONSTER_EMOTE" or chatType == "RAID_BOSS_EMOTE" then
    local ok, s = pcall(string.format, body, name or "", name or "")
    out = ok and s or body
  elseif chatType == "ACHIEVEMENT" or chatType == "GUILD_ACHIEVEMENT" then
    local ok, s = pcall(string.format, body, ns.NameLink(name, guid, lineID, "SAY"))
    out = (chatType == "GUILD_ACHIEVEMENT" and typeTag("GUILD") or "") .. (ok and s or body)
  elseif chatType == "IGNORED" then
    out = tostring(name) .. " ignoriert dich."
  elseif chatType == "CHANNEL_NOTICE" or chatType == "CHANNEL_NOTICE_USER" or chatType == "CHANNEL_JOIN" or chatType == "CHANNEL_LEAVE" then
    local base = ns.ChannelBase(chanName, chanBase)
    if base ~= "" then ns.SeeChannel(base) end
    local what = ({ YOU_JOINED = "beigetreten", YOU_CHANGED = "gewechselt", YOU_LEFT = "verlassen",
      SUSPENDED = "pausiert" })[text] or text
    if chatType == "CHANNEL_JOIN" then what = shortName(name) .. " ist beigetreten"
    elseif chatType == "CHANNEL_LEAVE" then what = shortName(name) .. " hat verlassen" end
    out = ns.ChannelTag(chanNum or 0, base) .. " " .. what
  else
    out = body
  end
  if extra then out = out .. extra end
  if alert then
    out = "|cffffd24d!|r " .. out
    if ns.DB.soundKeyword then playSound("keyword") end
  end
  ns.Emit(cat, out, r, g, b, { chan = chanKey })
end

-- Bekannte Kanaele (fuer die Auswahlliste)
function ns.SeeChannel(base)
  if type(base) ~= "string" or base == "" then return end
  ns.DB.channels = ns.DB.channels or {}
  if not ns.DB.channels[base] then
    ns.DB.channels[base] = true
    if ns.Config and ns.Config.Refresh then ns.Config.Refresh() end
  end
end
function ns.ScanChannels()
  if not GetChannelList then return end
  local list = { GetChannelList() }
  for i = 1, #list, 3 do
    local name = list[i + 1]
    if type(name) == "string" and not secret(name) then ns.SeeChannel(ns.ChannelBase(name)) end
  end
end

----------------------------------------------------------------------------
-- Freunde: "Name ist online" mit Klasse, Stufe, Gebiet
----------------------------------------------------------------------------
local classByLocal
local function englishClass(localized)
  if not classByLocal then
    classByLocal = {}
    for _, t in ipairs({ LOCALIZED_CLASS_NAMES_MALE or {}, LOCALIZED_CLASS_NAMES_FEMALE or {} }) do
      for eng, loc in pairs(t) do classByLocal[loc] = eng end
    end
  end
  return classByLocal[localized]
end
function ns.FriendLine(gname, text, a)
  if gname ~= "ERR_FRIEND_ONLINE_SS" and gname ~= "ERR_FRIEND_OFFLINE_S" then return nil end
  local name = a
  if gname == "ERR_FRIEND_ONLINE_SS" then
    -- "|Hplayer:%s|h[%s]|h ist jetzt online." -> erstes Fundstueck ist der Linkname
    name = a and a:match("^([^:|]+)") or a
  end
  if type(name) ~= "string" or name == "" then return nil end
  local info = C_FriendList and C_FriendList.GetFriendInfo and C_FriendList.GetFriendInfo(name)
  local class = info and (info.className and englishClass(info.className)) or classCache[shortName(name)]
  if class then classCache[shortName(name)] = class end
  local hex = classHex(class) or "|cffffffff"
  if gname == "ERR_FRIEND_ONLINE_SS" then
    local detail = ""
    if info and info.level then
      detail = string.format(" |cff9fb3ad(Stufe %d%s%s)|r", info.level, info.className and (" " .. info.className) or "",
        (info.area and info.area ~= "") and (", " .. info.area) or "")
    end
    return ns.AH.Icon("check") .. string.format("|Hplayer:%s|h%s%s|r|h", name, hex, shortName(name)) .. " ist online" .. detail
  end
  return ns.AH.Icon("close", { 255, 112, 128 }) .. hex .. shortName(name) .. "|r ist offline"
end

----------------------------------------------------------------------------
-- Beute: Wert dazuschreiben (Haendlerpreis x Menge, AH-Preis per Auctionator falls geladen)
----------------------------------------------------------------------------
function ns.LootValue(text)
  local link = text:match("(|c%x+|Hitem:.-|h.-|h|r)") or text:match("(|Hitem:.-|h.-|h)")
  if not link then return nil end
  local count = tonumber(text:match("|h|r?x(%d+)") or text:match("x(%d+)%.?$") or text:match("(%d+)x")) or 1
  local parts = {}
  if C_Item and C_Item.GetItemInfo then
    local sell = select(11, C_Item.GetItemInfo(link))
    if type(sell) == "number" and sell > 0 then parts[#parts + 1] = "Haendler " .. ns.Money(sell * count) end
  end
  local api = Auctionator and Auctionator.API and Auctionator.API.v1
  if api and api.GetAuctionPriceByItemLink then
    local ok, p = pcall(api.GetAuctionPriceByItemLink, "ChatWerk", link)
    if ok and type(p) == "number" and p > 0 then parts[#parts + 1] = "AH " .. ns.Money(p * count) end
  end
  if #parts == 0 then return nil end
  return " |cff7f8f8a(" .. table.concat(parts, " · ") .. ")|r"
end

----------------------------------------------------------------------------
-- Start
----------------------------------------------------------------------------
local CHAT_EVENTS = {}
for ev in pairs(EV) do CHAT_EVENTS[#CHAT_EVENTS + 1] = ev end
table.sort(CHAT_EVENTS)
ns.CHAT_EVENTS = CHAT_EVENTS

local E = CreateFrame("Frame")
ns.EventFrame = E
E:RegisterEvent("ADDON_LOADED")
E:RegisterEvent("PLAYER_LOGIN")
E:RegisterEvent("CHANNEL_UI_UPDATE")
E:SetScript("OnEvent", function(self, event, ...)
  if event == "ADDON_LOADED" then
    if ... ~= ns.NAME then return end
    initDB()
    for _, ev in ipairs(CHAT_EVENTS) do pcall(self.RegisterEvent, self, ev) end
    if ns.Blizzard and ns.Blizzard.Hook then ns.Safe(ns.Blizzard.Hook) end
    return
  end
  if event == "PLAYER_LOGIN" then
    ns.Safe(function()
      if not ns.DB then initDB() end
      if ns.BuildWindows then ns.BuildWindows() end
      ns.ready = true
      if ns.Blizzard and ns.Blizzard.Apply then ns.Blizzard.Apply() end
      if ns.AH and ns.AH.Init then ns.AH.Init() end
      ns.ScanChannels()
      if ns.Blizzard and ns.Blizzard.Flush then ns.Blizzard.Flush() end
      ns.Print("Version " .. VERSION .. " geladen - |cff39ff6b/cw|r oeffnet die Einstellungen.")
    end)
    return
  end
  if event == "CHANNEL_UI_UPDATE" then ns.Safe(ns.ScanChannels) return end
  if not ns.ready then return end
  if ns.AH and ns.AH.handlers and ns.AH.handlers[event] then ns.Safe(ns.AH.OnEvent, event, ...) end
  if EV[event] then ns.Safe(ns.OnChat, event, ...) end
end)

----------------------------------------------------------------------------
-- Slash-Befehl
----------------------------------------------------------------------------
SLASH_CHATWERK1, SLASH_CHATWERK2 = "/cw", "/chatwerk"
SlashCmdList.CHATWERK = function(msg)
  msg = (msg or ""):lower():gsub("^%s+", ""):gsub("%s+$", "")
  if msg == "" or msg == "einstellungen" or msg == "config" then
    if ns.Config then ns.Config.Toggle() end
  elseif msg == "neu" then
    local w = ns.NewWindow(nil, {})
    if ns.BuildWindows then ns.BuildWindows() end
    if ns.Main and ns.Main.Select then ns.Main:Select(w.id) end
    if ns.Config then ns.Config.Open(w.id) end
  elseif msg == "blizzard" then
    ns.DB.hideBlizzard = not ns.DB.hideBlizzard
    if ns.Blizzard then ns.Blizzard.Apply() end
    ns.Print("Blizzard-Chat " .. (ns.DB.hideBlizzard and "|cffff7080ausgeblendet|r" or "|cff39ff6bsichtbar|r"))
  elseif msg == "sperren" or msg == "lock" then
    ns.DB.frame.locked = not ns.DB.frame.locked
    if ns.BuildWindows then ns.BuildWindows() end
    ns.Print(ns.DB.frame.locked and "Chatfenster gesperrt." or "Chatfenster frei (an den Reitern ziehen + Groesse an der Ecke).")
  elseif msg == "fehler" then
    if #ns.errors == 0 then ns.Print("Keine Fehler.") end
    for _, e in ipairs(ns.errors) do ns.Print("|cffff7080" .. e:gsub("\n.*", "") .. "|r") end
  elseif msg == "reset" then
    ChatWerkDB = nil
    ns.Print("Alles zurueckgesetzt - bitte |cff39ff6b/reload|r.")
  else
    ns.Print("|cff39ff6b/cw|r Einstellungen · |cff39ff6bneu|r neuer Reiter · |cff39ff6bsperren|r Fenster sperren/frei · "
      .. "|cff39ff6bblizzard|r Blizzard-Chat ein/aus · |cff39ff6bfehler|r · |cff39ff6breset|r")
  end
end

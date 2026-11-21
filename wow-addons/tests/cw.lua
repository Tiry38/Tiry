-- ChatWerk 1.0: Ablauf im strengen Forever-Nachbau. Kategorien je Fenster, Klassenfarben, Kanaele, Spam-Filter,
-- Chat-Lockdown (geheime Werte), Add-on-Ausgaben, Auktionshaus/Post/Haendler-Details, Einstellungen, Fenster-Groesse.
-- Aufruf: lua5.1 tests/cw.lua [ausgabeordner]  -> Vorschau: python3 -I tools/render_pages.py <ordner>
-- Exit 0 + "CW TESTS OK" = alles gruen.
local HERE = arg[0]:match("^(.*/)") or "./"
package.path = package.path .. ";" .. HERE .. "?.lua"
local OUT = arg[1]
local ROOT = HERE .. "../addons/ChatWerk/"
local W = require("wow_mock")
local L = require("layout")

W.install({ auctionator = false })
local G = _G
local fails, checks = 0, 0
local function ok(cond, msg)
  checks = checks + 1
  if not cond then fails = fails + 1 print("  FEHLER " .. msg) end
end

----------------------------------------------------------------------------
-- Umgebung: Geheimwerte, Texte (deDE-GlobalStrings), Klassen, Blizzard-Chat
----------------------------------------------------------------------------
local SECRET = setmetatable({}, { __tostring = function() error("geheimer Wert wurde als Text benutzt") end,
  __concat = function() error("geheimer Wert wurde verkettet") end, __len = function() error("geheimer Wert: Laenge") end,
  __eq = function() error("geheimer Wert verglichen") end, __index = function() error("geheimer Wert indiziert") end })
G.issecretvalue = function(v) return rawequal(v, SECRET) end
G.STANDARD_TEXT_FONT = "Fonts\\FRIZQT__.TTF"
local GS = {
  ERR_AUCTION_SOLD_S = "Es wurde ein Käufer für Eure Auktion gefunden: %1$s.",
  ERR_AUCTION_OUTBID_S = "Ihr wurdet bei %s überboten.",
  ERR_AUCTION_WON_S = "Ihr habt eine Auktion gewonnen für: %s",
  ERR_AUCTION_EXPIRED_S = "Eure Auktion von %s ist abgelaufen.",
  ERR_AUCTION_REMOVED_S = "Eure Auktion von %s wurde vom Verkäufer abgebrochen.",
  ERR_AUCTION_REMOVED = "Auktion abgebrochen.",
  ERR_AUCTION_STARTED = "Auktion erstellt.",
  ERR_AUCTION_BID_PLACED = "Gebot akzeptiert.",
  ERR_FRIEND_ONLINE_SS = "|Hplayer:%s|h[%s]|h ist jetzt online.",
  ERR_FRIEND_OFFLINE_S = "%s ist jetzt offline.",
  MARKED_AFK = "Ihr seid jetzt AFK.",
  MARKED_AFK_MESSAGE = "Ihr seid jetzt AFK: %s",
  RANDOM_ROLL_RESULT = "%1$s würfelt. Ergebnis: %2$d (%3$d-%4$d)",
  LOOT_ITEM_SELF = "Ihr erhaltet Beute: %s.",
  LOOT_ITEM_SELF_MULTIPLE = "Ihr erhaltet Beute: %sx%d.",
  LOOT_ITEM_CREATED_SELF = "Ihr stellt her: %s.",
  ERR_JOINED_GROUP_S = "%s schließt sich der Gruppe an.",
  ERR_ZONE_EXPLORED_XP = "%1$s entdeckt: %2$d Erfahrung erhalten.",
}
for k, v in pairs(GS) do G[k] = v end
G.RAID_CLASS_COLORS = {
  SHAMAN = { r = 0, g = 0.44, b = 0.87, colorStr = "ff0070dd" }, MAGE = { r = 0.25, g = 0.78, b = 0.92, colorStr = "ff3fc7eb" },
  ROGUE = { r = 1, g = 0.96, b = 0.41, colorStr = "fffff468" }, WARRIOR = { r = 0.78, g = 0.61, b = 0.43, colorStr = "ffc69b6d" },
}
G.LOCALIZED_CLASS_NAMES_MALE = { SHAMAN = "Schamane", MAGE = "Magier", ROGUE = "Schurke", WARRIOR = "Krieger" }
local GUIDS = { ["Player-1-AAA"] = "SHAMAN", ["Player-1-BBB"] = "MAGE", ["Player-1-CCC"] = "WARRIOR" }
G.GetPlayerInfoByGUID = function(guid)
  assert(not G.issecretvalue(guid), "GetPlayerInfoByGUID mit geheimer GUID")
  local c = GUIDS[guid]
  if c then return G.LOCALIZED_CLASS_NAMES_MALE[c], c, "Ork", "Orc", 2, "Name", "Realm" end
end
G.Ambiguate = function(name, ctx) assert(type(name) == "string") return (name:gsub("%-.*$", "")) end
G.UnitGUID = function(u) if u == "player" then return "Player-1-ME" end end
G.GetDefaultLanguage = function() return "Orcisch" end
G.ChatTypeInfo = setmetatable({ SYSTEM = { r = 1, g = 1, b = 0, id = 1 } }, { __index = function(t, k) return { r = 0.9, g = 0.9, b = 0.9, id = 99 } end })
G.C_FriendList = { GetFriendInfo = function(n) if n == "Jaina" then return { level = 34, className = "Magier", area = "Orgrimmar" } end end }
G.GetChannelList = function() return 1, "Allgemein - Durotar", false, 2, "Handel - Stadt", false end
G.IsControlKeyDown = function() return false end
G.BreakUpLargeNumbers = function(n) return tostring(n) end
G.SetItemRef = function(link, text, button, frame) W.itemRef = link end
G.C_QuestLog = { GetTitleForQuestID = function(id) return "Die Kur des Schamanen" end }
G.SCROLLING_MESSAGE_FRAME_INSERT_MODE_BOTTOM = 2
G.NUM_CHAT_WINDOWS = 2
local GT = G.GameTooltip
GT.SetHyperlink = function(self, link) assert(type(link) == "string") end

-- Blizzard-Chatfenster: Rahmen + Lua-Methode AddMessage (wie ChatFrameMixin)
for i = 1, 2 do
  local cf = CreateFrame("Frame", "ChatFrame" .. i, UIParent)
  rawset(cf, "AddMessage", function(self, msg, r, g, b, id) W.blizz = (W.blizz or 0) + 1 end)
  CreateFrame("Frame", "ChatFrame" .. i .. "Tab", UIParent)
  CreateFrame("Frame", "ChatFrame" .. i .. "ButtonFrame", UIParent)
end
G.DEFAULT_CHAT_FRAME = ChatFrame1
local eb = CreateFrame("EditBox", "ChatFrame1EditBox", ChatFrame1)
eb:SetSize(400, 32)
for _, part in ipairs({ "Left", "Mid", "Right" }) do eb:CreateTexture("ChatFrame1EditBox" .. part, "BACKGROUND") end
G.GeneralDockManager = CreateFrame("Frame", "GeneralDockManager", UIParent)

-- Items, Taschen, Geld
W.itemInfo = { [2589] = { name = "Leinenstoff", sell = 13, stack = 200 }, [2592] = { name = "Wollstoff", sell = 33 },
  [4306] = { name = "Seidenstoff", sell = 150 }, [2318] = { name = "Leichtes Leder", sell = 15 } }
local function link(id) return select(2, C_Item.GetItemInfo(id)) end
local byName = {}
for id, d in pairs(W.itemInfo) do byName[d.name] = id end
local origInfo = C_Item.GetItemInfo
C_Item.GetItemInfo = function(x)
  if type(x) == "string" then
    local id = byName[x] or tonumber(x:match("item:(%d+)"))
    if not id then return nil end
    return origInfo(id)
  end
  return origInfo(x)
end
C_Item.GetItemLink = function(loc) return link(loc.id) end
C_Item.GetItemID = function(loc) return loc.id end
W.money = 500000
G.GetMoney = function() return W.money end
local function money(delta) W.money = W.money + delta W.fire("PLAYER_MONEY") end
W.bags = { [0] = { { itemID = 2592, stackCount = 5, hyperlink = link(2592) } } }

-- Auktionshaus (Spieler-Klicks + Abfragen)
local CAH = C_AuctionHouse
CAH.PostCommodity = function(loc, d, q, unit) assert(type(q) == "number" and type(unit) == "number") end
CAH.PostItem = function() end
CAH.ConfirmPostCommodity = function() end
CAH.ConfirmPostItem = function() end
CAH.ConfirmCommoditiesPurchase = function(id, q) assert(type(id) == "number") end
CAH.PlaceBid = function(id, amount) end
CAH.CancelAuction = function(id) end
CAH.CalculateCommodityDeposit = function(id, d, q) return 30 * q end
CAH.CalculateItemDeposit = function() return 500 end
CAH.GetCancelCost = function(id) return 2500 end
CAH.GetOwnedAuctions = function() return { { auctionID = 77, itemLink = link(4306), quantity = 4, buyoutAmount = 18000, status = 0 } } end
CAH.GetAuctionInfoByID = function(id) return { itemLink = link(2318), buyoutAmount = 9000, bidAmount = 4000 } end
-- Post
G.TakeInboxMoney = function(i) end
G.SendMail = function() end
G.GetSendMailPrice = function() return 30 end
G.GetSendMailMoney = function() return 0 end
W.mails = {
  { subject = "Auktion erfolgreich: Leinenstoff", money = 22900, invoice = { "seller", "Leinenstoff", "Jaina", 24000, 20 } },
  { subject = "Hallo", money = 0 },
}
local origInv = G.GetInboxInvoiceInfo
G.GetInboxInvoiceInfo = function(i)
  local a, b, c, d, e = origInv(i)
  if not a then return nil end
  return a, b, c, d, e, 600, 1700, 0, 0, 0, W.mails[i].invoice[5]   -- Kaution 6s, Gebuehr 17s
end
G.GetMerchantItemLink = function(i) return link(2589) end
G.C_MerchantFrame.GetItemInfo = function(i) return { price = 1000, stackCount = 5, hasExtendedCost = false } end
W.repairCost = 4520

----------------------------------------------------------------------------
-- Laden (TOC-Reihenfolge, gemeinsamer Namensraum wie im Spiel)
----------------------------------------------------------------------------
local ns = {}
for line in io.lines(ROOT .. "ChatWerk.toc") do
  if not line:match("^##") and line:match("%S") then
    local f = ROOT .. line:gsub("\\", "/"):gsub("%s+$", "")
    assert(loadfile(f))("ChatWerk", ns)
  end
end
local okLoad, errLoad = pcall(function()
  W.fire("ADDON_LOADED", "ChatWerk")
  -- schon vor dem Login: Ausgabe eines anderen Add-ons -> wird gesammelt
  ChatFrame1:AddMessage("|cff00ccffFrueh|r: geladen")
  W.fire("PLAYER_LOGIN")
  W.flush()
end)
ok(okLoad, "Laden/Login: " .. tostring(errLoad))

local DB = ChatWerkDB
local main, trade = ns.Windows[DB.windows[1].id], ns.Windows[DB.windows[2].id]
ok(main and trade, "zwei Startfenster")
ok(main.msg:GetObjectType() == "ScrollingMessageFrame", "Fenster nutzt ScrollingMessageFrame")

local function texts(w) local t = {} for _, m in ipairs(w.msg.__msgs) do t[#t + 1] = m[1] end return t end
local function count(w) return #w.msg.__msgs end
local function last(w) local m = w.msg.__msgs[#w.msg.__msgs] return m and m[1] end
local function plain(s) return type(s) == "string" and W.strip(s):gsub("|H.-|h", ""):gsub("|h", "") or "" end
local function has(w, pat) for _, s in ipairs(texts(w)) do if type(s) == "string" and plain(s):find(pat) then return true, s end end return false end

ok(has(main, "Frueh"), "Add-on-Ausgabe vor dem Login landet nach dem Login im Chat")
ok(has(main, "Version 1%.0%.0 geladen"), "Begruessung im Chatfenster")

-- Blizzard-Chat weg, Eingabezeile unter Fenster 1
ok(ChatFrame1:GetParent() == ns.Blizzard.hider and ChatFrame2Tab:GetParent() == ns.Blizzard.hider, "Blizzard-Chat ausgeblendet")
ok(ChatFrame1EditBox:GetParent() == UIParent, "Eingabezeile aus dem Blizzard-Chat geloest")
local p1, rel = ChatFrame1EditBox:GetPoint(1)
ok(rel == main.frame, "Eingabezeile haengt unter dem Hauptfenster")

----------------------------------------------------------------------------
-- Gespraeche: Klassenfarben, Ziel-Fenster, Spam-Filter, Kanaele
----------------------------------------------------------------------------
W.now = W.now + 5
local nTrade = count(trade)
W.fire("CHAT_MSG_SAY", "Lok'tar! Wer kommt mit nach Orgrimmar?", "Thrall-Forever", "Orcisch", "", "", "", 0, 0, "", 0, 11, "Player-1-AAA")
local s = last(main)
ok(type(s) == "string" and s:find("|cff0070ddThrall|r", 1, true), "Sagen: Name in Klassenfarbe (Schamane)")
ok(s and s:find("|Hplayer:Thrall%-Forever:11:SAY"), "Sagen: Name anklickbar")
ok(count(trade) == nTrade, "Sagen erscheint NICHT im Handelsfenster")
local nMain = count(main)
W.fire("CHAT_MSG_SAY", "Lok'tar! Wer kommt mit nach Orgrimmar?", "Thrall-Forever", "Orcisch", "", "", "", 0, 0, "", 0, 12, "Player-1-AAA")
ok(count(main) == nMain, "Spam-Filter: gleiche Zeile innerhalb 60 s geschluckt")
W.fire("CHAT_MSG_CHANNEL", "VK [Seidenstoff] 2g das Stueck", "Jaina-Forever", "Orcisch", "2. Handel - Stadt", "", "", 2, 2, "Handel - Stadt", 0, 13, "Player-1-BBB")
ok(has(main, "%[2·H%] Jaina: VK"), "Kanal kurz [2·H] + Name")
ok(last(main):find("|Hchannel:channel:2|h", 1, true) ~= nil, "Kanal-Tag anklickbar")
ok(count(trade) == nTrade, "Handelskanal im Handelsfenster abgewaehlt")
ok(DB.channels["Handel - Stadt"] or DB.channels["Handel"], "Kanal in der Auswahlliste bekannt")
W.fire("CHAT_MSG_WHISPER", "Hey Tiry, kaufst du Stoff?", "Garrosh-Forever", "Orcisch", "", "", "", 0, 0, "", 0, 14, "Player-1-CCC")
ok(has(main, "Garrosh fluestert: Hey") and last(main):find("|cffffd24dTiry|r", 1, true), "Fluestern + eigener Name hervorgehoben")
W.fire("CHAT_MSG_GUILD", "schaut mal https://forever.example/guide", "Jaina-Forever", "Orcisch", "", "", "", 0, 0, "", 0, 15, "Player-1-BBB")
local okUrl, line = has(main, "%[G%] Jaina")
ok(okUrl and line:find("|Hcwurl:https://forever.example/guide|h", 1, true), "Gilde: Tag [G] + Link anklickbar")
-- Link-Klick -> Kopierfenster
W.call(main.msg, "OnHyperlinkClick", "cwurl:https://forever.example/guide", "[x]", "LeftButton")
ok(ChatWerkCopy and ChatWerkCopy:IsShown() and ChatWerkCopy.edit:GetText() == "https://forever.example/guide", "Link-Klick oeffnet Kopierfenster")
ChatWerkCopy:Hide()
W.call(main.msg, "OnHyperlinkClick", "player:Jaina-Forever:15:GUILD", "[Jaina]", "LeftButton")
ok(W.itemRef == "player:Jaina-Forever:15:GUILD", "Spieler-Link an Blizzard (SetItemRef) weitergereicht")

----------------------------------------------------------------------------
-- Chat-Lockdown: geheimer Text/Name -> nur durchreichen
----------------------------------------------------------------------------
local histBefore = #(ChatWerkCharDB.hist[main.data.id] or {})
local okS, errS = pcall(W.fire, "CHAT_MSG_GUILD", SECRET, SECRET, "Orcisch", "", "", "", 0, 0, "", 0, 16, SECRET)
ok(okS, "Geheimwerte: kein Fehler (" .. tostring(errS) .. ")")
ok(#ns.errors == 0 or not ns.errors[#ns.errors]:find("geheim"), "Geheimwerte: keine String-Operation darauf")
ok(rawequal(main.msg.__msgs[#main.msg.__msgs][1], SECRET), "Geheimer Gildentext erscheint trotzdem im Fenster")
ok(#(ChatWerkCharDB.hist[main.data.id] or {}) == histBefore, "Geheimer Text wird nicht gespeichert")
nTrade = count(trade)
W.fire("CHAT_MSG_SYSTEM", SECRET, "", "", "", "", "", 0, 0, "", 0, 17, nil)
ok(rawequal(last(main), SECRET) and count(trade) == nTrade, "Geheime Systemmeldung: nur Fenster mit Systemmeldungen")

----------------------------------------------------------------------------
-- Auktionshaus: Einstellen -> Verkauft -> Abrechnung -> Gold
----------------------------------------------------------------------------
W.fire("AUCTION_HOUSE_SHOW")
nMain = count(main)
C_AuctionHouse.PostCommodity({ id = 2589 }, 2, 20, 12000)
local okP, post = has(trade, "Eingestellt")
ok(okP and plain(post):find("x20") and plain(post):find("1g 20s") and plain(post):find("= 24g") and plain(post):find("24 Std")
  and plain(post):find("Kaution 6s") and plain(post):find("22g 80s"), "Einstellen: Menge, Stueckpreis, Summe, Dauer, Kaution, Erloes")
ok(count(main) == nMain, "AH-Zeilen nicht im Hauptchat")
money(-600)
local nT = count(trade)
W.fire("CHAT_MSG_SYSTEM", "Auktion erstellt.", "", "", "", "", "", 0, 0, "", 0, 18, nil)
W.flush()
ok(count(trade) == nT, "Blizzards 'Auktion erstellt.' + Kaution-Abbuchung ohne Doppelzeile")
C_AuctionHouse.PostItem({ id = 4306 }, 3, 1, 15000, 18000)
ok(has(trade, "Eingestellt %[Seidenstoff%] Sofortkauf 1g 80s · Gebot ab 1g 50s · 48 Std%. · Kaution 5s"), "Einstellen Einzel-Item: Sofortkauf, Gebot, Kaution")
W.now = W.now + 3600
W.fire("CHAT_MSG_SYSTEM", "Es wurde ein Käufer für Eure Auktion gefunden: Leinenstoff.", "", "", "", "", "", 0, 0, "", 0, 19, nil)
local okSold, sold = has(trade, "Verkauft %[Leinenstoff%]")
ok(okSold and plain(sold):find("Stueckpreis 1g 20s") and plain(sold):find("Gold kommt per Post"), "Verkauft: Item-Link + Stueckpreis aus deinem Angebot")
ok(not has(main, "Käufer"), "Verkauft-Meldung nicht im Hauptchat (eigene Kategorie)")
W.fire("CHAT_MSG_SYSTEM", "Eure Auktion von Seidenstoff ist abgelaufen.", "", "", "", "", "", 0, 0, "", 0, 20, nil)
ok(has(trade, "Abgelaufen %[Seidenstoff%] · Kaution verloren 5s"), "Abgelaufen + verlorene Kaution")
W.fire("CHAT_MSG_SYSTEM", "Ihr wurdet bei Leichtes Leder überboten.", "", "", "", "", "", 0, 0, "", 0, 21, nil)
ok(has(trade, "Ueberboten %[Leichtes Leder%]"), "Ueberboten mit Item-Link")
-- Kaufen (Stapelware)
W.fire("COMMODITY_PRICE_UPDATED", 150, 3000)
C_AuctionHouse.ConfirmCommoditiesPurchase(4306, 20)
W.fire("COMMODITY_PURCHASE_SUCCEEDED")
money(-3000)
W.flush()
ok(has(trade, "AH gekauft %[Seidenstoff%] x20 à 1s 50k = 30s$"), "Kauf Stapelware: Menge, Stueckpreis, Summe")
ok(not has(trade, "Auktionshaus: %-30s"), "Kauf-Abbuchung ohne Doppelzeile")
-- Bieten + Abbrechen
C_AuctionHouse.PlaceBid(55, 4000)
ok(has(trade, "Gebot abgegeben %[Leichtes Leder%]: 40s"), "Gebot mit Item + Betrag")
W.fire("OWNED_AUCTIONS_UPDATED")
C_AuctionHouse.CancelAuction(77)
ok(has(trade, "Abgebrochen %[Seidenstoff%] x4 · Sofortkauf war 1g 80s · Abbruchgebuehr 25s"), "Abbrechen: Item, Menge, Gebuehr")
W.fire("AUCTION_HOUSE_CLOSED")
W.flush()

-- Post: Abrechnung mit Kaeufer, Gebuehr, Kaution, Erloes - nur einmal
W.fire("MAIL_SHOW")
W.flush()
local okMail, mailLine = has(trade, "Auktion verkauft")
ok(okMail and plain(mailLine):find("%[Leinenstoff%] x20 an Jaina fuer 2g 40s") and plain(mailLine):find("Gebuehr 17s")
  and plain(mailLine):find("Kaution zurueck 6s") and plain(mailLine):find("Erloes 2g 29s"), "Post-Abrechnung komplett")
ok(mailLine and mailLine:find("|cff3fc7ebJaina|r", 1, true), "Kaeufer in Klassenfarbe")
nT = count(trade)
W.fire("MAIL_INBOX_UPDATE")
ok(count(trade) == nT, "Abrechnung nicht doppelt")
TakeInboxMoney(1)
money(22900)
W.flush()
ok(has(trade, "Auktionserloes: %+2g 29s · Auktion erfolgreich: Leinenstoff"), "Gold aus dem Brief mit Grund")
ok(count(trade) == nT + 1, "Briefgold: genau eine Zeile")
W.fire("MAIL_CLOSED")
W.flush()

-- Haendler
W.fire("MERCHANT_SHOW")
C_Container.UseContainerItem(0, 1)
money(165)
BuyMerchantItem(1, 10)
money(-2000)
RepairAllItems(false)
money(-4520)
W.fire("MERCHANT_CLOSED")
W.flush()
ok(has(trade, "Verkauft an Haendler: %[Wollstoff%] x5 = 1s 65k"), "Haendler-Verkauf mit Menge + Preis")
ok(has(trade, "Gekauft beim Haendler: %[Leinenstoff%] x10 = 20s"), "Haendler-Kauf")
ok(has(trade, "Reparatur: 45s 20k"), "Reparatur-Kosten")
ok(has(trade, "Haendler%-Bilanz: %-63s 55k %(3 Buchungen%)"), "Haendler-Bilanz beim Schliessen")
ok(not has(trade, " Haendler: [%+%-]"), "keine doppelten Geld-Zeilen beim Haendler")

-- Beute-Gold (CHAT_MSG_MONEY kommt nach PLAYER_MONEY) -> keine Extra-Zeile
nT = count(trade)
money(1234)
W.fire("CHAT_MSG_MONEY", "Ihr erbeutet 12 Silber, 34 Kupfer.", "", "", "", "", "", 0, 0, "", 0, 30, nil)
W.flush()
ok(count(trade) == nT + 1 and has(trade, "Ihr erbeutet 12 Silber"), "Beute-Gold: nur die Beute-Zeile")
-- unerklaerte Bewegung
money(-777)
W.flush()
ok(has(trade, " Gold: %-7s 77k  %(jetzt"), "Sonstige Goldbewegung mit neuem Stand")
-- Questlohn
money(5000)
W.fire("QUEST_TURNED_IN", 123, 1450, 5000)
W.flush()
ok(has(trade, "Quest abgegeben Die Kur des Schamanen  %+1450 EP  %+50s"), "Quest: Name, EP, Gold in einer Zeile")

-- Beute mit Wert
W.fire("CHAT_MSG_LOOT", "Ihr erhaltet Beute: " .. link(4306) .. "x3.", "Tiry", "", "", "", "", 0, 0, "", 0, 31, "Player-1-ME")
ok(has(trade, "Ihr erhaltet Beute: %[Seidenstoff%]x3%. %(Haendler 4s 50k%)"), "Eigene Beute mit Haendlerwert x Menge")
W.fire("CHAT_MSG_LOOT", "Jaina bekommt Beute: " .. link(2592) .. ".", "Jaina-Forever", "", "", "", "", 0, 0, "", 0, 32, "Player-1-BBB")
ok(not has(trade, "Jaina bekommt"), "Beute anderer standardmaessig aus")

----------------------------------------------------------------------------
-- Systemmeldungen fein sortiert, Freunde mit Klasse, Add-on-Ausgaben
----------------------------------------------------------------------------
W.fire("CHAT_MSG_SYSTEM", "|Hplayer:Jaina|h[Jaina]|h ist jetzt online.", "", "", "", "", "", 0, 0, "", 0, 33, nil)
ok(has(main, "Jaina ist online %(Stufe 34 Magier, Orgrimmar%)") and last(main):find("|cff3fc7eb", 1, true), "Freund online: Klasse, Stufe, Gebiet, Farbe")
W.fire("CHAT_MSG_SYSTEM", "Tiry würfelt. Ergebnis: 42 (1-100)", "", "", "", "", "", 0, 0, "", 0, 34, nil)
ok(has(main, "würfelt%. Ergebnis: 42"), "Wuerfeln im Hauptchat")
ChatFrame1:AddMessage("|cffff9900MeinAddon|r: Hallo")
ok(has(main, "MeinAddon: Hallo"), "print() eines Add-ons landet im Hauptchat")
nMain = count(main)
ChatFrame2:AddMessage("|cffff9900MeinAddon|r: Hallo")
ok(count(main) == nMain, "gleiche Add-on-Ausgabe in zwei Blizzard-Fenstern nur einmal")
ChatFrame1:AddMessage("Sonstige Systemzeile", 1, 1, 0, 1)
W.flush()
ok(has(main, "Sonstige Systemzeile"), "Systemzeile ohne Ereignis (von Blizzard-Lua) wird gezeigt")
W.fire("CHAT_MSG_SYSTEM", "Doppelt?", "", "", "", "", "", 0, 0, "", 0, 35, nil)
nMain = count(main)
ChatFrame1:AddMessage("Doppelt?", 1, 1, 0, 1)
W.flush()
ok(count(main) == nMain, "Systemzeile aus Ereignis + Blizzard-Ausgabe nur einmal")

----------------------------------------------------------------------------
-- Fenster: Groesse ziehen, Mausrad, neue Fenster, Kategorien umschalten
----------------------------------------------------------------------------
main.frame:SetSize(520, 260)
W.call(main.grip, "OnMouseUp")
ok(main.data.w == 520 and main.data.h == 260, "Groesse am Griff gespeichert")
for _ = 1, 4 do W.call(main.msg, "OnMouseWheel", 1) end
ok(main.msg:GetScrollOffset() > 0 and main.down:IsShown(), "Mausrad blaettert + 'nach unten'-Knopf")
W.call(main.down, "OnClick")
ok(main.msg:AtBottom() and not main.down:IsShown(), "'nach unten' springt ans Ende")
SlashCmdList.CHATWERK("neu")
ok(#DB.windows == 3 and ns.Windows[DB.windows[3].id], "/cw neu baut ein drittes Fenster")
local third = ns.Windows[DB.windows[3].id]
ok(ChatWerkConfig and ChatWerkConfig:IsShown(), "neues Fenster oeffnet seine Auswahlliste")
DB.windows[3].cats.ah_sold = true
W.fire("CHAT_MSG_SYSTEM", "Es wurde ein Käufer für Eure Auktion gefunden: Leinenstoff.", "", "", "", "", "", 0, 0, "", 0, 40, nil)
ok(has(third, "Verkauft %[Leinenstoff%]") and count(third) == 1, "eigenes Fenster zeigt NUR die angehakte Art")
-- Verlauf
ok(#ChatWerkCharDB.hist[trade.data.id] > 10, "Verlauf gespeichert")

----------------------------------------------------------------------------
-- Einstellungen: Layout + Suche + Schalter
----------------------------------------------------------------------------
local function check(name, root)
  local probs = L.problems(root)
  for _, p in ipairs(probs) do ok(false, "[" .. name .. "] " .. p) end
  if OUT then L.dump(root, OUT .. "/" .. name .. ".tsv", { levels = true }) end
end
check("cw_fenster", ChatWerkConfig)
local search = nil
local function find(o, pred)
  if pred(o) then return o end
  for _, c in ipairs(o.__children or {}) do local r = find(c, pred) if r then return r end end
end
local toggle = find(ChatWerkConfig, function(o) return o.label and o.label.__text == "AH: Verkauft (mit Preis)" and L.isShown(o) end)
ok(toggle ~= nil, "Auswahlliste enthaelt AH-Verkauft")
if toggle then
  W.call(toggle, "OnClick")
  ok(DB.windows[3].cats.ah_sold == nil, "Schalter schaltet die Art fuer dieses Fenster aus")
end
local sb = find(ChatWerkConfig, function(o) return o.__kind == "EditBox" and o.__parent and o.__parent.hint and L.isShown(o) end)
ok(sb ~= nil, "Suchfeld vorhanden")
if sb then
  sb:SetText("gilde")
  W.call(sb, "OnTextChanged")
  local shown, total = 0, 0
  find(ChatWerkConfig, function(o)
    if o.label and o.switch then total = total + 1 if L.isShown(o) then shown = shown + 1 end end
  end)
  ok(shown > 0 and shown < total / 4 and total > 40, "Suche filtert die Liste (" .. shown .. " von " .. total .. ")")
  sb:SetText("")
  W.call(sb, "OnTextChanged")
end
ns.Config.Show(DB.windows[2].id)
check("cw_handel", ChatWerkConfig)
ns.Config.Show("general")
check("cw_allgemein", ChatWerkConfig)
ChatWerkConfig:Hide()

-- /cw blizzard: alles zurueck
SlashCmdList.CHATWERK("blizzard")
ok(ChatFrame1:GetParent() == UIParent and ChatFrame1EditBox:GetParent() == ChatFrame1 or ChatFrame1:GetParent() == UIParent, "Blizzard-Chat zurueckgeholt")
SlashCmdList.CHATWERK("blizzard")

for _, e in ipairs(W.errors) do ok(false, "Fehler-Handler: " .. e) end
for _, e in ipairs(ns.errors) do ok(false, "ChatWerk-Fehler: " .. e:gsub("\n.*", "")) end

----------------------------------------------------------------------------
-- Vorschau: Chat-Zeilen als Textzeilen einzeichnen (Nachbau dessen, was ScrollingMessageFrame darstellt)
----------------------------------------------------------------------------
if OUT then
  ns.Windows[DB.windows[3].id].frame:Hide()
  local function show(w, n)
    local m = w.msg
    local r = L.rect(m)
    local width, y = r.r - r.l, 0
    local list = m.__msgs
    for i = #list, math.max(1, #list - n), -1 do
      local text = list[i][1]
      if rawequal(text, SECRET) then text = "|cff40ff40[Gilde] Jaina: (im Kampf geheim - wird trotzdem angezeigt)|r" end
      text = text:gsub("|H.-|h", ""):gsub("|h", "")
      local fs = m:CreateFontString(nil, "OVERLAY")
      fs:SetFont(ns.MEDIA .. "Fonts\\Poppins-Regular.ttf", w.data.font or 13, "")
      fs:SetWidth(width)
      fs:SetWordWrap(true)
      fs:SetJustifyH("LEFT")
      local c = list[i]
      fs:SetTextColor(c[2] or 1, c[3] or 1, c[4] or 1)
      fs:SetText(text)
      local h = fs:GetStringHeight()
      if y + h > (r.t - r.b) then fs:Hide() break end
      fs:SetPoint("BOTTOMLEFT", m, "BOTTOMLEFT", 0, y)
      y = y + h + 2
    end
  end
  show(main, 14)
  show(trade, 14)
  for _, w in pairs(ns.Windows) do w:Hover(w == trade) end
  ChatFrame1EditBox:Show()
  L.dump(UIParent, OUT .. "/cw_chat.tsv", { levels = true })
end

print(string.format("ChatWerk: %d Pruefungen, %d Fehler", checks, fails))
if fails > 0 then os.exit(1) end
print("CW TESTS OK")

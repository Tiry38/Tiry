-- ChatWerk: Auktionshaus + Gold immer genau. Jede Bewegung bekommt eine eigene Zeile mit Item, Menge,
-- Stueckpreis, Summe, Gebuehren und Gegenueber - statt Blizzards "Auktion erstellt." / "Ein Kaeufer wurde gefunden".
-- Quellen: Hooks auf die Spieler-Klicks (Einstellen, Kaufen, Bieten, Abbrechen, Haendler, Post) + Ereignisse.
-- Es wird nie selbst gekauft oder eingestellt.
local _, ns = ...
local AH = {}
ns.AH = AH

local MEDIA = ns.MEDIA
local function icon(name, c)
  c = c or { 57, 255, 107 }
  return string.format("|T%si_%s:14:14:0:-1:64:64:0:64:0:64:%d:%d:%d|t ", MEDIA, name, c[1], c[2], c[3])
end
AH.Icon = icon
local GREEN, RED, TEAL, GOLDC, GREY = { 57, 255, 107 }, { 255, 112, 128 }, { 38, 242, 217 }, { 255, 210, 77 }, { 160, 175, 170 }
local M = ns.Money
local function hi(s) return "|cfff2f7f4" .. s .. "|r" end
local function dim(s) return "|cff9fb3ad" .. s .. "|r" end

local DURATION = { [1] = "12 Std.", [2] = "24 Std.", [3] = "48 Std." }
local now = function() return GetTime() end

-- Item-Link aus Name (Systemmeldungen nennen nur den Namen)
local function linkFor(name)
  if type(name) ~= "string" or name == "" then return "?" end
  if name:find("|H", 1, true) then return name end
  if C_Item and C_Item.GetItemInfo then
    local ok, _, link = pcall(C_Item.GetItemInfo, name)
    if ok and type(link) == "string" then return link end
  end
  return "|cffffffff[" .. name .. "]|r"
end
AH.LinkFor = linkFor
local function nameOf(link)
  if type(link) ~= "string" then return nil end
  return link:match("|h%[(.-)%]|h") or link
end

----------------------------------------------------------------------------
-- Eingestellte Angebote merken (fuer "Verkauft"- und "Abgelaufen"-Zeilen)
----------------------------------------------------------------------------
local function remember(post)
  local list = ns.CDB.posts
  list[#list + 1] = post
  while #list > 80 do table.remove(list, 1) end
end
local function findPost(name)
  local list = ns.CDB.posts
  for i = #list, 1, -1 do
    if list[i].name == name then return list[i], i end
  end
end
AH.FindPost = findPost

local lastPost        -- Zeitpunkt der letzten eigenen Einstellen-Zeile (Blizzards "Auktion erstellt." schlucken)
local function posted(loc, duration, quantity, unit, bid, buyout, commodity)
  local link = C_Item.GetItemLink and C_Item.GetItemLink(loc)
  local id = C_Item.GetItemID and C_Item.GetItemID(loc)
  quantity = quantity or 1
  local deposit
  if commodity and id and C_AuctionHouse.CalculateCommodityDeposit then
    local ok, d = pcall(C_AuctionHouse.CalculateCommodityDeposit, id, duration, quantity)
    if ok then deposit = d end
  elseif C_AuctionHouse.CalculateItemDeposit then
    local ok, d = pcall(C_AuctionHouse.CalculateItemDeposit, loc, duration, quantity)
    if ok then deposit = d end
  end
  local total, line
  if commodity then
    total = (unit or 0) * quantity
    line = icon("receipt", GREEN) .. "|cff39ff6bEingestellt|r " .. (link or "?") .. hi(" x" .. quantity)
      .. " à " .. M(unit) .. " = " .. hi(M(total))
  else
    total = buyout or bid or 0
    line = icon("receipt", GREEN) .. "|cff39ff6bEingestellt|r " .. (link or "?") .. (quantity > 1 and hi(" x" .. quantity) or "")
    if buyout and buyout > 0 then line = line .. " Sofortkauf " .. hi(M(buyout)) end
    if bid and bid > 0 and bid ~= buyout then line = line .. dim(" · Gebot ab ") .. M(bid) end
    if quantity > 1 and buyout and buyout > 0 then line = line .. dim(" (je " ) .. M(buyout / quantity) .. dim(")") end
  end
  line = line .. dim(" · " .. (DURATION[duration] or "?"))
  if deposit then line = line .. dim(" · Kaution ") .. M(deposit) end
  local fee = math.floor(total * 0.05 + 0.5)
  if total > 0 then line = line .. dim(" · bei Verkauf nach 5 % Gebuehr: ") .. "|cff39ff6b" .. M(total - fee) .. "|r" end
  remember({ name = nameOf(link), link = link, id = id, qty = quantity, unit = commodity and unit or (total / quantity),
    total = total, deposit = deposit, dur = duration, t = time(), commodity = commodity })
  lastPost = now()
  AH.Reason("ah", "Kaution")
  ns.Emit("ah_posted", line, 1, 1, 1)
end

----------------------------------------------------------------------------
-- Kaufen / Bieten / Abbrechen
----------------------------------------------------------------------------
local quote = {}        -- letzte Preisauskunft fuer Stapelware
local pending           -- laufender Kauf
local owned = {}        -- auctionID -> eigenes Angebot (fuer Abbrechen)

local function purchaseLine(link, qty, unit, total, label)
  local line = icon("cart", TEAL) .. "|cff26f2d9" .. (label or "Gekauft") .. "|r " .. (link or "?")
  if qty and qty > 1 then line = line .. hi(" x" .. qty) end
  if unit and qty and qty > 1 then line = line .. " à " .. M(unit) end
  if total then line = line .. " = " .. hi(M(total)) end
  return line
end

local function ownedRefresh()
  if not C_AuctionHouse.GetOwnedAuctions then return end
  local ok, list = pcall(C_AuctionHouse.GetOwnedAuctions)
  if not ok or type(list) ~= "table" then return end
  for _, a in ipairs(list) do
    if a.auctionID then owned[a.auctionID] = a end
  end
end

----------------------------------------------------------------------------
-- Geldbewegungen: jede Aenderung von GetMoney bekommt einen Grund
----------------------------------------------------------------------------
local money
local reason            -- { cat, label, t, silent }
local ctx = {}          -- offene Fenster: merchant, mail, ah, trade, taxi, trainer
local session = {}      -- Haendler-Bilanz
function AH.Reason(cat, label, silent, ttl)
  local r = reason
  if r and r.cat == cat and now() - r.t <= r.ttl then
    r.n, r.t = r.n + 1, now()
    return
  end
  reason = { cat = cat, label = label, t = now(), silent = silent ~= false, ttl = ttl or 3, n = 1 }
end

local function context()
  if ctx.mail then return "gold_mail", "Briefkasten" end
  if ctx.merchant then return "vendor", "Haendler" end
  if ctx.trade then return "gold_trade", "Handel" .. (ctx.tradeName and (" mit " .. ctx.tradeName) or "") end
  if ctx.ah then return "gold_other", "Auktionshaus" end
  if ctx.taxi then return "gold_other", "Flugmeister" end
  if ctx.trainer then return "gold_other", "Lehrer" end
  if ctx.bank then return "gold_other", "Gildenbank" end
  return "gold_other", nil
end

-- Hat eine eigene Zeile diese Bewegung schon erklaert? (Grund verbrauchen)
local function consume()
  local r = reason
  if not r or now() - r.t > r.ttl + 1 then return nil end
  r.n = r.n - 1
  if r.n <= 0 then reason = nil end
  return r
end

local function report(diff, m)
  local r = consume()
  if r then
    if r.silent then return end
    ns.Emit(r.cat, icon("coins", diff > 0 and GREEN or RED) .. (r.label and (r.label .. ": ") or "") .. M(diff, true), 1, 1, 1)
    return
  end
  local cat, label = context()
  local line = icon("coins", diff > 0 and GREEN or RED) .. (label and (label .. ": ") or "Gold: ") .. M(diff, true)
    .. dim("  (jetzt ") .. M(m) .. dim(")")
  ns.Emit(cat, line, 1, 1, 1)
end

local function onMoney()
  local m = GetMoney()
  if not money then money = m return end
  local diff = m - money
  money = m
  if diff == 0 then return end
  if ctx.merchant then session.sum = (session.sum or 0) + diff session.n = (session.n or 0) + 1 end
  if reason and now() - reason.t <= reason.ttl then report(diff, m) return end
  -- Beute-Gold/Questlohn: die erklaerende Chatzeile kommt oft erst kurz NACH PLAYER_MONEY
  C_Timer.After(0.4, function() ns.Safe(report, diff, m) end)
end
AH.OnMoney = onMoney

----------------------------------------------------------------------------
-- Haendler
----------------------------------------------------------------------------
local repairCost = 0
local function itemCount(bag, slot)
  local info = C_Container.GetContainerItemInfo and C_Container.GetContainerItemInfo(bag, slot)
  if type(info) == "table" then return info.hyperlink, info.stackCount or 1, info.itemID end
end
local function sellPrice(link, id)
  if not C_Item or not C_Item.GetItemInfo then return 0 end
  local p = select(11, C_Item.GetItemInfo(id or link))
  return type(p) == "number" and p or 0
end

-- Taschen-Abbild beim Haendler: der Hook laeuft NACH dem Klick, das Item kann dann schon weg sein
local bagCache = {}
local function snapshot()
  bagCache = {}
  for bag = 0, (NUM_BAG_SLOTS or 4) do
    local n = C_Container.GetContainerNumSlots and C_Container.GetContainerNumSlots(bag) or 0
    for slot = 1, n do
      local link, count, id = itemCount(bag, slot)
      if link then bagCache[bag .. ":" .. slot] = { link, count, id } end
    end
  end
end
AH.Snapshot = snapshot

local function onUseItem(bag, slot)
  if not ctx.merchant then return end
  local link, count, id = itemCount(bag, slot)
  local c = bagCache[bag .. ":" .. slot]
  if not link and c then link, count, id = c[1], c[2], c[3] end
  bagCache[bag .. ":" .. slot] = nil
  if not link then return end
  local p = sellPrice(link, id) * count
  if p <= 0 then return end
  AH.Reason("vendor", nil, true)
  ns.Emit("vendor", icon("coins", GREEN) .. "|cff39ff6bVerkauft|r an Haendler: " .. link .. (count > 1 and hi(" x" .. count) or "")
    .. " = " .. hi(M(p)), 1, 1, 1)
end

local function onBuyMerchant(index, qty)
  local link = GetMerchantItemLink and GetMerchantItemLink(index)
  local info = C_MerchantFrame and C_MerchantFrame.GetItemInfo and C_MerchantFrame.GetItemInfo(index)
  if not link or type(info) ~= "table" then return end
  qty = qty or 1
  local stack = (info.stackCount and info.stackCount > 0) and info.stackCount or 1
  local cost = (info.price or 0) * qty / stack
  AH.Reason("vendor", nil, true)
  local line = icon("cart", TEAL) .. "|cff26f2d9Gekauft|r beim Haendler: " .. link .. (qty > 1 and hi(" x" .. qty) or "")
  if cost > 0 then line = line .. " = " .. hi(M(cost)) end
  if info.hasExtendedCost then line = line .. dim(" (+ Waehrung/Items)") end
  ns.Emit("vendor", line, 1, 1, 1)
end

local function onRepair(guild)
  if (repairCost or 0) <= 0 then return end
  AH.Reason("vendor", nil, true)
  ns.Emit("vendor", icon("gear", GOLDC) .. "|cffffd24dReparatur|r: " .. hi(M(repairCost)) .. (guild and dim(" (aus der Gildenbank)") or ""), 1, 1, 1)
  repairCost = 0
end

----------------------------------------------------------------------------
-- Post: Abrechnungen (Kaeufer, Preis, Gebuehr, Erloes) + Geld aus Briefen
----------------------------------------------------------------------------
local function invoiceText(i)
  local ok, kind, item, player, bid, buyout, deposit, consignment, delay, etaH, etaM, count =
    pcall(GetInboxInvoiceInfo, i)
  if not ok or not kind then return nil end
  local link = linkFor(item)
  count = count or 1
  local who = player and player ~= "" and (" an " .. ns.NameLink(player)) or ""
  if kind == "seller" then
    local got = (bid or 0) + (deposit or 0) - (consignment or 0)
    return "ah_mail", icon("coins", GREEN) .. "|cff39ff6bAuktion verkauft|r " .. link .. (count > 1 and hi(" x" .. count) or "")
      .. who .. " fuer " .. hi(M(bid)) .. (count > 1 and dim(" (je ") .. M((bid or 0) / count) .. dim(")") or "")
      .. dim(" · Gebuehr ") .. M(consignment or 0) .. dim(" · Kaution zurueck ") .. M(deposit or 0)
      .. dim(" · ") .. "|cff39ff6bErloes " .. M(got) .. "|r", got
  elseif kind == "seller_temp_invoice" then
    return "ah_sold", icon("coins", GOLDC) .. "|cffffd24dVerkauft|r " .. link .. (count > 1 and hi(" x" .. count) or "") .. who
      .. " fuer " .. hi(M(bid)) .. dim(string.format(" · Gold kommt um %02d:%02d", etaH or 0, etaM or 0))
  elseif kind == "buyer" then
    local from = player and player ~= "" and (" von " .. ns.NameLink(player)) or ""
    return "ah_mail", icon("cart", TEAL) .. "|cff26f2d9Auktion gekauft|r " .. link .. (count > 1 and hi(" x" .. count) or "") .. from
      .. " fuer " .. hi(M(bid)) .. ((buyout and bid and buyout == bid) and dim(" (Sofortkauf)") or dim(" (Gebot)"))
  end
end
AH.InvoiceText = invoiceText

local function mailKey(i)
  local _, _, sender, subject, m, cod, days = GetInboxHeaderInfo(i)
  if not sender and not subject then return nil end
  return table.concat({ tostring(sender), tostring(subject), tostring(m), tostring(cod),
    tostring(math.floor((time() + (days or 0) * 86400) / 3600)) }, "\001"), sender, subject, m
end

-- Briefkasten geoeffnet: neue AH-Abrechnungen einmal melden (auch ohne Geld zu nehmen)
local function scanInbox()
  local n = GetInboxNumItems and GetInboxNumItems() or 0
  local seen = ns.CDB.mailSeen or {}
  ns.CDB.mailSeen = seen
  local t = time()
  for k, v in pairs(seen) do if t - v > 32 * 86400 then seen[k] = nil end end
  local sum, cnt = 0, 0
  for i = 1, n do
    local key = mailKey(i)
    if key and not seen[key] then
      seen[key] = t
      local cat, line, got = invoiceText(i)
      if line then
        ns.Emit(cat, line, 1, 1, 1)
        if got then sum, cnt = sum + got, cnt + 1 end
      end
    end
  end
  if cnt > 1 then
    ns.Emit("ah_mail", icon("receipt", GREEN) .. hi(cnt .. " Auktionen verkauft") .. dim(" · zusammen ") .. "|cff39ff6b" .. M(sum) .. "|r", 1, 1, 1)
  end
end
AH.ScanInbox = scanInbox

local function onTakeMoney(i)
  local _, sender, subject, m = mailKey(i)
  if not m or m <= 0 then return end
  local cat, line = invoiceText(i)
  local label = (cat == "ah_mail" and line and line:find("verkauft", 1, true)) and "Auktionserloes" or
    ("Brief" .. (sender and (" von " .. tostring(sender)) or ""))
  AH.Reason("gold_mail", nil, true)
  ns.Emit("gold_mail", icon("coins", GREEN) .. label .. ": " .. M(m, true)
    .. ((subject and subject ~= "") and dim(" · " .. subject) or ""), 1, 1, 1)
end

local function onSendMail(to, subject)
  local cost = GetSendMailPrice and GetSendMailPrice() or 0
  local gold = GetSendMailMoney and GetSendMailMoney() or 0
  AH.Reason("gold_mail", nil, true)
  local line = icon("receipt", TEAL) .. "Brief an " .. hi(tostring(to))
  if gold > 0 then line = line .. dim(" · Gold ") .. "|cffff7080-" .. M(gold) .. "|r" end
  line = line .. dim(" · Porto ") .. M(cost)
  ns.Emit("gold_mail", line, 1, 1, 1)
end

----------------------------------------------------------------------------
-- Systemmeldungen des AH ersetzen / anreichern (aufgerufen aus Core.OnChat)
-- Rueckgabe: neuer Text, false = Meldung schlucken, nil = unveraendert
----------------------------------------------------------------------------
function AH.System(cat, gname, text, a)
  if not gname then return nil end
  if gname == "ERR_AUCTION_STARTED" then
    if lastPost and now() - lastPost < 5 then return false end
    return icon("receipt", GREEN) .. "|cff39ff6bAuktion erstellt|r"
  elseif gname == "ERR_AUCTION_BID_PLACED" then
    if pending and now() - pending.t < 8 then return false end
    return icon("cart", TEAL) .. "Gebot angenommen"
  elseif gname == "ERR_AUCTION_SOLD_S" then
    local post = findPost(a)
    local line = icon("coins", GOLDC) .. "|cffffd24dVerkauft|r " .. (post and post.link or linkFor(a))
    if post then
      if post.commodity then
        line = line .. dim(" · Stueckpreis ") .. hi(M(post.unit)) .. dim(" (dein Angebot x" .. post.qty .. ")")
      else
        line = line .. dim(" fuer ") .. hi(M(post.total)) .. (post.qty > 1 and dim(" (x" .. post.qty .. ")") or "")
        line = line .. dim(" · Erloes ") .. "|cff39ff6b" .. M(post.total - math.floor(post.total * 0.05 + 0.5)) .. "|r"
      end
    end
    return line .. dim(" · Gold kommt per Post")
  elseif gname == "ERR_AUCTION_WON_S" then
    local line = icon("star", TEAL) .. "|cff26f2d9Auktion gewonnen|r " .. linkFor(a)
    if pending and pending.amount and now() - pending.t < 172800 then line = line .. dim(" fuer ") .. hi(M(pending.amount)) end
    return line .. dim(" · kommt per Post")
  elseif gname == "ERR_AUCTION_OUTBID_S" then
    return icon("warn", RED) .. "|cffff7080Ueberboten|r " .. linkFor(a)
  elseif gname == "ERR_AUCTION_EXPIRED_S" then
    local post = findPost(a)
    local line = icon("warn", GREY) .. "|cff9fb3adAbgelaufen|r " .. (post and post.link or linkFor(a))
    if post and post.deposit then line = line .. dim(" · Kaution verloren ") .. "|cffff7080" .. M(post.deposit) .. "|r" end
    return line .. dim(" · Ware kommt per Post zurueck")
  elseif gname == "ERR_AUCTION_REMOVED_S" then
    -- Du hattest geboten, der Verkaeufer hat abgebrochen
    return icon("close", GREY) .. "|cff9fb3adVom Verkaeufer abgebrochen|r " .. linkFor(a) .. dim(" · dein Gebot kommt per Post zurueck")
  elseif gname == "ERR_AUCTION_REMOVED" then
    if AH.lastCancel and now() - AH.lastCancel < 5 then return false end
    return icon("close", GREY) .. "Auktion abgebrochen"
  end
end

----------------------------------------------------------------------------
-- Ereignisse + Hooks
----------------------------------------------------------------------------
local EVENTS = {
  "PLAYER_MONEY", "MERCHANT_SHOW", "MERCHANT_CLOSED", "MAIL_SHOW", "MAIL_CLOSED", "MAIL_INBOX_UPDATE",
  "AUCTION_HOUSE_SHOW", "AUCTION_HOUSE_CLOSED", "OWNED_AUCTIONS_UPDATED", "COMMODITY_PRICE_UPDATED",
  "COMMODITY_PURCHASE_SUCCEEDED", "COMMODITY_PURCHASE_FAILED", "ITEM_PURCHASED", "AUCTION_CANCELED",
  "TRADE_SHOW", "TRADE_CLOSED", "TAXIMAP_OPENED", "TAXIMAP_CLOSED", "TRAINER_SHOW", "TRAINER_CLOSED",
  "QUEST_TURNED_IN", "UPDATE_INVENTORY_DURABILITY", "GUILDBANKFRAME_OPENED", "GUILDBANKFRAME_CLOSED",
  "CHAT_MSG_MONEY", "BAG_UPDATE_DELAYED",
}
AH.EVENTS = EVENTS

local function closeLater(key)
  C_Timer.After(2, function() ctx[key] = nil end)
end

local handlers = {
  PLAYER_MONEY = onMoney,
  MERCHANT_SHOW = function()
    ctx.merchant = true
    session = {}
    repairCost = (GetRepairAllCost and GetRepairAllCost()) or 0
    snapshot()
  end,
  BAG_UPDATE_DELAYED = function() if ctx.merchant then snapshot() end end,
  UPDATE_INVENTORY_DURABILITY = function()
    if ctx.merchant and GetRepairAllCost then repairCost = GetRepairAllCost() or 0 end
  end,
  MERCHANT_CLOSED = function()
    if ctx.merchant and (session.n or 0) > 1 and (session.sum or 0) ~= 0 then
      ns.Emit("vendor", icon("coins", session.sum > 0 and GREEN or RED) .. hi("Haendler-Bilanz") .. ": " .. M(session.sum, true)
        .. dim(" (" .. session.n .. " Buchungen)"), 1, 1, 1)
    end
    session = {}
    ctx.merchant = nil
  end,
  MAIL_SHOW = function() ctx.mail = true C_Timer.After(0.5, function() ns.Safe(scanInbox) end) end,
  MAIL_INBOX_UPDATE = function() if ctx.mail then ns.Safe(scanInbox) end end,
  MAIL_CLOSED = function() closeLater("mail") end,
  AUCTION_HOUSE_SHOW = function() ctx.ah = true end,
  AUCTION_HOUSE_CLOSED = function() closeLater("ah") end,
  OWNED_AUCTIONS_UPDATED = ownedRefresh,
  COMMODITY_PRICE_UPDATED = function(unit, total) quote.unit, quote.total, quote.t = unit, total, now() end,
  COMMODITY_PURCHASE_SUCCEEDED = function()
    local p = pending
    if not p or not p.commodity then return end
    pending = nil
    AH.Reason("ah", nil, true)
    ns.Emit("ah_bought", purchaseLine(p.link, p.qty, p.unit, p.total, "AH gekauft"), 1, 1, 1)
  end,
  COMMODITY_PURCHASE_FAILED = function()
    local p = pending
    pending = nil
    ns.Emit("ah_bought", icon("warn", RED) .. "|cffff7080Kauf fehlgeschlagen|r " .. ((p and p.link) or "") .. dim(" - kein Gold abgebucht"), 1, 1, 1)
  end,
  ITEM_PURCHASED = function(itemID)
    local p = pending
    if not p or p.commodity then return end
    pending = nil
    AH.Reason("ah", nil, true)
    local link = p.link or (itemID and select(2, C_Item.GetItemInfo(itemID)))
    ns.Emit("ah_bought", purchaseLine(link, p.qty, nil, p.amount, p.isBid and "AH Gebot/Kauf" or "AH gekauft"), 1, 1, 1)
  end,
  AUCTION_CANCELED = function(id) owned[id] = nil end,
  TRADE_SHOW = function()
    ctx.trade = true
    local n = UnitName and UnitName("npc")
    ctx.tradeName = n and ns.NameLink(n, UnitGUID and UnitGUID("npc")) or nil
  end,
  TRADE_CLOSED = function() closeLater("trade") end,
  TAXIMAP_OPENED = function() ctx.taxi = true end,
  TAXIMAP_CLOSED = function() closeLater("taxi") end,
  TRAINER_SHOW = function() ctx.trainer = true end,
  TRAINER_CLOSED = function() closeLater("trainer") end,
  GUILDBANKFRAME_OPENED = function() ctx.bank = true end,
  GUILDBANKFRAME_CLOSED = function() closeLater("bank") end,
  CHAT_MSG_MONEY = function() AH.Reason("money", nil, true, 2) end,
  QUEST_TURNED_IN = function(questID, xp, gold)
    local title = C_QuestLog and C_QuestLog.GetTitleForQuestID and C_QuestLog.GetTitleForQuestID(questID)
    local parts = {}
    if xp and xp > 0 then parts[#parts + 1] = "|cffb48cff+" .. (BreakUpLargeNumbers and BreakUpLargeNumbers(xp) or xp) .. " EP|r" end
    if gold and gold > 0 then parts[#parts + 1] = M(gold, true) AH.Reason("quest", nil, true) end
    ns.Emit("quest", icon("check", GREEN) .. "|cff39ff6bQuest abgegeben|r " .. hi(title or ("#" .. tostring(questID)))
      .. (#parts > 0 and ("  " .. table.concat(parts, "  ")) or ""), 1, 1, 1)
  end,
}
AH.handlers = handlers

local function hook(tbl, name, fn)
  if type(tbl) == "table" and type(tbl[name]) == "function" then
    hooksecurefunc(tbl, name, function(...) ns.Safe(fn, ...) end)
    return true
  end
end

function AH.Init()
  if AH.inited then return end
  AH.inited = true
  money = GetMoney()
  local CAH = C_AuctionHouse
  if CAH then
    hook(CAH, "PostCommodity", function(loc, d, q, unit) posted(loc, d, q, unit, nil, nil, true) end)
    hook(CAH, "ConfirmPostCommodity", function(loc, d, q, unit) posted(loc, d, q, unit, nil, nil, true) end)
    hook(CAH, "PostItem", function(loc, d, q, bid, buyout) posted(loc, d, q, nil, bid, buyout, false) end)
    hook(CAH, "ConfirmPostItem", function(loc, d, q, bid, buyout) posted(loc, d, q, nil, bid, buyout, false) end)
    hook(CAH, "ConfirmCommoditiesPurchase", function(itemID, qty)
      local link = itemID and select(2, C_Item.GetItemInfo(itemID))
      local fresh = quote.t and now() - quote.t < 120
      pending = { commodity = true, link = link, qty = qty, unit = fresh and quote.unit or nil,
        total = fresh and quote.total or nil, t = now() }
    end)
    hook(CAH, "PlaceBid", function(auctionID, amount)
      local link
      if CAH.GetAuctionInfoByID then
        local ok, info = pcall(CAH.GetAuctionInfoByID, auctionID)
        if ok and type(info) == "table" then link = info.itemLink end
      end
      pending = { commodity = false, link = link, amount = amount, t = now(), id = auctionID }
      local buy
      if CAH.GetAuctionInfoByID then
        local ok, info = pcall(CAH.GetAuctionInfoByID, auctionID)
        if ok and type(info) == "table" and info.buyoutAmount then buy = info.buyoutAmount == amount end
      end
      pending.isBid = buy == false
      if buy == false then
        AH.Reason("ah", nil, true)
        ns.Emit("ah_bought", icon("cart", TEAL) .. "|cff26f2d9Gebot abgegeben|r " .. (link or "") .. ": " .. hi(M(amount)), 1, 1, 1)
      end
    end)
    hook(CAH, "CancelAuction", function(id)
      local a = owned[id]
      local cost
      if CAH.GetCancelCost then
        local ok, c = pcall(CAH.GetCancelCost, id)
        if ok then cost = c end
      end
      AH.lastCancel = now()
      AH.Reason("ah", nil, true)
      local line = icon("close", GREY) .. "|cff9fb3adAbgebrochen|r " .. ((a and a.itemLink) or "Auktion")
      if a and a.quantity and a.quantity > 1 then line = line .. hi(" x" .. a.quantity) end
      if a and a.buyoutAmount then line = line .. dim(" · Sofortkauf war ") .. M(a.buyoutAmount) end
      if cost and cost > 0 then line = line .. dim(" · Abbruchgebuehr ") .. "|cffff7080" .. M(cost) .. "|r" end
      ns.Emit("ah_cancel", line, 1, 1, 1)
    end)
  end
  hook(C_Container, "UseContainerItem", onUseItem)
  hook(_G, "BuyMerchantItem", onBuyMerchant)
  hook(_G, "RepairAllItems", onRepair)
  hook(_G, "TakeInboxMoney", onTakeMoney)
  hook(_G, "SendMail", onSendMail)
  for _, ev in ipairs(EVENTS) do if not ns.EV[ev] then pcall(ns.EventFrame.RegisterEvent, ns.EventFrame, ev) end end
end

function AH.OnEvent(event, ...)
  local h = handlers[event]
  if h then h(...) return true end
end

-- Tiry's Zentrale – Schnäppchen-Radar (Deal-Finder) + Post-Bilanz + Warnung vor ablaufender Post
-- Radar: liest JEDE AH-Suche mit (auch Auctionator-Suchen) und meldet Angebote deutlich unter deinem Marktwert.
local ADDON, ns = ...

local D = {}
ns.Deals = D
D.found = {} -- [itemID] = { id, price, qty, ref, save, time }

D.THRESHOLD = 0.65 -- höchstens 65 % vom Marktwert = Schnäppchen

local function reference(itemID)
  local PS = ns.PriceString
  local hist = ns.db and ns.db.priceHistory and ns.db.priceHistory[itemID]
  local days = 0
  if hist then for _ in pairs(hist) do days = days + 1 end end
  if days < 2 then return nil end -- erst nach 2 Scan-Tagen ist der Marktwert belastbar
  return PS.Market(itemID)
end

-- Bewertet eine Liste von Angeboten { price, qty, own } für ein Item
function D.Evaluate(itemID, offers)
  if not (ns.settings and ns.settings.dealRadar ~= false) then return nil end
  local ref = reference(itemID)
  if not ref or ref <= 0 then return nil end
  local rate, n = ns.Ledger.SaleRate(itemID)
  if rate and n >= 4 and rate < 0.3 then return nil end -- Ladenhüter sind keine Schnäppchen
  local limit = ref * D.THRESHOLD
  local qty, cost, best = 0, 0, nil
  for _, o in ipairs(offers) do
    if not o.own and o.price and o.price <= limit then
      qty = qty + o.qty
      cost = cost + o.price * o.qty
      best = best and math.min(best, o.price) or o.price
    end
  end
  if qty == 0 then D.found[itemID] = nil return nil end
  local deal = { id = itemID, price = best, avg = cost / qty, qty = qty, ref = ref, save = ref * qty - cost, time = time() }
  local old = D.found[itemID]
  D.found[itemID] = deal
  if not old or old.qty ~= deal.qty or old.price ~= deal.price then
    local item = ns.Item(itemID)
    ns.Print(string.format("|cffff9929Schnäppchen:|r %d× %s ab %s (Marktwert %s) – du sparst ca. %s.",
      qty, item.link or item.name, ns.Money(best), ns.Money(ref), ns.Money(deal.save)))
    if PlaySound and SOUNDKIT and SOUNDKIT.AUCTION_WINDOW_OPEN then pcall(PlaySound, SOUNDKIT.AUCTION_WINDOW_OPEN) end
    ns.Fire("DEALS_CHANGED")
  end
  return deal
end

ns.On("COMMODITY_SEARCH_RESULTS_UPDATED", function(_, itemID)
  if not (itemID and C_AuctionHouse and C_AuctionHouse.GetNumCommoditySearchResults) then return end
  local offers = {}
  for i = 1, math.min(C_AuctionHouse.GetNumCommoditySearchResults(itemID) or 0, 60) do
    local r = C_AuctionHouse.GetCommoditySearchResultInfo(itemID, i)
    if r then offers[#offers + 1] = { price = r.unitPrice, qty = r.quantity or 1, own = r.containsOwnerItem } end
  end
  D.Evaluate(itemID, offers)
end)

ns.On("ITEM_SEARCH_RESULTS_UPDATED", function(_, itemKey)
  if not (itemKey and itemKey.itemID and C_AuctionHouse and C_AuctionHouse.GetNumItemSearchResults) then return end
  local offers = {}
  for i = 1, math.min(C_AuctionHouse.GetNumItemSearchResults(itemKey) or 0, 60) do
    local r = C_AuctionHouse.GetItemSearchResultInfo(itemKey, i)
    if r and r.buyoutAmount then offers[#offers + 1] = { price = r.buyoutAmount, qty = r.quantity or 1, own = r.containsOwnerItem } end
  end
  D.Evaluate(itemKey.itemID, offers)
end)

function D.List()
  local list = {}
  for _, d in pairs(D.found) do list[#list + 1] = d end
  table.sort(list, function(a, b) return a.save > b.save end)
  return list
end

----------------------------------------------------------------------------
-- Post-Bilanz: wie viel Gold kam aus dem Briefkasten?
----------------------------------------------------------------------------
local mailMoney, mailSales
ns.On("MAIL_SHOW", function()
  mailMoney = GetMoney()
  mailSales = ns.Ledger.Totals(1).sold
end)
ns.On("MAIL_CLOSED", function()
  if not mailMoney then return end
  local gained = GetMoney() - mailMoney
  local sold = ns.Ledger.Totals(1).sold - (mailSales or 0)
  mailMoney = nil
  if gained > 0 then
    ns.Print(string.format("Post-Bilanz: |cffff9929+%s|r%s. Details im Verkaufsbuch (/tz buch).", ns.Money(gained),
      sold > 0 and string.format(" (%d neue Verkäufe)", sold) or ""))
  end
end)

-- Ablaufende Post merken und beim Einloggen warnen
ns.On("MAIL_INBOX_UPDATE", function()
  if not (GetInboxNumItems and GetInboxHeaderInfo) then return end
  local soonest
  for i = 1, GetInboxNumItems() or 0 do
    local _, _, _, _, money, _, daysLeft, itemCount = GetInboxHeaderInfo(i)
    if daysLeft and ((money or 0) > 0 or (itemCount or 0) > 0) then
      soonest = soonest and math.min(soonest, daysLeft) or daysLeft
    end
  end
  ns.char.mailExpires = soonest and (time() + soonest * 86400) or nil
end)

ns.Listen("LOGIN", function()
  C_Timer.After(10, function()
    local t = ns.char and ns.char.mailExpires
    if t and t - time() < 3 * 86400 then
      local days = math.max(0, math.floor((t - time()) / 86400 + 0.5))
      ns.Print(string.format("|cffff6b81Achtung:|r Post mit Gold oder Items läuft in %d %s ab – hol sie im Briefkasten ab!", days, days == 1 and "Tag" or "Tagen"))
    end
  end)
end)

-- Tiry's Zentrale – Preisalarm: Item unter deinem Wunschpreis -> Hinweis im Chat (+ Ton, Zahl im Menü).
-- Geprüft wird nach jedem Auctionator-Scan (letzter gesehener Preis) und bei jeder AH-Suche (echte Angebote).
local _, ns = ...

local A = {}
ns.Alerts = A
local M = ns.Market

local function store()
  ns.db.alerts = ns.db.alerts or {}
  return ns.db.alerts -- [itemID] = { price = Kupfer, hit = Preis beim letzten Treffer, hitTime = time() }
end

function A.Set(itemID, price)
  if not (itemID and price and price > 0) then return false end
  store()[itemID] = { price = math.floor(price) }
  ns.Fire("ALERTS_CHANGED")
  return true
end

function A.Remove(itemID)
  store()[itemID] = nil
  ns.Fire("ALERTS_CHANGED")
end

function A.List()
  local list = {}
  for id, a in pairs(store()) do
    list[#list + 1] = { id = id, price = a.price, hit = a.hit, hitTime = a.hitTime, now = M.Price(id) }
  end
  table.sort(list, function(a, b)
    local ha, hb = a.now and a.now <= a.price, b.now and b.now <= b.price
    if ha ~= hb then return ha and true or false end
    return ns.Item(a.id).name < ns.Item(b.id).name
  end)
  return list
end

-- Wie viele Alarme stehen gerade unter dem Wunschpreis?
function A.ActiveCount()
  local n = 0
  for id, a in pairs(store()) do
    local p = M.Price(id)
    if p and p <= a.price then n = n + 1 end
  end
  return n
end

local function notify(id, price, source)
  local a = store()[id]
  if not a or price > a.price then return end
  -- nicht ständig melden: nur bei neuem, niedrigerem Preis oder nach 6 Stunden
  if a.hit and price >= a.hit and a.hitTime and time() - a.hitTime < 6 * 3600 then return end
  a.hit, a.hitTime = price, time()
  local item = ns.Item(id)
  ns.Print(string.format("|cffff9929Preisalarm:|r %s für %s (dein Wunschpreis: %s)%s", item.link or item.name, ns.Money(price),
    ns.Money(a.price), source and (" – " .. source) or ""))
  if PlaySound and SOUNDKIT and SOUNDKIT.AUCTION_WINDOW_OPEN then pcall(PlaySound, SOUNDKIT.AUCTION_WINDOW_OPEN) end
  ns.Fire("ALERTS_CHANGED")
end

-- Nach einem Scan: letzter Preis aus Auctionator
ns.Listen("PRICES_UPDATED", function()
  for id in pairs(store()) do
    local p = M.Price(id)
    if p then notify(id, p, "laut letztem Scan") end
  end
  ns.Fire("ALERTS_CHANGED")
end)

-- Bei einer AH-Suche: echte Angebote (fremde, nicht eigene)
local function cheapest(n, getInfo, field)
  local best
  for i = 1, math.min(n or 0, 60) do
    local r = getInfo(i)
    local p = r and r[field]
    -- buyoutAmount gilt für die ganze Auktion -> Stückpreis
    if p and field == "buyoutAmount" then p = math.floor(p / math.max(r.quantity or 1, 1)) end
    if p and not r.containsOwnerItem and (not best or p < best) then best = p end
  end
  return best
end

ns.On("COMMODITY_SEARCH_RESULTS_UPDATED", function(_, itemID)
  if not (itemID and store()[itemID] and C_AuctionHouse and C_AuctionHouse.GetNumCommoditySearchResults) then return end
  local best = cheapest(C_AuctionHouse.GetNumCommoditySearchResults(itemID),
    function(i) return C_AuctionHouse.GetCommoditySearchResultInfo(itemID, i) end, "unitPrice")
  if best then notify(itemID, best, "jetzt im AH") end
end)

ns.On("ITEM_SEARCH_RESULTS_UPDATED", function(_, itemKey)
  local id = itemKey and itemKey.itemID
  if not (id and store()[id] and C_AuctionHouse and C_AuctionHouse.GetNumItemSearchResults) then return end
  local best = cheapest(C_AuctionHouse.GetNumItemSearchResults(itemKey),
    function(i) return C_AuctionHouse.GetItemSearchResultInfo(itemKey, i) end, "buyoutAmount")
  if best then notify(id, best, "jetzt im AH") end
end)

ns.Listen("ALERTS_CHANGED", function()
  local n = A.ActiveCount()
  if ns.UI and ns.UI.SetBadge then ns.UI.SetBadge("alerts", n > 0 and tostring(n) or nil) end
end)

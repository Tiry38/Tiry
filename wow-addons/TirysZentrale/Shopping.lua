-- Tiry's Zentrale – Einkaufsliste für die Craft-Warteschlange (wie TSM):
-- Bedarf = Material aller geplanten Crafts; vorhanden = Taschen + Bank + Briefkasten + gerade im AH gekauft.
-- Gekauftes wird sofort abgezogen (Ereignis COMMODITY_PURCHASED), auch wenn es noch im Briefkasten liegt.
local ADDON, ns = ...

local Shop = {}
ns.Shop = Shop
local M = ns.Market

local function state()
  ns.char.shop = ns.char.shop or {}
  local s = ns.char.shop
  s.purchased = s.purchased or {} -- seit dem letzten Briefkasten-Besuch gekauft
  s.inbox = s.inbox or {}         -- Inhalt des Briefkastens beim letzten Besuch
  s.skip = s.skip or {}           -- per × übersprungen ("brauch ich nicht kaufen"), ↺ holt es zurück
  return s
end

local function bagsAndBank(id)
  if C_Item and C_Item.GetItemCount then return C_Item.GetItemCount(id, true) or 0 end
  return 0
end

function Shop.Have(id)
  local s = state()
  return bagsAndBank(id) + (s.inbox[id] or 0) + (s.purchased[id] or 0)
end

-- Gesamtbedarf aller Crafts in der Warteschlange
function Shop.Needs()
  local need = {}
  for _, e in ipairs(ns.char.queue or {}) do
    local r = ns.Recipes.Get(e.recipe)
    if r then
      for _, re in ipairs(r.reagents) do need[re.id] = (need[re.id] or 0) + re.n * e.n end
    end
  end
  return need
end

-- Liste für das Fenster: noch zu kaufen zuerst, Erledigtes unten
function Shop.List()
  local list, open, cost = {}, 0, 0
  for id, need in pairs(Shop.Needs()) do
    local have = Shop.Have(id)
    local skipped = state().skip[id] and need > have or nil
    local missing = skipped and 0 or math.max(0, need - have)
    local unit, where = M.BuyCost(id)
    list[#list + 1] = { id = id, need = need, have = math.min(have, need), missing = missing, unit = unit, where = where, skipped = skipped }
    if missing > 0 then
      open = open + 1
      cost = cost + (unit or 0) * missing
    end
  end
  table.sort(list, function(a, b)
    if (a.missing > 0) ~= (b.missing > 0) then return a.missing > 0 end
    return ns.Item(a.id).name < ns.Item(b.id).name
  end)
  return list, open, cost
end

-- × / ↺ an einer Material-Zeile
function Shop.ToggleSkip(id)
  local s = state()
  s.skip[id] = not s.skip[id] or nil
  ns.Fire("SHOP_CHANGED")
end

function Shop.ResetSkips()
  state().skip = {}
  ns.Fire("SHOP_CHANGED")
end

-- Fehlende Materialien, die man beim Händler kaufen sollte (günstiger als AH oder nur dort)
function Shop.MissingIDs(onlyAH)
  local ids = {}
  for _, e in ipairs((Shop.List())) do
    if e.missing > 0 and (not onlyAH or e.where ~= "HAENDLER") then ids[#ids + 1] = e.id end
  end
  return ids
end

-- Was wird gecraftet? Je Eintrag der Warteschlange: Status "bereit" (alles in den Taschen),
-- "post" (Rest liegt im Briefkasten / ist gekauft) oder "fehlt". Material wird der Reihe nach verteilt.
function Shop.Crafts()
  local s = state()
  local bags, all, out = {}, {}, {}
  for _, e in ipairs(ns.char.queue or {}) do
    local r = ns.Recipes.Get(e.recipe)
    if r then
      local status = "bereit"
      for _, re in ipairs(r.reagents) do
        if bags[re.id] == nil then
          bags[re.id] = (C_Item and C_Item.GetItemCount and C_Item.GetItemCount(re.id) or 0)
          all[re.id] = Shop.Have(re.id)
        end
        local need = re.n * e.n
        if bags[re.id] < need then
          if all[re.id] >= need then
            if status == "bereit" then status = "post" end
          else
            status = "fehlt"
          end
        end
        bags[re.id] = math.max(0, bags[re.id] - need)
        all[re.id] = math.max(0, all[re.id] - need)
      end
      out[#out + 1] = { recipe = r, n = e.n, status = status }
    end
  end
  return out
end

----------------------------------------------------------------------------
-- Händler: fehlendes Craft-Material mit einem Klick kaufen (nur Gold-Preise, nie Sonderwährung)
----------------------------------------------------------------------------
local function merchantInfo(index)
  if C_MerchantFrame and C_MerchantFrame.GetItemInfo then
    local info = C_MerchantFrame.GetItemInfo(index)
    if info then return info.price or 0, math.max(info.stackCount or 1, 1), info.numAvailable or -1, info.hasExtendedCost end
  end
  return nil
end

-- Plan: { index, id, qty (Stückzahl), cost } für alles Fehlende, das dieser Händler verkauft
function Shop.VendorPlan()
  local plan, cost = {}, 0
  if not (ns.Scanner.merchant.open and GetMerchantNumItems and GetMerchantItemID) then return plan, 0 end
  local missing = {}
  for _, e in ipairs((Shop.List())) do
    if e.missing > 0 then missing[e.id] = e.missing end
  end
  local money = GetMoney()
  for index = 1, GetMerchantNumItems() or 0 do
    local id = GetMerchantItemID(index)
    if id and missing[id] then
      local price, stack, avail, extended = merchantInfo(index)
      if price and price > 0 and not extended then
        local unit = price / stack
        local qty = math.ceil(missing[id] / stack) * stack -- Händler verkauft ggf. nur im Bündel
        if avail >= 0 then qty = math.min(qty, avail * stack) end
        local affordable = math.floor((money - cost) / unit / stack) * stack
        qty = math.min(qty, affordable)
        if qty > 0 then
          plan[#plan + 1] = { index = index, id = id, qty = qty, cost = qty * unit }
          cost = cost + qty * unit
          missing[id] = nil
        end
      end
    end
  end
  return plan, cost
end

local lastBuy = 0
function Shop.BuyFromVendor()
  if not ns.Scanner.merchant.open then return false, "Kein Händler offen." end
  if GetTime() - lastBuy < 1 then return false, "Moment – der letzte Kauf kommt gerade an." end
  local plan, cost = Shop.VendorPlan()
  if #plan == 0 then return false, "Dieser Händler verkauft nichts, was dir noch fehlt." end
  lastBuy = GetTime()
  local names = {}
  for _, p in ipairs(plan) do
    local left = p.qty
    local max = GetMerchantItemMaxStack and GetMerchantItemMaxStack(p.index) or left
    if not max or max < 1 then max = left end
    while left > 0 do
      local n = math.min(left, max)
      BuyMerchantItem(p.index, n)
      left = left - n
    end
    names[#names + 1] = p.qty .. "× " .. ns.Item(p.id).name
  end
  return true, table.concat(names, ", ") .. " für " .. ns.Money(cost)
end

----------------------------------------------------------------------------
-- Käufe und Briefkasten mitzählen
----------------------------------------------------------------------------
ns.On("COMMODITY_PURCHASED", function(_, itemID, quantity)
  if not itemID or not quantity then return end
  local s = state()
  if Shop.Needs()[itemID] then
    s.purchased[itemID] = (s.purchased[itemID] or 0) + quantity
    ns.Fire("SHOP_CHANGED")
  end
end)

local function scanInbox()
  if not (GetInboxNumItems and GetInboxItem) then return end
  local s = state()
  local inbox = {}
  local n = GetInboxNumItems() or 0
  for index = 1, n do
    for slot = 1, (ATTACHMENTS_MAX_RECEIVE or 16) do
      local name, id, _, count = GetInboxItem(index, slot)
      if name and id then inbox[id] = (inbox[id] or 0) + (count or 1) end
    end
  end
  s.inbox = inbox
  s.purchased = {} -- alles Gekaufte liegt jetzt im Briefkasten bzw. ist schon in den Taschen
  ns.Fire("SHOP_CHANGED")
end

ns.On("MAIL_SHOW", function() ns.Debounce("inbox", 0.5, scanInbox) end)
ns.On("MAIL_INBOX_UPDATE", function() ns.Debounce("inbox", 0.3, scanInbox) end)
ns.On("BAG_UPDATE_DELAYED", function() ns.Debounce("shopbags", 0.4, function() ns.Fire("SHOP_CHANGED") end) end)

----------------------------------------------------------------------------
-- Geldbetrag aus Text lesen: "45" = 45 Silber, "1g", "1g 20s", "1,5g", "80s", "50k"/"50c" = Kupfer
----------------------------------------------------------------------------
function ns.ParseMoney(text)
  text = (text or ""):lower():gsub(",", ".")
  if text:match("^%s*$") then return nil end
  local total, found = 0, false
  for num, unit in text:gmatch("([%d%.]+)%s*([gskc]?)") do
    local v = tonumber(num)
    if v then
      found = true
      if unit == "g" then total = total + v * 10000
      elseif unit == "k" or unit == "c" then total = total + v
      else total = total + v * 100 end -- "s" oder ohne Einheit = Silber
    end
  end
  if not found then return nil end
  return math.floor(total + 0.5)
end

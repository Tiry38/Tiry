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
    local missing = math.max(0, need - have)
    local unit, where = M.BuyCost(id)
    list[#list + 1] = { id = id, need = need, have = math.min(have, need), missing = missing, unit = unit, where = where }
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

-- Fehlende Materialien, die man beim Händler kaufen sollte (günstiger als AH oder nur dort)
function Shop.MissingIDs(onlyAH)
  local ids = {}
  for _, e in ipairs((Shop.List())) do
    if e.missing > 0 and (not onlyAH or e.where ~= "HAENDLER") then ids[#ids + 1] = e.id end
  end
  return ids
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

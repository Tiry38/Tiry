-- Tiry's Zentrale – Scanner: Händler-Flips, Taschenwert, Rezept-Gewinne
local ADDON, ns = ...

local S = {}
ns.Scanner = S
local M = ns.Market

----------------------------------------------------------------------------
-- Händler-Scanner: findet Händlerware, die im AH mehr bringt als sie kostet
----------------------------------------------------------------------------
S.merchant = { open = false, name = nil, flips = {}, scanned = 0 }

local function merchantItem(index)
  if C_MerchantFrame and C_MerchantFrame.GetItemInfo then
    local info = C_MerchantFrame.GetItemInfo(index)
    if info then
      return info.price or 0, info.stackCount or 1, info.numAvailable or -1, info.hasExtendedCost, info.name
    end
    return nil
  elseif GetMerchantItemInfo then
    local name, _, price, stack, numAvailable, _, _, extendedCost = GetMerchantItemInfo(index)
    return price or 0, stack or 1, numAvailable or -1, extendedCost, name
  end
  return nil
end

function S.ScanMerchant()
  local m = S.merchant
  wipe(m.flips)
  m.scanned = 0
  if not (GetMerchantNumItems and GetMerchantItemID) then return end
  local count = GetMerchantNumItems() or 0
  for i = 1, count do
    local itemID = GetMerchantItemID(i)
    local price, stack, available, extended, name = merchantItem(i)
    if itemID and price and price > 0 and not extended then
      m.scanned = m.scanned + 1
      stack = math.max(stack or 1, 1)
      local unit = price / stack
      -- Unbegrenzte Händlerware merken (für Rezept-Kosten)
      if available == -1 and ns.db then
        ns.db.vendorBuy[itemID] = unit
      end
      local ahPrice = M.Price(itemID)
      if ahPrice then
        local net = M.Net(ahPrice)
        local profit = net - unit
        -- Mindestens 20 % und 50 Kupfer Gewinn pro Stück, sonst lohnt der Aufwand nicht
        if profit >= 50 and profit >= unit * 0.2 then
          m.flips[#m.flips + 1] = {
            id = itemID, name = name, unit = unit, ah = ahPrice, net = net, profit = profit,
            available = available, stack = stack, age = M.Age(itemID),
          }
        end
      end
    end
  end
  table.sort(m.flips, function(a, b)
    local qa = a.available > 0 and a.available or 5
    local qb = b.available > 0 and b.available or 5
    return a.profit * qa > b.profit * qb
  end)
end

ns.On("MERCHANT_SHOW", function()
  S.merchant.open = true
  S.merchant.name = UnitName("npc")
  -- Händlerdaten kommen manchmal verzögert -> kurz warten
  C_Timer.After(0.3, function()
    ns.Safe(S.ScanMerchant)
    ns.Fire("MERCHANT_SCANNED")
    local flips = S.merchant.flips
    if #flips > 0 and ns.settings and ns.settings.merchantAlert then
      local best = flips[1]
      ns.Print(string.format("%d Flip-Chance%s bei %s! Beste: %s (+%s pro Stück). Details: /gold scan",
        #flips, #flips == 1 and "" or "n", S.merchant.name or "diesem Händler",
        ns.Item(best.id).link or ns.Item(best.id).name, ns.Money(best.profit)))
    end
  end)
end)

ns.On("MERCHANT_UPDATE", function()
  if S.merchant.open then
    ns.Debounce("merchant", 0.5, function()
      S.ScanMerchant()
      ns.Fire("MERCHANT_SCANNED")
    end)
  end
end)

ns.On("MERCHANT_CLOSED", function()
  S.merchant.open = false
  ns.Fire("MERCHANT_SCANNED")
end)

----------------------------------------------------------------------------
-- Taschen-Check: Was ist mein Inventar wert und wo verkaufe ich es?
----------------------------------------------------------------------------
S.bags = { items = {}, vendorTotal = 0, ahTotal = 0, junkTotal = 0, bestTotal = 0, time = 0 }

local function lastBag()
  return NUM_TOTAL_EQUIPPED_BAG_SLOTS or NUM_BAG_SLOTS or 4
end

function S.ScanBags()
  local b = S.bags
  wipe(b.items)
  b.vendorTotal, b.ahTotal, b.junkTotal, b.bestTotal = 0, 0, 0, 0
  if not (C_Container and C_Container.GetContainerNumSlots and C_Container.GetContainerItemInfo) then return end
  local byID = {}
  for bag = 0, lastBag() do
    local slots = C_Container.GetContainerNumSlots(bag) or 0
    for slot = 1, slots do
      local info = C_Container.GetContainerItemInfo(bag, slot)
      if info and info.itemID then
        local e = byID[info.itemID]
        if not e then
          e = { id = info.itemID, count = 0, quality = info.quality or 1, bound = info.isBound, noValue = info.hasNoValue, link = info.hyperlink }
          byID[info.itemID] = e
        end
        e.count = e.count + (info.stackCount or 1)
        e.bound = e.bound or info.isBound
      end
    end
  end
  for _, e in pairs(byID) do
    local vendorUnit = e.noValue and 0 or M.VendorSell(e.id)
    local ahUnit = (not e.bound) and M.Price(e.id) or nil
    local ahNet = ahUnit and M.Net(ahUnit) or nil
    e.vendor = vendorUnit * e.count
    e.ah = ahNet and ahNet * e.count or nil
    if e.quality == 0 then
      e.advice = "SCHROTT"
      b.junkTotal = b.junkTotal + e.vendor
      e.best = e.vendor
    elseif e.ah and e.ah > e.vendor * 1.15 and e.ah - e.vendor >= 20 then
      e.advice = "AH"
      e.best = e.ah
    elseif e.vendor > 0 then
      e.advice = "HAENDLER"
      e.best = e.vendor
    else
      e.advice = "BEHALTEN"
      e.best = 0
    end
    b.vendorTotal = b.vendorTotal + e.vendor
    b.ahTotal = b.ahTotal + (e.ah or 0)
    b.bestTotal = b.bestTotal + e.best
    if e.best > 0 or e.advice == "AH" then
      b.items[#b.items + 1] = e
    end
  end
  table.sort(b.items, function(x, y) return (x.best or 0) > (y.best or 0) end)
  b.time = time()
end

ns.On("BAG_UPDATE_DELAYED", function()
  if S.bagsWanted then
    ns.Debounce("bags", 0.6, function()
      S.ScanBags()
      ns.Fire("BAGS_SCANNED")
    end)
  end
end)

----------------------------------------------------------------------------
-- Rezept-Scanner: liest beim Öffnen des Berufsfensters alle gelernten Rezepte
-- (Struktur wird gespeichert, Gewinn wird immer mit aktuellen Preisen berechnet)
----------------------------------------------------------------------------
local BASIC = (Enum and Enum.CraftingReagentType and Enum.CraftingReagentType.Basic) or 1

local function recipeIDs()
  local ids
  if C_TradeSkillUI.GetAllRecipeIDs then
    ids = C_TradeSkillUI.GetAllRecipeIDs()
  end
  if (not ids or #ids == 0) and C_TradeSkillUI.GetFilteredRecipeIDs then
    ids = C_TradeSkillUI.GetFilteredRecipeIDs()
  end
  return ids or {}
end

function S.ScanRecipes()
  if not (C_TradeSkillUI and C_TradeSkillUI.GetRecipeInfo and C_TradeSkillUI.GetRecipeSchematic) then return 0 end
  local profName, rank, maxRank = "Beruf", nil, nil
  if C_TradeSkillUI.GetBaseProfessionInfo then
    local info = C_TradeSkillUI.GetBaseProfessionInfo()
    if info and info.professionName and info.professionName ~= "" then
      profName, rank, maxRank = info.professionName, info.skillLevel, info.maxSkillLevel
    end
  end
  local list, learned = {}, 0
  for _, recipeID in ipairs(recipeIDs()) do
    local info = C_TradeSkillUI.GetRecipeInfo(recipeID)
    if info and not info.isRecraft then
      local schematic = C_TradeSkillUI.GetRecipeSchematic(recipeID, false)
      if schematic and schematic.outputItemID then
        local reagents = {}
        for _, slot in ipairs(schematic.reagentSlotSchematics or {}) do
          if slot.reagentType == BASIC and slot.reagents and slot.reagents[1] and slot.reagents[1].itemID then
            reagents[#reagents + 1] = { id = slot.reagents[1].itemID, n = slot.quantityRequired or 1 }
          end
        end
        if info.learned then learned = learned + 1 end
        list[#list + 1] = {
          id = recipeID, name = info.name, out = schematic.outputItemID,
          qty = ((schematic.quantityMin or 1) + (schematic.quantityMax or schematic.quantityMin or 1)) / 2,
          reagents = reagents, difficulty = info.relativeDifficulty, learned = info.learned and true or false,
          skillUp = info.canSkillUp and true or false,
        }
      end
    end
  end
  if #list > 0 and ns.char then
    ns.char.recipes = ns.char.recipes or {}
    local old = ns.char.recipes[profName]
    -- Nicht gelernte Rezepte nur übernehmen, wenn der Client sie liefert (Filter im Berufsfenster)
    if old and learned == #list then
      for _, r in ipairs(old.list) do
        if not r.learned then
          local known = false
          for _, n in ipairs(list) do if n.id == r.id then known = true break end end
          if not known then list[#list + 1] = r end
        end
      end
    end
    ns.char.recipes[profName] = { time = time(), list = list, rank = rank, maxRank = maxRank }
  end
  return #list
end

-- Gewinn eines gespeicherten Rezepts mit aktuellen Preisen
function S.RecipeProfit(r)
  local cost, unknown = 0, 0
  for _, reagent in ipairs(r.reagents) do
    local unit = M.BuyCost(reagent.id)
    if unit then
      cost = cost + unit * reagent.n
    else
      unknown = unknown + 1
    end
  end
  local price = M.Price(r.out)
  local revenue = price and M.Net(price) * r.qty or nil
  local profit = revenue and (revenue - cost) or nil
  return profit, revenue, cost, unknown
end

local function rescan()
  ns.Debounce("recipes", 0.8, function()
    local n = S.ScanRecipes()
    if n and n > 0 then ns.Fire("RECIPES_SCANNED") end
  end)
end
ns.On("TRADE_SKILL_SHOW", function()
  S.tradeOpen = true
  if C_TradeSkillUI and C_TradeSkillUI.GetBaseProfessionInfo then
    local info = C_TradeSkillUI.GetBaseProfessionInfo()
    S.openProf = info and info.professionName
  end
  rescan()
end)
ns.On("TRADE_SKILL_CLOSE", function()
  S.tradeOpen = false
  ns.Fire("RECIPES_SCANNED")
end)
ns.On("TRADE_SKILL_LIST_UPDATE", rescan)
ns.On("TRADE_SKILL_DATA_SOURCE_CHANGED", rescan)

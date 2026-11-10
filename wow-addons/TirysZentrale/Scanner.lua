-- Tiry's Zentrale – Scanner: Händler-Flips, Taschenwert, Rezept-Gewinne
local _, ns = ...

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
        local net = M.NetAfterDeposit(itemID, nil, ahPrice)
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
      ns.Print(string.format("%d Flip-Chance%s bei %s! Beste: %s (+%s pro Stück). Details: /tz scan",
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

-- Rohstoff-Check: Wert je Stück eines Materials, wenn du es mit einem eigenen Rezept verarbeitest
-- = (Erlös des Ergebnisses − Kosten der übrigen Materialien) / benötigte Menge.
-- Nur Ergebnisse mit frischem AH-Preis (max. 3 Tage), handelbar und kein Ladenhüter.
-- idx: { [Material-ID] = { Rezepte } } aus S.ReagentIndex() (einmal pro Durchlauf bauen)
function S.ReagentIndex()
  local idx, R = {}, ns.Recipes
  if not (R and R.MyProfessions and R.List) then return idx end
  for _, key in ipairs(R.MyProfessions()) do
    for _, r in ipairs(R.List(key, "known")) do
      for _, re in ipairs(r.reagents) do
        idx[re.id] = idx[re.id] or {}
        table.insert(idx[re.id], r)
      end
    end
  end
  return idx
end

function S.ProcessValue(id, idx)
  idx = idx or S.ReagentIndex()
  local best
  for _, r in ipairs(idx[id] or {}) do
    local n = 0
    for _, re in ipairs(r.reagents) do if re.id == id then n = n + re.n end end
    local e = ns.DB.Get(r.out)
    local bound = e and (e.bind == 1 or e.bind == 4)
    local age = M.Age(r.out)
    if n > 0 and not bound and age and age <= 3 and not (ns.Demand and ns.Demand.Class(r.out) == "slow") then
      local _, revenue, cost, unknown = S.RecipeProfit(r)
      if revenue and unknown == 0 then
        local own = S.MatCost(id) or 0
        local value = math.floor((revenue - (cost - own * n)) / n)
        if not best or value > best.value then best = { recipe = r, out = r.out, value = value } end
      end
    end
  end
  return best
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
  local idx = S.ReagentIndex()
  local needs = (ns.Shop and ns.Shop.Needs and ns.Safe(ns.Shop.Needs)) or {}
  local PS = ns.PriceString
  for _, e in pairs(byID) do
    local vendorUnit = e.noValue and 0 or M.VendorSell(e.id)
    local ahUnit = (not e.bound) and M.Price(e.id) or nil
    local ahNet = ahUnit and M.NetAfterDeposit(e.id, M.ListSize(e.id, e.count), ahUnit) or nil
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
    -- Rohstoff-Check: behalten (Craft-Liste), verarbeiten, jetzt verkaufen oder halten?
    if e.quality ~= 0 and not e.bound then
      local rawUnit = math.max(ahNet or 0, vendorUnit)
      if needs[e.id] then
        e.tip = "Behalten: wird für deine Craft-Liste gebraucht"
      else
        local p = S.ProcessValue(e.id, idx)
        if p and p.value > rawUnit * 1.1 and p.value - rawUnit >= 5 then
          e.process = p
          e.tip = string.format("Verarbeiten zu %s: +%s je Stück mehr als roh", ns.Item(p.out).name, ns.Money(p.value - rawUnit))
        elseif e.advice == "AH" and PS and PS.TrendAdvice then
          local tr, txt = PS.TrendAdvice(e.id)
          if tr == "fällt" or tr == "steigt" then e.trend, e.tip = tr, txt end
        end
        if not e.tip and e.advice == "AH" and ns.Demand and ns.Demand.Full(e.id) then
          e.tip = "Markt voll – nur kleine Mengen einstellen oder warten"
        end
      end
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

-- Rezept-Nummern im offenen Berufsfenster. GetFilteredRecipeIDs hängt von Suchfeld/Filtern ab -> zusätzlich
-- alle eigenen Rezept-Nummern dieses Berufs abfragen, die der Client kennt (GetRecipeInfo liefert etwas).
local function recipeIDs()
  local ids, seen = {}, {}
  if C_TradeSkillUI.GetFilteredRecipeIDs then
    for _, id in ipairs(C_TradeSkillUI.GetFilteredRecipeIDs() or {}) do
      if not seen[id] then seen[id] = true ids[#ids + 1] = id end
    end
  end
  local key = S.openProfKey and S.openProfKey()
  local R = ns.Recipes
  if key and R then
    R.Load()
    for _, r in ipairs(R.List(key, "known")) do
      if not seen[r.id] then
        local ok, info = pcall(C_TradeSkillUI.GetRecipeInfo, r.id)
        if ok and info then seen[r.id] = true ids[#ids + 1] = r.id end
      end
    end
  end
  return ids
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

----------------------------------------------------------------------------
-- Selbst herstellen oder kaufen? (z. B. Geschmeidiger mittlerer Balg = Mittlerer Balg + Salz)
-- Nur über Rezepte, die DU gelernt hast, in Berufen, die DU hast. Nie Rezepte anderer Berufe.
----------------------------------------------------------------------------
local makers, makersAt
local function makerIndex()
  local now = GetTime()
  if makers and makersAt and now - makersAt < 10 then return makers end
  makers, makersAt = {}, now
  local R = ns.Recipes
  for _, key in ipairs(R.MyProfessions()) do
    for _, r in ipairs((R.List(key, "known"))) do
      -- nur echte Zwischenprodukte mit Zusatz (z. B. Balg + Salz -> Geschmeidiger Balg).
      -- Reine Umwandlungen aus EINEM Material (Lederfetzen -> Leichtes Leder, Leichtes -> Mittleres Leder)
      -- werden nie vorgeschlagen.
      if r.out and (r.qty or 0) > 0 and not makers[r.out] and #r.reagents >= 2 then
        local loops = false
        for _, re in ipairs(r.reagents) do if re.id == r.out then loops = true end end
        if not loops then makers[r.out] = r end
      end
    end
  end
  return makers
end
local function resetMakers() makers = nil end
ns.Listen("RECIPES_SCANNED", resetMakers)
ns.Listen("PROFESSIONS_CHANGED", resetMakers)
S.ResetMakers = resetMakers

-- Eigenes Rezept für ein Material (oder nil)
function S.Maker(itemID) return makerIndex()[itemID] end

local function buyCost(id)
  local PS = ns.PriceString
  if PS then return PS.Eval("matPrice", id) end
  return M.BuyCost(id)
end

-- Stückkosten eines Materials: günstiger von Kaufen und Selbst-Herstellen.
-- Rückgabe: unit, "buy"|"make"|nil, buyUnit, makeUnit, recipe
function S.MatCost(id, depth, seen)
  depth = depth or 0
  local buy = buyCost(id)
  local r = depth < 3 and makerIndex()[id] or nil
  if r and not (seen and seen[id]) then
    seen = seen or {}
    seen[id] = true
    local c, ok = 0, true
    for _, re in ipairs(r.reagents) do
      local u = S.MatCost(re.id, depth + 1, seen)
      if not u then ok = false break end
      c = c + u * re.n
    end
    seen[id] = nil
    if ok then
      local make = c / r.qty
      if not buy or make < buy then return make, "make", buy, make, r end
      return buy, "buy", buy, make, r
    end
  end
  return buy, buy and "buy" or nil, buy, nil, nil
end

-- Gewinn eines gespeicherten Rezepts mit aktuellen Preisen.
-- Erlös = AH-Preis nach AH-Gebühr minus erwartetem Einstellgebühr-Verlust (Forever: mind. 1 Silber je Angebot,
-- weg bei Ablauf). 5. Rückgabe: Materialien, die du günstiger selbst herstellst { { id, saves = Ersparnis pro Craft } }
-- 6. Rückgabe: davon Einstellgebühr-Risiko pro Craft (Kupfer)
function S.RecipeProfit(r)
  local PS = ns.PriceString
  local cost, unknown, makes = 0, 0, {}
  for _, reagent in ipairs(r.reagents) do
    local unit, how, buy = S.MatCost(reagent.id)
    if unit then
      cost = cost + unit * reagent.n
      if how == "make" then
        makes[#makes + 1] = { id = reagent.id, saves = buy and math.floor((buy - unit) * reagent.n) or nil }
      end
    else
      unknown = unknown + 1
    end
  end
  cost = math.floor(cost + 0.5)
  local price
  if PS then price = PS.Eval("craftValue", r.out) else price = M.Price(r.out) end
  local revenue, deposit
  if price then
    deposit = M.DepositRisk(r.out) * r.qty
    revenue = M.Net(price) * r.qty - deposit
  end
  local profit = revenue and (revenue - cost) or nil
  return profit, revenue, cost, unknown, makes, deposit
end

local function readOpenProf()
  if C_TradeSkillUI and C_TradeSkillUI.GetBaseProfessionInfo then
    local info = C_TradeSkillUI.GetBaseProfessionInfo()
    S.openProf = info and info.professionName
  end
end

-- Schlüssel (z. B. "LEATHERWORKING") des offenen Berufsfensters
function S.openProfKey()
  if not S.tradeOpen or not S.openProf then return nil end
  for key, id in pairs(ns.PROF) do
    local p = ns.professions[id]
    if p and p.name == S.openProf then return key end
  end
end

local function rescan()
  ns.Debounce("recipes", 0.8, function()
    if S.tradeOpen then readOpenProf() end
    local n = S.ScanRecipes()
    if n and n > 0 then ns.Fire("RECIPES_SCANNED") end
  end)
end
ns.On("TRADE_SKILL_SHOW", function()
  S.tradeOpen = true
  readOpenProf()
  rescan()
end)
ns.On("TRADE_SKILL_CLOSE", function()
  S.tradeOpen = false
  ns.Fire("RECIPES_SCANNED")
end)
ns.On("TRADE_SKILL_LIST_UPDATE", rescan)
ns.On("TRADE_SKILL_DATA_SOURCE_CHANGED", rescan)

-- Tiry's Zentrale – Gold-Autopilot: Schrott automatisch verkaufen, Händler-Verkauf und Flip-Kauf per Klick,
-- Beute-Radar (Wert jeder neuen Beute live, Warnung bei wertvollen Items).
-- Alles, was Gold ausgibt oder Items verkauft, passiert NUR nach deinem Klick – Ausnahmen (abschaltbar in den
-- Einstellungen): grauen Schrott verkaufen und reparieren, wie Blizzards eigene Händler-Knöpfe.
local _, ns = ...

local A = {}
ns.Auto = A
local M = ns.Market

local SELL_PER_CLICK = 12 -- so viele Items kann der Händler zurückkaufen lassen (Rückkauf-Liste)

----------------------------------------------------------------------------
-- Händler: Schrott automatisch verkaufen
----------------------------------------------------------------------------
local junkMoneyBefore

ns.On("MERCHANT_SHOW", function()
  if not (ns.settings and ns.settings.autoJunk) or ns.InCombat() then return end
  if not (C_MerchantFrame and C_MerchantFrame.SellAllJunkItems and C_MerchantFrame.GetNumJunkItems) then return end
  -- Nur wenn der Händler Blizzards eigenen "Schrott verkaufen"-Knopf anbietet
  if C_MerchantFrame.IsSellAllJunkEnabled and not C_MerchantFrame.IsSellAllJunkEnabled() then return end
  local n = C_MerchantFrame.GetNumJunkItems() or 0
  if n > 0 then
    junkMoneyBefore = GetMoney()
    if not pcall(C_MerchantFrame.SellAllJunkItems) then junkMoneyBefore = nil return end
    C_Timer.After(1.2, function()
      if junkMoneyBefore then
        local gained = GetMoney() - junkMoneyBefore
        junkMoneyBefore = nil
        if gained > 0 then
          ns.Print(string.format("Autopilot: %d× Schrott verkauft für %s.", n, ns.Money(gained)))
        end
      end
    end)
  end
end)

----------------------------------------------------------------------------
-- Händler: Items, die beim Händler mehr bringen als im AH (nur sichere Sorten)
----------------------------------------------------------------------------
local SAFE_CLASSES = { [7] = true, [15] = true } -- Handwerkswaren, Verschiedenes (keine Ausrüstung, keine Quest-Items)

local function bagSlots()
  return NUM_TOTAL_EQUIPPED_BAG_SLOTS or NUM_BAG_SLOTS or 4
end

-- Liefert Liste { bag, slot, id, count, value } aller Händler-Verkäufe
function A.VendorCandidates()
  local list, total = {}, 0
  if not (C_Container and C_Container.GetContainerItemInfo) then return list, 0 end
  local needs = (ns.Shop and ns.Shop.Needs and ns.Safe(ns.Shop.Needs)) or {} -- Craft-Liste: nie verkaufen
  for bag = 0, bagSlots() do
    for slot = 1, C_Container.GetContainerNumSlots(bag) or 0 do
      local info = C_Container.GetContainerItemInfo(bag, slot)
      if info and info.itemID and not info.isLocked and not info.hasNoValue and (info.quality or 1) >= 1 and not needs[info.itemID] then
        local db = ns.DB and ns.DB.Get(info.itemID)
        local vendor = M.VendorSell(info.itemID)
        local ah = M.Price(info.itemID)
        -- AH lohnt nur, wenn nach AH-Gebühr und Einstellgebühr-Risiko mehr übrig bleibt als beim Händler
        local ahNet = ah and M.NetAfterDeposit(info.itemID, M.ListSize(info.itemID, info.stackCount), ah)
        -- gekaufte Händler-Schnäppchen (Schnäppchen-Scanner) gehen immer mit, solange das AH nicht mehr bringt
        local snipe = not info.isBound and ns.Snipe and ns.Snipe.IsVendorSnipe(info.itemID) and vendor > 0 and (not ahNet or ahNet <= vendor)
        local safe = db and SAFE_CLASSES[db.class] and not (db.class == 15 and db.sub == 1) -- keine Klassen-Reagenzien
        if snipe or (safe and vendor > 0 and ah and ahNet <= vendor) then
          local value = vendor * (info.stackCount or 1)
          list[#list + 1] = { bag = bag, slot = slot, id = info.itemID, count = info.stackCount or 1, value = value }
          total = total + value
        end
      end
    end
  end
  table.sort(list, function(a, b) return a.value > b.value end)
  return list, total
end

-- Verkauft bis zu 12 Items (nur auf Klick, nur bei offenem Händler)
function A.SellVendorItems()
  if ns.CombatBlocked() then return 0 end
  if not ns.Scanner.merchant.open then return 0 end
  local list = A.VendorCandidates()
  local sold = 0
  for i = 1, math.min(#list, SELL_PER_CLICK) do
    local e = list[i]
    C_Container.UseContainerItem(e.bag, e.slot)
    sold = sold + 1
  end
  return sold
end

----------------------------------------------------------------------------
-- Händler: Flip-Schnäppchen kaufen (nur begrenzter Vorrat, nur auf Klick)
----------------------------------------------------------------------------
function A.FlipBuyPlan()
  local plan, cost, profit = {}, 0, 0
  if not ns.Scanner.merchant.open then return plan, 0, 0 end
  for _, f in ipairs(ns.Scanner.merchant.flips) do
    if f.available and f.available > 0 then
      for index = 1, (GetMerchantNumItems and GetMerchantNumItems() or 0) do
        if GetMerchantItemID(index) == f.id then
          -- numAvailable zählt Händler-Einträge (Bündel), BuyMerchantItem will Stückzahlen
          local qty = f.available * math.max(f.stack or 1, 1)
          plan[#plan + 1] = { index = index, id = f.id, qty = qty, cost = f.unit * qty, profit = f.profit * qty }
          cost = cost + f.unit * qty
          profit = profit + f.profit * qty
          break
        end
      end
    end
  end
  return plan, cost, profit
end

function A.BuyFlips()
  if ns.InCombat() then return false, "Im Kampf gesperrt – bitte nach dem Kampf nochmal klicken." end
  local plan, cost = A.FlipBuyPlan()
  if #plan == 0 then return false, "Keine Flips mit begrenztem Vorrat bei diesem Händler." end
  if GetMoney() < cost then return false, "Nicht genug Gold für alle Flips (" .. ns.Money(cost) .. " nötig)." end
  for _, p in ipairs(plan) do
    local left = p.qty
    local max = GetMerchantItemMaxStack and GetMerchantItemMaxStack(p.index) or left
    if not max or max < 1 then max = left end
    while left > 0 do
      local n = math.min(left, max)
      BuyMerchantItem(p.index, n)
      left = left - n
    end
  end
  return true, #plan
end

----------------------------------------------------------------------------
-- Beute-Radar: vergleicht den Tascheninhalt und bewertet jede neue Beute
----------------------------------------------------------------------------
A.session = { value = 0, items = 0, log = {} }
local snapshot, equipChanged
ns.On("PLAYER_EQUIPMENT_CHANGED", function() equipChanged = true end) -- An-/Ablegen ist keine Beute
local blocked = { merchant = false, mail = false, trade = false, bank = false, ah = false }

local function readBags()
  local counts, bound = {}, {}
  if not (C_Container and C_Container.GetContainerItemInfo) then return counts end
  for bag = 0, bagSlots() do
    for slot = 1, C_Container.GetContainerNumSlots(bag) or 0 do
      local info = C_Container.GetContainerItemInfo(bag, slot)
      if info and info.itemID then
        counts[info.itemID] = (counts[info.itemID] or 0) + (info.stackCount or 1)
        if info.isBound then bound[info.itemID] = true end
      end
    end
  end
  counts.__bound = bound
  return counts
end

local function isBlocked()
  for _, v in pairs(blocked) do if v then return true end end
  return false
end

local function onBagsChanged()
  local now = readBags()
  local bound = now.__bound or {}
  now.__bound = nil
  if not snapshot or isBlocked() or equipChanged then
    equipChanged = false
    snapshot = now
    return
  end
  for id, count in pairs(now) do
    local gained = count - (snapshot[id] or 0)
    if gained > 0 then
      local channel, unit = M.BestSale(id)
      if bound[id] then channel, unit = "HAENDLER", M.VendorSell(id) end -- gebunden: nie AH
      local value = (unit or 0) * gained
      ns.Fire("LOOT_GAINED", id, gained)
      -- Hergestellte Items sind keine Beute (nur die Craft-Warteschlange zählt sie)
      if not ns.Scanner.tradeOpen then
      local s = A.session
      s.value = s.value + value
      s.items = s.items + gained
      table.insert(s.log, 1, { id = id, n = gained, value = value, channel = channel, time = time() })
      if #s.log > 40 then table.remove(s.log) end
      local static = ns.ITEMS[id]
      local scarce = static and static.cat == "scarce"
      local threshold = (ns.settings and ns.settings.lootAlertMin) or 5000
      if ns.settings and ns.settings.lootAlerts and (scarce or (channel == "AH" and value >= threshold)) then
        local item = ns.Item(id)
        ns.Print(string.format("|cffff9929Wertvoll:|r %s%s - ca. %s im AH - %s",
          item.link or item.name, gained > 1 and (" x" .. gained) or "", ns.Money(value),
          "nicht zum Händler!"))
        if PlaySound and SOUNDKIT and SOUNDKIT.IG_BACKPACK_COIN_SELECT then pcall(PlaySound, SOUNDKIT.IG_BACKPACK_COIN_SELECT) end
      end
      end
    end
  end
  snapshot = now
  ns.Fire("LOOT_VALUED")
end

ns.On("BAG_UPDATE_DELAYED", function() ns.Debounce("radar", 0.3, onBagsChanged) end)
ns.Listen("LOGIN", function()
  A.session.start = time()
  C_Timer.After(3, function() snapshot = readBags() snapshot.__bound = nil end)
end)

local function block(key, value)
  return function()
    blocked[key] = value
    if not value then snapshot = readBags() snapshot.__bound = nil end -- Einkäufe/Post/Handel nicht als Beute zählen
  end
end
ns.On("MERCHANT_SHOW", block("merchant", true))
ns.On("MERCHANT_CLOSED", block("merchant", false))
ns.On("MAIL_SHOW", block("mail", true))
ns.On("MAIL_CLOSED", block("mail", false))
ns.On("TRADE_SHOW", block("trade", true))
ns.On("TRADE_CLOSED", block("trade", false))
ns.On("BANKFRAME_OPENED", block("bank", true))
ns.On("BANKFRAME_CLOSED", block("bank", false))
ns.On("AUCTION_HOUSE_SHOW", block("ah", true))
ns.On("AUCTION_HOUSE_CLOSED", block("ah", false))

-- Beutewert pro Stunde dieser Sitzung
function A.LootPerHour()
  local elapsed = time() - (A.session.start or time())
  if elapsed < 300 then return nil end
  return A.session.value / (elapsed / 3600)
end

----------------------------------------------------------------------------
-- Auktionshaus geöffnet: Hinweis, was eingestellt werden sollte
----------------------------------------------------------------------------
ns.On("AUCTION_HOUSE_SHOW", function()
  if not (ns.settings and ns.settings.ahHint) then return end
  C_Timer.After(1, function()
    ns.Scanner.ScanBags()
    local n, total = 0, 0
    for _, e in ipairs(ns.Scanner.bags.items) do
      if e.advice == "AH" then n = n + 1 total = total + (e.ah or 0) end
    end
    if n > 0 then
      ns.Print(string.format("Du hast |cffff9929%d Items für ca. %s|r dabei, die ins AH gehören. Auctionator > Reiter \"Verkaufen\" – Liste: /tz scan", n, ns.Money(total)))
    end
  end)
end)

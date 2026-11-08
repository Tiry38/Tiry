-- Tiry's Zentrale – Bestand über alle Charaktere (wie TSM ItemTracker / Syndicator):
-- Taschen, Bank und Post jedes Charakters + Gold, gespeichert pro Realm.
local ADDON, ns = ...

local I = {}
ns.Inv = I

local function me()
  local realm = GetRealmName and GetRealmName() or "Realm"
  ns.db.inv = ns.db.inv or {}
  ns.db.inv[realm] = ns.db.inv[realm] or {}
  local name = ns.player.name ~= "" and ns.player.name or (UnitName("player") or "?")
  local c = ns.db.inv[realm][name] or {}
  ns.db.inv[realm][name] = c
  c.bags, c.bank, c.mail = c.bags or {}, c.bank or {}, c.mail or {}
  c.class, c.faction = ns.player.class, ns.player.faction
  return c, ns.db.inv[realm], name
end

local function readContainers(list)
  local out = {}
  if not (C_Container and C_Container.GetContainerNumSlots) then return out end
  for _, bag in ipairs(list) do
    for slot = 1, C_Container.GetContainerNumSlots(bag) or 0 do
      local info = C_Container.GetContainerItemInfo(bag, slot)
      if info and info.itemID then out[info.itemID] = (out[info.itemID] or 0) + (info.stackCount or 1) end
    end
  end
  return out
end

local BAGS = { 0, 1, 2, 3, 4, 5 }
local BANK = { -2, 6, 7, 8, 9, 10, 11, 12, 13, 14 }

function I.UpdateBags()
  local c = me()
  c.bags = readContainers(BAGS)
  c.money = GetMoney()
  c.time = time()
end

function I.UpdateBank()
  local c = me()
  c.bank = readContainers(BANK)
end

function I.UpdateMail()
  if not (GetInboxNumItems and GetInboxItem) then return end
  local c = me()
  local mail = {}
  for i = 1, GetInboxNumItems() or 0 do
    for slot = 1, (ATTACHMENTS_MAX_RECEIVE or 16) do
      local name, id, _, count = GetInboxItem(i, slot)
      if name and id then mail[id] = (mail[id] or 0) + (count or 1) end
    end
  end
  c.mail = mail
end

local bankOpen = false
ns.Listen("LOGIN", function() C_Timer.After(4, function() ns.Safe(I.UpdateBags) end) end)
ns.On("BAG_UPDATE_DELAYED", function()
  ns.Debounce("invbags", 1, function()
    I.UpdateBags()
    if bankOpen then I.UpdateBank() end
  end)
end)
ns.On("PLAYER_MONEY", function() ns.Debounce("invmoney", 2, I.UpdateBags) end)
ns.On("BANKFRAME_OPENED", function() bankOpen = true ns.Debounce("invbank", 0.5, I.UpdateBank) end)
ns.On("BANKFRAME_CLOSED", function() bankOpen = false end)
ns.On("MAIL_INBOX_UPDATE", function() ns.Debounce("invmail", 0.6, I.UpdateMail) end)

-- Bestand eines Items auf allen Charakteren dieses Realms: Liste { name, bags, bank, mail, total }, Gesamt
function I.Count(itemID)
  local _, realm, myName = me()
  local list, total = {}, 0
  for name, c in pairs(realm) do
    local b, k, m = c.bags[itemID] or 0, c.bank[itemID] or 0, c.mail[itemID] or 0
    if name == myName and C_Item and C_Item.GetItemCount then
      b = C_Item.GetItemCount(itemID, false) or b
    end
    local sum = b + k + m
    if sum > 0 then
      list[#list + 1] = { name = name, bags = b, bank = k, mail = m, total = sum, me = (name == myName) }
      total = total + sum
    end
  end
  table.sort(list, function(a, b) return a.total > b.total end)
  return list, total
end

-- Gold aller Charaktere
function I.Gold()
  local _, realm, myName = me()
  local list, total = {}, 0
  for name, c in pairs(realm) do
    local m = (name == myName) and GetMoney() or (c.money or 0)
    list[#list + 1] = { name = name, money = m, class = c.class, time = c.time }
    total = total + m
  end
  table.sort(list, function(a, b) return a.money > b.money end)
  return list, total
end

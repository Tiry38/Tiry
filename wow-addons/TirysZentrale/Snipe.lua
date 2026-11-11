-- Tiry's Zentrale – Schnäppchen-Scanner (Komplett-Scan)
-- Liest bei jedem Komplett-Scan JEDES Angebot im AH mit (über das Absatz-Modul, nur einmal durch die Liste):
--   * "haendler": Sofortkauf unter dem Händler-Verkaufspreis -> kaufen, beim Händler verkaufen, sicherer Gewinn
--     (klassischer Goldmacher-Trick "Vendor-Sniping"; das Addon kauft NIE selbst – Kauf bleibt dein Klick).
--   * "markt": deutlich unter deinem Marktwert (14-Tage-Median deiner Scans, mind. 3 Tage) und kein Ladenhüter
--     -> kaufen und im AH teurer verkaufen (Gewinn nach AH-Gebühr und Einstellgebühr-Risiko gerechnet).
local _, ns = ...

local S = {}
ns.Snipe = S
S.list, S.time = {}, nil
S.MARKET_SHARE = 0.65  -- höchstens 65 % vom Marktwert
S.VENDOR_MIN = 100     -- Händler-Schnäppchen ab 1 Silber Gewinn je Angebot

local cur          -- Sammeltabelle des laufenden Scans
local me

local function vendorPrice(id)
  local hot = ns.HOTFIX and ns.HOTFIX.sell[id] -- Blizzard-Hotfix vor Spiel-Cache und Spieldaten
  if hot then return hot end
  local sell = GetItemInfo and select(11, GetItemInfo(id))
  if type(sell) == "number" then return sell end
  local e = ns.DB and ns.DB.Get(id)
  return e and e.sell or 0
end

local function marketRef(id)
  local PS = ns.PriceString
  local h = ns.db and ns.db.priceHistory and ns.db.priceHistory[id]
  if not (PS and h) then return nil end
  local days = 0
  for _ in pairs(h) do days = days + 1 end
  if days < 3 then return nil end -- erst ab 3 Scan-Tagen ist der Marktwert belastbar
  return PS.Market(id)
end

-- Mindestgewinn für Markt-Schnäppchen: halber Craft-Mindestgewinn deines Levels, mind. 10 Silber
function S.MarketMin()
  local R = ns.Recipes
  local p = R and R.Preset and R.Preset()
  return math.max(1000, math.floor(((p and p.profit) or 2000) / 2))
end

function S.Begin()
  cur = { vendor = {}, market = {}, refs = {} }
  me = UnitName and UnitName("player") or nil
end

-- Ein Angebot: count Stück für buyout Kupfer (gesamt)
function S.Collect(itemID, count, buyout, owner)
  if not cur or not itemID or not count or count <= 0 or not buyout or buyout <= 0 then return end
  if owner and me and (owner == me or owner:match("^([^%-]+)") == me) then return end -- eigene Angebote
  local unit = buyout / count
  -- Händler-Schnäppchen
  local vendor = vendorPrice(itemID)
  if vendor > 0 and unit < vendor then
    local profit = vendor * count - buyout
    if profit >= S.VENDOR_MIN then
      local e = cur.vendor[itemID] or { id = itemID, kind = "haendler", count = 0, cost = 0, profit = 0, ref = vendor }
      cur.vendor[itemID] = e
      e.count, e.cost, e.profit = e.count + count, e.cost + buyout, e.profit + profit
      if not e.unit or unit < e.unit then e.unit = unit end
      return
    end
  end
  -- Markt-Schnäppchen
  local ref = cur.refs[itemID]
  if ref == nil then ref = marketRef(itemID) or false cur.refs[itemID] = ref end
  if ref and unit <= ref * S.MARKET_SHARE then
    local e = cur.market[itemID] or { id = itemID, kind = "markt", count = 0, cost = 0, profit = 0, ref = ref }
    cur.market[itemID] = e
    e.count, e.cost = e.count + count, e.cost + buyout
    if not e.unit or unit < e.unit then e.unit = unit end
  end
end

function S.Finish()
  if not cur then return S.list end
  local list = {}
  for _, e in pairs(cur.vendor) do e.unit = math.floor(e.unit) list[#list + 1] = e end
  local minMarket = S.MarketMin()
  local D, M = ns.Demand, ns.Market
  for id, e in pairs(cur.market) do
    if not (D and D.Class(id) == "slow") then
      local resale = M and M.NetAfterDeposit(id, nil, e.ref) or math.floor(e.ref * 0.95)
      e.profit = math.floor(resale * e.count - e.cost)
      e.unit = math.floor(e.unit)
      if e.profit >= minMarket then list[#list + 1] = e end
    end
  end
  -- sichere Händler-Schnäppchen zuerst, dann nach Gewinn
  table.sort(list, function(a, b)
    if a.kind ~= b.kind then return a.kind == "haendler" end
    if a.profit ~= b.profit then return a.profit > b.profit end
    return a.id < b.id
  end)
  while #list > 40 do table.remove(list) end
  S.list, S.time, cur = list, time(), nil
  local v, m, vp, mp = 0, 0, 0, 0
  for _, e in ipairs(list) do
    if e.kind == "haendler" then v, vp = v + 1, vp + e.profit else m, mp = m + 1, mp + e.profit end
  end
  if (v > 0 or m > 0) and ns.settings and ns.settings.snipeAlert ~= false then
    local parts = {}
    if v > 0 then parts[#parts + 1] = string.format("%d unter Händlerpreis (|cff61eb8f+%s sicher|r)", v, ns.Money(vp)) end
    if m > 0 then parts[#parts + 1] = string.format("%d unter Marktwert (+%s)", m, ns.Money(mp)) end
    ns.Print("|cffff9929Schnäppchen-Scan:|r " .. table.concat(parts, ", ") .. ". Liste: /tz schnapp")
  end
  ns.Fire("SNIPES_CHANGED")
  return list
end

function S.Totals()
  local t = { vendor = 0, market = 0, vendorProfit = 0, marketProfit = 0 }
  for _, e in ipairs(S.list) do
    if e.kind == "haendler" then t.vendor, t.vendorProfit = t.vendor + 1, t.vendorProfit + e.profit
    else t.market, t.marketProfit = t.market + 1, t.marketProfit + e.profit end
  end
  return t
end

-- Alle (oder eine Art) im offenen AH suchen lassen (Auctionator). Händler-Schnäppchen werden gemerkt,
-- damit der Knopf "Verkaufen" beim Händler sie danach mitnimmt.
function S.SearchAll(kind)
  local ids = {}
  ns.char.snipeVendor = ns.char.snipeVendor or {}
  for _, e in ipairs(S.list) do
    if not kind or e.kind == kind then
      ids[#ids + 1] = e.id
      if e.kind == "haendler" then ns.char.snipeVendor[e.id] = time() end
    end
  end
  if #ids == 0 then return false, "Keine Schnäppchen in der Liste." end
  return ns.Market.SearchNow(ids)
end

-- Gemerkte Händler-Schnäppchen (3 Tage gültig)
function S.IsVendorSnipe(id)
  local t = ns.char and ns.char.snipeVendor and ns.char.snipeVendor[id]
  if t and time() - t < 3 * 86400 then return true end
  if t and ns.char.snipeVendor then ns.char.snipeVendor[id] = nil end
  return false
end

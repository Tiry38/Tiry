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

-- Händler-Verkaufspreis. Ein Komplett-Scan hat zehntausende Angebote: GetItemInfo nur für Items, die das Spiel
-- schon geladen hat (sonst fordert jeder Aufruf Daten vom Server an -> Ruckeln, Auctionator-Suchen warten mit).
-- Reihenfolge: Blizzard-Hotfix > Spiel-Cache > Spieldaten. Je Scan einmal je Item.
local function vendorPrice(id)
  local memo = cur and cur.sell
  local v = memo and memo[id]
  if v then return v end
  v = ns.HOTFIX and ns.HOTFIX.sell[id]
  local CI = C_Item
  if not v and CI and CI.GetItemInfo and CI.IsItemDataCachedByID and CI.IsItemDataCachedByID(id) then
    local sell = select(11, CI.GetItemInfo(id))
    if type(sell) == "number" then v = sell end
  end
  if not v then
    local e = ns.DB and ns.DB.Get(id)
    v = e and e.sell or 0
  end
  if memo then memo[id] = v end
  return v
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
  cur = { vendor = {}, market = {}, refs = {}, sell = {} }
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
  -- Markt-Kandidaten: erst grob (Marktwert minus AH-Gebühr = Obergrenze des Erlöses), dann nur die besten genau
  -- rechnen (Einstellgebühr-Risiko, Absatz). Spart bei großen Scans tausende Rechnungen im selben Bild.
  local cand = {}
  local cut = M and M.CutFactor and M.CutFactor() or 0.95
  for _, e in pairs(cur.market) do
    e.bound = math.floor(e.ref * cut) * e.count - e.cost
    if e.bound >= minMarket then cand[#cand + 1] = e end
  end
  table.sort(cand, function(a, b) if a.bound ~= b.bound then return a.bound > b.bound end return a.id < b.id end)
  local slots = math.max(0, 40 - #list)
  local got = {}
  for _, e in ipairs(cand) do
    -- genug sichere Treffer und der Rest kann sie nicht mehr schlagen -> fertig
    if #got >= slots and (slots == 0 or e.bound <= got[slots].profit) then break end
    if not (D and D.Class(e.id) == "slow") then
      local resale = M and M.NetAfterDeposit(e.id, nil, e.ref) or math.floor(e.ref * 0.95)
      e.profit = math.floor(resale * e.count - e.cost)
      e.unit = math.floor(e.unit)
      if e.profit >= minMarket then
        got[#got + 1] = e
        table.sort(got, function(a, b) if a.profit ~= b.profit then return a.profit > b.profit end return a.id < b.id end)
      end
    end
    e.bound = nil
  end
  for _, e in ipairs(got) do e.bound = nil list[#list + 1] = e end
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
    local text = "|cffff9929Schnäppchen-Scan:|r " .. table.concat(parts, ", ") .. ". Liste: /tz schnapp"
    -- dieselbe Meldung nicht nochmal (Schutz gegen doppelte Scan-Meldungen von Blizzard)
    if text ~= S.lastText or not S.lastPrint or time() - S.lastPrint >= 900 then
      S.lastText, S.lastPrint = text, time()
      ns.Print(text)
    end
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

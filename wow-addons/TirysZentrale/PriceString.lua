-- Tiry's Zentrale – Preis-Strings im TSM-Stil + eigener Marktwert (14-Tage-Median deiner Scans)
--
-- Quellen (Groß/Klein egal):
--   ahprice   = aktueller AH-Preis aus Auctionator (TSM: dbminbuyout)
--   market    = eigener Marktwert: Median der Tagespreise der letzten 14 Tage (TSM: dbmarket)
--   vendorbuy = Einkaufspreis beim Händler, vendorsell = Verkaufspreis an den Händler
--   crafting  = Materialkosten des Rezepts (nur im Mindestgewinn), levelgold = dein Gold-Regler
--   TSM-Namen werden übersetzt: dbminbuyout -> ahprice, dbmarket/dbhistorical/dbregionmarketavg -> market
-- Funktionen: min(...), max(...), first(...), avg(...); Rechnen: + - * / und Klammern
-- Zahlen: 120% crafting (= 1,2 x crafting), 5g, 50s, 20c, 1g50s, oder Kupfer als Zahl
-- Fehlt ein Wert (z. B. kein AH-Preis), ignorieren min/max/avg ihn; first nimmt den ersten vorhandenen.
local _, ns = ...

local PS = {}
ns.PriceString = PS

PS.DEFAULTS = {
  matPrice = "first(vendorbuy, ahprice, market)",
  craftValue = "min(ahprice, 125% market)",
  minProfit = "max(15% crafting, levelgold)",
}

----------------------------------------------------------------------------
-- Eigener Marktwert: pro Item ein Preis pro Tag, Median der letzten 14 Tage
----------------------------------------------------------------------------
local KEEP = 14

local function hist()
  ns.db.priceHistory = ns.db.priceHistory or {}
  return ns.db.priceHistory
end

function PS.Record(itemID, price)
  if not price or price <= 0 then return end
  local h = hist()
  local day = ns.Today()
  local t = h[itemID] or {}
  h[itemID] = t
  t[day] = price
  -- alte Tage löschen
  local days = {}
  for d in pairs(t) do days[#days + 1] = d end
  if #days > KEEP then
    table.sort(days)
    for i = 1, #days - KEEP do t[days[i]] = nil end
  end
end

function PS.Market(itemID)
  local t = ns.db and ns.db.priceHistory and ns.db.priceHistory[itemID]
  if not t then return nil end
  local v = {}
  for _, p in pairs(t) do v[#v + 1] = p end
  if #v == 0 then return nil end
  table.sort(v)
  local n = #v
  if n % 2 == 1 then return v[(n + 1) / 2] end
  return math.floor((v[n / 2] + v[n / 2 + 1]) / 2 + 0.5)
end

-- Kennzahlen des eigenen Preisverlaufs (ein Wert je Scan-Tag = günstigstes Angebot, max. 14 Tage):
-- { median, mean, min, max, days } oder nil
function PS.Stats(itemID)
  local t = ns.db and ns.db.priceHistory and ns.db.priceHistory[itemID]
  if not t then return nil end
  local v, sum = {}, 0
  for _, p in pairs(t) do v[#v + 1] = p sum = sum + p end
  if #v == 0 then return nil end
  table.sort(v)
  return { median = PS.Market(itemID), mean = math.floor(sum / #v + 0.5), min = v[1], max = v[#v], days = #v }
end

-- Preis-Trend: Median der letzten 3 Scan-Tage gegen den Median der Tage davor (mind. 2 ältere Tage).
-- Rückgabe: Veränderung als Anteil (z. B. -0.35 = 35 % gefallen) und Anzahl Tage – oder nil
function PS.Trend(itemID)
  local t = ns.db and ns.db.priceHistory and ns.db.priceHistory[itemID]
  if not t then return nil end
  local days = {}
  for d in pairs(t) do days[#days + 1] = d end
  if #days < 5 then return nil end
  table.sort(days, function(a, b) return a > b end)
  local function median(from, to)
    local v = {}
    for i = from, to do v[#v + 1] = t[days[i]] end
    table.sort(v)
    local n = #v
    if n % 2 == 1 then return v[(n + 1) / 2] end
    return (v[n / 2] + v[n / 2 + 1]) / 2
  end
  local recent, older = median(1, 3), median(4, #days)
  if not older or older <= 0 then return nil end
  return recent / older - 1, #days
end

-- Kurzer Rat aus dem Trend: "fällt" (verkaufen statt horten), "steigt" (halten lohnt), "stabil" – oder nil
function PS.TrendAdvice(itemID)
  local tr, n = PS.Trend(itemID)
  if not tr then return nil end
  local pct = math.floor(math.abs(tr) * 100 + 0.5)
  if tr <= -0.1 then return "fällt", string.format("Preis fällt (-%d %% in %d Tagen) – verkaufen statt horten", pct, n), tr end
  if tr >= 0.1 then return "steigt", string.format("Preis steigt (+%d %% in %d Tagen) – halten lohnt", pct, n), tr end
  return "stabil", string.format("Preis stabil (%d Tage)", n), tr
end

-- Nach jedem Scan: Preise aller Materialien und Ergebnisse deiner Rezepte + Markt-Items merken
function PS.RecordAll()
  if not (ns.Market.HasAuctionator() and ns.db) then return 0 end
  local seen, n = {}, 0
  local function rec(id)
    if seen[id] then return end
    seen[id] = true
    local p = ns.Market.Price(id)
    if p then PS.Record(id, p) n = n + 1 end
  end
  local R = ns.Recipes
  for _, key in ipairs(R.MyProfessions()) do
    for _, mode in ipairs({ "known", "learnable" }) do
      for _, r in ipairs((R.List(key, mode))) do
        rec(r.out)
        for _, re in ipairs(r.reagents) do rec(re.id) end
      end
    end
  end
  for _, id in ipairs(ns.ITEM_ORDER or {}) do rec(id) end
  return n
end
ns.Listen("PRICES_UPDATED", function() ns.Safe(PS.RecordAll) end)
ns.Listen("LOGIN", function() C_Timer.After(8, function() ns.Safe(PS.RecordAll) end) end)

----------------------------------------------------------------------------
-- Zerlegen und Auswerten
----------------------------------------------------------------------------
local ALIAS = {
  ahprice = "ahprice", dbminbuyout = "ahprice", minbuyout = "ahprice", auctionator = "ahprice",
  market = "market", dbmarket = "market", dbhistorical = "market", dbregionmarketavg = "market", dbregionhistorical = "market",
  vendorbuy = "vendorbuy", vendorsell = "vendorsell", crafting = "crafting", levelgold = "levelgold",
}
local FUNCS = { min = true, max = true, first = true, avg = true }

local function tokenize(s)
  local toks, i, n = {}, 1, #s
  s = s:lower()
  while i <= n do
    local ch = s:sub(i, i)
    if ch:match("%s") then
      i = i + 1
    elseif ch:match("[%d%.]") then
      -- Zahl, evtl. Geld (1g50s20c) oder Prozent
      local j = i
      local money, isMoney = 0, false
      while true do
        local num = s:match("^%d+%.?%d*", j) or s:match("^%.%d+", j)
        if not num then break end
        local after = j + #num
        local unit = s:sub(after, after)
        local nextc = s:sub(after + 1, after + 1)
        if (unit == "g" or unit == "s" or unit == "c") and not nextc:match("[%a_]") then
          money = money + tonumber(num) * ((unit == "g" and 10000) or (unit == "s" and 100) or 1)
          isMoney = true
          j = after + 1
        else
          if isMoney then break end
          if unit == "%" then
            toks[#toks + 1] = { t = "pct", v = tonumber(num) / 100 }
            j = after + 1
          else
            toks[#toks + 1] = { t = "num", v = tonumber(num) }
            j = after
          end
          isMoney = nil
          break
        end
      end
      if isMoney then toks[#toks + 1] = { t = "num", v = money } end
      if j == i then return nil, "Zahl nicht lesbar bei: " .. s:sub(i, i + 10) end
      i = j
    elseif ch:match("[%a_]") then
      local word = s:match("^[%a_][%w_]*", i)
      toks[#toks + 1] = { t = "id", v = word }
      i = i + #word
    elseif ch:match("[%(%),%+%-%*/]") then
      toks[#toks + 1] = { t = ch }
      i = i + 1
    else
      return nil, "Unerlaubtes Zeichen: " .. ch
    end
  end
  return toks
end

-- Baut aus den Tokens eine Funktion f(ctx) -> Kupfer oder nil
local function compile(toks)
  local pos = 1
  local function peek() return toks[pos] end
  local function take() pos = pos + 1 return toks[pos - 1] end
  local expr
  local function factor()
    local tk = take()
    if not tk then error("String endet zu früh") end
    if tk.t == "num" then
      local v = tk.v
      return function() return v end
    elseif tk.t == "pct" then
      local f, p = factor(), tk.v
      return function(c) local x = f(c) return x and x * p end
    elseif tk.t == "-" then
      local f = factor()
      return function(c) local x = f(c) return x and -x end
    elseif tk.t == "(" then
      local e = expr()
      local close = take()
      if not close or close.t ~= ")" then error("Klammer ) fehlt") end
      return e
    elseif tk.t == "id" then
      local name = tk.v
      if FUNCS[name] then
        local open = take()
        if not open or open.t ~= "(" then error(name .. " braucht Klammern") end
        local args = {}
        if peek() and peek().t ~= ")" then
          repeat
            args[#args + 1] = expr()
            local sep = peek()
            if sep and sep.t == "," then take() else break end
          until false
        end
        local close = take()
        if not close or close.t ~= ")" then error("Klammer ) fehlt nach " .. name) end
        if #args == 0 then error(name .. " braucht mindestens einen Wert") end
        return function(c)
          local vals = {}
          for i = 1, #args do
            local v = args[i](c)
            if name == "first" and v then return v end
            if v then vals[#vals + 1] = v end
          end
          if #vals == 0 then return nil end
          if name == "min" then return math.min(unpack(vals)) end
          if name == "max" then return math.max(unpack(vals)) end
          if name == "avg" then local s = 0 for _, v in ipairs(vals) do s = s + v end return s / #vals end
          return nil
        end
      end
      local src = ALIAS[name]
      if not src then error("Unbekannte Quelle: " .. name) end
      return function(c) return c.get(src) end
    end
    error("Unerwartet: " .. (tk.v or tk.t))
  end
  local function term()
    local left = factor()
    while peek() and (peek().t == "*" or peek().t == "/") do
      local op = take().t
      local right, l = factor(), left
      left = function(c)
        local a, b = l(c), right(c)
        if not a or not b then return nil end
        if op == "*" then return a * b end
        if b == 0 then return nil end
        return a / b
      end
    end
    return left
  end
  expr = function()
    local left = term()
    while peek() and (peek().t == "+" or peek().t == "-") do
      local op = take().t
      local right, l = term(), left
      left = function(c)
        local a, b = l(c), right(c)
        if not a or not b then return nil end
        return op == "+" and a + b or a - b
      end
    end
    return left
  end
  local fn = expr()
  if pos <= #toks then error("Unerwartet am Ende: " .. (toks[pos].v or toks[pos].t)) end
  return fn
end

local cache = {}
-- Liefert Funktion oder nil, Fehlertext
function PS.Compile(str)
  str = str or ""
  if cache[str] then return cache[str].fn, cache[str].err end
  local fn, err
  local toks, terr = tokenize(str)
  if not toks then
    err = terr
  elseif #toks == 0 then
    err = "Leer"
  else
    local ok, res = pcall(compile, toks)
    if ok then fn = res else err = tostring(res):gsub("^.-:%d+: ", "") end
  end
  cache[str] = { fn = fn, err = err }
  return fn, err
end

-- Aktive Strings (eigene oder empfohlene)
function PS.Get(key)
  local s = ns.settings.priceStrings and ns.settings.priceStrings[key]
  if s and s ~= "" and PS.Compile(s) then return s end
  return PS.DEFAULTS[key]
end

function PS.Set(key, str)
  ns.settings.priceStrings = ns.settings.priceStrings or {}
  local fn, err = PS.Compile(str)
  if not fn then return false, err end
  ns.settings.priceStrings[key] = str
  return true
end

function PS.Reset()
  ns.settings.priceStrings = {}
end

-- Wert eines Items mit einem String berechnen
function PS.Eval(key, itemID, extra)
  local fn = PS.Compile(PS.Get(key))
  if not fn then return nil end
  local M = ns.Market
  local ctx = {
    get = function(src)
      if src == "ahprice" then return M.Price(itemID) end
      if src == "market" then return PS.Market(itemID) end
      if src == "vendorbuy" then return M.VendorBuy(itemID) end
      if src == "vendorsell" then local v = M.VendorSell(itemID) return (v and v > 0) and v or nil end
      if src == "crafting" then return extra and extra.crafting end
      if src == "levelgold" then return select(2, ns.Recipes.Filter()) end
      return nil
    end,
  }
  local ok, v = pcall(fn, ctx)
  if ok and v then return math.floor(v + 0.5) end
  return nil
end

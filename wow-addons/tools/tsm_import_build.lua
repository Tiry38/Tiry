-- Baut Tirys TSM-Importstring (Gruppen + Operationen) im TSM-Exportformat "TSM_EXPORT" v1
-- und prüft ihn danach gegen die Regeln aus TSMs GroupImport.lua / Operation-Definitionen (nachgebaut).
-- Aufruf (aus wow-addons/tools/): lua5.1 tsm_import_build.lua <Ordner mit LibDeflate.lua + LibSerialize.lua> <ausgabe.txt>
-- Bibliotheken (nicht im Repo): github.com/SafeteeWoW/LibDeflate, github.com/rossnichols/LibSerialize (beide MIT/zlib)
local LIBS, OUT = arg[1], arg[2]
local LibDeflate = dofile(LIBS .. "/LibDeflate.lua")
local LibSerialize = dofile(LIBS .. "/LibSerialize.lua")
local ITEMS = dofile(arg[3] or "tsm_import_items.lua")

local GROUP_NAME = "Tiry Gold"
local MODULES = { "Auctioning", "Crafting", "Shopping", "Sniper", "Vendoring", "Warehousing" } -- Mailing ignoriert TSM beim Import

----------------------------------------------------------------------------
-- Operationen (alle Felder je Typ, wie in TSMs *Operation.lua definiert)
----------------------------------------------------------------------------
local function auctioning(t)
  local o = {
    ignoreLowDuration = 0, postCap = "5", keepQuantity = "0", maxExpires = "5", duration = 3, bidPercent = 1,
    undercut = "0c", priceReset = "none", aboveMax = "maxPrice", cancelUndercut = true, cancelRepost = false,
    cancelRepostThreshold = "5s", blacklist = "", matchStackSize = false, stackSize = "1", stackSizeIsCap = false,
  }
  for k, v in pairs(t) do o[k] = v end
  return o
end
local CRAFT_SRC = "first(Crafting, DBMarket, AtrValue)"
local MARKET = "first(DBMarket, AtrValue, AvgSell)"
local OPERATIONS = {
  Auctioning = {
    ["TG Stapel"] = auctioning({
      postCap = "5",
      minPrice = "check(" .. CRAFT_SRC .. ", max(" .. CRAFT_SRC .. " * 1.1 / 0.95 + 1s, 1.5 * VendorSell))",
      normalPrice = "check(" .. CRAFT_SRC .. ", max(1.5 * first(DBMarket, AtrValue), 2 * Crafting, 3 * VendorSell))",
      maxPrice = "check(" .. CRAFT_SRC .. ", max(3 * first(DBMarket, AtrValue), 4 * Crafting, 12 * VendorSell))",
    }),
    ["TG Ruestung"] = auctioning({
      postCap = "2",
      minPrice = "check(" .. CRAFT_SRC .. ", max(" .. CRAFT_SRC .. " * 1.1 / 0.95 + 1s, 1.5 * VendorSell))",
      normalPrice = "check(" .. CRAFT_SRC .. ", max(1.5 * first(DBMarket, AtrValue), 2 * Crafting, 3 * VendorSell))",
      maxPrice = "check(" .. CRAFT_SRC .. ", max(3 * first(DBMarket, AtrValue), 4 * Crafting, 12 * VendorSell))",
    }),
    ["TG Rohstoff"] = auctioning({
      keepQuantity = "20",
      minPrice = "check(" .. MARKET .. ", max(0.8 * " .. MARKET .. ", 1.5 * VendorSell))",
      normalPrice = "check(" .. MARKET .. ", max(1.2 * " .. MARKET .. ", 2 * VendorSell))",
      maxPrice = "check(" .. MARKET .. ", max(3 * " .. MARKET .. ", 12 * VendorSell))",
    }),
  },
  Crafting = {
    ["TG Stapel"] = { minRestock = "5", maxRestock = "20", minProfit = "max(2s, 0.15 * Crafting)", craftPriceMethod = "0.95 * " .. MARKET },
    ["TG Ruestung"] = { minRestock = "1", maxRestock = "2", minProfit = "max(10s, 0.2 * Crafting)", craftPriceMethod = "0.95 * " .. MARKET },
  },
  Shopping = {
    ["TG Einkauf"] = { restockQuantity = "0", maxPrice = "first(0.9 * DBMarket, 0.9 * AtrValue, SmartAvgBuy)", showAboveMaxPrice = false,
      restockSources = { alts = false, auctions = false, bank = false, guild = false } },
    ["TG Haendler"] = { restockQuantity = "0", maxPrice = "0.9 * VendorBuy", showAboveMaxPrice = false,
      restockSources = { alts = false, auctions = false, bank = false, guild = false } },
    ["TG Muster"] = { restockQuantity = "0", maxPrice = "first(0.8 * DBMarket, 0.8 * AtrValue, 3 * VendorSell)", showAboveMaxPrice = false,
      restockSources = { alts = false, auctions = false, bank = false, guild = false } },
  },
  Sniper = {
    ["TG Sniper"] = { belowPrice = "max(VendorSell, first(0.6 * DBMarket, 0.6 * AtrValue))" },
  },
  Vendoring = {
    ["TG Nachkauf"] = { sellAfterExpired = "20", sellSoulbound = false, keepQty = "0", restockQty = "20",
      restockSources = { alts = false, ah = false, bank = false, guild = false, alts_ah = false, mail = false },
      enableBuy = true, enableSell = false, vsMarketValue = "dbmarket", vsMaxMarketValue = "0c", vsDestroyValue = "dbmarket", vsMaxDestroyValue = "0c" },
  },
  Warehousing = {},
}

-- Zuweisung: Pfad -> { Modul -> Liste } (nur Gruppen, die vom Elternteil abweichen = override)
local ASSIGN = {
  [""] = { Auctioning = {}, Crafting = {}, Shopping = {}, Sniper = { "TG Sniper" }, Vendoring = {}, Warehousing = {} },
  ["Leder"] = { Auctioning = { "TG Stapel" }, Crafting = { "TG Stapel" } },
  ["Leder`BoE Jetzt"] = { Auctioning = { "TG Ruestung" }, Crafting = { "TG Ruestung" } },
  ["Leder`BoE Spaeter"] = { Auctioning = { "TG Ruestung" }, Crafting = { "TG Ruestung" } },
  ["Kochen"] = { Auctioning = { "TG Stapel" }, Crafting = { "TG Stapel" } },
  ["Material"] = { Auctioning = { "TG Rohstoff" }, Shopping = { "TG Einkauf" } },
  ["Material`Haendlerware"] = { Auctioning = {}, Shopping = { "TG Haendler" }, Vendoring = { "TG Nachkauf" } },
  ["Muster"] = { Shopping = { "TG Muster" } },
}

----------------------------------------------------------------------------
-- Gruppen, Items, Gruppen-Operationen
----------------------------------------------------------------------------
local groups, items = { [""] = true }, {}
local function addGroup(path)
  while path and path ~= "" do
    groups[path] = true
    path = path:match("^(.*)`[^`]*$")
  end
end
for _, e in ipairs(ITEMS) do
  addGroup(e[2])
  local key = "i:" .. e[1]
  assert(not items[key], "doppelt: " .. key)
  items[key] = e[2]
end
for path in pairs(ASSIGN) do addGroup(path) end
local groupOperations = {}
for path in pairs(groups) do
  local t = {}
  for _, m in ipairs(MODULES) do
    local a = ASSIGN[path] and ASSIGN[path][m]
    local list = {}
    if a then
      for i, n in ipairs(a) do list[i] = n end
      list.override = true
    end
    t[m] = list
  end
  groupOperations[path] = t
end

local serialized = LibSerialize:SerializeEx({ stable = true }, "TSM_EXPORT", 1, GROUP_NAME, items, groups, groupOperations, OPERATIONS, {})
local str = LibDeflate:EncodeForPrint(LibDeflate:CompressDeflate(serialized))

----------------------------------------------------------------------------
-- Prüfung: Dekodieren wie GroupImport:_DecodeNewImport + Regeln nachgebaut
----------------------------------------------------------------------------
local fails = 0
local function check(ok, msg) if not ok then fails = fails + 1 print("FEHLER: " .. msg) end end

local raw = LibDeflate:DecodeForPrint(str)
check(raw, "DecodeForPrint")
local dec, extra = LibDeflate:DecompressDeflate(raw)
check(dec and extra == 0, "DecompressDeflate / Extra-Bytes")
local ok, magic, ver, gName, gItems, gGroups, gOps, gOperations, gCustom = LibSerialize:Deserialize(dec)
check(ok, "Deserialize")
check(magic == "TSM_EXPORT" and ver == 1, "Magic/Version")
check(type(gName) == "string" and gName ~= "" and not gName:find("`"), "Gruppenname top-level")
check(type(gCustom) == "table", "customSources")
local function validPath(p) return type(p) == "string" and not p:match("^`") and not p:match("`$") and not p:match("``") end
for p, v in pairs(gGroups) do
  check(validPath(p) and v == true, "Gruppe " .. tostring(p))
  local parent = p:match("^(.*)`[^`]*$")
  while parent do check(gGroups[parent], "verwaist " .. p) parent = parent:match("^(.*)`[^`]*$") end
  if p ~= "" then check(gGroups[""] , "Wurzel fehlt") end
end
local nItems = 0
for k, p in pairs(gItems) do
  nItems = nItems + 1
  check(type(k) == "string" and k:match("^i:%d+$"), "Item " .. tostring(k))
  check(validPath(p) and gGroups[p], "Item-Gruppe " .. tostring(p))
end
-- Operationen: Modulnamen, Namen, Felder/Typen exakt wie in TSM definiert
local SCHEMA = {
  Auctioning = { ignoreLowDuration = "number", postCap = "cs", keepQuantity = "cs", maxExpires = "cs", duration = "number", bidPercent = "number",
    undercut = "cs", minPrice = "cs", maxPrice = "cs", normalPrice = "cs", priceReset = "string", aboveMax = "string", cancelUndercut = "boolean",
    cancelRepost = "boolean", cancelRepostThreshold = "cs", blacklist = "string", matchStackSize = "boolean", stackSize = "cs", stackSizeIsCap = "boolean" },
  Crafting = { minRestock = "cs", maxRestock = "cs", minProfit = "cs", craftPriceMethod = "cs" },
  Shopping = { restockQuantity = "cs", maxPrice = "cs", showAboveMaxPrice = "boolean", restockSources = "table" },
  Sniper = { belowPrice = "cs" },
  Vendoring = { sellAfterExpired = "cs", sellSoulbound = "boolean", keepQty = "cs", restockQty = "cs", restockSources = "table", enableBuy = "boolean",
    enableSell = "boolean", vsMarketValue = "cs", vsMaxMarketValue = "cs", vsDestroyValue = "cs", vsMaxDestroyValue = "cs" },
  Warehousing = {},
}
local MAXOPS = { Auctioning = 20, Crafting = 1 }

-- Custom-String-Prüfer nach TSMs Tokenizer/Types (Funktionen + Stelligkeit, registrierte Quellen, Geld ohne Dezimalpunkt)
local FUNCS = { check = { 2, 3 }, ifgt = { 3, 4 }, ifgte = { 3, 4 }, iflt = { 3, 4 }, iflte = { 3, 4 }, ifeq = { 3, 4 },
  round = { 1, 2 }, roundup = { 1, 2 }, rounddown = { 1, 2 }, min = { 1, 99 }, max = { 1, 99 }, avg = { 1, 99 }, first = { 1, 99 }, convert = { 1, 2 } }
local SOURCES = {}
for _, s in ipairs({ "VendorBuy", "VendorSell", "AvgSell", "MaxSell", "MinSell", "AvgBuy", "SmartAvgBuy", "MaxBuy", "MinBuy", "DBMarket", "DBMinBuyout",
  "DBRecent", "DBHistorical", "DBRegionMarketAvg", "DBRegionHistorical", "DBRegionSaleAvg", "DBRegionSaleRate", "DBRegionSoldPerDay", "Destroy",
  "Crafting", "MatPrice", "AtrValue" }) do SOURCES[s:lower()] = true end
local function validCS(s, key)
  if s == "" then return key == "craftPriceMethod" end
  local toks, i = {}, 1
  while i <= #s do
    local c = s:sub(i, i)
    if c:match("%s") then i = i + 1
    else
      local money = s:match("^%d+[gsc][%dgsc]*", i)
      local num = s:match("^%d+%.?%d*", i)
      local id = s:match("^%a[%w]*", i)
      if money and money:match("^%d+[gsc]$") or (money and money:match("^%d+g%d+s$")) or (money and money:match("^%d+s%d+c$")) or (money and money:match("^%d+g%d+s%d+c$")) then
        toks[#toks + 1] = { "num" } i = i + #money
      elseif money then return false, "Geld " .. money
      elseif num then
        if s:sub(i + #num, i + #num):match("[gsc]") then return false, "Dezimal-Geld" end
        toks[#toks + 1] = { "num" } i = i + #num
      elseif id then toks[#toks + 1] = { "id", id:lower() } i = i + #id
      elseif c:match("[%+%-%*/%^%(%),]") then toks[#toks + 1] = { c } i = i + 1
      else return false, "Zeichen " .. c end
    end
  end
  -- rekursiver Abstieg: expr := term (op term)*, term := num | source | func(args) | (expr) | -term
  local p = 1
  local expr
  local function term()
    local t = toks[p]
    if not t then return false, "Ende" end
    if t[1] == "-" then p = p + 1 return term() end
    if t[1] == "num" then p = p + 1 return true end
    if t[1] == "(" then p = p + 1 local okk, e = expr() if not okk then return okk, e end if not toks[p] or toks[p][1] ~= ")" then return false, ")" end p = p + 1 return true end
    if t[1] == "id" then
      p = p + 1
      if toks[p] and toks[p][1] == "(" then
        local f = FUNCS[t[2]]
        if not f then return false, "Funktion " .. t[2] end
        p = p + 1
        local n = 0
        while true do
          local okk, e = expr() if not okk then return okk, e end
          n = n + 1
          if toks[p] and toks[p][1] == "," then p = p + 1
          elseif toks[p] and toks[p][1] == ")" then p = p + 1 break
          else return false, "Argumente" end
        end
        if n < f[1] or n > f[2] then return false, "Stelligkeit " .. t[2] .. " " .. n end
        return true
      end
      if not SOURCES[t[2]] then return false, "Quelle " .. t[2] end
      return true
    end
    return false, "unerwartet " .. t[1]
  end
  expr = function()
    local okk, e = term() if not okk then return okk, e end
    while toks[p] and toks[p][1]:match("^[%+%-%*/%^]$") do
      p = p + 1
      okk, e = term() if not okk then return okk, e end
    end
    return true
  end
  local okk, e = expr()
  if okk and p <= #toks then return false, "Rest" end
  return okk, e
end

local nOps = 0
for m, mops in pairs(gOperations) do
  check(SCHEMA[m], "Modul " .. tostring(m))
  for name, set in pairs(mops) do
    nOps = nOps + 1
    check(type(name) == "string" and name ~= "" and name == name:match("^%s*(.-)%s*$"), "Op-Name " .. tostring(name))
    for k, typ in pairs(SCHEMA[m]) do
      local v = set[k]
      local want = typ == "cs" and "string" or typ
      check(type(v) == want, m .. "/" .. name .. "/" .. k .. " fehlt oder falscher Typ")
      if typ == "cs" and type(v) == "string" then
        local okk, e = validCS(v, k)
        check(okk, m .. "/" .. name .. "/" .. k .. " ungültig (" .. tostring(e) .. "): " .. v)
      end
    end
    for k in pairs(set) do check(SCHEMA[m][k], m .. "/" .. name .. ": unbekanntes Feld " .. k) end
  end
end
check(tonumber(OPERATIONS.Crafting["TG Stapel"].minRestock) <= tonumber(OPERATIONS.Crafting["TG Stapel"].maxRestock), "Restock")
for p, t in pairs(gOps) do
  check(gGroups[p], "Gruppen-Op ohne Gruppe " .. p)
  for _, m in ipairs(MODULES) do
    local l = t[m]
    check(type(l) == "table", p .. ": Modul " .. m .. " fehlt")
    if l then
      if p == "" then check(l.override == true, "Wurzel ohne override " .. m) end
      check(l.override == nil or l.override == true, "override-Typ")
      check(#l <= (MAXOPS[m] or 20), "zu viele Ops")
      for k, v in pairs(l) do
        if k ~= "override" then check(type(k) == "number" and k >= 1 and k <= #l and type(v) == "string" and gOperations[m] and gOperations[m][v], p .. "/" .. m .. ": " .. tostring(v)) end
      end
    end
  end
  for m in pairs(t) do local known = false for _, x in ipairs(MODULES) do if x == m then known = true end end check(known, "Modul " .. m) end
end
-- jede Operation wird benutzt (sonst wirft TSM sie raus)
for m, mops in pairs(gOperations) do
  for name in pairs(mops) do
    local used = false
    for _, t in pairs(gOps) do for _, n in ipairs(t[m] or {}) do if n == name then used = true end end end
    check(used, "unbenutzt " .. m .. "/" .. name)
  end
end
local nGroups = 0 for _ in pairs(gGroups) do nGroups = nGroups + 1 end
print(string.format("Items %d, Gruppen %d (inkl. Hauptgruppe), Operationen %d, Länge %d Zeichen, Fehler %d", nItems, nGroups, nOps, #str, fails))
if fails > 0 then os.exit(1) end
local f = assert(io.open(OUT, "w")) f:write(str) f:close()
print("OK")

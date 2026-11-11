-- Zentrale-Prüfrunde 1 (11/2026): je Befund ein Test, der auf dem alten Code fehlschlug.
-- F1–F12 = Gold-Rechnung, M1–M8 = Markt-Datenfluss (Komplett-Scan, Absatz, Verkaufsbuch).
local E = require("addon_env")

local function out() end -- Zahlen nur beim Nachstellen ausgeben (hier still)

local function recipesPage(ns, prof, view)
  SlashCmdList.TIRYSZENTRALE("") ns.UI.Wizard.Finish()
  ns.UI.Show("recipes")
  local p = ns.UI.pages.recipes
  p.prof, p.view = prof, view
  return p
end

local function has(list, id) for _, e in ipairs(list) do if e.r.id == id then return e end end end

describe("F1 Craft-Planer-Warteschlange ignoriert selbst hergestellte Zwischenprodukte", function()
  it("Fehlt-noch / Material-Einkauf / Auctionator-Liste = dieselben Materialien wie die Einkaufsliste", function()
    local prices = { [4233] = 1000, [4232] = 200, [4289] = 50, [2312] = 300, [2321] = 100, [4340] = 100, [4248] = 9000 }
    local ns = E.load({ prices = prices, known = { [3765] = true, [3817] = true } })
    ns.char.queue = { { recipe = 3765, prof = "LEATHERWORKING", n = 2 } }
    local qm, qcost, qprofit = ns.QueueMaterials()
    local shop, _, scost = ns.Shop.List()
    local a, b = {}, {}
    for _, m in ipairs(qm) do a[m.id] = m.n end
    for _, m in ipairs(shop) do if m.missing > 0 then b[m.id] = m.missing end end
    out("F1 QueueMaterials: 4233=%s 4232=%s 4289=%s cost=%d (profit shown %d)", tostring(a[4233]), tostring(a[4232]), tostring(a[4289]), qcost, qprofit)
    out("F1 Shop.List     : 4233=%s 4232=%s 4289=%s cost=%d", tostring(b[4233]), tostring(b[4232]), tostring(b[4289]), scost)
    assert.are.same(b, a)
    assert.are.equal(scost, qcost)
  end)
end)

describe("F2 'Nicht unter' für gesammelte Ware rechnet mit fremdem Rezept", function()
  it("Mittleres Leder (gehäutet, Rezept 20648 nicht gelernt): Neu-Einstellen = Tooltip = Händler-Untergrenze", function()
    -- Standardpreise: Leichtes Leder 32, Mittleres Leder 120
    local ns, W = E.load({})
    W.bags = { [0] = { { itemID = 2319, stackCount = 20, quality = 1 } } }
    ns.AH.Store().list = { { auctionID = 7, id = 2319, qty = 20, unit = 125, status = "expired" } }
    local l = ns.AH.RelistList()
    local vfloor = ns.AH.VendorFloor(2319)
    local tip = table.concat(ns.Extras.TooltipLines(2319), " | ")
    out("F2 known(20648)=%s  AH.Floor=%d  VendorFloor=%d  relist price=%d wait=%s  tooltip has vendor floor=%s",
      tostring(ns.Recipes.IsKnown(ns.Recipes.Get(20648))), ns.AH.Floor(2319), vfloor, l[1].price, tostring(l[1].wait),
      tostring(tip:find("Nicht unter " .. ns.Money(vfloor), 1, true) ~= nil))
    assert.are.equal(vfloor, l[1].floor)
    assert.is_false(l[1].wait)
    assert.are.equal(119, l[1].price)
  end)
end)

describe("F3 'Kaufen bis' passt nicht zur Mindestgewinn-Schwelle des Planers", function()
  it("zum 'Kaufen bis'-Preis steht das Rezept noch im Craft-Planer", function()
    local ns, W = E.load({ prices = { [2318] = 10000, [4231] = 500, [2320] = 10, [2312] = 60000 } })
    local p = recipesPage(ns, "LEATHERWORKING", "known")
    ns.char.queue = { { recipe = 2164, prof = "LEATHERWORKING", n = 1 } }
    local r = ns.Recipes.Get(2164)
    assert.truthy(has(p.Entries(p), 2164), "vorher im Planer")
    local max = ns.Shop.MaxPrice(2318)
    W.prices[2318] = max
    local profit, _, cost = ns.Scanner.RecipeProfit(r)
    local need = ns.PriceString.Eval("minProfit", r.out, { crafting = cost })
    out("F3 Kaufen bis=%d  -> cost=%d profit=%d, Planer verlangt=%d (levelgold=%d)", max, cost, profit, need, select(2, ns.Recipes.Filter()))
    assert.truthy(has(p.Entries(p), 2164), "beim Kaufen-bis-Preis aus dem Planer gefallen")
  end)
end)

describe("F4 Marktwert (14-Tage-Median) nimmt alte und nicht frische Preise", function()
  it("Auctionator-Preis von vor 12 Tagen wird NICHT als heutiger Tagespreis gespeichert", function()
    local ns = E.load({})
    Auctionator.API.v1.GetAuctionAgeByItemID = function() return 12 end
    ns.db.priceHistory = {}
    ns.PriceString.RecordAll()
    local h = ns.db.priceHistory[2318]
    out("F4a gespeichert für heute (%s): %s (Auctionator-Alter 12 Tage)", ns.Today(), tostring(h and h[ns.Today()]))
    assert.is_nil(h and h[ns.Today()])
  end)

  it("10 Monate alte Tagespreise zählen nicht als Marktwert -> kein falsches Schnäppchen", function()
    local ns, W = E.load({ prices = { [2319] = 1000 } })
    W.now = os.time() -- Mock-Uhr (2024) auf echte Zeit, damit "vor 10 Monaten" stimmt
    ns.db.priceHistory = { [2319] = { ["2026-01-05"] = 5000, ["2026-01-06"] = 5000, ["2026-01-07"] = 5000 } }
    local m = ns.PriceString.Market(2319)
    local deal = ns.Deals.Evaluate(2319, { { price = 3000, qty = 20 } })
    out("F4b Marktwert=%s (AH heute 1000), Schnäppchen-Meldung=%s, 'du sparst' %s", tostring(m), tostring(deal ~= nil),
      tostring(deal and deal.save))
    assert.is_nil(deal)
  end)
end)

describe("F5 Rezept-Tipps (Berater) und Craft-Planer 'lernbar' nutzen verschiedene Mindestgewinne", function()
  it("Berater zeigt nur, was der Planer auch zeigt", function()
    local prices = { [4243] = 20000, [4231] = 300, [2320] = 10, [4293] = 9000 }
    local ns, W = E.load({ prices = prices,
      skills = { { name = "Lederverarbeitung", skillID = 165, isHeader = false, rank = 80, maxRank = 150 } } })
    local r = ns.Recipes.Get(3762)
    local cost = 20000 + 600 + 20
    W.prices[4244] = math.ceil((cost + 3050 + ns.Market.DepositRisk(4244)) / 0.95)
    local profit = ns.Scanner.RecipeProfit(r)
    local tip
    for _, t in ipairs(ns.Advisor.RecipeTips(50)) do if t.r.id == 3762 then tip = t end end
    local p = recipesPage(ns, "LEATHERWORKING", "learnable")
    local inPlanner = has(p.Entries(p), 3762) ~= nil
    out("F5 profit=%d, levelgold=%d, 15%% crafting=%d -> Berater=%s, Planer(lernbar)=%s", profit,
      select(2, ns.Recipes.Filter()), math.floor(cost * 0.15 + 0.5), tostring(tip ~= nil), tostring(inPlanner))
    assert.are.equal(inPlanner, tip ~= nil)
  end)
end)

describe("F6 Neu einstellen: Menge zählt eigene laufende Auktionen nicht mit", function()
  it("10 Stück liegen schon im AH (10 Tage Absatz) -> nichts nachlegen", function()
    local ns, W = E.load({ prices = { [2318] = 300, [2304] = 2000 } })
    W.bags = { [0] = { { itemID = 2304, stackCount = 10, quality = 2 } } }
    ns.AH.Store().list = {
      { auctionID = 1, id = 2304, qty = 10, unit = 2000, status = "expired" },
      { auctionID = 2, id = 2304, qty = 10, unit = 2000, status = "active", expires = W.now + 36000 },
    }
    ns.Demand.Store().stats[2304] = { s = 1, h = 24, q = 30, t = W.now } -- 1/Tag
    local l = ns.AH.RelistList()
    out("F6 MarketBatch=%d, schon aktiv=10, Vorschlag 'post'=%d", ns.Demand.MarketBatch(2304), l[1].post)
    assert.are.equal(0, l[1].post)
  end)
end)

describe("F7 Skill-Plan nimmt bei Gewinn-Rezepten die SCHLECHTESTE Skill-Chance", function()
  it("orange (100 %%, +50c) schlägt grün (20 %%, +20c je Craft)", function()
    local ns = E.load({ prices = { [2318] = 100, [2319] = 100, [2304] = 160, [4239] = 130 },
      itemInfo = { [2304] = { name = "A", stack = 20, sell = 1 }, [4239] = { name = "B", stack = 20, sell = 1 } },
      skills = { { name = "Lederverarbeitung", skillID = 165, isHeader = false, rank = 100, maxRank = 150 } } })
    local A = { id = 1, name = "A", out = 2304, qty = 1, yellow = 200, grey = 240, reagents = { { id = 2318, n = 1 } } }
    local B = { id = 2, name = "B", out = 4239, qty = 1, yellow = 60, grey = 110, reagents = { { id = 2319, n = 1 } } }
    ns.Recipes.List = function() return { A, B }, 100 end
    local plan = ns.Advisor.Plan("LEATHERWORKING", 1)
    local s = plan.steps[1]
    out("F7 net A=%d (Chance %.2f), net B=%d (Chance %.2f) -> gewählt %s, %d Crafts für 1 Punkt",
      100 - ns.Advisor.Resale(A), ns.Advisor.Chance(A, 100), 100 - ns.Advisor.Resale(B), ns.Advisor.Chance(B, 100), s.recipe.name, s.crafts)
    assert.are.equal("A", s.recipe.name)
  end)
end)

describe("F8 Skill-Plan-Erlös und Craft-Planer-Erlös rechnen verschieden", function()
  it("Advisor.Resale nutzt denselben Verkaufswert wie RecipeProfit (min(AH, 125 % Marktwert))", function()
    local ns = E.load({ prices = { [2318] = 300, [2320] = 10, [4231] = 500, [2304] = 6000 } })
    ns.db.priceHistory = { [2304] = { [ns.Today()] = 2000 } }
    local r = ns.Recipes.Get(2152)
    local _, revenue = ns.Scanner.RecipeProfit(r)
    out("F8 Craft-Planer Erlös=%d, Skill-Plan Erlös=%d (AH 6000, Marktwert 2000)", revenue, ns.Advisor.Resale(r))
    assert.are.equal(revenue, ns.Advisor.Resale(r))
  end)
end)

describe("F9 Rezepte ohne Skill-Grenzen (gelb=grau=0) gelten ewig als orange", function()
  it("Winterstiefel: 100 %% Skill-Chance bei jedem Skill", function()
    local ns = E.load({})
    local r = ns.Recipes.Get(44953)
    out("F9 %s yellow=%d grey=%d Chance@299=%s Farbe=%s", r.name, r.yellow, r.grey, tostring(ns.Advisor.Chance(r, 299)),
      tostring(ns.Recipes.Difficulty(r, 299)))
    assert.are.equal(0, ns.Advisor.Chance(r, 299))
  end)
end)

describe("F10 Verkaufswert ohne AH-Preis = 125 % des Marktwerts", function()
  it("craftValue ohne aktuellen AH-Preis nimmt den Marktwert, nicht 125 %", function()
    local ns = E.load({ prices = { [2318] = 300 } })
    ns.db.priceHistory = { [2304] = { [ns.Today()] = 2000 } }
    local v = ns.PriceString.Eval("craftValue", 2304)
    out("F10 AH-Preis=nil, Marktwert=2000 -> craftValue=%s", tostring(v))
    assert.are.equal(2000, v)
  end)
end)

describe("F11 Materialpreis im Planer und in der Einkaufsliste verschieden", function()
  it("Grobes Garn: Händler 50, AH 10 -> beide Seiten gleich", function()
    local ns = E.load({ prices = { [2318] = 300, [2320] = 10, [4231] = 500, [2312] = 6000 } })
    ns.db.vendorBuy[2320] = 50
    ns.char.queue = { { recipe = 2164, prof = "LEATHERWORKING", n = 1 } }
    local plan = ns.Scanner.MatCost(2320)
    local e
    for _, x in ipairs((ns.Shop.List())) do if x.id == 2320 then e = x end end
    out("F11 Craft-Planer Stückpreis=%s, Einkaufsliste Stückpreis=%s (%s)", tostring(plan), tostring(e.unit), tostring(e.where))
    assert.are.equal(plan, e.unit)
  end)
end)

describe("F12 Einstellgebühr-Risiko bei 200er-Stapeln (Munition) mit 20er-Angebot gerechnet", function()
  it("Explosiver Pfeil: Risiko je Stück wie bei einem 200er-Angebot", function()
    local ns = E.load({ prices = { [10579] = 20 } })
    local r = ns.Recipes.Get(12719)
    assert.truthy(r)
    assert.are.equal(ns.Market.DepositRisk(10579, 200), ns.Market.DepositRisk(10579))
  end)
end)

----------------------------------------------------------------------------
-- Markt-Datenfluss
----------------------------------------------------------------------------
-- Komplett-Scan-Nachbau: rows[i] = { itemID, Menge, Stückpreis, Verkäufer (nil = unbekannt), Restlaufzeit-Band }
local function replicate(getRows)
  local AH = C_AuctionHouse
  AH.GetNumReplicateItems = function() return #getRows() end
  AH.GetReplicateItemInfo = function(i)
    local a = getRows()[i + 1]
    return nil, nil, a[2], 1, true, 1, nil, 0, 0, a[3] * a[2], 0, nil, nil, a[4], a[4], 0, a[1], true
  end
  AH.GetReplicateItemTimeLeft = function(i) return getRows()[i + 1][5] end
  local bmin, bmax = { [0] = 0, 1800, 7200, 43200 }, { [0] = 1800, 7200, 43200, 172800 }
  AH.GetTimeLeftBandInfo = function(band) return bmin[band], bmax[band] end
end

-- Gleichbleibender Markt: 30 Angebote Leichtes Leder (alle "sehr lang") + 300 andere, nicht beobachtete Items
local function leatherMarket(owner)
  local rows = {}
  for i = 1, 30 do rows[i] = { 2318, 20, 40 + (i % 5), (owner or "Ana") .. i, 3 } end
  for i = 1, 300 do rows[#rows + 1] = { 100000 + i, 1, 500, "X" .. i, 3 } end
  return rows
end

local LEDER = { [2318] = { name = "Leichtes Leder", sell = 10, stack = 20 } }

local function scan(W)
  C_AuctionHouse.ReplicateItems() W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
end

describe("M1 Item fällt aus der Beobachtungsliste -> keine erfundenen Verkäufe", function()
  it("Twink mit anderem Beruf scannt das unveränderte AH: nichts gilt als verkauft", function()
    local ns, W = E.load({ itemInfo = LEDER })
    -- Leichte Rüstungsverstärkung (2304): nur auf der Liste des Lederers, nicht des Schneiders
    local rows = leatherMarket()
    for i = 1, 30 do rows[i][1] = 2304 end
    replicate(function() return rows end)
    ns.Market.ahOpen = true
    assert.is_true(ns.Demand.Watchlist()[2304] == true)
    scan(W)
    W.skills = { { name = "Berufe", isHeader = true }, { name = "Schneiderei", skillID = 197, isHeader = false, rank = 100, maxRank = 150 } }
    ns.UpdateProfessions()
    ns.char = { days = {}, sessions = {} }
    assert.is_falsy(ns.Demand.Watchlist()[2304])
    W.now = W.now + 3600
    scan(W)
    local st = ns.Demand.Store().stats[2304]
    assert.are.equal(0, st.s)
    assert.are_not.equal(0, st.q, "nicht ausverkauft")
    assert.are.same({}, W.errors)
  end)

  it("eigene Auktion verschwindet aus der Liste: Item danach nicht 'ausverkauft'", function()
    local ns, W = E.load({ itemInfo = { [4306] = { name = "Seidenstoff", sell = 150, stack = 20 } } })
    local rows = {}
    for i = 1, 40 do rows[i] = { 4306, 20, 900, "S" .. i, 3 } end
    for i = 1, 300 do rows[#rows + 1] = { 100000 + i, 1, 500, "X" .. i, 3 } end
    replicate(function() return rows end)
    ns.Market.ahOpen = true
    ns.AH.Store().list = { { auctionID = 7, id = 4306, qty = 20, unit = 950, status = "active", commodity = true, expires = W.now + 86400 } }
    assert.is_true(ns.Demand.Watchlist()[4306] == true)
    scan(W)
    ns.AH.Store().list = {}
    W.now = W.now + 3600
    scan(W)
    local x = ns.Demand.Store().stats[4306]
    assert.are.equal(0, x.s)
    assert.are.same({}, W.errors)
  end)
end)

describe("M2 Realms getrennt", function()
  it("gleiche Fraktion, anderes Realm: kein Vergleich mit dem fremden Markt", function()
    local ns, W = E.load({ itemInfo = LEDER })
    local rows = leatherMarket("Ana")
    replicate(function() return rows end)
    ns.Market.ahOpen = true
    scan(W)
    _G.GetRealmName = function() return "Anderes-Realm" end
    rows = leatherMarket("Bob")
    W.now = W.now + 7200
    scan(W)
    local x = ns.Demand.Store().stats[2318]
    assert.are.equal(0, x.s)
    assert.are.same({}, W.errors)
  end)

  it("alte Daten (nur Fraktion als Schlüssel) werden einmal übernommen", function()
    local ns = E.load({})
    ns.db.demand = { Horde = { stats = { [2318] = { s = 5, h = 10 } } } }
    assert.are.equal(5, ns.Demand.Store().stats[2318].s)
    assert.is_nil(ns.db.demand.Horde)
  end)
end)

describe("M3 Teil-Scan (55 % der Angebote) wird erkannt", function()
  it("meldet 'unvollständig' und misst nichts", function()
    local ns, W = E.load({ itemInfo = LEDER })
    local full = leatherMarket()
    local rows = full
    replicate(function() return rows end)
    ns.Market.ahOpen = true
    scan(W)
    local part = {}
    for i = 1, math.floor(#full * 0.55) do part[#part + 1] = full[#full - i + 1] end
    rows = part
    W.now = W.now + 3600
    scan(W)
    assert.truthy(E.chat(W):find("unvollständig", 1, true))
    assert.are.equal(0, ns.Demand.Store().stats[2318].s)
  end)
end)

describe("M4 Marktwert-Verlauf nur aus frischen Beobachtungen", function()
  it("6 Logins ohne Scan = 1 Tag im Verlauf, nicht 6", function()
    local ns, W = E.load({ prices = { [2318] = 40 } })
    ns.db.priceHistory = {}
    local seen = W.now - 86400 -- Auctionator hat 2318 einmal gesehen (gestern)
    Auctionator.API.v1.GetAuctionAgeByItemID = function(_, id)
      if id ~= 2318 then return nil end
      return math.floor((W.now - seen) / 86400)
    end
    _G.date = function(f, t) return os.date(f, t or W.now) end
    for _ = 1, 6 do
      W.now = W.now + 86400
      ns.PriceString.RecordAll()
    end
    local days = 0
    for _ in pairs(ns.db.priceHistory[2318] or {}) do days = days + 1 end
    assert.are.equal(1, days)
  end)
end)

describe("M5 Verkaufsbuch: gleiche Verkäufe in derselben Stunde", function()
  it("zwei gleiche Stapelware-Briefe (Käufer anonym) = zwei Verkäufe, auch beim erneuten Lesen", function()
    local ns, W = E.load({})
    W.mails = {
      { money = 760, daysLeft = 29.9, invoice = { "seller", "Leichtes Leder", nil, 800, 20 } },
      { money = 760, daysLeft = 29.9, invoice = { "seller", "Leichtes Leder", nil, 800, 20 } },
    }
    ns.Ledger.ScanInbox()
    ns.Ledger.ScanInbox()
    local b = ns.db.ledger
    local units = 0
    for _, s in ipairs(b.sales) do units = units + (s.n or 0) end
    assert.are.equal(2, #b.sales)
    assert.are.equal(40, units)
  end)
end)

describe("M6 Abgebrochener Scan setzt 'unterboten' nicht zurück", function()
  it("Teil-Scan nach vollem Scan: unterboten bleibt, Einzelprüfung bleibt möglich", function()
    local ns, W = E.load({ itemInfo = LEDER })
    local s = ns.AH.Store()
    s.list = { { auctionID = 1, id = 2318, qty = 20, unit = 50, status = "active", commodity = true, expires = W.now + 86400 } }
    local full = { { 2318, 10, 45, "Bo", 3 } }
    for i = 1, 400 do full[#full + 1] = { 100000 + i, 1, 500, "X" .. i, 3 } end
    local rows = full
    replicate(function() return rows end)
    ns.Market.ahOpen = true
    scan(W)
    assert.is_true(s.list[1].undercut)
    local part = {}
    for i = 201, 260 do part[#part + 1] = full[i] end
    rows = part
    W.now = W.now + 1200
    scan(W)
    assert.is_true(s.list[1].undercut)
  end)
end)

describe("M7 Verkäufername fehlt (owner kann nil sein)", function()
  it("kein erfundener Verkauf, wenn Namen im ersten Scan fehlen", function()
    local ns, W = E.load({ itemInfo = LEDER })
    local named = leatherMarket()
    local anon = {}
    for i, r in ipairs(named) do
      local who = r[4]
      if i <= 10 then who = nil end
      anon[i] = { r[1], r[2], r[3], who, r[5] }
    end
    local rows = anon
    replicate(function() return rows end)
    ns.Market.ahOpen = true
    scan(W)
    rows = named
    W.now = W.now + 3600
    scan(W)
    assert.are.equal(0, ns.Demand.Store().stats[2318].s)
  end)
end)

describe("M8 Fehler mitten im Lesen sperrt keine weiteren Scans", function()
  it("nach einem Fehler läuft der nächste Komplett-Scan wieder", function()
    local ns, W = E.load({ itemInfo = LEDER })
    local rows = {}
    for i = 1, 30 do rows[i] = { 2318, 20, 40, "Ana" .. i, 3 } end
    replicate(function() return rows end)
    ns.Market.ahOpen = true
    local orig, boom = ns.Snipe.Collect, true
    ns.Snipe.Collect = function(...) if boom then boom = false error("Testfehler in einer Zeile") end return orig(...) end
    scan(W)
    W.now = W.now + 3600
    assert.is_true(ns.Demand.ReadReplicate())
    W.flush()
  end)
end)

describe("U5 Flip-Knopf rechnet mit veraltetem AH-Preis", function()
  local function merchantFlips(age)
    local ns, W = E.load({ prices = { [2320] = 500 } })
    _G.Auctionator.API.v1.GetAuctionAgeByItemID = function(_, id) return id == 2320 and age or nil end
    W.merchant = { { id = 2320, name = "Grober Faden", price = 10 } }
    ns.Scanner.ScanMerchant()
    return ns.Scanner.merchant.flips
  end
  it("frischer Preis (1 Tag) = Flip, alter Preis (10 Tage) = kein Flip", function()
    assert.are.equal(1, #merchantFlips(1))
    assert.are.equal(0, #merchantFlips(10))
  end)
end)

describe("U8 Schnellsuche baut alle Treffer der Datenbank", function()
  it("mit Limit nur so viele Einträge wie gebraucht, gleiche Reihenfolge wie ohne Limit", function()
    local ns = E.load({})
    local all = ns.DB.Search("leder")
    local few = ns.DB.Search("leder", nil, nil, 5)
    assert.truthy(#all > 5)
    assert.are.equal(5, #few)
    for i = 1, 5 do assert.are.equal(all[i].id, few[i].id) end
  end)
end)

describe("U13 Slash-Befehl mit Umlaut in Großschrift", function()
  it("/tz KÜRSCHNER öffnet die Kürschner-Seite", function()
    local ns = E.load({})
    SlashCmdList.TIRYSZENTRALE("") ns.UI.Wizard.Finish()
    SlashCmdList.TIRYSZENTRALE("  KÜRSCHNER ")
    assert.are.equal("skinning", ns.UI.current)
  end)
end)

describe("D1 Hotfix 10.11.2026: Mindest-Einstellgebühr 1 Kupfer statt 1 Silber", function()
  it("alter Standard 100 wird auf 1 umgestellt, alte gemerkte Gebühren vergessen, eigener Wert bleibt", function()
    local ns = E.load({ db = { settings = { ahDeposit = 100 }, deposits = { [2318] = { [2] = { v = 100, q = 1, t = 1 } } } } })
    assert.are.equal(1, ns.settings.ahDeposit)
    assert.is_nil(next(ns.db.deposits))
    local ns2 = E.load({ db = { settings = { ahDeposit = 250 } } })
    assert.are.equal(250, ns2.settings.ahDeposit)
    -- nur einmal: wer danach bewusst 100 einstellt, behält das
    local db = { settings = { ahDeposit = 100 }, dep1c = true }
    local ns3 = E.load({ db = db })
    assert.are.equal(100, ns3.settings.ahDeposit)
  end)
end)

describe("D2 Handwerks-Stationen (Forever: 303 Rezepte brauchen eine Lager-Station)", function()
  it("Gerbrahmen-Rezept: Hinweis mit Bauplan, ohne Hinweis bei Amboss; wer den Bauplan kennt, baut selbst", function()
    local ns = E.load({})
    local R = ns.Recipes
    local r = R.Get(3778)
    local s = R.Station(r)
    assert.are.equal("Gerbrahmen", s.name) assert.are.equal("camp", s.kind)
    assert.truthy(R.StationText(r):find("braucht Gerbrahmen", 1, true))
    assert.truthy(R.StationText(r):find("Bauplan", 1, true))
    assert.is_nil(R.StationText(R.Get(3326)))                    -- Grober Schleifstein: Amboss steht in jeder Stadt
    local ns2 = E.load({ known = { [1263031] = true } })
    assert.truthy(ns2.Recipes.StationText(ns2.Recipes.Get(3778)):find("stellst du selbst", 1, true))
  end)
end)

describe("D3 Seelengebundene Rezept-Items: keine AH-Suche, kein AH-Preis", function()
  it("Rezept: Schattenöl (BoP in Forever) – Herkunft Händler, Payback ohne AH-Preis, nicht in der Such-Liste", function()
    local ns = E.load({ prices = { [6068] = 5000 } })
    local R = ns.Recipes
    local r = R.Get(3449)
    local info = R.ItemInfo(r)
    assert.is_true(info.bop) assert.are.equal("v", info.src)
    local item, price = R.Payback(r, 100)
    assert.are.equal(6068, item) assert.is_nil(price)
    assert.truthy(R.BopText(r):find("beim Händler", 1, true))
  end)
end)

describe("D5 Blizzard-Hotfixes 06./10.11. über den Spieldaten", function()
  it("Gerbrahmen ab 125 (gelb 125, grau 130), Grober Schleifstein grau 90, Eisengranate Händlerpreis 1s 25c", function()
    local ns = E.load({})
    local R = ns.Recipes
    local g = R.Get(1263031)
    assert.are.equal(125, g.yellow) assert.are.equal(130, g.grey)
    assert.are.equal(125, (R.LearnSkill(g)))
    assert.are.equal(90, R.Get(3326).grey)
    assert.are.equal(125, ns.Item(4390).sell)
  end)
end)

describe("D8 Zufallsmengen werden als Spanne gezeigt", function()
  it("Grobes Dynamit: 1–3 (Rechnung mit Mittelwert 2)", function()
    local ns = E.load({})
    local r = ns.Recipes.Get(3931)
    assert.are.equal("1–3", ns.Recipes.QtyText(r))
    assert.are.equal(2, r.qty)
    assert.are.equal("1", ns.Recipes.QtyText(ns.Recipes.Get(3326)))
  end)
end)

describe("U5b Händler-Flip auf seelengebundene Ware", function()
  it("Rezept: Schattenöl beim Händler billig, im AH teuer – trotzdem kein Flip (nicht verkaufbar)", function()
    local ns, W = E.load({ prices = { [6068] = 50000 } })
    W.merchant = { { id = 6068, name = "Rezept: Schattenöl", price = 1800 } }
    ns.Scanner.ScanMerchant()
    assert.are.equal(0, #ns.Scanner.merchant.flips)
  end)
end)

describe("D4 Erz-Fundorte: Spawn-Pool-Punkte zählen einmal, Erze passend zur Stufe", function()
  it("keine Stelle über 80 Punkte, kein Mithril/Echtsilber unter Stufe 30; Schildkrötenschuppe hat Fundorte", function()
    local ns = E.load({})
    for band, groups in pairs(ns.SPOTS) do
      for _, s in ipairs(groups.ore or {}) do
        assert.truthy(s.n <= 80, band .. " Erz-Stelle mit " .. s.n .. " Punkten")
        if band == "1-10" or band == "10-20" or band == "20-30" then
          for _, id in ipairs(s.items) do assert.truthy(id ~= 3858 and id ~= 7911, band .. ": " .. id) end
        end
      end
    end
    assert.truthy(#ns.SKIN_SPOTS[8167] >= 2)
  end)
end)

describe("P1 Suche ruckelfrei (sortierter Namens-Index)", function()
  it("Ergebnis nach Name sortiert (ä = a), ohne Platzhalter, Limit = Anfang der vollen Liste", function()
    local ns = E.load({})
    local key = function(e) return (ns.DB.Lower(e.name):gsub("\195\164", "a"):gsub("\195\182", "o"):gsub("\195\188", "u"):gsub("\195\159", "ss")) end
    local all = ns.DB.Search("trank")
    assert.truthy(#all > 50)
    for i = 2, #all do
      local a, b = key(all[i - 1]), key(all[i])
      assert.truthy(a < b or (a == b and all[i - 1].id < all[i].id), all[i - 1].name .. " / " .. all[i].name)
      assert.is_false(ns.DB.IsJunk(all[i].name))
    end
    local few = ns.DB.Search("TRANK", nil, nil, 14)
    for i = 1, 14 do assert.are.equal(all[i].id, few[i].id) end
    assert.are.same(ns.DB.Search("trank", nil, "name"), all)
  end)
  it("50 Tipp-Suchen mit kurzem Wort brauchen zusammen unter 0,3 s", function()
    local ns = E.load({})
    ns.DB.Search("a", nil, nil, 1) -- Index einmal bauen
    local t0 = os.clock()
    for i = 1, 50 do ns.DB.Search(i % 2 == 0 and "er" or "e", nil, nil, 14) end
    assert.truthy(os.clock() - t0 < 0.3, string.format("%.3f s", os.clock() - t0))
  end)
  it("gleiche Preise/Namen: feste Reihenfolge nach ID", function()
    local ns = E.load({})
    local r = ns.DB.Search("öl", nil, "sell")
    for i = 2, #r do
      local a, b = r[i - 1], r[i]
      assert.truthy(a.sell > b.sell or (a.sell == b.sell and (a.name < b.name or (a.name == b.name and a.id < b.id))))
    end
  end)
end)

describe("P2 Unterwegs-Gold: nur was du mit deinem Skill sammeln kannst", function()
  local herb40 = { { name = "Berufe", isHeader = true, isCollapsed = false },
    { name = "Kräuterkunde", skillID = 182, isHeader = false, rank = 40, maxRank = 75 } }
  local function group(info, key) for _, g in ipairs(info.groups) do if g.key == key then return g end end end
  it("Kräuterkunde 40 im Brachland: kein Königsblut (125), dafür Hinweis 'ab Skill 125'", function()
    local ns, W = E.load({ skills = herb40, prices = { [3356] = 3000, [765] = 20, [2449] = 30, [2447] = 25, [785] = 60 } })
    local g = group(ns.ZoneGold.ForMap(1413), "herb")
    assert.truthy(g)
    for _, it in ipairs(g.items) do
      assert.truthy((ns.GATHER_SKILL[it.id] or 0) <= 40, ns.Item(it.id).name)
    end
    assert.truthy(g.later and g.later.id == 3356 and g.later.skill == 125)
    assert.are.same({}, W.errors)
  end)
  it("Kürschnerei 102 in Tausend Nadeln: keine Schildkrötenschuppe (Tiere ab Stufe 30)", function()
    local ns = E.load({ prices = { [8167] = 4700, [2318] = 32, [2319] = 120, [4232] = 160 } })
    assert.are.equal(20, ns.Skin.MaxLevel(102))
    local info = ns.ZoneGold.ForMap(1441)
    local g = info and group(info, "leather")
    for _, it in ipairs(g and g.items or {}) do assert.are_not.equal(8167, it.id) end
    -- mit Skill 175 ist sie dabei
    local ns2 = E.load({ prices = { [8167] = 4700 }, skills = { { name = "Berufe", isHeader = true, isCollapsed = false },
      { name = "Kürschnerei", skillID = 393, isHeader = false, rank = 175, maxRank = 225 } } })
    local g2 = group(ns2.ZoneGold.ForMap(1441), "leather")
    local has = false
    for _, it in ipairs(g2.items) do if it.id == 8167 then has = true end end
    assert.is_true(has)
  end)
  it("fehlender Beruf: Vorschau nur bis ca. 5 × Stufe (Stufe 21 -> kein Königsblut)", function()
    local ns = E.load({ prices = { [3356] = 3000, [765] = 20, [2449] = 30 } })
    local m = ns.ZoneGold.ForMap(1413).missed
    if m and m.key == "herb" then
      for _, it in ipairs(m.items) do assert.truthy((ns.GATHER_SKILL[it.id] or 0) <= 105) end
    end
  end)
  it("Elemente je Stelle: Feralas = Elementarwasser, Ödland = Elementarerde", function()
    local ns = E.load({ prices = { [7068] = 9000, [7067] = 3000, [7070] = 2000, [12808] = 9999 } })
    local fer = group(ns.ZoneGold.ForMap(1444), "special")
    assert.are.equal(7070, fer.items[1].id)
    for _, it in ipairs(fer.items) do assert.are_not.equal(7068, it.id) end
    local bad = group(ns.ZoneGold.ForMap(1418), "special")
    assert.are.equal(7067, bad.items[1].id)
    for _, it in ipairs(bad.items) do assert.are_not.equal(7068, it.id) end
    for _, band in pairs(ns.SPOTS) do
      for _, s in ipairs(band.special or {}) do assert.truthy(#s.items > 0, "Stelle ohne Beute: " .. s.names[1]) end
    end
  end)
  it("in der Stadt: Gebiet bleibt Orgrimmar (nicht 'Kosmos')", function()
    local ns = E.load({})
    _G.C_Map.GetBestMapForUnit = function() return 1454 end
    local parents = { [1454] = 1414, [1414] = 947, [947] = 946 }
    _G.C_Map.GetMapInfo = function(m) return { name = "Karte" .. m, parentMapID = parents[m] } end
    assert.are.equal(1454, ns.ZoneGold.CurrentMap())
  end)
  it("Gebietswechsel aktualisiert die Startseiten-Karte", function()
    local ns, W = E.load({ prices = { [4232] = 3000, [2319] = 2000 } })
    SlashCmdList.TIRYSZENTRALE("") ns.UI.Wizard.Finish()
    ns.UI.Show("home")
    local card = ns.UI.pages.home.zoneCard
    assert.truthy(card.title:GetText():find("Brachland", 1, true))
    _G.C_Map.GetBestMapForUnit = function() return 1442 end
    W.fire("ZONE_CHANGED_NEW_AREA") W.flush() W.flush()
    assert.truthy(card.title:GetText():find("Steinkrallen", 1, true), card.title:GetText())
    assert.are.same({}, W.errors)
  end)
end)

describe("P3 Sparziel: Eingabe, Reitkosten, Anzeige", function()
  local G = 10000
  it("deutsche Tausenderpunkte: 1.200 = 1.200 Gold, 1,5 = 1,5 Gold, 1.5 bleibt 1,5", function()
    local ns = E.load({})
    local GZ = ns.Goal
    assert.are.equal(1200 * G, GZ.ParseAmount("1.200"))
    assert.are.equal(1000 * G, GZ.ParseAmount("1.000"))
    assert.are.equal(1000000 * G, GZ.ParseAmount("1.000.000"))
    assert.are.equal(15000, GZ.ParseAmount("1,5"))
    assert.are.equal(15000, GZ.ParseAmount("1.5"))
    assert.are.equal(25005000, GZ.ParseAmount("2.500,5"))
    assert.are.equal(1200 * G, ns.ParseMoney("1.200g"))
    assert.are.equal(1200 * G + 5000, ns.ParseMoney("1.200g 50s"))
    assert.are.equal(4500, ns.ParseMoney("45"))
    assert.are.equal(15000, ns.ParseMoney("1,5g"))
  end)
  it("1.000 im Ziel-Feld eintippen: Ziel 1.000 Gold, kein falsches 'erreicht'", function()
    local ns, W = E.load({ level = 25, money = 50 * G })
    SlashCmdList.TIRYSZENTRALE("") ns.UI.Wizard.Finish()
    ns.UI.Show("home")
    local st = ns.UI.pages.home.goalCard.amount
    local eb = st.edit
    assert.truthy(eb)
    eb:SetText("1.000")
    eb:GetScript("OnEnterPressed")(eb)
    assert.are.equal(1000 * G, ns.Goal.Get().amount)
    W.fire("PLAYER_MONEY") W.flush()
    assert.falsy(E.chat(W):find("Sparziel erreicht", 1, true))
    eb:SetText("quatsch")
    eb:GetScript("OnEnterPressed")(eb)
    assert.truthy(E.chat(W):find("250 (= 250 Gold)", 1, true))
  end)
  it("Schnelles Reiten = 1.000 g Training + 200 g Reittier", function()
    local ns = E.load({})
    for _, p in ipairs(ns.Goal.PRESETS) do
      if p.key == "ride60" then assert.are.equal(1200 * G, p.amount) end
      if p.key == "ride40" then assert.are.equal(100 * G, p.amount) end
    end
  end)
  it("Post deckt den Rest: kein 'ca. 0 Spieltage', kein Post-Schritt doppelt", function()
    local ns, W = E.load({ level = 25, money = 80 * G })
    ns.Goal.Set("custom", 100 * G)
    ns.AH.Summary = function() return { mailGold = 25 * G, onWay = 0, value = 0 } end
    local st = ns.Goal.Status()
    assert.are.equal(0, st.missing)
    assert.are.equal(20 * G, st.missingNow)
    for _, b in ipairs(ns.Goal.Boosts()) do assert.are_not.equal("mail", b.key) end
    SlashCmdList.TIRYSZENTRALE("") ns.UI.Wizard.Finish()
    ns.UI.Show("home")
    local card = ns.UI.pages.home.goalCard
    assert.are.equal("Post abholen – dann geschafft!", card.eta:GetText())
    assert.falsy(card.chip:IsShown() and card.chip.text and card.chip.text:GetText() == "Geschafft!")
    assert.are.same({}, W.errors)
  end)
  it("Gold aller Charaktere wird angezeigt (Modul ns.Inv)", function()
    local ns = E.load({ level = 25, money = 30 * G })
    ns.Inv.UpdateBags()
    local realm = ns.db.inv[next(ns.db.inv)]
    realm["Zweitchar"] = { money = 70 * G, bags = {}, bank = {}, mail = {} }
    local st = ns.Goal.Status()
    assert.are.equal(100 * G, st.allChars)
  end)
  it("Einstellgebühr: Regler-× setzt auf 1 Kupfer zurück (nicht 1 Silber)", function()
    local ns = E.load({})
    local src = io.open("TirysZentrale/UI/PageSettings.lua"):read("*a")
    assert.truthy(src:find("function%(v%) return ns.Money%(v%) end, 1%)"), "Standardwert des Reglers = 1")
    assert.are.equal(1, ns.settings.ahDeposit)
  end)
end)

describe("P4 Blizzard-Hotfixes wirken überall", function()
  it("Eisengranate: Händlerpreis 1s 25c auch wenn das Spiel noch 5s meldet; kein falsches Händler-Schnäppchen", function()
    local ns = E.load({ itemInfo = { [4390] = { name = "Eisengranate", stack = 10, sell = 500 } } })
    assert.are.equal(125, ns.Item(4390).sell)
    assert.are.equal(125, ns.Market.VendorSell(4390))
    assert.are.equal(125, ns.DB.Get(4390).sell)
    ns.Snipe.Begin()
    ns.Snipe.Collect(4390, 10, 2000, "Fremder") -- 10 Stück für 20 Silber = 2s je Stück
    ns.Snipe.Finish()
    for _, e in ipairs(ns.Snipe.list) do assert.are_not.equal(4390, e.id) end
  end)
  it("Schwaches Arkanelixier 5c, Milde Gewürze 1c (Datenbank und Sortierung)", function()
    local ns = E.load({})
    assert.are.equal(5, ns.DB.Get(247754).sell)
    assert.are.equal(1, ns.DB.Get(2678).sell)
    for _, e in ipairs(ns.DB.Search("arkanelixier", nil, "sell")) do
      if e.id == 247754 then assert.are.equal(5, e.sell) end
    end
  end)
  it("Flinkschlagschuss/Flinkfederpfeil handelbar, Rassen-Reittiere vom Händler seelengebunden", function()
    local ns = E.load({})
    assert.are.equal(0, ns.DB.Get(274388).bind)
    assert.are.equal(0, ns.DB.Get(274387).bind)
    assert.are.equal(1, ns.DB.Get(1132).bind)  -- Horn des Waldwolfs
    assert.are.equal(1, ns.DB.Get(18796).bind) -- Horn des schnellen braunen Wolfs
    assert.are.equal(3, ns.DB.Get(12302).bind) -- Zügel des Frostsäblers (kein Rassen-Händler laut QuestieDB) unverändert
  end)
end)

describe("P5 Skill-Plan: bei Gewinn zählt auch die Chance", function()
  it("100 %% mit etwas Gewinn schlägt 20 %% mit kaum mehr Gewinn (5 Crafts je Punkt)", function()
    local ns = E.load({ prices = { [2318] = 100, [2319] = 100, [2304] = 470, [4239] = 480 },
      itemInfo = { [2304] = { name = "A", stack = 20, sell = 1 }, [4239] = { name = "B", stack = 20, sell = 1 } },
      skills = { { name = "Lederverarbeitung", skillID = 165, isHeader = false, rank = 100, maxRank = 150 } } })
    local A = { id = 1, name = "A", out = 2304, qty = 1, yellow = 200, grey = 240, reagents = { { id = 2318, n = 1 } } }
    local B = { id = 2, name = "B", out = 4239, qty = 1, yellow = 60, grey = 110, reagents = { { id = 2319, n = 1 } } }
    ns.Recipes.List = function() return { A, B }, 100 end
    assert.truthy(ns.Advisor.Resale(B) > ns.Advisor.Resale(A), "B bringt je Craft etwas mehr")
    assert.truthy(ns.Advisor.Resale(A) > 100, "beide mit Gewinn")
    assert.are.equal(1, ns.Advisor.Chance(A, 100))
    assert.truthy(math.abs(ns.Advisor.Chance(B, 100) - 0.2) < 1e-9)
    local plan = ns.Advisor.Plan("LEATHERWORKING", 1)
    assert.are.equal("A", plan.steps[1].recipe.name)
    assert.are.equal(1, plan.steps[1].crafts)
  end)
end)

describe("P6 Preis-Tooltip und Neu-Einstellen", function()
  it("nach einer Spielpause: Ø, Tief/Hoch und Trend nur aus den letzten 14 Tagen", function()
    local ns, W = E.load({})
    local h = {}
    for i = 60, 72 do h[os.date("%Y-%m-%d", W.now - i * 86400)] = 5000 end
    h[ns.Today()] = 1000
    ns.db.priceHistory = { [2589] = h }
    local st = ns.PriceString.Stats(2589)
    assert.are.equal(1, st.days)
    assert.are.equal(1000, st.mean)
    assert.are.equal(1000, st.max)
    assert.are.equal(1000, st.median)
    assert.is_nil(ns.PriceString.Trend(2589))
  end)
  it("eigene Angebote decken die Nachfrage: klarer Hinweis statt 'Nur 0 einstellen'", function()
    local ns, W = E.load({ prices = { [2318] = 300, [2304] = 2000 } })
    W.bags = { [0] = { { itemID = 2304, stackCount = 10, quality = 2 } } }
    ns.AH.Store().list = {
      { auctionID = 1, id = 2304, qty = 10, unit = 2000, status = "expired" },
      { auctionID = 2, id = 2304, qty = 10, unit = 2000, status = "active", expires = W.now + 36000 },
    }
    ns.Demand.Store().stats[2304] = { s = 1, h = 24, q = 3, t = W.now } -- Markt nicht voll, du hast schon 10 im AH
    SlashCmdList.TIRYSZENTRALE("") ns.UI.Wizard.Finish()
    local page = ns.UI.pages.auctions
    local got
    ns.UI.Show("auctions")
    local orig = page.relist.SetEntries
    page.relist.SetEntries = function(selfList, list, ...)
      got = list
      return orig(selfList, list, ...)
    end
    ns.UI.RefreshPage("auctions")
    assert.truthy(got and got[1])
    assert.falsy(got[1].note:find("Nur 0", 1, true))
    assert.truthy(got[1].note:find("schon genug", 1, true))
    assert.are.equal("–/10", got[1].cells.qty)
    assert.are.same({}, W.errors)
  end)
end)

describe("P7 Goldbarren: Bergbau-Verhütten statt Alchemie-Transmutation", function()
  local mining = { { name = "Berufe", isHeader = true, isCollapsed = false },
    { name = "Bergbau", skillID = 186, isHeader = false, rank = 160, maxRank = 225 } }
  it("Index nimmt das Rezept deines Berufs bzw. das gelernte", function()
    local ns = E.load({ skills = mining })
    assert.are.equal(3308, ns.Recipes.ByOutput(3577).id) -- Gold verhütten
    assert.are.equal(10098, ns.Recipes.ByOutput(6037).id) -- Echtsilber verhütten
    assert.are.equal(11479, ns.Recipes.ByOutput(3577, "ALCHEMY").id)
  end)
  it("Berufsfenster Bergbau: gelerntes Verhütten wird nicht als Transmutation gemerkt", function()
    local ns, W = E.load({ skills = mining })
    ns.char.recipes = { ["Bergbau"] = { list = { { id = 999001, out = 3577, learned = true } } } }
    W.fire("TRADE_SKILL_CLOSE") W.flush()
    assert.is_true(ns.char.learned[3308])
    assert.is_nil(ns.char.learned[11479])
    -- Zauber-Nummer passt und Ergebnis passt: genau dieses Rezept
    assert.are.equal(11479, ns.Recipes.Match(11479, 3577, "MINING").id)
    assert.are.equal(3308, ns.Recipes.Match(424242, 3577, "MINING").id)
  end)
end)

----------------------------------------------------------------------------
-- Tirys Spieltest 6.2 (11.11.): Ruckeln am AH, Chat voller Schnäppchen-Meldungen, Auctionator-Suche hängt
----------------------------------------------------------------------------
describe("A1 Komplett-Scan wird genau einmal gelesen", function()
  it("Blizzard meldet REPLICATE_ITEM_LIST_UPDATE immer wieder – gelesen wird nur nach einem neuen Scan", function()
    local ns, W = E.load({ itemInfo = LEDER })
    local rows = leatherMarket()
    rows[#rows + 1] = { 2318, 20, 4, "Billig", 3 } -- 20 × 4 Kupfer, Händler zahlt 10: Händler-Schnäppchen
    replicate(function() return rows end)
    ns.Market.ahOpen = true
    local reads = 0
    local num = C_AuctionHouse.GetNumReplicateItems
    C_AuctionHouse.GetNumReplicateItems = function() reads = reads + 1 return num() end
    C_AuctionHouse.ReplicateItems() -- Auctionator startet den Komplett-Scan
    for _ = 1, 5 do
      W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
      W.now = W.now + 3
    end
    assert.are.equal(1, reads)
    local _, n = E.chat(W):gsub("Schnäppchen%-Scan", "")
    assert.are.equal(1, n)
    -- eine Stunde später, immer noch derselbe Scan: nichts
    W.now = W.now + 3600
    W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
    assert.are.equal(1, reads)
    -- neuer Komplett-Scan: wieder lesen
    C_AuctionHouse.ReplicateItems() W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
    assert.are.equal(2, reads)
    -- AH zwischendurch zu: die Liste ist ungültig, kein Lesen
    C_AuctionHouse.ReplicateItems()
    W.fire("AUCTION_HOUSE_CLOSED") W.flush()
    W.fire("AUCTION_HOUSE_SHOW") W.flush()
    W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
    assert.are.equal(2, reads)
    assert.are.same({}, W.errors)
  end)
end)

describe("A2 Schnäppchen-Auswertung ohne Server-Anfragen und ohne tausende Rechnungen", function()
  it("Händlerpreis nur aus geladenen Items, sonst aus den Spieldaten", function()
    local ns, W = E.load({ itemInfo = LEDER })
    local rows = leatherMarket()
    rows[#rows + 1] = { 2318, 20, 4, "Billig", 3 }
    replicate(function() return rows end)
    ns.Market.ahOpen = true
    local asked = {}
    local gii = C_Item.GetItemInfo
    C_Item.GetItemInfo = function(id) asked[id] = (asked[id] or 0) + 1 return gii(id) end
    C_AuctionHouse.ReplicateItems() W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
    for id in pairs(asked) do assert.truthy(W.itemInfo[id], "Server-Anfrage für ungeladenes Item " .. id) end
    assert.truthy(ns.Snipe.list[1] and ns.Snipe.list[1].kind == "haendler" and ns.Snipe.list[1].id == 2318)
    assert.are.same({}, W.errors)
  end)

  it("Markt-Schnäppchen: dieselbe Liste wie die volle Rechnung, aber nur die Besten genau gerechnet", function()
    local ns, W = E.load({ prices = {} })
    local ids = {}
    ns.DB.Each(function(e) if #ids < 200 and e.bind ~= 1 and (e.sell or 0) > 0 then ids[#ids + 1] = e.id end end)
    ns.db.priceHistory = {}
    local rows, refs = {}, {}
    for i, id in ipairs(ids) do
      local p = (ns.DB.Get(id).sell or 1) * 40 + 20000 + i * 137
      W.prices[id] = p
      ns.db.priceHistory[id] = { ["2026-11-08"] = p, ["2026-11-09"] = p, ["2026-11-10"] = p }
      refs[id] = p
      local q = (i % 4) + 1
      rows[#rows + 1] = { id, q, math.floor(p * (0.2 + (i % 9) / 20)), "V" .. i, 3 }
      rows[#rows + 1] = { id, 1, math.floor(p * 0.6), "W" .. i, 3 }
    end
    replicate(function() return rows end)
    ns.Market.ahOpen = true
    -- volle Rechnung (alter Weg) als Vergleich
    local agg = {}
    local S = ns.Snipe
    for _, r in ipairs(rows) do
      local ref = ns.PriceString.Market(r[1])
      local unit = math.floor(r[3])
      if ref and unit <= ref * S.MARKET_SHARE then
        local e = agg[r[1]] or { id = r[1], count = 0, cost = 0, ref = ref }
        agg[r[1]] = e
        e.count, e.cost = e.count + r[2], e.cost + unit * r[2]
      end
    end
    local want = {}
    for id, e in pairs(agg) do
      if ns.Demand.Class(id) ~= "slow" then
        local p = math.floor(ns.Market.NetAfterDeposit(id, nil, e.ref) * e.count - e.cost)
        if p >= S.MarketMin() then want[#want + 1] = { id = id, profit = p } end
      end
    end
    table.sort(want, function(a, b) if a.profit ~= b.profit then return a.profit > b.profit end return a.id < b.id end)
    while #want > 40 do table.remove(want) end
    assert.truthy(#want == 40, "Testdaten zu klein: " .. #want)
    local calls = 0
    local nad = ns.Market.NetAfterDeposit
    ns.Market.NetAfterDeposit = function(...) calls = calls + 1 return nad(...) end
    C_AuctionHouse.ReplicateItems() W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
    ns.Market.NetAfterDeposit = nad
    local got = {}
    for _, e in ipairs(S.list) do got[#got + 1] = { id = e.id, profit = e.profit } assert.are.equal("markt", e.kind) end
    assert.are.same(want, got)
    assert.truthy(calls < 120, "zu viele genaue Rechnungen: " .. calls)
    assert.are.same({}, W.errors)
  end)
end)

describe("A3 Einstellgebühr: Blizzard wird je AH-Besuch einmal gefragt", function()
  it("hunderte Rechnungen pro Bildaufbau = eine Abfrage; gespeichert wird nur Neues", function()
    local ns, W = E.load({ itemInfo = LEDER })
    local asked = 0
    C_AuctionHouse.CalculateCommodityDeposit = function(id, d, q) if id == 2318 and q == 20 then asked = asked + 1 end return 3 * q end
    W.fire("AUCTION_HOUSE_SHOW") W.flush()
    ns.Market.ResetDepositMemo() -- (beim Öffnen hat die Zentrale schon gerechnet)
    asked = 0
    for _ = 1, 50 do ns.Market.Deposit(2318, 20) end
    assert.are.equal(1, asked)
    local d = ns.Market.Duration()
    local saved = ns.db.deposits[2318][d]
    assert.are.equal(60, saved.v)
    ns.Market.Deposit(2318, 20)
    assert.is_true(rawequal(saved, ns.db.deposits[2318][d]))
    -- neuer Besuch: neu fragen (Blizzard kann die Gebühr geändert haben)
    asked = 0
    W.fire("AUCTION_HOUSE_CLOSED") W.flush()
    W.fire("AUCTION_HOUSE_SHOW") W.flush()
    ns.Market.Deposit(2318, 20)
    assert.are.equal(1, asked)
    assert.are.same({}, W.errors)
  end)
end)

describe("A4 Neuzeichnen am AH", function()
  it("Item-Daten bereits geladener Items lösen kein Neuzeichnen aus, Platzhalter schon", function()
    local ns, W = E.load({ itemInfo = LEDER })
    local fired = 0
    ns.Listen("ITEMS_UPDATED", function() fired = fired + 1 end)
    ns.Item(2318)
    for _ = 1, 20 do W.fire("GET_ITEM_INFO_RECEIVED", 2318, true) end
    W.flush()
    assert.are.equal(0, fired)
    assert.truthy(ns.Item(777001).name:find("777001"))
    W.itemInfo[777001] = { name = "Neues Item", sell = 5, stack = 1 }
    W.fire("GET_ITEM_INFO_RECEIVED", 777001, true) W.flush()
    assert.are.equal(1, fired)
    assert.are.equal("Neues Item", ns.Item(777001).name)
  end)
  it("am offenen AH höchstens einmal pro Sekunde neu rechnen, sonst sofort", function()
    local ns, W = E.load({})
    assert.are.equal(0.15, ns.UI.RefreshDelay())
    W.fire("AUCTION_HOUSE_SHOW") W.flush()
    assert.are.equal(1, ns.UI.RefreshDelay())
    W.fire("AUCTION_HOUSE_CLOSED") W.flush()
    assert.are.equal(0.15, ns.UI.RefreshDelay())
  end)
  it("Tagespreise höchstens einmal pro Minute schreiben – die letzte Meldung kommt trotzdem an", function()
    local ns, W = E.load({})
    local n = 0
    local rec = ns.PriceString.RecordAll
    ns.PriceString.RecordAll = function(...) n = n + 1 return rec(...) end
    W.now = W.now + 120
    for _ = 1, 10 do ns.Fire("PRICES_UPDATED") W.now = W.now + 1 end
    assert.are.equal(1, n)
    W.flush() -- der nachgeholte Durchlauf
    assert.are.equal(2, n)
  end)
end)

describe("A5 Suche über Auctionator hat Vorrang", function()
  local function owned(W)
    W.owned = {
      { auctionID = 1, itemKey = { itemID = 2318 }, status = 0, quantity = 5, timeLeftSeconds = 7200, buyoutAmount = 40 },
      { auctionID = 2, itemKey = { itemID = 2319 }, status = 0, quantity = 5, timeLeftSeconds = 7200, buyoutAmount = 90 },
      { auctionID = 3, itemKey = { itemID = 4234 }, status = 0, quantity = 5, timeLeftSeconds = 7200, buyoutAmount = 99 },
    }
  end
  it("hält die eigene Unterboten-Prüfung an", function()
    local ns, W = E.load({ itemInfo = LEDER })
    owned(W)
    W.fire("AUCTION_HOUSE_SHOW") W.flush()
    W.fire("OWNED_AUCTIONS_UPDATED") W.flush()
    assert.is_true(ns.AH.checking)
    local sent = #W.searchedKeys
    assert.is_true((ns.Market.SearchNow({ 2318 })))
    assert.are.same({ "Leichtes Leder" }, W.searched)
    assert.is_false(ns.AH.checking)
    W.fire("COMMODITY_SEARCH_RESULTS_UPDATED", 2318) W.flush()
    W.fire("COMMODITY_SEARCH_RESULTS_UPDATED", 2319) W.flush()
    assert.are.equal(sent, #W.searchedKeys)
    assert.is_nil(W.scanStarted) -- kein Scan hinterher, der die Suche ausbremst
    assert.are.same({}, W.errors)
  end)
  it("wartet, bis Auctionators Scan fertig ist", function()
    local ns, W = E.load({ itemInfo = LEDER })
    ns.Market.ahOpen = true
    Auctionator.State.FullScanFrameRef.inProgress = true
    assert.is_true((ns.Market.SearchNow({ 2318 })))
    assert.is_nil(W.searched)
    assert.truthy(E.chat(W):find("startet automatisch", 1, true))
    W.flush()
    assert.is_nil(W.searched)
    Auctionator.State.FullScanFrameRef.inProgress = false
    W.flush()
    assert.are.same({ "Leichtes Leder" }, W.searched)
    assert.are.same({}, W.errors)
  end)
end)

----------------------------------------------------------------------------
-- 6.4: "Nach erneutem Aktualisieren stehen andere Sachen drin" – jede Datenänderung muss neu zeichnen
----------------------------------------------------------------------------
describe("AH-Scan aktualisiert wirklich alles", function()
  local function heard(msg)
    local n = { c = 0 }
    return n, function() n.c = n.c + 1 end
  end

  it("Komplett-Scan mit noch nicht geladenen Verkäufern wird erst übernommen, wenn alles da ist", function()
    local ns, W = E.load({ itemInfo = LEDER })
    local rows = leatherMarket()
    replicate(function() return rows end)
    local reads, loadedAfter = 0, 2
    local AH = C_AuctionHouse
    local num = AH.GetNumReplicateItems
    AH.GetNumReplicateItems = function() reads = reads + 1 return num() end
    local info = AH.GetReplicateItemInfo
    AH.GetReplicateItemInfo = function(i)
      local r = { info(i) }
      if reads < loadedAfter and i % 3 == 0 then r[14], r[15], r[18] = nil, nil, false end -- Verkäufer fehlt noch
      return unpack(r, 1, 18)
    end
    local requested = 0
    C_Item.RequestLoadItemDataByID = function(id) assert(type(id) == "number") requested = requested + 1 end
    local d, fn = heard() ns.Listen("DEMAND_UPDATED", fn)
    ns.Market.ahOpen = true
    scan(W)
    assert.are.equal(2, reads, "einmal nachgelesen")
    assert.are.equal(1, d.c, "Absatz nur einmal gemeldet – mit vollständigen Daten")
    assert.is_true(requested > 0, "fehlende Item-Daten angefordert")
    assert.is_falsy(ns.Demand.Store().stats[2318] and ns.Demand.Store().stats[2318].anon, "kein 'Verkäufer unbekannt'")
    -- bleiben Daten dauerhaft unvollständig: nach 3 Versuchen gilt der Stand (kein Endlos-Lesen)
    reads, loadedAfter = 0, 99
    W.now = W.now + 3600
    scan(W)
    assert.are.equal(1 + ns.Demand.MAX_RETRIES, reads)
    assert.are.equal(2, d.c)
    assert.are.same({}, W.errors)
  end)

  it("Preisverlauf, der bis zu 1 Min. später geschrieben wird, lässt alle Seiten neu rechnen", function()
    local ns, W = E.load({ itemInfo = LEDER, prices = { [2318] = 40 } })
    local h, fn = heard() ns.Listen("HISTORY_UPDATED", fn)
    ns.Fire("PRICES_UPDATED")              -- sofort geschrieben
    local first = h.c
    W.now = W.now + 5
    W.prices[2318] = 55
    ns.Fire("PRICES_UPDATED")              -- innerhalb der Minute: später geschrieben
    assert.are.equal(first, h.c)
    W.flush()
    assert.are.equal(first + 1, h.c, "verspätetes Schreiben meldet sich")
    -- die offene Seite rechnet daraufhin neu (Hauptfenster plant ein Neuzeichnen ein)
    ns.UI.Show("market")
    W.flush()
    assert.are.equal(0, #W.timers)
    ns.Fire("HISTORY_UPDATED", 1)
    assert.is_true(#W.timers > 0, "Neuzeichnen eingeplant")
    W.flush()
    assert.are.same({}, W.errors)
  end)

  it("'Scan fertig' erst, wenn Auctionator nicht mehr scannt", function()
    local ns, W = E.load({ itemInfo = LEDER })
    ns.Market.ahOpen = true
    Auctionator.State.FullScanFrameRef.CanInitiate = function() return true end
    assert.is_true(ns.Market.StartScan())
    Auctionator.State.FullScanFrameRef.inProgress = true
    W.dbCallback() W.flush()                -- Suche mitten im Scan
    assert.is_falsy(E.chat(W):find("Scan fertig", 1, true))
    assert.is_true(ns.Market.scanRequested)
    Auctionator.State.FullScanFrameRef.inProgress = nil
    W.dbCallback() W.flush()
    assert.truthy(E.chat(W):find("Scan fertig", 1, true))
    assert.is_nil(ns.Market.scanRequested)
    assert.are.same({}, W.errors)
  end)

  it("exakte Einstellgebühr kommt nach der Schätzung: Seiten rechnen einmal neu", function()
    local ns, W = E.load({ itemInfo = LEDER })
    local M = ns.Market
    local ready = false
    C_AuctionHouse.CalculateCommodityDeposit = function(id, d, q) if ready then return 7 * q end return nil end
    local h, fn = heard() ns.Listen("DEPOSITS_LEARNED", fn)
    M.ahOpen = true
    local v, exact = M.Deposit(2318, 20)
    assert.is_false(exact)
    ready = true
    W.now = W.now + 31
    v, exact = M.Deposit(2318, 20)
    assert.is_true(exact) assert.are.equal(140, v)
    W.flush()
    assert.are.equal(1, h.c)
    M.Deposit(2318, 20) W.flush()
    assert.are.equal(1, h.c, "nur einmal")
    assert.are.same({}, W.errors)
  end)
end)

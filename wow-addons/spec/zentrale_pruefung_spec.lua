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
  W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
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

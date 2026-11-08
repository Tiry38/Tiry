-- Tiry's Zentrale – Ladetest gegen den strengen Forever-Nachbau. Aufruf: lua5.1 wow-addons/tests/run_tests.lua
package.path = package.path .. ";" .. (arg[0]:match("^(.*/)") or "./") .. "?.lua"
local HERE = arg[0]:match("^(.*/)") or "./"
local ROOT = HERE .. "../TirysZentrale/"

local passed, failed = 0, 0
local function check(name, cond, msg)
  if cond then passed = passed + 1 else failed = failed + 1 print("FEHLER: " .. name .. (msg and (" – " .. msg) or "")) end
end

local function tocFiles()
  local files = {}
  for line in io.lines(ROOT .. "TirysZentrale.toc") do
    if not line:match("^##") and line:match("%S") then files[#files + 1] = (line:gsub("\\", "/"):gsub("%s+$", "")) end
  end
  return files
end

local function runScenario(label, opts)
  -- frische Umgebung
  for k in pairs(package.loaded) do if k == "wow_mock" then package.loaded[k] = nil end end
  local W = require("wow_mock")
  W.errors, W.prints, W.timers, W.registered = {}, {}, {}, {}
  W.level, W.faction, W.class, W.money = opts.level or 20, opts.faction or "Alliance", opts.class or "ROGUE", 50000
  W.skills = {
    { name = "Berufe", isHeader = true, isCollapsed = true },
    { name = "Kürschnerei", skillID = 393, isHeader = false, rank = 87, maxRank = 150 },
    { name = "Schneiderei", skillID = 197, isHeader = false, rank = 60, maxRank = 150 },
    { name = "Lederverarbeitung", skillID = 165, isHeader = false, rank = 45, maxRank = 75 },
    { name = "Waffenfertigkeiten", isHeader = true, isCollapsed = false },
    { name = "Dolche", skillID = 173, isHeader = false, rank = 100, maxRank = 100 },
  }
  W.itemInfo = opts.itemInfo or { [2589] = { name = "Leinenstoff", sell = 13 }, [4238] = { name = "Leinentasche", sell = 200, stack = 1 } }
  W.prices = opts.prices or { [2589] = 60, [2592] = 120, [2318] = 90, [2770] = 40, [4238] = 900, [2320] = 30, [249427] = 4000, [5771] = 30000 }
  W.known = { [3755] = true, [2963] = true, [2881] = true, [2152] = true }
  W.install({ auctionator = opts.auctionator, locale = opts.locale })
  TirysZentraleDB, TirysZentraleCharDB = opts.db, nil

  local ns = {}
  for _, f in ipairs(tocFiles()) do
    local chunk, err = loadfile(ROOT .. f)
    check(label .. ": lädt " .. f, chunk ~= nil, err)
    if chunk then
      local ok, e = pcall(chunk, "TirysZentrale", ns)
      check(label .. ": führt " .. f .. " aus", ok, e)
    end
  end
  local function step(name, fn)
    local ok, e = pcall(fn)
    check(label .. ": " .. name, ok, e)
    W.flush()
  end

  step("ADDON_LOADED", function() W.fire("ADDON_LOADED", "TirysZentrale") end)
  step("PLAYER_LOGIN", function() W.fire("PLAYER_LOGIN") W.fire("PLAYER_ENTERING_WORLD", true, false) end)
  check(label .. ": Berufe erkannt", ns.professions[393] and ns.professions[197] and not ns.professions[173], "Kürschnerei/Schneiderei")
  check(label .. ": SavedVariables", type(TirysZentraleDB) == "table" and type(TirysZentraleCharDB) == "table")

  step("Slash /gold öffnet", function() SlashCmdList.TIRYSZENTRALE("") end)
  check(label .. ": Fenster sichtbar", TirysZentraleMainFrame and TirysZentraleMainFrame:IsShown())
  for _, def in ipairs(ns.UI.order) do
    step("Seite " .. def.key, function() ns.UI.Show(def.key) end)
    check(label .. ": Seite " .. def.key .. " gebaut", def.frame ~= nil)
  end

  -- Methoden aufklappen, alle Kategorien
  step("Goldwege aufklappen", function()
    local p = ns.UI.pages.methods
    ns.UI.Show("methods")
    for _, m in ipairs(ns.METHODS) do p.expanded[m.key] = true end
    p.refresh(p)
    for _, c in ipairs(ns.METHOD_CATS) do p.segments:Select(c.value, true) end
    p.cards[1]:Click()
  end)
  step("Startseite: Gold-Kreislauf mit 4 Schritten, alle Knöpfe klickbar", function()
    ns.UI.Show("home")
    local loop = ns.UI.pages.home.loop
    assert(#loop.rows == 4, "4 Schritte")
    for _, r in ipairs(loop.rows) do
      assert(r.title:GetText() ~= "" and r.btn.text:GetText() ~= "", "Schritt beschriftet")
      ns.UI.Show("home")
      r.btn:Click()
    end
  end)
  check(label .. ": Kreislauf-Knöpfe führen weiter", ns.UI.current ~= nil)

  -- Markt: Filter + Einkaufsliste + AH-Suche
  step("Marktfilter", function()
    ns.UI.Show("market")
    local p = ns.UI.pages.market
    for _, b in ipairs(p.segments.buttons) do b:Click() end
    p.segments:Select("cloth", true)
    p.listBtn:Click()
    W.fire("AUCTION_HOUSE_SHOW")
    W.flush()
    p.searchBtn:Click()
    W.fire("AUCTION_HOUSE_CLOSED")
    local row = p.list.rows[1]
    W.call(row, "OnEnter")
    W.shift = true ; row:Click() ; W.shift = false
    W.call(row, "OnLeave")
  end)
  if opts.auctionator ~= false and not opts.noData then
    check(label .. ": Einkaufsliste angelegt", W.lists and W.lists["Zentrale: Stoff"] ~= nil)
    check(label .. ": AH-Suche gestartet", W.searched ~= nil)
  end

  -- Komplette Item-Datenbank
  step("Datenbank-Seite", function()
    ns.UI.Show("database")
    local p = ns.UI.pages.database
    local eb = p.search.edit
    for _, q in ipairs({ "leinen", "ROTE TASCHE", "Gekräuselte", "ÖL", "2589", "zzzzzz", "" }) do
      eb:SetText(q) ; W.call(eb, "OnTextChanged", true) ; W.flush()
    end
    for _, seg in ipairs({ p.segCat, p.segQual, p.segSort }) do
      for _, b in ipairs(seg.buttons) do b:Click() ; W.flush() end
    end
    p.segCat:Select("all", true) ; p.segQual:Select("all", true) ; p.segSort:Select("name", true)
    p.usableBtn:Click() ; p.usableBtn:Click()
    p.more:Click()
    p.listBtn:Click()
  end)
  local DB = ns.DB
  check(label .. ": Datenbank vollständig", DB.Count() == ns.ALLDB_COUNT and ns.ALLDB_COUNT > 18000, tostring(DB.Count()))
  check(label .. ": Leinenstoff per ID", DB.Get(2589) and DB.Get(2589).name == "Leinenstoff")
  check(label .. ": Umlaut-Suche", #DB.Search("gekräuselte") >= 1 and #DB.Search("GEKRÄUSELTE") >= 1)
  check(label .. ": Mehrwort-Suche", #DB.Search("rote tasche") >= 1)
  check(label .. ": ID-Suche", #DB.Search("249427") == 1)
  local t0 = os.clock() ; DB.Search("stoff", nil, "ah") ; local dt = os.clock() - t0
  check(label .. ": Suche schnell (" .. string.format("%.0f", dt * 1000) .. " ms)", dt < 0.25)
  check(label .. ": Fallback-Name aus Datenbank", ns.Item(4306).name == "Seidenstoff")

  -- Händler mit einem lohnenden Rezept (begrenzter Vorrat)
  step("Händler-Scan", function()
    W.merchant = {
      { id = 5771, name = "Muster: Rote Leinentasche", price = 200, avail = 1 },
      { id = 2320, name = "Grober Faden", price = 10, stack = 1, avail = -1 },
      { id = 159, name = "Wasser", price = 25, avail = -1 },
    }
    W.npcName = "Drake"
    W.fire("MERCHANT_SHOW")
    W.flush()
    ns.UI.Show("scanner")
  end)
  if opts.auctionator ~= false and not opts.noData then
    check(label .. ": Flip gefunden", #ns.Scanner.merchant.flips == 1 and ns.Scanner.merchant.flips[1].id == 5771)
    check(label .. ": Chat-Hinweis", #W.prints > 0)
  end
  check(label .. ": Händlerpreis gemerkt", TirysZentraleDB.vendorBuy[2320] == 10)
  step("Händler schließen", function() W.fire("MERCHANT_CLOSED") W.flush() end)

  -- Taschen
  step("Taschen-Check", function()
    W.bags = {
      [0] = {
        { itemID = 2589, stackCount = 20, quality = 1, hyperlink = "x" },
        { itemID = 4238, stackCount = 1, quality = 1 },
        { itemID = 2934, stackCount = 5, quality = 1 },
      },
      [1] = { { itemID = 3300, stackCount = 2, quality = 0 }, nil },
    }
    ns.UI.Show("scanner")
    ns.UI.pages.scanner.bagHead.scan:Click()
    ns.UI.pages.scanner.bagHead.listBtn:Click()
    W.fire("BAG_UPDATE_DELAYED")
    W.flush()
  end)
  check(label .. ": Taschen bewertet", #ns.Scanner.bags.items >= 2)

  -- Berufsfenster
  step("Rezepte scannen", function()
    W.recipes = {
      [3755] = { name = "Leinentasche", out = 4238, reagents = { { 2996, 3 }, { 2320, 3 } } },
      [2963] = { name = "Leinenstoffballen", out = 2996, reagents = { { 2589, 2 } } },
    }
    W.fire("TRADE_SKILL_SHOW")
    W.flush()
    ns.UI.Show("recipes")
  end)
  check(label .. ": Rezepte gespeichert", TirysZentraleCharDB.recipes and TirysZentraleCharDB.recipes["Schneiderei"] and #TirysZentraleCharDB.recipes["Schneiderei"].list == 2)

  -- Craft-Planer: Filter, Warteschlange, Craften
  step("Craft-Planer", function()
    local p = ns.UI.pages.recipes
    ns.UI.Show("recipes")
    TirysZentraleDB.settings.craft.profitFactor = 0
    TirysZentraleDB.settings.craft.onlySafe = false
    p.prof = "TAILORING"
    p.refresh(p)
    local row = p.list.rows[1]
    if row and row:IsShown() then
      W.call(row, "OnClick", "LeftButton") ; W.call(row, "OnClick", "LeftButton")
    else
      TirysZentraleCharDB.queue = { { recipe = 3755, prof = "TAILORING", n = 2 } } -- ohne Preise: direkt einplanen
    end
    p.queueCard.buy:Click()
    W.bags[0][5] = { itemID = 2996, stackCount = 20, quality = 1 }
    W.bags[0][6] = { itemID = 2320, stackCount = 20, quality = 1 }
    W.fire("TRADE_SKILL_SHOW") ; W.flush()
    p.refresh(p)
    p.queueCard.craft:Click()
    for _, pl in ipairs(p.pills) do pl:Click() pl:Click() end
    W.fire("TRADE_SKILL_CLOSE") ; W.flush()
  end)
  check(label .. ": Rezept gecraftet", (W.crafted or 0) >= 1, tostring(W.crafted))
  check(label .. ": richtiges Rezept markiert", W.opened == W.craftedID and (W.craftedID == 3755 or W.craftedID == 2963), tostring(W.craftedID))
  step("Craft-Ergebnis kommt an", function()
    local before = 0
    for _, e in ipairs(TirysZentraleCharDB.queue or {}) do before = before + e.n end
    W.fire("TRADE_SKILL_SHOW") ; W.flush()
    W.bags[4] = { { itemID = W.craftedID == 3755 and 4238 or 2996, stackCount = 1, quality = 1 } }
    W.fire("BAG_UPDATE_DELAYED") ; W.flush()
    local after = 0
    for _, e in ipairs(TirysZentraleCharDB.queue or {}) do after = after + e.n end
    assert(after < before or before == 0, "Warteschlange muss nach dem Herstellen sinken: " .. before .. " -> " .. after)
    ns.UI.pages.recipes.CraftCheck()
    SlashCmdList.TIRYSZENTRALE("craftcheck")
    W.fire("TRADE_SKILL_CLOSE") ; W.flush()
  end)

  -- Forever-Fall: Berufsfenster nummeriert anders als das Zauberbuch -> trotzdem das RICHTIGE Item herstellen
  step("Craft mit abweichenden Nummern", function()
    local saved = W.recipes
    W.recipes = {
      [90001] = { name = "Lagerzelt", out = 279978, reagents = { { 2318, 5 } } },
      [90002] = { name = "Leinentasche", out = 4238, reagents = { { 2996, 3 }, { 2320, 3 } } },
    }
    TirysZentraleCharDB.queue = { { recipe = 3755, prof = "TAILORING", n = 1 } }
    W.crafted, W.craftedID = 0, nil
    W.fire("TRADE_SKILL_SHOW") ; W.flush()
    ns.UI.Show("recipes")
    ns.UI.pages.recipes.queueCard.craft:Click()
    assert(W.craftedID == 90002, "muss Leinentasche (90002) herstellen, nicht " .. tostring(W.craftedID))
    W.fire("NEW_RECIPE_LEARNED", 90002) ; W.flush()
    W.fire("TRADE_SKILL_CLOSE") ; W.flush()
    W.recipes = saved
    TirysZentraleCharDB.learned = nil
  end)
  step("Warteschlange bearbeiten und leeren", function()
    TirysZentraleCharDB.queue = { { recipe = 3755, prof = "TAILORING", n = 2 }, { recipe = 2963, prof = "TAILORING", n = 1 } }
    ns.UI.Show("recipes")
    local qc = ns.UI.pages.recipes.queueCard
    qc.rows[1].plus:Click() ; qc.rows[1].minus:Click() ; qc.rows[2].del:Click()
    assert(#TirysZentraleCharDB.queue == 1 and TirysZentraleCharDB.queue[1].n == 2, "Zeilen-Knöpfe")
    qc.clear:Click()
    assert(#TirysZentraleCharDB.queue == 0, "Alles leeren")
    TirysZentraleCharDB.queue = { { recipe = 3755, prof = "TAILORING", n = 1 } }
    SlashCmdList.TIRYSZENTRALE("leeren")
    assert(#TirysZentraleCharDB.queue == 0, "/tz leeren")
  end)

  -- Rezept-Datenbank + automatische Erkennung + Level-Empfehlung
  local R = ns.Recipes
  local all = 0
  for _, list in pairs(R.Load()) do all = all + #list end
  check(label .. ": Rezept-Datenbank", all > 1900, tostring(all))
  local lwKnown = R.List("LEATHERWORKING", "known")
  check(label .. ": gelernte Rezepte erkannt", #lwKnown == 2, tostring(#lwKnown))
  check(label .. ": lernbare Rezepte", #R.List("LEATHERWORKING", "learnable") > 0)
  check(label .. ": Skill-Farbe", R.Difficulty(R.Get(2881), 45) == 3 and R.Difficulty(R.Get(2881), 31) == 2 and R.Difficulty(R.Get(2881), 25) == 1 and R.Difficulty(R.Get(2881), 10) == 0)
  step("Empfehlung & Regler", function()
    local p = ns.UI.pages.recipes
    p.recBtn:Click()
    assert(select(3, R.Filter()) == true, "Empfehlung aktiv")
    local g1 = select(2, R.Filter())
    local plus
    for _, ch in ipairs(p.profit.__children) do if ch.__kind == "Button" and not plus then plus = ch end end
    plus:Click()
    assert(select(3, R.Filter()) == false, "Regler setzt eigenen Wert")
    assert(select(2, R.Filter()) > g1, "Mindestgewinn steigt mit Plus")
    p.recBtn:Click()
    p.viewSeg:Select("learnable", true)
    p.viewSeg:Select("known", true)
    for _, b in ipairs(p.segments.buttons) do b:Click() end
    W.fire("NEW_RECIPE_LEARNED", 2152) ; W.flush()
    W.fire("SKILL_LINES_CHANGED") ; W.flush()
  end)
  check(label .. ": Empfehlung je Level", R.Preset(15).profit == 1800 and R.Preset(25).profit == 5000 and R.Preset(60).profit == 80000, R.Preset(15).profit)
  local g20 = select(2, R.Filter())
  W.level = 40 ; W.fire("PLAYER_LEVEL_UP", 40) ; W.flush()
  check(label .. ": Mindestgewinn wächst mit Level", select(2, R.Filter()) > g20)
  W.level = 20 ; W.fire("PLAYER_LEVEL_UP", 20) ; W.flush()

  -- Rechentest mit festen Zahlen (AH-Gebühr 5 %):
  -- Leinentasche: Verkauf 1000 -> netto 950; Material 3 Leinenstoffballen à 100 + 3 Grober Faden à 10 (Händler) = 330 -> Gewinn 620
  -- Leinenstoffballen: Verkauf 100 -> netto 95; Material 2 Leinenstoff à 60 = 120 -> Verlust, darf NICHT erscheinen
  -- Feine Lederhandschuhe sind beim Anlegen gebunden (handelbar), werden also gezeigt, wenn Preise da sind
  if opts.auctionator ~= false then step("Rechentest Craft-Planer", function()
    W.prices[4238], W.prices[2996], W.prices[2589] = 1000, 100, 60
    TirysZentraleDB.vendorBuy[2320] = 10
    TirysZentraleDB.settings.craft.profitFactor = 0
    TirysZentraleDB.settings.craft.onlySafe = true
    TirysZentraleCharDB.hiddenRecipes = {}
    local p = ns.UI.pages.recipes
    p.prof, p.view = "TAILORING", "known"
    local list = p.Entries(p)
    assert(#list == 1, "nur die Leinentasche bringt Gewinn, gefunden: " .. #list)
    assert(list[1].r.id == 3755 and list[1].revenue == 950 and list[1].cost == 330 and list[1].profit == 620,
      string.format("Zahlen falsch: %s %s %s", tostring(list[1].revenue), tostring(list[1].cost), tostring(list[1].profit)))
    -- Mindestgewinn über dem Gewinn -> Liste leer
    TirysZentraleDB.settings.craft.profitFactor = 1000
    assert(#p.Entries(p) == 0, "Mindestgewinn filtert")
    TirysZentraleDB.settings.craft.profitFactor = 0
    -- Rechtsklick blendet aus, Knopf holt zurück
    ns.UI.Show("recipes") ; p.refresh(p)
    W.call(p.list.rows[1], "OnClick", "RightButton")
    assert(#p.Entries(p) == 0 and TirysZentraleCharDB.hiddenRecipes[3755], "ausgeblendet")
    p.unhideBtn:Click()
    assert(#p.Entries(p) == 1, "zurückgeholt")
    assert(p.Sellable(279978) and p.Sellable(2312), "verkäuflich")
  end) end

  -- Verkaufsbuch (Post-Rechnungen) + eigene Verkaufsquote + Bestand aller Charaktere
  step("Verkaufsbuch", function()
    TirysZentraleDB.ledger = nil
    W.inbox = {}
    W.mails = {
      { subject = "Auktion erfolgreich: Leinentasche", money = 950, invoice = { "seller", "Leinentasche", "Käufer1", 1000, 1 } },
      { subject = "Auktion erfolgreich: Leinentasche", money = 950, daysLeft = 28.2, invoice = { "seller", "Leinentasche", "Käufer2", 1000, 1 } },
      { subject = "Auktion abgelaufen: Leinentasche", daysLeft = 27.0 },
      { subject = "Gekauft: Leinenstoff", invoice = { "buyer", "Leinenstoff", "Händler3", 1200, 20 } },
    }
    W.fire("MAIL_INBOX_UPDATE") ; W.flush()
    W.fire("MAIL_INBOX_UPDATE") ; W.flush() -- zweimal lesen darf nichts doppelt zählen
    local L = ns.Ledger
    local rate, n = L.SaleRate(4238)
    assert(n == 3 and math.abs(rate - 2 / 3) < 0.001, "Quote 2 von 3: " .. tostring(rate) .. " / " .. tostring(n))
    local t = L.Totals(30)
    assert(t.income == 1900 and t.spent == 1200 and t.profit == 700 and t.sold == 2 and t.expired == 1, "Summen")
    ns.UI.Show("ledger")
    for _, b in ipairs(ns.UI.pages.ledger.seg.buttons) do b:Click() end
    -- Ladenhüter-Filter im Craft-Planer
    W.mails = {}
    for i = 1, 4 do W.mails[i] = { subject = "Auktion abgelaufen: Leinenstoffballen", daysLeft = 20 + i } end
    W.fire("MAIL_INBOX_UPDATE") ; W.flush()
    local r2, n2 = L.SaleRate(2996)
    assert(r2 == 0 and n2 == 4, "Ladenhüter erkannt")
    W.mails = nil
    -- Bestand: zweiter Charakter im Speicher
    TirysZentraleDB.inv["Forever-Testrealm"]["Twink"] = { bags = { [2589] = 7 }, bank = { [2589] = 3 }, mail = {}, money = 5000 }
    local chars, total = ns.Inv.Count(2589)
    assert(total >= 10, "Bestand über Chars: " .. total)
    local gl, gtotal = ns.Inv.Gold()
    assert(#gl >= 2 and gtotal >= 5000, "Gold aller Chars")
    W.tooltipHook(GameTooltip, { id = 4238 })
    ns.UI.RefreshPage("ledger")
  end)

  -- Schnäppchen-Radar, Post-Bilanz, Ablauf-Warnung, Heute für dich, Mindestpreis
  step("Schnäppchen-Radar & Post", function()
    local D = ns.Deals
    D.found = {}
    TirysZentraleDB.priceHistory = TirysZentraleDB.priceHistory or {}
    TirysZentraleDB.priceHistory[13468] = { ["2026-11-01"] = 500000, ["2026-11-02"] = 520000, ["2026-11-03"] = 480000 }
    W.ahResults = { [13468] = { { 250000, 2 }, { 300000, 1 }, { 400000, 5 }, { 200000, 3, true } } }
    W.prints = {}
    W.fire("COMMODITY_SEARCH_RESULTS_UPDATED", 13468) ; W.flush()
    local d = D.found[13468]
    assert(d and d.qty == 3 and d.price == 250000 and d.ref == 500000, "Schnäppchen: nur fremde Angebote unter 65 %")
    assert(math.floor(d.save) == 500000 * 3 - (250000 * 2 + 300000), "Ersparnis")
    assert(table.concat(W.prints, " "):find("Schnäppchen") ~= nil, "Chat-Hinweis")
    -- ohne 2 Tage Historie kein Radar
    W.ahResults[2589] = { { 1, 20 } }
    TirysZentraleDB.priceHistory[2589] = { ["2026-11-03"] = 60 }
    W.fire("COMMODITY_SEARCH_RESULTS_UPDATED", 2589) ; W.flush()
    assert(D.found[2589] == nil, "zu wenig Historie")
    W.fire("ITEM_SEARCH_RESULTS_UPDATED", { itemID = 13468 }) ; W.flush()
    ns.UI.Show("scanner")
    -- Post-Bilanz und Ablauf-Warnung
    W.money = 100000 ; W.fire("MAIL_SHOW") ; W.flush()
    W.mails = { { subject = "x", money = 5000, daysLeft = 1.5 } }
    W.fire("MAIL_INBOX_UPDATE") ; W.flush()
    W.money = 105000 ; W.prints = {}
    W.fire("MAIL_CLOSED") ; W.flush()
    assert(table.concat(W.prints, " "):find("Post%-Bilanz") ~= nil, "Post-Bilanz")
    assert(TirysZentraleCharDB.mailExpires and TirysZentraleCharDB.mailExpires - W.now < 2 * 86400, "Ablaufzeit gemerkt")
    W.mails = nil
    -- Startseite: Kreislauf gefüllt
    ns.UI.Show("home")
    local rows = ns.UI.pages.home.loop.rows
    assert(rows[1].text:GetText() ~= "", "Kreislauf gefüllt")
    -- Tooltip: Mindestpreis
    GameTooltip.lines = {}
    W.tooltipHook(GameTooltip, { id = 2589 })
    assert(table.concat(GameTooltip.lines, "|"):find("Nicht unter") ~= nil, "Mindestpreis im Tooltip: " .. table.concat(GameTooltip.lines, " | "))
  end)

  -- Preis-Strings (TSM-Stil): Rechnen, TSM-Namen, Fehler, Marktwert
  step("Preis-Strings", function()
    local PS = ns.PriceString
    local function ev(str, ctx)
      local fn, err = PS.Compile(str)
      assert(fn, "String sollte gültig sein: " .. str .. " / " .. tostring(err))
      return fn({ get = function(src) return ctx[src] end })
    end
    local c = { ahprice = 1000, market = 700, vendorbuy = nil, crafting = 400, levelgold = 2500 }
    assert(ev("min(ahprice, 125% market)", c) == 875, "min mit Prozent")
    assert(ev("first(vendorbuy, ahprice, market)", c) == 1000, "first überspringt fehlende Werte")
    assert(ev("max(15% crafting, levelgold)", c) == 2500, "max")
    assert(ev("max(120%crafting, dbmarket)", c) == 700, "TSM-Schreibweise ohne Leerzeichen + dbmarket")
    assert(ev("crafting/1.4/0.95", c) - 400 / 1.4 / 0.95 < 0.001, "Division wie im TSM-Guide")
    assert(ev("1g50s + 20c", c) == 15020, "Geld-Zahlen")
    assert(ev("avg(ahprice, market) - 50", c) == 800, "avg und Minus")
    assert(ev("min(vendorbuy)", c) == nil, "nur fehlende Werte -> kein Wert")
    for _, bad in ipairs({ "min(ahprice", "foo + 1", "ahprice $ 2", "", "max()" }) do
      local fn, err = PS.Compile(bad)
      assert(not fn and err, "ungültig: " .. bad)
    end
    assert(not PS.Set("craftValue", "kaputt(") and PS.Get("craftValue") == PS.DEFAULTS.craftValue, "kaputter String wird nicht übernommen")
    assert(PS.Set("craftValue", "ahprice") and PS.Get("craftValue") == "ahprice", "eigener String")
    PS.Reset()
    assert(PS.Get("craftValue") == PS.DEFAULTS.craftValue, "zurücksetzen")
    -- Marktwert = Median der Tagespreise
    TirysZentraleDB.priceHistory = { [999001] = { ["2026-11-01"] = 100, ["2026-11-02"] = 300, ["2026-11-03"] = 200 } }
    assert(PS.Market(999001) == 200, "Median")
    TirysZentraleDB.priceHistory[999001]["2026-11-04"] = 1000
    assert(PS.Market(999001) == 250, "Median gerade Anzahl")
    for i = 1, 20 do PS.Record(999002, 100 + i) end
    -- Editor-Feld im Craft-Planer
    local p = ns.UI.pages.recipes
    ns.UI.Show("recipes")
    local box = p.strings.minProfit.box
    box:SetText("max(20% crafting, 5s)")
    W.call(box, "OnEnterPressed")
    assert(PS.Get("minProfit") == "max(20% crafting, 5s)", "String aus dem Feld übernommen")
    box:SetText("max(20% crafting")
    W.call(box, "OnEnterPressed")
    assert(PS.Get("minProfit") == "max(20% crafting, 5s)", "Fehlerhafter String ändert nichts")
    PS.Reset() ; p.refresh(p)
    p.fresh:Click() ; p.fresh:Click()
  end)

  -- TSM-Ablauf: Mindestgewinn eintippen -> Liste erstellen -> Einkaufsfenster -> kaufen -> Post -> craften
  if opts.auctionator ~= false then step("Einkaufsfenster wie TSM", function()
    local P = ns.ParseMoney
    assert(P("45") == 4500 and P("1g 20s") == 12000 and P("1,5g") == 15000 and P("80s") == 8000 and P("50k") == 50 and P("abc") == nil, "Geld-Eingabe")
    local p = ns.UI.pages.recipes
    ns.UI.Show("recipes")
    -- freie Eingabe am Regler
    p.profit.hit:Click()
    p.profit.edit:SetText("2s")
    W.call(p.profit.edit, "OnEnterPressed")
    assert(select(2, ns.Recipes.Filter()) == 200, "eingetippter Mindestgewinn: " .. select(2, ns.Recipes.Filter()))
    W.prices[4238], W.prices[2996], W.prices[2589] = 1000, 100, 60
    TirysZentraleDB.vendorBuy[2320] = 10
    TirysZentraleCharDB.hiddenRecipes = {}
    TirysZentraleCharDB.queue = {}
    p.prof, p.view = "TAILORING", "known"
    local savedBags = W.bags
    W.bags = { [0] = {} }
    p.refresh(p)
    -- Liste erstellen (je Rezept 3x)
    p.perRecipe.hit:Click() ; p.perRecipe.edit:SetText("3") ; W.call(p.perRecipe.edit, "OnEnterPressed")
    p.makeBtn:Click()
    assert(#TirysZentraleCharDB.queue == 1 and TirysZentraleCharDB.queue[1].recipe == 3755 and TirysZentraleCharDB.queue[1].n == 3, "Liste erstellt")
    local win = TirysZentraleShopWindow
    assert(win and win:IsShown(), "Einkaufsfenster offen")
    local need = {}
    for _, e in ipairs((ns.Shop.List())) do need[e.id] = e.missing end
    assert(need[2996] == 9 and need[2320] == 9, "Bedarf 9 Ballen + 9 Faden: " .. tostring(need[2996]) .. "/" .. tostring(need[2320]))
    -- im AH gekauft -> sofort weg
    W.fire("COMMODITY_PURCHASED", 2996, 9) ; W.flush()
    for _, e in ipairs((ns.Shop.List())) do need[e.id] = e.missing end
    assert(need[2996] == 0, "Kauf wird abgezogen")
    -- Briefkasten: Ware liegt dort -> weiter gezählt, kein Doppelzählen
    W.inbox = { { { 2996, 9 } } }
    W.fire("MAIL_SHOW") ; W.flush()
    for _, e in ipairs((ns.Shop.List())) do need[e.id] = e.missing end
    assert(need[2996] == 0, "Briefkasten zählt mit")
    -- Post geholt: jetzt in den Taschen, Briefkasten leer
    W.inbox = {}
    W.bags[0] = { { itemID = 2996, stackCount = 9, quality = 1 }, { itemID = 2320, stackCount = 9, quality = 1 } }
    W.fire("MAIL_INBOX_UPDATE") ; W.fire("BAG_UPDATE_DELAYED") ; W.flush()
    local _, open = ns.Shop.List()
    assert(open == 0, "alles da")
    -- Berufsfenster zu -> erster Klick öffnet es, zweiter stellt her
    W.crafted, W.openedSkill = 0, nil
    win.craft:Click()
    assert(W.openedSkill == 197, "Schneiderei geöffnet")
    W.recipes = { [3755] = { name = "Leinentasche", out = 4238, reagents = { { 2996, 3 }, { 2320, 3 } } } }
    W.fire("TRADE_SKILL_SHOW") ; W.flush()
    win.craft:Click()
    assert(W.crafted == 3 and W.craftedID == 3755, "3 Leinentaschen hergestellt")
    W.fire("TRADE_SKILL_CLOSE") ; W.flush()
    -- x an der Rezeptzeile blendet aus
    p.refresh(p)
    p.list.rows[1].action:Click()
    assert(TirysZentraleCharDB.hiddenRecipes[3755], "x blendet aus")
    win.close = nil
    ns.Shop.Toggle() ; ns.Shop.Toggle()
    W.call(win.rows[1], "OnEnter") ; W.call(win.rows[1], "OnLeave")
    win.search:Click()
    -- Was wird gecraftet? + Händler kauft fehlendes Material mit einem Klick
    TirysZentraleCharDB.queue = { { recipe = 3755, prof = "TAILORING", n = 2 } }
    W.bags[0] = {}
    local crafts = ns.Shop.Crafts()
    assert(#crafts == 1 and crafts[1].n == 2 and crafts[1].status == "fehlt", "Craft-Anzeige: 2x Leinentasche, Material fehlt")
    ns.Shop.Refresh()
    assert(win.crafts[1]:IsShown() and win.crafts[1].name:GetText():find("Leinentasche"), "Fenster zeigt, was gecraftet wird")
    W.merchant = { { id = 2320, name = "Grober Faden", price = 10, maxStack = 4 }, { id = 2996, name = "Leinenstoffballen", price = 500, avail = 0 } }
    W.bought, W.boughtByID = 0, {}
    W.fire("MERCHANT_SHOW") ; W.flush()
    local plan = ns.Shop.VendorPlan()
    assert(#plan == 1 and plan[1].id == 2320 and plan[1].qty == 6, "Händler-Plan: 6 Faden (Ballen ausverkauft)")
    assert(win.search.mode == "vendor", "Knopf wird zu 'Beim Händler kaufen'")
    win.search:Click()
    assert(W.boughtByID[2320] == 6, "6 Faden gekauft, in Stapeln <= MaxStack: " .. tostring(W.boughtByID[2320]))
    local ok2 = ns.Shop.BuyFromVendor()
    assert(not ok2, "Doppelklick-Schutz")
    W.fire("MERCHANT_CLOSED") ; W.flush()
    assert(win.search.mode == "ah", "ohne Händler wieder AH-Suche")
    W.bought, W.boughtByID, W.merchant = nil, nil, {}
    W.bags = savedBags
    TirysZentraleCharDB.queue, TirysZentraleCharDB.hiddenRecipes = {}, {}
  end) end

  -- Karte
  step("Rückgängig überall", function()
    local p = ns.UI.pages.recipes
    ns.UI.Show("recipes")
    -- Mindestgewinn: eigener Wert -> × zurück zur Empfehlung
    ns.Recipes.SetProfit(12345) ; p.refresh(p)
    assert(p.profit.reset:IsShown(), "× am Mindestgewinn sichtbar")
    p.profit.reset:Click()
    assert(select(3, ns.Recipes.Filter()) == true and not p.profit.reset:IsShown(), "× setzt auf Empfehlung zurück")
    -- Je Rezept
    TirysZentraleDB.settings.craft.perRecipe = 7 ; p.refresh(p)
    assert(p.perRecipe.reset:IsShown(), "× an Je Rezept")
    p.perRecipe.reset:Click()
    assert(TirysZentraleDB.settings.craft.perRecipe == 2, "Je Rezept wieder 2")
    -- Profi-String
    ns.PriceString.Set("matPrice", "ahprice") ; p.refresh(p)
    assert(p.strings.matPrice.undo:IsShown(), "× am Profi-String")
    p.strings.matPrice.undo:Click()
    assert(ns.PriceString.Get("matPrice") == ns.PriceString.DEFAULTS.matPrice, "String wieder empfohlen")
    -- Filter
    TirysZentraleDB.settings.craft.onlySafe = false ; p.refresh(p)
    assert(p.filterReset:IsShown(), "Filter-Standard-Knopf sichtbar")
    p.filterReset:Click()
    assert(TirysZentraleDB.settings.craft.onlySafe == true, "Filter zurückgesetzt")
    -- Alte Ausgeblendete erscheinen NICHT als Chip-Wolke
    TirysZentraleCharDB.hiddenRecipes = { [2152] = true } ; p.lastHidden = nil ; p.refresh(p)
    local chips = 0
    for _, c in ipairs(p.hiddenRow.chips) do if c:IsShown() then chips = chips + 1 end end
    assert(not p.hiddenRow:IsShown() or (chips == 1 and p.hiddenRow.chips[1].restoreAll), "keine Chip-Wolke für alte Ausgeblendete")
    -- × an einer Zeile: weg, nur EIN Rückgängig für genau dieses Rezept
    TirysZentraleCharDB.hiddenRecipes = {} ; p.refresh(p)
    local row = p.list.rows[1]
    if row and row:IsShown() and row.action and row.action:IsShown() then
      local before = 0
      row.action:Click()
      for _ in pairs(TirysZentraleCharDB.hiddenRecipes) do before = before + 1 end
      assert(before == 1 and p.hiddenRow:IsShown() and p.hiddenRow.chips[1].text:GetText():find("Rückgängig"), "× blendet aus + ein Rückgängig")
      p.hiddenRow.chips[1]:Click()
      assert(next(TirysZentraleCharDB.hiddenRecipes) == nil and not p.hiddenRow:IsShown(), "Rückgängig holt es zurück")
    end
    -- Warteschlange leeren -> Rückgängig
    TirysZentraleCharDB.queue = { { recipe = 2152, prof = "LEATHERWORKING", n = 3 } } ; p.refresh(p)
    p.queueCard.clear:Click()
    assert(#TirysZentraleCharDB.queue == 0 and p.queueCard.clear.text:GetText() == "Rückgängig", "Rückgängig-Knopf nach Leeren")
    p.queueCard.clear:Click()
    assert(#TirysZentraleCharDB.queue == 1 and TirysZentraleCharDB.queue[1].n == 3, "Warteschlange wiederhergestellt")
    -- Einkaufsliste: Material überspringen und zurückholen
    ns.Shop.Show() ; W.flush()
    local first = ns.Shop.List()[1]
    if first and first.missing > 0 then
      ns.Shop.ToggleSkip(first.id)
      local e2 ; for _, e in ipairs((ns.Shop.List())) do if e.id == first.id then e2 = e end end
      assert(e2.skipped and e2.missing == 0, "Material übersprungen")
      ns.Shop.ToggleSkip(first.id)
      for _, e in ipairs((ns.Shop.List())) do if e.id == first.id then e2 = e end end
      assert(not e2.skipped and e2.missing > 0, "Material zurückgeholt")
    end
    TirysZentraleCharDB.queue = {}
    -- Einstellungen: zwei Klicks setzen alles zurück
    TirysZentraleDB.settings.ahCut = 9 ; TirysZentraleDB.settings.autoJunk = false
    ns.Recipes.SetProfit(999)
    ns.UI.Show("settings")
    local sp = ns.UI.pages.settings
    local all = sp.resetAll
    assert(all and all.text:GetText() == "Alle Einstellungen auf Standard", "Knopf Alle Einstellungen auf Standard")
    all:Click() ; assert(TirysZentraleDB.settings.ahCut == 9, "erster Klick fragt nur")
    all:Click()
    assert(TirysZentraleDB.settings.ahCut == 5 and TirysZentraleDB.settings.autoJunk == true, "alles auf Standard")
    assert(select(3, ns.Recipes.Filter()) == true, "Mindestgewinn wieder Empfehlung")
  end)

  step("Karten-Wegpunkt", function()
    ns.UI.Show("farm")
    local p = ns.UI.pages.farm
    p.segments:Select("10-20", true)
    p.cards[1].spots[1]:Click()
    ns.UI.Show("methods")
    local mp = ns.UI.pages.methods
    for _, m in ipairs(ns.METHODS) do mp.expanded[m.key] = true end
    mp.refresh(mp)
    for _, c in ipairs(mp.cards) do for _, b in ipairs(c.mapBtns or {}) do if b:IsShown() then b:Click() end end end
  end)
  check(label .. ": Wegpunkt gesetzt", W.waypoint ~= nil and W.superTracked == true and W.mapOpened ~= nil)
  step("Wegpunkt entfernen", function()
    assert(TirysZentraleMainFrame.wpBtn:IsShown(), "Knopf Wegpunkt × sichtbar")
    TirysZentraleMainFrame.wpBtn:Click() ; W.flush()
    assert(W.waypoint == nil and not TirysZentraleMainFrame.wpBtn:IsShown(), "Wegpunkt gelöscht")
  end)
  local spots = 0
  for _, band in pairs(ns.SPOTS) do for _, g in pairs(band) do spots = spots + #g end end
  check(label .. ": Hotspots vorhanden", spots > 80, tostring(spots))
  for map in pairs(ns.ZONE_NAMES) do
    if not ns.ZONE_FACTION[map] then check(label .. ": Zone ohne Fraktion " .. map, false) end
  end

  -- Kürschner-Zentrale
  local K = ns.Skin
  check(label .. ": Häuten-Formel", K.MaxLevel(87) == 18 and K.MaxLevel(150) == 30 and K.MaxLevel(1) == 10 and K.SkillFor(25) == 125)
  check(label .. ": Häut-Spots passend", #K.Spots(18) > 0)
  step("Kürschner-Seite", function()
    W.repairCost = 1234
    ns.UI.Show("skinning")
    local p = ns.UI.pages.skinning
    p.spotRows[1]:Click()
    for _, r in ipairs(p.specialRows) do if r:IsEnabled() then r:Click() end end
    -- Leder looten -> eigener Fundort
    W.bags[3] = { { itemID = 2318, stackCount = 4, quality = 1 } }
    W.fire("BAG_UPDATE_DELAYED") ; W.flush()
    ns.UI.RefreshPage("skinning")
    if p.mineRows[1]:IsShown() then p.mineRows[1]:Click() end
    p.craftBtn:Click()
    -- Händler: automatisch reparieren
    W.fire("MERCHANT_SHOW") ; W.flush() ; W.fire("MERCHANT_CLOSED") ; W.flush()
  end)
  check(label .. ": eigener Fundort gemerkt", (select(2, K.MySpots("leather"))) >= 1)
  check(label .. ": automatisch repariert", W.repaired == true)
  -- Tooltip-Erweiterung
  step("Item-Tooltip", function()
    assert(W.tooltipHook, "Tooltip-Haken fehlt")
    GameTooltip.lines = {}
    W.tooltipHook(GameTooltip, { id = 2996 })
    W.tooltipHook(GameTooltip, { id = 249427 })
    W.tooltipHook(GameTooltip, { id = 2447 })
    W.combat = true ; W.tooltipHook(GameTooltip, { id = 2589 }) ; W.combat = false
  end)
  check(label .. ": Tooltip zeigt Rezept-Info", table.concat(GameTooltip.lines, "|"):find("deiner Rezepte") ~= nil, table.concat(GameTooltip.lines, " | "))

  -- AH-Scan per Knopf und Erkennung
  step("AH-Scan-Knopf", function()
    W.fire("AUCTION_HOUSE_SHOW") ; W.flush()
    TirysZentraleMainFrame.scanBtn:Click()
    if W.dbCallback then W.dbCallback() end
    W.flush()
    W.fire("AUCTION_HOUSE_CLOSED") ; W.flush()
    ns.UI.Show("market")
    ns.UI.pages.market.segments:Select("forever", true)
    ns.UI.Show("database")
    ns.UI.pages.database.segCat:Select("forever", true)
  end)
  if opts.auctionator ~= false then
    check(label .. ": Scan gestartet", W.scanStarted == true)
    check(label .. ": Scan erkannt", TirysZentraleDB.lastScan ~= nil)
  end
  check(label .. ": Neu-in-Forever-Liste", #ns.UI.pages.market.list.rows > 30)

  -- Farm-Guide: alle Levelbereiche
  step("Farm-Guide", function()
    ns.UI.Show("farm")
    local p = ns.UI.pages.farm
    for _, b in ipairs(p.segments.buttons) do b:Click() W.flush() end
    p.cards[1].listBtn:Click()
  end)

  -- Autopilot: Schrott, Händler-Panel, Verkaufen, Flips kaufen, Beute-Radar
  step("Autopilot beim Händler", function()
    W.junk = 3
    W.merchant = { { id = 5771, name = "Muster: Rote Leinentasche", price = 200, avail = 2 } }
    W.prices[2934] = 1 -- Verdorbene Lederfetzen: AH schlechter als Händler (7 Kupfer)
    W.fire("MERCHANT_SHOW") ; W.flush()
    local panel = TirysZentraleMerchantPanel
    assert(panel and panel:IsShown(), "Händler-Panel fehlt")
    panel.sell:Click() ; W.flush()
    panel.buy:Click() ; W.flush()
    W.fire("MERCHANT_CLOSED") ; W.flush()
  end)
  check(label .. ": Schrott automatisch verkauft", W.junkSold == true)
  if opts.auctionator ~= false and not opts.noData then
    check(label .. ": Händler-Ware verkauft", (W.sold or 0) >= 1, tostring(W.sold))
    check(label .. ": Flips gekauft", (W.bought or 0) == 2, tostring(W.bought))
  end
  step("Beute-Radar", function()
    W.fire("BAG_UPDATE_DELAYED") ; W.flush()
    W.bags[2] = { { itemID = 249427, stackCount = 3, quality = 2 } }
    W.fire("BAG_UPDATE_DELAYED") ; W.flush()
    W.fire("AUCTION_HOUSE_SHOW") ; W.flush()
    W.fire("AUCTION_HOUSE_CLOSED") ; W.flush()
    ns.UI.Show("tracker")
  end)
  check(label .. ": Beute erkannt", ns.Auto.session.items >= 3, tostring(ns.Auto.session.items))

  -- Gold
  step("Goldänderung", function()
    W.money = 60000 ; W.fire("PLAYER_MONEY")
    W.money = 55000 ; W.fire("PLAYER_MONEY")
    W.now = W.now + 3600
    ns.UI.Show("tracker")
  end)
  local net, perHour = ns.Tracker.SessionStats()
  check(label .. ": Sitzungsgewinn", net == 5000 and perHour and math.floor(perHour) == 5000, tostring(net) .. " / " .. tostring(perHour))

  -- Einstellungen: alle Schalter und Stufen
  step("Einstellungen", function()
    ns.UI.Show("settings")
    for _, w in ipairs(ns.UI.pages.settings.items) do
      if w.Click then w:Click() w:Click() end
    end
  end)

  -- Minikarte, Addon-Menü, Befehle
  step("Minikarte & Befehle", function()
    local b = TirysZentraleMinimapButton
    W.call(b, "OnEnter") ; W.call(b, "OnLeave")
    W.call(b, "OnClick", "RightButton") ; W.call(b, "OnClick", "LeftButton")
    W.call(b, "OnDragStart") ; W.call(b, "OnUpdate") ; W.call(b, "OnDragStop")
    TirysZentrale_OnAddonCompartmentClick("TirysZentrale", "LeftButton")
    TirysZentrale_OnAddonCompartmentEnter("TirysZentrale", UIParent)
    TirysZentrale_OnAddonCompartmentLeave("TirysZentrale", UIParent)
    for _, c in ipairs({ "leder", "kuerschner", "farm", "craft", "db", "suche", "wege", "markt", "scan", "rezepte", "tagebuch", "ah", "optionen", "minimap", "minimap", "reset", "quatsch" }) do
      SlashCmdList.TIRYSZENTRALE(c)
    end
  end)
  step("Auctionator meldet neue Preise", function()
    if W.dbCallback then W.dbCallback() end
    W.fire("GET_ITEM_INFO_RECEIVED", 2592, true)
  end)
  step("Fenster schließen", function() TirysZentraleMainFrame:Hide() end)
  step("Levelaufstieg", function() W.fire("PLAYER_LEVEL_UP", 21) end)

  check(label .. ": keine Laufzeitfehler", #W.errors == 0, table.concat(W.errors, "\n"))
  return W, ns
end

runScenario("Standard (Allianz, Schurke, Auctionator)", {})
runScenario("Ohne Auctionator, Horde, Level 8", { auctionator = false, faction = "Horde", level = 8, class = "WARRIOR" })
runScenario("Leerer Item-Cache, englischer Client", { itemInfo = {}, locale = "enUS", prices = {}, noData = true })
runScenario("Alte gespeicherte Daten", { db = { settings = { scale = 5, minimap = "kaputt" } } })

print(string.format("\n%d Prüfungen bestanden, %d fehlgeschlagen", passed, failed))
os.exit(failed == 0 and 0 or 1)

-- Goldrausch – Ladetest gegen den strengen Forever-Nachbau. Aufruf: lua5.1 wow-addons/tests/run_tests.lua
package.path = package.path .. ";" .. (arg[0]:match("^(.*/)") or "./") .. "?.lua"
local HERE = arg[0]:match("^(.*/)") or "./"
local ROOT = HERE .. "../Goldrausch/"

local passed, failed = 0, 0
local function check(name, cond, msg)
  if cond then passed = passed + 1 else failed = failed + 1 print("FEHLER: " .. name .. (msg and (" – " .. msg) or "")) end
end

local function tocFiles()
  local files = {}
  for line in io.lines(ROOT .. "Goldrausch.toc") do
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
    { name = "Waffenfertigkeiten", isHeader = true, isCollapsed = false },
    { name = "Dolche", skillID = 173, isHeader = false, rank = 100, maxRank = 100 },
  }
  W.itemInfo = opts.itemInfo or { [2589] = { name = "Leinenstoff", sell = 13 }, [4238] = { name = "Leinentasche", sell = 200, stack = 1 } }
  W.prices = opts.prices or { [2589] = 60, [2592] = 120, [2318] = 90, [2770] = 40, [4238] = 900, [2320] = 30, [249427] = 4000, [5771] = 30000 }
  W.install({ auctionator = opts.auctionator, locale = opts.locale })
  GoldrauschDB, GoldrauschCharDB = opts.db, nil

  local ns = {}
  for _, f in ipairs(tocFiles()) do
    local chunk, err = loadfile(ROOT .. f)
    check(label .. ": lädt " .. f, chunk ~= nil, err)
    if chunk then
      local ok, e = pcall(chunk, "Goldrausch", ns)
      check(label .. ": führt " .. f .. " aus", ok, e)
    end
  end
  local function step(name, fn)
    local ok, e = pcall(fn)
    check(label .. ": " .. name, ok, e)
    W.flush()
  end

  step("ADDON_LOADED", function() W.fire("ADDON_LOADED", "Goldrausch") end)
  step("PLAYER_LOGIN", function() W.fire("PLAYER_LOGIN") W.fire("PLAYER_ENTERING_WORLD", true, false) end)
  check(label .. ": Berufe erkannt", ns.professions[393] and ns.professions[197] and not ns.professions[173], "Kürschnerei/Schneiderei")
  check(label .. ": SavedVariables", type(GoldrauschDB) == "table" and type(GoldrauschCharDB) == "table")

  step("Slash /gold öffnet", function() SlashCmdList.GOLDRAUSCH("") end)
  check(label .. ": Fenster sichtbar", GoldrauschMainFrame and GoldrauschMainFrame:IsShown())
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
  step("Startseite Top-Karte klicken", function()
    ns.UI.Show("home")
    local c = ns.UI.pages.home.tops[1]
    W.call(c, "OnEnter") ; c:Click()
  end)
  check(label .. ": Top-Karte öffnet Goldwege", ns.UI.current == "methods")

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
    check(label .. ": Einkaufsliste angelegt", W.lists and W.lists["Goldrausch: Stoff"] ~= nil)
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
  check(label .. ": Datenbank vollständig", #DB.Load() == ns.ALLDB_COUNT and ns.ALLDB_COUNT > 18000, tostring(#DB.Load()))
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
  check(label .. ": Händlerpreis gemerkt", GoldrauschDB.vendorBuy[2320] == 10)
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
  check(label .. ": Rezepte gespeichert", GoldrauschCharDB.recipes and GoldrauschCharDB.recipes["Schneiderei"] and #GoldrauschCharDB.recipes["Schneiderei"].list == 2)

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
    local b = GoldrauschMinimapButton
    W.call(b, "OnEnter") ; W.call(b, "OnLeave")
    W.call(b, "OnClick", "RightButton") ; W.call(b, "OnClick", "LeftButton")
    W.call(b, "OnDragStart") ; W.call(b, "OnUpdate") ; W.call(b, "OnDragStop")
    Goldrausch_OnAddonCompartmentClick("Goldrausch", "LeftButton")
    Goldrausch_OnAddonCompartmentEnter("Goldrausch", UIParent)
    Goldrausch_OnAddonCompartmentLeave("Goldrausch", UIParent)
    for _, c in ipairs({ "db", "suche", "wege", "markt", "scan", "rezepte", "tagebuch", "ah", "optionen", "minimap", "minimap", "reset", "quatsch" }) do
      SlashCmdList.GOLDRAUSCH(c)
    end
  end)
  step("Auctionator meldet neue Preise", function()
    if W.dbCallback then W.dbCallback() end
    W.fire("GET_ITEM_INFO_RECEIVED", 2592, true)
  end)
  step("Fenster schließen", function() GoldrauschMainFrame:Hide() end)
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

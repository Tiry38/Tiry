-- busted-Tests für Tiry's Zentrale gegen den strengen Forever-Nachbau (tests/wow_mock.lua)
-- Aufruf im Ordner wow-addons:  busted
local E = require("addon_env")

local function noErrors(W)
  assert.are.same({}, W.errors)
end

local function openAll(ns)
  for _, def in ipairs(ns.UI.order) do ns.UI.Show(def.key) end
end

describe("Grundfunktion mit Auctionator", function()
  local ns, W
  setup(function() ns, W = E.load({}) end)

  it("lädt ohne Fehler und erkennt Berufe", function()
    noErrors(W)
    assert.truthy(ns.professions[393])
    assert.truthy(ns.professions[165])
  end)

  it("hat höchstens 8 Hauptpunkte im Menü und alle Ansichten sind erreichbar", function()
    SlashCmdList.TIRYSZENTRALE("")
    local n = 0
    for _ in pairs(TirysZentraleMainFrame.nav) do n = n + 1 end
    assert.is_true(n <= 8)
    -- Dock: genau 5 Bereiche entlang des Gold-Kreislaufs; Handel = Auktionen + Markt zusammengelegt
    local dock = {}
    for _, g in ipairs(ns.UI.GROUPS) do if not g.util then dock[#dock + 1] = g.label end end
    assert.are.same({ "Start", "Herstellen", "Farmen", "Handel", "Mein Gold" }, dock)
    assert.truthy(TirysZentraleMainFrame.nav.handel, "Menüpunkt Handel fehlt")
    assert.are.equal("handel", ns.UI.GroupOf("auctions").key)
    assert.are.equal("handel", ns.UI.GroupOf("market").key)
    assert.truthy(TirysZentraleMainFrame.nav.lernen and TirysZentraleMainFrame.nav.settings, "Schnellknöpfe Lernen/Einstellungen fehlen")
    for _, def in ipairs(ns.UI.order) do
      assert.truthy(ns.UI.GroupOf(def.key), "Ansicht ohne Menüpunkt: " .. def.key)
    end
    -- Jeder Bereich ist per Klick erreichbar und öffnet eine eigene Ansicht
    for key, b in pairs(TirysZentraleMainFrame.nav) do
      if b.key then
        b:Click()
        assert.are.equal(key, ns.UI.GroupOf(ns.UI.current).key, "Klick auf " .. key)
      end
    end
    -- Gespeicherter Reiter aus dem alten Menüpunkt "Markt" wird im Bereich Handel wieder geöffnet
    ns.settings.lastView = { markt = "alerts" }
    TirysZentraleMainFrame.nav.handel:Click()
    assert.are.equal("alerts", ns.UI.current)
    openAll(ns)
    noErrors(W)
  end)

  it("zeigt den Einsteiger-Assistenten genau einmal", function()
    assert.is_true(ns.UI.Wizard.IsShown() and true or false)
    ns.UI.Wizard.Go(3)
    ns.UI.Wizard.Finish()
    assert.is_true(ns.settings.wizardDone)
    ns.UI.Show("home")
    assert.is_falsy(ns.UI.Wizard.IsShown())
  end)

  it("liefert immer genau einen nächsten Schritt", function()
    local step = ns.Guide.NextStep()
    assert.is_string(step.title)
    assert.is_function(step.action)
  end)

  it("findet über die globale Suche Items, Rezepte und Begriffe", function()
    local hits = ns.UI.Search.Find("leder")
    local kinds = {}
    for _, h in ipairs(hits) do kinds[h.kind] = true end
    assert.truthy(kinds.item)
    assert.truthy(kinds.recipe)
    assert.truthy(#ns.UI.Search.Find("flip") > 0)
    assert.are.equal(0, #ns.UI.Search.Find("x"))
  end)
end)

describe("Ohne Auctionator", function()
  local ns, W
  setup(function() ns, W = E.load({ auctionator = false }) end)

  it("lädt, öffnet alle Seiten und meldet sauber, dass Preise fehlen", function()
    SlashCmdList.TIRYSZENTRALE("")
    openAll(ns)
    noErrors(W)
    assert.are.equal("missing", (ns.Market.Status()))
    assert.is_nil(ns.Market.Price(2318))
    assert.are.equal("Auctionator installieren", ns.Guide.NextStep().title)
  end)

  it("Scan-Knopf und Einkaufslisten scheitern ohne Fehler", function()
    assert.is_false(ns.Market.StartScan())
    local ok = ns.Market.CreateShoppingList("x", { 2318 })
    assert.is_false(ok)
    noErrors(W)
  end)
end)

describe("Ohne Scandaten", function()
  it("fordert zum Scannen auf", function()
    local ns, W = E.load({ prices = {} })
    assert.are.equal("empty", (ns.Market.Status()))
    assert.truthy(ns.Guide.NextStep().title:find("scannen"))
    SlashCmdList.TIRYSZENTRALE("")
    openAll(ns)
    noErrors(W)
  end)
end)

describe("Ohne Berufe, Stufe 1", function()
  it("lädt alles und gibt hilfreiche Hinweise", function()
    local ns, W = E.load({ skills = {}, level = 1, known = {} })
    SlashCmdList.TIRYSZENTRALE("")
    openAll(ns)
    noErrors(W)
    assert.is_nil(next(ns.professions))
    local plan, err = ns.Advisor.Plan("LEATHERWORKING", 25)
    assert.is_nil(plan)
    assert.is_string(err)
  end)
end)

describe("Fehlende API-Funktionen (Absicherung)", function()
  it("überlebt einen Client ohne Craft-, Händler-, Karten- und Bank-API", function()
    local ns, W = E.load({ remove = {
      "C_TradeSkillUI.CraftRecipe", "C_TradeSkillUI.OpenTradeSkill", "C_MerchantFrame", "C_Map.SetUserWaypoint",
      "C_SkillInfo.ExpandSkillHeader", "C_Bank", "C_Texture", "InCombatLockdown", "C_SuperTrack", "GetMerchantItemMaxStack",
      "C_SpellBook",
    } })
    SlashCmdList.TIRYSZENTRALE("")
    openAll(ns)
    ns.UI.pages.recipes.CraftNext(ns.UI.pages.recipes)
    ns.Maps.Show({ map = 1411, x = 40, y = 50 }, "Test")
    W.fire("MERCHANT_SHOW") W.flush()
    W.fire("BANKFRAME_OPENED") W.flush()
    noErrors(W)
  end)
end)

describe("Kampf-Sperre", function()
  local ns, W
  setup(function()
    ns, W = E.load({ combat = true, bags = { [0] = { { itemID = 2589, stackCount = 5, quality = 1 } } } })
    W.junk = 3
    W.merchant = { { id = 2320, name = "Grober Faden", price = 10 } }
  end)

  it("verkauft keinen Schrott und repariert nicht im Kampf", function()
    W.fire("MERCHANT_SHOW") W.flush()
    assert.is_falsy(W.junkSold)
  end)

  it("kauft und craftet nicht im Kampf", function()
    ns.char.queue = { { recipe = 2881, prof = "LEATHERWORKING", n = 1 } }
    local ok = ns.Shop.BuyFromVendor()
    assert.is_false(ok)
    assert.are.equal(0, ns.Auto.SellVendorItems())
    W.prints = {}
    ns.UI.pages.recipes.CraftNext(ns.UI.pages.recipes)
    assert.truthy(E.chat(W):find("Im Kampf gesperrt"))
    assert.is_falsy(W.crafted)
  end)

  it("arbeitet nach dem Kampf wieder", function()
    W.combat = false
    W.fire("MERCHANT_CLOSED") W.fire("MERCHANT_SHOW") W.flush()
    assert.is_true(W.junkSold)
  end)
end)

describe("Rechnungen", function()
  local ns, W
  setup(function() ns, W = E.load({}) end)

  it("rechnet Einzel-Auktionen (buyoutAmount) auf den Stückpreis um", function()
    ns.db.priceHistory = { [2319] = { ["2026-11-06"] = 1000, ["2026-11-07"] = 1000 } }
    W.ahResults = { [2319] = { { 2000, 10 } } } -- ganze Auktion 2000 Kupfer für 10 Stück = 200 pro Stück
    W.fire("ITEM_SEARCH_RESULTS_UPDATED", { itemID = 2319 })
    local d = ns.Deals.found[2319]
    assert.truthy(d)
    assert.are.equal(200, d.price)
  end)

  it("Preisalarm meldet sich unter dem Wunschpreis", function()
    ns.Alerts.Set(2318, 40)
    W.prints = {}
    ns.Fire("PRICES_UPDATED")
    assert.truthy(E.chat(W):find("Preisalarm"))
    assert.are.equal(1, ns.Alerts.ActiveCount())
    ns.Alerts.Remove(2318)
    assert.are.equal(0, ns.Alerts.ActiveCount())
  end)

  it("Farm-Session zählt Händler-Einnahmen nicht doppelt", function()
    ns.Session.Start()
    W.money = W.money + 500 -- Gold geplündert
    W.fire("PLAYER_MONEY")
    W.fire("MERCHANT_SHOW") W.flush()
    W.money = W.money + 300 -- Beute beim Händler verkauft
    W.fire("PLAYER_MONEY")
    W.fire("MERCHANT_CLOSED")
    local st = ns.Session.Stats()
    assert.are.equal(500, st.gold)
    ns.Session.Stop()
    assert.are.equal(1, #ns.Session.History())
    assert.is_nil(ns.Session.Current())
  end)

  it("Skill-Chance folgt den Skill-Farben", function()
    local r = { yellow = 100, grey = 140 }
    assert.are.equal(1, ns.Advisor.Chance(r, 90))
    assert.are.equal(0.5, ns.Advisor.Chance(r, 120))
    assert.are.equal(0, ns.Advisor.Chance(r, 140))
  end)

  it("Item-Datenbank: Abruf, Suche, Name -> ID, Platzhalter ausgeblendet", function()
    assert.are.equal("Leichtes Leder", ns.DB.Get(2318).name)
    assert.are.equal(2318, ns.DB.IDByName("Leichtes Leder"))
    assert.truthy(#ns.DB.Search("leichtes leder") >= 1)
    for _, e in ipairs(ns.DB.Search("monster chest")) do assert.is_falsy(e.name:find("DNT", 1, true)) end
  end)
end)

describe("Bindings.xml", function()
  it("jede Tastenbelegung ruft eine vorhandene Funktion auf", function()
    local ns, W = E.load({})
    local xml = assert(io.open("TirysZentrale/Bindings.xml")):read("*a")
    local n = 0
    for name, body in xml:gmatch('<Binding name="([%w_]+)"[^>]*>(.-)</Binding>') do
      n = n + 1
      assert.is_string(_G["BINDING_NAME_" .. name], "Name fehlt: " .. name)
      local fn = assert(loadstring(body))
      assert.has_no.errors(fn)
    end
    assert.are.equal(4, n)
    noErrors(W)
    assert.truthy(ns)
  end)
end)

describe("Schrift", function()
  it("benutzt nur Zeichen, die es in Poppins gibt", function()
    local metrics = dofile("tests/font_metrics.lua")
    local E2 = require("addon_env")
    local bad = {}
    for _, f in ipairs(E2.tocFiles()) do
      if not f:find("Data_AllItems") and not f:find("Data_Recipes") then
        for line in io.lines("TirysZentrale/" .. f) do
          local code = line:gsub("%-%-.*$", "")
          for ch in code:gmatch("[\194-\244][\128-\191]+") do
            local b1, b2, b3 = ch:byte(1, 3)
            local cp = #ch == 2 and ((b1 % 32) * 64 + b2 % 64) or ((b1 % 16) * 4096 + (b2 % 64) * 64 + (b3 or 128) % 64)
            if not metrics.semibold[cp] then bad[#bad + 1] = f .. ": " .. ch end
          end
        end
      end
    end
    assert.are.same({}, bad)
  end)
end)

describe("Eigene Fehleranzeige", function()
  it("zeigt Fehler aus Tiry's Zentrale im Chat, speichert sie und lässt andere Addons in Ruhe", function()
    local ns, W = E.load({})
    W.prints = {}
    geterrorhandler()("Interface/AddOns/TirysZentrale/UI/PageHome.lua:12: kaputt")
    geterrorhandler()("Interface/AddOns/TirysZentrale/UI/PageHome.lua:12: kaputt")
    geterrorhandler()("Interface/AddOns/AnderesAddon/x.lua:1: fremd")
    local log = ns.ErrorLog()
    assert.are.equal(1, #log)
    assert.are.equal(2, log[1].count)
    assert.truthy(E.chat(W):find("Tiry's Zentrale – Fehler", 1, true))
    assert.is_falsy(E.chat(W):find("fremd", 1, true))
    -- der vorherige Fehler-Handler bekommt weiterhin alles
    assert.are.equal(3, #W.errors)
    W.prints = {}
    SlashCmdList.TIRYSZENTRALE("fehler")
    assert.truthy(E.chat(W):find("kaputt", 1, true))
    SlashCmdList.TIRYSZENTRALE("fehler leeren")
    assert.are.equal(0, #ns.ErrorLog())
  end)
end)

describe("Fehler beim Klicken (Forever reicht Fehler nicht weiter)", function()
  it("fängt Fehler in Knöpfen selbst ab und zeigt sie im Chat", function()
    local ns, W = E.load({})
    W.prints = {}
    local b = ns.UI.Button(UIParent, "Test", "soft", 100, 30)
    b:SetScript("OnClick", function() error("Knopf kaputt") end)
    assert.has_no.errors(function() b:Click() end)
    assert.truthy(E.chat(W):find("Knopf kaputt", 1, true))
    assert.are.equal(1, ns.ErrorLog()[1].count) -- nicht doppelt gezählt
  end)

  it("/tz fehlertest erscheint im Chat", function()
    local ns, W = E.load({})
    W.prints = {}
    SlashCmdList.TIRYSZENTRALE("fehlertest")
    W.flush()
    assert.truthy(E.chat(W):find("Testfehler", 1, true))
    assert.truthy(ns.ErrorLog()[1].msg:find("Testfehler", 1, true))
  end)
end)

describe(".toc", function()
  it("lädt jede Datei genau einmal, und jede Datei existiert", function()
    local seen = {}
    for _, f in ipairs(E.tocFiles()) do
      assert.is_nil(seen[f], "doppelt: " .. f)
      seen[f] = true
      assert.truthy(io.open("TirysZentrale/" .. f), "fehlt: " .. f)
    end
  end)
end)

describe("Meine Auktionen", function()
  local ns, W
  setup(function()
    ns, W = E.load({})
    W.owned = {
      { auctionID = 11, itemKey = { itemID = 2318 }, status = 0, quantity = 20, timeLeftSeconds = 3600 * 20, buyoutAmount = 40 },
      { auctionID = 12, itemKey = { itemID = 2589 }, status = 0, quantity = 10, timeLeftSeconds = 3600 * 5, buyoutAmount = 70 },
      { auctionID = 13, itemKey = { itemID = 4238 }, status = 0, quantity = 2, timeLeftSeconds = 3600, buyoutAmount = 2000 },
    }
    W.nonCommodity = { [4238] = true } -- Tasche: Einzel-Item -> buyoutAmount ist der Preis der ganzen Auktion
  end)

  it("liest beim Öffnen des AH automatisch die eigenen Auktionen und prüft auf Unterbieten", function()
    W.ahResults = { [2318] = { { 35, 50 }, { 40, 20, true } }, [2589] = { { 80, 5 } }, [4238] = { { 1500, 1 } } }
    W.prints = {}
    W.fire("AUCTION_HOUSE_SHOW") W.flush()
    assert.truthy(W.ownedQueried)
    W.fire("OWNED_AUCTIONS_UPDATED") W.flush()
    -- der Reihe nach: erst Leder, dann Leinen, dann Tasche (Antworten simulieren)
    W.fire("COMMODITY_SEARCH_RESULTS_UPDATED", 2318) W.flush()
    W.fire("COMMODITY_SEARCH_RESULTS_UPDATED", 2589) W.flush()
    W.fire("ITEM_SEARCH_RESULTS_UPDATED", { itemID = 4238 }) W.flush()
    local byID = {}
    for _, a in ipairs(ns.AH.Store().list) do byID[a.id] = a end
    assert.are.equal(40, byID[2318].unit)
    assert.is_true(byID[2318].undercut) -- 35 < 40 (eigenes Angebot zählt nicht)
    assert.is_false(byID[2589].undercut) -- 80 > 70
    assert.are.equal(1000, byID[4238].unit) -- 2000 für 2 Stück
    assert.is_false(byID[4238].undercut) -- 1500 > 1000
    assert.truthy(E.chat(W):find("unterboten", 1, true))
    assert.are.equal(1, ns.AH.Summary().undercut)
    assert.truthy(W.scanStarted) -- danach automatisch der Auctionator-Scan
  end)

  it("erkennt Verkäufe auch fern vom AH", function()
    W.fire("AUCTION_HOUSE_CLOSED") W.flush()
    W.fire("AUCTION_HOUSE_SHOW_FORMATTED_NOTIFICATION", 4, "Leinenstoff", 12)
    local sold = ns.AH.Store().sold
    assert.are.equal(1, #sold)
    assert.are.equal(2589, sold[1].id)
    assert.are.equal(1, ns.AH.Summary().soldToday)
    for _, a in ipairs(ns.AH.Store().list) do
      if a.auctionID == 12 then assert.are.equal("sold", a.status) end
    end
  end)

  it("Ansicht und Knöpfe laufen ohne Fehler", function()
    SlashCmdList.TIRYSZENTRALE("")
    ns.UI.Wizard.Finish()
    ns.UI.Show("auctions")
    local p = ns.UI.pages.auctions
    p.checkBtn:Click()
    p.listBtn:Click()
    p.sold.rows[1].action:Click()
    assert.are.equal(0, #ns.AH.Store().sold)
    assert.are.same({}, W.errors)
  end)

  it("Craft-Planer: Aktualisieren-Knopf", function()
    ns.UI.Show("recipes")
    W.prints = {}
    ns.UI.pages.recipes.refreshBtn:Click()
    assert.truthy(E.chat(W):find("aktualisiert", 1, true))
    assert.are.same({}, W.errors)
  end)
end)

describe("Rezepte zum Kaufen (Muster, Pläne ...)", function()
  local ns, W
  setup(function()
    ns, W = E.load({
      prices = { [4244] = 30000, [4243] = 500, [4231] = 300, [2320] = 10, [4293] = 9000, [2318] = 32 },
      itemInfo = { [4293] = { name = "Muster: Lederweste des Hügelwächters", stack = 1 } },
    })
    SlashCmdList.TIRYSZENTRALE("")
    ns.UI.Wizard.Finish()
  end)

  it("kennt das Rezept-Item zum Rezept (aus den Spieldaten)", function()
    local r = ns.Recipes.Get(3762)
    assert.are.equal(4293, ns.Recipes.RecipeItem(r))
    local item, price, crafts = ns.Recipes.Payback(r, 3000)
    assert.are.equal(4293, item)
    assert.are.equal(9000, price)
    assert.are.equal(3, crafts)
  end)

  it("Craft-Planer 'Lernen lohnt sich' zeigt das Rezept-Item, Shift-Klick legt es in die Suche", function()
    ns.UI.Show("recipes")
    local p = ns.UI.pages.recipes
    p.prof, p.view = "LEATHERWORKING", "learnable"
    ns.UI.RefreshPage("recipes")
    local row
    for _, rw in ipairs(p.list.rows) do if rw:IsShown() and rw.itemID == 4293 then row = rw end end
    assert.truthy(row, "Zeile mit Muster fehlt")
    assert.truthy(row.name:GetText():find("Muster", 1, true))
    W.shift = true
    local orig = IsShiftKeyDown
    IsShiftKeyDown = function() return true end
    row:Click()
    IsShiftKeyDown = orig
    assert.truthy(W.linked and W.linked:find("4293", 1, true))
    assert.are.equal("Rezepte suchen", p.makeBtn.text:GetText())
    p.makeBtn:Click() -- AH zu -> Auctionator-Liste "Zentrale: Rezepte"
    assert.truthy(W.lists["Zentrale: Rezepte"])
    assert.are.same({}, W.errors)
  end)

  it("Berufe-Berater empfiehlt das Rezept mit 'bezahlt nach'", function()
    local tips = ns.Advisor.RecipeTips(8)
    local found
    for _, t in ipairs(tips) do if t.r.id == 3762 then found = t end end
    assert.truthy(found)
    assert.are.equal(4293, found.item)
    assert.truthy(found.payback and found.payback >= 1)
    ns.UI.Show("advisor")
    assert.are.same({}, W.errors)
  end)
end)

describe("Rezept-Tipps passen zu Skill und Beruf", function()
  local prices = { [4244] = 30000, [4243] = 500, [4231] = 300, [2320] = 10, [4293] = 9000 }
  local function load(rank, extraSkills)
    local skills = { { name = "Lederverarbeitung", skillID = 165, isHeader = false, rank = rank, maxRank = 150 } }
    for _, s in ipairs(extraSkills or {}) do skills[#skills + 1] = s end
    return E.load({ prices = prices, skills = skills })
  end
  local function has(ns, id)
    for _, t in ipairs(ns.Advisor.RecipeTips(50)) do if t.r.id == id then return t end end
  end

  it("Muster braucht Skill 75: bei 40 nicht dabei, bei 66 als 'bald', bei 80 als 'jetzt lernbar'", function()
    local ns = load(40)
    assert.is_nil(has(ns, 3762))
    ns = load(66)
    local t = has(ns, 3762)
    assert.truthy(t) assert.are.equal("soon", t.state) assert.are.equal(75, t.req)
    ns = load(80)
    t = has(ns, 3762)
    assert.truthy(t) assert.are.equal("now", t.state)
    assert.truthy(t.learnText:find("jetzt lernbar", 1, true))
  end)

  it("zeigt nur Rezepte deiner Berufe", function()
    local ns = load(80)
    for _, t in ipairs(ns.Advisor.RecipeTips(50)) do assert.are.equal("LEATHERWORKING", t.prof) end
  end)

  it("lohnt sich nicht, wenn das Rezept zu teuer ist (mehr als 30 Crafts)", function()
    prices[4293] = 9000000
    local ns = load(80)
    assert.is_nil(has(ns, 3762))
    prices[4293] = 9000
  end)
end)

describe("AH-Scan höchstens alle 30 Minuten", function()
  it("scannt beim zweiten Öffnen nicht erneut, nach 30 Minuten wieder", function()
    local ns, W = E.load({})
    W.owned = { { auctionID = 1, itemKey = { itemID = 2318 }, status = 0, quantity = 5, timeLeftSeconds = 7200, buyoutAmount = 40 } }
    local function visit()
      W.scanStarted, W.searchedKeys, W.ownedQueried = nil, nil, 0
      W.fire("AUCTION_HOUSE_SHOW") W.flush()
      W.fire("OWNED_AUCTIONS_UPDATED") W.flush()
      W.fire("COMMODITY_SEARCH_RESULTS_UPDATED", 2318) W.flush()
      W.fire("AUCTION_HOUSE_CLOSED") W.flush()
    end
    visit()
    assert.truthy(W.scanStarted)
    assert.truthy(W.searchedKeys)
    W.now = W.now + 10 * 60 -- 10 Minuten später wieder am AH
    visit()
    assert.are.equal(1, W.ownedQueried) -- eigene Auktionen werden trotzdem gelesen
    assert.is_nil(W.scanStarted)
    assert.is_nil(W.searchedKeys)
    assert.are.equal(20, ns.AH.NextAutoIn())
    W.now = W.now + 21 * 60 -- 31 Minuten nach dem ersten Besuch
    visit()
    assert.truthy(W.scanStarted)
    -- "Jetzt prüfen" geht immer
    W.searchedKeys = nil
    W.fire("AUCTION_HOUSE_SHOW") W.flush()
    ns.AH.CheckNow()
    W.fire("OWNED_AUCTIONS_UPDATED") W.flush()
    assert.truthy(W.searchedKeys)
  end)
end)

describe("× im Craft-Planer", function()
  it("blendet das Rezept aus, zeigt nur EIN Rückgängig, keine Wolke", function()
    local ns, W = E.load({ prices = { [4244] = 30000, [4243] = 500, [4231] = 300, [2320] = 10, [4293] = 9000 } })
    SlashCmdList.TIRYSZENTRALE("") ns.UI.Wizard.Finish()
    ns.UI.Show("recipes")
    local p = ns.UI.pages.recipes
    p.prof, p.view = "LEATHERWORKING", "learnable"
    ns.UI.RefreshPage("recipes")
    local row = p.list.rows[1]
    assert.truthy(row and row:IsShown(), "keine Zeile")
    -- zwei Rezepte nacheinander weg
    row.action:Click()
    local second = p.list.rows[1]
    if second and second:IsShown() then second.action:Click() end
    local n = 0
    for _ in pairs(ns.char.hiddenRecipes) do n = n + 1 end
    assert.is_true(n >= 1)
    local shownChips = 0
    for _, c in ipairs(p.hiddenRow.chips) do if c:IsShown() then shownChips = shownChips + 1 end end
    assert.are.equal(1, shownChips) -- nur das letzte
    p.hiddenRow.chips[1]:Click()
    assert.is_falsy(p.hiddenRow:IsShown())
    assert.are.same({}, W.errors)
  end)
end)

describe("Craft-Liste: selbst gecraftet zählt, Ruf-Rezepte draußen, leere Liste", function()
  it("hakt Crafts aus dem Berufsfenster auf der Liste ab (auch ohne 'Nächstes craften')", function()
    local ns, W = E.load({})
    ns.char.queue = { { recipe = 2164, prof = "LEATHERWORKING", n = 2 } }
    local r = ns.Recipes.Get(2164)
    W.bags = { [0] = {} }
    W.fire("BAG_UPDATE_DELAYED") W.flush() -- Ausgangslage merken
    W.recipes = {}
    W.fire("TRADE_SKILL_SHOW") W.flush()
    W.bags = { [0] = { { itemID = r.out, stackCount = 2, quality = 2 } } } -- 2 Stück selbst hergestellt
    W.fire("BAG_UPDATE_DELAYED") W.flush()
    assert.are.equal(0, #ns.char.queue)
    local _, open = ns.Shop.List()
    assert.are.equal(0, open) -- Einkaufsliste leer
  end)

  it("lässt Rezepte, die Ruf brauchen, komplett draußen", function()
    local ns = E.load({ skills = { { name = "Lederverarbeitung", skillID = 165, isHeader = false, rank = 300, maxRank = 300 } } })
    for _, r in ipairs(ns.Recipes.List("LEATHERWORKING", "learnable")) do
      assert.is_false(ns.Recipes.NeedsRep(r), r.name)
    end
    local repCount = 0
    for id in pairs(ns.RECIPE_ITEMS) do if ns.RECIPE_ITEMS[id][3] == 1 then repCount = repCount + 1 end end
    assert.is_true(repCount > 100) -- Daten enthalten die Ruf-Markierung
  end)

  it("zeigt bei leerer Liste 'Alle ausgeblendeten zurückholen'", function()
    local ns = E.load({ prices = { [4244] = 30000, [4243] = 500, [4231] = 300, [2320] = 10, [4293] = 9000 } })
    SlashCmdList.TIRYSZENTRALE("") ns.UI.Wizard.Finish()
    ns.UI.Show("recipes")
    local p = ns.UI.pages.recipes
    p.prof, p.view = "LEATHERWORKING", "learnable"
    ns.UI.RefreshPage("recipes")
    -- alles wegklicken
    for _ = 1, 50 do
      local row = p.list.rows[1]
      if not (row and row:IsShown()) then break end
      row.action:Click()
    end
    p.lastHidden = nil
    ns.UI.RefreshPage("recipes")
    assert.is_true(p.hiddenRow:IsShown())
    assert.is_true(p.hiddenRow.chips[1].restoreAll)
    p.hiddenRow.chips[1]:Click()
    assert.is_nil(next(ns.char.hiddenRecipes))
    assert.truthy(p.list.rows[1]:IsShown())
  end)
end)

describe("Auktionen: Gold unterwegs -> Briefkasten -> abgeholt", function()
  local function sell(ns, W)
    W.owned = { { auctionID = 21, itemKey = { itemID = 2318 }, status = 0, quantity = 20, timeLeftSeconds = 7200, buyoutAmount = 40 } }
    W.fire("AUCTION_HOUSE_SHOW") W.flush()
    W.fire("OWNED_AUCTIONS_UPDATED") W.flush()
    W.fire("AUCTION_HOUSE_CLOSED") W.flush()
    W.prints = {}
    W.fire("AUCTION_HOUSE_SHOW_FORMATTED_NOTIFICATION", 4, "Leichtes Leder", 21)
  end

  it("nach dem Verkauf: unterwegs (nicht im Briefkasten), Brief da -> genau, abholen -> weg", function()
    local ns, W = E.load({})
    sell(ns, W)
    local gold, _, onWay = ns.AH.MailGold()
    local est
    assert.are.equal(0, gold)
    assert.are.equal(math.floor(40 * 20 * 0.95), onWay) -- 760 nach 5 % Gebühr, aber noch unterwegs
    assert.truthy(E.chat(W):find("unterwegs", 1, true))
    assert.are.equal("way", (ns.AH.SoldState(ns.AH.Store().sold[1])))
    assert.are.equal(0, ns.AH.Summary().active)
    assert.is_falsy(ns.Guide.NextStep().title:find("Gold abholen", 1, true))
    -- 3 Minuten später: Briefkasten öffnen, Verkaufsbrief ist da
    W.now = W.now + 180
    W.mails = { { subject = "Auktion erfolgreich: Leichtes Leder", money = 760, invoice = { "seller", "Leichtes Leder", "Käufer", 800, 20 } } }
    W.fire("MAIL_SHOW") W.flush()
    gold, est, onWay = ns.AH.MailGold()
    assert.are.equal(760, gold)
    assert.is_false(est)
    assert.are.equal(0, onWay)
    assert.are.equal(180, ns.AH.TypicalDelay()) -- Lieferzeit gelernt
    assert.truthy(ns.Guide.NextStep().title:find("Gold abholen", 1, true))
    -- Gold abgeholt
    W.mails = {}
    W.fire("MAIL_INBOX_UPDATE") W.flush()
    W.fire("MAIL_CLOSED") W.flush()
    assert.are.equal(0, (ns.AH.MailGold()))
    assert.are.equal("done", ns.AH.Store().sold[1].state)
    assert.are.same({}, W.errors)
  end)

  it("neue Post fern vom Briefkasten -> im Briefkasten; gelernte Lieferzeit -> 'sollte da sein'", function()
    local ns, W = E.load({})
    sell(ns, W)
    W.now = W.now + 200
    W.newMail = true
    W.fire("UPDATE_PENDING_MAIL") W.flush()
    assert.are.equal("mail", ns.AH.Store().sold[1].state)
    assert.truthy(E.chat(W):find("Im Briefkasten", 1, true))
    -- zweiter Verkauf: Lieferzeit (200 s) ist bekannt -> nach Ablauf "sollte da sein"
    W.newMail = false
    W.fire("AUCTION_HOUSE_SHOW_FORMATTED_NOTIFICATION", 4, "Leichtes Leder", nil)
    local e = ns.AH.Store().sold[1]
    assert.are.equal("way", (ns.AH.SoldState(e)))
    W.now = W.now + 201
    local st, guess = ns.AH.SoldState(e)
    assert.are.equal("mail", st)
    assert.is_true(guess)
    assert.are.same({}, W.errors)
  end)

  it("offline verkauft: Brief ohne bekannten Verkauf wird nachgetragen", function()
    local ns, W = E.load({})
    W.mails = { { subject = "Auktion erfolgreich: Leichtes Leder", money = 500, invoice = { "seller", "Leichtes Leder", "Käufer", 520, 10 } } }
    W.fire("MAIL_SHOW") W.flush()
    assert.are.equal(500, (ns.AH.MailGold()))
    assert.is_true(ns.AH.Store().sold[1].offline)
  end)
end)

describe("Craft-Planer: Mindestgewinn 'alles'", function()
  it("zeigt auch Rezepte mit kleinem Gewinn (kein 15-%-Zuschlag auf die Materialkosten)", function()
    local ns, W = E.load({ prices = { [2318] = 3000, [2319] = 1200, [4234] = 2000, [2408] = 1000, [2320] = 10 } })
    SlashCmdList.TIRYSZENTRALE("") ns.UI.Wizard.Finish()
    ns.UI.Show("recipes")
    local p = ns.UI.pages.recipes
    p.prof, p.view = "LEATHERWORKING", "known"
    -- Verkaufspreis so setzen, dass der Gewinn ~2 Silber ist, aber unter 15 % der Materialkosten liegt
    local r = ns.Recipes.Get(2152)
    W.prices[r.out] = 1
    local _, _, cost = ns.Scanner.RecipeProfit(r)
    assert.truthy(cost and cost > 2000)
    W.prices[r.out] = math.ceil((cost + 200) / 0.95)
    local profit = ns.Scanner.RecipeProfit(r)
    assert.truthy(profit > 0 and profit < cost * 0.15)
    local function has(list) for _, e in ipairs(list) do if e.r.id == 2152 then return true end end end
    ns.Recipes.SetProfit(0)
    assert.is_true(has(p.Entries(p)))
    ns.Recipes.SetProfit(100)
    assert.is_nil(has(p.Entries(p)))
  end)
end)

describe("Selbst herstellen oder kaufen (Zwischenprodukte)", function()
  local prices = { [4233] = 1000, [4232] = 200, [4289] = 50, [2312] = 300, [2321] = 100, [4340] = 100, [4248] = 9000 }

  it("Geschmeidiger mittlerer Balg: selbst herstellen ist günstiger -> Rechnung + Einkaufsliste + Reihenfolge", function()
    local ns, W = E.load({ prices = prices, known = { [3765] = true, [3817] = true } })
    local r = ns.Recipes.Get(3765) -- Dunkle Lederhandschuhe (braucht 1 Geschmeidigen mittleren Balg)
    local unit, how = ns.Scanner.MatCost(4233)
    assert.are.equal("make", how)
    assert.are.equal(250, unit) -- Mittlerer Balg 200 + Salz 50 statt 1000 im AH
    local _, _, cost, _, makes = ns.Scanner.RecipeProfit(r)
    assert.are.equal(300 + 250 + 100 + 100, cost)
    assert.are.equal(4233, makes[1].id)
    assert.are.equal(750, makes[1].saves)
    -- Einkaufsliste: Balg + Salz statt fertigem Balg, Balg zuerst herstellen
    ns.char.queue = { { recipe = 3765, prof = "LEATHERWORKING", n = 2 } }
    local need, made = ns.Shop.Plan()
    assert.is_nil(need[4233])
    assert.are.equal(2, need[4232])
    assert.are.equal(2, need[4289])
    assert.are.equal(3817, made[1].recipe.id)
    assert.are.equal(2, made[1].n)
    local order = ns.Shop.CraftOrder()
    assert.are.equal(3817, order[1].recipe.id)
    assert.are.equal(3765, order[2].recipe.id)
    -- schon 1 fertiger Balg in der Tasche -> nur noch 1 selbst herstellen
    W.bags = { [0] = { { itemID = 4233, stackCount = 1, quality = 1 } } }
    need, made = ns.Shop.Plan()
    assert.are.equal(1, need[4233])
    assert.are.equal(1, need[4232])
    assert.are.equal(1, made[1].n)
    assert.are.same({}, W.errors)
  end)

  it("ohne gelerntes Rezept (oder fremder Beruf) wird immer gekauft", function()
    local ns = E.load({ prices = prices, known = { [3765] = true } })
    local _, how = ns.Scanner.MatCost(4233)
    assert.are.equal("buy", how)
    ns.char.queue = { { recipe = 3765, prof = "LEATHERWORKING", n = 1 } }
    local need, made = ns.Shop.Plan()
    assert.are.equal(1, need[4233])
    assert.are.equal(0, #made)
    -- Schneiderei-Rezept gelernt, aber kein Schneider: zählt nicht
    assert.is_false(ns.HasProf(ns.PROF.TAILORING))
  end)

  it("reines Leder (Lederfetzen -> Leichtes Leder) wird nie selbst hergestellt", function()
    -- Rezept 2881: 3 Verdorbene Lederfetzen -> 1 Leichtes Leder, Fetzen wären viel billiger
    local ns = E.load({ prices = { [2318] = 3000, [2934] = 10 }, known = { [2881] = true, [2152] = true } })
    local _, how = ns.Scanner.MatCost(2318)
    assert.are.equal("buy", how)
    assert.is_nil(ns.Scanner.Maker(2318))
  end)

  it("kaufen bleibt, wenn der fertige Balg billiger ist", function()
    local cheap = {}
    for k, v in pairs(prices) do cheap[k] = v end
    cheap[4233] = 200
    local ns = E.load({ prices = cheap, known = { [3765] = true, [3817] = true } })
    local unit, how = ns.Scanner.MatCost(4233)
    assert.are.equal("buy", how)
    assert.are.equal(200, unit)
  end)
end)

describe("Herstellungs-Balken: Gesamtdauer", function()
  it("rechnet Rest der ganzen Liste mit gelernten Dauern", function()
    local ns = E.load({})
    ns.char.queue = { { recipe = 2164, prof = "LEATHERWORKING", n = 3 }, { recipe = 2158, prof = "LEATHERWORKING", n = 2 } }
    local a, b = ns.Recipes.Get(2164), ns.Recipes.Get(2158)
    -- noch keine Dauer für b bekannt -> Schätzung mit der aktuellen Dauer
    local left, rest, crafts, est = ns.Shop.RemainingAfter(a.name, 3000)
    assert.are.equal(3, left)
    assert.are.equal(4, crafts)          -- 2 weitere von a + 2 von b
    assert.are.equal(4 * 3000, rest)
    assert.is_true(est)
    ns.Shop.LearnCastTime(a.name, 3000)
    ns.Shop.LearnCastTime(b.name, 5000)
    left, rest, crafts, est = ns.Shop.RemainingAfter(a.name, 3000)
    assert.are.equal(2 * 3000 + 2 * 5000, rest)
    assert.is_false(est)
    assert.are.equal("16 s", ns.Shop.Duration(16000))
    assert.are.equal("2:05 Min.", ns.Shop.Duration(125000))
  end)
end)

describe("Nächste Sorte ist dran: Knopf leuchtet", function()
  it("nach dem letzten Craft einer Sorte leuchtet 'Nächstes craften', Klick löscht es", function()
    local ns, W = E.load({})
    local a, b = ns.Recipes.Get(2164), ns.Recipes.Get(2158)
    ns.char.queue = { { recipe = 2158, prof = "LEATHERWORKING", n = 1 } }
    -- alles Material für b in der Tasche
    local slots = {}
    for _, re in ipairs(b.reagents) do slots[#slots + 1] = { itemID = re.id, stackCount = re.n * 2, quality = 1 } end
    W.bags = { [0] = slots }
    ns.Shop.Show()
    W.casting = { name = a.name, start = W.now * 1000, stop = W.now * 1000 + 3000 }
    W.fire("UNIT_SPELLCAST_START", "player", "g", a.id) W.flush()
    assert.is_nil(ns.Shop.signal)
    W.casting = nil
    W.fire("UNIT_SPELLCAST_STOP", "player", "g", a.id) W.flush()
    assert.truthy(ns.Shop.signal and ns.Shop.signal:find(ns.Item(b.out).name, 1, true))
    assert.is_true(TirysZentraleShopWindow.craftGlow:IsShown())
    TirysZentraleShopWindow.craft:Click()
    assert.is_nil(ns.Shop.signal)
    assert.is_false(TirysZentraleShopWindow.craftGlow:IsShown())
    assert.are.same({}, W.errors)
  end)
end)

describe("Craft-Planer: Sortieren per Spaltenkopf", function()
  it("Klick auf Material sortiert teuer zuerst, nochmal günstig zuerst", function()
    local ns = E.load({ prices = { [2318] = 3000, [2319] = 1200, [4234] = 2000, [2408] = 1000, [2320] = 10,
      [2312] = 90000, [2307] = 90000, [2304] = 90000 } })
    SlashCmdList.TIRYSZENTRALE("") ns.UI.Wizard.Finish()
    ns.Recipes.SetProfit(0)
    ns.UI.Show("recipes")
    local p = ns.UI.pages.recipes
    p.prof, p.view = "LEATHERWORKING", "known"
    local function sorted(desc)
      local list = p.Entries(p)
      table.sort(list, function(x, y) if desc then return x.cost > y.cost end return x.cost < y.cost end)
      return list
    end
    local head = p.list.heads.cost.btn
    head:Click()
    assert.are.equal("cost", ns.settings.craft.sortKey)
    assert.is_true(ns.settings.craft.sortDesc)
    assert.is_true(p.list.sortDesc)
    head:Click()
    assert.is_false(ns.settings.craft.sortDesc)
    assert.are.equal("cost", p.list.sortKey)
    assert.is_false(p.list.sortDesc)
    -- angezeigte Reihenfolge = günstig zuerst
    local want = sorted(false)
    assert.truthy(#want >= 2)
    ns.UI.RefreshPage("recipes")
    for i, e in ipairs(want) do
      assert.truthy(p.list.rows[i].name:GetText():find(e.r.name, 1, true))
    end
  end)
end)

describe("Herstell-Buch: echter Gewinn, Menge, Neu einstellen, Wochenbilanz", function()
  it("echter Gewinn = Verkaufsbrief minus bezahltes Material", function()
    local ns, W = E.load({ prices = { [2318] = 300, [2304] = 2000 } })
    local outName = ns.Item(2304).name
    -- 10 Leichtes Leder im AH gekauft für zusammen 1000 (= 100 pro Stück, AH-Preis heute 300)
    W.mails = { { subject = "Auktion gewonnen", money = 0, invoice = { "buyer", ns.Item(2318).name, "Händler", 1000, 10 } } }
    W.fire("MAIL_SHOW") W.flush()
    W.mails = {}
    W.fire("MAIL_CLOSED") W.flush()
    assert.are.equal(100, ns.CraftBook.PaidUnit(2318))
    -- 2× Leichtes Rüstungsset hergestellt
    ns.char.queue = { { recipe = 2152, prof = "LEATHERWORKING", n = 2 } }
    W.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "g", 2152) W.flush()
    W.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "g", 2152) W.flush()
    assert.are.equal(100, ns.CraftBook.UnitCost(2304))
    -- 1 verkauft: 900 nach Gebühr im Brief
    W.mails = { { subject = "Auktion erfolgreich", money = 900, invoice = { "seller", outName, "Käufer", 950, 1 } } }
    W.fire("MAIL_SHOW") W.flush()
    local list, t = ns.CraftBook.Report(7)
    assert.are.equal(2304, list[1].id)
    assert.are.equal(2, list[1].made)
    assert.are.equal(1, list[1].sold)
    assert.are.equal(800, list[1].profit)
    assert.are.equal(800, t.profit)
    assert.truthy(ns.CraftBook.WeekLine():find("echt verdient", 1, true))
    assert.are.equal(800, (ns.CraftBook.RealPerUnit(2304)))
    ns.UI.Show("results")
    assert.truthy(ns.UI.pages.results.list.rows[1]:IsShown())
    ns.UI.Show("home")
    assert.are.same({}, W.errors)
  end)

  it("empfohlene Menge: vorsichtig ohne Verkäufe, sonst Wochenabsatz minus Bestand", function()
    local ns, W = E.load({ prices = { [2318] = 300, [2304] = 2000 } })
    local r = ns.Recipes.Get(2152)
    local n = ns.CraftBook.Suggest(r)
    assert.are.equal((ns.Item(2304).stack or 1) > 1 and 5 or 2, n)
    -- 3 Verkäufe à 2 Stück in den letzten 14 Tagen -> 3 pro Woche
    ns.db.ledger = { sales = {}, buys = {}, expired = {}, seen = {} }
    for i = 1, 3 do table.insert(ns.db.ledger.sales, { t = W.now - i * 86400, id = 2304, n = 2, money = 1000 }) end
    assert.are.equal(3, (ns.CraftBook.Suggest(r)))
    -- 3 liegen schon in der Tasche -> nichts mehr herstellen
    W.bags = { [0] = { { itemID = 2304, stackCount = 3, quality = 2 } } }
    local k, why = ns.CraftBook.Suggest(r)
    assert.are.equal(0, k)
    assert.truthy(why:find("Umlauf", 1, true))
    -- "auto" in der Craft-Liste: übersprungen
    ns.settings.craft.perRecipe = 0
    local added, skipped = ns.UI.pages.recipes.FillQueue({ { r = r } })
    assert.are.equal(0, added)
    assert.are.equal(1, skipped)
  end)

  it("neu einstellen: Vorschlag = Konkurrenz minus 1 Kupfer, nie unter den Kosten", function()
    local ns, W = E.load({ prices = { [2318] = 300, [2304] = 2000 } })
    local s = ns.AH.Store()
    s.list = { { auctionID = 1, id = 2304, qty = 1, unit = 5000, status = "active", undercut = true, competitor = 4000, expires = W.now + 3600 } }
    local l = ns.AH.RelistList()
    assert.are.equal("unterboten", l[1].where)
    assert.are.equal(3999, l[1].price)
    assert.are.equal(math.ceil((300 + ns.Market.DepositRisk(2304)) / 0.95), l[1].floor)
    s.list[1].competitor = 200
    l = ns.AH.RelistList()
    assert.are.equal(l[1].floor, l[1].price)
    assert.is_true(l[1].wait)
    ns.UI.Show("auctions")
    assert.is_true(ns.UI.pages.auctions.relist:IsShown())
    assert.are.same({}, W.errors)
  end)

  it("Skill-Plan rechnet netto (Material minus Verkauf)", function()
    local ns = E.load({ prices = { [2318] = 300, [2320] = 10, [4231] = 500, [2304] = 2000, [2312] = 5000, [2307] = 4000 } })
    local plan = ns.Advisor.Plan("LEATHERWORKING", 10)
    if plan and #plan.steps > 0 then
      assert.truthy(plan.net <= plan.total)
      assert.truthy(plan.steps[1].net)
    end
    -- Verkauf netto nach AH-Gebühr minus Einstellgebühr-Risiko (1 Silber je 10er-Angebot, 1 Fehlversuch erwartet)
    local r = ns.Recipes.Get(2152)
    local risk = ns.Market.DepositRisk(r.out)
    assert.truthy(risk > 0)
    assert.are.equal(math.floor(2000 * 0.95) - risk, ns.Advisor.Resale(r))
  end)
end)

describe("Hergestellt -> Craft-Liste abhaken (alle Wege, nie doppelt)", function()
  local function setup3(ns, W)
    ns.char.queue = { { recipe = 2164, prof = "LEATHERWORKING", n = 3 } }
    W.bags = { [0] = {} }
    W.fire("BAG_UPDATE_DELAYED") W.flush()
  end
  local out = 4247 -- Ergebnis von Rezept 2164 laut Daten (wird unten geprüft)

  it("Weg (a): TRADE_SKILL_ITEM_CRAFTED_RESULT – auch bei geschlossenem Berufsfenster", function()
    local ns, W = E.load({})
    out = ns.Recipes.Get(2164).out
    setup3(ns, W)
    W.fire("TRADE_SKILL_ITEM_CRAFTED_RESULT", { itemID = out, quantity = 1, itemGUID = "x", hyperlink = "" }) W.flush()
    assert.are.equal(2, ns.char.queue[1].n)
  end)

  it("Weg (b): UNIT_SPELLCAST_SUCCEEDED mit der Rezept-Nummer", function()
    local ns, W = E.load({})
    setup3(ns, W)
    W.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "guid", 2164) W.flush()
    W.fire("UNIT_SPELLCAST_SUCCEEDED", "target", "guid", 2164) W.flush() -- fremde Einheit zählt nicht
    assert.are.equal(2, ns.char.queue[1].n)
  end)

  it("alle drei Wege für EIN Herstellen -> nur einmal abgehakt; Einkaufsliste schrumpft", function()
    local ns, W = E.load({})
    setup3(ns, W)
    W.recipes = {}
    W.fire("TRADE_SKILL_SHOW") W.flush()
    W.prints = {}
    W.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "guid", 2164)
    W.fire("TRADE_SKILL_ITEM_CRAFTED_RESULT", { itemID = out, quantity = 1, itemGUID = "x", hyperlink = "" })
    W.bags = { [0] = { { itemID = out, stackCount = 1, quality = 2 } } }
    W.fire("BAG_UPDATE_DELAYED")
    W.flush()
    assert.are.equal(2, ns.char.queue[1].n)
    assert.truthy(E.chat(W):find("noch 2", 1, true))
    -- die nächsten zwei
    W.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "guid", 2164) W.flush()
    W.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "guid", 2164) W.flush()
    assert.are.equal(0, #ns.char.queue)
    local list = ns.Shop.List()
    assert.are.equal(0, #list)
    assert.are.same({}, W.errors)
  end)
end)

describe("Herstellungs-Balken in der Einkaufsliste", function()
  it("erscheint beim Herstellen, zeigt Restzeit und verschwindet danach", function()
    local ns, W = E.load({})
    ns.char.queue = { { recipe = 2164, prof = "LEATHERWORKING", n = 3 } }
    ns.Shop.Show()
    local win = TirysZentraleShopWindow
    local name = ns.Recipes.Get(2164).name
    W.casting = { name = name, start = W.now * 1000, stop = W.now * 1000 + 3000 }
    W.fire("UNIT_SPELLCAST_START", "player", "guid", 2164) W.flush()
    assert.is_true(win.cast:IsShown())
    assert.truthy(win.cast.text:GetText():find("noch 3", 1, true) or win.cast.text:GetText():find("...", 1, true))
    W.call(win.cast, "OnUpdate", 0.1)
    assert.truthy(win.cast.time:GetText():find("s", 1, true))
    -- Zauber anderer Art (kein Beruf) -> kein Balken
    W.casting = { name = "Feuerball", start = 0, stop = 1, trade = false }
    W.fire("UNIT_SPELLCAST_START", "player", "guid", 133) W.flush()
    assert.is_false(win.cast:IsShown())
    W.casting = nil
    W.fire("UNIT_SPELLCAST_STOP", "player", "guid", 2164) W.flush()
    assert.is_false(win.cast:IsShown())
    assert.are.same({}, W.errors)
  end)
end)

describe("Gold-Kreislauf (Startseite)", function()
  it("führt durch Planen, Einkaufen, Herstellen, Verkaufen", function()
    local ns, W = E.load({ prices = { [4244] = 30000, [4243] = 500, [4231] = 300, [2320] = 10, [2318] = 32, [2319] = 120, [4234] = 2000, [2408] = 1000 } })
    SlashCmdList.TIRYSZENTRALE("") ns.UI.Wizard.Finish()
    local function states()
      local s = {}
      for _, st in ipairs(ns.Guide.CraftLoop()) do s[st.key] = st.state end
      return s
    end
    ns.char.queue = {}
    local s = states()
    assert.are.equal("now", s.plan)
    -- Liste für alle Berufe
    ns.UI.pages.recipes.MakeListAll()
    if #ns.char.queue > 0 then
      s = states()
      assert.are.equal("done", s.plan)
      assert.truthy(s.buy == "now" or s.buy == "done")
    end
    -- 2× hergestellt (wie im Spiel: Rezept-Zauber gewirkt) -> Verkaufen ist dran
    local r = ns.Recipes.Get(2164)
    ns.char.queue = { { recipe = 2164, prof = "LEATHERWORKING", n = 2 } }
    W.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "g", 2164) W.flush()
    W.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "g", 2164) W.flush()
    assert.are.equal(0, #ns.char.queue)
    W.bags = { [0] = { { itemID = r.out, stackCount = 2, quality = 2 }, { itemID = 2318, stackCount = 18, quality = 1 } } }
    local sell = ns.Guide.ReadyToSell()
    assert.are.equal(1, #sell) -- Leichtes Leder (Rohmaterial) zählt NICHT als hergestellt
    assert.are.equal(2, sell[1].n)
    assert.are.equal(r.out, sell[1].id)
    s = states()
    assert.are.equal("now", s.sell)
    ns.UI.Show("home")
    ns.UI.Show("recipes")
    assert.truthy(ns.UI.pages.recipes.sellList.rows[1]:IsShown())
    assert.are.same({}, W.errors)
  end)
end)

describe("Einstellgebühr (Forever: mind. 1 Kupfer seit 10.11.2026, weg bei Ablauf)", function()
  it("schätzt ohne AH: Minimum je Angebot oder Anteil am Händlerpreis", function()
    local ns, W = E.load({ itemInfo = { [4238] = { name = "Leinentasche", sell = 200, stack = 1 },
      [5000] = { name = "Teures Schwert", sell = 5000, stack = 1 }, [9999] = { name = "Feder", sell = 0, stack = 20 } } })
    local M = ns.Market
    assert.are.equal(2, M.Duration())
    assert.are.equal(40, (M.Deposit(4238, 1)))          -- 20 % von 2s = 40c (Minimum 1 Kupfer)
    assert.are.equal(1000, (M.Deposit(5000, 1)))        -- 20 % von 50s
    assert.are.equal(1, (M.Deposit(9999, 1)))           -- ohne Händlerpreis: Minimum 1 Kupfer
    ns.settings.ahDeposit = 100                        -- eigenes Minimum (z. B. alter Wert 1 Silber)
    assert.are.equal(100, (M.Deposit(4238, 1)))
    noErrors(W)
  end)

  it("nimmt bei offenem AH Blizzards exakten Betrag und merkt ihn sich", function()
    local ns, W = E.load({ itemInfo = { [2318] = { name = "Leichtes Leder", sell = 10, stack = 20 } } })
    local M = ns.Market
    C_AuctionHouse.CalculateCommodityDeposit = function(id, duration, qty)
      assert.are.equal(2318, id) assert.are.equal(2, duration)
      return 15 * qty
    end
    M.ahOpen = true
    local v, exact = M.Deposit(2318, 20)
    assert.are.equal(300, v) assert.is_true(exact)
    M.ahOpen = false
    v, exact = M.Deposit(2318, 10)
    assert.are.equal(150, v) assert.is_false(exact)    -- gemerkt und auf die Menge umgerechnet
    noErrors(W)
  end)

  it("Risiko pro Stück = Gebühr je Stück × erwartete Fehlversuche aus der Verkaufsquote", function()
    local ns, W = E.load({ itemInfo = { [4238] = { name = "Leinentasche", sell = 200, stack = 1 } } })
    local M = ns.Market
    assert.are.equal(1, M.ExpectedRelists(4238))        -- ohne Daten: jede 2. Auktion läuft ab
    assert.are.equal(40, M.DepositRisk(4238))
    ns.db.ledger = { sales = {}, buys = {}, expired = {} }
    for i = 1, 4 do table.insert(ns.db.ledger.sales, { id = 4238, t = W.now - i, money = 900, n = 1 }) end
    assert.are.equal(0, M.ExpectedRelists(4238))        -- verkauft sich immer -> Gebühr kommt immer zurück
    assert.are.equal(0, M.DepositRisk(4238))
    noErrors(W)
  end)
end)

describe("Absatz: Verkäufe pro Tag aus zwei AH-Scans", function()
  it("zählt nur Angebote, die vor Ablauf verschwunden sind, und erkennt Umstellen", function()
    local ns, W = E.load()
    local D = ns.Demand
    local a = { b = { ["100|Xa"] = { q = 5, s = 43200 }, ["120|Yo"] = { q = 3, s = 0 } } }
    local b = { b = { ["100|Xa"] = { q = 2, s = 43200 } } }
    local sold, observable = D.Compare(a, b, 3600)
    assert.are.equal(3, sold) assert.is_true(observable)  -- Yo hatte < 1 Std. Rest: kann abgelaufen sein
    -- Xa nimmt seine 5 raus und stellt sie billiger neu ein -> kein Verkauf
    sold = D.Compare({ b = { ["100|Xa"] = { q = 5, s = 43200 } } }, { b = { ["90|Xa"] = { q = 5, s = 43200 } } }, 3600)
    assert.are.equal(0, sold)
    noErrors(W)
  end)

  it("liest den Komplett-Scan mit, misst Verkäufe/Tag und stuft Kleinvieh vor Ladenhüter", function()
    local ns, W = E.load({ itemInfo = { [2318] = { name = "Leichtes Leder", sell = 10, stack = 20 },
      [4238] = { name = "Leinentasche", sell = 200, stack = 1 } } })
    local D = ns.Demand
    local auctions
    C_AuctionHouse.GetNumReplicateItems = function() return #auctions end
    C_AuctionHouse.GetReplicateItemInfo = function(i)
      local a = auctions[i + 1]
      return nil, nil, a.q, 1, true, 1, nil, 0, 0, a.price * a.q, 0, nil, nil, a.owner, a.owner, 0, a.id, true
    end
    C_AuctionHouse.GetReplicateItemTimeLeft = function(i) return auctions[i + 1].band end
    ns.char.watch = { [2318] = true, [4238] = true }
    ns.Market.ahOpen = true
    auctions = {
      { id = 2318, q = 20, price = 40, owner = "Ana", band = 3 }, { id = 2318, q = 20, price = 42, owner = "Bo", band = 3 },
      { id = 4238, q = 1, price = 90000, owner = "Cy", band = 3 },
    }
    W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
    W.now = W.now + 2 * 3600
    auctions = {
      { id = 2318, q = 6, price = 40, owner = "Ana", band = 3 },  -- 14 + 20 (Bo komplett) verkauft
      { id = 4238, q = 1, price = 90000, owner = "Cy", band = 3 },
    }
    W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
    local perDay, src = D.PerDay(2318)
    assert.are.equal("markt", src)
    assert.are.equal(34 * 12, math.floor(perDay + 0.5))   -- 34 Stück in 2 Std.
    assert.are.equal("fast", D.Class(2318))
    assert.truthy(D.Text(2318, true):find("Schnelldreher"))
    -- Tasche: über 12 Std. beobachtet, nichts verkauft -> Ladenhüter
    for _ = 1, 6 do
      W.now = W.now + 2 * 3600
      W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
    end
    assert.are.equal("slow", D.Class(4238))
    -- Handel > Preise: Spalte "Pro Tag" und Absatz im Tooltip
    ns.UI.Show("market")
    local mp = ns.UI.pages.market
    local got
    local orig = mp.list.SetEntries
    mp.list.SetEntries = function(me, entries, ...) got = entries return orig(me, entries, ...) end
    ns.UI.RefreshPage("market")
    local row
    for _, e in ipairs(got or {}) do if e.id == 2318 then row = e end end
    assert.truthy(row, "Leichtes Leder fehlt in den Preisen")
    assert.truthy(row.cells.perday:find("^~%d"), row.cells.perday)
    assert.truthy(table.concat(row.tip, " "):find("/Tag verkauft", 1, true))
    -- Kleinvieh: 5c Gewinn je Leder bei hohem Absatz schlägt 50 Gold Gewinn bei einem Ladenhüter
    local list = D.Sort({ { id = 4238, qty = 1, profit = 500000 }, { id = 2318, qty = 1, profit = 5 } })
    assert.are.equal(2318, list[1].id)
    assert.truthy(list[1].goldDay and list[1].goldDay > 0)
    noErrors(W)
  end)
end)

describe("Goldmacher-Werkzeuge", function()
  local function replicate(W, getAuctions)
    C_AuctionHouse.GetNumReplicateItems = function() return #getAuctions() end
    C_AuctionHouse.GetReplicateItemInfo = function(i)
      local a = getAuctions()[i + 1]
      return nil, nil, a.q, 1, true, 1, nil, 0, 0, a.price * a.q, 0, nil, nil, a.owner, a.owner, 0, a.id, true
    end
    C_AuctionHouse.GetReplicateItemTimeLeft = function(i) return getAuctions()[i + 1].band or 3 end
  end

  it("Einstellpreis: Ausrüstung ohne Kupfer, nie unter Händlerpreis, Ladenhüter-Warnung", function()
    local ns, W = E.load({ prices = {}, itemInfo = {
      [4238] = { name = "Leinentasche", sell = 200, stack = 1 },
      [2318] = { name = "Leichtes Leder", sell = 10, stack = 20 },
      [6070] = { name = "Grüner Gürtel", sell = 0, stack = 1 } } })
    local Suggest = ns.AH.Suggest
    -- Einzel-Item: ganze Silber, ein Silber-Schritt unter der Konkurrenz (Blizzard: "Kupfer weglassen hilft")
    assert.are.equal(34500, (Suggest(6070, 34527)))
    assert.are.equal(34400, (Suggest(6070, 34500)))
    -- Stapelware bleibt bei 1 Kupfer darunter
    assert.are.equal(44, (Suggest(2318, 45)))
    -- Händler zahlt 2 Silber: AH-Preis darunter lohnt nie -> warten / Händler
    local floor = math.ceil((200 + ns.Market.DepositRisk(4238)) / 0.95)
    local price, f, wait = Suggest(4238, 150)
    assert.are.equal(floor, f)
    assert.is_true(wait)
    assert.are.equal(math.ceil(floor / 100) * 100, price)
    assert.are.equal(0, price % 100)
    -- 2× abgelaufen, nie verkauft -> Hinweis billiger oder Händler
    W.bags = { [0] = { { itemID = 4238, stackCount = 1, quality = 1 } } }
    ns.AH.Store().list = { { auctionID = 9, id = 4238, qty = 1, unit = 900, status = "expired" } }
    ns.db.ledger = { sales = {}, buys = {}, expired = { { id = 4238, t = W.now - 86400 }, { id = 4238, t = W.now - 3 * 86400 } } }
    local l = ns.AH.RelistList()
    assert.is_true(l[1].stale)
    assert.are.equal(2, l[1].expired)
    assert.are.equal(200, l[1].vendor)
    noErrors(W)
  end)

  it("Nicht unter: Craft-Planer und Neu-Einstellen zeigen denselben Preis", function()
    local ns, W = E.load({ prices = { [2318] = 300, [2304] = 2000 } })
    ns.char.queue = { { recipe = 2152, prof = "LEATHERWORKING", n = 1 } }
    W.bags = { [0] = { { itemID = 2304, stackCount = 3, quality = 2 } } }
    local ready = ns.Guide.ReadyToSell()
    assert.are.equal(1, #ready)
    assert.are.equal(ns.AH.Floor(2304), ready[1].floor)
    assert.are.equal(math.ceil((300 + ns.Market.DepositRisk(2304)) / 0.95), ready[1].floor)
    -- Item-Tooltip zeigt denselben Wert
    local tip = table.concat(ns.Extras.TooltipLines(2304), " | ")
    assert.truthy(tip:find("Nicht unter " .. ns.Money(ready[1].floor), 1, true), tip)
    noErrors(W)
  end)

  it("Item-Tooltip: Preis-Liste wie Auctionator (Marktwert, Ø, Tief/Hoch, Lage, Absatz, eigene Verkäufe)", function()
    local ns, W = E.load({ prices = { [2318] = 30 }, itemInfo = { [2318] = { name = "Leichtes Leder", sell = 10, stack = 20 } } })
    ns.db.priceHistory[2318] = { ["2026-11-01"] = 40, ["2026-11-02"] = 44, ["2026-11-03"] = 50, ["2026-11-04"] = 36, ["2026-11-05"] = 42, ["2026-11-06"] = 60 }
    local st = ns.PriceString.Stats(2318)
    assert.are.same({ median = 43, mean = 45, min = 36, max = 60, days = 6 }, st)
    ns.Demand.Store().stats[2318] = { s = 70, h = 24, q = 2382 }       -- 70 Stück in 24 Std., 2382 im Angebot
    ns.db.ledger = { sales = {}, buys = {}, expired = {}, seen = {} }
    for i = 1, 4 do table.insert(ns.db.ledger.sales, { t = W.now - i * 86400, id = 2318, n = 20, money = 760 }) end
    table.insert(ns.db.ledger.expired, { t = W.now - 86400, id = 2318, n = 20 })
    local rows = ns.Extras.TooltipRows(2318)
    assert.is_true(rows[1].head)
    assert.truthy(rows[1].r:find("Schnelldreher", 1, true))
    assert.is_true(rows[2].rule)
    local txt = table.concat(ns.Extras.TooltipLines(2318), "\n")
    assert.truthy(txt:find("Marktwert (6 T.) " .. ns.Money(43), 1, true), txt)
    assert.truthy(txt:find("Durchschnitt " .. ns.Money(45), 1, true), txt)
    assert.truthy(txt:find(ns.Money(36) .. "  ·  " .. ns.Money(60), 1, true), txt)
    assert.truthy(txt:find("günstig", 1, true), txt)                    -- 30 statt 43 = -30 %
    assert.truthy(txt:find("-30 %", 1, true), txt)
    assert.truthy(txt:find("Verkauft pro Tag ~70", 1, true), txt)
    assert.truthy(txt:find("2.382 Stück", 1, true), txt)
    assert.truthy(txt:find("Markt voll", 1, true), txt)                 -- 2382 / 70 = 34 Tage
    assert.truthy(txt:find("80 % von 5", 1, true), txt)
    assert.truthy(txt:find("Ø " .. ns.Money(38), 1, true), txt)         -- 760 / 20 Stück
    assert.truthy(txt:find("Nicht unter", 1, true), txt)
    -- im Spiel: zweispaltig über AddDoubleLine, ohne Fehler
    GameTooltip.lines = {}
    W.tooltipHook(GameTooltip, { id = 2318 })
    assert.truthy(#GameTooltip.lines >= 10)
    noErrors(W)
  end)

  it("Item-Tooltip: ohne Preisverlauf kein Marktwert, Absatz \"misst ab 2 Scans\"", function()
    local ns = E.load({ prices = { [2589] = 60 } })
    ns.db.priceHistory = {}
    local txt = table.concat(ns.Extras.TooltipLines(2589), "\n")
    assert.is_nil(txt:find("Marktwert", 1, true))
    assert.truthy(txt:find("misst ab 2 Scans", 1, true), txt)
  end)

  it("Ein Scan für alle Reiter: Komplett-Scan zuerst, sonst Schnell-Scan", function()
    local ns, W = E.load()
    ns.Market.ahOpen = true
    local which, fullOK = nil, true
    Auctionator.State.FullScanFrameRef = { InitiateScan = function() which = "komplett" end, CanInitiate = function() return fullOK end }
    Auctionator.State.IncrementalScanFrameRef = { InitiateScan = function() which = "schnell" end, CanInitiate = function() return true end }
    assert.is_true(ns.Market.StartScan())
    assert.are.equal("komplett", which)
    assert.truthy(E.chat(W):find("alle Reiter", 1, true))
    -- Komplett-Scan gesperrt (15 Min.) -> Schnell-Scan aktualisiert trotzdem alle Preise
    fullOK = false
    assert.is_true(ns.Market.StartScan())
    assert.are.equal("schnell", which)
    -- beide gesperrt -> ehrliche Meldung, kein Fehler
    Auctionator.State.IncrementalScanFrameRef.CanInitiate = function() return false end
    assert.is_false(ns.Market.StartScan())
    assert.truthy(E.chat(W):find("15 Minuten", 1, true))
    -- Scan fertig -> eine Meldung für alle Reiter, alle Seiten rechnen neu
    W.dbCallback() W.flush()
    assert.truthy(E.chat(W):find("Alle Reiter", 1, true))
    noErrors(W)
  end)

  it("Unterboten aus dem Komplett-Scan, eigene Angebote zählen nicht", function()
    local ns, W = E.load({ itemInfo = { [2318] = { name = "Leichtes Leder", sell = 10, stack = 20 },
      [4238] = { name = "Leinentasche", sell = 200, stack = 1 } } })
    local s = ns.AH.Store()
    s.list = {
      { auctionID = 1, id = 2318, qty = 20, unit = 50, status = "active", commodity = true, expires = W.now + 7200 },
      { auctionID = 2, id = 4238, qty = 1, unit = 500, status = "active", commodity = false, expires = W.now + 7200 },
    }
    local auctions = {
      { id = 2318, q = 20, price = 50, owner = "Tiry" },  -- dein eigenes Angebot
      { id = 2318, q = 10, price = 45, owner = "Bo" },    -- unterbietet dich
      { id = 2318, q = 5, price = 30, owner = "Tiry" },   -- noch ein eigenes, zählt nicht
      { id = 4238, q = 1, price = 100, owner = "Cy" },    -- Einzel-Item: prüft weiter die Einzelsuche
    }
    replicate(W, function() return auctions end)
    ns.Market.ahOpen = true
    W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
    assert.is_true(s.list[1].undercut)
    assert.are.equal(45, s.list[1].competitor)
    assert.is_nil(s.list[2].undercut)
    assert.truthy(E.chat(W):find("unterboten", 1, true))
    -- frisch geprüfte Stapelware wird nicht nochmal einzeln gesucht
    s.list[2] = nil
    ns.AH.CheckUndercuts()
    assert.is_false(ns.AH.checking)
    -- keine Konkurrenz mehr -> nicht mehr unterboten
    auctions = { { id = 2318, q = 20, price = 50, owner = "Tiry" } }
    W.now = W.now + 900
    W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
    assert.is_false(s.list[1].undercut)
    noErrors(W)
  end)

  it("Abgebrochener Komplett-Scan zählt nicht als Verkauf", function()
    local ns, W = E.load({ itemInfo = { [2318] = { name = "Leichtes Leder", sell = 10, stack = 20 } } })
    ns.char.watch = { [2318] = true }
    local auctions = {}
    for i = 1, 300 do auctions[i] = { id = 2318, q = 1, price = 40, owner = "S" .. i } end
    replicate(W, function() return auctions end)
    ns.Market.ahOpen = true
    W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
    local st = ns.Demand.Store()
    assert.are.equal(1, st.scans)
    -- Blizzard drosselt: nur 50 von 300 Angeboten kommen an -> keine 250 "Verkäufe"
    W.now = W.now + 3600
    local short = {}
    for i = 1, 50 do short[i] = auctions[i] end
    auctions = short
    W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
    assert.are.equal(1, st.scans)
    assert.truthy(E.chat(W):find("unvollständig", 1, true))
    assert.is_nil(ns.Demand.PerDay(2318))
    -- zweimal hintereinander klein -> Markt ist wirklich geschrumpft, wird übernommen
    W.now = W.now + 3600
    W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
    assert.are.equal(2, st.scans)
    noErrors(W)
  end)

  it("Schnäppchen-Scan: unter Händlerpreis (sicher) und unter Marktwert, eigene Angebote nie", function()
    local ns, W = E.load({ itemInfo = { [4238] = { name = "Leinentasche", sell = 200, stack = 1 },
      [2318] = { name = "Leichtes Leder", sell = 10, stack = 20 } } })
    ns.db.priceHistory = { [2318] = { ["2026-11-01"] = 100, ["2026-11-02"] = 100, ["2026-11-03"] = 100 } }
    local auctions = {
      { id = 4238, q = 1, price = 100, owner = "Fremd" },   -- 1 Silber unter Händlerpreis
      { id = 4238, q = 1, price = 50, owner = "Tiry" },     -- eigenes Angebot: nie melden
      { id = 2318, q = 40, price = 20, owner = "Bo" },      -- 20 % vom Marktwert
      { id = 2318, q = 20, price = 99, owner = "Cy" },      -- normaler Preis
    }
    replicate(W, function() return auctions end)
    ns.Market.ahOpen = true
    W.fire("REPLICATE_ITEM_LIST_UPDATE") W.flush()
    local list = ns.Snipe.list
    assert.are.equal(2, #list)
    assert.are.equal("haendler", list[1].kind)
    assert.are.equal(4238, list[1].id)
    assert.are.equal(100, list[1].profit)
    assert.are.equal(1, list[1].count)
    assert.are.equal("markt", list[2].kind)
    assert.are.equal(40, list[2].count)
    -- Weiterverkauf netto (5 % Gebühr, Einstellgebühr-Risiko 5c/Stück) minus Einkauf
    assert.are.equal((95 - ns.Market.DepositRisk(2318)) * 40 - 800, list[2].profit)
    assert.truthy(E.chat(W):find("Schnäppchen%-Scan"))
    -- gekaufte Händler-Schnäppchen nimmt der Verkaufen-Knopf beim Händler mit
    ns.Snipe.SearchAll("haendler")
    assert.is_true(ns.Snipe.IsVendorSnipe(4238))
    noErrors(W)
  end)

  it("Preis-Trend: fällt / steigt / zu wenig Daten", function()
    local ns, W = E.load()
    ns.db.priceHistory = {
      [1] = { ["2026-11-01"] = 100, ["2026-11-02"] = 100, ["2026-11-03"] = 100, ["2026-11-04"] = 60, ["2026-11-05"] = 60, ["2026-11-06"] = 60 },
      [2] = { ["2026-11-01"] = 100, ["2026-11-02"] = 100, ["2026-11-03"] = 130, ["2026-11-04"] = 130, ["2026-11-05"] = 130 },
      [3] = { ["2026-11-01"] = 100, ["2026-11-02"] = 100 },
    }
    local tr, text = ns.PriceString.TrendAdvice(1)
    assert.are.equal("fällt", tr)
    assert.truthy(text:find("40 %%"))
    assert.are.equal("steigt", (ns.PriceString.TrendAdvice(2)))
    assert.is_nil(ns.PriceString.TrendAdvice(3))
    noErrors(W)
  end)

  it("Markt-Tiefe: Angebot geteilt durch Tagesabsatz", function()
    local ns, W = E.load()
    local s = ns.Demand.Store()
    s.stats[2318] = { s = 10, h = 24, q = 200, t = W.now } -- 10 Stück/Tag, 200 im Angebot
    assert.are.equal(20, ns.Demand.DaysOfSupply(2318))
    assert.is_true(ns.Demand.Full(2318))
    assert.truthy(ns.Demand.Text(2318, true):find("Markt voll"))
    s.stats[2319] = { s = 0, h = 24, q = 0, t = W.now }
    assert.are.equal(0, ns.Demand.DaysOfSupply(2319))
    noErrors(W)
  end)

  it("Beste Verkaufszeit aus deinen Verkäufen", function()
    local ns, W = E.load()
    ns.db.ledger = { sales = {}, buys = {}, expired = {} }
    -- 10 Verkäufe jeweils um 20 Uhr Ortszeit, 2 um 8 Uhr
    local function at(hour, daysAgo)
      local t = W.now - daysAgo * 86400
      for _ = 1, 24 do
        if tonumber(os.date("%H", t)) == hour then return t end
        t = t - 3600
      end
    end
    for d = 1, 10 do table.insert(ns.db.ledger.sales, { id = 2318, t = at(20, d), money = 100, n = 1 }) end
    for d = 1, 2 do table.insert(ns.db.ledger.sales, { id = 2318, t = at(8, d), money = 100, n = 1 }) end
    local best = ns.Timing.Best()
    assert.truthy(best)
    assert.are.equal("eigene", best.source)
    assert.is_true(best.from >= 18 and best.from <= 20)
    assert.truthy(best.text:find("Uhr"))
    noErrors(W)
  end)

  it("Rohstoff-Check: verarbeiten, wenn das Rezept mehr bringt als roh verkaufen", function()
    local ns, W = E.load({
      prices = { [2318] = 30, [2304] = 2000, [2320] = 10 },
      bags = { [0] = { { itemID = 2318, stackCount = 10, quality = 1 } } },
    })
    ns.Scanner.ScanBags()
    local leather
    for _, e in ipairs(ns.Scanner.bags.items) do if e.id == 2318 then leather = e end end
    assert.truthy(leather, "Leichtes Leder in der Liste")
    assert.truthy(leather.process, "Verarbeiten erkannt")
    assert.truthy(leather.tip:find("Verarbeiten zu"))
    noErrors(W)
  end)

  it("Kaufen bis: höchster Materialpreis, bei dem der Craft noch Gewinn bringt", function()
    local ns, W = E.load({ prices = { [2318] = 300, [2320] = 10, [4231] = 500, [2312] = 5000 } })
    ns.Recipes.SetProfit(0) -- Mindestgewinn 0 -> "kaufen bis" = Gewinnschwelle (+1 Kupfer)
    ns.char.queue = { { recipe = 2164, prof = "LEATHERWORKING", n = 1 } }
    local _, revenue = ns.Scanner.RecipeProfit(ns.Recipes.Get(2164))
    local max = ns.Shop.MaxPrice(2318)
    assert.are.equal(math.floor((revenue - 500 - 20 - 1) / 4), max)
    local e
    for _, x in ipairs((ns.Shop.List())) do if x.id == 2318 then e = x end end
    assert.are.equal(max, e.maxUnit)
    assert.falsy(e.overMax)
    -- genau zum Grenzpreis bleibt Gewinn übrig, darüber nicht mehr
    W.prices[2318] = max
    assert.is_true(ns.Scanner.RecipeProfit(ns.Recipes.Get(2164)) >= 1)
    W.prices[2318] = max + 50
    for _, x in ipairs((ns.Shop.List())) do if x.id == 2318 then e = x end end
    assert.is_true(e.overMax)
    noErrors(W)
  end)

  it("Neu einstellen: nur so viele wie in 3 Tagen weggehen, Markt voll erkannt", function()
    local ns, W = E.load({ prices = { [2318] = 300, [2304] = 2000 } })
    W.bags = { [0] = { { itemID = 2304, stackCount = 10, quality = 2 } } }
    ns.AH.Store().list = { { auctionID = 1, id = 2304, qty = 10, unit = 2000, status = "expired" } }
    ns.Demand.Store().stats[2304] = { s = 1, h = 24, q = 100, t = W.now } -- 1/Tag, 100 im Angebot
    local l = ns.AH.RelistList()
    assert.are.equal("abgelaufen", l[1].where)
    assert.are.equal(math.min(10, ns.Demand.MarketBatch(2304)), l[1].post)
    assert.is_true(l[1].post < l[1].qty)
    assert.is_true(l[1].full)
    noErrors(W)
  end)
end)

describe("Sparziel (Gold-Ziel)", function()
  local G = 10000
  local function day(W, i) return os.date("%Y-%m-%d", W.now - i * 86400) end

  it("schlägt nach Stufe vor, rechnet Stand, Tempo und Prognose aus dem Gold-Tagebuch", function()
    local ns, W = E.load({ level = 25, money = 30 * G })
    local GZ = ns.Goal
    local g = GZ.Get()
    assert.are.equal("ride40", g.key)
    assert.is_true(g.auto)
    assert.are.equal(100 * G, g.amount)
    assert.are.equal("ride60", GZ.Suggest(45).key)
    -- zwei Spieltage (+10 g, +20 g), dazwischen ein Ruhetag: der Ruhetag zählt nicht
    ns.char.days = {}
    ns.char.days[day(W, 0)] = { start = 0, earned = 12 * G, spent = 2 * G }
    ns.char.days[day(W, 2)] = { start = 0, earned = 20 * G, spent = 0 }
    local rate, n = GZ.Rate(7)
    assert.are.equal(2, n)
    assert.are.equal(15 * G, rate)
    local st = GZ.Status()
    assert.are.equal(30 * G, st.have)
    assert.are.equal(70 * G, st.missing)
    assert.are.equal(5, GZ.Eta(st.missing, rate)) -- 70 / 15 = 4,7 -> 5 Spieltage
    assert.are.equal(0, GZ.Eta(0, rate))
    assert.is_nil(GZ.Eta(10, nil))
    assert.is_nil(GZ.Eta(10, -5))
    -- eigene Auktionen zählen halb (nach AH-Gebühr): nicht alles verkauft sich
    ns.AH.Store().list = { { auctionID = 1, id = 2318, qty = 2, unit = 10 * G, status = "active", expires = W.now + 3600 } }
    st = GZ.Status()
    assert.are.equal(math.floor(20 * G * 0.95 * 0.5), st.auctions)
    assert.are.equal(st.have + st.mail + st.auctions, st.total)
    noErrors(W)
  end)

  it("Betrag eintippen, anderes Ziel, ausblenden – und einmal melden, wenn erreicht", function()
    local ns, W = E.load({ level = 25, money = 30 * G })
    local GZ = ns.Goal
    assert.are.equal(250 * G, GZ.ParseAmount("250"))
    assert.are.equal(25000, GZ.ParseAmount("2,5"))
    assert.are.equal(15000, GZ.ParseAmount("1g 50s"))
    assert.is_nil(GZ.ParseAmount("abc"))
    GZ.SetAmount(120 * G)
    local g = GZ.Get()
    assert.falsy(g.auto)
    assert.are.equal("ride40", g.key)
    assert.are.equal(120 * G, g.amount)
    GZ.Cycle()
    assert.are.equal("ride60", GZ.Get().key)
    GZ.Clear()
    assert.is_nil(GZ.Get())
    GZ.Set("custom", 20 * G)
    W.money = 25 * G
    W.fire("PLAYER_MONEY") W.flush()
    assert.truthy(E.chat(W):find("Sparziel erreicht", 1, true))
    local n = #W.prints
    W.fire("PLAYER_MONEY") W.flush()
    assert.are.equal(n, #W.prints, "nur einmal melden")
    noErrors(W)
  end)

  it("Schneller ans Ziel: Taschen ins AH, Craft-Liste und beste Farm-Runde mit Goldbetrag", function()
    local ns, W = E.load({ level = 25, money = 5 * G, prices = { [2318] = 300, [2320] = 10, [4231] = 500, [2312] = 5000, [4234] = 4000 } })
    local GZ = ns.Goal
    W.bags = { [0] = { { itemID = 4234, stackCount = 10, quality = 1 } } }
    ns.char.queue = { { recipe = 2164, prof = "LEATHERWORKING", n = 2 } }
    ns.Session.Best = function() return { perHour = 40 * G, zone = "Brachland", elapsed = 900 } end
    local boosts = GZ.Boosts()
    local by = {}
    for _, b in ipairs(boosts) do by[b.key] = b end
    assert.truthy(by.bags, "Taschen ins AH")
    assert.is_true(by.bags.gold > 0)
    assert.truthy(by.craft, "Craft-Liste")
    local profit = ns.Scanner.RecipeProfit(ns.Recipes.Get(2164))
    assert.are.equal(profit * 2, by.craft.gold)
    assert.truthy(by.farm)
    assert.are.equal("farm", boosts[#boosts].key, "Gold pro Stunde steht hinten (andere Einheit)")
    for i = 2, #boosts - 1 do assert.is_true(boosts[i - 1].gold >= boosts[i].gold) end
    noErrors(W)
  end)

  it("Startseite zeigt Sparziel-Karte; Anderes Ziel und Ausblenden wirken", function()
    local ns, W = E.load({ level = 25, money = 30 * G })
    SlashCmdList.TIRYSZENTRALE("") ns.UI.Wizard.Finish()
    ns.UI.Show("home")
    local home = ns.UI.pages.home
    assert.is_true(home.goalCard:IsShown())
    assert.truthy(home.goalCard.title:GetText():find("Reiten", 1, true))
    home.goalCard.other:Click()
    W.flush()
    ns.UI.RefreshPage("home")
    assert.are.equal("ride60", ns.Goal.Get().key)
    home.goalCard.hide:Click()
    W.flush()
    ns.UI.RefreshPage("home")
    assert.is_false(home.goalCard:IsShown())
    assert.is_true(home.goalCard.off:IsShown())
    noErrors(W)
  end)
end)

describe("Unterwegs-Gold (Gebiet + LevelPilot-Route)", function()
  local function leveler()
    _G.LevelPilot_Routes = { r1 = { name = "Horde 22–30", faction = "Horde", min = 20, max = 30,
      segs = { { z = "Orgrimmar", l0 = 22 }, { z = "Brachland", l0 = 22 }, { z = "Steinkrallengebirge", l0 = 23 },
        { z = "Brachland", l0 = 25 }, { z = "Eschental", l0 = 25 }, { z = "Hügelland", l0 = 26 } },
      steps = { { seg = 1 }, { seg = 2 }, { seg = 3 }, { seg = 4 }, { seg = 5 }, { seg = 6 } } } }
    _G.LP_Route = { Pick = function(faction, lvl, wanted) assert(faction == "Horde") return "r1" end }
    _G.LevelPilotDB = { plan = { r1 = { i = 3 } } }
  end
  local function noLeveler() _G.LevelPilot_Routes, _G.LP_Route, _G.LevelPilotDB = nil, nil, nil end
  after_each(noLeveler)

  it("Gebietsnamen aus LevelPilot -> Karten-Nummer", function()
    local ns = E.load({})
    local Z = ns.ZoneGold
    assert.are.equal(1424, Z.MapForName("Hügelland"))
    assert.are.equal(1424, Z.MapForName("Vorgebirge des Hügellands"))
    assert.are.equal(1413, Z.MapForName("Das Brachland"))
    assert.are.equal(1440, Z.MapForName("Eschental"))
    assert.are.equal(1445, Z.MapForName("Düstermarschen"))
    assert.is_nil(Z.MapForName("Gibtsnicht"))
  end)

  it("bewertet das Gebiet nur mit deinen Berufen und zeigt, was ein fehlender Beruf brächte", function()
    local ns, W = E.load({}) -- Kürschnerei + Lederverarbeitung
    local Z = ns.ZoneGold
    local info = Z.ForMap(1413)
    local keys = {}
    for _, g in ipairs(info.groups) do keys[g.key] = g end
    assert.truthy(keys.leather, "Leder (Kürschnerei)")
    assert.falsy(keys.herb, "Kräuter ohne Kräuterkunde nicht zählen")
    assert.falsy(keys.ore, "Erz ohne Bergbau nicht zählen")
    assert.truthy(info.missed and (info.missed.key == "herb" or info.missed.key == "ore"))
    assert.truthy(info.missed.profName)
    -- je Gruppe absteigend nach Wert, Score = Summe der besten Stückwerte
    local sum = 0
    for _, g in ipairs(info.groups) do
      for i = 2, #g.items do assert.is_true(g.items[i - 1].value >= g.items[i].value) end
      assert.are.equal(g.items[1].value, (Z.UnitValue(g.items[1].id)))
      sum = sum + g.best
    end
    assert.are.equal(sum, info.score)
    -- Leder im Brachland passt zu den Tierstufen dort (Leichtes/Mittleres Leder, kein Unverwüstliches)
    assert.truthy(keys.leather.items[1])
    for _, it in ipairs(keys.leather.items) do assert.are_not.equal(8170, it.id) end
    -- mit Kräuterkunde kommt die Gruppe dazu
    local ns2 = E.load({ skills = { { name = "Berufe", isHeader = true, isCollapsed = false },
      { name = "Kräuterkunde", skillID = 182, isHeader = false, rank = 80, maxRank = 150 } } })
    local herb
    for _, g in ipairs(ns2.ZoneGold.ForMap(1413).groups) do if g.key == "herb" then herb = g end end
    assert.truthy(herb)
    noErrors(W)
  end)

  it("liest LevelPilots Plan-Zeiger: nächste Gebiete ab dem aktuellen Abschnitt, ohne Doppelte", function()
    local ns, W = E.load({})
    leveler()
    local zones, name = ns.ZoneGold.RouteZones(3)
    assert.are.equal("Horde 22–30", name)
    local names, maps = {}, {}
    for _, z in ipairs(zones) do names[#names + 1] = z.name maps[#maps + 1] = z.map end
    assert.are.same({ "Steinkrallengebirge", "Brachland", "Eschental" }, names)
    assert.are.same({ 1442, 1413, 1440 }, maps)
    -- Übersicht: aktuelles Gebiet (Nachbau: Brachland) fällt aus "Als Nächstes" heraus
    local ov = ns.ZoneGold.Overview()
    assert.are.equal(1413, ov.hereMap)
    assert.is_true(ov.hasRoute)
    for _, z in ipairs(ov.next) do assert.are_not.equal(1413, z.map) end
    assert.truthy(ov.next[1], "nächstes Gebiet mit Daten")
    local order = { Steinkrallengebirge = 1, Eschental = 2, ["Hügelland"] = 3 }
    for i = 2, #ov.next do assert.is_true(order[ov.next[i - 1].name] < order[ov.next[i].name], "Reihenfolge der Route") end
    -- ohne Plan-Zeiger: erster Abschnitt passend zur Stufe; ohne LevelPilot: nil
    _G.LevelPilotDB = nil
    zones = ns.ZoneGold.RouteZones(2)
    assert.are.equal("Orgrimmar", zones[1].name)
    noLeveler()
    assert.is_nil(ns.ZoneGold.RouteZones(2))
    -- kaputte Daten legen nichts lahm
    _G.LevelPilot_Routes, _G.LP_Route = { r1 = { segs = "x" } }, { Pick = function() return "r1" end }
    assert.is_nil(ns.ZoneGold.RouteZones(2))
    noErrors(W)
  end)

  it("Tipp beim Gebietswechsel: einmal pro Gebiet, abschaltbar; Startseiten-Karte mit Wegpunkt", function()
    local ns, W = E.load({ prices = { [4232] = 3000, [2319] = 2000, [2592] = 900 } })
    ns.settings.zoneTipMin = 100
    W.fire("ZONE_CHANGED_NEW_AREA") W.flush()
    assert.truthy(E.chat(W):find("Unterwegs-Gold in", 1, true))
    local n = #W.prints
    W.fire("ZONE_CHANGED_NEW_AREA") W.flush()
    assert.are.equal(n, #W.prints)
    ns.settings.zoneTip = false
    assert.is_false(ns.ZoneGold.ZoneTip())
    leveler()
    SlashCmdList.TIRYSZENTRALE("") ns.UI.Wizard.Finish()
    ns.UI.Show("home")
    local card = ns.UI.pages.home.zoneCard
    assert.is_true(card:IsShown())
    assert.is_true(card.groups[1]:IsShown())
    assert.is_true(card.routes[1]:IsShown())
    card.go:Click()
    assert.truthy(W.waypoint, "Wegpunkt gesetzt")
    assert.are.equal(1413, W.waypoint.map)
    noErrors(W)
  end)
end)

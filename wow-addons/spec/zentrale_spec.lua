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

  it("hat höchstens 7 Hauptpunkte im Menü und alle Ansichten sind erreichbar", function()
    SlashCmdList.TIRYSZENTRALE("")
    local n = 0
    for _ in pairs(TirysZentraleMainFrame.nav) do n = n + 1 end
    assert.is_true(n <= 7)
    for _, def in ipairs(ns.UI.order) do
      assert.truthy(ns.UI.GroupOf(def.key), "Ansicht ohne Menüpunkt: " .. def.key)
    end
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

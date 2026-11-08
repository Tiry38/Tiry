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
    assert.truthy(TirysZentraleMainFrame.nav.auktionen, "Menüpunkt Auktionen fehlt")
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
    assert.are.equal(math.ceil(300 / 0.95), l[1].floor)
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
    assert.are.equal(math.floor(2000 * 0.95), ns.Advisor.Resale(ns.Recipes.Get(2152)))
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

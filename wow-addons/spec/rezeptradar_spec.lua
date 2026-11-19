-- RezeptRadar – Rechen-Regeln des Rezept-Beraters (busted, strenger Forever-Nachbau)
local E = require("addon_env")

local SKILLS = {
  { name = "Kochkunst", skillID = 185, isHeader = false, rank = 60, maxRank = 75 },
  { name = "Lederverarbeitung", skillID = 165, isHeader = false, rank = 110, maxRank = 150 },
}

local function scan(ns, W, rows)
  W.fire("AUCTION_HOUSE_SHOW")
  W.now = W.now + 1000
  assert(ns.Scan.Start())
  W.replicate = rows
  W.fire("REPLICATE_ITEM_LIST_UPDATE")
  W.flush()
end

describe("Preisstufen (BuyCost)", function()
  local ns = E.load({ skills = SKILLS })
  local e = { b = { 10, 3, 20, 2, 50, 1 } }
  it("kauft von unten nach oben", function()
    assert.are.same({ 30, true }, { ns.Scan.BuyCost(e, 3) })
    assert.are.same({ 70, true }, { ns.Scan.BuyCost(e, 5) })
  end)
  it("rechnet fehlende Menge zum teuersten Preis und meldet knapp", function()
    assert.are.same({ 220, false }, { ns.Scan.BuyCost(e, 8) })
  end)
  it("ohne Angebot nil", function()
    assert.is_nil(ns.Scan.BuyCost(nil, 1))
    assert.is_nil(ns.Scan.BuyCost({ b = {} }, 1))
  end)
end)

describe("Skillfarben", function()
  local ns = E.load({ skills = SKILLS })
  local r = { yellow = 100, grey = 140 }
  it("orange / gelb / grün / grau", function()
    assert.equal("orange", ns.Craft.Color(r, 99))
    assert.equal("yellow", ns.Craft.Color(r, 100))
    assert.equal("green", ns.Craft.Color(r, 120))
    assert.equal("grey", ns.Craft.Color(r, 140))
  end)
  it("gelb = grau zählt als grau", function()
    assert.equal("grey", ns.Craft.Color({ yellow = 105, grey = 105 }, 105))
  end)
end)

describe("Material", function()
  it("Händler nur für die eigene Fraktion (Rhapsodiemalz = Allianz)", function()
    local nsA = E.load({ skills = SKILLS, faction = "Alliance" })
    assert.are.same({ 50, "vendor", true }, { nsA.Advisor.MatUnit(2894, 5) })
    local nsH = E.load({ skills = SKILLS, faction = "Horde" })
    assert.is_nil(nsH.Advisor.MatUnit(2894, 5))
  end)
  it("AH günstiger als Händler gewinnt", function()
    local ns, W = E.load({ skills = SKILLS, faction = "Horde" })
    scan(ns, W, { { 2321, 20, 1000 } }) -- Feiner Faden 50 statt 100 beim Händler
    assert.are.same({ 50, "ah", true }, { ns.Advisor.MatUnit(2321, 10) })
  end)
  it("im Spiel gelernter Händlerpreis geht vor der Liste", function()
    local ns = E.load({ skills = SKILLS })
    RezeptRadarDB.vendor[2321] = 80
    assert.equal(80, (ns.Advisor.MatUnit(2321, 2)))
  end)
end)

describe("Verkaufswert", function()
  it("Händlerpreis, wenn das AH weniger bringt", function()
    local ns, W = E.load({ skills = SKILLS })
    scan(ns, W, { { 2407, 1, 800 }, { 2311, 1, 100 }, { 2318, 50, 1500 } }) -- Wams im AH für 1 Silber, Händler 1,50
    local e = ns.Advisor.Evaluate(ns.Craft.Get(2163))
    assert.equal("vendor", e.valueSrc)
    assert.equal(150, e.value)
  end)
  it("seelengebunden: AH-Angebote zählen nicht", function()
    local ns, W = E.load({ skills = SKILLS })
    scan(ns, W, { { 252503, 1, 30000 } })
    local e = ns.Advisor.Evaluate(ns.Craft.Get(1255110))
    assert.is_true(e.bop)
    assert.equal("vendor", e.valueSrc)
  end)
end)

describe("Ohne Beruf", function()
  it("meldet fehlenden Beruf statt leerer Liste", function()
    local ns, W = E.load({ skills = { { name = "Kürschnerei", skillID = 393, isHeader = false, rank = 50, maxRank = 75 } } })
    scan(ns, W, { { 2889, 1, 5000 } })
    local list, stats = ns.Advisor.List({ prof = "ALL", range = "now" })
    assert.equal(0, #list)
    assert.equal(2, #stats.noProf)
    SlashCmdList.REZEPTRADAR("")
    assert.equal("Beruf nicht gelernt", RezeptRadarMainFrame.empty.title:GetText())
    assert.equal(0, #W.errors)
  end)
end)

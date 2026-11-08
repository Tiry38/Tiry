-- Öffnet jede Seite mit realistischen Daten, meldet Layout-Probleme und exportiert Zeichendaten.
-- Aufruf: lua5.1 tests/check_layout.lua [ausgabeordner]   -> Bilder: python3 tools/render_pages.py <ordner>
local HERE = arg[0]:match("^(.*/)") or "./"
package.path = package.path .. ";" .. HERE .. "?.lua"
local OUT = arg[1]
local ROOT = HERE .. "../TirysZentrale/"
local W = require("wow_mock")
local L = require("layout")

W.level, W.faction, W.class, W.money = 21, "Horde", "ROGUE", 523456
W.skills = {
  { name = "Berufe", isHeader = true, isCollapsed = false },
  { name = "Kürschnerei", skillID = 393, isHeader = false, rank = 102, maxRank = 150 },
  { name = "Lederverarbeitung", skillID = 165, isHeader = false, rank = 110, maxRank = 150 },
  { name = "Kochkunst", skillID = 185, isHeader = false, rank = 60, maxRank = 75 },
}
W.known = { [2881] = true, [2152] = true, [2164] = true, [2158] = true, [3817] = true, [1229432] = true, [3816] = true }
W.itemInfo = {}
W.prices = { [2318] = 32, [783] = 45, [2319] = 120, [4232] = 160, [2304] = 900, [2312] = 9500, [2307] = 12000,
  [4233] = 900, [4231] = 280, [279978] = 196, [2589] = 60, [2592] = 120, [249427] = 4000, [2770] = 40, [2447] = 25 }
W.install({})
TirysZentraleDB, TirysZentraleCharDB = nil, nil
local ns = {}
for line in io.lines(ROOT .. "TirysZentrale.toc") do
  if not line:match("^##") and line:match("%S") then
    assert(loadfile(ROOT .. line:gsub("\\", "/"):gsub("%s+$", "")))("TirysZentrale", ns)
  end
end
W.fire("ADDON_LOADED", "TirysZentrale") ; W.fire("PLAYER_LOGIN") ; W.flush()
TirysZentraleDB.lastScan = W.now - 1200
TirysZentraleDB.vendorBuy[2320] = 10
TirysZentraleDB.vendorBuy[4289] = 50
for id, p in pairs(W.prices) do TirysZentraleDB.priceHistory = TirysZentraleDB.priceHistory or {} TirysZentraleDB.priceHistory[id] = { ["2026-11-06"] = p, ["2026-11-07"] = p } end
TirysZentraleCharDB.queue = { { recipe = 2164, prof = "LEATHERWORKING", n = 2 }, { recipe = 2158, prof = "LEATHERWORKING", n = 1 } }
W.bags = { [0] = { { itemID = 2318, stackCount = 18, quality = 1 }, { itemID = 249427, stackCount = 2, quality = 2 }, { itemID = 3300, stackCount = 3, quality = 0 } } }

ns.UI.Show("home")
local frame = TirysZentraleMainFrame
local total = 0
for _, def in ipairs(ns.UI.order) do
  ns.UI.Show(def.key)
  W.flush()
  ns.UI.RefreshPage(def.key)
  -- volle Seitenhöhe anzeigen (Scroll-Inhalt komplett), damit alles geprüft/gezeichnet wird
  local content = def.frame.content
  local fullH = math.max(600, (content.__h or 0) + 140)
  frame.__h = fullH
  local probs = L.problems(frame)
  for _, p in ipairs(probs) do print("[" .. def.key .. "] " .. p) end
  total = total + #probs
  if OUT then L.dump(frame, OUT .. "/" .. def.key .. ".tsv") end
  frame.__h = 600
end
-- Craft-Planer mit aufgeklappten Optionen
do
  local rp = ns.UI.pages.recipes
  ns.UI.Show("recipes") ; rp.proOpen = true ; ns.UI.RefreshPage("recipes")
  frame.__h = math.max(600, (rp.frame.content.__h or 0) + 140)
  for _, p in ipairs(L.problems(frame)) do print("[recipes+optionen] " .. p) total = total + 1 end
  if OUT then L.dump(frame, OUT .. "/recipes_open.tsv") end
  frame.__h = 600 ; rp.proOpen = false
end
-- Einkaufsfenster und Händler-Panel
ns.Shop.Show()
local shopProbs = L.problems(TirysZentraleShopWindow)
for _, p in ipairs(shopProbs) do print("[shop] " .. p) end
total = total + #shopProbs
if OUT then L.dump(TirysZentraleShopWindow, OUT .. "/shop.tsv") end
print(string.format("%d Layout-Probleme gefunden", total))
os.exit(total == 0 and 0 or 1)

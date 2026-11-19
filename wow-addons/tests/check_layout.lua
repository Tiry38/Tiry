-- Tiry's Zentrale 7 – Layout-Prüfung des einen Fensters (realistische Liste, Leer-Zustände, Scan läuft)
-- Aufruf (aus wow-addons/): lua5.1 tests/check_layout.lua [ausgabeordner]  -> Bilder: python3 -I tools/render_pages.py <ordner>
package.path = package.path .. ";tests/?.lua;spec/?.lua"
local OUT = arg[1]
local E = require("addon_env")
local L = require("layout")

local ns, W = E.load({ faction = "Horde", known = { [7751] = true }, skills = {
  { name = "Kochkunst", skillID = 185, isHeader = false, rank = 60, maxRank = 75 },
  { name = "Lederverarbeitung", skillID = 165, isHeader = false, rank = 110, maxRank = 150 },
} })
local total = 0
-- ganze Liste sichtbar machen (Fenster so hoch wie der Inhalt): der Nachbau schneidet Scroll-Inhalt nicht ab
local function check(name, frame)
  local h = ns.UI.HEIGHT
  if frame.list and #frame.list > 0 then frame:SetHeight(math.max(h, 272 + frame.content:GetHeight() + 58)) end
  for _, p in ipairs(L.problems(frame)) do print("[" .. name .. "] " .. p) total = total + 1 end
  if OUT then L.dump(frame, OUT .. "/" .. name .. ".tsv") end
  frame:SetHeight(h)
end

SlashCmdList.TIRYSZENTRALE("")
W.flush()
local F = TirysZentraleMainFrame
check("leer_ohne_scan", F)

W.fire("AUCTION_HOUSE_SHOW")
W.flush()
ns.Scan.Start()
W.replicate = {
  { 2889, 1, 5000 }, { 2888, 1, 900 }, { 2886, 10, 500 }, { 2894, 5, 400 },
  { 3679, 1, 3000 }, { 3220, 5, 2500 }, { 3173, 20, 1000 }, { 3172, 3, 300 }, { 3174, 10, 600 },
  { 728, 1, 2000 }, { 733, 1, 3000 }, { 729, 5, 50 }, { 730, 5, 50 }, { 731, 5, 50 },
  { 5485, 1, 1500 }, { 5476, 6, 900 }, { 5468, 10, 300 },
  { 6368, 1, 2500 }, { 5095, 10, 1400 }, { 6361, 20, 400 },
  { 7361, 1, 20000 }, { 7349, 1, 15000 }, { 2319, 40, 4000 }, { 3356, 20, 2000 },
  { 2407, 1, 800 }, { 2311, 1, 3000 }, { 2318, 50, 1500 },
  { 2408, 1, 4500 }, { 2312, 1, 5200 }, { 4231, 30, 3000 },
  { 7288, 1, 1200 }, { 7280, 1, 2600 },
  { 252797, 1, 1000 },
  { 15000, 1, 1 },
}
W.fire("REPLICATE_ITEM_LIST_UPDATE")
W.flush()
ns.UI.Refresh()
assert(#F.list >= 6, "Beispiel-Liste: " .. #F.list)
check("liste", F)

ns.settings.range = "soon"
ns.UI.Refresh()
check("liste_bald", F)
ns.settings.range, ns.settings.prof = "now", "COOKING"
ns.settings.skillOnly = true
ns.UI.Refresh()
check("liste_kochen_skill", F)
ns.settings.prof, ns.settings.skillOnly = "ALL", false

-- nichts mit Gewinn
TirysZentraleDB.ah.items = {}
ns.UI.Refresh()
check("leer_nichts", F)

-- Scan läuft (Fortschritt)
W.now = W.now + 901
ns.Scan.Start()
for i = 1, 2400 do W.replicate[#W.replicate + 1] = { 2318, 1, 30 + i } end
W.fire("REPLICATE_ITEM_LIST_UPDATE")
local timers = W.timers
W.timers = {}
for _, fn in ipairs(timers) do fn() end
ns.UI.Refresh()
assert(ns.Scan.progress and ns.Scan.progress < 1)
check("scan_laeuft", F)

assert(#W.errors == 0, W.errors[1])
print(total .. " Layout-Probleme")
if total > 0 then os.exit(1) end

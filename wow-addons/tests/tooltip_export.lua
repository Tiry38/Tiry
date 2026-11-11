-- Exportiert die echten Tooltip-Zeilen (AddLine/AddDoubleLine) als TSV. Aufruf aus wow-addons/:
--   lua5.1 tests/tooltip_export.lua > rows.tsv && python3 -I tools/render_tooltip.py rows.tsv TirysZentrale/Media out.png
package.path = "tests/?.lua;spec/?.lua;" .. package.path
local E = require("addon_env")
local ID = 249427 -- Makelloses Leder
local ns, W = E.load({ prices = { [ID] = 360 } })
ns.db.priceHistory[ID] = { ["2026-11-01"] = 340, ["2026-11-02"] = 390, ["2026-11-03"] = 455, ["2026-11-04"] = 360,
  ["2026-11-05"] = 385, ["2026-11-06"] = 520, ["2026-11-07"] = 410, ["2026-11-08"] = 372 }
ns.Demand.Store().stats[ID] = { s = 9, h = 24, q = 31 }
ns.db.ledger = { sales = {}, buys = {}, expired = {}, seen = {} }
for i = 1, 4 do table.insert(ns.db.ledger.sales, { t = W.now - i * 86400, id = ID, n = 1, money = 372 }) end
table.insert(ns.db.ledger.expired, { t = W.now - 86400, id = ID, n = 1 })
ns.settings.tooltipInfo = true
local tip = { AddLine = function(_, t) io.write("L\t", t, "\n") end,
  AddDoubleLine = function(_, a, b) io.write("D\t", a, "\t", b, "\n") end }
GameTooltip = tip
W.tooltipHook(tip, { id = ID })

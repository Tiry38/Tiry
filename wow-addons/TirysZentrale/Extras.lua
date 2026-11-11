-- Tiry's Zentrale – Extras nach Vorbild beliebter Addons:
-- * Item-Tooltip (wie TSM/Auctionator): wofür DU das Item brauchst, wo du es farmst, ob es neu in Forever ist
-- * Automatisch reparieren beim Händler (wie Leatrix Plus)
local _, ns = ...

local X = {}
ns.Extras = X

----------------------------------------------------------------------------
-- Welche deiner gelernten Rezepte brauchen ein Material?
----------------------------------------------------------------------------
local usedIn
local function buildUsedIn()
  usedIn = {}
  local R = ns.Recipes
  for _, key in ipairs(R.MyProfessions()) do
    for _, r in ipairs((R.List(key, "known"))) do
      for _, re in ipairs(r.reagents) do
        usedIn[re.id] = usedIn[re.id] or {}
        table.insert(usedIn[re.id], r.name)
      end
    end
  end
end
ns.Listen("PROFESSIONS_CHANGED", function() usedIn = nil end)

function X.UsedIn(itemID)
  if not usedIn then buildUsedIn() end
  return usedIn[itemID]
end

-- Farm-Tipp für ein Sammel-Material in deinem Levelbereich
function X.FarmHint(itemID)
  local group = ns.Skin.GATHER[itemID]
  if not group then return nil end
  if group == "leather" then
    for _, t in ipairs(ns.Skin.TIERS) do
      for _, id in ipairs(t.items) do
        if id == itemID then return "von Tieren Level " .. t.from .. "–" .. (t.to - 1) .. " (Kürschnerei)" end
      end
    end
    return "Kürschnerei – siehe Kürschner-Zentrale"
  end
  for _, s in ipairs(ns.Maps.Spots(group)) do
    for _, id in ipairs(s.items or {}) do
      if id == itemID then
        return string.format("%s %.0f, %.0f (für dein Level)", ns.Maps.ZoneName(s.map), s.x, s.y)
      end
    end
  end
  return nil
end

----------------------------------------------------------------------------
-- Item-Tooltip im Zentrale-Look: zweispaltige Preis-Liste wie Auctionator, mit Leuchtpunkten,
-- Neon-Trennlinien und einem Preis-Schieber (wo liegt der Preis gerade zwischen 14-Tage-Tief und -Hoch?).
-- Nur Text + Inline-Grafiken (|T...|t), kein eigener Frame – funktioniert in jedem Tooltip.
----------------------------------------------------------------------------
local WHITE = "Interface\\Buttons\\WHITE8X8"
local COL = {
  neon = { 57, 255, 107 }, teal = { 45, 226, 230 }, aqua = { 64, 180, 255 }, amber = { 255, 153, 41 },
  red = { 255, 107, 129 }, dim = { 62, 78, 74 },
}
local LABEL = { 0.66, 0.76, 0.72 } -- Beschriftung links
local VALUE = { 1, 1, 1 }

local function hex(c) return string.format("|cff%02x%02x%02x", c[1], c[2], c[3]) end

-- Inline-Grafik, eingefärbt (Kupfer-genaue Kanten: ganze Textur, Farbe als r:g:b 0–255)
local function tex(file, h, w, c, dim)
  dim = dim or 8
  return string.format("|T%s:%d:%d:0:0:%d:%d:0:%d:0:%d:%d:%d:%d|t", file, h, w, dim, dim, dim, dim, c[1], c[2], c[3])
end
local function dot(c) return tex(ns.MEDIA .. "circle", 7, 7, c, 128) end
local function bar(w, c) return w > 0 and tex(WHITE, 3, w, c) or "" end

-- Trennlinie als Neon-Verlauf (Grün -> Türkis -> Blau), aus 8 eingefärbten Stücken
local RULE
local function rule()
  if RULE then return RULE end
  local stops, parts = { COL.neon, COL.teal, COL.aqua }, {}
  for i = 0, 7 do
    local t = i / 7 * 2
    local a, b = stops[math.floor(t) + 1], stops[math.min(math.floor(t) + 2, 3)]
    local f = t - math.floor(t)
    local c = { math.floor(a[1] + (b[1] - a[1]) * f), math.floor(a[2] + (b[2] - a[2]) * f), math.floor(a[3] + (b[3] - a[3]) * f) }
    parts[#parts + 1] = tex(WHITE, 2, 20, c)
  end
  RULE = table.concat(parts)
  return RULE
end

-- Tausender mit Punkt (2382 -> 2.382)
local function num(n)
  local s = tostring(math.floor(n + 0.5))
  return (s:reverse():gsub("(%d%d%d)", "%1."):reverse():gsub("^%.", ""))
end
local function dec(x)
  if x >= 10 then return num(x) end
  return (string.format("%.1f", x):gsub("%.0$", ""):gsub("%.", ","))
end

-- Preis-Schieber: Spur 120 px, Marker an der Stelle des aktuellen Preises
local function slider(pos, c)
  local W = 120
  local left = math.floor(math.max(0, math.min(1, pos)) * W + 0.5)
  return bar(left, COL.teal) .. tex(ns.MEDIA .. "circle", 11, 11, c, 128) .. bar(W - left, COL.dim)
end

-- Zeilen als Daten: { l, r, rc } = zweispaltig, { text, c } = Fließtext, { rule = true } = Trennlinie,
-- { head = true, r, rc } = Kopfzeile. Auch für Tests (X.TooltipLines).
function X.TooltipRows(itemID)
  local rows, info = {}, {}
  local M, PS, D, AW = ns.Market, ns.PriceString, ns.Demand, ns.AH
  local e = ns.DB.Get(itemID)
  local bound = e and e.bind == 1
  local function row(c, label, value, vc) rows[#rows + 1] = { l = dot(c) .. "  " .. label, r = value, rc = vc } end

  -- Kopf: Absatz-Klasse rechts
  local class = D and D.Class and D.Class(itemID) or "unknown"
  local lab = D and D.LABEL and D.LABEL[class]
  local head = { head = true }
  if lab and class ~= "unknown" then head.r = "|cff" .. lab[2] .. lab[1] .. "|r" end

  if not bound then
    -- Preise: aktuell, üblicher Marktpreis, Durchschnitt, Tief/Hoch, Lage
    local cur = M.Price(itemID)
    local st = PS and PS.Stats and PS.Stats(itemID)
    if cur and not M.HasAuctionator() then row(COL.neon, "AH jetzt", ns.Money(cur)) end
    if st then
      row(COL.neon, "Marktwert (" .. st.days .. " T.)", ns.Money(st.median))
      if st.days >= 2 then
        row(COL.neon, "Durchschnitt", ns.Money(st.mean))
        row(COL.neon, "Min · Max", ns.Money(st.min) .. "  ·  " .. ns.Money(st.max))
      end
      if cur and st.days >= 2 and st.median and st.median > 0 then
        local ratio = cur / st.median
        local c, word = COL.amber, "normaler Preis"
        if ratio <= 0.85 then c, word = COL.neon, "günstig"
        elseif ratio >= 1.15 then c, word = COL.red, "teuer" end
        local pct = math.floor((ratio - 1) * 100 + 0.5)
        local span = st.max - st.min
        local pos = span > 0 and (cur - st.min) / span or 0.5
        rows[#rows + 1] = { l = "     " .. slider(pos, c),
          r = hex(c) .. word .. "|r" .. (pct ~= 0 and string.format(" %s%d %%", pct > 0 and "+" or "", pct) or "") }
      end
      local trend, _, tr = PS.TrendAdvice(itemID)
      if trend and tr then
        local pct = math.floor(tr * 100 + 0.5)
        local c = trend == "steigt" and COL.neon or trend == "fällt" and COL.red or COL.teal
        local tip = trend == "steigt" and "halten lohnt" or trend == "fällt" and "jetzt verkaufen" or "stabil"
        row(COL.neon, "Trend", hex(c) .. (pct > 0 and "+" or "") .. pct .. " %|r  " .. tip)
      end
    end

    -- Absatz: Verkäufe pro Tag, Angebot, Markt-Tiefe
    if D and D.PerDay then
      local perDay, src, _, supply = D.PerDay(itemID)
      if perDay then
        row(COL.teal, "Verkauft pro Tag", "~" .. dec(perDay) .. (src == "eigene" and " (deine)" or ""))
      end
      if supply then
        local days = D.DaysOfSupply(itemID)
        local v = num(supply) .. " Stück"
        if days == 0 then v = hex(COL.neon) .. "ausverkauft – Chance!|r"
        elseif days and days < math.huge then
          v = v .. "  ·  " .. (days > 14 and (hex(COL.red) .. "Markt voll|r") or ("reicht " .. dec(days) .. " " .. ns.Plural(days, "Tag", "Tage")))
        end
        row(COL.teal, "Im Angebot", v)
      end
      if not perDay and (cur or st) then
        row(COL.teal, "Verkauft pro Tag", hex(COL.dim) .. "misst ab 2 Scans|r")
      end
    end

    -- Deine Verkäufe (Verkaufsbuch)
    local rate, n = ns.Ledger.SaleRate(itemID)
    local avg = ns.Ledger.AvgSale and ns.Ledger.AvgSale(itemID, 30)
    if rate or avg then
      local parts = {}
      if rate then parts[#parts + 1] = string.format("%d %% von %d", math.floor(rate * 100 + 0.5), n) end
      if avg then parts[#parts + 1] = "Ø " .. ns.Money(avg) end
      row(COL.aqua, "Deine Verkäufe", table.concat(parts, "  ·  "))
    end

    -- Verkaufen: netto, bester Weg, Mindestpreis
    if cur then
      local stack = ns.Item(itemID).stack or (e and e.stack) or 1
      row(COL.amber, "Netto nach Gebühr", ns.Money(M.Net(cur))
        .. (stack > 1 and ("  ·  " .. stack .. "er " .. ns.Money(M.Net(cur) * stack)) or ""))
    end
    local r = ns.Recipes.ByOutput(itemID)
    local floor
    if r and not ns.Recipes.IsKnown(r) then floor = AW.VendorFloor(itemID) else floor = AW.Floor(itemID) end
    if floor and floor > 0 then row(COL.amber, "Nicht unter", ns.Money(floor)) end
    if cur and (M.VendorSell(itemID) or 0) > 0 then
      local best = M.BestSale(itemID)
      if best and best ~= "AH" then row(COL.amber, "Bester Weg", hex(COL.amber) .. "Händler|r (AH bringt weniger)") end
    end
  end

  -- Hinweise unten (klein, umbrechend)
  local used = X.UsedIn(itemID)
  if used and #used > 0 then info[#info + 1] = string.format("In %d deiner Rezepte, z. B. %s", #used, used[1]) end
  local hint = X.FarmHint(itemID)
  if hint then info[#info + 1] = "Farmen: " .. hint end
  if itemID >= 200000 and e then info[#info + 1] = hex(COL.neon) .. "Neu in WoW Forever|r" end
  local chars, total = ns.Inv.Count(itemID)
  if #chars > 1 or (#chars == 1 and not chars[1].me) then
    local parts = {}
    for i = 1, math.min(#chars, 4) do parts[#parts + 1] = chars[i].name .. " " .. chars[i].total end
    info[#info + 1] = "Alle Chars: " .. total .. " (" .. table.concat(parts, ", ") .. ")"
  end

  if #rows == 0 and #info == 0 then return {} end
  table.insert(rows, 1, head)
  table.insert(rows, 2, { rule = true })
  if #info > 0 then
    if #rows > 2 then rows[#rows + 1] = { rule = true } end
    for _, t in ipairs(info) do rows[#rows + 1] = { text = t } end
  end
  return rows
end

-- Flach als Textzeilen (Tests, Suche)
function X.TooltipLines(itemID)
  local out = {}
  for _, r in ipairs(X.TooltipRows(itemID)) do
    if r.l then out[#out + 1] = r.l .. " " .. (r.r or "") elseif r.text then out[#out + 1] = r.text end
  end
  return out
end

local function addLines(tooltip, itemID)
  local rows = X.TooltipRows(itemID)
  if #rows == 0 then return end
  tooltip:AddLine(" ")
  for _, r in ipairs(rows) do
    if r.head then
      local title = tex(ns.MEDIA .. "logo", 14, 14, { 255, 255, 255 }, 256) .. " " .. hex(COL.neon) .. "Tiry's Zentrale|r"
      if r.r then tooltip:AddDoubleLine(title, r.r) else tooltip:AddLine(title) end
    elseif r.rule then
      tooltip:AddLine(rule())
    elseif r.l then
      tooltip:AddDoubleLine(r.l, r.r or "", LABEL[1], LABEL[2], LABEL[3], VALUE[1], VALUE[2], VALUE[3])
    else
      tooltip:AddLine(r.text, 0.62, 0.70, 0.67, true)
    end
  end
end

ns.Listen("LOGIN", function()
  if not (TooltipDataProcessor and TooltipDataProcessor.AddTooltipPostCall and Enum and Enum.TooltipDataType) then return end
  TooltipDataProcessor.AddTooltipPostCall(Enum.TooltipDataType.Item, function(tooltip, data)
    if not (ns.settings and ns.settings.tooltipInfo) then return end
    if tooltip ~= GameTooltip and tooltip ~= ItemRefTooltip then return end
    if InCombatLockdown and InCombatLockdown() then return end -- im Kampf sind Tooltip-Daten geschützt
    pcall(function()
      local id = data and data.id
      if type(id) == "number" then addLines(tooltip, id) end
    end)
  end)
end)

----------------------------------------------------------------------------
-- Automatisch reparieren
----------------------------------------------------------------------------
ns.On("MERCHANT_SHOW", function()
  if not (ns.settings and ns.settings.autoRepair) or ns.InCombat() then return end
  if not (CanMerchantRepair and GetRepairAllCost and RepairAllItems) or not CanMerchantRepair() then return end
  local cost, canRepair = GetRepairAllCost()
  if canRepair and cost and cost > 0 then
    if GetMoney() >= cost then
      -- eigenes Gold (nicht die Gildenbank) – wie Blizzards Knopf "Alles reparieren"
      if not pcall(RepairAllItems, false) then return end
      ns.Print("Ausrüstung repariert für " .. ns.Money(cost) .. ".")
    else
      ns.Print("|cffff6b81Nicht genug Gold zum Reparieren|r (" .. ns.Money(cost) .. ").")
    end
  end
end)

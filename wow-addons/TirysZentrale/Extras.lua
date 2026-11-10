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

-- Zeilen für den Item-Tooltip (auch für Tests); "Nicht unter" = derselbe Wert wie Craft-Planer und Meine Auktionen
function X.TooltipLines(itemID)
  local lines = {}
  local used = X.UsedIn(itemID)
  if used and #used > 0 then
    lines[#lines + 1] = string.format("In %d deiner Rezepte, z. B. %s", #used, used[1])
  end
  local hint = X.FarmHint(itemID)
  if hint then lines[#lines + 1] = "Farmen: " .. hint end
  if itemID >= 200000 and ns.DB.Get(itemID) then lines[#lines + 1] = "Neu in WoW Forever" end
  local chars, total = ns.Inv.Count(itemID)
  if #chars > 1 or (#chars == 1 and not chars[1].me) then
    local parts = {}
    for i = 1, math.min(#chars, 4) do parts[#parts + 1] = chars[i].name .. " " .. chars[i].total end
    lines[#lines + 1] = "Bestand alle Chars: " .. total .. " (" .. table.concat(parts, ", ") .. ")"
  end
  -- Mindest-Verkaufspreis (AW.Floor): Händlerpreis bzw. Herstellungskosten plus Anzahlungs-Risiko, nach AH-Gebühr.
  -- Rezept eines fremden Berufs: nur der Händlerpreis zählt (du hast es nicht selbst hergestellt).
  local AW, r = ns.AH, ns.Recipes.ByOutput(itemID)
  local floor
  if r and not ns.Recipes.IsKnown(r) then floor = AW.VendorFloor(itemID) else floor = AW.Floor(itemID) end
  floor = floor or 0
  local e = ns.DB.Get(itemID)
  if floor > 0 and not (e and e.bind == 1) then
    lines[#lines + 1] = "Nicht unter " .. ns.Money(floor) .. " pro Stück verkaufen"
  end
  local rate, n = ns.Ledger.SaleRate(itemID)
  if rate then lines[#lines + 1] = string.format("Deine Verkaufsquote: %d %% (%d Auktionen)", math.floor(rate * 100 + 0.5), n) end
  if ns.Demand and (ns.Demand.PerDay(itemID) or select(4, ns.Demand.PerDay(itemID))) then
    lines[#lines + 1] = "Absatz: " .. ns.Demand.Text(itemID)
  end
  local PS = ns.PriceString
  local trend = PS and PS.TrendAdvice and select(2, PS.TrendAdvice(itemID))
  if trend then lines[#lines + 1] = trend end
  return lines
end

local function addLines(tooltip, itemID)
  local lines = X.TooltipLines(itemID)
  if #lines == 0 then return end
  tooltip:AddLine(" ")
  tooltip:AddLine("Tiry's Zentrale", 1, 0.6, 0.16)
  for _, l in ipairs(lines) do tooltip:AddLine(l, 0.86, 0.84, 0.95, true) end
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

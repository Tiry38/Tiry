-- Tiry's Zentrale – Händler-Panel: erscheint neben dem Händlerfenster mit Ein-Klick-Aktionen
local ADDON, ns = ...
local UI = ns.UI
local C = UI.C
local A = ns.Auto

local panel

local function create()
  local p = CreateFrame("Frame", "TirysZentraleMerchantPanel", UIParent)
  p:SetSize(270, 292)
  p:SetFrameStrata("HIGH")
  p.bg = UI.Round(p, 20, "BACKGROUND", -8)
  p.bg:SetColor(C.bg)
  local glow = UI.Glow(p, C.amber, 260, 0.18, "BACKGROUND")
  glow:SetPoint("TOP", 0, 60)
  local logo = p:CreateTexture(nil, "ARTWORK")
  logo:SetTexture(UI.TEX.logo)
  logo:SetSize(28, 28)
  logo:SetPoint("TOPLEFT", 14, -12)
  local title = UI.Text(p, 14, "bold", C.text)
  title:SetPoint("LEFT", logo, "RIGHT", 8, 0)
  title:SetText("Gold-Autopilot")

  p.info = UI.Para(p, 11, C.muted, 242)
  p.info:SetPoint("TOPLEFT", 14, -50)

  p.sell = UI.Button(p, "Händler-Ware verkaufen", "primary", 242, 34, "coins")
  p.sell:SetPoint("TOPLEFT", 14, -112)
  p.sell:SetScript("OnClick", function()
    local n = A.SellVendorItems()
    ns.Print(n > 0 and (n .. " Items verkauft, die beim Händler mehr bringen als im AH.") or "Nichts zu verkaufen.")
    C_Timer.After(0.8, function() ns.Safe(A.RefreshPanel) end)
  end)
  UI.SetTooltip(p.sell, function()
    local list, total = A.VendorCandidates()
    if #list == 0 then return "Nichts zu verkaufen", "Keine Handwerkswaren in deinen Taschen, die beim Händler mehr bringen als im AH." end
    local names = {}
    for i = 1, math.min(#list, 8) do names[#names + 1] = list[i].count .. "× " .. ns.Item(list[i].id).name end
    return "Verkauft (max. 12 pro Klick, " .. ns.Money(total) .. " gesamt)", table.concat(names, "\n")
      .. "\n\nNur Handwerkswaren und Verschiedenes – nie Ausrüstung oder Quest-Items. Rückkauf beim Händler ist möglich."
  end)

  p.buy = UI.Button(p, "Flip-Schnäppchen kaufen", "cool", 242, 34, "cart")
  p.buy:SetPoint("TOPLEFT", 14, -154)
  p.buy:SetScript("OnClick", function()
    local ok, res = A.BuyFlips()
    if ok then
      ns.Print(res .. " Flip(s) gekauft. Jetzt im AH mit Auctionator > \"Verkaufen\" einstellen.")
    else
      ns.Print("|cffff6b81" .. res .. "|r")
    end
    C_Timer.After(0.8, function() ns.Safe(A.RefreshPanel) end)
  end)
  UI.SetTooltip(p.buy, function()
    local plan, cost, profit = A.FlipBuyPlan()
    if #plan == 0 then return "Keine Flips", "Bei diesem Händler gibt es nichts mit begrenztem Vorrat, das sich im AH lohnt." end
    local names = {}
    for _, e in ipairs(plan) do names[#names + 1] = e.qty .. "× " .. ns.Item(e.id).name .. " (+" .. ns.Money(e.profit) .. ")" end
    return "Kosten " .. ns.Money(cost) .. " – erwarteter Gewinn " .. ns.Money(profit), table.concat(names, "\n")
      .. "\n\nGewinn laut letztem AH-Scan nach AH-Gebühr. Kauft nur Ware mit begrenztem Vorrat."
  end)

  p.mats = UI.Button(p, "Craft-Material kaufen", "primary", 242, 34, "bolt")
  p.mats:SetPoint("TOPLEFT", 14, -196)
  p.mats:SetScript("OnClick", function()
    local ok, res = ns.Shop.BuyFromVendor()
    ns.Print(ok and ("Gekauft: " .. res) or ("|cffff6b81" .. res .. "|r"))
  end)
  UI.SetTooltip(p.mats, function()
    local plan, cost = ns.Shop.VendorPlan()
    if #plan == 0 then return "Craft-Material kaufen", "Dieser Händler verkauft nichts, was deiner Craft-Liste noch fehlt." end
    local names = {}
    for _, e in ipairs(plan) do names[#names + 1] = e.qty .. "× " .. ns.Item(e.id).name .. "  " .. ns.Money(e.cost) end
    return "Kauft für " .. ns.Money(cost), table.concat(names, "\n") .. "\n\nGenau die fehlende Menge aus deiner Einkaufsliste – nur gegen Gold."
  end)

  p.more = UI.Button(p, "Details im Scanner", "soft", 242, 30, "scan")
  p.more:SetPoint("TOPLEFT", 14, -238)
  p.more:SetScript("OnClick", function() UI.Show("scanner") end)
  p:Hide()
  return p
end

function A.RefreshPanel()
  if not panel or not panel:IsShown() then return end
  local _, vendorTotal = A.VendorCandidates()
  local list = A.VendorCandidates()
  local plan, cost, profit = A.FlipBuyPlan()
  local flips = #ns.Scanner.merchant.flips
  panel.info:SetText(string.format("Händler-Verkauf: |cffffd24a%d Items, %s|r\nFlip-Chancen: |cff61eb8f%d|r%s\nSchrott: %s",
    #list, ns.Money(vendorTotal), flips,
    #plan > 0 and (" – kaufen für " .. ns.Money(cost) .. ", Gewinn " .. ns.Money(profit)) or "",
    ns.settings.autoJunk and "wird automatisch verkauft" or "Autopilot aus (Einstellungen)"))
  panel.sell:SetEnabled(#list > 0)
  panel.buy:SetEnabled(#plan > 0 and GetMoney() >= cost)
  local mats = ns.Shop.VendorPlan()
  panel.mats:SetLabel(#mats > 0 and ("Craft-Material kaufen (" .. #mats .. ")") or "Craft-Material kaufen")
  panel.mats:SetEnabled(#mats > 0)
end

ns.Listen("MERCHANT_SCANNED", function()
  if not (ns.settings and ns.settings.merchantPanel) then return end
  if ns.Scanner.merchant.open then
    panel = panel or create()
    panel:ClearAllPoints()
    if MerchantFrame and MerchantFrame:IsShown() then
      panel:SetPoint("TOPLEFT", MerchantFrame, "TOPRIGHT", 8, 0)
    else
      panel:SetPoint("CENTER", UIParent, "CENTER", 300, 0)
    end
    panel:Show()
    A.RefreshPanel()
  elseif panel then
    panel:Hide()
  end
end)
ns.Listen("SHOP_CHANGED", function()
  if panel and panel:IsShown() then ns.Debounce("panel", 0.4, A.RefreshPanel) end
end)
ns.On("BAG_UPDATE_DELAYED", function()
  if panel and panel:IsShown() then ns.Debounce("panel", 0.4, A.RefreshPanel) end
end)

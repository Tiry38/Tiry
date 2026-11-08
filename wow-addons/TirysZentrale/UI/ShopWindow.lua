-- Tiry's Zentrale – kleines Einkaufsfenster (wie TSM): nur die Materialien der Craft-Liste,
-- Gekauftes verschwindet sofort, rechts unten "Nächstes craften".
local ADDON, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market
local Shop = ns.Shop

local W, ROW = 320, 40
local win

local function create()
  local f = CreateFrame("Frame", "TirysZentraleShopWindow", UIParent)
  f:SetSize(W, 420)
  f:SetFrameStrata("HIGH")
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:EnableMouse(true)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", function(self) self:StartMoving() end)
  f:SetScript("OnDragStop", function(self)
    self:StopMovingOrSizing()
    local p, _, rp, x, y = self:GetPoint(1)
    ns.settings.shopPoint = { p, rp, x, y }
  end)
  local sp = ns.settings.shopPoint
  if type(sp) == "table" and sp[1] then f:SetPoint(sp[1], UIParent, sp[2], sp[3], sp[4]) else f:SetPoint("RIGHT", UIParent, "RIGHT", -80, 40) end
  f.bg = UI.Round(f, 20, "BACKGROUND", -8)
  f.bg:SetColor(C.bg)
  local glow = UI.Glow(f, C.teal, 260, 0.16, "BACKGROUND")
  glow:SetPoint("TOP", 0, 60)

  local icon = f:CreateTexture(nil, "ARTWORK")
  icon:SetTexture(UI.Icon("cart"))
  icon:SetSize(18, 18)
  icon:SetPoint("TOPLEFT", 16, -16)
  icon:SetVertexColor(C.gold[1], C.gold[2], C.gold[3], 1)
  f.title = UI.Text(f, 14, "bold", C.text)
  f.title:SetPoint("LEFT", icon, "RIGHT", 8, 0)
  f.title:SetText("Einkaufsliste")
  local close = UI.IconButton(f, "close", 26, "Schließen")
  close:SetPoint("TOPRIGHT", -12, -12)
  close:SetScript("OnClick", function() f:Hide() end)

  f.summary = UI.Para(f, 11, C.muted, W - 32)
  f.summary:SetPoint("TOPLEFT", 16, -44)
  f.rows = {}

  f.search = UI.Button(f, "Im AH suchen", "soft", 136, 32, "scan")
  f.search:SetPoint("BOTTOMLEFT", 14, 14)
  f.search:SetScript("OnClick", function()
    local ids = Shop.MissingIDs(true)
    if #ids == 0 then ns.Print("Im AH ist nichts mehr zu kaufen.") return end
    local ok, err = M.SearchNow(ids)
    if not ok then ns.Print("|cffff6b81" .. tostring(err) .. "|r") end
  end)
  UI.SetTooltip(f.search, "Im AH suchen", "Bei offenem Auktionshaus: Auctionator sucht alle fehlenden Materialien auf einmal. Was du kaufst, wird hier sofort abgezogen.")
  f.craft = UI.Button(f, "Nächstes craften", "primary", 150, 32, "bolt")
  f.craft:SetPoint("BOTTOMRIGHT", -14, 14)
  f.craft:SetScript("OnClick", function() UI.pages.recipes.CraftNext(UI.pages.recipes) end)
  UI.SetTooltip(f.craft, "Nächstes craften", "Stellt der Reihe nach her, wofür du alles Material hast. Ist das Berufsfenster zu, öffnet der erste Klick es, der zweite stellt her.")
  f:Hide()
  tinsert(UISpecialFrames, "TirysZentraleShopWindow")
  return f
end

local function row(i)
  local r = win.rows[i]
  if r then return r end
  r = CreateFrame("Button", nil, win)
  r:SetSize(W - 28, ROW - 4)
  r.bg = UI.Round(r, 14, "BACKGROUND", 0)
  r.icon = UI.ItemIcon(r, 28)
  r.icon:SetPoint("LEFT", 6, 0)
  r.name = UI.Text(r, 12, "semibold", C.text)
  r.name:SetPoint("TOPLEFT", r.icon, "TOPRIGHT", 8, 0)
  r.name:SetWidth(W - 150)
  r.name:SetWordWrap(false)
  r.sub = UI.Text(r, 10, "regular", C.dim)
  r.sub:SetPoint("TOPLEFT", r.name, "BOTTOMLEFT", 0, -2)
  r.count = UI.Text(r, 14, "bold", C.gold)
  r.count:SetPoint("RIGHT", -10, 0)
  r:SetScript("OnEnter", function(self)
    GameTooltip:SetOwner(self, "ANCHOR_LEFT")
    pcall(GameTooltip.SetItemByID, GameTooltip, self.id)
    GameTooltip:Show()
  end)
  r:SetScript("OnLeave", function() GameTooltip:Hide() end)
  r:SetScript("OnClick", function(self) if IsShiftKeyDown() then ns.LinkItem(self.id) end end)
  win.rows[i] = r
  return r
end

function Shop.Refresh()
  if not win or not win:IsShown() then return end
  local list, open, cost = Shop.List()
  if #list == 0 then
    win.summary:SetText("Die Craft-Liste ist leer. Im Craft-Planer auf |cffffd24aListe erstellen|r klicken.")
  elseif open == 0 then
    win.summary:SetText("|cff61eb8fAlles da!|r Hol deine Post aus dem Briefkasten und klick auf |cffffd24aNächstes craften|r.")
  else
    win.summary:SetText(string.format("Noch |cffffd24a%d %s|r zu kaufen, ca. %s. Gekauftes verschwindet sofort.", open, open == 1 and "Material" or "Materialien", ns.Money(cost)))
  end
  local y = 44 + math.ceil(win.summary:GetStringHeight()) + 10
  local shown = 0
  for i, e in ipairs(list) do
    if i > 9 then break end
    shown = i
    local r = row(i)
    r.id = e.id
    r.icon:SetItem(e.id)
    local item = ns.Item(e.id)
    r.name:SetText(item.name)
    if e.missing > 0 then
      r.bg:SetColor(C.card, 1)
      r.name:SetTextColor(C.text[1], C.text[2], C.text[3], 1)
      r.count:SetText(e.missing .. "×")
      r.count:SetTextColor(C.gold[1], C.gold[2], C.gold[3], 1)
      r.sub:SetText(string.format("%d / %d · %s", e.have, e.need,
        e.unit and (ns.Money(e.unit) .. (e.where == "HAENDLER" and " beim Händler" or " im AH")) or "kein Preis"))
    else
      r.bg:SetColor(C.inset, 0.6)
      r.name:SetTextColor(C.dim[1], C.dim[2], C.dim[3], 1)
      r.count:SetText("|A:common-icon-checkmark:14:14|a")
      r.sub:SetText(e.need .. " / " .. e.need .. " · erledigt")
    end
    r:ClearAllPoints()
    r:SetPoint("TOPLEFT", win, "TOPLEFT", 14, -y)
    r:Show()
    y = y + ROW
  end
  for i = shown + 1, #win.rows do win.rows[i]:Hide() end
  win:SetHeight(math.max(y + 60, 160))
  win.search:SetEnabled(open > 0 and M.ahOpen == true)
  win.craft:SetEnabled(#(ns.char.queue or {}) > 0)
end

function Shop.Show()
  win = win or create()
  win:Show()
  Shop.Refresh()
end

function Shop.Toggle()
  if win and win:IsShown() then win:Hide() else Shop.Show() end
end

for _, msg in ipairs({ "SHOP_CHANGED", "AH_STATE", "PRICES_UPDATED", "ITEMS_UPDATED", "RECIPES_SCANNED" }) do
  ns.Listen(msg, function() ns.Debounce("shopwin", 0.2, Shop.Refresh) end)
end

-- Beim Öffnen des AH: Fenster zeigen, wenn noch etwas zu kaufen ist
ns.Listen("AH_STATE", function()
  if M.ahOpen and ns.settings.shopAutoOpen ~= false then
    local _, open = Shop.List()
    if open > 0 then Shop.Show() end
  end
end)

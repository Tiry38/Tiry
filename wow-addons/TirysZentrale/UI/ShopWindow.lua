-- Tiry's Zentrale – kleines Einkaufsfenster (wie TSM): oben was du herstellst, darunter nur die Materialien.
-- Gekauftes verschwindet sofort. Am AH: "Im AH suchen", beim Händler: "Beim Händler kaufen" (ein Klick kauft alles).
local _, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market
local Shop = ns.Shop

local W, ROW, CROW = 380, 42, 32
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
  UI.Ornaments(f, { w = W, h = 900, pattern = 0.05, corners = 0.35, cornerSize = 44, inset = 4 })
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

  f.craftHead = UI.Text(f, 10, "semibold", C.dim)
  f.craftHead:SetText("DU STELLST HER")
  f.matHead = UI.Text(f, 10, "semibold", C.dim)
  f.matHead:SetText("MATERIAL")
  f.crafts = {}
  f.more = UI.Text(f, 10, "regular", C.dim)

  -- Linker Knopf passt sich an: beim Händler kaufen, sonst im AH suchen
  f.search = UI.Button(f, "Im AH suchen", "soft", 186, 34, "scan")
  f.search:SetPoint("BOTTOMLEFT", 14, 14)
  f.search:SetScript("OnClick", function(self)
    if self.mode == "vendor" then
      local ok, res = Shop.BuyFromVendor()
      ns.Print(ok and ("Gekauft: " .. res) or ("|cffff6b81" .. res .. "|r"))
      return
    end
    local ids = Shop.MissingIDs(true)
    if #ids == 0 then ns.Print("Im AH ist nichts mehr zu kaufen.") return end
    local ok, err = M.SearchNow(ids)
    if not ok then ns.Print("|cffff6b81" .. tostring(err) .. "|r") end
  end)
  UI.SetTooltip(f.search, function()
    if f.search.mode == "vendor" then
      local plan, cost = Shop.VendorPlan()
      local names = {}
      for _, p in ipairs(plan) do names[#names + 1] = p.qty .. "× " .. ns.Item(p.id).name .. "  " .. ns.Money(p.cost) end
      return "Beim Händler kaufen (" .. ns.Money(cost) .. ")", table.concat(names, "\n")
        .. "\n\nKauft genau die fehlende Menge, die dieser Händler hat – nur gegen Gold. Rückkauf beim Händler ist möglich."
    end
    return "Im AH suchen", "Bei offenem Auktionshaus: Auctionator sucht alle fehlenden Materialien auf einmal. Was du kaufst, wird hier sofort abgezogen."
  end)
  f.craft = UI.Button(f, "Nächstes craften", "primary", 164, 34, "bolt")
  f.craft:SetPoint("BOTTOMRIGHT", -14, 14)
  f.craft:SetScript("OnClick", function() UI.pages.recipes.CraftNext(UI.pages.recipes) end)
  UI.SetTooltip(f.craft, "Nächstes craften", "Stellt der Reihe nach her, wofür du alles Material hast. Ist das Berufsfenster zu, öffnet der erste Klick es, der zweite stellt her.")
  -- Herstellungs-Balken: zeigt, wie lange das aktuelle Herstellen noch dauert (falls der Spiel-Balken verdeckt ist)
  local cb = CreateFrame("Frame", nil, f)
  cb:SetSize(W - 28, 30)
  cb.bg = UI.Round(cb, 15, "BACKGROUND", 0)
  cb.bg:SetColor(C.inset, 1)
  cb.fill = CreateFrame("Frame", nil, cb)
  cb.fill:SetPoint("TOPLEFT")
  cb.fill:SetPoint("BOTTOMLEFT")
  cb.fill:SetWidth(30)
  cb.fill.bg = UI.Round(cb.fill, 15, "ARTWORK", 0)
  cb.fill.bg:SetGradient(UI.GRAD, 0.55) -- halbtransparent: weißer Text bleibt lesbar
  -- Symbol und Text auf eigener Ebene ÜBER der Füllung
  local top = CreateFrame("Frame", nil, cb)
  top:SetAllPoints()
  top:SetFrameLevel(cb.fill:GetFrameLevel() + 2)
  cb.icon = top:CreateTexture(nil, "OVERLAY")
  cb.icon:SetSize(22, 22)
  cb.icon:SetPoint("LEFT", 5, 0)
  cb.text = UI.Text(top, 12, "semibold", C.text, "OVERLAY")
  cb.text:SetPoint("LEFT", cb.icon, "RIGHT", 8, 0)
  cb.text:SetWidth(W - 150)
  cb.text:SetWordWrap(false)
  cb.time = UI.Text(top, 12, "bold", C.text, "OVERLAY")
  cb.time:SetPoint("RIGHT", -12, 0)
  cb.time:SetJustifyH("RIGHT")
  cb:Hide()
  cb:SetScript("OnUpdate", function(self)
    if not self.endMs then return end
    local now = GetTime() * 1000
    local total = math.max(self.endMs - self.startMs, 1)
    local p = ns.Clamp((now - self.startMs) / total, 0, 1)
    self.fill:SetWidth(math.max((W - 28) * p, 30))
    self.time:SetText((string.format("%.1f s", math.max(self.endMs - now, 0) / 1000):gsub("%.", ",")))
  end)
  f.cast = cb
  f:Hide()
  tinsert(UISpecialFrames, "TirysZentraleShopWindow")
  return f
end

local function row(i)
  local r = win.rows[i]
  if r then return r end
  r = UI.SafeButton(win)
  r:SetSize(W - 28, ROW - 4)
  r.bg = UI.Round(r, 14, "BACKGROUND", 0)
  r.icon = UI.ItemIcon(r, 28)
  r.icon:SetPoint("LEFT", 6, 0)
  r.name = UI.Text(r, 12, "semibold", C.text)
  r.name:SetPoint("TOPLEFT", r.icon, "TOPRIGHT", 8, 0)
  r.name:SetWidth(W - 176)
  r.name:SetWordWrap(false)
  r.sub = UI.Text(r, 10, "regular", C.dim)
  r.sub:SetPoint("TOPLEFT", r.name, "BOTTOMLEFT", 0, -2)
  r.toggle = UI.IconButton(r, "close", 24)
  r.toggle:SetPoint("RIGHT", -6, 0)
  r.toggle:SetScript("OnClick", function() Shop.ToggleSkip(r.id) end)
  UI.SetTooltip(r.toggle, function()
    if r.skipped then return "Zurückholen", "Material wieder auf die Einkaufsliste setzen." end
    return "Brauch ich nicht kaufen", "Nimmt das Material von der Liste (z. B. weil es ein anderer Charakter hat). Der Pfeil-Knopf holt es zurück."
  end)
  r.count = UI.Text(r, 14, "bold", C.hi)
  r.count:SetPoint("RIGHT", r.toggle, "LEFT", -6, 0)
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

local STATUS = {
  bereit = { "bereit", C.green },
  post = { "Post holen", C.hi },
  fehlt = { "fehlt Material", C.red },
}

local function craftRow(i)
  local r = win.crafts[i]
  if r then return r end
  r = UI.SafeButton(win)
  r:SetSize(W - 28, CROW - 4)
  r.icon = UI.ItemIcon(r, 24)
  r.icon:SetPoint("LEFT", 4, 0)
  r.status = UI.Text(r, 10, "semibold", C.green)
  r.status:SetPoint("RIGHT", -8, 0)
  r.status:SetJustifyH("RIGHT")
  r.name = UI.Text(r, 12, "semibold", C.text)
  r.name:SetPoint("LEFT", r.icon, "RIGHT", 8, 0)
  r.name:SetWidth(W - 160)
  r.name:SetJustifyH("LEFT")
  r.name:SetWordWrap(false)
  r:SetScript("OnEnter", function(self)
    GameTooltip:SetOwner(self, "ANCHOR_LEFT")
    pcall(GameTooltip.SetItemByID, GameTooltip, self.id)
    GameTooltip:Show()
  end)
  r:SetScript("OnLeave", function() GameTooltip:Hide() end)
  r:SetScript("OnClick", function(self) if IsShiftKeyDown() then ns.LinkItem(self.id) end end)
  win.crafts[i] = r
  return r
end

function Shop.Refresh()
  if not win or not win:IsShown() then return end
  local list, open, cost = Shop.List()
  local plan, planCost = Shop.VendorPlan()
  if #list == 0 then
    win.summary:SetText("Die Craft-Liste ist leer. Im Craft-Planer auf |cffff9929Liste erstellen|r klicken.")
  elseif open == 0 then
    win.summary:SetText("|cffff9929Alles da!|r Hol deine Post aus dem Briefkasten und klick auf |cffff9929Nächstes craften|r.")
  elseif #plan > 0 then
    win.summary:SetText(string.format("Dieser Händler hat |cffff9929%d %s|r für dich. Ein Klick auf |cffff9929Beim Händler kaufen|r holt alles für %s.",
      #plan, #plan == 1 and "Material" or "Materialien", ns.Money(planCost)))
  else
    win.summary:SetText(string.format("Noch |cffff9929%d %s|r zu kaufen, ca. %s. Gekauftes verschwindet sofort.", open, open == 1 and "Material" or "Materialien", ns.Money(cost)))
  end
  local y = 44 + math.ceil(win.summary:GetStringHeight()) + 12

  -- Was wird hergestellt?
  local crafts = Shop.Crafts()
  local shownC = 0
  if #crafts > 0 then
    win.craftHead:ClearAllPoints()
    win.craftHead:SetPoint("TOPLEFT", win, "TOPLEFT", 18, -y)
    win.craftHead:Show()
    y = y + 18
    for i, c in ipairs(crafts) do
      if i > 5 then break end
      shownC = i
      local r = craftRow(i)
      r.id = c.recipe.out
      r.icon:SetItem(c.recipe.out)
      local item = ns.Item(c.recipe.out)
      r.name:SetText(string.format("|cffff9929%d×|r %s", c.n * (c.recipe.qty or 1), item.name or c.recipe.name))
      local st = STATUS[c.status]
      r.status:SetText(st[1])
      r.status:SetTextColor(st[2][1], st[2][2], st[2][3], 1)
      r:ClearAllPoints()
      r:SetPoint("TOPLEFT", win, "TOPLEFT", 14, -y)
      r:Show()
      y = y + CROW
    end
    if #crafts > 5 then
      win.more:SetText(string.format("+ %d weitere im Craft-Planer", #crafts - 5))
      win.more:ClearAllPoints()
      win.more:SetPoint("TOPLEFT", win, "TOPLEFT", 46, -y)
      win.more:Show()
      y = y + 16
    else
      win.more:Hide()
    end
    y = y + 8
  else
    win.craftHead:Hide()
    win.more:Hide()
  end
  for i = shownC + 1, #win.crafts do win.crafts[i]:Hide() end

  -- Material
  if #list > 0 then
    win.matHead:ClearAllPoints()
    win.matHead:SetPoint("TOPLEFT", win, "TOPLEFT", 18, -y)
    win.matHead:Show()
    y = y + 18
  else
    win.matHead:Hide()
  end
  local vendorHas = {}
  for _, p in ipairs(plan) do vendorHas[p.id] = true end
  local shown = 0
  for i, e in ipairs(list) do
    if i > 9 then break end
    shown = i
    local r = row(i)
    r.id = e.id
    r.icon:SetItem(e.id)
    local item = ns.Item(e.id)
    UI.FitText(r.name, item.name, W - 176)
    r.skipped = e.skipped
    r.toggle.icon:SetTexture(UI.Icon(e.skipped and "refresh" or "close"))
    r.toggle:SetShown(e.missing > 0 or e.skipped == true)
    if e.skipped then
      r.bg:SetColor(C.inset, 0.6)
      r.name:SetTextColor(C.dim[1], C.dim[2], C.dim[3], 1)
      r.count:SetText("")
      r.sub:SetText(string.format("%d / %d · übersprungen", e.have, e.need))
    elseif e.missing > 0 then
      r.bg:SetColor(vendorHas[e.id] and C.cardHi or C.card, 1)
      r.name:SetTextColor(C.text[1], C.text[2], C.text[3], 1)
      r.count:SetText(e.missing .. "×")
      r.count:SetTextColor(C.hi[1], C.hi[2], C.hi[3], 1)
      local where = vendorHas[e.id] and " |cffff9929hier beim Händler|r"
        or (e.where == "HAENDLER" and " beim Händler" or " im AH")
      r.sub:SetText(string.format("%d / %d · %s", e.have, e.need, e.unit and (ns.Money(e.unit) .. where) or "kein Preis"))
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
  -- Herstellungs-Balken über den Knöpfen
  if win.cast.endMs then
    win.cast:ClearAllPoints()
    win.cast:SetPoint("TOPLEFT", win, "TOPLEFT", 14, -(y + 4))
    win.cast:Show()
    y = y + 38
  else
    win.cast:Hide()
  end
  win:SetHeight(math.max(y + 60, 160))
  if #plan > 0 then
    win.search.mode = "vendor"
    win.search:SetLabel("Beim Händler kaufen")
    win.search:SetEnabled(true)
  else
    win.search.mode = "ah"
    win.search:SetLabel("Im AH suchen")
    win.search:SetEnabled(open > 0 and M.ahOpen == true)
  end
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

for _, msg in ipairs({ "SHOP_CHANGED", "AH_STATE", "PRICES_UPDATED", "ITEMS_UPDATED", "RECIPES_SCANNED", "MERCHANT_SCANNED" }) do
  ns.Listen(msg, function() ns.Debounce("shopwin", 0.2, Shop.Refresh) end)
end

-- Beim Öffnen des AH: Fenster zeigen, wenn noch etwas zu kaufen ist
ns.Listen("AH_STATE", function()
  if M.ahOpen and ns.settings.shopAutoOpen ~= false then
    local _, open = Shop.List()
    if open > 0 then Shop.Show() end
  end
end)

-- Beim Händler: Fenster zeigen, wenn er etwas aus der Einkaufsliste verkauft
ns.Listen("MERCHANT_SCANNED", function()
  if ns.Scanner.merchant.open and ns.settings.shopAutoOpen ~= false and #(Shop.VendorPlan()) > 0 then Shop.Show() end
end)

-- Herstellungs-Balken: nur für Berufs-Zauber des Spielers (UnitCastingInfo: isTradeskill)
local function castUpdate(_, unit)
  if unit ~= "player" or not win then return end
  local ok, name, _, tex, startMs, endMs, isTradeskill = pcall(UnitCastingInfo, "player")
  local cb = win.cast
  if ok and name and isTradeskill and type(startMs) == "number" and type(endMs) == "number" then
    cb.startMs, cb.endMs = startMs, endMs
    cb.icon:SetTexture(tex)
    -- wie viele davon stehen noch auf der Craft-Liste?
    local left
    for _, e in ipairs(ns.char.queue or {}) do
      local r = ns.Recipes.Get(e.recipe)
      if r and r.name == name then left = e.n end
    end
    UI.FitText(cb.text, name .. (left and ("  ·  noch " .. left) or ""), W - 150)
  else
    cb.startMs, cb.endMs = nil, nil
  end
  if win:IsShown() then Shop.Refresh() end
end
for _, ev in ipairs({ "UNIT_SPELLCAST_START", "UNIT_SPELLCAST_DELAYED" }) do ns.On(ev, castUpdate) end
for _, ev in ipairs({ "UNIT_SPELLCAST_STOP", "UNIT_SPELLCAST_FAILED", "UNIT_SPELLCAST_INTERRUPTED" }) do
  ns.On(ev, function(_, unit)
    if unit ~= "player" or not win then return end
    win.cast.startMs, win.cast.endMs = nil, nil
    if win:IsShown() then Shop.Refresh() end
  end)
end

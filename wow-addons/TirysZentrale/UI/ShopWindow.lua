-- Tiry's Zentrale – kleines Einkaufsfenster (wie TSM): oben was du herstellst, darunter nur die Materialien.
-- Gekauftes verschwindet sofort. Am AH: "Angebote zeigen", beim Händler: "Beim Händler kaufen" (ein Klick kauft alles).
local _, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market
local Shop = ns.Shop

local W, ROW, CROW = 400, 48, 34
local PILL = ROW - 6
local SUB_W = W - 156 -- Platz für die zweite Zeile (bis vor die Stückzahl)
local win

-- Abschnitts-Kopf: Neon-Punkt + Text + auslaufende Lichtlinie
local function sectionHead(f, text)
  local h = UI.Text(f, 12, "semibold", C.muted)
  h:SetText(text)
  h.dot = f:CreateTexture(nil, "ARTWORK")
  h.dot:SetTexture(UI.TEX.circle)
  h.dot:SetSize(7, 7)
  h.dot:SetPoint("RIGHT", h, "LEFT", -7, 0)
  UI.SetGradV(h.dot, C.amber, C.teal, 1)
  h.line = UI.Hairline(f, C.teal, 0.30)
  h.line:SetPoint("LEFT", h, "RIGHT", 10, 0)
  h.line:SetPoint("RIGHT", f, "RIGHT", -20, 0)
  return h
end

local function placeHead(h, y)
  h:ClearAllPoints()
  h:SetPoint("TOPLEFT", win, "TOPLEFT", 30, -y)
  h:Show()
  h.dot:Show()
  h.line:Show()
end

local function hideHead(h)
  h:Hide()
  h.dot:Hide()
  h.line:Hide()
end

-- Erste Fassung, die passt; sonst die letzte wortweise kürzen
local function fitFirst(fs, maxW, list)
  for i = 1, #list - 1 do
    fs:SetText(list[i])
    if fs:GetUnboundedStringWidth() <= maxW then return end
  end
  UI.FitText(fs, list[#list], maxW)
end

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
  -- Neon-Glas wie das Hauptfenster: Leuchtrand, Halo, Glanz oben, weiche Lichtflecken
  f.glass = UI.Glass(f, { radius = 26, edgeMode = "neon", edge = 0.72, halo = 0.22, haloPad = 24,
    body = UI.GLASS.window, sheen = 0.05, sheenH = 70, line = 0.5 })
  f.bg = f.glass.body
  UI.Ornaments(f, { w = W, h = 900, pattern = 0.04, corners = 0.30, cornerSize = 44, inset = 4 })
  local glow = UI.Glow(f, C.amber, 340, 0.13, "BORDER")
  glow:SetHeight(150)
  glow:SetPoint("TOP", f, "TOPLEFT", 120, 10)
  UI.Drift(glow, 120, 0, 9, 0.35, 0.10)
  local glow2 = UI.Glow(f, C.aqua, 300, 0.10, "BORDER")
  glow2:SetHeight(140)
  glow2:SetPoint("BOTTOM", f, "BOTTOMRIGHT", -110, -6)

  -- Kopf: Verlaufs-Kugel mit Einkaufswagen + Titel
  local orb = f:CreateTexture(nil, "ARTWORK")
  orb:SetTexture(UI.TEX.circle)
  orb:SetSize(34, 34)
  orb:SetPoint("TOPLEFT", 18, -16)
  UI.SetGradV(orb, C.amber, C.teal, 1)
  local orbGlow = UI.Glow(f, C.amber, 70, 0.30, "BORDER")
  orbGlow:SetPoint("CENTER", orb, "CENTER")
  local gloss = f:CreateTexture(nil, "ARTWORK", nil, 2)
  gloss:SetTexture(UI.TEX.gloss)
  gloss:SetAllPoints(orb)
  gloss:SetBlendMode("ADD")
  gloss:SetVertexColor(1, 1, 1, 0.30)
  local icon = f:CreateTexture(nil, "OVERLAY")
  icon:SetTexture(UI.Icon("cart"))
  icon:SetSize(18, 18)
  icon:SetPoint("CENTER", orb, "CENTER")
  icon:SetVertexColor(0.03, 0.07, 0.06, 1)
  f.title = UI.Text(f, 17, "bold", C.text)
  f.title:SetPoint("LEFT", orb, "RIGHT", 12, 0)
  f.title:SetText(UI.GradText("Einkaufsliste", C.amber, C.teal))
  local close = UI.IconButton(f, "close", 30, "Schließen")
  close:SetPoint("TOPRIGHT", -16, -18)
  close:SetScript("OnClick", function() f:Hide() end)

  f.summary = UI.Para(f, 12, C.muted, W - 40)
  f.summary:SetPoint("TOPLEFT", 20, -64)
  f.rows = {}

  f.craftHead = sectionHead(f, "Du stellst her")
  f.matHead = sectionHead(f, "Material")
  f.crafts = {}
  f.more = UI.Text(f, 12, "regular", C.dim)

  -- Linker Knopf passt sich an: beim Händler kaufen, sonst im AH suchen
  f.search = UI.Button(f, "Angebote zeigen", "soft", 196, 38, "scan")
  f.search:SetPoint("BOTTOMLEFT", 16, 16)
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
    return "Angebote zeigen", "Nur zum Kaufen – die Preise aktualisiert der Scan oben für alle Reiter.\n\nBei offenem Auktionshaus: Auctionator sucht alle fehlenden Materialien auf einmal. Was du kaufst, wird hier sofort abgezogen."
  end)
  f.craft = UI.Button(f, "Nächstes craften", "primary", 160, 38, "bolt")
  f.craft:SetPoint("BOTTOMRIGHT", -16, 16)
  f.craft:SetScript("OnClick", function() Shop.ClearSignal() UI.pages.recipes.CraftNext(UI.pages.recipes) end)
  -- Leuchten: "Die nächste Sorte ist dran" (pulsiert, solange du noch nicht geklickt hast)
  local cg = CreateFrame("Frame", nil, f)
  cg:SetPoint("CENTER", f.craft, "CENTER")
  cg:SetSize(230, 110)
  cg:SetFrameLevel(math.max(f.craft:GetFrameLevel() - 1, 0))
  cg.tex = UI.Glow(cg, C.green or { 0.38, 0.92, 0.56 }, 230, 0.9, "BACKGROUND")
  cg.tex:SetAllPoints()
  cg.anim = cg:CreateAnimationGroup()
  cg.anim:SetLooping("BOUNCE")
  local fade = cg.anim:CreateAnimation("Alpha")
  fade:SetFromAlpha(1)
  fade:SetToAlpha(0.25)
  fade:SetDuration(0.7)
  fade:SetSmoothing("IN_OUT")
  cg:Hide()
  f.craftGlow = cg
  UI.SetTooltip(f.craft, "Nächstes craften", "Stellt der Reihe nach her, wofür du alles Material hast. Ist das Berufsfenster zu, öffnet der erste Klick es, der zweite stellt her.")
  -- Herstellungs-Balken: zeigt, wie lange das aktuelle Herstellen noch dauert (falls der Spiel-Balken verdeckt ist)
  local cb = CreateFrame("Frame", nil, f)
  cb:SetSize(W - 32, 50)
  cb.glass = UI.Glass(cb, { radius = 25, edgeMode = "neon", edge = 0.45, body = UI.GLASS.card, sheen = 0.05, sheenH = 22, line = 0.3 })
  cb.bg = cb.glass.body
  cb.fill = CreateFrame("Frame", nil, cb)
  cb.fill:SetPoint("TOPLEFT")
  cb.fill:SetPoint("BOTTOMLEFT")
  cb.fill:SetWidth(50)
  cb.fill.bg = UI.Round(cb.fill, 25, "ARTWORK", 0)
  cb.fill.bg:SetGradient(UI.GRAD, 0.50) -- halbtransparent: weißer Text bleibt lesbar
  cb.fill.gloss = UI.Round(cb.fill, 24, "ARTWORK", 1, 1, 22)
  cb.fill.gloss:SetGradientV({ 1, 1, 1, 0.18 }, { 1, 1, 1, 0 })
  -- Symbol und Text auf eigener Ebene ÜBER der Füllung
  local top = CreateFrame("Frame", nil, cb)
  top:SetAllPoints()
  top:SetFrameLevel(cb.fill:GetFrameLevel() + 2)
  cb.icon = top:CreateTexture(nil, "OVERLAY")
  cb.icon:SetSize(30, 30)
  cb.icon:SetPoint("LEFT", 10, 0)
  if top.CreateMaskTexture then
    local mask = top:CreateMaskTexture()
    mask:SetTexture(UI.TEX.circle, "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE")
    mask:SetAllPoints(cb.icon)
    cb.icon:AddMaskTexture(mask)
  end
  cb.text = UI.Text(top, 12, "semibold", C.text, "OVERLAY")
  cb.text:SetPoint("TOPLEFT", 50, -8)
  cb.text:SetWidth(W - 160)
  cb.text:SetWordWrap(false)
  cb.time = UI.Text(top, 12, "bold", C.text, "OVERLAY")
  cb.time:SetPoint("TOPRIGHT", -20, -8)
  cb.time:SetJustifyH("RIGHT")
  -- zweite Zeile: wie lange dauert ALLES auf der Liste noch?
  cb.total = UI.Text(top, 12, "semibold", C.text, "OVERLAY")
  cb.total:SetPoint("BOTTOMLEFT", 50, 8)
  cb.total:SetWidth(W - 110)
  cb.total:SetWordWrap(false)
  cb:Hide()
  cb:SetScript("OnUpdate", function(self)
    if not self.endMs then return end
    local now = GetTime() * 1000
    local total = math.max(self.endMs - self.startMs, 1)
    local p = ns.Clamp((now - self.startMs) / total, 0, 1)
    self.fill:SetWidth(math.max((W - 32) * p, 50))
    local left = math.max(self.endMs - now, 0)
    self.time:SetText((string.format("%.1f s", left / 1000):gsub("%.", ",")))
    if self.restMs and self.restCrafts and self.restCrafts > 0 then
      self.total:SetText(string.format("Gesamt: %s%s · %d %s", self.estimated and "ca. " or "",
        Shop.Duration(left + self.restMs), self.restCrafts + 1, self.restCrafts + 1 == 1 and "Craft" or "Crafts"))
    else
      self.total:SetText("Letzter Craft auf der Liste")
    end
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
  r:SetSize(W - 32, PILL)
  r.shape = UI.PillShape(r, PILL, 0, false)
  r.bg = r.shape.body
  r.icon = UI.ItemIcon(r, 34)
  r.icon:SetPoint("LEFT", 4, 0)
  r.name = UI.Text(r, 13, "semibold", C.text)
  r.name:SetPoint("LEFT", r.icon, "RIGHT", 10, 8)
  r.name:SetWidth(W - 180)
  r.name:SetWordWrap(false)
  r.sub = UI.Text(r, 12, "regular", C.dim)
  r.sub:SetPoint("LEFT", r.icon, "RIGHT", 10, -9)
  r.sub:SetWidth(SUB_W)
  r.sub:SetWordWrap(false)
  r.toggle = UI.IconButton(r, "close", 28)
  r.toggle:SetPoint("RIGHT", -7, 0)
  r.toggle:SetScript("OnClick", function() Shop.ToggleSkip(r.id) end)
  UI.SetTooltip(r.toggle, function()
    if r.skipped then return "Zurückholen", "Material wieder auf die Einkaufsliste setzen." end
    return "Brauch ich nicht kaufen", "Nimmt das Material von der Liste (z. B. weil es ein anderer Charakter hat). Der Pfeil-Knopf holt es zurück."
  end)
  r.count = UI.Text(r, 15, "bold", C.gold)
  r.count:SetPoint("RIGHT", r.toggle, "LEFT", -8, 0)
  r:SetScript("OnEnter", function(self)
    GameTooltip:SetOwner(self, "ANCHOR_LEFT")
    pcall(GameTooltip.SetItemByID, GameTooltip, self.id)
    if self.maxUnit and not self.skipped then
      GameTooltip:AddLine(" ")
      GameTooltip:AddLine("Kaufen bis: " .. ns.Money(self.maxUnit) .. " pro Stück", 0.22, 1, 0.42)
      if self.overMax then
        GameTooltip:AddLine("Aktuell teurer (" .. ns.Money(self.unit) .. ") – lieber warten.", 1, 0.60, 0.16, true)
      else
        GameTooltip:AddLine("Bis zu diesem Preis lohnt sich dein Craft noch.", 0.75, 0.82, 0.80, true)
      end
    end
    GameTooltip:Show()
  end)
  r:SetScript("OnLeave", function() GameTooltip:Hide() end)
  r:SetScript("OnClick", function(self) if IsShiftKeyDown() then ns.LinkItem(self.id) end end)
  win.rows[i] = r
  return r
end

-- Zeile einfärben: offen (Glas), hier beim Händler (Neon), zu teuer (Orange-Rand), erledigt/übersprungen (zurückgenommen)
local function paintRow(r, kind)
  local e, b = r.shape.edge, r.shape.body
  if kind == "vendor" then
    e:SetGradient(UI.GRAD_EDGE, 0.60)
    b:SetGradientV(UI.GLASS.pillHi[1], UI.GLASS.pillHi[2])
  elseif kind == "over" then
    e:SetColor(C.hi, 0.42)
    b:SetGradientV(UI.GLASS.card[1], UI.GLASS.card[2], 0.85)
  elseif kind == "open" then
    e:SetGradientV({ 0.60, 1.00, 0.85, 0.18 }, { 0.20, 0.55, 0.65, 0.05 })
    b:SetGradientV(UI.GLASS.card[1], UI.GLASS.card[2], 0.85)
  else
    e:SetGradientV({ 0.60, 1.00, 0.85, 0.07 }, { 0.20, 0.55, 0.65, 0.02 })
    b:SetGradientV(UI.GLASS.card[1], UI.GLASS.card[2], 0.38)
  end
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
  r:SetSize(W - 32, CROW - 4)
  r.icon = UI.ItemIcon(r, 28)
  r.icon:SetPoint("LEFT", 6, 0)
  r.status = UI.Text(r, 12, "semibold", C.green)
  r.status:SetPoint("RIGHT", -12, 0)
  r.status:SetJustifyH("RIGHT")
  r.dot = r:CreateTexture(nil, "ARTWORK")
  r.dot:SetTexture(UI.TEX.circle)
  r.dot:SetSize(8, 8)
  r.dot:SetPoint("RIGHT", r.status, "LEFT", -7, 0)
  r.name = UI.Text(r, 13, "semibold", C.text)
  r.name:SetPoint("LEFT", r.icon, "RIGHT", 10, 0)
  r.name:SetWidth(W - 214)
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
    win.summary:SetText("Die Craft-Liste ist leer. Im Craft-Planer auf |cff39ff6bListe erstellen|r klicken.")
  elseif open == 0 then
    win.summary:SetText("|cff39ff6bAlles da!|r Hol deine Post aus dem Briefkasten und klick auf |cff39ff6bNächstes craften|r.")
  elseif #plan > 0 then
    win.summary:SetText(string.format("Dieser Händler hat |cff39ff6b%d %s|r für dich. Ein Klick auf |cff39ff6bBeim Händler kaufen|r holt alles für %s.",
      #plan, #plan == 1 and "Material" or "Materialien", ns.Money(planCost)))
  else
    win.summary:SetText(string.format("Noch |cff39ff6b%d %s|r zu kaufen, ca. %s. Gekauftes verschwindet sofort.", open, open == 1 and "Material" or "Materialien", ns.Money(cost)))
  end
  if Shop.signal then
    win.summary:SetText("|cff61eb8fFertig!|r Als Nächstes: |cff39ff6b" .. Shop.signal .. "|r – klick auf |cff39ff6bNächstes craften|r.")
  end
  local y = 64 + math.ceil(win.summary:GetStringHeight()) + 16

  -- Was wird hergestellt?
  local crafts = Shop.Crafts()
  local shownC = 0
  if #crafts > 0 then
    placeHead(win.craftHead, y)
    y = y + 22
    for i, c in ipairs(crafts) do
      if i > 5 then break end
      shownC = i
      local r = craftRow(i)
      r.id = c.recipe.out
      r.icon:SetItem(c.recipe.out)
      local item = ns.Item(c.recipe.out)
      if c.intermediate then
        -- günstiger selbst hergestellt als gekauft (eigenes Rezept) -> kommt vor den eigentlichen Crafts
        UI.FitText(r.name, string.format("|cff26f2d9%d×|r %s |cff93a39d· selbst|r", c.n * (c.recipe.qty or 1), item.name or c.recipe.name), W - 214)
      else
        UI.FitText(r.name, string.format("|cff39ff6b%d×|r %s", c.n * (c.recipe.qty or 1), item.name or c.recipe.name), W - 214)
      end
      local st = STATUS[c.status]
      r.status:SetText(st[1])
      r.status:SetTextColor(st[2][1], st[2][2], st[2][3], 1)
      r.dot:SetVertexColor(st[2][1], st[2][2], st[2][3], 1)
      r:ClearAllPoints()
      r:SetPoint("TOPLEFT", win, "TOPLEFT", 16, -y)
      r:Show()
      y = y + CROW
    end
    if #crafts > 5 then
      win.more:SetText(string.format("+ %d weitere im Craft-Planer", #crafts - 5))
      win.more:ClearAllPoints()
      win.more:SetPoint("TOPLEFT", win, "TOPLEFT", 60, -y)
      win.more:Show()
      y = y + 20
    else
      win.more:Hide()
    end
    y = y + 12
  else
    hideHead(win.craftHead)
    win.more:Hide()
  end
  for i = shownC + 1, #win.crafts do win.crafts[i]:Hide() end

  -- Material
  if #list > 0 then
    placeHead(win.matHead, y)
    y = y + 24
  else
    hideHead(win.matHead)
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
    UI.FitText(r.name, item.name, W - 180)
    r.skipped = e.skipped
    r.unit, r.maxUnit, r.overMax = e.unit, e.maxUnit, e.overMax
    r.toggle.icon:SetTexture(UI.Icon(e.skipped and "refresh" or "close"))
    r.toggle:SetShown(e.missing > 0 or e.skipped == true)
    if e.skipped then
      paintRow(r, "done")
      r.name:SetTextColor(C.dim[1], C.dim[2], C.dim[3], 1)
      r.count:SetText("")
      r.sub:SetText(string.format("%d / %d · übersprungen", e.have, e.need))
    elseif e.missing > 0 then
      local here = vendorHas[e.id]
      paintRow(r, here and "vendor" or (e.overMax and "over") or "open")
      r.name:SetTextColor(C.text[1], C.text[2], C.text[3], 1)
      r.count:SetText(e.missing .. "×")
      local cc = (e.overMax and not here) and C.hi or C.gold
      r.count:SetTextColor(cc[1], cc[2], cc[3], 1)
      local have = string.format("%d / %d", e.have, e.need)
      local limit = e.maxUnit and (" · kaufen bis " .. ns.Money(e.maxUnit)) or ""
      if e.overMax and not here then
        -- aktueller Preis über dem Kaufen-bis-Preis: lieber warten
        fitFirst(r.sub, SUB_W, { have .. " · |cffff9929zu teuer – warten|r" .. limit, have .. " · |cffff9929zu teuer – warten|r" })
      else
        local where = here and " |cff39ff6bhier beim Händler|r" or (e.where == "HAENDLER" and " beim Händler" or " im AH")
        local price = e.unit and (ns.Money(e.unit) .. where) or "kein Preis"
        fitFirst(r.sub, SUB_W, { have .. " · " .. price .. limit, have .. " · " .. price })
      end
    else
      paintRow(r, "done")
      r.name:SetTextColor(C.dim[1], C.dim[2], C.dim[3], 1)
      r.count:SetText("|A:common-icon-checkmark:16:16|a")
      r.sub:SetText(e.need .. " / " .. e.need .. " · erledigt")
    end
    r:ClearAllPoints()
    r:SetPoint("TOPLEFT", win, "TOPLEFT", 16, -y)
    r:Show()
    y = y + ROW
  end
  for i = shown + 1, #win.rows do win.rows[i]:Hide() end
  -- Herstellungs-Balken über den Knöpfen
  if win.cast.endMs then
    win.cast:ClearAllPoints()
    win.cast:SetPoint("TOPLEFT", win, "TOPLEFT", 16, -(y + 6))
    win.cast:Show()
    y = y + 62
  else
    win.cast:Hide()
  end
  win:SetHeight(math.max(y + 68, 180))
  if #plan > 0 then
    win.search.mode = "vendor"
    win.search:SetLabel("Beim Händler kaufen")
    win.search:SetEnabled(true)
  else
    win.search.mode = "ah"
    win.search:SetLabel("Angebote zeigen")
    win.search:SetEnabled(open > 0 and M.ahOpen == true)
  end
  win.craft:SetEnabled(#(ns.char.queue or {}) > 0)
  if Shop.signal then
    win.craftGlow:Show()
    if ns.settings.animations ~= false then win.craftGlow.anim:Play() else win.craftGlow.anim:Stop() end
  else
    win.craftGlow.anim:Stop()
    win.craftGlow:Hide()
  end
end

function Shop.Show()
  win = win or create()
  win:Show()
  Shop.Refresh()
end

function Shop.Toggle()
  if win and win:IsShown() then win:Hide() else Shop.Show() end
end

for _, msg in ipairs({ "SHOP_CHANGED", "AH_STATE", "PRICES_UPDATED", "ITEMS_UPDATED", "RECIPES_SCANNED", "MERCHANT_SCANNED",
  "DEMAND_UPDATED", "HISTORY_UPDATED", "DEPOSITS_LEARNED" }) do
  ns.Listen(msg, function()
    if not (win and win:IsShown()) and msg ~= "AH_STATE" then return end -- zu: nichts rechnen (Öffnen zeichnet neu)
    ns.Debounce("shopwin", (M.ahOpen and 1) or 0.2, Shop.Refresh)
  end)
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

----------------------------------------------------------------------------
-- "Nächste Sorte ist dran": Eine Sorte ist fertig hergestellt, für die nächste hast du alles Material.
-- Blizzard erlaubt pro Klick nur einen Herstell-Auftrag -> Knopf leuchtet + kurzer Ton, damit du weißt: klicken.
----------------------------------------------------------------------------
function Shop.ClearSignal()
  if not Shop.signal then return end
  Shop.signal = nil
  if win and win:IsShown() then Shop.Refresh() end
end

function Shop.CheckNext()
  local ok, casting = pcall(UnitCastingInfo, "player")
  if ok and casting then return end -- es läuft noch ein Craft (gleiche Sorte)
  for _, c in ipairs(Shop.Crafts()) do
    if c.status == "bereit" then
      local item = ns.Item(c.recipe.out)
      Shop.signal = c.n * (c.recipe.qty or 1) .. "× " .. (item.name or c.recipe.name)
      if ns.settings.craftSound ~= false and PlaySound and SOUNDKIT and SOUNDKIT.MAP_PING then pcall(PlaySound, SOUNDKIT.MAP_PING) end
      if win and win:IsShown() then Shop.Refresh() end
      return true
    end
  end
  Shop.ClearSignal()
end

-- Herstell-Dauer je Rezept lernen (Name = Zaubername im Spiel)
function Shop.LearnCastTime(name, ms)
  if not name or type(ms) ~= "number" or ms <= 0 or ms > 60000 then return end
  ns.db.castTimes = ns.db.castTimes or {}
  ns.db.castTimes[name] = math.floor(ms)
end

-- "2:35 Min." bzw. "41 s"
function Shop.Duration(ms)
  local sec = math.floor(ms / 1000 + 0.5)
  if sec < 60 then return sec .. " s" end
  if sec < 3600 then return string.format("%d:%02d Min.", math.floor(sec / 60), sec % 60) end
  return string.format("%d:%02d Std.", math.floor(sec / 3600), math.floor(sec % 3600 / 60))
end

-- Nach dem gerade laufenden Craft: wie viele Crafts (ganze Liste inkl. Zwischenprodukte) und wie lange noch?
-- Dauer unbekannter Rezepte = Dauer des aktuellen Crafts (dann "ca.").
-- Rückgabe: leftOfThis, restMs, restCrafts, estimated
function Shop.RemainingAfter(name, curMs)
  local times = ns.db.castTimes or {}
  local leftOfThis, restMs, restCrafts, estimated = nil, 0, 0, false
  for _, e in ipairs(Shop.CraftOrder()) do
    local r = e.recipe
    local n = e.n
    if r.name == name and not leftOfThis then
      leftOfThis = n
      n = n - 1 -- der laufende Craft zählt nicht mit
    end
    if n > 0 then
      local t = times[r.name]
      if not t then t, estimated = curMs, true end
      restMs = restMs + t * n
      restCrafts = restCrafts + n
    end
  end
  return leftOfThis, restMs, restCrafts, estimated
end

-- Herstellungs-Balken: nur für Berufs-Zauber des Spielers (UnitCastingInfo: isTradeskill)
local function castUpdate(_, unit)
  if unit ~= "player" or not win then return end
  local ok, name, _, tex, startMs, endMs, isTradeskill = pcall(UnitCastingInfo, "player")
  local cb = win.cast
  if ok and name and isTradeskill and type(startMs) == "number" and type(endMs) == "number" then
    cb.startMs, cb.endMs = startMs, endMs
    cb.icon:SetTexture(tex)
    Shop.crafting = true
    Shop.signal = nil
    Shop.LearnCastTime(name, endMs - startMs)
    -- wie viele davon stehen noch auf der Liste, und wie lange dauert der Rest?
    local left, restMs, restCrafts, estimated = Shop.RemainingAfter(name, endMs - startMs)
    cb.restMs, cb.restCrafts, cb.estimated = restMs, restCrafts, estimated
    UI.FitText(cb.text, name .. (left and ("  ·  noch " .. left) or ""), W - 160)
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
    -- Sorte fertig? Kurz warten: beim Mehrfach-Herstellen startet der nächste Craft sofort wieder
    if Shop.crafting then
      Shop.crafting = false
      C_Timer.After(1.5, function() if not Shop.crafting then Shop.CheckNext() end end)
    end
    if win:IsShown() then Shop.Refresh() end
  end)
end

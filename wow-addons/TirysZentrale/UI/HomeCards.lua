-- Tiry's Zentrale – Startseiten-Karten: Sparziel (Gold-Ziel) und Unterwegs-Gold (Gebiet + LevelPilot-Route)
-- Jede Karte: Build(parent, width) baut einmal, :Fill() setzt Daten und liefert die Höhe (0 = ausgeblendet).
local _, ns = ...
local UI = ns.UI
local C = UI.C

local HC = {}
UI.HomeCards = HC

local PAD = 22

-- Glas-Pille für Kennzahlen/Aktionen (kein Kasten): Rand-Verlauf, Glaskörper, Hover-Leuchten
local function actionPill(parent, w, h)
  local b = UI.SafeButton(parent)
  b:SetSize(w, h)
  local shape = UI.PillShape(b, h, 0, true)
  b.edge, b.bg, b.gloss = shape.edge, shape.body, shape.gloss
  b.gloss:SetAlpha(0.35)
  local function paint(hover)
    if hover then
      b.edge:SetGradient(UI.GRAD_EDGE, 0.75)
      b.bg:SetGradientV(UI.GLASS.pillHi[1], UI.GLASS.pillHi[2], 1)
    else
      b.edge:SetGradientV({ 0.60, 1.00, 0.85, 0.24 }, { 0.20, 0.55, 0.65, 0.07 })
      b.bg:SetGradientV(UI.GLASS.pill[1], UI.GLASS.pill[2], 0.92)
    end
  end
  paint(false)
  b:HookScript("OnEnter", function() paint(true) end)
  b:HookScript("OnLeave", function() paint(false) GameTooltip:Hide() end)
  return b
end

-- Fortschrittsbalken: Spur, "unterwegs"-Anteil (zart), Hauptverlauf mit Leuchtspitze
local function progressBar(parent, w, h)
  local bar = CreateFrame("Frame", nil, parent)
  bar:SetSize(w, h)
  bar.track = UI.Round(bar, h / 2, "ARTWORK", 0)
  bar.track:SetGradientV({ 0.05, 0.06, 0.065, 1 }, { 0.10, 0.12, 0.12, 1 })
  bar.way = CreateFrame("Frame", nil, bar)
  bar.way:SetPoint("TOPLEFT")
  bar.way:SetHeight(h)
  bar.way.bg = UI.Round(bar.way, h / 2, "ARTWORK", 1)
  bar.way.bg:SetGradient({ C.teal, C.aqua }, 0.30)
  bar.fill = CreateFrame("Frame", nil, bar)
  bar.fill:SetPoint("TOPLEFT")
  bar.fill:SetHeight(h)
  bar.fill.bg = UI.Round(bar.fill, h / 2, "OVERLAY", 0)
  bar.fill.bg:SetGradient(UI.GRAD_FRESH, 1)
  bar.fill.gloss = UI.Round(bar.fill, h / 2 - 1, "OVERLAY", 1, 1, math.floor(h / 2))
  bar.fill.gloss:SetGradientV({ 1, 1, 1, 0.30 }, { 1, 1, 1, 0 })
  bar.tip = UI.Glow(bar.fill, C.amber, h * 4, 0.55, "OVERLAY")
  bar.tip:SetPoint("CENTER", bar.fill, "RIGHT", -3, 0)
  function bar:Set(frac, wayFrac)
    frac = ns.Clamp(frac or 0, 0, 1)
    wayFrac = ns.Clamp(wayFrac or frac, frac, 1)
    self.fill:SetWidth(math.max(w * frac, h))
    self.way:SetWidth(math.max(w * wayFrac, h))
    self.way:SetShown(wayFrac > frac + 0.005)
    self.tip:SetAlpha(frac > 0 and 0.55 or 0)
  end
  return bar
end

----------------------------------------------------------------------------
-- Sparziel
----------------------------------------------------------------------------
local BOOST_H, BOOST_GAP = 52, 10
local BOOST_ICON = { mail = "receipt", bags = "bag", vendor = "coins", craft = "flask", farm = "compass" }

function HC.Goal(parent, width)
  local GZ = ns.Goal
  local card = UI.Card(parent, 26, C.card)
  card:SetWidth(width)
  card.halo = UI.Glow(card, C.teal, 360, 0.10, "BORDER")
  card.halo:SetHeight(130)
  card.halo:SetPoint("CENTER", card, "TOPRIGHT", -200, -70)
  card.orb = UI.Orb(card, 56, { glyph = "coins", active = true })
  card.orb:SetPoint("TOPLEFT", PAD, -20)
  card.title = UI.Text(card, 18, "bold", C.text)
  card.title:SetPoint("TOPLEFT", card.orb, "TOPRIGHT", 16, -4)
  card.chip = UI.Chip(card, "", C.teal)
  card.chip:SetPoint("LEFT", card.title, "RIGHT", 10, 0)
  card.note = UI.Text(card, 12, "regular", C.muted)
  card.note:SetPoint("TOPLEFT", card.title, "BOTTOMLEFT", 0, -5)
  card.note:SetWordWrap(false)
  -- rechts: Betrag (frei eintippen oder ±) und anderes Ziel
  local function step(v) return v >= 1000 * 10000 and 100 * 10000 or (v >= 200 * 10000 and 25 * 10000 or 10 * 10000) end
  card.amount = UI.Stepper(card, "Ziel", 236, function() local g = GZ.Get() return g and g.amount or 0 end,
    function(v) GZ.SetAmount(v) end, step, 10000, 1000000 * 10000, function(v) return ns.Money(v) end, GZ.ParseAmount,
    "Betrag eintippen: \"250\" = 250 Gold, auch \"1g 50s\". Enter übernimmt.")
  card.amount:SetPoint("TOPRIGHT", -PAD, -20)
  card.other = UI.Button(card, "Anderes Ziel", "soft", 150, 30, "refresh")
  card.other:SetPoint("TOPRIGHT", card.amount, "BOTTOMRIGHT", 0, -8)
  card.other:SetScript("OnClick", function() GZ.Cycle() end)
  UI.SetTooltip(card.other, "Anderes Ziel", "Schaltet durch: Reiten lernen, schnelles Reiten, Klassen-Fähigkeiten, eigenes Ziel.")
  card.hide = UI.IconButton(card, "close", 26, "Sparziel ausblenden")
  card.hide:SetPoint("RIGHT", card.other, "LEFT", -8, 0)
  card.hide:SetScript("OnClick", function() GZ.Clear() end)
  -- Zahlen + Balken
  card.value = UI.Text(card, 22, "bold", C.text)
  card.value:SetPoint("TOPLEFT", PAD, -100)
  card.pct = UI.Text(card, 22, "bold", C.text)
  card.pct:SetPoint("TOPRIGHT", -PAD, -100)
  card.bar = progressBar(card, width - 2 * PAD, 14)
  card.bar:SetPoint("TOPLEFT", PAD, -136)
  card.parts = UI.Text(card, 12, "regular", C.muted)
  card.parts:SetPoint("TOPLEFT", PAD, -160)
  card.eta = UI.Text(card, 12, "semibold", C.teal)
  card.eta:SetPoint("TOPRIGHT", -PAD, -160)
  -- Schneller ans Ziel
  card.boostTitle = UI.Text(card, 13, "bold", C.text)
  card.boostTitle:SetPoint("TOPLEFT", PAD + 14, -192)
  card.boostTitle:SetText("Schneller ans Ziel")
  card.boostDot = card:CreateTexture(nil, "ARTWORK")
  card.boostDot:SetTexture(UI.TEX.circle)
  card.boostDot:SetSize(7, 7)
  card.boostDot:SetPoint("RIGHT", card.boostTitle, "LEFT", -7, 0)
  UI.SetGradV(card.boostDot, C.amber, C.teal, 1)
  local bw = math.floor((width - 2 * PAD - 2 * BOOST_GAP) / 3)
  card.boosts = {}
  for i = 1, 3 do
    local b = actionPill(card, bw, BOOST_H)
    b:SetPoint("TOPLEFT", PAD + (i - 1) * (bw + BOOST_GAP), -214)
    b.dot = UI.Orb(b, 36, { glyph = "coins", active = true })
    b.dot:SetPoint("LEFT", 8, 0)
    b.title = UI.Text(b, 12, "semibold", C.text)
    b.title:SetPoint("TOPLEFT", b.dot, "TOPRIGHT", 10, -1)
    b.title:SetWordWrap(false)
    b.gold = UI.Text(b, 13, "bold", C.gold)
    b.gold:SetPoint("TOPLEFT", b.title, "BOTTOMLEFT", 0, -3)
    b:SetScript("OnClick", function(btn) if btn.page then UI.Show(btn.page) end end)
    b:HookScript("OnEnter", function(btn)
      if not btn.info then return end
      GameTooltip:SetOwner(btn, "ANCHOR_TOP")
      GameTooltip:SetText(btn.info.title, 0.22, 1, 0.42)
      GameTooltip:AddLine(btn.info.text, 0.86, 0.92, 0.89, true)
      GameTooltip:AddLine("Klick: " .. (btn.info.button or "öffnen"), 0.47, 1, 0.58)
      GameTooltip:Show()
    end)
    card.boosts[i] = b
  end
  -- ausgeblendet: schmale Pille zum Zurückholen
  card.off = actionPill(parent, width, 48)
  card.off.text = UI.Text(card.off, 13, "semibold", C.muted)
  card.off.text:SetPoint("LEFT", 24, 0)
  card.off.text:SetText("Kein Sparziel aktiv – Klick wählt eins (z. B. Reiten lernen).")
  card.off:SetScript("OnClick", function() local p = GZ.Suggest() GZ.Set(p.key, p.amount) end)
  card.off:Hide()

  -- Daten setzen; liefert Höhe und den Frame, der angezeigt wird
  function card:Fill()
    local g = GZ.Get()
    if not g then
      self:Hide()
      return 48, self.off
    end
    self.off:Hide()
    local st = GZ.Status(g)
    local done = st.have >= g.amount
    self.title:SetText(g.name)
    self.chip:SetShown(done or g.auto)
    if done then self.chip:Set("Geschafft!", C.amber, true)
    elseif g.auto then self.chip:Set("Vorschlag", C.teal) end
    UI.FitText(self.note, g.note or "", width - PAD - 56 - 16 - 300)
    self.amount:Refresh()
    self.value:SetText(ns.Money(st.total) .. "|cff9aa8a2  von  |r" .. ns.Money(g.amount))
    self.pct:SetText(UI.GradText(math.floor(st.pct * 100 + 0.0001) .. " %", C.amber, C.teal))
    self.bar:Set(g.amount > 0 and st.have / g.amount or 0, st.pct)
    local parts = "In der Tasche " .. ns.Money(st.have)
    if st.mail > 0 then parts = parts .. "  ·  Post " .. ns.Money(st.mail) end
    if st.auctions > 0 then parts = parts .. "  ·  im AH ca. " .. ns.Money(st.auctions) end
    if st.missing > 0 then parts = parts .. "  ·  fehlt " .. ns.Money(st.missing) end
    if st.allChars and st.allChars > st.have then parts = parts .. "  ·  alle Charaktere " .. ns.Money(st.allChars) end
    UI.FitText(self.parts, parts, width - 2 * PAD - 260)
    local rate = GZ.Rate(7)
    local eta = GZ.Eta(st.missing, rate)
    if done then
      self.eta:SetText("Ab zum Trainer!")
    elseif eta then
      self.eta:SetText(string.format("ca. %d %s  ·  Ø %s/Tag", eta, ns.Plural(eta, "Spieltag", "Spieltage"), ns.Money(rate)))
    elseif rate then
      self.eta:SetText("Zuletzt mehr ausgegeben als verdient")
    else
      self.eta:SetText("Prognose ab dem ersten Spieltag")
    end
    -- Schneller ans Ziel
    local boosts = done and {} or GZ.Boosts()
    for i, b in ipairs(self.boosts) do
      local e = boosts[i]
      if e then
        b.info, b.page = e, e.page
        b.dot:SetGlyph(BOOST_ICON[e.key] or "star")
        UI.FitText(b.title, e.title, b:GetWidth() - 70)
        b.gold:SetText((e.perHour and "bis " or "+") .. ns.Money(e.gold) .. (e.perHour and "|cff9aa8a2 / Std.|r" or ""))
        b:Show()
      else
        b:Hide()
      end
    end
    local hasBoost = #boosts > 0
    self.boostTitle:SetShown(hasBoost)
    self.boostDot:SetShown(hasBoost)
    local h = hasBoost and (214 + BOOST_H + 22) or 190
    self:SetHeight(h)
    self:Show()
    return h, self
  end
  return card
end

----------------------------------------------------------------------------
-- Unterwegs-Gold
----------------------------------------------------------------------------
local GROUP_H, GROUP_GAP, ROUTE_H = 56, 10, 40

function HC.Zone(parent, width)
  local Z = ns.ZoneGold
  local card = UI.Card(parent, 26, C.card)
  card:SetWidth(width)
  card.halo = UI.Glow(card, C.aqua, 340, 0.10, "BORDER")
  card.halo:SetHeight(120)
  card.halo:SetPoint("CENTER", card, "TOPLEFT", 200, -60)
  card.orb = UI.Orb(card, 56, { glyph = "compass", active = true })
  card.orb:SetPoint("TOPLEFT", PAD, -20)
  card.title = UI.Text(card, 18, "bold", C.text)
  card.title:SetPoint("TOPLEFT", card.orb, "TOPRIGHT", 16, -4)
  card.sub = UI.Text(card, 12, "regular", C.muted)
  card.sub:SetPoint("TOPLEFT", card.title, "BOTTOMLEFT", 0, -5)
  card.sub:SetWordWrap(false)
  card.go = UI.Button(card, "Hinführen", "primary", 170, 38, "pin")
  card.go:SetPoint("TOPRIGHT", -PAD, -28)
  card.go:SetScript("OnClick", function(b) if b.spot then ns.Maps.Show(b.spot, b.what) end end)
  UI.SetTooltip(card.go, "Hinführen", "Setzt einen Wegpunkt zur ergiebigsten Stelle für das wertvollste Material in diesem Gebiet.")
  local gw = math.floor((width - 2 * PAD - 3 * GROUP_GAP) / 4)
  card.groups = {}
  for i = 1, 4 do
    local b = actionPill(card, gw, GROUP_H)
    b:SetPoint("TOPLEFT", PAD + (i - 1) * (gw + GROUP_GAP), -96)
    b.icon = UI.ItemIcon(b, 40)
    b.icon:SetPoint("LEFT", 8, 0)
    b.name = UI.Text(b, 12, "semibold", C.text)
    b.name:SetPoint("TOPLEFT", b.icon, "TOPRIGHT", 10, -1)
    b.name:SetWordWrap(false)
    b.info = UI.Text(b, 11, "regular", C.dim)
    b.info:SetPoint("TOPLEFT", b.name, "BOTTOMLEFT", 0, -3)
    b.info:SetWordWrap(false)
    b:SetScript("OnClick", function(btn)
      if IsShiftKeyDown() and btn.id then ns.LinkItem(btn.id) return end
      if btn.g and btn.g.spot then ns.Maps.Show(btn.g.spot, btn.g.label) end
    end)
    b:HookScript("OnEnter", function(btn)
      local g = btn.g
      if not g then return end
      GameTooltip:SetOwner(btn, "ANCHOR_TOP")
      GameTooltip:SetText(g.label .. (g.lo and string.format("  (Stufe %d–%d)", g.lo, g.hi or g.lo) or ""), 0.22, 1, 0.42)
      for k, it in ipairs(g.items) do
        if k > 6 then break end
        GameTooltip:AddDoubleLine(ns.Item(it.id).name, ns.Money(it.value) .. (it.src == "vendor" and " |cff9aa8a2(Händler)|r" or ""),
          0.86, 0.92, 0.89, 1, 1, 1)
      end
      GameTooltip:AddLine(" ")
      GameTooltip:AddLine("Wert je Stück: AH nach Gebühr, sonst Händler. Klick = Wegpunkt zur besten Stelle.", 0.47, 1, 0.58, true)
      GameTooltip:Show()
    end)
    card.groups[i] = b
  end
  card.missed = UI.Text(card, 12, "regular", C.dim)
  card.routeTitle = UI.Text(card, 13, "bold", C.text)
  card.routeTitle:SetText("Als Nächstes auf deiner Route")
  card.routeDot = card:CreateTexture(nil, "ARTWORK")
  card.routeDot:SetTexture(UI.TEX.circle)
  card.routeDot:SetSize(7, 7)
  card.routeDot:SetPoint("RIGHT", card.routeTitle, "LEFT", -7, 0)
  UI.SetGradV(card.routeDot, C.teal, C.aqua, 1)
  card.routes = {}
  for i = 1, 2 do
    local r = actionPill(card, width - 2 * PAD, ROUTE_H)
    r.chip = UI.Chip(r, "", C.teal)
    r.chip:SetPoint("LEFT", 10, 0)
    r.text = UI.Text(r, 12, "regular", C.muted)
    r.text:SetWordWrap(false)
    r:SetScript("OnClick", function(btn)
      local g = btn.info and btn.info.groups[1]
      if g and g.spot then ns.Maps.Show(g.spot, g.label .. " · " .. btn.info.name) end
    end)
    r:HookScript("OnEnter", function(btn)
      if not btn.info then return end
      GameTooltip:SetOwner(btn, "ANCHOR_TOP")
      GameTooltip:SetText(btn.info.name, 0.22, 1, 0.42)
      for _, g in ipairs(btn.info.groups) do
        GameTooltip:AddDoubleLine(g.label .. ": " .. ns.Item(g.items[1].id).name, ns.Money(g.items[1].value), 0.86, 0.92, 0.89, 1, 1, 1)
      end
      GameTooltip:AddLine("Klick = Wegpunkt zur besten Stelle dort.", 0.47, 1, 0.58, true)
      GameTooltip:Show()
    end)
    card.routes[i] = r
  end

  function card:Fill()
    local ov = Z.Overview()
    local here = ov.here
    local hasHere = here and #here.groups > 0
    if not hasHere and #ov.next == 0 then self:Hide() return 0, self end
    local zoneName = here and here.name or (ov.hereMap and ns.Maps.ZoneName(ov.hereMap)) or "hier"
    self.title:SetText("Unterwegs-Gold: " .. zoneName)
    local y
    if hasHere then
      UI.FitText(self.sub, "Das sammelst du hier nebenbei – Wert je Stück, nur für deine Berufe.", width - PAD - 56 - 16 - 200)
      local top = here.groups[1]
      self.go.spot, self.go.what = top.spot, top.label .. " · " .. here.name
      self.go:Show()
      for i, b in ipairs(self.groups) do
        local g = here.groups[i]
        if g then
          local it = g.items[1]
          b.g, b.id = g, it.id
          b.icon:SetItem(it.id)
          UI.FitText(b.name, ns.Item(it.id).name, b:GetWidth() - 70)
          b.info:SetText(g.label .. "  ·  " .. ns.Money(it.value))
          b:Show()
        else
          b.g, b.id = nil, nil
          b:Hide()
        end
      end
      y = 96 + GROUP_H + 14
    else
      UI.FitText(self.sub, "Hier gibt es nichts für deine Berufe zu sammeln – so sieht deine Route aus:", width - PAD - 56 - 16 - 40)
      self.go:Hide()
      for _, b in ipairs(self.groups) do b.g = nil b:Hide() end
      y = 92
    end
    -- Beruf fehlt: zeigen, was er hier bringen würde
    local m = here and here.missed
    if m then
      self.missed:ClearAllPoints()
      self.missed:SetPoint("TOPLEFT", PAD + 4, -y)
      UI.FitText(self.missed, string.format("Mit %s hier zusätzlich: %s %s je Stück.",
        m.profName or m.label, ns.Item(m.items[1].id).name, ns.Money(m.items[1].value)), width - 2 * PAD)
      self.missed:Show()
      y = y + 24
    else
      self.missed:Hide()
    end
    -- nächste Gebiete der LevelPilot-Route
    if #ov.next > 0 then
      y = y + 6
      self.routeTitle:ClearAllPoints()
      self.routeTitle:SetPoint("TOPLEFT", PAD + 14, -y)
      self.routeTitle:Show()
      self.routeDot:Show()
      y = y + 24
      for i, r in ipairs(self.routes) do
        local info = ov.next[i]
        if info then
          r.info = info
          r.chip:Set(info.name .. (info.routeLevel and ("  ·  ab " .. info.routeLevel) or ""), C.teal)
          r.text:ClearAllPoints()
          r.text:SetPoint("LEFT", r.chip, "RIGHT", 12, 0)
          UI.FitText(r.text, Z.Line(info, 3) or "", r:GetWidth() - r.chip:GetWidth() - 40)
          r:ClearAllPoints()
          r:SetPoint("TOPLEFT", PAD, -y)
          r:Show()
          y = y + ROUTE_H + 8
        else
          r.info = nil
          r:Hide()
        end
      end
    else
      self.routeTitle:Hide()
      self.routeDot:Hide()
      for _, r in ipairs(self.routes) do r:Hide() end
    end
    local h = y + 14
    self:SetHeight(h)
    self:Show()
    return h, self
  end
  return card
end

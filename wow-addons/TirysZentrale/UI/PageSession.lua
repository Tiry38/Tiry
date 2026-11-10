-- Tiry's Zentrale – Ansicht "Farm-Session": Start/Stopp, Gold pro Stunde live, frühere Sessions
local _, ns = ...
local UI = ns.UI
local C = UI.C
local S = ns.Session

local page = {
  title = "Farm-Session",
  subtitle = "Start drücken, farmen, Stopp drücken – du siehst sofort, was dir eine Stunde bringt.",
  icon = "bolt", label = "Farm-Session", order = 22,
}

local function duration(sec)
  sec = math.floor(sec or 0)
  local h, m = math.floor(sec / 3600), math.floor((sec % 3600) / 60)
  if h > 0 then return string.format("%d Std. %02d Min.", h, m) end
  return string.format("%d Min. %02d Sek.", m, sec % 60)
end

local function stat(parent, w, label, accent)
  return UI.StatPill(parent, w, label, accent)
end

function page.build(self, content, width)
  local st = UI.Stack(content)
  local card = UI.Card(content, 26, nil, { hero = true })
  card:SetSize(width, 214)
  card.shine = UI.Glow(card, C.amber, 460, 0.16, "BORDER")
  card.shine:SetHeight(190)
  card.shine:SetPoint("CENTER", card, "LEFT", 230, 0)
  UI.Drift(card.shine, 200, 0, 8, 0.3, 0.12)
  card.state = UI.Text(card, 18, "bold", C.text)
  card.state:SetPoint("TOPLEFT", 24, -22)
  card.zone = UI.Text(card, 12, "regular", C.muted)
  card.zone:SetPoint("TOPLEFT", card.state, "BOTTOMLEFT", 0, -6)
  card.btn = UI.Button(card, "Session starten", "primary", 220, 40, "bolt")
  card.btn:SetPoint("TOPRIGHT", -24, -22)
  card.btn:SetScript("OnClick", function()
    if S.Current() then S.Stop() else S.Start() end
    page.refresh(self)
  end)
  local cw = math.floor((width - 48 - 36) / 4)
  card.stats = {
    stat(card, cw, "Gold bekommen", C.amber), stat(card, cw, "Beute-Wert", C.teal), stat(card, cw, "Zusammen", C.aqua),
    stat(card, cw, "Pro Stunde", C.amber),
  }
  for i, f in ipairs(card.stats) do f:SetPoint("TOPLEFT", 24 + (i - 1) * (cw + 12), -92) end
  card.stats[4].value:SetTextColor(C.gold[1], C.gold[2], C.gold[3], 1)
  card.best = UI.Para(card, 12, C.muted, width - 48)
  card.best:SetPoint("TOPLEFT", 24, -168)
  self.card = card
  st:Add(card, 214, 18)

  st:Para("So wird gerechnet: Gold, das du beim Farmen bekommst, plus der Wert deiner neuen Beute (bester Verkaufsweg: AH oder Händler). "
    .. "Was du beim Händler verkaufst oder aus der Post holst, zählt nicht extra – sonst wäre es doppelt. Reparaturen werden abgezogen.", 12, C.dim, 16)

  st:Title("Frühere Sessions", 17, C.text, 4)
  self.histTop = st.y
  self.rows = {}
  self.empty = UI.Para(content, 12, C.muted, width)
  self.empty:SetText("Noch keine Session gespeichert. Drück oben auf \"Session starten\", farm eine Runde und dann auf \"Stopp\".")
  -- Live-Anzeige: einmal pro Sekunde, nur solange die Ansicht offen ist
  local acc = 0
  self.frame:SetScript("OnUpdate", function(_, dt)
    acc = acc + dt
    if acc >= 1 then
      acc = 0
      if S.Current() then page.refreshLive(self) end
    end
  end)
end

local function histRow(self, i, width)
  local r = self.rows[i]
  if r then return r end
  r = CreateFrame("Frame", nil, self.frame.content)
  r:SetSize(width, 44)
  local shape = UI.PillShape(r, 44, 0, false)
  shape.edge:SetGradientV({ 0.60, 1.00, 0.85, 0.16 }, { 0.20, 0.55, 0.65, 0.05 })
  shape.body:SetGradientV(UI.GLASS.card[1], UI.GLASS.card[2], 0.8)
  r.bg = shape.body
  r.dot = r:CreateTexture(nil, "ARTWORK")
  r.dot:SetTexture(UI.TEX.circle)
  r.dot:SetSize(8, 8)
  r.dot:SetPoint("LEFT", 18, 0)
  UI.SetGradV(r.dot, C.amber, C.teal, 1)
  r.title = UI.Text(r, 13, "semibold", C.text)
  r.title:SetPoint("LEFT", 36, 0)
  r.title:SetWidth(width - 360)
  r.title:SetWordWrap(false)
  r.total = UI.Text(r, 13, "bold", C.text)
  r.total:SetPoint("RIGHT", -170, 0)
  r.per = UI.Text(r, 13, "bold", C.gold)
  r.per:SetPoint("RIGHT", -46, 0)
  r.del = UI.IconButton(r, "close", 26, "Diese Session löschen")
  r.del:SetPoint("RIGHT", -10, 0)
  r.del:SetScript("OnClick", function(b) S.Delete(b.index) page.refresh(self) end)
  self.rows[i] = r
  return r
end

function page.refreshLive(self)
  local card = self.card
  local cur = S.Current()
  local st = S.Stats()
  if cur and st then
    card.state:SetText("Session läuft – " .. duration(st.elapsed))
    card.zone:SetText("Gestartet in " .. (cur.zone or "?") .. " · " .. st.items .. " Items gelootet")
    card.stats[1].value:SetText(ns.Money(st.gold))
    card.stats[2].value:SetText(ns.Money(st.loot))
    card.stats[3].value:SetText(ns.Money(st.total))
    card.stats[4].value:SetText(st.perHour and ns.Money(st.perHour) or "ab 1 Min.")
  else
    card.state:SetText("Bereit für eine Farm-Runde")
    card.zone:SetText("Tipp: Erst hier starten, dann losfarmen.")
    for _, f in ipairs(card.stats) do f.value:SetText("–") end
  end
end

function page.refresh(self)
  local card = self.card
  local cur = S.Current()
  card.btn:SetLabel(cur and "Stopp & speichern" or "Session starten")
  card.btn.style = cur and "danger" or "primary"
  card.btn:Paint()
  page.refreshLive(self)
  local best = S.Best()
  card.best:SetText(best and string.format("Deine beste Session: |cff39ff6b%s pro Stunde|r in %s (%s).", ns.Money(best.perHour), best.zone or "?", duration(best.elapsed))
    or "Noch keine Bestmarke – nach deiner ersten Session (mind. 5 Minuten) siehst du hier deinen Rekord.")

  local width = UI.CONTENT_W
  local y = self.histTop
  local list = S.History()
  for i, sess in ipairs(list) do
    local r = histRow(self, i, width)
    local stt = S.Stats(sess)
    r.del.index = i
    r.title:SetText(date("%d.%m. %H:%M", sess.start) .. "  ·  " .. (sess.zone or "?") .. "  ·  " .. duration(stt.elapsed))
    r.total:SetText(ns.Money(stt.total))
    r.per:SetText(stt.perHour and (ns.Money(stt.perHour) .. "/h") or "–")
    r:ClearAllPoints()
    r:SetPoint("TOPLEFT", self.frame.content, "TOPLEFT", 0, -y)
    r:Show()
    y = y + 50
  end
  for i = #list + 1, #self.rows do self.rows[i]:Hide() end
  self.empty:ClearAllPoints()
  self.empty:SetPoint("TOPLEFT", self.frame.content, "TOPLEFT", 0, -y)
  self.empty:SetShown(#list == 0)
  if #list == 0 then y = y + 40 end
  self.frame.content:SetHeight(y + 20)
end

ns.Listen("SESSION_CHANGED", function() if UI.IsShown("session") then UI.RefreshPage("session") end end)

UI.RegisterPage("session", page)

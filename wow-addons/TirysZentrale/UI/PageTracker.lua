-- Tiry's Zentrale – Seite "Goldtagebuch": Sitzung, Gold pro Stunde, 14-Tage-Verlauf
local _, ns = ...
local UI = ns.UI
local C = UI.C
local T = ns.Tracker

local DAYS = 14

local page = {
  title = "Goldtagebuch",
  subtitle = "Wie viel Gold du wirklich machst – pro Sitzung, pro Stunde und pro Tag.",
  icon = "chart", label = "Goldtagebuch", order = 7,
}

-- Kennzahl als Glas-Pille mit Leuchtpunkt und Unterzeile
local function bigStat(parent, w, label, accent)
  local f = UI.StatPill(parent, w, label, accent, 88, true)
  UI.SetFont(f.value, 20, "bold")
  return f
end

function page.build(self, content, width)
  local st = UI.Stack(content)
  local cw = math.floor((width - 24) / 3)
  local row = CreateFrame("Frame", nil, content)
  row:SetSize(width, 88)
  self.session = bigStat(row, cw, "Diese Sitzung", C.teal)
  self.session:SetPoint("TOPLEFT")
  self.rate = bigStat(row, cw, "Gold pro Stunde", C.amber)
  self.rate:SetPoint("LEFT", self.session, "RIGHT", 12, 0)
  self.today = bigStat(row, cw, "Heute", C.aqua)
  self.today:SetPoint("LEFT", self.rate, "RIGHT", 12, 0)
  st:Add(row, 88, 22)

  st:Title("Die letzten 14 Tage", 16, C.text, 4)
  -- Balkendiagramm (Gewinn pro Tag)
  local chart = UI.Card(content, 18, C.card)
  chart:SetSize(width, 210)
  st:Add(chart, 210, 18)
  self.chart = chart
  chart.bars = {}
  local slot = (width - 40) / DAYS
  for i = 1, DAYS do
    local bar = CreateFrame("Frame", nil, chart)
    bar:SetSize(math.max(slot - 12, 8), 10)
    bar:SetPoint("BOTTOMLEFT", chart, "BOTTOMLEFT", 20 + (i - 1) * slot + 6, 38)
    bar.bg = UI.Round(bar, 7, "ARTWORK", 0)
    bar.label = UI.Text(chart, 9, "semibold", C.dim)
    bar.label:SetPoint("TOP", bar, "BOTTOM", 0, -8)
    bar.value = UI.Text(chart, 9, "semibold", C.muted)
    bar.value:SetPoint("BOTTOM", bar, "TOP", 0, 4)
    bar:EnableMouse(true)
    bar:SetScript("OnEnter", function(me)
      if not me.data then return end
      GameTooltip:SetOwner(me, "ANCHOR_TOP")
      GameTooltip:SetText(me.data.label, 1, 0.6, 0.16)
      GameTooltip:AddDoubleLine("Eingenommen", ns.Money(me.data.earned), 0.86, 0.92, 0.89)
      GameTooltip:AddDoubleLine("Ausgegeben", ns.Money(me.data.spent), 0.86, 0.92, 0.89)
      GameTooltip:AddDoubleLine("Ergebnis", ns.Money(me.data.net), 1, 1, 1)
      GameTooltip:Show()
    end)
    bar:SetScript("OnLeave", function() GameTooltip:Hide() end)
    chart.bars[i] = bar
  end
  local base = chart:CreateTexture(nil, "ARTWORK")
  base:SetTexture("Interface\\Buttons\\WHITE8X8")
  base:SetVertexColor(1, 1, 1, 0.08)
  base:SetHeight(1)
  base:SetPoint("BOTTOMLEFT", 20, 37)
  base:SetPoint("BOTTOMRIGHT", -20, 37)

  self.best = UI.Para(content, 12, C.muted, width)
  st:Add(self.best, 20, 12)

  st:Title("Beute-Radar dieser Sitzung", 16, C.text, 4)
  self.radar = UI.Para(content, 12, C.muted, width)
  st:Add(self.radar, 150, 12)
  st:Para("So nutzt du das Tagebuch: Starte eine Farm-Runde, schau nach 30–60 Minuten auf \"Gold pro Stunde\" und vergleiche Methoden. "
    .. "Die Methode mit dem besten Wert machst du öfter. Gezählt wird jede Änderung deines Golds (Beute, Quests, Verkäufe, Einkäufe).", 12, C.dim, 10)
  st:Finish()
end

function page.refresh(self)
  local net, perHour, elapsed = T.SessionStats()
  self.session.value:SetText(ns.Money(net))
  self.session.sub:SetText(string.format("seit %d Min. · +%s / -%s", math.floor((elapsed or 0) / 60),
    ns.Money(T.session.earned), ns.Money(T.session.spent)))
  if perHour then
    self.rate.value:SetText(ns.Money(math.floor(perHour)))
    self.rate.sub:SetText("Hochrechnung dieser Sitzung")
  else
    self.rate.value:SetText("|cff8a9a94misst ...|r")
    self.rate.sub:SetText("ab 5 Minuten Spielzeit")
  end
  local days = T.Days(DAYS)
  local todayData = days[#days]
  self.today.value:SetText(ns.Money(todayData.net))
  self.today.sub:SetText("+" .. ns.Money(todayData.earned) .. " / -" .. ns.Money(todayData.spent))

  local maxAbs = 1
  for _, d in ipairs(days) do maxAbs = math.max(maxAbs, math.abs(d.net)) end
  for i, bar in ipairs(self.chart.bars) do
    local d = days[i]
    bar.data = d
    local h = math.max(8, math.floor(120 * math.abs(d.net) / maxAbs))
    bar:SetHeight(h)
    if d.net >= 0 then
      bar.bg:SetGradient(UI.GRAD, d.net > 0 and 1 or 0.25)
    else
      bar.bg:SetColor(C.red, 0.8)
    end
    bar.label:SetText(d.label)
    bar.value:SetText(d.net ~= 0 and ns.Money(d.net) or "")
  end
  local A = ns.Auto
  local lph = A.LootPerHour()
  local lines = { string.format("Beute-Wert: |cff39ff6b%s|r (%d Items)  ·  pro Stunde: |cff39ff6b%s|r",
    ns.Money(A.session.value), A.session.items, lph and ns.Money(math.floor(lph)) or "misst ...") }
  lines[#lines + 1] = "|cff93a39dWert = was du beim besten Verkaufsweg (AH nach Gebühr oder Händler) bekommst – auch für noch nicht verkaufte Beute.|r"
  for i = 1, math.min(#A.session.log, 6) do
    local e = A.session.log[i]
    lines[#lines + 1] = string.format("%s× %s  %s  |cff93a39d(%s)|r", e.n, ns.Item(e.id).name, ns.Money(e.value), e.channel == "AH" and "AH" or "Händler")
  end
  self.radar:SetText(table.concat(lines, "\n"))

  local best = T.BestDay()
  if best and best.net > 0 then
    self.best:SetText("Dein bester Tag: |cff39ff6b" .. best.key .. "|r mit " .. ns.Money(best.net) .. " Plus.")
  else
    self.best:SetText("Noch kein Gewinntag gespeichert – leg los!")
  end
end

UI.RegisterPage("tracker", page)

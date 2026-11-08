-- Tiry's Zentrale – Seite "Verkaufsbuch": was du wirklich verdienst, was sich verkauft, Gold aller Charaktere
local ADDON, ns = ...
local UI = ns.UI
local C = UI.C
local L = ns.Ledger

local PERIODS = {
  { value = 7, label = "7 Tage" }, { value = 30, label = "30 Tage" }, { value = 60, label = "60 Tage" },
}

local page = {
  title = "Verkaufsbuch",
  subtitle = "Deine echten Verkäufe, Käufe und Verkaufsquoten – automatisch aus der Post.",
  icon = "receipt", label = "Verkaufsbuch", order = 7.5,
}

local function kpi(parent, w, label, grad)
  local card = UI.Card(parent, 18, C.card)
  card:SetSize(w, 86)
  local stripe = CreateFrame("Frame", nil, card)
  stripe:SetSize(w - 32, 4)
  stripe:SetPoint("TOPLEFT", 16, -12)
  stripe.bg = UI.Round(stripe, 2, "ARTWORK", 0)
  stripe.bg:SetGradient(grad, 1)
  card.label = UI.Text(card, 10, "semibold", C.dim)
  card.label:SetPoint("TOPLEFT", 16, -24)
  card.label:SetText(label:upper())
  card.value = UI.Text(card, 18, "bold", C.text)
  card.value:SetPoint("TOPLEFT", card.label, "BOTTOMLEFT", 0, -6)
  card.sub = UI.Text(card, 10, "regular", C.muted)
  card.sub:SetPoint("TOPLEFT", card.value, "BOTTOMLEFT", 0, -3)
  return card
end

local function pct(r) return r and (math.floor(r * 100 + 0.5) .. " %") or "–" end

function page.build(self, content, width)
  self.days = 30
  self.width = width
  local st = UI.Stack(content)
  self.seg = UI.Segments(content, PERIODS, function(v) self.days = v page.refresh(self) end, width)
  self.seg:Select(30)
  st:Add(self.seg, self.seg:GetHeight(), 12)
  local cw = math.floor((width - 36) / 4)
  local row = CreateFrame("Frame", nil, content)
  row:SetSize(width, 86)
  self.k = {
    kpi(row, cw, "Eingenommen", UI.GRAD_FRESH), kpi(row, cw, "Ausgegeben", UI.GRAD_COOL),
    kpi(row, cw, "Gewinn", UI.GRAD), kpi(row, cw, "Verkaufsquote", UI.GRAD_FRESH),
  }
  for i, k in ipairs(self.k) do k:SetPoint("TOPLEFT", (i - 1) * (cw + 12), 0) end
  st:Add(row, 86, 16)
  self.hint = UI.Para(content, 11, C.dim, width)
  self.hint:SetText("So funktioniert's: Öffne nach dem Verkaufen den Briefkasten – Tiry's Zentrale liest die AH-Rechnungen (verkauft, gekauft, abgelaufen). "
    .. "Die Verkaufsquote zeigt, wie viele deiner Auktionen wirklich verkauft wurden. Der Craft-Planer nutzt sie, um Ladenhüter auszusortieren.")
  st:Add(self.hint, math.ceil(self.hint:GetStringHeight()) + 4, 12)
  self.topTitle = UI.Text(content, 16, "bold", C.text)
  self.topTitle:SetText("Deine Bestseller")
  st:Add(self.topTitle, 26, 4)
  self.top = UI.ItemList(content, width, {
    { key = "sold", label = "Verkauft", width = 70 },
    { key = "money", label = "Umsatz", width = 96, bold = true },
    { key = "rate", label = "Quote", width = 64 },
  })
  st:Add(self.top, nil)
  self.topY = st.y
  self.slowTitle = UI.Text(content, 16, "bold", C.text)
  self.slowTitle:SetText("Ladenhüter (verkauft sich schlecht)")
  self.slow = UI.ItemList(content, width, {
    { key = "rate", label = "Quote", width = 64 },
    { key = "expired", label = "Abgelaufen", width = 86 },
  })
  self.goldTitle = UI.Text(content, 16, "bold", C.text)
  self.goldTitle:SetText("Gold aller Charaktere")
  self.gold = UI.Para(content, 12, C.muted, width)
end

function page.refresh(self)
  local t = L.Totals(self.days)
  self.k[1].value:SetText(ns.Money(t.income)) ; self.k[1].sub:SetText(t.sold .. " Verkäufe")
  self.k[2].value:SetText(ns.Money(t.spent)) ; self.k[2].sub:SetText(t.bought .. " Käufe")
  self.k[3].value:SetText(ns.Money(t.profit)) ; self.k[3].sub:SetText("Einnahmen minus Käufe")
  self.k[4].value:SetText(pct(t.rate)) ; self.k[4].sub:SetText(t.expired .. " abgelaufen")

  local items = L.ByItem(self.days)
  local top, slow = {}, {}
  for _, x in ipairs(items) do
    local entry = function(cells)
      return { id = x.id, name = x.id and nil or x.name, icon = not x.id and ns.UI.TEX.logo or nil, cells = cells,
        tip = { string.format("%d verkauft (%d Stück), %d abgelaufen", x.sold, x.n, x.expired) } }
    end
    if x.sold > 0 and #top < 10 then
      top[#top + 1] = entry({ sold = tostring(x.sold), money = ns.Money(x.money), rate = pct(x.rate) })
    end
    if x.rate and x.rate < 0.3 and (x.sold + x.expired) >= 3 and #slow < 8 then
      slow[#slow + 1] = entry({ rate = "|cffff6b81" .. pct(x.rate) .. "|r", expired = tostring(x.expired) })
    end
  end
  local content = self.frame.content
  local h = self.top:SetEntries(top, "Noch keine Verkäufe erfasst. Verkauf etwas im AH und öffne danach den Briefkasten.")
  local y = self.topY + h + 18
  self.slowTitle:ClearAllPoints() ; self.slowTitle:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + 28
  self.slow:ClearAllPoints() ; self.slow:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + self.slow:SetEntries(slow, "Keine Ladenhüter – alles verkauft sich ordentlich.") + 18
  self.goldTitle:ClearAllPoints() ; self.goldTitle:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + 28
  local list, total = ns.Inv.Gold()
  local lines = { "Gesamt: |cffffd24a" .. ns.Money(total) .. "|r" }
  for _, c in ipairs(list) do lines[#lines + 1] = "•  " .. c.name .. ": " .. ns.Money(c.money) end
  self.gold:SetText(table.concat(lines, "\n"))
  self.gold:ClearAllPoints() ; self.gold:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + math.ceil(self.gold:GetStringHeight()) + 20
  content:SetHeight(y + 20)
end

ns.Listen("LEDGER_CHANGED", function() if UI.IsShown("ledger") then UI.RefreshPage("ledger") end end)

UI.RegisterPage("ledger", page)

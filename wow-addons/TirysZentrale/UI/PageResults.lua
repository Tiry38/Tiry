-- Tiry's Zentrale – Seite "Ergebnis": Was hat Herstellen WIRKLICH gebracht? (echte Kosten gegen echte Verkäufe)
local _, ns = ...
local UI = ns.UI
local C = UI.C
local CB = ns.CraftBook

local PERIODS = {
  { value = 7, label = "7 Tage" }, { value = 30, label = "30 Tage" }, { value = 60, label = "60 Tage" },
}

local page = {
  title = "Ergebnis",
  subtitle = "Was dir Herstellen wirklich gebracht hat – echte Einkaufspreise gegen echte Verkäufe.",
  icon = "chart", label = "Ergebnis", order = 2.7,
}

local function stat(parent, w, label)
  local f = UI.Card(parent, 16, C.card)
  f:SetSize(w, 70)
  f.label = UI.Text(f, 12, "semibold", C.dim)
  f.label:SetPoint("TOPLEFT", 16, -12)
  f.label:SetText(label)
  f.value = UI.Text(f, 18, "bold", C.text)
  f.value:SetPoint("TOPLEFT", f.label, "BOTTOMLEFT", 0, -6)
  return f
end

function page.build(self, content, width)
  self.days = 7
  local st = UI.Stack(content)
  self.seg = UI.Segments(content, PERIODS, function(v) self.days = v page.refresh(self) end, width)
  self.seg:Select(7)
  st:Add(self.seg, self.seg:GetHeight(), 12)
  local cw = math.floor((width - 36) / 4)
  local row = CreateFrame("Frame", nil, content)
  row:SetSize(width, 70)
  self.stats = { stat(row, cw, "ECHT VERDIENT"), stat(row, cw, "VERKAUFT"), stat(row, cw, "HERGESTELLT"), stat(row, cw, "BESTES ITEM") }
  for i, f in ipairs(self.stats) do f:SetPoint("TOPLEFT", (i - 1) * (cw + 12), 0) end
  st:Add(row, 70, 12)
  self.hint = UI.Para(content, 12, C.muted, width)
  self.hint:SetText("Zählt automatisch: Herstellen merkt sich die Materialkosten (was du im AH wirklich bezahlt hast), "
    .. "der Briefkasten liefert den echten Verkaufserlös. Echter Gewinn = Erlös nach Gebühr minus Materialkosten.")
  st:Add(self.hint, 34, 12)
  self.list = UI.ItemList(content, width, {
    { key = "made", label = "Hergestellt", width = 84 },
    { key = "sold", label = "Verkauft", width = 70 },
    { key = "per", label = "Pro Stück", width = 84 },
    { key = "profit", label = "Gewinn", width = 96, bold = true },
  })
  st:Add(self.list, nil)
  self.listTop = st.y
end

local function signed(v)
  if not v then return "|cff93a39d–|r" end
  return (v >= 0 and "|cff61eb8f+" or "|cffff6b81-") .. ns.Money(math.abs(v)) .. "|r"
end

function page.refresh(self)
  local list, t = CB.Report(self.days)
  self.stats[1].value:SetText(t.sold > 0 and signed(t.profit) or "–")
  self.stats[2].value:SetText(t.sold .. " Stück")
  self.stats[3].value:SetText(t.made .. " Stück")
  UI.FitText(self.stats[4].value, t.best and (ns.Item(t.best.id).name or "?") or "–", self.stats[4]:GetWidth() - 28)
  local entries = {}
  for _, x in ipairs(list) do
    local note
    if x.sold == 0 then note = x.expired > 0 and ("|cffff6b81" .. x.expired .. "× abgelaufen|r – Preis prüfen") or "noch nichts verkauft"
    elseif x.perUnit and x.perUnit < 0 then note = "|cffff6b81Verlust – Rezept lieber weglassen oder teurer verkaufen|r"
    else note = "Erlös " .. ns.Money(x.income) .. (x.unitCost and (" · Kosten " .. ns.Money(math.floor(x.unitCost + 0.5)) .. "/Stück") or "") end
    entries[#entries + 1] = {
      id = x.id, note = note,
      cells = { made = tostring(x.made), sold = tostring(x.sold), per = signed(x.perUnit), profit = signed(x.profit) },
      tip = { "Erlös nach AH-Gebühr: " .. ns.Money(x.income),
        "Materialkosten pro Stück: " .. (x.unitCost and ns.Money(math.floor(x.unitCost + 0.5)) or "unbekannt"),
        x.expired > 0 and (x.expired .. " Auktionen abgelaufen") or "Keine abgelaufenen Auktionen" },
    }
  end
  local h = self.list:SetEntries(entries, "Noch nichts hergestellt. Stell etwas aus der Craft-Liste her und verkauf es – hier siehst du dann, was es wirklich gebracht hat.")
  self.frame.content:SetHeight(self.listTop + h + 30)
end

ns.Listen("CRAFTBOOK_CHANGED", function() if UI.IsShown("results") then UI.RefreshPage("results") end end)

UI.RegisterPage("results", page)

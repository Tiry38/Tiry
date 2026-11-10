-- Tiry's Zentrale – Ansicht "Preisalarm": Wunschpreis setzen, Hinweis sobald ein Item darunter liegt
local _, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market
local A = ns.Alerts

local page = {
  title = "Preisalarm",
  subtitle = "Sag, was du günstig kaufen willst – Tiry's Zentrale meldet sich, sobald es so billig ist.",
  icon = "warn", label = "Preisalarm", order = 31,
}

local SUGGEST = 6

function page.build(self, content, width)
  local st = UI.Stack(content)
  st:Para("So geht's: 1. Item suchen und anklicken. 2. Wunschpreis eintragen (z. B. 45 = 45 Silber, 1g 20s). 3. \"Alarm setzen\". "
    .. "Geprüft wird nach jedem AH-Scan und bei jeder Suche im Auktionshaus.", 12, C.muted, 14)
  self.search = UI.SearchBox(content, width, "Item suchen, z. B. \"seidenstoff\" oder \"leder\"", function(t)
    self.text = t
    ns.Debounce("alertsearch", 0.25, function() page.refreshSuggest(self) end)
  end)
  st:Add(self.search, 38, 8)
  self.suggest = {}
  for i = 1, SUGGEST do
    local b = UI.Button(content, "", "soft", width, 32)
    b.text:ClearAllPoints()
    b.text:SetPoint("LEFT", 16, 0)
    b:SetScript("OnClick", function(btn) self.pick = btn.itemID page.refreshPick(self) end)
    b:Hide()
    self.suggest[i] = b
  end
  self.suggestTop = st.y

  -- Auswahl + Wunschpreis
  local pick = CreateFrame("Frame", nil, content)
  pick:SetSize(width, 48)
  local pshape = UI.PillShape(pick, 48, 0, true)
  pshape.edge:SetGradient(UI.GRAD_EDGE, 0.5)
  pshape.body:SetGradientV(UI.GLASS.hero[1], UI.GLASS.hero[2], 1)
  pshape.gloss:SetAlpha(0.35)
  pick.bg = pshape.body
  pick.icon = UI.ItemIcon(pick, 36)
  pick.icon:SetPoint("LEFT", 6, 0)
  pick.name = UI.Text(pick, 13, "semibold", C.text)
  pick.name:SetPoint("LEFT", pick.icon, "RIGHT", 10, 0)
  pick.name:SetWidth(width - 520)
  pick.name:SetWordWrap(false)
  local box = CreateFrame("EditBox", nil, pick)
  box:SetSize(150, 30)
  box:SetPoint("RIGHT", -190, 0)
  box:SetAutoFocus(false)
  box:SetMaxLetters(16)
  box:SetTextInsets(12, 12, 0, 0)
  local ok, res = pcall(box.SetFont, box, ns.MEDIA .. "Fonts\\Poppins-SemiBold.ttf", 13, "")
  if not ok or res == false then pcall(box.SetFont, box, STANDARD_TEXT_FONT or "Fonts\\FRIZQT__.TTF", 13, "") end
  box:SetTextColor(1, 1, 1, 1)
  local bshape = UI.PillShape(box, 30, 2, false)
  bshape.edge:SetGradient(UI.GRAD_EDGE, 0.45)
  box.bg = bshape.body
  box.bg:SetColor(C.inset, 1)
  local lab = UI.Text(pick, 12, "semibold", C.muted)
  lab:SetPoint("RIGHT", box, "LEFT", -8, 0)
  lab:SetText("Wunschpreis")
  pick.set = UI.Button(pick, "Alarm setzen", "primary", 170, 34, "warn")
  pick.set:SetPoint("RIGHT", -6, 0)
  local function apply()
    local price = ns.ParseMoney(box:GetText())
    if not self.pick then ns.Print("Erst ein Item auswählen.") return end
    if not price or price <= 0 then ns.Print("Bitte einen Preis eintragen, z. B. 45 (Silber) oder 1g 20s.") return end
    A.Set(self.pick, price)
    ns.Print("Preisalarm gesetzt: " .. ns.Item(self.pick).name .. " unter " .. ns.Money(price) .. ".")
    box:SetText("")
    box:ClearFocus()
    page.refresh(self)
  end
  pick.set:SetScript("OnClick", apply)
  box:SetScript("OnEnterPressed", apply)
  box:SetScript("OnEscapePressed", function(b) b:ClearFocus() end)
  pick.box = box
  self.pickFrame = pick

  self.listTitle = UI.Text(content, 17, "bold", C.text)
  self.listTitle:SetText("Deine Alarme")
  self.list = UI.ItemList(content, width, {
    { key = "now", label = "Jetzt", width = 100 },
    { key = "wish", label = "Wunschpreis", width = 110, bold = true },
    { key = "state", label = "Status", width = 130 },
  }, { action = true })
end

function page.refreshSuggest(self)
  local results = {}
  if self.text and #self.text >= 2 then
    results = ns.DB.Search(self.text, function(e) return e.bind ~= 1 and e.bind ~= 4 end)
  end
  for i, b in ipairs(self.suggest) do
    local e = results[i]
    if e then
      b.itemID = e.id
      b:SetLabel(e.name .. "  |cff93a39d· " .. (ns.DB.SubName(e) or ns.DB.ClassName(e)) .. "|r")
      b:Show()
    else
      b:Hide()
    end
  end
  page.refresh(self)
end

function page.refreshPick(self)
  local pick = self.pickFrame
  if self.pick then
    local item = ns.Item(self.pick)
    pick.icon:SetItem(self.pick)
    local now = M.Price(self.pick)
    pick.name:SetText(item.name .. (now and ("  |cff93a39dgerade " .. ns.Money(now) .. "|r") or ""))
    pick.set:SetEnabled(true)
    pick.box:SetFocus()
  else
    pick.icon:SetIcon(UI.Icon("warn"), C.gold)
    pick.name:SetText("|cff93a39dNoch kein Item ausgewählt|r")
    pick.set:SetEnabled(false)
  end
end

function page.refresh(self)
  local content = self.frame.content
  local y = self.suggestTop
  for _, b in ipairs(self.suggest) do
    if b:IsShown() then
      b:ClearAllPoints()
      b:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
      y = y + 36
    end
  end
  y = y + 6
  self.pickFrame:ClearAllPoints()
  self.pickFrame:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  if not self.pickInit then self.pickInit = true page.refreshPick(self) end
  y = y + 48 + 22
  self.listTitle:ClearAllPoints()
  self.listTitle:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + 32
  local entries = {}
  for _, a in ipairs(A.List()) do
    local hit = a.now and a.now <= a.price
    entries[#entries + 1] = {
      id = a.id,
      note = a.hitTime and ("Zuletzt gemeldet: " .. date("%d.%m. %H:%M", a.hitTime) .. " für " .. ns.Money(a.hit)) or "Noch nicht gemeldet",
      cells = {
        now = a.now and ns.Money(a.now) or "|cff8a9a94kein Preis|r",
        wish = ns.Money(a.price),
        state = hit and "|cffff9929jetzt kaufen!|r" or "|cff93a39dwartet|r",
      },
      tip = { "Preis jetzt: " .. (a.now and ns.Money(a.now) or "unbekannt (AH scannen)") .. " · " .. M.AgeText(a.id),
        "Klick: im AH suchen (Auktionshaus muss offen sein) · ×: Alarm löschen" },
      action = function() A.Remove(a.id) page.refresh(self) end,
      actionTip = "Alarm löschen",
      onClick = function()
        local okS, err = M.SearchNow({ a.id })
        if not okS then ns.Print("|cffff6b81" .. tostring(err) .. "|r") end
      end,
    }
  end
  self.list:ClearAllPoints()
  self.list:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  local h = self.list:SetEntries(entries, "Noch keine Alarme. Such oben ein Item und setz deinen Wunschpreis.")
  content:SetHeight(y + h + 30)
end

ns.Listen("ALERTS_CHANGED", function() if UI.IsShown("alerts") then UI.RefreshPage("alerts") end end)

UI.RegisterPage("alerts", page)

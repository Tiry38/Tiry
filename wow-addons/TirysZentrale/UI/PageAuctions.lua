-- Tiry's Zentrale – Ansicht "Meine Auktionen": was im AH liegt, was verkauft wurde, was unterboten ist
local _, ns = ...
local UI = ns.UI
local C = UI.C
local M = ns.Market
local AW = ns.AH

local page = {
  title = "Meine Auktionen",
  subtitle = "Was du im AH hast, was es wert ist, was verkauft wurde und was im Briefkasten liegt.",
  icon = "receipt", label = "Meine Auktionen", order = 30,
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

local function ago(t)
  if not t then return "noch nie" end
  local m = math.floor((time() - t) / 60)
  if m < 2 then return "gerade eben" end
  if m < 120 then return "vor " .. m .. " Min." end
  local h = math.floor(m / 60)
  if h < 48 then return "vor " .. h .. " Std." end
  return "vor " .. math.floor(h / 24) .. " Tagen"
end

local function left(expires)
  if not expires then return nil end
  local s = expires - time()
  if s <= 0 then return "abgelaufen" end
  local h = math.floor(s / 3600)
  if h >= 1 then return "noch ca. " .. h .. " Std." end
  return "noch ca. " .. math.max(1, math.floor(s / 60)) .. " Min."
end

function page.build(self, content, width)
  local st = UI.Stack(content)
  local cw = math.floor((width - 36) / 4)
  local row = CreateFrame("Frame", nil, content)
  row:SetSize(width, 70)
  self.stats = { stat(row, cw, "IM AH"), stat(row, cw, "WERT IM AH"), stat(row, cw, "IM BRIEFKASTEN"), stat(row, cw, "UNTERBOTEN") }
  UI.SetTooltip(self.stats[3], "Gold im Briefkasten", "Erlös deiner verkauften Auktionen (nach AH-Gebühr). \"ca.\" = geschätzt seit dem Verkauf – "
    .. "genau wird es, sobald du den Briefkasten öffnest. Holst du das Gold ab, verschwindet es hier von selbst.")
  self.stats[3]:EnableMouse(true)
  for i, f in ipairs(self.stats) do f:SetPoint("TOPLEFT", (i - 1) * (cw + 12), 0) end
  st:Add(row, 70, 14)

  self.hint = UI.Para(content, 12, C.muted, width)
  st:Add(self.hint, 34, 10)

  local actions = CreateFrame("Frame", nil, content)
  actions:SetSize(width, 34)
  self.checkBtn = UI.Button(actions, "Jetzt prüfen", "primary", 180, 34, "refresh")
  self.checkBtn:SetPoint("LEFT")
  self.checkBtn:SetScript("OnClick", function()
    if not M.ahOpen then ns.Print("Öffne das Auktionshaus – nur dort sieht man fremde Angebote.") return end
    AW.CheckNow()
    ns.Print("Prüfe deine Auktionen ...")
  end)
  UI.SetTooltip(self.checkBtn, "Jetzt prüfen", "Liest deine Auktionen neu und vergleicht sie mit den günstigsten fremden Angeboten. Geht nur bei offenem Auktionshaus – passiert beim Öffnen aber auch automatisch.")
  self.listBtn = UI.Button(actions, "Unterbotene als Suchliste", "soft", 260, 34, "cart")
  self.listBtn:SetPoint("LEFT", self.checkBtn, "RIGHT", 10, 0)
  self.listBtn:SetScript("OnClick", function()
    local ids, seen = {}, {}
    for _, a in ipairs(AW.UndercutList()) do if not seen[a.id] then seen[a.id] = true ids[#ids + 1] = a.id end end
    local ok, n = M.CreateShoppingList("Zentrale: Unterboten", ids)
    ns.Print(ok and ("Liste |cffff9929Zentrale: Unterboten|r angelegt (" .. n .. " Items). Neu einstellen geht am schnellsten in Auctionator > \"Unterboten\".")
      or ("|cffff6b81" .. tostring(n) .. "|r"))
  end)
  st:Add(actions, 34, 18)

  self.activeTitle = UI.Text(content, 17, "bold", C.text)
  self.activeTitle:SetText("Im Auktionshaus")
  self.active = UI.ItemList(content, width, {
    { key = "qty", label = "Menge", width = 60 },
    { key = "mine", label = "Dein Preis", width = 100 },
    { key = "other", label = "Günstigster", width = 100 },
    { key = "state", label = "Status", width = 130, bold = true },
  })
  self.soldTitle = UI.Text(content, 17, "bold", C.text)
  self.soldTitle:SetText("Verkauft")
  self.sold = UI.ItemList(content, width, {
    { key = "qty", label = "Menge", width = 60 },
    { key = "gold", label = "Erlös", width = 100 },
    { key = "where", label = "Gold", width = 130 },
    { key = "when", label = "Wann", width = 100 },
  }, { action = true })
end

function page.refresh(self)
  local s = AW.Store()
  local sum = AW.Summary()
  self.stats[1].value:SetText(sum.active .. (sum.active == 1 and " Auktion" or " Auktionen"))
  self.stats[2].value:SetText(ns.Money(sum.value))
  self.stats[3].value:SetText(sum.mailGold > 0 and ((sum.mailEstimated and "ca. " or "") .. ns.Money(sum.mailGold)) or "leer")
  self.stats[4].value:SetText(sum.undercut > 0 and ("|cffff6b81" .. sum.undercut .. "|r") or "0")
  local nextIn = AW.NextAutoIn()
  local auto = nextIn > 0 and ("Nächste automatische Prüfung in " .. nextIn .. " Min. – \"Jetzt prüfen\" geht immer.")
    or "Beim nächsten Öffnen des Auktionshauses wird automatisch geprüft und gescannt."
  local stand = "Heute verkauft: " .. sum.soldToday .. " · Stand: " .. ago(sum.time) .. ". "
  self.hint:SetText(stand .. (M.ahOpen and ("Auktionshaus offen: Deine Auktionen sind eingelesen. " .. auto)
    or "Verkäufe erkennt Tiry's Zentrale überall sofort – ob du unterboten wurdest, sieht man nur am Auktionshaus."))
  self.checkBtn:SetEnabled(M.ahOpen == true)
  self.listBtn:SetEnabled(sum.undercut > 0 and M.HasAuctionator())

  local entries = {}
  for _, a in ipairs(s.list) do
    if a.status ~= "sold" then
      local expired = a.status == "expired" or (a.expires and a.expires < time())
      local state
      if expired then state = "|cff93a39dabgelaufen – Post|r"
      elseif a.undercut then state = "|cffff6b81unterboten|r"
      elseif a.checked then state = "|cff61eb8fam günstigsten|r"
      else state = "|cff93a39dnicht geprüft|r" end
      entries[#entries + 1] = {
        id = a.id,
        note = (left(a.expires) or "Restzeit unbekannt") .. (a.checked and (" · geprüft " .. ago(a.checked)) or ""),
        cells = {
          qty = tostring(a.qty),
          mine = a.unit and ns.Money(a.unit) or "–",
          other = a.competitor and ns.Money(a.competitor) or "|cff8a9a94–|r",
          state = state,
        },
        tip = { a.undercut and ("Jemand verkauft für " .. ns.Money(a.competitor) .. " pro Stück – du für " .. ns.Money(a.unit) .. ".") or "Preis pro Stück.",
          "Neu einstellen: Auctionator > Reiter \"Unterboten\"." },
      }
    end
  end
  table.sort(entries, function(x, y)
    local ux, uy = x.cells.state:find("unterboten") and 1 or 0, y.cells.state:find("unterboten") and 1 or 0
    if ux ~= uy then return ux > uy end
    return ns.Item(x.id).name < ns.Item(y.id).name
  end)
  local content = self.frame.content
  local y = 70 + 14 + 34 + 10 + 34 + 18
  self.activeTitle:ClearAllPoints()
  self.activeTitle:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + 30
  self.active:ClearAllPoints()
  self.active:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + self.active:SetEntries(entries, "Keine Auktionen bekannt. Öffne einmal das Auktionshaus – dann liest Tiry's Zentrale deine Auktionen automatisch.") + 22

  local sold = {}
  for i, e in ipairs(s.sold) do
    if i > 20 then break end
    sold[#sold + 1] = {
      id = e.id, name = (not e.id) and e.name or nil,
      cells = { qty = e.qty and tostring(e.qty) or "?", gold = e.amount and ns.Money(e.amount) or "–",
        where = e.inMail and "|cffff9929im Briefkasten|r" or "|cff93a39dabgeholt|r", when = date("%d.%m. %H:%M", e.time) },
      action = function() table.remove(s.sold, i) page.refresh(self) end,
      actionTip = "Aus der Liste entfernen",
    }
  end
  self.soldTitle:ClearAllPoints()
  self.soldTitle:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + 30
  self.sold:ClearAllPoints()
  self.sold:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + self.sold:SetEntries(sold, "Noch nichts verkauft – sobald eine Auktion weggeht, steht sie hier (auch wenn du nicht am AH bist).") + 30
  content:SetHeight(y)
end

ns.Listen("AUCTIONS_CHANGED", function() if UI.IsShown("auctions") then UI.RefreshPage("auctions") end end)

UI.RegisterPage("auctions", page)

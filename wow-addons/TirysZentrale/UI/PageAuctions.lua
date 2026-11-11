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

-- Kennzahl als Glas-Pille mit Leuchtpunkt (statt Kachel)
local function stat(parent, w, label, accent)
  return UI.StatPill(parent, w, label, accent, 70)
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
  self.stats = { stat(row, cw, "Im AH", C.amber), stat(row, cw, "Wert im AH", C.teal), stat(row, cw, "Im Briefkasten", C.aqua), stat(row, cw, "Unterboten", C.hi) }
  UI.SetTooltip(self.stats[3], "Gold im Briefkasten", "Nach einem Verkauf ist das Gold erst ein paar Minuten unterwegs, dann liegt es im Briefkasten. "
    .. "\"ca.\" = geschätzt – genau wird es, sobald du den Briefkasten öffnest. Holst du das Gold ab, verschwindet es hier von selbst.")
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
  self.listBtn = UI.Button(actions, "Neu einstellen: Suchliste", "soft", 260, 34, "cart")
  self.listBtn:SetPoint("LEFT", self.checkBtn, "RIGHT", 10, 0)
  self.listBtn:SetScript("OnClick", function()
    local ids, seen = {}, {}
    for _, a in ipairs(AW.RelistList()) do if not seen[a.id] then seen[a.id] = true ids[#ids + 1] = a.id end end
    local ok, n = M.CreateShoppingList("Zentrale: Neu einstellen", ids)
    ns.Print(ok and ("Liste |cff39ff6bZentrale: Neu einstellen|r angelegt (" .. n .. " Items) – zeigt dir die Konkurrenz. "
      .. "Einstellen: Auctionator > Verkaufen > Item anklicken, Preis aus \"Vorschlag\" nehmen.") or ("|cffff6b81" .. tostring(n) .. "|r"))
  end)
  UI.SetTooltip(self.listBtn, "Neu einstellen", "Legt alle Items aus \"Neu einstellen\" als Auctionator-Suchliste an, damit du die aktuelle Konkurrenz siehst.")
  st:Add(actions, 34, 14)

  -- Beste Verkaufszeit (aus den AH-Scans bzw. deinen Verkäufen)
  local tf = CreateFrame("Frame", nil, content)
  tf:SetSize(width, 20)
  tf.dot = tf:CreateTexture(nil, "ARTWORK")
  tf.dot:SetTexture(UI.TEX.circle)
  tf.dot:SetSize(8, 8)
  tf.dot:SetPoint("LEFT", 2, 0)
  UI.SetGradV(tf.dot, C.amber, C.teal, 1)
  tf.text = UI.Text(tf, 12, "regular", C.muted)
  tf.text:SetPoint("LEFT", 18, 0)
  tf.text:SetWidth(width - 20)
  tf.text:SetWordWrap(false)
  tf:EnableMouse(true)
  UI.SetTooltip(tf, function()
    local b = ns.Timing and ns.Timing.Best()
    if not b then
      return "Beste Verkaufszeit", "Wird gemessen: Nach ein paar AH-Scans zu verschiedenen Uhrzeiten (oder einigen eigenen Verkäufen) steht hier, wann am meisten gekauft wird."
    end
    return "Beste Verkaufszeit", (b.text or "") .. (b.tip and ("\n\n" .. b.tip) or "")
  end)
  self.timing = tf
  st:Add(tf, 20, 18)

  -- Neu einstellen: unterboten, abgelaufen, frisch hergestellt – mit Preisvorschlag
  self.relistTitle = UI.Text(content, 17, "bold", C.text)
  self.relistTitle:SetText("Neu einstellen")
  self.relist = UI.ItemList(content, width, {
    { key = "qty", label = "Menge", width = 56 },
    { key = "where", label = "Warum", width = 96 },
    { key = "price", label = "Vorschlag", width = 96, bold = true },
    { key = "floor", label = "Nicht unter", width = 96 },
  })

  self.activeTitle = UI.Text(content, 17, "bold", C.text)
  self.activeTitle:SetText("Im Auktionshaus")
  self.active = UI.ItemList(content, width, {
    { key = "qty", label = "Menge", width = 56 },
    { key = "mine", label = "Stückpreis", width = 90 },
    { key = "total", label = "Wert", width = 96, bold = true },
    { key = "other", label = "Günstigster", width = 90 },
    { key = "state", label = "Status", width = 120, bold = true },
  })
  -- Summenzeile unter der Liste
  -- Summe als leuchtende Glas-Pille
  self.totalRow = CreateFrame("Frame", nil, content)
  self.totalRow:SetSize(width, 48)
  local tshape = UI.PillShape(self.totalRow, 48, 0, true)
  tshape.edge:SetGradient(UI.GRAD_EDGE, 0.6)
  tshape.body:SetGradientV(UI.GLASS.hero[1], UI.GLASS.hero[2], 1)
  tshape.gloss:SetAlpha(0.4)
  self.totalRow.bg = tshape.body
  self.totalRow.glow = UI.Glow(self.totalRow, C.amber, 260, 0.16, "BORDER")
  self.totalRow.glow:SetHeight(46)
  self.totalRow.glow:SetPoint("CENTER", self.totalRow, "RIGHT", -90, 0)
  self.totalRow.label = UI.Text(self.totalRow, 14, "bold", C.text)
  self.totalRow.label:SetPoint("LEFT", 24, 0)
  self.totalRow.value = UI.Text(self.totalRow, 17, "bold", C.gold)
  self.totalRow.value:SetPoint("RIGHT", -24, 0)
  self.totalRow.value:SetJustifyH("RIGHT")
  self.soldTitle = UI.Text(content, 17, "bold", C.text)
  self.soldTitle:SetText("Verkauft")
  self.sold = UI.ItemList(content, width, {
    { key = "qty", label = "Menge", width = 60 },
    { key = "gold", label = "Erlös", width = 100 },
    { key = "where", label = "Gold", width = 130 },
    { key = "when", label = "Wann", width = 100 },
  }, { action = true })
end

-- Unterwegs -> im Briefkasten -> abgeholt
local function whereText(e)
  local st, guess = AW.SoldState(e)
  if st == "way" then
    local t = AW.ETA(e)
    if t then return "|cff7fc8ffunterwegs · ca. " .. math.max(1, math.ceil((t - time()) / 60)) .. " Min.|r" end
    return "|cff7fc8ffunterwegs|r"
  elseif st == "mail" then
    return guess and "|cffff9929sollte im Briefkasten sein|r" or "|cffff9929im Briefkasten|r"
  end
  return "|cff93a39dabgeholt|r"
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
  local stand = "Heute verkauft: " .. sum.soldToday
    .. ((sum.onWay or 0) > 0 and (" · |cff7fc8ffunterwegs zum Briefkasten: ca. " .. ns.Money(sum.onWay) .. "|r") or "")
    .. " · Stand: " .. ago(sum.time):gsub("%.$", "") .. ". "
  self.hint:SetText(stand .. (M.ahOpen and ("Auktionshaus offen: Deine Auktionen sind eingelesen. " .. auto)
    or "Verkäufe erkennt Tiry's Zentrale überall sofort – ob du unterboten wurdest, sieht man nur am Auktionshaus."))
  self.checkBtn:SetEnabled(M.ahOpen == true)
  local relist = AW.RelistList()
  self.listBtn:SetEnabled(#relist > 0 and M.HasAuctionator())

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
          total = a.unit and ns.Money(a.unit * a.qty) or "–",
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
  local y = 70 + 14 + 34 + 10 + 34 + 14 + 20 + 18
  -- Verkaufszeit-Zeile
  local T = ns.Timing
  local good, best = false, nil
  if T then good, best = T.IsGoodTime() if not best then best = T.Best() end end
  if best and best.text and best.text ~= "" then
    UI.FitText(self.timing.text, UI.NEON_HEX .. "Verkaufszeit:|r " .. best.text
      .. (good and " · |cffff9929jetzt ist Hauptbetrieb|r" or ""), UI.CONTENT_W - 20)
  else
    self.timing.text:SetText(UI.NEON_HEX .. "Verkaufszeit:|r wird gemessen – nach ein paar AH-Scans zu verschiedenen Uhrzeiten steht hier, wann am meisten gekauft wird.")
  end
  -- Neu einstellen (nur wenn es etwas gibt)
  local WHY = { unterboten = "|cffff6b81unterboten|r", abgelaufen = "|cffff9929abgelaufen|r", hergestellt = "|cff61eb8fhergestellt|r" }
  local re = {}
  for _, e in ipairs(relist) do
    local post = e.post or e.qty
    local note
    if e.stale then
      -- 2× abgelaufen, nie verkauft: jedes Einstellen kostet Gebühr
      note = string.format("|cffff9929%d× abgelaufen, nie verkauft – billiger einstellen oder zum Händler%s|r", e.expired or 2,
        e.vendor and (" (" .. ns.Money(e.vendor) .. "/Stück)") or "")
    elseif e.full then
      note = "|cffff9929Markt voll – nicht nachlegen, lieber halten|r"
    elseif e.wait then
      note = "|cffff9929AH-Preis liegt unter deinen Kosten – lieber warten oder zum Vorschlag einstellen|r"
    elseif post < e.qty then
      note = "Nur " .. post .. " einstellen – so viele gehen in ca. 3 Tagen weg, der Rest später"
    else
      note = e.mine and ("du: " .. ns.Money(e.mine) .. "/Stück") or "Klick: Angebote im AH zeigen · Shift-Klick: verlinken"
    end
    local tip = { AW.WholeSilver and AW.WholeSilver(e.id)
        and "Vorschlag = günstigstes Angebot, abgerundet auf ganze Silber (Einzel-Items ohne Kupfer), nie unter \"Nicht unter\"."
        or "Vorschlag = günstigstes Angebot minus 1 Kupfer, nie unter \"Nicht unter\".",
      "\"Nicht unter\" = Materialkosten bzw. Händlerpreis pro Stück plus Anzahlungs-Risiko, nach AH-Gebühr.",
      "Einstellen: Auctionator > Verkaufen > Item anklicken." }
    if post < e.qty then tip[#tip + 1] = "Menge: " .. post .. " von " .. e.qty .. " einstellen – nicht den Markt fluten." end
    re[#re + 1] = {
      id = e.id,
      note = note,
      chip = (e.stale and { "Ladenhüter", C.hi }) or (e.full and { "Markt voll", C.hi }) or nil,
      cells = { qty = post < e.qty and (post .. "/" .. e.qty) or tostring(e.qty), where = WHY[e.where] or e.where,
        price = e.price and ns.Money(e.price) or "|cff8a9a94kein Preis|r", floor = e.floor and ns.Money(e.floor) or "–" },
      tip = tip,
      onClick = function()
        if M.ahOpen then
          local ok, err = M.SearchNow({ e.id })
          if not ok then ns.Print("|cffff6b81" .. tostring(err) .. "|r") end
        else
          ns.Print("Öffne das Auktionshaus – dann zeigt ein Klick die aktuelle Konkurrenz.")
        end
      end,
    }
  end
  if #re > 0 then
    self.relistTitle:ClearAllPoints()
    self.relistTitle:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
    self.relistTitle:Show()
    y = y + 30
    self.relist:ClearAllPoints()
    self.relist:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
    self.relist:Show()
    y = y + self.relist:SetEntries(re, "") + 18
  else
    self.relistTitle:Hide()
    self.relist:Hide()
  end
  self.activeTitle:ClearAllPoints()
  self.activeTitle:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + 30
  self.active:ClearAllPoints()
  self.active:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
  y = y + self.active:SetEntries(entries, "Keine Auktionen bekannt. Öffne einmal das Auktionshaus – dann liest Tiry's Zentrale deine Auktionen automatisch.") + 8
  -- Zusammen: alle laufenden Auktionen (abgelaufene zählen nicht)
  if sum.active > 0 then
    self.totalRow.label:SetText(string.format("Zusammen: %d %s · %d Stück", sum.active, sum.active == 1 and "Auktion" or "Auktionen", sum.items or 0))
    self.totalRow.value:SetText(ns.Money(sum.value) .. "  |cff93a39d(nach Gebühr ca. " .. ns.Money(math.floor(sum.value * M.CutFactor())) .. ")|r")
    self.totalRow:ClearAllPoints()
    self.totalRow:SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y)
    self.totalRow:Show()
    y = y + 48 + 22
  else
    self.totalRow:Hide()
    y = y + 14
  end

  local sold = {}
  for i, e in ipairs(s.sold) do
    if i > 20 then break end
    sold[#sold + 1] = {
      id = e.id, name = (not e.id) and e.name or nil,
      cells = { qty = e.qty and tostring(e.qty) or "?", gold = e.amount and ns.Money(e.amount) or "–",
        where = whereText(e), when = date("%d.%m. %H:%M", e.time) },
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

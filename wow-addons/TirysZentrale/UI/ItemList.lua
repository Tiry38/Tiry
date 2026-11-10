-- Tiry's Zentrale – wiederverwendbare Item-Liste: gestapelte Glas-Pillen (Symbol-Kugel, Name, Werte rechts)
-- statt Tabelle; darüber eine schlanke Sortier-Leiste (aktiver Wert leuchtet Neon mit Pfeil)
local _, ns = ...
local UI = ns.UI
local C = UI.C

local ROW_H = 48   -- Abstand der Zeilen (Pille 42 hoch + 6 Luft)
local PILL_H = 42
local HEAD_H = 30

-- columns: { { key, label, width, align } ... } – Werte liefert fill(row, data) -> { [key] = text }
function UI.ItemList(parent, width, columns, opts)
  local list = CreateFrame("Frame", nil, parent)
  list:SetWidth(width)
  list.rows = {}
  list.columns = columns

  -- Kopf: schlanke Sortier-Leiste (Glas-Kapsel, kein Tabellenkopf)
  local head = CreateFrame("Frame", nil, list)
  head:SetPoint("TOPLEFT")
  head:SetSize(width, HEAD_H - 4)
  head.track = UI.Round(head, (HEAD_H - 4) / 2, "BACKGROUND", 0)
  head.track:SetGradientV({ 0.10, 0.125, 0.122, 0.55 }, { 0.05, 0.06, 0.066, 0.55 })
  local x = (opts and opts.action) and (width - 40) or (width - 6)
  list.heads = {}
  for i = #columns, 1, -1 do
    local col = columns[i]
    local t = UI.Text(head, 12, "semibold", C.dim)
    t:SetWidth(col.width)
    t:SetJustifyH(col.align or "RIGHT")
    t:SetPoint("RIGHT", head, "LEFT", x - 12, 0)
    t:SetText(col.label)
    col.x = x - 12
    list.heads[col.key] = { text = t, col = col, head = head }
    -- Sortieren per Klick auf die Spaltenüberschrift
    if opts and opts.onSort then
      local b = UI.SafeButton(head)
      b:SetSize(col.width + 8, 24)
      b:SetPoint("RIGHT", head, "LEFT", x - 8, 0)
      b.arrow = b:CreateTexture(nil, "OVERLAY")
      b.arrow:SetTexture(UI.Icon("chevron"))
      b.arrow:SetSize(10, 10)
      b.arrow:SetPoint("RIGHT", t, "RIGHT", 0, 0)
      b.arrow:Hide()
      b:SetScript("OnClick", function() UI.PlayClick() opts.onSort(col.key) end)
      b:SetScript("OnEnter", function(self)
        t:SetTextColor(C.text[1], C.text[2], C.text[3], 1)
        GameTooltip:SetOwner(self, "ANCHOR_TOP")
        GameTooltip:SetText("Sortieren: " .. col.label, 1, 1, 1)
        GameTooltip:AddLine("Klick: teuer zuerst. Nochmal klicken: günstig zuerst.", 0.8, 0.8, 0.8, true)
        GameTooltip:Show()
      end)
      b:SetScript("OnLeave", function()
        GameTooltip:Hide()
        list:SetSort(list.sortKey, list.sortDesc)
      end)
      list.heads[col.key].btn = b
    end
    x = x - col.width - 10
  end

  -- Sortier-Anzeige: aktive Spalte hell + Pfeil (unten = teuer zuerst, oben = günstig zuerst)
  function list:SetSort(key, desc)
    self.sortKey, self.sortDesc = key, desc
    for k, h in pairs(self.heads) do
      local on = k == key
      local c = on and C.amber or C.dim
      h.text:SetTextColor(c[1], c[2], c[3], 1)
      -- aktive Spalte: Text 14 px nach links, rechts daneben der Pfeil
      h.text:ClearAllPoints()
      h.text:SetPoint("RIGHT", h.head, "LEFT", h.col.x - ((on and h.btn) and 14 or 0), 0)
      if h.btn then
        h.btn.arrow:SetShown(on)
        if on then
          h.btn.arrow:SetRotation(desc and -math.pi / 2 or math.pi / 2)
          h.btn.arrow:SetVertexColor(C.amber[1], C.amber[2], C.amber[3], 1)
          h.btn.arrow:ClearAllPoints()
          h.btn.arrow:SetPoint("RIGHT", h.head, "LEFT", h.col.x, 0)
        end
      end
    end
  end
  local nameHead = UI.Text(head, 12, "semibold", C.dim)
  nameHead:SetPoint("LEFT", 60, 0)
  nameHead:SetText("Item")
  list.nameHead = nameHead
  list.nameWidth = x - 60 - 8

  local function getRow(i)
    local row = list.rows[i]
    if row then return row end
    row = UI.SafeButton(list)
    row:SetSize(width, PILL_H)
    row:RegisterForClicks("LeftButtonUp", "RightButtonUp")
    -- Glas-Pille: Lichtkante + Körper (beim Überfahren Neon-Rand)
    local shape = UI.PillShape(row, PILL_H, 0, false)
    row.edge, row.bg = shape.edge, shape.body
    function row:Paint(hover)
      if hover then
        self.edge:SetGradient(UI.GRAD_EDGE, 0.55)
        self.bg:SetGradientV(UI.GLASS.pillHi[1], UI.GLASS.pillHi[2], 0.92)
      else
        self.edge:SetGradientV({ 0.60, 1.00, 0.85, 0.13 }, { 0.20, 0.55, 0.65, 0.04 })
        self.bg:SetGradientV(UI.GLASS.card[1], UI.GLASS.card[2], 0.62)
      end
    end
    row.icon = UI.ItemIcon(row, 34)
    row.icon:SetPoint("LEFT", 4, 0)
    row.name = UI.Text(row, 13, "semibold", C.text)
    row.name:SetPoint("LEFT", row.icon, "RIGHT", 14, 6)
    row.name:SetWidth(list.nameWidth)
    row.name:SetWordWrap(false)
    row.chip = UI.Chip(row, "", C.gold)
    row.chip:Hide()
    row.note = UI.Text(row, 12, "regular", C.dim)
    row.note:SetPoint("TOPLEFT", row.name, "BOTTOMLEFT", 0, -2)
    row.note:SetWidth(list.nameWidth)
    row.note:SetWordWrap(false)
    row.cells = {}
    for _, col in ipairs(columns) do
      local t = UI.Text(row, 12, col.bold and "semibold" or "regular", C.text)
      t:SetWidth(col.width)
      t:SetJustifyH(col.align or "RIGHT")
      t:SetPoint("RIGHT", row, "LEFT", col.x, 0)
      t:SetWordWrap(false)
      row.cells[col.key] = t
    end
    if opts and opts.action then
      row.action = UI.IconButton(row, "close", 28)
      row.action:SetPoint("RIGHT", -7, 0)
      row.action:SetScript("OnClick", function(b)
        local r = b:GetParent()
        if r.actionFn then r.actionFn(r) end
      end)
      row.action:HookScript("OnEnter", function(b)
        local r = b:GetParent()
        if r.actionTip then
          GameTooltip:SetOwner(b, "ANCHOR_RIGHT")
          GameTooltip:SetText(r.actionTip, 0.22, 1, 0.42)
          GameTooltip:Show()
        end
      end)
      row.action:HookScript("OnLeave", function() GameTooltip:Hide() end)
    end
    row:SetScript("OnEnter", function(self)
      self:Paint(true)
      if self.itemID then
        GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
        local ok = pcall(GameTooltip.SetItemByID, GameTooltip, self.itemID)
        if not ok then GameTooltip:SetText(ns.Item(self.itemID).name) end
        if self.tipLines then
          GameTooltip:AddLine(" ")
          for _, line in ipairs(self.tipLines) do
            GameTooltip:AddLine(line, 0.47, 1, 0.58, true)
          end
        end
        GameTooltip:AddLine("Shift-Klick: Link in den Chat", 0.6, 0.57, 0.75)
        GameTooltip:Show()
      end
    end)
    row:SetScript("OnLeave", function(self)
      self:Paint(false)
      GameTooltip:Hide()
    end)
    row:SetScript("OnClick", function(self, button)
      if self.itemID and IsShiftKeyDown() then
        ns.LinkItem(self.itemID)
      elseif self.onClick then
        self.onClick(self, button)
      end
    end)
    list.rows[i] = row
    return row
  end

  -- entries: Liste von Tabellen { id = itemID, note = "...", cells = { key = text }, tip = { lines },
  --          chip = { Text, Farbe } (optional, kleines Etikett hinter dem Namen) }
  function list:SetEntries(entries, emptyText)
    for i, e in ipairs(entries) do
      local row = getRow(i)
      row:ClearAllPoints()
      row:SetPoint("TOPLEFT", self, "TOPLEFT", 0, -HEAD_H - (i - 1) * ROW_H)
      row.itemID = e.id
      row.tipLines = e.tip
      row.onClick = e.onClick
      row.actionFn, row.actionTip = e.action, e.actionTip
      if row.action then row.action:SetShown(e.action ~= nil) end
      row:Paint(false)
      local chipW = 0
      if e.chip then
        row.chip:Set(e.chip[1], e.chip[2])
        chipW = row.chip:GetWidth() + 8
      end
      row.chip:SetShown(e.chip ~= nil)
      local nameMax = list.nameWidth - chipW
      if e.id then
        local item = ns.Item(e.id)
        row.icon:SetItem(e.id)
        local q = UI.QUALITY[item.quality or 1] or UI.QUALITY[1]
        UI.FitText(row.name, e.name or item.name, nameMax)
        row.name:SetTextColor(q[1], q[2], q[3], 1)
      else
        row.icon:SetIcon(e.icon or UI.TEX.logo, e.iconColor)
        UI.FitText(row.name, e.name or "", nameMax)
        row.name:SetTextColor(C.text[1], C.text[2], C.text[3], 1)
      end
      if e.chip then
        -- Name nur so breit wie sein Text, Chip direkt dahinter
        local nw = math.min(nameMax, math.ceil(row.name:GetUnboundedStringWidth()) + 2)
        row.name:SetWidth(nw)
        row.chip:ClearAllPoints()
        row.chip:SetPoint("LEFT", row.name, "RIGHT", 6, 0)
      else
        row.name:SetWidth(list.nameWidth)
      end
      UI.FitText(row.note, e.note or "", list.nameWidth)
      if e.note and e.note ~= "" then
        row.name:SetPoint("LEFT", row.icon, "RIGHT", 14, 8)
      else
        row.name:SetPoint("LEFT", row.icon, "RIGHT", 14, 0)
      end
      for key, fs in pairs(row.cells) do
        local v = e.cells and e.cells[key]
        fs:SetText(v or "")
      end
      row:Show()
    end
    for i = #entries + 1, #self.rows do
      self.rows[i]:Hide()
    end
    if not self.empty then
      self.empty = UI.Para(self, 12, C.dim, width - 40)
      self.empty:SetPoint("TOPLEFT", 16, -HEAD_H - 10)
      self.empty:SetJustifyH("LEFT")
    end
    self.empty:SetText(#entries == 0 and (emptyText or "Keine Einträge.") or "")
    self.empty:SetShown(#entries == 0)
    local h = HEAD_H + math.max(#entries, 1) * ROW_H + ((#entries == 0) and 20 or 0)
    self:SetHeight(h)
    return h
  end

  list:SetHeight(HEAD_H)
  return list
end

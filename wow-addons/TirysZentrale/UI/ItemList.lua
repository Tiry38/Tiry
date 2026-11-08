-- Tiry's Zentrale – wiederverwendbare Item-Liste (Zeilen mit Symbol, Name, Wertespalten)
local ADDON, ns = ...
local UI = ns.UI
local C = UI.C

local ROW_H = 44

-- columns: { { key, label, width, align } ... } – Werte liefert fill(row, data) -> { [key] = text }
function UI.ItemList(parent, width, columns, opts)
  local list = CreateFrame("Frame", nil, parent)
  list:SetWidth(width)
  list.rows = {}
  list.columns = columns

  -- Kopfzeile
  local head = CreateFrame("Frame", nil, list)
  head:SetPoint("TOPLEFT")
  head:SetSize(width, 24)
  local x = (opts and opts.action) and (width - 34) or width
  for i = #columns, 1, -1 do
    local col = columns[i]
    local t = UI.Text(head, 10, "semibold", C.dim)
    t:SetWidth(col.width)
    t:SetJustifyH(col.align or "RIGHT")
    t:SetPoint("RIGHT", head, "LEFT", x - 12, 0)
    t:SetText(col.label:upper())
    col.x = x - 12
    x = x - col.width - 10
  end
  local nameHead = UI.Text(head, 10, "semibold", C.dim)
  nameHead:SetPoint("LEFT", 54, 0)
  nameHead:SetText("ITEM")
  list.nameWidth = x - 54 - 8

  local function getRow(i)
    local row = list.rows[i]
    if row then return row end
    row = CreateFrame("Button", nil, list)
    row:SetSize(width, ROW_H - 4)
    row:RegisterForClicks("LeftButtonUp", "RightButtonUp")
    row.bg = UI.Round(row, 14, "BACKGROUND", 0)
    row.bg:SetColor(C.card, 0.0)
    row.icon = UI.ItemIcon(row, 32)
    row.icon:SetPoint("LEFT", 10, 0)
    row.name = UI.Text(row, 13, "semibold", C.text)
    row.name:SetPoint("LEFT", row.icon, "RIGHT", 12, 6)
    row.name:SetWidth(list.nameWidth)
    row.name:SetWordWrap(false)
    row.note = UI.Text(row, 10, "regular", C.dim)
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
      row.action = UI.IconButton(row, "close", 24)
      row.action:SetPoint("RIGHT", -6, 0)
      row.action:SetScript("OnClick", function(b)
        local r = b:GetParent()
        if r.actionFn then r.actionFn(r) end
      end)
      row.action:HookScript("OnEnter", function(b)
        local r = b:GetParent()
        if r.actionTip then
          GameTooltip:SetOwner(b, "ANCHOR_RIGHT")
          GameTooltip:SetText(r.actionTip, 1, 0.6, 0.16)
          GameTooltip:Show()
        end
      end)
      row.action:HookScript("OnLeave", function() GameTooltip:Hide() end)
    end
    row:SetScript("OnEnter", function(self)
      self.bg:SetColor(C.cardHi, 0.85)
      if self.itemID then
        GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
        local ok = pcall(GameTooltip.SetItemByID, GameTooltip, self.itemID)
        if not ok then GameTooltip:SetText(ns.Item(self.itemID).name) end
        if self.tipLines then
          GameTooltip:AddLine(" ")
          for _, line in ipairs(self.tipLines) do
            GameTooltip:AddLine(line, 1, 0.6, 0.16, true)
          end
        end
        GameTooltip:AddLine("Shift-Klick: Link in den Chat", 0.6, 0.57, 0.75)
        GameTooltip:Show()
      end
    end)
    row:SetScript("OnLeave", function(self)
      self.bg:SetColor(C.card, self.zebra and 0.45 or 0)
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

  -- entries: Liste von Tabellen { id = itemID, note = "...", cells = { key = text }, tip = { lines } }
  function list:SetEntries(entries, emptyText)
    for i, e in ipairs(entries) do
      local row = getRow(i)
      row:ClearAllPoints()
      row:SetPoint("TOPLEFT", self, "TOPLEFT", 0, -26 - (i - 1) * ROW_H)
      row.itemID = e.id
      row.tipLines = e.tip
      row.onClick = e.onClick
      row.actionFn, row.actionTip = e.action, e.actionTip
      if row.action then row.action:SetShown(e.action ~= nil) end
      row.zebra = (i % 2 == 0)
      row.bg:SetColor(C.card, row.zebra and 0.45 or 0)
      if e.id then
        local item = ns.Item(e.id)
        row.icon:SetItem(e.id)
        local q = UI.QUALITY[item.quality or 1] or UI.QUALITY[1]
        UI.FitText(row.name, e.name or item.name, list.nameWidth)
        row.name:SetTextColor(q[1], q[2], q[3], 1)
      else
        row.icon:SetIcon(e.icon or UI.TEX.logo, e.iconColor)
        UI.FitText(row.name, e.name or "", list.nameWidth)
        row.name:SetTextColor(C.text[1], C.text[2], C.text[3], 1)
      end
      UI.FitText(row.note, e.note or "", list.nameWidth)
      if e.note and e.note ~= "" then
        row.name:SetPoint("LEFT", row.icon, "RIGHT", 12, 7)
      else
        row.name:SetPoint("LEFT", row.icon, "RIGHT", 12, 0)
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
      self.empty:SetPoint("TOPLEFT", 16, -36)
      self.empty:SetJustifyH("LEFT")
    end
    self.empty:SetText(#entries == 0 and (emptyText or "Keine Einträge.") or "")
    self.empty:SetShown(#entries == 0)
    local h = 26 + math.max(#entries, 1) * ROW_H + ((#entries == 0) and 20 or 0)
    self:SetHeight(h)
    return h
  end

  list:SetHeight(26)
  return list
end

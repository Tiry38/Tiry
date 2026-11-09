---------------------------------------------------------------------------
-- ChatHoch 1.4.0 (Tiry): Chat dauerhaft hoeher + alle angedockten Reiter
-- (Gilde usw.) exakt auf das Hauptfenster legen. Setzt sich nach jedem
-- Laden/Bearbeitungsmodus neu, damit nichts zurueckspringt.
---------------------------------------------------------------------------
local function P(m) DEFAULT_CHAT_FRAME:AddMessage("|cff4dd9ffChat|r|cffff6a14Hoch|r " .. m) end
local busy = false
local ERR = {}
local function try(key, fn) local ok, e = pcall(fn); if not ok then ERR[key] = tostring(e) end; return ok end

local function apply()
  if not ChatHochDB or busy then return end
  local cf = ChatFrame1
  if not cf then return end
  busy = true
  local h = ChatHochDB.h
  pcall(function()
    if cf.SetResizeBounds then cf:SetResizeBounds(100, 40, 4000, 2000) end
    if cf.SetMaxResize then cf:SetMaxResize(4000, 2000) end
  end)
  if h and h > 0 and math.abs((cf:GetHeight() or 0) - h) > 0.5 then pcall(cf.SetHeight, cf, h) end
  for i = 3, (NUM_CHAT_WINDOWS or 10) do
    local f = _G["ChatFrame" .. i]
    if f and f.isDocked then
      -- Ursache der 32 px: Blizzard haelt per "Clamp-Insets" links Platz fuer die Knopfleiste frei.
      -- Gleiche Insets wie das Hauptfenster -> Fenster darf bis ganz nach links.
      try("clamp" .. i, function()
        local l, r, t, b = cf:GetClampRectInsets()
        f:SetClampRectInsets(l or 0, r or 0, t or 0, b or 0)
      end)
      local okA = try("anker" .. i, function()
        f:ClearAllPoints()
        f:SetPoint("TOPLEFT", cf, "TOPLEFT", 0, 0)
        f:SetPoint("BOTTOMRIGHT", cf, "BOTTOMRIGHT", 0, 0)
      end)
      -- Plan B: falls das Fenster nicht verschoben werden darf -> Textbereich nach links ziehen
      local okL, l1 = pcall(cf.GetLeft, cf)
      local okL2, l2 = pcall(f.GetLeft, f)
      if okL and okL2 and l1 and l2 and math.abs(l2 - l1) > 1 and f.FontStringContainer then
        local dx = l1 - l2
        try("text" .. i, function()
          local c = f.FontStringContainer
          c:ClearAllPoints()
          c:SetPoint("TOPLEFT", f, "TOPLEFT", dx, 0)
          c:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", 0, 0)
        end)
      end
      if not f.__tiryHook then
        f.__tiryHook = true
        pcall(function()
          hooksecurefunc(f, "SetPoint", function() if not busy then C_Timer.After(0, apply) end end)
        end)
      end
      -- leere Knopfleiste links (verschiebt den Reiter optisch) ausblenden
      local bf = _G["ChatFrame" .. i .. "ButtonFrame"]
      if bf and not bf.__tiry then
        bf.__tiry = true
        pcall(function() bf:Hide(); hooksecurefunc(bf, "Show", function(x) x:Hide() end) end)
      end
      -- Hintergrund exakt wie beim Hauptfenster
      local bg, bg1 = _G["ChatFrame" .. i .. "Background"], _G["ChatFrame1Background"]
      if bg and bg1 then
        pcall(function() bg:ClearAllPoints(); bg:SetPoint("TOPLEFT", bg1, "TOPLEFT"); bg:SetPoint("BOTTOMRIGHT", bg1, "BOTTOMRIGHT") end)
      end
    end
  end
  if ChatHochDB.knopf ~= "aus" and QuickJoinToastButton and ChatFrame1Background then
    local q = QuickJoinToastButton
    try("gesellig", function()
      q:ClearAllPoints()
      q:SetPoint("BOTTOMRIGHT", ChatFrame1Background, "TOPRIGHT", 0, 4)
    end)
    if not q.__tiryHook then
      q.__tiryHook = true
      pcall(function() hooksecurefunc(q, "SetPoint", function() if not busy then C_Timer.After(0, apply) end end) end)
    end
  end
  if ChatHochDB.knopf ~= "aus" then
    local bf, bg1 = ChatFrame1ButtonFrame, ChatFrame1Background
    if bf and bg1 then
      try("knopf", function()
        bf:ClearAllPoints()
        bf:SetPoint("TOPLEFT", bg1, "TOPRIGHT", 2, 0)
        bf:SetPoint("BOTTOMLEFT", bg1, "BOTTOMRIGHT", 2, 0)
      end)
      if not bf.__tiryHook then
        bf.__tiryHook = true
        pcall(function() hooksecurefunc(bf, "SetPoint", function() if not busy then C_Timer.After(0, apply) end end) end)
      end
    end
  end
  busy = false
end

local function later()
  for _, t in ipairs({ 0.1, 0.5, 2, 5 }) do C_Timer.After(t, apply) end
end

local E = CreateFrame("Frame")
for _, e in ipairs({ "PLAYER_LOGIN", "PLAYER_ENTERING_WORLD", "EDIT_MODE_LAYOUTS_UPDATED",
  "UPDATE_CHAT_WINDOWS", "UPDATE_FLOATING_CHAT_WINDOWS", "DISPLAY_SIZE_CHANGED", "UI_SCALE_CHANGED" }) do
  pcall(E.RegisterEvent, E, e)
end
E:SetScript("OnEvent", function(_, ev)
  if ev == "PLAYER_LOGIN" then
    ChatHochDB = ChatHochDB or {}
    if ChatHochDB.h == nil then ChatHochDB.h = 320 end
    pcall(function()
      hooksecurefunc(ChatFrame1, "SetHeight", function() if not busy then C_Timer.After(0, apply) end end)
      hooksecurefunc(ChatFrame1, "SetSize", function() if not busy then C_Timer.After(0, apply) end end)
    end)
    for _, fn in ipairs({ "FCF_DockFrame", "FCF_Tab_OnClick", "FCFDock_SelectWindow", "FCFDock_UpdateTabs", "FCF_UpdateButtonSide" }) do
      pcall(function() hooksecurefunc(fn, function() if not busy then C_Timer.After(0, apply) end end) end)
    end
    P("aktiv – Höhe " .. (ChatHochDB.h or 0) .. " · ändern mit /chathoch 380")
  end
  apply(); later()
end)

SLASH_CHATHOCH1 = "/chathoch"
SlashCmdList.CHATHOCH = function(msg)
  if not ChatHochDB then return end
  local v = tonumber((msg or ""):match("%d+"))
  if v then
    ChatHochDB.h = math.max(80, math.min(1400, v)); apply()
    P("Höhe jetzt " .. ChatHochDB.h)
  elseif (msg or ""):lower():find("info") then
    apply()
    local q = QuickJoinToastButton
    local okQ, ql = pcall(function() return q and q:GetLeft() end)
    P("Version 1.4.0 · Geselligkeit-Knopf bei " .. ((okQ and ql) and math.floor(ql + 0.5) or "?"))
    for k, e in pairs(ERR) do P("|cffff5050Fehler " .. k .. ":|r " .. e) end
    local function L(n) local f = _G[n]; if not f then return "–" end
      local okL, l = pcall(f.GetLeft, f); local okS, sh = pcall(f.IsShown, f)
      return (okL and l and math.floor(l + 0.5) or "?") .. ((okS and sh) and "+" or "-") end
    for i = 1, (NUM_CHAT_WINDOWS or 10) do
      local n = GetChatWindowInfo(i)
      if n and n ~= "" then
        P(i .. " " .. n .. ": Fenster " .. L("ChatFrame" .. i) .. " · Hintergrund " .. L("ChatFrame" .. i .. "Background")
          .. " · Knopfleiste " .. L("ChatFrame" .. i .. "ButtonFrame")
          .. " · Clamp " .. (function() local f = _G["ChatFrame" .. i]; local ok, a = pcall(f.GetClampRectInsets, f); return ok and tostring(math.floor((a or 0) + 0.5)) or "?" end)() .. " · angedockt " .. tostring(_G["ChatFrame" .. i] and _G["ChatFrame" .. i].isDocked))
      end
    end
  elseif (msg or ""):lower():find("knopf") then
    ChatHochDB.knopf = (ChatHochDB.knopf == "aus") and "rechts" or "aus"
    P("Geselligkeits-Knopfleiste: " .. (ChatHochDB.knopf == "aus" and "nicht mehr verschieben (/reload)" or "rechts am Chat"))
    apply()
  elseif (msg or ""):lower():find("aus") then
    ChatHochDB.h = 0; P("Höhe wird nicht mehr gesetzt (Reiter bleiben bündig). /reload")
  else
    P("Höhe: " .. (ChatHochDB.h or 0) .. " · /chathoch 380 · /chathoch aus · /chathoch knopf · /chathoch info")
  end
end

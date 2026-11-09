---------------------------------------------------------------------------
-- MiniPost 1.0.0 (Tiry): Post-Symbol unter die Uhr, alle anderen Minimap-Knoepfe unsichtbar.
---------------------------------------------------------------------------
local function P(m) DEFAULT_CHAT_FRAME:AddMessage("|cff4dd9ffMini|r|cffff6a14Post|r " .. m) end
-- Minimap-Aufraeumer (Tiry): Post-Symbol unter die Uhr, alle anderen Knoepfe unsichtbar.
local env = {}

local function hideForever(f)
  if type(f) ~= "table" or not f.Hide or f.__tiryHidden then return end
  f.__tiryHidden = true
  pcall(function()
    f:SetAlpha(0)
    if f.EnableMouse then f:EnableMouse(false) end
    f:Hide()
    hooksecurefunc(f, "Show", function(s) s:Hide() end)
    hooksecurefunc(f, "SetAlpha", function(s, a) if a and a > 0 then s:SetAlpha(0) end end)
  end)
end

local function mailFrame()
  return (MinimapCluster and MinimapCluster.IndicatorFrame and MinimapCluster.IndicatorFrame.MailFrame)
    or MiniMapMailFrame
end

local function placeMail()
  local mail, clock = mailFrame(), TimeManagerClockButton
  if not mail or not clock then return end
  if not mail.__tiryMail then
    mail.__tiryMail = true
    hooksecurefunc(mail, "SetPoint", function(s)
      if not s.__tiryBusy then placeMail() end
    end)
  end
  mail.__tiryBusy = true
  pcall(function()
    mail:ClearAllPoints()
    mail:SetPoint("TOP", clock, "BOTTOM", 0, -2)
    mail:SetFrameStrata("HIGH")
    mail:SetAlpha(1)
  end)
  mail.__tiryBusy = false
end

local function keep(f)
  local mail = mailFrame()
  return f == Minimap or f == TimeManagerClockButton or f == mail
    or (MinimapCluster and f == MinimapCluster.IndicatorFrame)
end

local function sweep(parent)
  if not parent or not parent.GetChildren then return end
  for _, c in ipairs({ parent:GetChildren() }) do
    if type(c) == "table" and not keep(c) then
      local okT, t = pcall(c.GetObjectType, c)
      local name = (c.GetName and c:GetName()) or ""
      if (okT and (t == "Button" or t == "DropdownButton" or t == "CheckButton"))
        or name:find("^LibDBIcon") or name:find("MinimapButton") then
        hideForever(c)
      end
    end
  end
end

local function apply()
  -- bekannte Blizzard-Knoepfe
  local list = {
    Minimap and Minimap.ZoomIn, Minimap and Minimap.ZoomOut, MinimapZoomIn, MinimapZoomOut,
    MinimapCluster and MinimapCluster.Tracking, MiniMapTracking, MiniMapTrackingButton,
    GameTimeFrame, ExpansionLandingPageMinimapButton, AddonCompartmentFrame, MiniMapWorldMapButton,
    MinimapCluster and MinimapCluster.IndicatorFrame and MinimapCluster.IndicatorFrame.CraftingOrderFrame,
  }
  for i = 1, #list + 20 do
    local f = list[i]
    if type(f) == "table" then pcall(function() if not keep(f) then hideForever(f) end end) end
  end
  -- Addon-Knoepfe (LibDBIcon) + alles, was als Knopf an der Minimap haengt
  pcall(function()
    local LDB = LibStub and LibStub("LibDBIcon-1.0", true)
    if LDB and LDB.objects then
      for _, b in pairs(LDB.objects) do hideForever(b) end
    end
  end)
  pcall(sweep, Minimap)
  pcall(sweep, MinimapCluster)
  if MinimapBackdrop then pcall(sweep, MinimapBackdrop) end
  pcall(placeMail)
end


local function run()
  pcall(apply)
  pcall(function()
    local LDB = LibStub and LibStub("LibDBIcon-1.0", true)
    if LDB and LDB.RegisterCallback and not env.cb then
      env.cb = true
      LDB.RegisterCallback(env, "LibDBIcon_IconCreated", function(_, b) hideForever(b) end)
    end
  end)
end

local E = CreateFrame("Frame")
E:RegisterEvent("PLAYER_LOGIN")
E:RegisterEvent("ADDON_LOADED")
E:RegisterEvent("PLAYER_ENTERING_WORLD")
E:SetScript("OnEvent", function(_, ev, name)
  if ev == "ADDON_LOADED" and name ~= "Blizzard_TimeManager" and name ~= "SexyMap" then return end
  run()
  if ev == "PLAYER_LOGIN" then
    for _, t in ipairs({ 1, 3, 6, 12, 25 }) do C_Timer.After(t, run) end
  end
end)

-- /minipost : zeigt, was noch an der Minimap sichtbar ist (fuer Nachbesserung)
SLASH_MINIPOST1 = "/minipost"
SlashCmdList.MINIPOST = function()
  run()
  local out = {}
  local function list(parent, label)
    if not parent or not parent.GetChildren then return end
    for _, c in ipairs({ parent:GetChildren() }) do
      local okV, vis = pcall(c.IsVisible, c)
      local okA, a = pcall(c.GetEffectiveAlpha, c)
      if okV and vis and okA and a > 0.05 then
        local okT, t = pcall(c.GetObjectType, c)
        out[#out + 1] = label .. ":" .. ((c.GetName and c:GetName()) or "?") .. "(" .. (okT and t or "?") .. ")"
      end
    end
  end
  list(Minimap, "M"); list(MinimapCluster, "C"); list(MinimapBackdrop, "B")
  local mail = mailFrame()
  P("Post-Rahmen: " .. tostring(mail and (mail:GetName() or "MailFrame")) .. " · Uhr: " .. tostring(TimeManagerClockButton ~= nil))
  P("Noch sichtbar (" .. #out .. "): " .. table.concat(out, ", "))
end

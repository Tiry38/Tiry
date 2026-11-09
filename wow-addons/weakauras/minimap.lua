-- Minimap-Aufraeumer (Tiry): Post-Symbol unter die Uhr, alle anderen Knoepfe unsichtbar.
local env = aura_env

local function hideForever(f)
  if not f or f.__tiryHidden then return end
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
    if not keep(c) then
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
    if f and not keep(f) then hideForever(f) end
  end
  -- Addon-Knoepfe (LibDBIcon) + alles, was als Knopf an der Minimap haengt
  pcall(function()
    local LDB = LibStub and LibStub("LibDBIcon-1.0", true)
    if LDB and LDB.objects then
      for _, b in pairs(LDB.objects) do hideForever(b) end
    end
  end)
  sweep(Minimap)
  sweep(MinimapCluster)
  if MinimapBackdrop then sweep(MinimapBackdrop) end
  placeMail()
end

apply()
-- Addons/SexyMap/Uhr laden teils spaeter -> nachziehen
for _, t in ipairs({ 1, 3, 6, 12 }) do C_Timer.After(t, function() pcall(apply) end) end
pcall(function()
  local LDB = LibStub and LibStub("LibDBIcon-1.0", true)
  if LDB and LDB.RegisterCallback and not env.cb then
    env.cb = true
    LDB.RegisterCallback(env, "LibDBIcon_IconCreated", function(_, b) hideForever(b) end)
  end
end)

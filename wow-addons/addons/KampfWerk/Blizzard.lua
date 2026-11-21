-- KampfWerk: Blizzards eigenes Schadensmeter auf Wunsch verstecken. Es bleibt eingeschaltet (die Daten kommen ja
-- von dort) - nur das Fenster "DamageMeter" (Blizzard_DamageMeter/DamageMeter.xml) wird ausgeblendet.
local _, ns = ...
local B = {}
ns.Blizzard = B

local function frame() return _G.DamageMeter end

function B.Apply()
  local f = frame()
  if not f then return end
  if not B.hooked and f.HookScript then
    B.hooked = true
    f:HookScript("OnShow", function(self) if ns.DB and ns.DB.hideBlizzard then self:Hide() end end)
  end
  if ns.DB.hideBlizzard then
    f:Hide()
  elseif B.wasHidden and f.UpdateShownState then
    pcall(f.UpdateShownState, f)
  end
  B.wasHidden = ns.DB.hideBlizzard
end

-- Blizzard_DamageMeter laedt evtl. erst spaeter
ns.On("ADDON_LOADED", function(_, name)
  if name == "Blizzard_DamageMeter" and ns.DB then B.Apply() end
end)

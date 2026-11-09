local Obj={} Obj.__index=function(t,k)
  if type(k)=="string" and k:sub(1,2)=="__" then return nil end
  if k=="GetChildren" then return function(s) return unpack(rawget(s,"kids") or {}) end end
  if k=="GetObjectType" then return function(s) return rawget(s,"otype") or "Frame" end end
  if k=="GetName" then return function(s) return rawget(s,"nm") end end
  if k=="IsVisible" then return function(s) return not rawget(s,"hidden") end end
  if k=="GetEffectiveAlpha" then return function(s) return rawget(s,"alpha") or 1 end end
  if k=="Hide" then return function(s) rawset(s,"hidden",true) end end
  if k=="SetAlpha" then return function(s,a) rawset(s,"alpha",a) end end
  if k=="SetScript" then return function(s,n,f) rawset(s,"_"..n,f) end end
  return function() end end
local function F(nm,ot) return setmetatable({nm=nm,otype=ot},Obj) end
function CreateFrame() return F() end
function hooksecurefunc() end
DEFAULT_CHAT_FRAME={AddMessage=function(_,m) print((m:gsub("|c%x%x%x%x%x%x%x%x",""):gsub("|r",""))) end}
C_Timer={After=function() end} SlashCmdList={}
TimeManagerClockButton=F("TimeManagerClockButton","Button")
local mail=F("MailFrame","Frame")
Minimap=F("Minimap") Minimap.ZoomIn=F("ZoomIn","Button") Minimap.ZoomOut=F("ZoomOut","Button")
local ldb=F("LibDBIcon10_Questie","Button")
Minimap.kids={TimeManagerClockButton,Minimap.ZoomIn,Minimap.ZoomOut,ldb,F("SexyMapRahmen","Frame")}
MinimapCluster=F("MinimapCluster") MinimapCluster.IndicatorFrame=F("IndicatorFrame") MinimapCluster.IndicatorFrame.MailFrame=mail
MinimapCluster.kids={MinimapCluster.IndicatorFrame,F("Tracking","DropdownButton")}
GameTimeFrame=F("GameTimeFrame","Button")
local E
local cf=CreateFrame CreateFrame=function() E=cf() return E end
dofile("MiniPost.lua")
E._OnEvent(E,"PLAYER_LOGIN")
SlashCmdList.MINIPOST()
print("Mail versteckt? ",tostring(rawget(mail,"hidden")),"  Uhr versteckt? ",tostring(rawget(TimeManagerClockButton,"hidden")),"  Kalender versteckt? ",tostring(rawget(GameTimeFrame,"hidden")))

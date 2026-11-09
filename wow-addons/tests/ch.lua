local Obj={} Obj.__index=function(t,k)
  if type(k)=="string" and (k:sub(1,2)=="__" or k=="isDocked") then return nil end
  if k=="GetHeight" then return function(s) return rawget(s,"h") or 120 end end
  if k=="SetHeight" then return function(s,v) rawset(s,"h",v) end end
  if k=="SetAllPoints" then return function(s,o) rawset(s,"on",o) end end
  if k=="SetScript" then return function(s,n,f) rawset(s,"_"..n,f) end end
  return function() end end
local function F(n) return setmetatable({nm=n},Obj) end
local E local cf=function() local f=F() E=f return f end CreateFrame=cf
function hooksecurefunc() end ChatFrame1ButtonFrame=nil C_Timer={After=function(_,f) f() end}
DEFAULT_CHAT_FRAME={AddMessage=function(_,m) print((m:gsub("|c%x%x%x%x%x%x%x%x",""):gsub("|r",""))) end}
SlashCmdList={} NUM_CHAT_WINDOWS=10
ChatFrame1=F("1") ChatFrame2=F("2") ChatFrame3=F("3") rawset(ChatFrame3,"isDocked",true) rawset(ChatFrame2,"isDocked",true)
dofile("ChatHoch.lua")
E._OnEvent(E,"PLAYER_LOGIN")
print("Hoehe:",ChatFrame1.h," Gilde auf Allgemein:",rawget(ChatFrame3,"on")==ChatFrame1," Kampflog unberuehrt:",rawget(ChatFrame2,"on")==nil)
SlashCmdList.CHATHOCH("380") print("neu:",ChatFrame1.h)

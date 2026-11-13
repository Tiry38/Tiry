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
-- Geselligkeits-Knopf (QuickJoinToastButton): Blizzard zeigt ihn per Show/SetShown
local Q = { shown = true, hooks = {} }
function Q.Show(self) self.shown = true; for _, h in ipairs(self.hooks) do h(self) end end
function Q.SetShown(self, v) if v then self:Show() else self:Hide() end end
function Q.Hide(self) self.shown = false end
function Q.IsShown(self) return self.shown end
function Q.HookScript(self, n, f) if n == "OnShow" then self.hooks[#self.hooks + 1] = f end end
function Q.GetLeft() return 300 end
for _, k in ipairs({ "ClearAllPoints", "SetPoint" }) do Q[k] = function() Q.moved = true end end
QuickJoinToastButton = Q; ChatFrame1Background = F("bg1")
dofile("ChatHoch.lua")
E._OnEvent(E,"PLAYER_LOGIN")
print("Hoehe:",ChatFrame1.h," Gilde auf Allgemein:",rawget(ChatFrame3,"on")==ChatFrame1," Kampflog unberuehrt:",rawget(ChatFrame2,"on")==nil)
SlashCmdList.CHATHOCH("380") print("neu:",ChatFrame1.h)
local function ok(c, m) if not c then print("FEHLER: " .. m); os.exit(1) end end
ok(Q.shown == false, "Geselligkeits-Knopf nach Login weg")
Q:SetShown(true); ok(Q.shown == false, "Blizzard SetShown -> sofort wieder weg")
Q:Show(); ok(Q.shown == false, "Blizzard Show -> sofort wieder weg")
ok(#Q.hooks == 1, "nur ein Hook trotz mehrfachem apply")
SlashCmdList.CHATHOCH("gesellig"); ok(Q.shown == true and ChatHochDB.gesellig == "an", "/chathoch gesellig -> wieder da")
Q:Show(); ok(Q.shown == true, "an: bleibt sichtbar")
SlashCmdList.CHATHOCH("gesellig"); ok(Q.shown == false and ChatHochDB.gesellig == "weg", "/chathoch gesellig -> wieder weg")
ok(ChatHochDB.h == 380, "Hoehe unberuehrt")
print("CH TESTS OK")

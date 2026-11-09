BLITZ_DEBUG=function(s,t,c) io.write("      -> ",s," ",tostring(t or "")," Ladungen ",tostring(c or ""),"\n") end
local T=100 function GetTime() return T end
local Obj={} Obj.__index=function(t,k)
  if k=="GetPoint" then return function() return "CENTER",nil,"CENTER",0,0 end end
  if k=="GetFrameLevel" then return function() return 1 end end
  if k=="CreateTexture" or k=="CreateFontString" then return function() local o=setmetatable({},Obj) return o end end
  if k=="SetScript" then return function(s,n,f) local sc=rawget(s,"_s") or {} rawset(s,"_s",sc) sc[n]=f end end
  if k=="SetText" then return function(s,v) rawset(s,"txt",v) end end
  return function() end end
local frames={} function CreateFrame() local f=setmetatable({},Obj) frames[#frames+1]=f return f end
function CreateFont() return setmetatable({},Obj) end
UIParent=CreateFrame() STANDARD_TEXT_FONT="x" DEFAULT_CHAT_FRAME={AddMessage=function(_,m) print("   CHAT",(m:gsub("|c%x%x%x%x%x%x%x%x",""):gsub("|r",""))) end}
SlashCmdList={} function UnitClass() return "S","SHAMAN" end function UnitAffectingCombat() return false end
issecretvalue=function() return false end
local aura={spellId=10432,name="Blitzschlagschild",applications=3,expirationTime=T+595,duration=600,auraInstanceID=101}
local fight,present=false,true
local function q(f) return function(...) if fight then error("blocked") end return f(...) end end
C_UnitAuras={GetPlayerAuraBySpellID=q(function(id) if id==10432 and present then return aura end end),
 GetAuraDataByAuraInstanceID=q(function(u,id) if id==101 and present then return aura end end),
 GetAuraDataByIndex=q(function(u,i) if i==1 and present then return aura end end)}
C_Spell={GetSpellName=function(id) return id==10432 and "Blitzschlagschild" or "X" end}
-- FontStrings mitschneiden
local made={} local oldCT=Obj.__index
dofile("Blitzschild.lua")
local E for _,f in ipairs(frames) do local s=rawget(f,"_s") if s and s.OnEvent then E=f end end
local function ev(e,...) E._s.OnEvent(E,e,...) end
-- Texte finden: over-Frame FontStrings sind ueber Upvalues nicht greifbar -> Zustand ueber Debug
local function st(label) local i=1 while true do local n,v=debug.getupvalue(E._s.OnEvent,i) if not n then break end i=i+1 end print(label) end
ev("PLAYER_LOGIN")
ev("PLAYER_REGEN_DISABLED") fight=true  -- Werte werden VOR inCombat noch gelesen
ev("UNIT_AURA","player",{updatedAuraInstanceIDs={101}}) print("Treffer 1")
ev("UNIT_AURA","player",{updatedAuraInstanceIDs={7}}) print("anderer Buff")
ev("UNIT_AURA","player",{updatedAuraInstanceIDs={101}}) print("Treffer 2")
T=T+10 ev("UNIT_SPELLCAST_SUCCEEDED","player","g",10432)
ev("UNIT_AURA","player",{removedAuraInstanceIDs={101},addedAuras={{auraInstanceID=202}}}) print("neu gezaubert")
T=T+5 ev("UNIT_AURA","player",{removedAuraInstanceIDs={202}}) print("letzte Ladung weg")
E._s.OnUpdate(E,0.3)
fight=false present=false ev("PLAYER_REGEN_ENABLED") print("Kampfende")

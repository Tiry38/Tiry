local T=100 function GetTime() return T end
local Obj={} Obj.__index=function(t,k)
  if k=="GetPoint" then return function() return "CENTER",nil,"CENTER",0,0 end end
  if k=="GetFrameLevel" then return function() return 1 end end
  if k=="CreateTexture" or k=="CreateFontString" then return function() return setmetatable({},Obj) end end
  if k=="SetScript" then return function(s,n,f) local sc=rawget(s,"_s") or {} rawset(s,"_s",sc) sc[n]=f end end
  if k=="SetText" then return function(s,v) rawset(s,"txt",v) end end
  if k=="SetCooldownFromDurationObject" then return function(s,o) rawset(s,"durobj",o) end end
  return function() end end
local frames={} function CreateFrame() local f=setmetatable({},Obj) frames[#frames+1]=f return f end
function CreateFont() return setmetatable({},Obj) end
UIParent=CreateFrame() STANDARD_TEXT_FONT="x" DEFAULT_CHAT_FRAME={AddMessage=function(_,m) print("CHAT",m) end}
SlashCmdList={}
function UnitClass() return "Schamane","SHAMAN" end function UnitAffectingCombat() return false end
local SEC=setmetatable({},{__tostring=function() return "<geheim>" end})
issecretvalue=function(v) return v==SEC end
local aura={spellId=10432,name="Blitzschlagschild",applications=3,expirationTime=T+595,duration=600,auraInstanceID=55}
local locked,present=false,true
local function view() if not present then return nil end if locked then return {spellId=SEC,name=SEC,applications=SEC,expirationTime=SEC,duration=SEC,auraInstanceID=SEC} end return aura end
C_UnitAuras={GetPlayerAuraBySpellID=function(id) if locked then return nil end if id==10432 then return view() end end,
 GetAuraDataByAuraInstanceID=function(u,id) if locked then return nil end if id==55 then return view() end end,
 GetAuraDataByIndex=function(u,i) if i==1 then return view() end end,
 GetAuraDuration=function() return "DURATION-OBJ" end,
 GetAuraApplicationDisplayCount=function() return SEC end}
C_Spell={GetSpellName=function(id) return id==10432 and "Blitzschlagschild" or "X" end}
local fs={} local origCFS
dofile("Blitzschild.lua")
local E for _,f in ipairs(frames) do local s=rawget(f,"_s") if s and s.OnEvent then E=f end end
local function ev(e,...) E._s.OnEvent(E,e,...) end
-- find text fontstrings: capture via Update side effects is hard; print state through frames list
local function show(label) local t={} for _,f in ipairs(frames) do end print(label) end
ev("PLAYER_LOGIN") print("ausserhalb Kampf ok")
ev("PLAYER_REGEN_DISABLED") locked=true present=true ev("UNIT_AURA","player",{updatedAuraInstanceIDs={55}}) print("im Kampf gesperrt ok")
present=false ev("UNIT_AURA","player",{removedAuraInstanceIDs={55}}) print("entfernt ok")
ev("PLAYER_REGEN_ENABLED") E._s.OnUpdate(E,0.3) print("Ende ok")

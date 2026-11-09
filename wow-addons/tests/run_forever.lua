-- Minimal-Nachbau der WoW-API
local T = 100
function GetTime() return T end
bit = { band = function(a,b) local r,p=0,1 while a>0 and b>0 do if a%2==1 and b%2==1 then r=r+p end a=math.floor(a/2) b=math.floor(b/2) p=p*2 end return r end }
local frames = {}
local Obj = {}
Obj.__index = function(t,k)
  if k=="GetWidth" or k=="GetHeight" then return function() return 200 end end
  if k=="GetChecked" then return function() return true end end
  if k=="IsShown" then return function(s) return s._shown end end
  if k=="Show" then return function(s) s._shown=true end end
  if k=="Hide" then return function(s) s._shown=false end end
  if k=="SetShown" then return function(s,v) assert(v~=nil or true) s._shown=v and true or false end end
  if k=="SetScript" then return function(s,n,f) local sc=rawget(s,"_scripts") or {} rawset(s,"_scripts",sc) sc[n]=f end end
  if k=="GetPoint" then return function() return "CENTER",nil,"CENTER",5,6 end end
  if k=="CreateTexture" or k=="CreateFontString" then return function() return setmetatable({},Obj) end end
  if k=="SetText" then return function(s,v) s._text=v end end
  if k=="SetBackdrop" or k=="SetBackdropBorderColor" or k=="SetBackdropColor" or k=="SetGradientAlpha" then return function() end end
  if k=="StartMoving" or k=="StopMovingOrSizing" then return function() end end
  return function() end
end
function CreateFrame(t,name,parent,tpl) local f=setmetatable({_shown=true},Obj) frames[#frames+1]=f if name then _G[name]=f end return f end
UIParent=CreateFrame("Frame"); DEFAULT_CHAT_FRAME={AddMessage=function(_,m) print("CHAT:",(m:gsub("|c%x%x%x%x%x%x%x%x",""):gsub("|r",""))) end}
BackdropTemplateMixin={}; STANDARD_TEXT_FONT="x"; UISpecialFrames={}; tinsert=table.insert
function wipe(t) for k in pairs(t) do t[k]=nil end return t end
local SP={[324]={"Blitzschlagschild","ls"},[24398]={"Wasserschild","ws"},[16257]={"Schlaghagel","fl"},[8512]={"Totem des Windzorns","wft"},[8042]={"Erdschock","es"},[17364]={"Sturmschlag","ss"},[30823]={"Schamanistische Wut","sr"}}
function GetSpellInfo(id) local s=SP[id] if s then return s[1],nil,s[2] end end
local known={Blitzschlagschild=1,Erdschock=1,Sturmschlag=1}
function GetSpellCooldown(n) if known[n] then return (n=="Sturmschlag") and 95 or 0, (n=="Sturmschlag") and 10 or 0 end end
function GetNumSpellTabs() return 1 end
function GetSpellTabInfo() return "x",nil,0,3 end
local book={"Blitzschlagschild","Erdschock","Sturmschlag"}
function GetSpellBookItemName(i) return book[i] end
local buffs={{"Blitzschlagschild","ic",3,600,700},{"Schlaghagel","ic",2,15,115}}
function UnitBuff(u,i) local b=buffs[i] if b then return b[1],b[2],b[3],nil,b[4],b[5] end end
function GetInventoryItemLink(u,s) return "item:"..s end
function GetItemInfoInstant(l) return 1,"Weapon","x", l=="item:17" and "INVTYPE_WEAPON" or "INVTYPE_WEAPONMAINHAND" end
function GetInventoryItemTexture() return "tex" end
function UnitAttackSpeed() return 2.6, 2.4 end
function UnitClass() return "Schamane","SHAMAN" end
function UnitGUID() return "P1" end
function UnitPower() return 1500 end function UnitPowerMax() return 3000 end
function GetSpellPowerCost() return {{type=0,cost=300}} end
function GetTotemInfo(i) if i==4 then return true,"Totem des Windzorns",90,120,"ic" end return false,"",0,0 end
function GetWeaponEnchantInfo() return true, 300000, 0, 1, false, 0, 0, 0 end
function UnitIsDeadOrGhost() return false end function UnitOnTaxi() return false end function IsResting() return false end
function IsInGroup() return true end function IsInRaid() return false end
function UnitAffectingCombat() return true end
function SendChatMessage(m,c) print("SEND",c,m) end
function PlaySound() end
C_Timer={After=function(_,f) f() end}
SlashCmdList={}
COMBATLOG_OBJECT_AFFILIATION_MINE=1; COMBATLOG_OBJECT_TYPE_GUARDIAN=0x2000
local cle
function CombatLogGetCurrentEventInfo() return unpack(cle) end


local _gsi,_ub,_gsc=GetSpellInfo,UnitBuff,GetSpellCooldown
C_Spell={GetSpellInfo=function(id) local n,_,ic=_gsi(id) if n then return {name=n,iconID=ic} end end,
 GetSpellCooldown=function(n) local a,b=_gsc(n) if a then return {startTime=a,duration=b} end end,
 GetSpellPowerCost=function() return {{type=0,cost=300}} end}
C_UnitAuras={GetBuffDataByIndex=function(u,i) local n,ic,c,_,d,e=_ub(u,i) if n then return {name=n,icon=ic,applications=c,duration=d,expirationTime=e} end end}
GetSpellInfo=nil UnitBuff=nil GetSpellCooldown=nil GetNumSpellTabs=nil GetSpellPowerCost=nil GetItemInfoInstant=nil
C_Item={GetItemInfoInstant=function(l) return 1,"W","x",l=="item:17" and "INVTYPE_WEAPON" or "INVTYPE_WEAPONMAINHAND" end}
-- geheime Werte simulieren: Totem-Zeiten werfen Fehler
GetTotemInfo=function(i) error("secret value") end
local chunk=assert(loadfile("EnhanceHUD/EnhanceHUD.lua"))
chunk("EnhanceHUD",{})
local EV
for _,f in ipairs(frames) do local sc=rawget(f,"_scripts") if sc and sc.OnEvent then EV=f end end
local function fire(e,...) EV._scripts.OnEvent(EV,e,...) end
fire("PLAYER_LOGIN"); fire("PLAYER_ENTERING_WORLD"); fire("SPELLS_CHANGED")
fire("PLAYER_REGEN_DISABLED"); T=T+7; EV._scripts.OnUpdate(EV,0.2)
for i=1,40 do
  T=T+0.3
  cle={T,"SWING_DAMAGE",false,"P1","Ich",0x511,0,"M1","Eber",0,0, 200,0,1,0,0,0, i%4==0,nil,nil, i%2==0}
  fire("COMBAT_LOG_EVENT_UNFILTERED")
  if i%5==0 then cle={T,"SPELL_EXTRA_ATTACKS",false,"P1","Ich",0x511,0,"M1","Eber",0,0, 0,"Waffe des Windzorns",1,1}; fire("COMBAT_LOG_EVENT_UNFILTERED") end
  if i%7==0 then cle={T,"SPELL_DAMAGE",false,"P1","Ich",0x511,0,"M1","Eber",0,0, 0,"Erdschock",8,500,0,8,0,0,0,true}; fire("COMBAT_LOG_EVENT_UNFILTERED") end
  if i%9==0 then cle={T,"SPELL_DAMAGE",false,"T1","Totem",0x2111,0,"M1","Eber",0,0, 0,"Brandbolzen",4,60,0,4,0,0,0,false}; fire("COMBAT_LOG_EVENT_UNFILTERED") end
  if i==20 then cle={T,"SPELL_INTERRUPT",false,"P1","Ich",0x511,0,"M1","Eber",0,0, 0,"Erdschock",8,0,"Heilen"}; fire("COMBAT_LOG_EVENT_UNFILTERED") end
  fire("UNIT_AURA","player"); fire("UNIT_ATTACK_SPEED","player")
  EV._scripts.OnUpdate(EV,0.3)
end
fire("PLAYER_REGEN_ENABLED")
buffs={} ; GetWeaponEnchantInfo=function() return false,0,0,0,false,0,0,0 end
fire("UNIT_AURA","player"); EV._scripts.OnUpdate(EV,0.2)
for _,c in ipairs({"","lock","unlock","scale 1.3","reset","test","stats","statsreset","hide","show","quatsch"}) do SlashCmdList.ENHANCEHUD(c) end
print("OK – Durchlauf ohne Fehler")

local T=0; function GetTime() return T end
local function obj() local o={} return setmetatable(o,{__index=function(t,k) return function(...) if k=="GetCenter" then return 100,100 end if k=="CreateAnimationGroup" or k=="CreateAnimation" or k=="CreateTexture" or k=="CreateFontString" or k=="CreateMaskTexture" then return obj() end if k=="GetScale" then return 1 end end end}) end
local frames={}
function CreateFrame(t,n,p,tpl) local f=obj(); local scripts={}; rawset(f,"SetScript",function(s,k,fn) scripts[k]=fn end); rawset(f,"_s",scripts); frames[#frames+1]=f; return f end
UIParent=obj(); STANDARD_TEXT_FONT="x"; SlashCmdList={}; SOUNDKIT={RAID_WARNING=8959}
function PlaySound() print("SOUND") end
function IsPlayerSpell(id) return id==1088 end
local ct=3000; C_Spell={GetSpellInfo=function(id) return {castTime=ct} end, GetSpellTexture=function() return 1 end, GetSpellName=function() return "Schattentrance" end}
local incombat=false
C_UnitAuras={GetPlayerAuraBySpellID=function() if incombat then error("secret") end return nil end}
dofile("ProcAlarm/ProcAlarm.lua")
local F=frames[1]
local E=frames[#frames]; local P=F.poll
E._s.OnEvent(E,"ADDON_LOADED","ProcAlarm"); E._s.OnEvent(E,"PLAYER_LOGIN")
local function tick(n) for i=1,n do T=T+0.1; P._s.OnUpdate(P,0.1) end end
incombat=true; tick(3); ct=0; tick(2); print("on after proc")
SlashCmdList.PROCALARM("diag")
ct=3000; E._s.OnEvent(E,"UNIT_SPELLCAST_SUCCEEDED","player","g",1088); tick(2)
SlashCmdList.PROCALARM("diag")
print("GLOW"); E._s.OnEvent(E,"SPELL_ACTIVATION_OVERLAY_GLOW_SHOW",1088); tick(5); SlashCmdList.PROCALARM("diag"); tick(120); print("TEST")
SlashCmdList.PROCALARM("test"); tick(20); SlashCmdList.PROCALARM("unlock"); SlashCmdList.PROCALARM("lock"); SlashCmdList.PROCALARM("")
print("DONE")

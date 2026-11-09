local Tm=1000 function GetTime() return Tm end
local Obj={} Obj.__index=function(t,k)
  if type(k)=="string" and k:sub(1,2)=="__" then return nil end
  if k=="GetWidth" then return function() return 280 end end
  if k=="GetFrameLevel" then return function() return 2 end end
  if k=="GetHeight" then return function() return 30 end end
  if k=="GetText" then return function(s) return rawget(s,"txt") or "" end end
  if k=="IsShown" then return function(s) return rawget(s,"shown")~=false end end
  if k=="Show" then return function(s) rawset(s,"shown",true) end end
  if k=="Hide" then return function(s) rawset(s,"shown",false) end end
  if k=="SetShown" then return function(s,v) rawset(s,"shown",v and true or false) end end
  if k=="SetText" then return function(s,v) rawset(s,"txt",v) if LOGT and type(v)=="string" and v~="" then local c=v:gsub("|c%x%x%x%x%x%x%x%x",""):gsub("|r","") print("  TEXT:",c) end end end
  if k=="SetRotation" then return function(s,v) rawset(s,"rot",v) if LOGT then print(string.format("  ROT: %.2f",v)) end end end
  if k=="SetRotation" then return function(s,v) rawset(s,"rot",v) end end
  if k=="SetScript" then return function(s,n,f) rawset(s,"_"..n,f) end end
  if k=="GetPoint" then return function() return "CENTER",nil,"CENTER",0,0 end end
  if k=="CreateTexture" or k=="CreateFontString" then return function() return setmetatable({},Obj) end end
  if k=="GetStatusBarTexture" then return function() return setmetatable({},Obj) end end
  return function() end end
local frames={} function CreateFrame(t,n) local f=setmetatable({},Obj) frames[#frames+1]=f if n then _G[n]=f end return f end
UIParent=CreateFrame() STANDARD_TEXT_FONT="x" GameTooltip=CreateFrame()
DEFAULT_CHAT_FRAME={AddMessage=function(_,m) print("CHAT",(m:gsub("|c%x%x%x%x%x%x%x%x",""):gsub("|r",""))) end}
SlashCmdList={} function wipe(t) for k in pairs(t) do t[k]=nil end return t end
function UnitXP() return 15000 end function UnitXPMax() return 27300 end function GetXPExhaustion() return 3000 end function UnitLevel() return 22 end
local px,py=0.736,0.610 local facing=0
C_Map={GetBestMapForUnit=function() return 1440 end, GetPlayerMapPosition=function(m) return {x=px,y=py} end,
  GetMapWorldSize=function() return 4000,2700 end, GetMapInfo=function() return {parentMapID=12,mapType=3} end}
function GetPlayerFacing() return facing end
local done={[2]=true}
C_QuestLog={GetQuestsOnMap=function() return {{questID=1,x=0.70,y=0.60},{questID=2,x=0.40,y=0.30},{questID=3,x=0.74,y=0.50}} end,
 GetTitleForQuestID=function(id) return ({"Die Kundschafter von Ashenvale","Warsongnachschub","Satyrhörner"})[id] end,
 GetLogIndexForQuestID=function(id) return id end, GetInfo=function(i) return {questID=i,level=23+i,title="Q"..i} end,
 GetQuestObjectives=function(id) if done[id] then return {{text="x",finished=true}} end return {{text="Kundschafter von Ashenvale getötet: 2/9",numFulfilled=2,numRequired=9,finished=false}} end,
 ReadyForTurnIn=function(id) return done[id] end, GetNumQuestLogEntries=function() return 3 end}
function GetQuestLogRewardXP(id) return 1450*id end
function GetQuestDifficultyColor(l) return {r=1,g=1,b=0} end
function IsShiftKeyDown() return false end
local acc=0 function AcceptQuest() acc=acc+1 end
function PlaySound() end
dofile("Route.lua") dofile("Routes/Horde_22_30.lua") dofile("LevelPilot.lua") function UnitFactionGroup() return "Horde","Horde" end function UnitClass() return "S","SHAMAN",7 end function UnitOnTaxi() return false end
local E for _,f in ipairs(frames) do if rawget(f,"_OnEvent") then E=f end end
E._OnEvent(E,"PLAYER_LOGIN")
LOGT=true E._OnUpdate(E,1.1) LOGT=false
local rows={} 
print("Pfeil-Rotation (Ziel 1 liegt westlich, Blick Nord):", string.format("%.2f", LevelPilotArrow and 0 or 0))
E._OnEvent(E,"QUEST_DETAIL") print("AcceptQuest aufgerufen:",acc)
LOGT=true done[1]=true E._OnEvent(E,"QUEST_LOG_UPDATE") LOGT=false
Tm=Tm+120 E._OnEvent(E,"PLAYER_XP_UPDATE")
SlashCmdList.LEVELPILOT("hilfe")
print("OK")

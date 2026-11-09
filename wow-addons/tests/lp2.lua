local Tm=1000 function GetTime() return Tm end
local Obj={} Obj.__index=function(t,k)
  if type(k)=="string" and k:sub(1,2)=="__" then return nil end
  if k=="GetWidth" then return function() return 280 end end
  if k=="GetFrameLevel" then return function() return 2 end end
  if k=="GetCenter" then return function() return 400,300 end end
  if k=="GetEffectiveScale" then return function() return 1 end end
  if k=="GetHeight" then return function() return 30 end end
  if k=="GetText" then return function(s) return rawget(s,"txt") or "" end end
  if k=="IsShown" then return function(s) return rawget(s,"shown")~=false end end
  if k=="Show" then return function(s) rawset(s,"shown",true) end end
  if k=="Hide" then return function(s) rawset(s,"shown",false) end end
  if k=="SetShown" then return function(s,v) rawset(s,"shown",v and true or false) end end
  if k=="SetText" then return function(s,v) rawset(s,"txt",v) if LOGT and type(v)=="string" and v~="" then print("  TEXT:",(v:gsub("|c%x%x%x%x%x%x%x%x",""):gsub("|r",""))) end end end
  if k=="SetScript" then return function(s,n,f) rawset(s,"_"..n,f) end end
  if k=="GetPoint" then return function() return "CENTER",nil,"CENTER",0,0 end end
  if k=="CreateTexture" or k=="CreateFontString" then return function() return setmetatable({},Obj) end end
  if k=="GetStatusBarTexture" then return function() return setmetatable({},Obj) end end
  return function() end end
local frames={} function CreateFrame(t,n) local f=setmetatable({},Obj) frames[#frames+1]=f if n then _G[n]=f end return f end
UIParent=CreateFrame() STANDARD_TEXT_FONT="x" GameTooltip=CreateFrame()
DEFAULT_CHAT_FRAME={AddMessage=function(_,m) print("CHAT",(m:gsub("|c%x%x%x%x%x%x%x%x",""):gsub("|r",""))) end}
SlashCmdList={} function wipe(t) for k in pairs(t) do t[k]=nil end return t end
bit={band=function(a,b) local r,p=0,1 while a>0 and b>0 do if a%2==1 and b%2==1 then r=r+p end a=math.floor(a/2) b=math.floor(b/2) p=p*2 end return r end}
local LVL=22
function UnitXP() return 15000 end function UnitXPMax() return 27300 end function GetXPExhaustion() return 0 end function UnitLevel() return LVL end
function UnitFactionGroup() return "Horde","Horde" end function UnitClass() return "Schamane","SHAMAN",7 end function UnitOnTaxi() return false end
C_Map={GetBestMapForUnit=function() return 1454 end, GetPlayerMapPosition=function() return {x=0.5,y=0.7} end,
  GetMapWorldSize=function() return 1700,1100 end, GetMapInfo=function() return {parentMapID=0} end,
  GetWorldPosFromMapPos=function(m,v) return 1,v end, GetMapPosFromWorldPos=function(c,v,m) return m,v end}
CreateVector2D=function(x,y) return {x=x,y=y} end
function GetPlayerFacing() return 0 end
local LOG,DONE={}, {}
C_QuestLog={GetQuestsOnMap=function() return {} end, GetTitleForQuestID=function(id) return nil end,
 GetLogIndexForQuestID=function(id) return LOG[id] and 1 or nil end, GetInfo=function() return nil end,
 GetQuestObjectives=function() return {} end, ReadyForTurnIn=function(id) return false end,
 IsQuestFlaggedCompleted=function(id) return DONE[id] or false end, GetNumQuestLogEntries=function() return 0 end}
function GetQuestDifficultyColor() return {r=1,g=1,b=1} end
function IsShiftKeyDown() return false end function PlaySound() end
-- Questie-Attrappe
QuestieLoader={ImportModule=function(_,n) if n=="QuestieDB" then return {QueryQuestSingle=function(id,k) if k=="startedBy" then return {{3344}} end if k=="name" then return "Q"..id end end, QueryNPCSingle=function(id,k) if k=="spawns" then return {[1637]={{39.0,30.0}}} end end} else return {GetUiMapIdByAreaId=function(_,a) return 1454 end} end end}
dofile("Route.lua") dofile("Routes/Horde_22_30.lua") dofile("LevelPilot.lua")
local E for _,f in ipairs(frames) do if rawget(f,"_OnEvent") then E=f end end
E._OnEvent(E,"PLAYER_LOGIN")
print("Questie erkannt:", LP_Route.HasQuestie())
local function show(label) print("== "..label) LOGT=true E._OnEvent(E,"QUEST_LOG_UPDATE") LOGT=false end
show("Stufe 22, Start")
-- Trainer erreicht? -> Schritt ueberspringen per Befehl
SlashCmdList.LEVELPILOT("weiter")
LOG[1528]=true show("1528 angenommen")
LVL=26 DONE[1528]=true LOG[1528]=nil show("Stufe 26 (Route springt nach vorn)")
SlashCmdList.LEVELPILOT("route")
-- Wegpunkt-Strahl testen
local navF=CreateFrame() rawset(navF,"cx",500) 
local CL,DIST=false,300
C_SuperTrack={IsSuperTrackingAnything=function() return true end, IsSuperTrackingUserWaypoint=function() return true end, GetSuperTrackedQuestID=function() return 0 end, SetSuperTrackedUserWaypoint=function() end}
C_Navigation={GetFrame=function() return navF end, GetDistance=function() return DIST end, WasClampedToScreen=function() return CL end}
local played={} PlaySoundFile=function(f) played[#played+1]=f:match("Media\\(.-)%.ogg") end
UiMapPoint={CreateFromCoordinates=function() return {} end}
C_Map.SetUserWaypoint=function() end C_Map.CanSetUserWaypointOnMap=function() return true end
for i=1,5 do E._OnUpdate(E,0.06) end
CL=true for i=1,3 do E._OnUpdate(E,0.06) end
CL=false DIST=5 for i=1,3 do E._OnUpdate(E,0.06) end
SlashCmdList.LEVELPILOTWAY("45.2 61 Briefkasten") for i=1,3 do E._OnUpdate(E,0.06) end
print("Sounds:", table.concat(played,","))

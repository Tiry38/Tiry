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
  GetMapWorldSize=function() return 1700,1100 end, GetMapInfo=function(m) if m==1414 then return {mapType=2,parentMapID=946} end return {mapType=3,parentMapID=1414} end,
  GetWorldPosFromMapPos=function(m,v) return 1,{x=v.x*20000,y=v.y*20000} end, GetMapPosFromWorldPos=function(c,v,m) return m,v end}
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

C_TaxiMap={GetTaxiNodesForMap=function() return {
 {nodeID=1,name="Orgrimmar, Durotar",position={x=0.5,y=0.701},faction=1},
 {nodeID=2,name="Sonnenfels, Steinkrallen",position={x=0.2,y=0.5},faction=1},
 {nodeID=3,name="Theramore",position={x=0.6,y=0.8},faction=2}} end,
 GetAllTaxiNodes=function() return {{nodeID=1,name="Orgrimmar, Durotar",state=0,slotIndex=1},{nodeID=2,name="Sonnenfels, Steinkrallen",state=1,slotIndex=2}} end}
function GetTaxiMapID() return 1414 end
function GetUnitSpeed() return 0 end function IsMounted() return false end function UnitOnTaxi() return false end
local took; function TakeTaxiNode(i) took=i end
C_Timer={After=function(_,f) f() end}
dofile("Route.lua") dofile("Routes/Horde_22_30.lua") dofile("Fly.lua") dofile("LevelPilot.lua")
local E for _,f in ipairs(frames) do if rawget(f,"_OnEvent") then E=f end end
E._OnEvent(E,"PLAYER_LOGIN")
local a=LP_Fly.Advice({map=1454,x=0.205,y=0.51},"k1")
print("Rat:", a and a.from, a and a.to, a and math.floor(a.run), a and math.floor(a.fly), a and a.atFM, a and a.sure)
local b=LP_Fly.Advice({map=1454,x=0.52,y=0.70},"k2") print("nah:",b)
-- Flugmeister angesprochen
LP_Fly.want="Sonnenfels"; LevelPilotDB.auto=true
for _,f in ipairs(frames) do local h=rawget(f,"_OnEvent") if h and f~=E then h(f,"TAXIMAP_OPENED") end end
print("Flug gewaehlt Slot:",took, "gelernt:",LevelPilotDB.fpSeen)
E._OnEvent(E,"QUEST_LOG_UPDATE")
SlashCmdList.LEVELPILOT("flug") SlashCmdList.LEVELPILOT("flug")
LP_Route.StepTarget=function() return {map=1454,x=0.205,y=0.51} end
GetTime=function() return 2000 end C_Map.GetPlayerMapPosition=function() return {x=0.49,y=0.69} end
LOGT=true E._OnEvent(E,"QUEST_LOG_UPDATE") LOGT=false
print("want",LP_Fly.want, LP_Fly.Advice({map=1454,x=0.205,y=0.51},"zz"), GetTime and GetTime())
print("FLYTEST OK")
-- Am NPC: Quest nicht angeboten -> ueberspringen
UnitGUID=function() return "Creature-0-1-1-1-3344-0000" end
strsplit=function(sep,str) local t={} for p in (str..sep):gmatch("(.-)"..sep:gsub("%-","%%-")) do t[#t+1]=p end return unpack(t) end
C_GossipInfo={GetAvailableQuests=function() return {} end, GetActiveQuests=function() return {} end}
GetTime=function() return 3000 end
E._OnEvent(E,"GOSSIP_SHOW")
local n=0 for k,v in pairs(LevelPilotDB.skipK) do for i in pairs(v) do n=n+1 end end
print("uebersprungen:",n)
print("NPCTEST OK")
LP_Route.ban={[878]=true}
print("ban:", LP_Route.StepDone({t="accept",q=878,ql=20},22), LP_Route.StepDone({t="accept",q=879,ql=20},22))
SlashCmdList.LEVELPILOT("entsperren")
print("BANTEST OK")
-- Questlog-Erkennung: Blizzard-Abfrage liefert nichts, Ereignis/Logliste schon
C_QuestLog.GetLogIndexForQuestID=function() return nil end
print("vorher:", LP_Route.StepDone({t="accept",q=4921,ql=20},24))
E._OnEvent(E,"QUEST_ACCEPTED",4921)
print("nach QUEST_ACCEPTED:", LP_Route.StepDone({t="accept",q=4921,ql=20},24))
LP_Route.mem.acc[4921]=nil
C_QuestLog.GetNumQuestLogEntries=function() return 1 end
C_QuestLog.GetInfo=function(i) return {questID=5052,title="X",isHeader=false} end
E._OnEvent(E,"QUEST_LOG_UPDATE")
print("aus Logliste:", LP_Route.StepDone({t="accept",q=5052,ql=21},24))
E._OnEvent(E,"QUEST_TURNED_IN",5052)
print("abgegeben:", LP_Route.StepDone({t="turnin",q=5052,ql=21},24))
print("LOGTEST OK")
-- Ruhestein: gebunden in Sonnenfels, bereit -> schlaegt Fliegen
GetBindLocation=function() return "Sonnenfels" end
GetItemCount=function() return 1 end
GetItemCooldown=function() return 0,0,1 end
GetTime=function() return 9000 end
local h=LP_Fly.Advice({map=1454,x=0.205,y=0.51},"hearth1")
print("Ruhestein:", h and h.kind, h and h.to, h and math.floor(h.fly), h and math.floor(h.run))
GetItemCooldown=function() return 8990,3600,1 end
GetTime=function() return 9100 end
local h2=LP_Fly.Advice({map=1454,x=0.205,y=0.51},"hearth2")
print("Ruhestein auf Abklingzeit ->", h2 and h2.kind)
print("HEARTHTEST OK")

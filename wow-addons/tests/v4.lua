-- LevelPilot 4: Logik-Tests mit steuerbarer Uhr, Position und Questlog
local Tm=1000 function GetTime() return Tm end function time() return 1700000000 + Tm end
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
  return function() end end
local frames={} function CreateFrame(t,n) local f=setmetatable({},Obj) frames[#frames+1]=f if n then _G[n]=f end return f end
UIParent=CreateFrame() STANDARD_TEXT_FONT="x" GameTooltip=CreateFrame()
local chat={}
DEFAULT_CHAT_FRAME={AddMessage=function(_,m) chat[#chat+1]=(m:gsub("|c%x%x%x%x%x%x%x%x",""):gsub("|r","")) end}
SlashCmdList={} function wipe(t) for k in pairs(t) do t[k]=nil end return t end
bit={band=function(a,b) local r,p=0,1 while a>0 and b>0 do if a%2==1 and b%2==1 then r=r+p end a=math.floor(a/2) b=math.floor(b/2) p=p*2 end return r end}
local LVL=22
function UnitXP() return 15000 end function UnitXPMax() return 27300 end function GetXPExhaustion() return 0 end function UnitLevel() return LVL end
function UnitFactionGroup() return "Horde","Horde" end function UnitClass() return "Schamane","SHAMAN",7 end
local TAXI, COMBAT=false,false
function UnitOnTaxi() return TAXI end function UnitAffectingCombat() return COMBAT end
local PX,PY=0.10,0.10
C_Map={GetBestMapForUnit=function() return 1413 end, GetPlayerMapPosition=function() return {x=PX,y=PY} end,
  GetMapWorldSize=function() return 1700,1100 end, GetMapInfo=function() return {parentMapID=0} end,
  GetWorldPosFromMapPos=function(m,v) return 1,v end, GetMapPosFromWorldPos=function(c,v,m) return m,v end}
CreateVector2D=function(x,y) return {x=x,y=y} end
function GetPlayerFacing() return 0 end
-- Questlog
local LOG, READY, DONE = {}, {}, {}
local function logList() local l={} for q in pairs(LOG) do l[#l+1]=q end table.sort(l) return l end
local OBJ={}   -- q -> Blizzard-Ziele
C_QuestLog={GetQuestsOnMap=function() return {} end, GetTitleForQuestID=function(id) return "Q"..id end,
 GetLogIndexForQuestID=function(id) return nil end,   -- absichtlich kaputt (wie auf Forever)
 GetInfo=function(i) local l=logList() local q=l[i] return q and {questID=q,title="Q"..q,isHeader=false} or nil end,
 GetNumQuestLogEntries=function() local n=#logList() return n,n end,
 GetQuestObjectives=function(q) return OBJ[q] or {} end, ReadyForTurnIn=function(id) return READY[id] or false end,
 IsQuestFlaggedCompleted=function(id) return DONE[id] or false end}
function GetQuestDifficultyColor() return {r=1,g=1,b=1} end
local SHIFT=false function IsShiftKeyDown() return SHIFT end function PlaySound() end
-- Questie-Attrappe: NPC-Positionen (Prozent), Questgeber, Ziele
local NPC={ [900]={30,30}, [501]={30,30}, [502]={60,60}, [601]={ {40,40},{41,41},{42,40},{80,80} }, [602]={ {31,31} } }
local GIVER={ [101]=501, [102]=501, [103]=502 }
local QOBJ={ [101]={ {{601}} }, [102]={ {{602}} } }
QuestieLoader={ImportModule=function(_,n)
  if n=="QuestieDB" then return {
    QueryQuestSingle=function(id,k)
      if k=="startedBy" or k=="finishedBy" then return {{GIVER[id] or 501}} end
      if k=="name" then return "Q"..id end
      if k=="objectives" then return QOBJ[id] and {QOBJ[id][1]} or {} end
    end,
    QueryNPCSingle=function(id,k)
      if k=="spawns" then local p=NPC[id]; if not p then return nil end
        if type(p[1])=="table" then return {[17]=p} end
        return {[17]={p}} end
      if k=="name" then return "NPC"..id end
    end,
    QueryItemSingle=function() return nil end,
  } end
  return {GetUiMapIdByAreaId=function(_,a) return 1413 end}
end}
dofile("Route.lua") dofile("Fly.lua")
LevelPilot_Routes={ test={ name="Test", faction="Horde", min=1, max=99, steps={
  { t="fly", l=22, z="Hub", npc=900, to="Hub" },
  { t="accept", q=101, ql=22, l=22, z="Hub" },
  { t="accept", q=102, ql=22, l=22, z="Hub" },
  { t="complete", q=101, ql=22, l=22, z="Hub" },
  { t="turnin", q=101, ql=22, l=22, z="Hub" },
  { t="accept", q=103, ql=22, l=22, z="Hub" },
  { t="complete", q=102, ql=22, l=22, z="Hub" },
  { t="turnin", q=102, ql=22, l=22, z="Hub" },
} } }
dofile("LevelPilot.lua")
local E for _,f in ipairs(frames) do if rawget(f,"_OnEvent") and rawget(f,"_OnUpdate") then E=f end end
E._OnEvent(E,"PLAYER_LOGIN")
LevelPilotDB.route="test"
local fails=0
local function check(name, cond) print((cond and "  ok   " or "  FAIL ")..name) if not cond then fails=fails+1 end end
local function tick(n,dt) for i=1,(n or 1) do Tm=Tm+(dt or 0.06) E._OnUpdate(E,dt or 0.06) end end
local function refresh() LOGT=false E._OnEvent(E,"QUEST_LOG_UPDATE") end
local R=LP_Route
local route=LevelPilot_Routes.test
local function cur() refresh() local idx=nil for i,s in ipairs(route.steps) do end return R.state end

print("== A: Reise-Schritt")
refresh()
local idx=R.Plan(route,22,{},{},6,nil)
check("weit weg: erst zum Hub reisen", idx==1)
LOG[101]=true refresh()
idx=R.Plan(route,22,{},{},6,nil)
check("schon eine Quest vom Hub angenommen -> Reise gilt als erledigt", R.state[1]=="done")
LOG[101]=nil refresh()
PX,PY=0.30,0.30 refresh()
idx=R.Plan(route,22,{},{},6,nil)
check("am Hub angekommen -> Reise erledigt", R.state[1]=="done")

print("== B: Gruppieren + Anzeige")
LOGT=true E._OnEvent(E,"QUEST_LOG_UPDATE") LOGT=false
local found=false for _,f in ipairs(frames) do end
-- Texte stehen in der Ausgabe ("2 QUESTS ANNEHMEN")

print("== C: Auto-Annehmen nur Routen-Quests")
LevelPilotDB.plan.test = {} LOG = {} refresh()   -- frischer Plan am Hub
local accepted=0 AcceptQuest=function() accepted=accepted+1 end
local QID=101 GetQuestID=function() return QID end GetTitleText=function() return "Fremde Quest" end
E._OnEvent(E,"QUEST_DETAIL") check("Routen-Quest wird angenommen", accepted==1)
QID=999 E._OnEvent(E,"QUEST_DETAIL") check("fremde Quest wird NICHT angenommen", accepted==1)
local hint=false for _,m in ipairs(chat) do if m:find("nicht in deinem Plan") then hint=true end end
check("Hinweis im Chat", hint)
LevelPilotDB.ban[102]=true QID=102 E._OnEvent(E,"QUEST_DETAIL") check("gesperrte Quest wird NICHT angenommen", accepted==1)
LevelPilotDB.ban[102]=nil

print("== D: Questziel = naechste Gegnergruppe")
LOG[101]=true OBJ[101]={{type="monster",finished=false,text="0/8"}} refresh()
local t=R.StepTarget(route.steps[4])
check("Ziel bei der Gruppe (40/40), nicht beim Einzelspawn (80/80)", t and math.abs(t.x-0.41)<0.02 and math.abs(t.y-0.403)<0.02)
check("Gruppe aus 3 Spawns", t and t.count==3)

print("== E: fester Plan (kein Hin-und-her, keine Umsortierung nach Entfernung)")
local D={}
local orig=R.StepDist
R.StepDist=function(s) return D[s] end
LOG[102]=true refresh()
local PL={ k="complete:101", i=4 }
D[route.steps[4]]=100; D[route.steps[7]]=60
local i1=R.Plan(route,22,{},PL,6,{i=4,since=0})
check("anderes Ziel naeher -> Plan-Schritt bleibt", i1==4)
D[route.steps[7]]=10
local i2=R.Plan(route,22,{},PL,6,{i=4,since=0})
check("anderes Ziel viel naeher -> Plan-Schritt bleibt trotzdem", i2==4)
R.StepDist=orig

print("== F: Questlog-Abgleich")
LOG[101]=true LOG[102]=true R.ScanLog(true)
check("beide im Gedaechtnis", R.mem.acc[101] and R.mem.acc[102])
LOG[102]=nil R.ScanLog(true)
check("abgebrochene Quest faellt raus", R.mem.acc[102]==nil and R.mem.acc[101])
LOG[102]=true R.ScanLog(true)

print("== G: Ueberspringen per Schluessel")
refresh()
SlashCmdList.LEVELPILOT("weiter")
local sk=LevelPilotDB.skipK.test or {} local n=0 for _ in pairs(sk) do n=n+1 end
check("ein Schritt uebersprungen (per Schluessel)", n==1)
SlashCmdList.LEVELPILOT("zurueck")
n=0 for _ in pairs(LevelPilotDB.skipK.test) do n=n+1 end
check("zurueckgeholt", n==0)

print("== H: Ton-Regeln")
local played={} PlaySoundFile=function(f) played[#played+1]=(f:match("Media\\(.-)%.ogg")) end
local navF=CreateFrame() local DIST,NAV=300,true
C_SuperTrack={IsSuperTrackingAnything=function() return NAV end, IsSuperTrackingUserWaypoint=function() return NAV end, GetSuperTrackedQuestID=function() return 0 end, SetSuperTrackedUserWaypoint=function() end}
C_Navigation={GetFrame=function() return NAV and navF or nil end, GetDistance=function() return DIST end, WasClampedToScreen=function() return false end}
UiMapPoint={CreateFromCoordinates=function() return {} end}
C_Map.SetUserWaypoint=function() end C_Map.CanSetUserWaypointOnMap=function() return true end
Tm=Tm+20 tick(3)
local function count(name) local c=0 for _,p in ipairs(played) do if p==name then c=c+1 end end return c end
check("neues Ziel -> genau ein Amboss", count("beam")==1)
NAV=false tick(5) NAV=true tick(5)
check("Strahl weg und wieder da -> KEIN neuer Ton", count("beam")==1)
COMBAT=true E._OnEvent(E,"PLAYER_REGEN_DISABLED") tick(5) COMBAT=false E._OnEvent(E,"PLAYER_REGEN_ENABLED") tick(5)
check("nach dem Kampf -> KEIN Ton", count("beam")==1)
TAXI=true tick(5) TAXI=false E._OnEvent(E,"PLAYER_CONTROL_GAINED") tick(5)
check("nach der Landung -> KEIN Ton", count("beam")==1)
DIST=5 Tm=Tm+10 tick(3)
check("angekommen -> genau ein Ankunfts-Ton", count("arrive")==1)
tick(10)
check("kein Dauer-Ton am Ziel", count("arrive")==1 and #played==2)

print("== I: Kampf blendet Fenster ab und wieder ein")
E._OnEvent(E,"PLAYER_REGEN_DISABLED") E._OnEvent(E,"PLAYER_REGEN_ENABLED")
check("kein Fehler", true)

print("== J: Questgebiet (Strahl aus, Pin bleibt stehen, erst nach Verlassen wieder an)")
-- Plan steht auf "complete:101": Gegner NPC 601 bei 40/40, 41/41, 42/40 (+ Einzelspawn 80/80); Karte 1700x1100 Yards
local BEAM=_G.LevelPilotBeam
local pins=0 C_Map.SetUserWaypoint=function() pins=pins+1 end
local origGT=R.GoalTarget
local jx=0.41   -- springender Zielpunkt (wie die Gruppen-Mitte beim Questen)
R.GoalTarget=function(s) if s.q==101 and s.t=="complete" then return {map=1413,x=jx,y=0.403,spot=true,count=3} end return origGT(s) end
local function at(x,y) PX,PY=x,y Tm=Tm+1 tick(25) end
DIST=150
at(0.30,0.30)
check("draussen (200 m): Strahl sichtbar", BEAM:IsShown())
at(0.34,0.40)
check("100 m vor dem Gebiet: Strahl bleibt (Eintritt erst ab 60 m)", BEAM:IsShown())
at(0.37,0.40)
check("Questgebiet betreten (51 m): Strahl weg", not BEAM:IsShown())
local p0, nBeam = pins, count("beam")
jx=0.45 at(0.41,0.41) jx=0.38 at(0.42,0.40) jx=0.43 at(0.39,0.41)
check("im Gebiet herumlaufen, Ziel springt: Strahl bleibt weg", not BEAM:IsShown())
check("Kartenpin springt im Gebiet NICHT mit", pins==p0)
check("kein Ton beim Herumlaufen", count("beam")==nBeam)
at(0.34,0.40)
check("Rand (100 m) nach dem Questen: noch drin (Puffer bis 120 m)", not BEAM:IsShown())
at(0.32,0.40)
check("Gebiet verlassen (136 m): Strahl wieder da", BEAM:IsShown())
check("Kartenpin folgt wieder dem Ziel", pins>p0)
check("Wiederkommen ist kein neues Ziel (kein Ton)", count("beam")==nBeam)
at(0.37,0.40)
check("wieder rein: Strahl wieder weg", not BEAM:IsShown())
R.GoalTarget=origGT
-- Grind-Gegner und unbekannte Quest
PX,PY=0.40,0.40
check("Grind: bei den Gegnern = drin", R.InArea({npc=601}, false)==true)
PX,PY=0.10,0.10
check("Grind: weit weg = draussen", R.InArea({npc=601}, false)==false)
check("Quest ohne Gebietsdaten -> kein Gebiet (Strahl bleibt)", R.InArea({q=999}, false)==nil)
-- Quest fertig: Abgabe-NPC bekommt den Strahl sofort zurueck, auch mitten im Gebiet
at(0.40,0.40)
check("vor der Abgabe noch im Gebiet: Strahl weg", not BEAM:IsShown())
READY[101]=true OBJ[101]={{type="monster",finished=true,text="8/8"}} refresh() Tm=Tm+1 tick(25)
check("Quest fertig -> Strahl zeigt zur Abgabe, obwohl du noch im Gebiet stehst", BEAM:IsShown())
-- von Hand verfolgte Quest (Blizzard-Questverfolgung) verhaelt sich genauso
READY[101]=nil OBJ[101]={{type="monster",finished=false,text="3/8"}} refresh()
C_SuperTrack.GetSuperTrackedQuestID=function() return 101 end C_SuperTrack.IsSuperTrackingUserWaypoint=function() return false end
at(0.30,0.30)
check("verfolgte Quest, draussen: Strahl sichtbar", BEAM:IsShown())
at(0.40,0.40)
check("verfolgte Quest, im Gebiet: Strahl weg", not BEAM:IsShown())
-- Strahl aus -> bleibt aus; wieder an mitten im Gebiet -> Gebietsregel greift sofort (kein Aufblitzen)
LevelPilotDB.beam=false at(0.40,0.40)
check("Strahl abgeschaltet: bleibt aus", not BEAM:IsShown())
LevelPilotDB.beam=true at(0.40,0.40)
check("Strahl wieder an, im Gebiet: bleibt trotzdem weg", not BEAM:IsShown())
C_SuperTrack.GetSuperTrackedQuestID=function() return 0 end C_SuperTrack.IsSuperTrackingUserWaypoint=function() return NAV end
-- Plan steht jetzt auf "Annehmen 103" (Questgeber, kein Gebiet): Strahl bleibt, auch zwischen den Gegnern von 101
at(0.40,0.40)
check("Questgeber-Ziel: Strahl bleibt sichtbar (kein Questgebiet)", LP_StepType()=="accept" and BEAM:IsShown())

print(fails==0 and "ALLE TESTS OK" or ("FEHLER: "..fails))

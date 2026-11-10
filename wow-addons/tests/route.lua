-- LevelPilot: Routen-Auswahl, Vorausregel (nicht zurueckschicken, aber neues Gebiet nie ueberspringen), Routendateien
-- Aufruf: cd addons/LevelPilot && lua5.1 ../../tests/route.lua   (Exit 0 = ok)
local Tm=1000 function GetTime() return Tm end
local Obj={} Obj.__index=function(t,k) if type(k)=="string" and k:sub(1,2)=="__" then return nil end return function() end end
function CreateFrame() return setmetatable({},Obj) end
UIParent=CreateFrame() SlashCmdList={} function wipe(t) for k in pairs(t) do t[k]=nil end return t end
bit={band=function(a,b) local r,p=0,1 while a>0 and b>0 do if a%2==1 and b%2==1 then r=r+p end a=math.floor(a/2) b=math.floor(b/2) p=p*2 end return r end}
function UnitClass() return "Schamane","SHAMAN",7 end
C_Map={GetBestMapForUnit=function() return 1413 end, GetPlayerMapPosition=function() return {x=0.5,y=0.5} end,
  GetMapWorldSize=function() return 1700,1100 end, GetMapInfo=function() return {parentMapID=0} end,
  GetWorldPosFromMapPos=function(m,v) return 1,v end, GetMapPosFromWorldPos=function(c,v,m) return m,v end}
CreateVector2D=function(x,y) return {x=x,y=y} end
local LOG, DONE = {}, {}
C_QuestLog={GetQuestsOnMap=function() return {} end, GetTitleForQuestID=function() return nil end,
 GetLogIndexForQuestID=function(id) return LOG[id] and 1 or nil end, GetInfo=function() return nil end,
 GetNumQuestLogEntries=function() return 0,0 end, GetQuestObjectives=function() return {} end,
 ReadyForTurnIn=function() return false end, IsQuestFlaggedCompleted=function(id) return DONE[id] or false end}
dofile("Route.lua") dofile("Routes/Horde_22_30.lua") dofile("Routes/Horde_30_40.lua")
local R=LP_Route
local fails=0
local function check(name,c) print((c and "  ok   " or "  FEHLER ")..name) if not c then fails=fails+1 end end

print("== A: Routenwahl nach Stufe")
check("18 -> 22-30 (knapp darunter)", R.Pick("Horde",18)=="horde_22_30")
check("29 -> 22-30", R.Pick("Horde",29)=="horde_22_30")
check("30 -> 30-40", R.Pick("Horde",30)=="horde_30_40")
check("39 -> 30-40", R.Pick("Horde",39)=="horde_30_40")
check("15 -> keine Route", R.Pick("Horde",15)==nil)
check("Allianz -> keine Route", R.Pick("Alliance",25)==nil)

print("== B: Routendateien")
for key,r in pairs(LevelPilot_Routes) do
  local ok, grind, quests, maxl = true, 0, 0, 0
  for i,s in ipairs(r.steps) do
    if type(s.t)~="string" or type(s.l)~="number" or type(s.z)~="string" then ok=false end
    if s.t=="grind" then grind=grind+1 if type(s.to)~="number" or not s.n then ok=false end end
    if s.q then quests=quests+1 if not (s.ql and s.n) then ok=false end end
    if s.l > maxl then maxl=s.l end
  end
  check(key..": Felder vollstaendig ("..#r.steps.." Schritte, "..quests.." Questschritte, "..grind.." Grind)", ok and quests>100)
  check(key..": letzter Schritt = Grind bis Routenende", r.steps[#r.steps].t=="grind" and r.steps[#r.steps].to==r.max)
  check(key..": Planstufen im Bereich", maxl<=r.max)
end

print("== C: Vorausregel")
local route={steps={
  {t="accept",q=1,l=22,z="A",ql=25},     -- ql 25 ist bei Stufe 29 noch nicht grau
  {t="turnin",q=1,l=22,z="A",ql=25},
  {t="accept",q=2,l=27,z="B",ql=27},
  {t="turnin",q=2,l=27,z="B",ql=27},
  {t="accept",q=3,l=28,z="B",ql=28},
}}
LOG={} DONE={[2]=true}
local i1=R.Current(route,29,nil,5)
check("Stufe 29, Route schon in Gebiet B: alter Schritt (Stufe 22) nicht mehr Ziel", i1==5)
local i2=R.Current(route,23,nil,5)
check("Stufe 23: alter Schritt bleibt Ziel", i2==1)
DONE={}
check("Stufe 29, Route noch nicht weiter: alter Schritt bleibt Ziel", R.Current(route,29,nil,5)==1)
DONE={}
local route2={steps={{t="accept",q=10,l=34,z="S",ql=34},{t="accept",q=11,l=35,z="D",ql=35}}}
local i3=R.Current(route2,37,nil,5)
check("Stufe 37 ueber Plan, Gebiet noch nicht besucht: wird NICHT uebersprungen", i3==1)

print("== D: 30-40 frisch bei Stufe 30")
DONE={} LOG={}
local i4=R.Current(LevelPilot_Routes.horde_30_40,30,nil,5)
check("erster Schritt = Reise nach Freiwindposten", i4==1 and LevelPilot_Routes.horde_30_40.steps[1].t=="fly")

print(fails==0 and "ROUTE TESTS OK" or ("FEHLER: "..fails))
if fails>0 then os.exit(1) end

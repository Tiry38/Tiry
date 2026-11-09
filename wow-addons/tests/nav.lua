local T=0 GetTime=function() return T end
function wipe(t) for k in pairs(t) do t[k]=nil end return t end
local px,py=0.52,0.84
C_Map={GetBestMapForUnit=function() return 85 end, GetPlayerMapPosition=function() return {x=px,y=py} end,
 GetMapWorldSize=function() return 1739,1159 end,
 GetWorldPosFromMapPos=function(m,v) return 1,v end, GetMapPosFromWorldPos=function(c,v,m) return m,v end}
CreateVector2D=function(x,y) return {x=x,y=y} end
C_QuestLog={}
dofile("Route.lua") dofile("Nav.lua")
local R=LP_Route
R.BuildNav()
print("Karten/Knoten:", R.NavStats())
local tgt={map=85,x=0.39,y=0.38} -- Tal der Weisheit (Annahme)
for step=1,60 do
  local wp,len=R.Route(tgt)
  if not wp then print(string.format("Schritt %d: direkt (%.2f,%.2f)",step,px,py)) break end
  if step<=3 or step%10==0 then print(string.format("Schritt %d: Spieler %.3f,%.3f -> Wegpunkt %.3f,%.3f  Weg %.0f yd",step,px,py,wp.x,wp.y,len)) end
  -- Spieler laeuft zum Wegpunkt
  px,py=wp.x,wp.y T=T+3
end

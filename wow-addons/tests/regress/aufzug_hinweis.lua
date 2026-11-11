-- One concrete case: walking from node 4258 towards lift node 4410 (Thunder Bluff lift 4410->4409), target node 4537
local TRAVEL = arg[1]
local Tm = 1000
function GetTime() return Tm end
CreateVector2D = function(x, y) return { x = x, y = y } end
dofile("Walk.lua") dofile(TRAVEL)
local W = LP_Walk
local g = W.Graph(1)
local s, a, b, t = 4258, 4410, 4409, 4537
local q = { c = 1, x = g.x[t], y = g.y[t] }
print(string.format("lift bottom %d (%.0f,%.0f) top %d (%.0f,%.0f), 2D %.0f yd", a, g.x[a], g.y[a], b, g.x[b], g.y[b], math.sqrt((g.x[a]-g.x[b])^2+(g.y[a]-g.y[b])^2)))
for f = 0, 0.8, 0.2 do
  local px = g.x[s] + (g.x[a] - g.x[s]) * f
  local py = g.y[s] + (g.y[a] - g.y[s]) * f
  Tm = Tm + 1
  local A, rest = W.Aim({ c = 1, x = px, y = py }, q)
  local da = math.sqrt((px - g.x[a]) ^ 2 + (py - g.y[a]) ^ 2)
  print(string.format("  player %.0f yd before lift: waypoint %s, via %s, rest %.0f", da,
    A and string.format("(%.0f,%.0f)", A.x, A.y) or "-", A and A.via and (A.via.name .. " @" .. math.floor(A.via.at)) or "-", rest or -1))
end

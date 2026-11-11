-- Random points around main-network nodes: does W.Ground still find a path (sure=true)?
local TRAVEL = arg[1]
local Tm = 1000
function GetTime() return Tm end
CreateVector2D = function(x, y) return { x = x, y = y } end
dofile("Walk.lua") dofile(TRAVEL)
local W = LP_Walk
local floor = math.floor
math.randomseed(42)
local out = {}
for cont = 0, 1 do
  local g = W.Graph(cont)
  -- components (own computation, independent of Travel.lua version)
  local comp, size, nc = {}, {}, 0
  for k = 1, g.n do if not comp[k] then nc = nc + 1; comp[k] = nc; local st, c = { k }, 0
    while #st > 0 do local u = table.remove(st); c = c + 1
      for e = g.first[u], g.first[u + 1] - 1 do local v = floor(g.ew[e] / 4096) if not comp[v] then comp[v] = nc; st[#st + 1] = v end end end
    size[nc] = c end end
  local big, bc = 0 for c, s in pairs(size) do if s > big then big, bc = s, c end end
  local main = {} for k = 1, g.n do if comp[k] == bc then main[#main + 1] = k end end
  local lost, total = 0, 0
  for trial = 1, 400 do
    local k = main[math.random(#main)]
    local ang, r = math.random() * 2 * math.pi, math.random() * 200
    local p = { c = cont, x = g.x[k] + r * math.cos(ang), y = g.y[k] + r * math.sin(ang) }
    -- target: another main node 800..2500 yd away
    local t
    for _ = 1, 50 do local c2 = main[math.random(#main)]; local d = math.sqrt((g.x[c2]-p.x)^2+(g.y[c2]-p.y)^2) if d > 800 and d < 2500 then t = c2 break end end
    if t then
      Tm = Tm + 1
      local q = { c = cont, x = g.x[t], y = g.y[t] }
      local d, sure = W.Ground(p, q)
      total = total + 1
      if not sure then lost = lost + 1; out[#out + 1] = string.format("cont %d trial %d near node %d (+%.0f yd): p=(%.1f,%.1f) -> node %d : Ground %.0f sure=%s", cont, trial, k, r, p.x, p.y, t, d or -1, tostring(sure)) end
    end
  end
  print(string.format("cont %d: %d of %d queries without a network path (estimate)", cont, lost, total))
end
for i = 1, math.min(8, #out) do print(out[i]) end

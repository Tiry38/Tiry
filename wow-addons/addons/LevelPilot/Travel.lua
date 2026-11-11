---------------------------------------------------------------------------
-- LevelPilot · Wegenetz: Bodenweg statt Luftlinie
-- Daten: Walk.lua (tools/navmesh.py) – Grobnetz aus dem Navmesh der echten Spielgeometrie
-- (Guidelime Pathfinder, GPL-3.0): ein Knoten je begehbarem Stueck in 240-Yard-Bloecken, Kantenkosten =
-- echter kuerzester Laufweg. Dazu Aufzuege (L), benannte Stellen wie der Talondeep-Pfad (P) und das Flugnetz
-- (LevelPilot_Taxi: Flugmeister + gemessene Direktflugzeiten).
-- Weltkoordinaten in Yards: X = Norden, Y = Westen (wie C_Map.GetWorldPosFromMapPos).
-- Liefert: echte Laufstrecke (Zielwahl, Flug-Rat, Zeit) und den naechsten Wegpunkt fuer den Pfeil.
---------------------------------------------------------------------------
LP_Walk = {}
local W = LP_Walk
local floor, sqrt, huge, min, max = math.floor, math.sqrt, math.huge, math.min, math.max
local byte = string.byte

local BK = 160          -- Raster der Knotensuche (Yards)
local SNAP_R = 300      -- Anbindung eines Punkts: alle Knoten bis hierhin ...
local SNAP_MAX = 480    -- ... sonst der naechste bis hierhin (weiter weg: kein Netz – Hoehle, Insel, Instanz)
local SNAP_F = 1.15     -- Anbindung per Luftlinie, leicht verteuert (naeher = sicherer)
local NEAR = 120        -- kuerzer als das: Luftlinie
local LOOK = 340        -- Pfeil schaut hoechstens so weit voraus
local CORR = 30         -- ... solange der Weg in diesem Korridor um die gerade Linie bleibt
local KEEP = 40         -- hoechstens so viele Wegsuchen im Zwischenspeicher (Ziele, Spieler, Flugmeister) ...
local BUDGET = 60000    -- ... und zusammen hoechstens so viele erreichte Knoten (~5 MB); aelteste fliegen raus

local function vec(x, y) if CreateVector2D then return CreateVector2D(x, y) end return { x = x, y = y } end
local function xy(v) if not v then return end if v.GetXY then return v:GetXY() end return v.x, v.y end
local function dist(ax, ay, bx, by) local dx, dy = ax - bx, ay - by; return sqrt(dx * dx + dy * dy) end
local function now() return GetTime and GetTime() or 0 end

---------------------------------------------------------------------------
-- Netz auspacken (pro Kontinent beim ersten Gebrauch)
---------------------------------------------------------------------------
local DEC = {}
do
  local A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  for i = 1, 64 do DEC[byte(A, i)] = i - 1 end
end
local function v3(s, p) return (DEC[byte(s, p)] * 64 + DEC[byte(s, p + 1)]) * 64 + DEC[byte(s, p + 2)] end
local function v2(s, p) return DEC[byte(s, p)] * 64 + DEC[byte(s, p + 1)] end

local G = {}
local SP = {}            -- [g][Schluessel] = Suche (fortsetzbare Dijkstra)
local function bkey(x, y) return (floor(x / BK) + 512) * 1024 + (floor(y / BK) + 512) end

local function graph(cont)
  local g = G[cont]
  if g ~= nil then return g or nil end
  local d = LevelPilot_Walk and LevelPilot_Walk[cont]
  if type(d) ~= "table" or type(d.n) ~= "string" or #d.n < 28 or type(d.e) ~= "string" then G[cont] = false; return nil end
  -- nur ein Kontinent im Speicher (der, auf dem man gerade ist)
  for c, old in pairs(G) do if c ~= cont then if old then SP[old] = nil end; G[c] = nil end end
  -- Kanten als flaches Feld (CSR): Nachbarn von k = ew[first[k] .. first[k+1]-1], je Eintrag Ziel * 4096 + Kosten
  g = { x = {}, y = {}, first = {}, ew = {}, bk = {}, link = {}, place = {} }
  local ns, es = d.n, d.e
  local n = floor(#ns / 7)
  local deg = {}
  for k = 1, n do
    local p = (k - 1) * 7 + 1
    local X, Y = v3(ns, p) - 17100, v3(ns, p + 3) - 17100
    g.x[k], g.y[k], deg[k] = X, Y, 0
    local b = bkey(X, Y)
    local list = g.bk[b]; if not list then list = {}; g.bk[b] = list end
    list[#list + 1] = k
  end
  local p = 1
  for a = 1, n do                                   -- 1. Durchgang: Grad je Knoten (beide Richtungen)
    local cnt = DEC[byte(ns, (a - 1) * 7 + 7)]
    for _ = 1, cnt do
      local b = v3(es, p) + 1
      p = p + 5
      if b <= n then deg[a] = deg[a] + 1; deg[b] = deg[b] + 1 end
    end
  end
  local first, fill, pos = g.first, {}, 1
  for k = 1, n do first[k] = pos; fill[k] = pos; pos = pos + deg[k] end
  first[n + 1] = pos
  local ew = g.ew
  p = 1
  for a = 1, n do                                   -- 2. Durchgang: Kanten eintragen
    local cnt = DEC[byte(ns, (a - 1) * 7 + 7)]
    for _ = 1, cnt do
      local b, c = v3(es, p) + 1, v2(es, p + 3)
      p = p + 5
      if b <= n then
        ew[fill[a]] = b * 4096 + c; fill[a] = fill[a] + 1
        ew[fill[b]] = a * 4096 + c; fill[b] = fill[b] + 1
      end
    end
  end
  for _, l in ipairs(d.L or {}) do
    if l[1] and l[2] then
      g.link[l[1] * 65536 + l[2]] = { name = l[3], kind = l[4] }
      g.link[l[2] * 65536 + l[1]] = { name = l[3], kind = l[4] }
    end
  end
  for _, pl in ipairs(d.P or {}) do if pl[1] then g.place[pl[1]] = pl[2] end end
  -- Teilnetze (Inseln, abgeschnittene Hoehlen): Suchen zwischen getrennten Teilen sofort abbrechen
  local comp, nc, stack = {}, 0, {}
  for k = 1, n do
    if not comp[k] then
      nc = nc + 1; comp[k] = nc; stack[1] = k
      local top = 1
      while top > 0 do
        local u = stack[top]; stack[top] = nil; top = top - 1
        for e = first[u], first[u + 1] - 1 do
          local v = floor(ew[e] / 4096)
          if not comp[v] then comp[v] = nc; top = top + 1; stack[top] = v end
        end
      end
    end
  end
  g.comp = comp
  g.nd = {}               -- [Knoten] = kurze Wege im Umkreis (Anbindungs-Pruefung, s. near)
  g.n = n
  G[cont] = g
  return g
end
W.Graph = graph

---------------------------------------------------------------------------
-- Punkte
---------------------------------------------------------------------------
-- {map, x, y} (0..1) -> { c = Kontinent, x = X, y = Y }
function W.Point(map, x, y)
  if not (map and x and y) then return end
  local ok, cont, w = pcall(C_Map.GetWorldPosFromMapPos, map, vec(x, y))
  if not ok or not cont or not w then return end
  local wx, wy = xy(w)
  if not wx then return end
  return { c = cont, x = wx, y = wy }
end

function W.Player()
  if not (LP_Route and LP_Route.PlayerMapPos) then return end
  local map, x, y = LP_Route.PlayerMapPos()
  if not x then return end
  return W.Point(map, x, y)
end

-- Kurze Wege vom Knoten k0 aus (bis 'lim' Yards), einmal je Knoten gemerkt
local LOCAL_LIM = SNAP_R * 2 * 1.3 + 80
local function localDist(g, k0)
  local D = g.nd[k0]
  if D then return D end
  D = { [k0] = 0 }
  local open = { [k0] = true }
  local first, ew = g.first, g.ew
  while true do
    local u, du
    for k in pairs(open) do if not du or D[k] < du then u, du = k, D[k] end end
    if not u then break end
    open[u] = nil
    for e = first[u], first[u + 1] - 1 do
      local v = floor(ew[e] / 4096)
      local nd = du + (ew[e] - v * 4096)
      if nd <= LOCAL_LIM and nd < (D[v] or huge) then D[v] = nd; open[v] = true end
    end
  end
  g.nd[k0] = D
  return D
end

-- Anbindung ans Netz: Liste { {Knoten, Kosten}, ... } (leer = kein Netz in Reichweite)
-- Nur Knoten, die vom naechsten Knoten aus auf kurzem Bodenweg erreichbar sind (hoechstens 1,3 x Luftlinie):
-- ohne Hoehen im Netz waere sonst der Knoten unten in der Schlucht "direkt" neben dem oben an der Klippe.
local function near(g, px, py)
  local bx, by = floor(px / BK), floor(py / BK)
  local out, best, bd = {}, nil, nil
  local r = floor(SNAP_MAX / BK) + 1
  for i = -r, r do
    for j = -r, r do
      local list = g.bk[(bx + i + 512) * 1024 + (by + j + 512)]
      if list then
        for _, k in ipairs(list) do
          local dd = dist(g.x[k], g.y[k], px, py)
          if dd <= SNAP_R then out[#out + 1] = { k, dd * SNAP_F } end
          if dd <= SNAP_MAX and (not bd or dd < bd) then best, bd = k, dd end
        end
      end
    end
  end
  if #out == 0 and best then out[1] = { best, bd * SNAP_F }; return out end
  if best and #out > 1 then
    local L = localDist(g, best)
    local bx0, by0 = g.x[best], g.y[best]
    local keep = {}
    for _, c in ipairs(out) do
      local k = c[1]
      local walk = L[k]
      if k == best or (walk and walk <= dist(bx0, by0, g.x[k], g.y[k]) * 1.3 + 60) then keep[#keep + 1] = c end
    end
    out = keep
  end
  return out
end
W.Near = function(p) local g = p and graph(p.c); if g then return near(g, p.x, p.y) end end

---------------------------------------------------------------------------
-- Kuerzeste Wege: Dijkstra von einem Punkt aus (alle angebundenen Knoten als Start), fortsetzbar:
-- es wird nur so weit gerechnet, wie die Frage braucht (Kreis um den Punkt), und bei Bedarf erweitert.
---------------------------------------------------------------------------
local function newSearch(g, px, py)
  local st = { D = {}, prev = {}, hn = {}, hd = {}, size = 0, bound = 0, src = {}, t = now(), n = 0, comps = {} }
  for _, c in ipairs(near(g, px, py)) do
    local k, d = c[1], c[2]
    st.comps[g.comp[k]] = true
    if d < (st.D[k] or huge) then
      if not st.D[k] then st.n = st.n + 1 end
      st.D[k] = d; st.src[k] = true
      st.size = st.size + 1; st.hn[st.size], st.hd[st.size] = k, d
      local j = st.size
      while j > 1 do
        local q = floor(j / 2)
        if st.hd[q] <= st.hd[j] then break end
        st.hn[q], st.hn[j] = st.hn[j], st.hn[q]; st.hd[q], st.hd[j] = st.hd[j], st.hd[q]; j = q
      end
    end
  end
  return st
end

-- rechnet weiter, bis alle Knoten bis 'bound' Yards endgueltig sind (oder alles erreicht ist)
local function expand(g, st, bound)
  if bound <= st.bound then return end
  local D, prev, hn, hd = st.D, st.prev, st.hn, st.hd
  local first, ew = g.first, g.ew
  local size, n = st.size, st.n
  while size > 0 and hd[1] <= bound do
    local u, du = hn[1], hd[1]
    hn[1], hd[1] = hn[size], hd[size]; hn[size], hd[size] = nil, nil; size = size - 1
    local i = 1
    while true do
      local l, r, m = i * 2, i * 2 + 1, i
      if l <= size and hd[l] < hd[m] then m = l end
      if r <= size and hd[r] < hd[m] then m = r end
      if m == i then break end
      hn[i], hn[m] = hn[m], hn[i]; hd[i], hd[m] = hd[m], hd[i]; i = m
    end
    if du <= (D[u] or huge) then
      for k = first[u], first[u + 1] - 1 do
        local e = ew[k]
        local v = floor(e / 4096)
        local nd = du + (e - v * 4096)
        local dv = D[v]
        if not dv or nd < dv then
          if not dv then n = n + 1 end
          D[v] = nd; prev[v] = u
          size = size + 1; hn[size], hd[size] = v, nd
          local j = size
          while j > 1 do
            local q = floor(j / 2)
            if hd[q] <= hd[j] then break end
            hn[q], hn[j] = hn[j], hn[q]; hd[q], hd[j] = hd[j], hd[q]; j = q
          end
        end
      end
    end
  end
  st.size, st.n = size, n
  st.bound = (size == 0) and huge or bound
end

local function search(g, px, py)
  local key = floor(px / 30) * 65536 + floor(py / 30)
  local t = SP[g]; if not t then t = {}; SP[g] = t end
  local st = t[key]
  if st then st.t = now(); return st end
  st = newSearch(g, px, py)
  t[key] = st
  -- Zwischenspeicher begrenzen: nach Anzahl und nach Groesse (weite Suchen kosten viel Speicher)
  while true do
    local cnt, tot, oldK, oldT = 0, 0, nil, nil
    for k, v in pairs(t) do
      cnt = cnt + 1; tot = tot + v.n + v.size
      if k ~= key and (not oldT or v.t < oldT) then oldK, oldT = k, v.t end
    end
    if not oldK or (cnt <= KEEP and tot <= BUDGET) then break end
    t[oldK] = nil
  end
  return st
end
W.Flush = function() for g in pairs(SP) do SP[g] = nil end end   -- alle Wegsuchen verwerfen (Tests)
W.Stats = function() local n = 0; for _, t in pairs(SP) do for _ in pairs(t) do n = n + 1 end end; return n end

-- bester Anschluss von p an eine Suche: Yards, Knoten
local function join(g, st, p, straight)
  local all = near(g, p.x, p.y)
  local cand = {}
  for _, c in ipairs(all) do if st.comps[g.comp[c[1]]] then cand[#cand + 1] = c end end
  if #cand == 0 then return end         -- getrenntes Teilnetz: nicht das ganze Netz absuchen
  local bound = max(1500, straight * 1.6)
  while true do
    expand(g, st, bound)
    local best, bk
    for _, c in ipairs(cand) do
      local d = st.D[c[1]]
      if d and d <= st.bound and (not best or c[2] + d < best) then best, bk = c[2] + d, c[1] end
    end
    if best and best <= st.bound then return best, bk end
    if st.bound == huge then return best, bk end
    bound = bound * 1.4
  end
end

-- Bodenweg in Yards von p nach q. Gerechnet wird vom zweiten Punkt aus (das stabile Ende: Ziel oder
-- Spieler) – eine Rechnung reicht fuer viele Abfragen.
-- Rueckgabe: Yards, sicher (true = ueber das Netz, false = Schaetzung) – nil bei anderem Kontinent.
function W.Ground(p, q)
  if not (p and q) or p.c ~= q.c then return nil end
  local straight = dist(p.x, p.y, q.x, q.y)
  if straight < NEAR then return straight, true end
  local g = graph(p.c)
  if not g then return straight * 1.25, false end
  local st = search(g, q.x, q.y)
  if not next(st.src) then return straight * 1.25, false end
  local d = join(g, st, p, straight)
  if not d then return straight * 1.6, false end      -- kein Anschluss / getrennt: vorsichtig schaetzen
  return max(straight, d), true
end

---------------------------------------------------------------------------
-- Pfeil: naechster Wegpunkt auf dem Netz
---------------------------------------------------------------------------
local function segDist(px, py, ax, ay, bx, by)
  local ux, uy = bx - ax, by - ay
  local vx, vy = px - ax, py - ay
  local L = ux * ux + uy * uy
  local t = L > 0 and max(0, min(1, (vx * ux + vy * uy) / L)) or 0
  return dist(px, py, ax + t * ux, ay + t * uy)
end

-- p = Spieler, q = Ziel. Liefert { x, y, rest, via, straight } (Weltpunkt, Restweg in Yards,
-- Tunnel/Aufzug/benannte Stelle voraus) oder nil (gerade Linie reicht / kein Netz), dazu den Restweg.
function W.Aim(p, q)
  if not (p and q) or p.c ~= q.c then return end
  local straight = dist(p.x, p.y, q.x, q.y)
  if straight < NEAR then return end
  local g = graph(p.c); if not g then return end
  local st = search(g, q.x, q.y)
  local total, sp = join(g, st, p, straight)
  if not sp then return end
  -- Knotenfolge vom Spieler zum Ziel (prev zeigt beim Rechnen vom Ziel aus Richtung Ziel)
  local seq, u, guard = {}, sp, 0
  while u and guard < 2000 do
    seq[#seq + 1] = u
    if st.src[u] and not st.prev[u] then break end
    u = st.prev[u]; guard = guard + 1
  end
  local px, py = p.x, p.y
  -- bereits erreichte / ueberholte Knoten vorne weglassen
  while #seq >= 2 do
    local a, b = seq[1], seq[2]
    local da = dist(px, py, g.x[a], g.y[a])
    local pb, ab = dist(px, py, g.x[b], g.y[b]), dist(g.x[a], g.y[a], g.x[b], g.y[b])
    if da < 25 or pb < ab or (da + ab < pb * 1.1 + 10 and segDist(g.x[a], g.y[a], px, py, g.x[b], g.y[b]) < CORR * 2) then
      table.remove(seq, 1)
    else break end
  end
  local rest = max(straight, total)
  -- vorausschauen: weitester Knoten, bis zu dem der Weg im Korridor der geraden Linie bleibt
  local pts = {}
  for _, k in ipairs(seq) do pts[#pts + 1] = { g.x[k], g.y[k], k } end
  pts[#pts + 1] = { q.x, q.y }
  local j, run = 1, 0
  local lx, ly = px, py
  for k = 1, #pts do
    run = run + dist(lx, ly, pts[k][1], pts[k][2]); lx, ly = pts[k][1], pts[k][2]
    if k > 1 and run > LOOK then break end
    local ok = true
    for m = 1, k - 1 do
      if segDist(pts[m][1], pts[m][2], px, py, pts[k][1], pts[k][2]) > CORR then ok = false; break end
    end
    if not ok then break end
    j = k
  end
  -- Tunnel/Aufzug/benannte Stelle in den naechsten ~700 Yards?
  local via
  run = 0; lx, ly = px, py
  for k = 1, #seq do
    local a = seq[k]
    run = run + dist(lx, ly, g.x[a], g.y[a]); lx, ly = g.x[a], g.y[a]
    if run > 700 then break end
    local l = seq[k + 1] and g.link[a * 65536 + seq[k + 1]]
    if l then via = { name = l.name, kind = l.kind, at = run }; break end
    if g.place[a] then via = { name = g.place[a], kind = "place", at = run }; break end
  end
  -- Gerade Linie ist (fast) genauso gut: dann kein Umweg-Pfeil
  if j == #pts and rest < straight * 1.08 + 20 then return nil, rest end
  return { x = pts[j][1], y = pts[j][2], rest = rest, via = via, straight = straight }, rest
end

-- Weltpunkt -> Versatz (Osten, Norden) vom Spieler in Yards
function W.Offset(p, wpt)
  if not (p and wpt) then return end
  return -(wpt.y - p.y), (wpt.x - p.x)
end

---------------------------------------------------------------------------
-- Flugnetz (LevelPilot_Taxi): Flugmeister-Positionen + gemessene Direktfluege (Sekunden)
---------------------------------------------------------------------------
-- Kuerzeste Flugzeit zwischen zwei Flugmeistern (Knoten-Ids wie C_TaxiMap), nur ueber 'known' (Menge der
-- bekannten Knoten-Ids; nil = alle). 'override' [von>nach] = gemessene Sekunden (ersetzt die Tabelle).
-- Rueckgabe: Sekunden, Anzahl Fluege (Umsteigen) – nil, wenn nicht verbunden.
function W.FlightTime(cont, from, to, known, override)
  local d = LevelPilot_Taxi and LevelPilot_Taxi[cont]
  if not d or not d.f or from == to then return (from == to) and 0 or nil end
  local f = d.f
  local adj = {}
  for i = 1, #f - 2, 3 do
    local a, b, s = f[i], f[i + 1], f[i + 2]
    if (not known or (known[a] and known[b])) then
      local o = override and override[a .. ">" .. b]
      adj[a] = adj[a] or {}
      adj[a][#adj[a] + 1] = { b, o or s }
    end
  end
  local D, H, open = { [from] = 0 }, { [from] = 0 }, { [from] = true }
  while true do
    local u, du
    for k in pairs(open) do if not du or D[k] < du then u, du = k, D[k] end end
    if not u then break end
    open[u] = nil
    if u == to then return du, H[u] end
    for _, e in ipairs(adj[u] or {}) do
      local v, nd = e[1], du + e[2] + (u == from and 0 or 5)   -- ~5 s je Zwischenlandung
      if nd < (D[v] or huge) then D[v] = nd; H[v] = H[u] + 1; open[v] = true end
    end
  end
end

-- Position eines Flugmeisters { c, x, y } (aus den Navmesh-Daten)
function W.TaxiPos(cont, id)
  local d = LevelPilot_Taxi and LevelPilot_Taxi[cont]
  local t = d and d.t and d.t[id]
  if t then return { c = cont, x = t[1], y = t[2] } end
end

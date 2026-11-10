-- Tiry's Zentrale – Goldtagebuch: Sitzung, Tage, Gold pro Stunde
local _, ns = ...

local T = {}
ns.Tracker = T

T.session = { start = nil, startTime = nil, earned = 0, spent = 0 }
local lastMoney

local KEEP_DAYS = 30

local function day()
  local key = ns.Today()
  local days = ns.char.days
  if not days[key] then
    days[key] = { start = GetMoney(), earned = 0, spent = 0 }
  end
  return days[key]
end

local function prune()
  local keys = {}
  for k in pairs(ns.char.days) do keys[#keys + 1] = k end
  table.sort(keys)
  while #keys > KEEP_DAYS do
    ns.char.days[table.remove(keys, 1)] = nil
  end
end

ns.Listen("LOGIN", function()
  local money = GetMoney()
  lastMoney = money
  T.session.start = money
  T.session.startTime = time()
  T.session.earned, T.session.spent = 0, 0
  day()
  prune()
end)

ns.On("PLAYER_MONEY", function()
  if not lastMoney or not ns.char then return end
  local money = GetMoney()
  local delta = money - lastMoney
  lastMoney = money
  if delta == 0 then return end
  local d = day()
  if delta > 0 then
    d.earned = d.earned + delta
    T.session.earned = T.session.earned + delta
  else
    d.spent = d.spent - delta
    T.session.spent = T.session.spent - delta
  end
  d.last = money
  ns.Fire("MONEY_CHANGED", delta)
end)

-- Gewinn der Sitzung und Gold pro Stunde
function T.SessionStats()
  local s = T.session
  if not s.start then return 0, 0, 0 end
  local net = GetMoney() - s.start
  local elapsed = math.max(time() - (s.startTime or time()), 1)
  local hours = elapsed / 3600
  local perHour = (elapsed >= 300) and (net / hours) or nil
  return net, perHour, elapsed
end

-- Letzte n Tage (älteste zuerst) für das Diagramm
function T.Days(n)
  local out = {}
  local now = time()
  for i = n - 1, 0, -1 do
    local key = date("%Y-%m-%d", now - i * 86400)
    local d = ns.char.days[key]
    out[#out + 1] = {
      key = key,
      label = date("%d.%m.", now - i * 86400),
      earned = d and d.earned or 0,
      spent = d and d.spent or 0,
      net = d and (d.earned - d.spent) or 0,
    }
  end
  return out
end

function T.BestDay()
  local best
  for key, d in pairs(ns.char.days) do
    local net = (d.earned or 0) - (d.spent or 0)
    if not best or net > best.net then best = { key = key, net = net } end
  end
  return best
end

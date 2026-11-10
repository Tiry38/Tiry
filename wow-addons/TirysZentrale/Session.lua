-- Tiry's Zentrale – Farm-Session: Start/Stopp, Gold pro Stunde live, Vergleich mit früheren Sessions.
-- Gezählt wird: Gold, das du in der Session bekommst (Plünderung, Quests) + Wert der neuen Beute
-- (bester Verkaufsweg, wie beim Beute-Radar). Ausgaben (z. B. Reparatur) werden abgezogen.
-- Händler- und Post-Einnahmen zählen nicht (sonst würde verkaufte Beute doppelt gezählt).
local _, ns = ...

local S = {}
ns.Session = S

local MAX_KEEP = 20

local function store()
  ns.char.farmSessions = ns.char.farmSessions or {}
  return ns.char.farmSessions
end

local function zoneName()
  local z = GetRealZoneText and GetRealZoneText()
  return (z and z ~= "") and z or "Unbekannt"
end

-- Laufende Session (oder nil)
function S.Current()
  return ns.char and ns.char.farmActive
end

function S.Start()
  if S.Current() then return false end
  ns.char.farmActive = {
    start = time(), money = GetMoney(), loot = ns.Auto.session.value or 0, items = ns.Auto.session.items or 0,
    zone = zoneName(),
  }
  ns.Print("Farm-Session gestartet. Zone: |cffff9929" .. ns.char.farmActive.zone .. "|r – viel Erfolg!")
  ns.Fire("SESSION_CHANGED")
  return true
end

-- Werte der laufenden (oder übergebenen) Session
function S.Stats(sess)
  sess = sess or S.Current()
  if not sess then return nil end
  local finished = sess.stop ~= nil
  local elapsed = math.max((sess.stop or time()) - sess.start, 1)
  local money = finished and sess.gold or (GetMoney() - sess.money - (sess.skipped or 0))
  local loot = finished and sess.lootValue or ((sess.lootCarry or 0) + (ns.Auto.session.value or 0) - sess.loot)
  local items = finished and sess.itemCount or ((sess.itemsCarry or 0) + (ns.Auto.session.items or 0) - sess.items)
  local total = money + loot
  local perHour = elapsed >= 60 and (total / (elapsed / 3600)) or nil
  return { elapsed = elapsed, gold = money, loot = loot, items = items, total = total, perHour = perHour, zone = sess.zone }
end

function S.Stop()
  local cur = S.Current()
  if not cur then return false end
  local st = S.Stats(cur)
  local list = store()
  table.insert(list, 1, {
    start = cur.start, stop = time(), zone = cur.zone, gold = st.gold, lootValue = st.loot, itemCount = st.items,
    level = ns.player.level,
  })
  while #list > MAX_KEEP do table.remove(list) end
  ns.char.farmActive = nil
  ns.Print(string.format("Farm-Session beendet: |cffff9929%s|r in %d Min. (%s pro Stunde).", ns.Money(st.total),
    math.floor(st.elapsed / 60 + 0.5), st.perHour and ns.Money(st.perHour) or "zu kurz"))
  ns.Fire("SESSION_CHANGED")
  return true
end

function S.History()
  return store()
end

function S.Delete(index)
  local list = store()
  if list[index] then table.remove(list, index) end
  ns.Fire("SESSION_CHANGED")
end

-- Beste frühere Session (nach Gold pro Stunde, mind. 5 Minuten)
function S.Best()
  local best
  for _, sess in ipairs(store()) do
    local st = S.Stats(sess)
    if st.elapsed >= 300 and st.perHour and (not best or st.perHour > best.perHour) then best = st end
  end
  return best
end

-- Einnahmen beim Händler (verkaufte Beute ist schon als Beutewert gezählt) und aus der Post (AH-Verkäufe)
-- gehören nicht zum Farm-Ergebnis -> herausrechnen. Ausgaben zählen weiter (Reparatur kostet Farm-Gold).
local lastMoney, mailOpen = nil, false
ns.On("MAIL_SHOW", function() mailOpen = true end)
ns.On("MAIL_CLOSED", function() mailOpen = false end)
ns.Listen("LOGIN", function() lastMoney = GetMoney() end)
ns.On("PLAYER_MONEY", function()
  local now = GetMoney()
  local delta = now - (lastMoney or now)
  lastMoney = now
  local cur = S.Current()
  if cur and delta > 0 and (mailOpen or (ns.Scanner and ns.Scanner.merchant.open)) then
    cur.skipped = (cur.skipped or 0) + delta
  end
end)

-- Nach /reload oder Ausloggen läuft die Session weiter: bisherige Beute mitnehmen, Zählung beginnt neu
ns.On("PLAYER_LOGOUT", function()
  local cur = S.Current()
  if not cur then return end
  cur.lootCarry = (cur.lootCarry or 0) + (ns.Auto.session.value or 0) - cur.loot
  cur.itemsCarry = (cur.itemsCarry or 0) + (ns.Auto.session.items or 0) - cur.items
  cur.loot, cur.items = 0, 0
end)

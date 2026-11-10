-- Tiry's Zentrale – Beste Verkaufszeit
-- Wann kaufen die Leute? Zwei Quellen:
--   * Markt (bevorzugt): Kauf-Profil aus den Komplett-Scans (Absatz-Modul), verteilt auf die Uhrzeit
--   * Eigene Verkäufe: Zeitpunkt deiner Verkaufsbriefe (minus gemessene Post-Laufzeit)
-- Goldmacher-Regel: kurz VOR der stärksten Zeit einstellen bzw. unterbieten, dann bist du im Hauptbetrieb vorne.
local _, ns = ...

local T = {}
ns.Timing = T

local WEEKDAY = { "Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag" }

-- Bestes Fenster aus 3 aufeinanderfolgenden Stunden (über Mitternacht hinweg)
local function bestWindow(values)
  local best, bestStart = -1, nil
  for h = 0, 23 do
    local sum = (values[h] or 0) + (values[(h + 1) % 24] or 0) + (values[(h + 2) % 24] or 0)
    if sum > best then best, bestStart = sum, h end
  end
  return bestStart, best
end

-- Eigene Verkäufe der letzten 30 Tage nach Stunde und Wochentag
function T.OwnProfile()
  local b = ns.db and ns.db.ledger
  local hours, days, n = {}, {}, 0
  if not (b and b.sales) then return hours, days, 0 end
  local delay = (ns.AH and ns.AH.TypicalDelay and ns.AH.TypicalDelay()) or 0
  local limit = time() - 30 * 86400
  for _, s in ipairs(b.sales) do
    if s.t and s.t >= limit then
      local t = s.t - delay
      local h = tonumber(date("%H", t)) or 0
      local w = tonumber(date("%w", t)) or 0
      hours[h] = (hours[h] or 0) + 1
      days[w] = (days[w] or 0) + 1
      n = n + 1
    end
  end
  return hours, days, n
end

-- Rückgabe: { from, to, source = "markt"|"eigene", weekday = Name oder nil, text } oder nil (zu wenig Daten)
function T.Best()
  local D = ns.Demand
  local rates, covered = {}, 0
  if D and D.HourProfile then rates, covered = D.HourProfile() end
  local res
  if covered >= 12 then
    local start = bestWindow(rates)
    res = { from = start, to = (start + 3) % 24, source = "markt" }
  else
    local hours, _, n = T.OwnProfile()
    if n >= 8 then
      local start = bestWindow(hours)
      res = { from = start, to = (start + 3) % 24, source = "eigene" }
    end
  end
  local _, days, n = T.OwnProfile()
  if n >= 14 then
    local bestDay, bestN = nil, 0
    for w = 0, 6 do if (days[w] or 0) > bestN then bestDay, bestN = w, days[w] end end
    -- nur nennen, wenn der Tag deutlich heraussticht (mind. 1,5× Durchschnitt)
    if bestDay and bestN >= 1.5 * n / 7 then
      res = res or {}
      res.weekday = WEEKDAY[bestDay + 1]
    end
  end
  if not res then return nil end
  local parts = {}
  if res.from then
    parts[#parts + 1] = string.format("Am meisten wird zwischen %d und %d Uhr gekauft (%s)", res.from, res.to,
      res.source == "markt" and "gemessen im AH" or "deine Verkäufe")
  end
  if res.weekday then parts[#parts + 1] = "dein stärkster Tag: " .. res.weekday end
  res.text = table.concat(parts, " · ")
  if res.from then
    res.tip = string.format("Tipp: gegen %d Uhr einstellen bzw. unterbieten – dann bist du im Hauptbetrieb vorne.",
      (res.from + 23) % 24)
  end
  return res
end

-- Liegt jetzt gerade die stärkste Zeit an (oder steht kurz bevor)?
function T.IsGoodTime()
  local b = T.Best()
  if not (b and b.from) then return nil end
  local h = tonumber(date("%H")) or 0
  for i = -1, 2 do
    if (b.from + i) % 24 == h then return true, b end
  end
  return false, b
end

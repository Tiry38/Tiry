-- Tiry's Zentrale – Karte: Farm-Stellen als Wegpunkt (mit Pfeil) setzen und Weltkarte öffnen
local ADDON, ns = ...

local Maps = {}
ns.Maps = Maps

-- Levelbereich als Schlüssel ("10-20")
function Maps.BandKey(level)
  level = level or ns.player.level
  for _, b in ipairs(ns.FARM or {}) do
    if level >= b.min and level < b.max then return b.key end
  end
  return "50-60"
end

-- Stellen einer Gruppe für deine Fraktion (gegnerische Startgebiete fallen weg)
function Maps.Spots(group, bandKey)
  local band = ns.SPOTS and ns.SPOTS[bandKey or Maps.BandKey()]
  local list = {}
  local enemy = (ns.Faction() == "Horde") and "Alliance" or "Horde"
  for _, s in ipairs((band and band[group]) or {}) do
    if ns.ZONE_FACTION[s.map] ~= enemy then list[#list + 1] = s end
  end
  return list
end

function Maps.ZoneName(mapID)
  if ns.ZONE_NAMES[mapID] then return ns.ZONE_NAMES[mapID] end
  if C_Map and C_Map.GetMapInfo then
    local ok, info = pcall(C_Map.GetMapInfo, mapID)
    if ok and info and info.name then return info.name end
  end
  return "Karte " .. tostring(mapID)
end

-- Setzt den Wegpunkt; der Pfeil am Bildschirmrand führt dich hin
function Maps.Show(spot, what)
  if not spot then return false end
  local zone = Maps.ZoneName(spot.map)
  local ok = false
  if C_Map and C_Map.SetUserWaypoint and UiMapPoint and UiMapPoint.CreateFromCoordinates then
    ok = pcall(function()
      if C_Map.CanSetUserWaypointOnMap and not C_Map.CanSetUserWaypointOnMap(spot.map) then error("map") end
      C_Map.SetUserWaypoint(UiMapPoint.CreateFromCoordinates(spot.map, spot.x / 100, spot.y / 100))
      if C_SuperTrack and C_SuperTrack.SetSuperTrackedUserWaypoint then
        C_SuperTrack.SetSuperTrackedUserWaypoint(true)
      end
    end)
  end
  if OpenWorldMap then pcall(OpenWorldMap, spot.map) end
  if ok then Maps.active = true ns.Fire("WAYPOINT_CHANGED") end
  ns.Print(string.format("%s: |cff8cff4d%s %.0f, %.0f|r%s", what or "Farm-Stelle", zone, spot.x, spot.y,
    ok and " – Wegpunkt gesetzt, folge dem Pfeil." or " – öffne die Karte und lauf zu diesen Koordinaten."))
  return ok
end

-- Beste Stelle für eine Gruppe in deinem Level
function Maps.ShowBest(group, what)
  local spots = Maps.Spots(group)
  if #spots == 0 then
    ns.Print("Für deinen Levelbereich ist keine Stelle hinterlegt.")
    return false
  end
  return Maps.Show(spots[1], what)
end

-- Wegpunkt wieder entfernen (Knopf "Wegpunkt ×" oben im Fenster, /tz wegpunkt)
function Maps.HasWaypoint()
  if C_Map and C_Map.HasUserWaypoint then
    local ok, has = pcall(C_Map.HasUserWaypoint)
    if ok then return has and Maps.active == true end
  end
  return Maps.active == true
end

function Maps.Clear()
  if C_Map and C_Map.ClearUserWaypoint then pcall(C_Map.ClearUserWaypoint) end
  Maps.active = nil
  ns.Print("Wegpunkt entfernt.")
  ns.Fire("WAYPOINT_CHANGED")
end

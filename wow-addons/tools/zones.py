"""Forever-Kartengrenzen (Weltkoordinaten in Yards) je uiMap – aus QuestieDB data/Forever/conversion.json
(DBC des Forever-Clients 1.60.1, "target_bounds"). Neu erzeugen: python3 -I zones.py --refresh

Welt: X = Norden, Y = Westen (wie C_Map.GetWorldPosFromMapPos -> Vector2D x, y).
Kartenposition (0..100): X = top - y/100*(top-bottom), Y = left - x/100*(left-right).
"""
import json, os, sys

# uiMap: (areaId, Kontinent, left, right, top, bottom)  # Name
ZONES = {
    1411: (14, 1, -1962.50, -7250.00, 1808.33, -1716.67),  # Durotar
    1412: (215, 1, 2479.17, -3675.00, 266.67, -3835.42),  # Mulgore
    1413: (17, 1, 2622.92, -7510.42, 1612.50, -5143.75),  # The Barrens
    1416: (36, 0, 783.33, -2016.67, 1500.00, -366.67),  # Alterac Mountains
    1417: (45, 0, -866.67, -4466.67, -133.33, -2533.33),  # Arathi Highlands
    1418: (3, 0, -2079.17, -4566.67, -5889.58, -7547.92),  # Badlands
    1419: (4, 0, -1241.67, -4591.67, -10566.67, -12800.00),  # Blasted Lands
    1420: (85, 0, 3033.33, -1485.42, 3837.50, 825.00),  # Tirisfal Glades
    1421: (130, 0, 3450.00, -750.00, 1666.67, -1133.33),  # Silverpine Forest
    1422: (28, 0, 416.67, -3883.33, 3366.67, 500.00),  # Western Plaguelands
    1423: (139, 0, -2256.25, -6558.33, 3691.67, 825.00),  # Eastern Plaguelands
    1424: (267, 0, 1066.67, -2133.33, 400.00, -1733.33),  # Hillsbrad Foothills
    1425: (47, 0, -1575.00, -5425.00, 1466.67, -1100.00),  # The Hinterlands
    1426: (1, 0, 1802.08, -3122.92, -3877.08, -7160.42),  # Dun Morogh
    1427: (51, 0, -322.92, -2554.17, -6100.00, -7587.50),  # Searing Gorge
    1428: (46, 0, -266.67, -3195.83, -7031.25, -8983.33),  # Burning Steppes
    1429: (12, 0, 1535.42, -1935.42, -7939.58, -10254.17),  # Elwynn Forest
    1430: (41, 0, -833.33, -3333.33, -9866.67, -11533.33),  # Deadwind Pass
    1431: (10, 0, 833.33, -1866.67, -9716.67, -11516.67),  # Duskwood
    1432: (38, 0, -1993.75, -4752.08, -4487.50, -6327.08),  # Loch Modan
    1433: (44, 0, -1681.25, -3852.08, -8575.00, -10022.92),  # Redridge Mountains
    1434: (33, 0, 2220.83, -4160.42, -11168.75, -15422.92),  # Stranglethorn Vale
    1435: (8, 0, -2222.92, -4516.67, -9620.83, -11150.00),  # Swamp of Sorrows
    1436: (40, 0, 3016.67, -483.33, -9400.00, -11733.33),  # Westfall
    1437: (11, 0, -389.58, -4525.00, -2147.92, -4904.17),  # Wetlands
    1438: (141, 1, 3814.58, -1277.08, 11831.25, 8437.50),  # Teldrassil
    1439: (148, 1, 2941.67, -3608.33, 8333.33, 3966.67),  # Darkshore
    1440: (331, 1, 1700.00, -4066.67, 4672.92, 829.17),  # Ashenvale
    1441: (400, 1, -433.33, -4833.33, -3966.67, -6900.00),  # Thousand Needles
    1442: (406, 1, 3245.83, -1637.50, 2916.67, -339.58),  # Stonetalon Mountains
    1443: (405, 1, 4233.33, -262.50, 452.08, -2545.83),  # Desolace
    1444: (357, 1, 5441.67, -1508.33, -2366.67, -7000.00),  # Feralas
    1445: (15, 1, -975.00, -6225.00, -2033.33, -5533.33),  # Dustwallow Marsh
    1446: (440, 1, -218.75, -7118.75, -5875.00, -10475.00),  # Tanaris
    1447: (16, 1, -3277.08, -8347.92, 5341.67, 1960.42),  # Azshara
    1448: (361, 1, 1641.67, -4108.33, 7133.33, 3300.00),  # Felwood
    1449: (490, 1, 533.33, -3166.67, -5966.67, -8433.33),  # Un'Goro Crater
    1450: (493, 1, -1381.25, -3689.58, 8491.67, 6952.08),  # Moonglade
    1451: (1377, 1, 2537.50, -945.83, -5958.33, -8281.25),  # Silithus
    1452: (618, 1, -316.67, -7416.67, 8533.33, 3800.00),  # Winterspring
    1453: (1519, 0, 1722.92, -14.58, -7995.83, -9154.17),  # Stormwind City
    1454: (1637, 1, -3680.60, -5083.21, 2273.88, 1338.46),  # Orgrimmar
    1455: (1537, 0, -713.59, -1504.22, -4569.24, -5096.85),  # Ironforge
    1456: (1638, 1, 516.67, -527.08, -850.00, -1545.83),  # Thunder Bluff
    1457: (1657, 1, 2938.36, 1880.03, 10238.32, 9532.59),  # Darnassus
    1458: (1497, 0, 873.19, -86.18, 1877.95, 1237.84),  # Undercity
    1459: (2597, 30, 1781.25, -2456.25, 1085.42, -1739.58),  # Alterac Valley
    1460: (3277, 489, 2041.67, 895.83, 1627.08, 862.50),  # Warsong Gulch
    1461: (3358, 529, 1858.33, 102.08, 1508.33, 337.50),  # Arathi Basin
}
AREA2MAP = {v[0]: k for k, v in ZONES.items()}
NAMES = {}


def by_area(area):
    m = AREA2MAP.get(int(area))
    return ZONES.get(m) if m else None


def world(area, x, y):
    """(areaId, x%, y%) -> (Kontinent, X, Y) oder None."""
    z = by_area(area)
    if not z or x is None or y is None: return None
    _, cont, l, r, t, b = z
    return cont, t - y / 100.0 * (t - b), l - x / 100.0 * (l - r)


def local(area, X, Y):
    """Weltpunkt -> (x%, y%) auf der Karte des Gebiets."""
    _, cont, l, r, t, b = by_area(area)
    return (l - Y) / (l - r) * 100.0, (t - X) / (t - b) * 100.0


def size(area):
    z = by_area(area)
    if not z: return None
    return z[2] - z[3], z[4] - z[5]


def refresh(conv):
    rows = []
    for t in json.load(open(conv))["geometry"]["transforms"]:
        b = t["target_bounds"]
        rows.append("    %d: (%d, %d, %.2f, %.2f, %.2f, %.2f),  # %s" % (t["ui_map_id"], t["area_id"], t["map_id"], b["left"], b["right"], b["top"], b["bottom"], t["target_name"]))
    me = open(__file__, encoding="utf-8").read()
    a = me.index("ZONES = {") + len("ZONES = {\n"); e = me.index("\n}\n", a)
    open(__file__, "w", encoding="utf-8").write(me[:a] + "\n".join(rows) + me[e:])
    print(len(rows), "Gebiete")


if __name__ == "__main__" and "--refresh" in sys.argv:
    here = os.path.dirname(os.path.abspath(__file__))
    refresh(os.path.join(here, "..", "qdb", "QuestieDB", "data", "Forever", "conversion.json"))

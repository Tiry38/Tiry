#!/usr/bin/env python3
"""Erzeugt TirysZentrale/Data_Spots.lua: die besten Farm-Stellen (Kartenpunkte) je Levelbereich und Materialgruppe.

Quellen (nur als Daten gelesen, kein Code ausgeführt):
- Fundorte von Kräutern/Erzen und Gegner-Positionen + Level: QuestieDB (https://github.com/Questie/QuestieDB,
  data/Forever/foreverObjectDB.lua, foreverNpcDB.lua, l10n/*/deDE), Lizenz GPL-3.0
- Kartennamen (deutsch): DB2 UiMap des Forever-Builds 1.60.1.70862 (wago.tools)

Aufruf: python3 gen_spots.py <spawns.tsv> <UiMap.csv> <questiedb-ordner>
spawns.tsv wird mit dem Parser aus parse.py erzeugt (siehe README).
Methode: Fundpunkte je Zone in ein 4er-Raster, Dichte über die 3x3-Nachbarschaft, die dichtesten
nicht überlappenden Stellen werden Wegpunkte (Mittelpunkt der Fundpunkte in der Umgebung).
"""
import collections, csv, os, re, sys

spawns_path, uimap_path, qdb = sys.argv[1], sys.argv[2], sys.argv[3]
here = os.path.dirname(os.path.abspath(__file__))
out_path = os.path.normpath(os.path.join(here, "..", "TirysZentrale", "Data_Spots.lua"))

ZONES = {12: 1429, 1: 1426, 141: 1438, 14: 1411, 215: 1412, 85: 1420, 40: 1436, 38: 1432, 148: 1439, 17: 1413,
         130: 1421, 44: 1433, 10: 1431, 11: 1437, 267: 1424, 331: 1440, 406: 1442, 45: 1417, 400: 1441, 405: 1443,
         36: 1416, 33: 1434, 15: 1445, 440: 1446, 357: 1444, 47: 1425, 3: 1418, 8: 1435, 51: 1427, 490: 1449,
         361: 1448, 16: 1447, 618: 1452, 46: 1428, 28: 1422, 139: 1423, 1377: 1451, 4: 1419}
# Fraktionsgebiete (für die Anzeige "deine Fraktion"); alle anderen = umkämpft
ALLIANCE = {12, 1, 141, 40, 38, 148, 44, 10, 11}
HORDE = {14, 215, 85, 17, 130}

NODES = {
    "herb": {"Peacebloom": 2447, "Silverleaf": 765, "Earthroot": 2449, "Mageroyal": 785, "Briarthorn": 2450,
             "Bruiseweed": 2453, "Wild Steelbloom": 3355, "Stranglekelp": 3820, "Grave Moss": 3369, "Kingsblood": 3356,
             "Liferoot": 3357, "Fadeleaf": 3818, "Goldthorn": 3821, "Khadgar's Whisker": 3358, "Wintersbite": 3819,
             "Firebloom": 4625, "Purple Lotus": 8831, "Arthas' Tears": 8836, "Sungrass": 8838, "Blindweed": 8839,
             "Ghost Mushroom": 8845, "Gromsblood": 8846, "Golden Sansam": 13464, "Dreamfoil": 13463,
             "Mountain Silversage": 13465, "Plaguebloom": 13466, "Icecap": 13467, "Black Lotus": 13468},
    "ore": {"Copper Vein": 2770, "Tin Vein": 2771, "Silver Vein": 2775, "Iron Deposit": 2772, "Gold Vein": 2776,
            "Mithril Deposit": 3858, "Truesilver Deposit": 7911, "Small Thorium Vein": 10620, "Rich Thorium Vein": 10620},
}
BEAST = re.compile(r"\b(Wolf|Worg|Boar|Bear|Panther|Tiger|Lion|Lynx|Leopard|Raptor|Crocolisk|Kodo|Plainstrider|Zhevra|"
                   r"Hyena|Coyote|Goretusk|Stag|Strider|Thunder Lizard|Basilisk|Gorilla|Yeti|Prowler|Nightsaber|Frostsaber|"
                   r"Thistle Boar|Thunderhead|Mottled|Bristle|Ravager|Felstalker|Saber|Bloodsnout|Chimaera|Devilsaur|Stegodon|"
                   r"Pterrordax|Diemetradon|Scorpid|Turtle|Snapjaw|Hippogryph|Shardtooth|Ironfur|Cougar|Wildcat|"
                   r"Mountain Lion|Shadowhorn|Elk|Wendigo|Owlbeast|Wildkin|Grizzly)\b", re.I)
NOT_BEAST = re.compile(r"Silithid|Quilboar|Bristleback|Razormane|Gnoll|Spirit|Ghost|Elemental", re.I)
HUMANOID = re.compile(r"\b(Defias|Kobold|Gnoll|Murloc|Trogg|Quilboar|Razormane|Bristleback|Kolkar|Galak|Magram|Gelkis|Centaur|"
                      r"Harpy|Bandit|Thief|Pillager|Footpad|Highwayman|Rogue|Cultist|Scarlet|Syndicate|Venture|Dragonmaw|"
                      r"Blackrock|Ogre|Satyr|Furbolg|Timbermaw|Foulweald|Thistlefur|Dark Iron|Shadowforge|Smolderthorn|"
                      r"Witherbark|Mosshide|Dalaran|Grimtotem|Bloodscalp|Skullsplitter|Mosh'Ogg|Boulderfist|Stromgarde|"
                      r"Syndicate|Wastewander|Southsea|Bloodsail|Hillsbrad|Farmer|Peasant|Smuggler|Raider|Marauder|Mystic|"
                      r"Trapper|Poacher|Deathstalker|Scourge Warder|Ravenclaw|Burning Blade|Searing Blade|Shadowmage|Enforcer|"
                      r"Pirate|Buccaneer|Mercenary|Thug|Brigand|Rebel|Insurgent|Firemane|Gordunni|Woodpaw|Hatecrest|Vilebranch|"
                      r"Shadowpine|Jaedenar|Deadwood|Winterfall|Thunderbrow|Dunemaul|Sandfury)\b", re.I)
ELEMENT = re.compile(r"\b(Elemental|Rumbler|Tempest|Rock Elemental|Lava|Water Spirit|Sea Spray|Dust Devil|Whirlwind|Tidal|"
                     r"Living Flame|Burning|Earthen|Cyclonian|Thunder Spirit)\b", re.I)

BANDS = [(1, 10), (10, 20), (20, 30), (30, 40), (40, 50), (50, 60)]

uimap = {int(r["ID"]): r["Name_lang"] for r in csv.DictReader(open(uimap_path, encoding="utf-8"))}


def lookup(path, rx):
    d = {}
    if os.path.exists(path):
        for m in re.finditer(rx, open(path, encoding="utf-8").read()):
            d[int(m.group(1))] = m.group(2)
    return d


de_npc = lookup(os.path.join(qdb, "l10n/Classic/lookupNpcs/deDE.lua"), r'\n\[(\d+)\] = \{"((?:[^"\\]|\\.)*)"')
de_obj = lookup(os.path.join(qdb, "l10n/Classic/lookupObjects/deDE.lua"), r'\n\[(\d+)\] = "((?:[^"\\]|\\.)*)"')

points = collections.defaultdict(list)  # (gruppe, band) -> [(zone, x, y, name)]
skin = collections.defaultdict(list)    # 5er-Levelband -> [(zone, x, y, name, lo, hi)]
SKIN_BANDS = [(i, i + 4) for i in range(1, 61, 5)]
# Spezial-Leder: Item -> Tiernamen (englische Namen in der QuestieDB)
SPECIAL = {  # Item -> (Tiernamen, Mindestlevel der Tiere)
    15422: (re.compile(r"Frostsaber", re.I), 50),
    15419: (re.compile(r"Angerclaw|Warbear", re.I), 47),
    15417: (re.compile(r"Devilsaur", re.I), 50),
    15423: (re.compile(r"Chimaera", re.I), 45),
    8167: (re.compile(r"^(?!.*Crocolisk).*(Turtle|Snapjaw|Shellhide)", re.I), 30),
    8154: (re.compile(r"Scorpid", re.I), 35),
    4461: (re.compile(r"Raptor", re.I), 25),
}
special = collections.defaultdict(list)
zone_levels = collections.defaultdict(list)
for line in open(spawns_path, encoding="utf-8"):
    f = line.rstrip("\n").split("\t")
    if f[0] != "N":
        continue
    zone, lo, hi = int(f[5]), int(f[3]), int(f[4])
    if zone in ZONES and 0 < lo <= 63:
        zone_levels[zone].append((lo + hi) / 2)
zone_level = {z: sorted(v)[len(v) // 2] for z, v in zone_levels.items() if len(v) > 20}

for line in open(spawns_path, encoding="utf-8"):
    f = line.rstrip("\n").split("\t")
    if f[0] not in ("O", "N"):
        continue
    oid, name, lo, hi, zone, x, y = int(f[1]), f[2], int(f[3]), int(f[4]), int(f[5]), float(f[6]), float(f[7])
    if zone not in ZONES:
        continue
    if f[0] == "O":
        for group, table in NODES.items():
            if name in table:
                zl = zone_level.get(zone)
                for b in BANDS:
                    if zl is not None and b[0] - 3 <= zl < b[1] + 3:
                        points[(group, b)].append((zone, x, y, de_obj.get(oid, name), table[name]))
    else:
        if lo <= 0 or hi > 63:
            continue
        group = None
        if BEAST.search(name) and not NOT_BEAST.search(name):
            group = "leather"
            for item, (rx, minlvl) in SPECIAL.items():
                if rx.search(name) and lo >= minlvl:
                    special[item].append((zone, x, y, de_npc.get(oid, name), lo, hi))
            for sb in SKIN_BANDS:
                mid = (lo + hi) / 2
                if sb[0] <= mid <= sb[1] + 0.5:
                    skin[sb].append((zone, x, y, de_npc.get(oid, name), lo, hi))
        elif HUMANOID.search(name):
            group = "cloth"
        elif ELEMENT.search(name):
            group = "special"
        if not group:
            continue
        for b in BANDS:
            if b[0] - 1 <= hi and lo <= b[1] + 1 and (lo + hi) / 2 >= b[0] - 1:
                points[(group, b)].append((zone, x, y, de_npc.get(oid, name), None))


def hotspots(pts, limit=4):
    grid = collections.defaultdict(list)
    for p in pts:
        grid[(p[0], int(p[1] // 4), int(p[2] // 4))].append(p)
    scored = []
    for (z, gx, gy) in grid:
        near = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                near += grid.get((z, gx + dx, gy + dy), [])
        scored.append((len(near), z, gx, gy, near))
    scored.sort(key=lambda s: -s[0])
    chosen = []
    for n, z, gx, gy, near in scored:
        if n < 4:
            break
        if any(c[1] == z and abs(c[2] - gx) <= 3 and abs(c[3] - gy) <= 3 for c in chosen):
            continue
        chosen.append((n, z, gx, gy, near))
        if len(chosen) >= limit:
            break
    out = []
    for n, z, gx, gy, near in chosen:
        x = sum(p[1] for p in near) / len(near)
        y = sum(p[2] for p in near) / len(near)
        names = collections.Counter(p[3] for p in near).most_common(3)
        items = sorted({p[4] for p in near if p[4]})
        out.append((ZONES[z], z, round(x, 1), round(y, 1), n, [nm for nm, _ in names], items))
    return out


def q(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


lines = [
    "-- AUTOMATISCH ERZEUGT von wow-addons/tools/gen_spots.py – nicht von Hand bearbeiten.",
    "-- Farm-Hotspots je Levelbereich/Materialgruppe, berechnet aus den Fundorten der QuestieDB (Forever, GPL-3.0).",
    "-- Je Stelle: Karte (uiMapID), Zonenname, x, y (0-100), Anzahl Fundpunkte in der Nähe, Beispiele, Items",
    "local _, ns = ...",
    "ns.ZONE_NAMES = {",
]
for a, u in sorted(ZONES.items(), key=lambda t: t[1]):
    lines.append(f"  [{u}] = {q(uimap[u])},")
lines.append("}")
lines.append("ns.ZONE_FACTION = {")
for a, u in sorted(ZONES.items(), key=lambda t: t[1]):
    fac = "Alliance" if a in ALLIANCE else ("Horde" if a in HORDE else "both")
    lines.append(f'  [{u}] = "{fac}",')
lines.append("}")
lines.append("ns.SPOTS = {")
total = 0
for b in BANDS:
    key = f"{b[0]}-{b[1]}"
    lines.append(f'  ["{key}"] = {{')
    for group in ("herb", "ore", "leather", "cloth", "special"):
        spots = hotspots(points.get((group, b), []))
        if not spots:
            continue
        lines.append(f"    {group} = {{")
        for (u, z, x, y, n, names, items) in spots:
            total += 1
            lines.append(f"      {{ map = {u}, x = {x}, y = {y}, n = {n}, names = {{ {', '.join(q(s) for s in names)} }}, items = {{ {', '.join(str(i) for i in items)} }} }},")
        lines.append("    },")
    lines.append("  },")
lines.append("}")
# Häut-Spots in 5er-Schritten mit Tierlevel (+ Spezial-Leder nach Item-ID)
lines.append("ns.SKIN_SPOTS = {")
keys = [(sb[0], skin.get(sb, [])) for sb in SKIN_BANDS] + [(item, special.get(item, [])) for item in SPECIAL]
for key, raw in keys:
    sb = (key, 0)
    pts = [(p[0], p[1], p[2], p[3], None, p[4], p[5]) for p in raw]
    grid = collections.defaultdict(list)
    for p_ in pts:
        grid[(p_[0], int(p_[1] // 4), int(p_[2] // 4))].append(p_)
    scored = []
    for (z, gx, gy) in grid:
        near = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                near += grid.get((z, gx + dx, gy + dy), [])
        scored.append((len(near), z, gx, gy, near))
    scored.sort(key=lambda s_: -s_[0])
    chosen = []
    for n, z, gx, gy, near in scored:
        if n < (1 if key > 100 else 4):
            break
        if any(c[1] == z and abs(c[2] - gx) <= 3 and abs(c[3] - gy) <= 3 for c in chosen):
            continue
        chosen.append((n, z, gx, gy, near))
        if len(chosen) >= (3 if key > 100 else 6):
            break
    lines.append(f"  [{sb[0]}] = {{")
    for n, z, gx, gy, near in chosen:
        x = sum(p_[1] for p_ in near) / len(near)
        y = sum(p_[2] for p_ in near) / len(near)
        names = [nm for nm, _ in collections.Counter(p_[3] for p_ in near).most_common(3)]
        lo = min(p_[5] for p_ in near)
        hi = max(p_[6] for p_ in near)
        total += 1
        lines.append(f"    {{ map = {ZONES[z]}, x = {round(x, 1)}, y = {round(y, 1)}, n = {n}, lo = {lo}, hi = {hi}, names = {{ {', '.join(q(s_) for s_ in names)} }} }},")
    lines.append("  },")
lines.append("}")
open(out_path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print(out_path, total, "Hotspots")

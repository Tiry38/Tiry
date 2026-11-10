# Routen-Abschnitte (Speedrun-Konsens) -> plan.py (Stufe mitrechnen, Grenz-XP/Minute-Filter)
# Start: cd tools && python3 -I make_route.py && python3 -I build.py
import sys, json
import os as _os
HERE = _os.path.dirname(_os.path.abspath(__file__)); _os.chdir(HERE)
sys.path.insert(0, HERE)
from gen_route import Q, N
def npc(name):
    ids=[int(k) for k,v in N.items() if v["name"]==name and v["sp"]]
    return (name, ids[0]) if ids else (name, None)
# Reihenfolge per Rechnung gewaehlt (tools/plan.py: 12 Varianten verglichen, Zeit bis Stufe 30 zu Fuss -
# Forever-Reittier erst ab 40). Gewinner: lange Bloecke je Zone, kein Abschnitt mit nur 1-2 Quests,
# am wenigsten Grinden. Deckt sich mit den Speedrun-Routen (Brachland/Steinkralle 22-25, Eschental 25-27,
# Huegelland 27-29, Tausend Nadeln 29-30).
_B=[1528,1530,1535,1536, 868,843,879,906,893,4921,899,878,5052,865,1069,1061, 846,849,885,1095]
_S=[1069,1062,6461,6284,1093,1094,1090,1092,1095,1096,6301,6381,1087,1058,6282,6393,5881,1088,6283]
_A=[6383,23,24,2,247,6503,6544,25,1918,824,6641,216,6462,6442,6441,1088]
_H=[493,494,496,498,499,501,502,527,528,546,567,529,532,539,509,1536]
_N=[5881,4542,4841,1149,4821,4865,4770,4767,5064,4904,4881,4966,5147]
SEG=[
 dict(name="Orgrimmar", l=22, areas=[1637], hub=npc("Kardris Dreamseeker"), travel="train", tnote="Klassenlehrer – neue Zauber",
      q=[1528,1061,235], pool=False, nocheck=True),
 dict(name="Brachland", l=22, areas=[17], hub=npc("Omusa Thunderhorn"), tnote="Camp Taurajo – Ruhestein hier setzen", q=_B),
 dict(name="Steinkrallengebirge", l=24, areas=[406], near_npcs=["Seereth Stonebreak","Makaba Flathoof"], hub=npc("Tharm"),
      tnote="Sonnenfels", q=_S),
 dict(name="Brachland", l=25, areas=[17], hub=npc("Omusa Thunderhorn"), tnote="Camp Taurajo", q=_B),
 dict(name="Eschental", l=26, areas=[331], hub=npc("Vhulgra"), tnote="Splitterholzposten – Ruhestein hier setzen", q=_A),
 dict(name="Hügelland", l=27, areas=[267,130], hub=npc("Zarise"),
      tnote="Tarrens Mühle: Flug Orgrimmar → Zeppelin Tirisfal → Unterstadt → Flug Tarrens Mühle. Ruhestein hier setzen", q=_H),
 dict(name="Tausend Nadeln", l=29, areas=[400], hub=npc("Nyse"),
      tnote="Freiwindposten: Ruhestein/Zeppelin nach Orgrimmar → Flug Richtung Camp Taurajo → Großer Aufzug", q=_N),
]
PROTECT = {1528, 1530, 1535, 1536}   # Ruf des Wassers: Wassertotem fuer Schamanen (Klassenquest, nicht wegen XP)

def with_pool(SEG, lo=19, hi=31, cls_ok=64):
    """Kuratierte Liste + alle passenden Horde-Quests der Zone (nicht in Staedten)."""
    import plan
    out = []
    for s in SEG:
        s = dict(s); s["q"] = list(s["q"])
        if s.get("pool", s["areas"][0] not in (1637, 1638, 1497)):
            for q in plan.auto_pool(s["areas"], lo, hi, cls_ok, zones=set(s["areas"])):
                if q not in s["q"]: s["q"].append(q)
        out.append(s)
    return out


# ---------------- Route 30-40 (Speedrun-Konsens Joana / Bustea(Nightfall) / WoW-Pro, siehe UEBERGABE.md) ----------------
_TN2 = [4542,4841,4821,4865,4767,5147,5064,5062,1131,1149,4881,1196,1197,1130,
        5762,1111,1175,1105,1176,1110,1104,1178,1106,1145,1146,1147,1148,1184,1112,1114]
_STV = [583,185,186,187,188,190,191,192,194,195,196,581,582,596,629,568,569,570,572,638,605,189,213,201,
        1180,1181,1182,1183,575,577,584,209,1240,1261,598]
_HIL = [552,553,544,556,545,557,1136,7321,533,529,532,539,550,567,509,1164,503,506,507,508]
_ARA = [655,672,674,675,677,678,671,701,702,847,642,651,1164,676]
_DES = [1362,1365,1368,1431,1432,1433,1436,1434,1435,1480,1481,5561,5501,5741,6027,6161,6142,6143,5386,5381,1366,1370,5763,5421]
_DUS = [1268,1269,1251,1321,1201,1202,1177,1238,1218,1206,1239]
_BAD = [710,711,1108,703,1419,1418,698,1424,1392,1389]
SEG30 = [   # per Modell verglichen: kein Gebiet mit nur 1-3 Quests; Ödland (5 Quests, Weg durch Allianz-Gebiet) gestrichen,
            # Schlingendorntal zum Schluss erst ab 39 (Stufe-41-Quests: 13 statt 3 Quests, -26 Min)
 dict(name="Tausend Nadeln", l=30, areas=[400], hub=npc("Nyse"), tnote="Freiwindposten – dann Schimmernde Ebene (Rennbahn)", q=_TN2),
 dict(name="Hügelland", l=32, minL=32, areas=[267, 36], hub=npc("Zarise"),
      tnote="Tarrens Mühle: Flug Orgrimmar → Zeppelin Tirisfal → Flug Tarrens Mühle. Ruhestein hier", q=_HIL),
 dict(name="Arathihochland", l=32, minL=32, areas=[45], hub=npc("Urda"), tnote="Hammerfall: Flug Tarrens Mühle → Hammerfall", q=_ARA),
 dict(name="Schlingendorntal", l=34, minL=34, areas=[33], hub=npc("Thysta"),
      tnote="Grom'gol: Flug Unterstadt, Zeppelin Tirisfal → Grom'gol. Ruhestein Grom'gol", q=_STV),
 dict(name="Desolace", l=35, minL=35, areas=[405], hub=npc("Thalon"),
      tnote="Schattenflucht: Zeppelin Grom'gol → Orgrimmar, Flug Sonnenfels, südlich nach Desolace laufen – Flugpunkt holen", q=_DES),
 dict(name="Düstermarschen", l=36, minL=36, areas=[15], hub=npc("Shardi"),
      tnote="Brackenwall: Flug Camp Taurajo, östlich in die Düstermarschen – Flugpunkt holen, Ruhestein hier", q=_DUS),
 dict(name="Arathihochland", l=38, minL=38, areas=[45], hub=npc("Urda"), tnote="Hammerfall: Zeppelin Grom'gol → Tirisfal, Flug Hammerfall", q=_ARA),
 dict(name="Schlingendorntal", l=39, minL=39, areas=[33], hub=npc("Thysta"),
      tnote="Grom'gol: Flug Unterstadt, Zeppelin Tirisfal → Grom'gol (Nesingwary/Beutebucht Stufe-41-Quests)", q=_STV),
]

ROUTES = {
 "horde_22_30": dict(SEG=SEG, L0=22, goal=30, lo=19, hi=31, name="Horde 22–30 · Speedrun", rmin=20, rmax=30, file="Horde_22_30.lua"),
 "horde_30_40": dict(SEG=SEG30, L0=30, goal=40, lo=28, hi=42, name="Horde 30–40 · Speedrun", rmin=30, rmax=40, file="Horde_30_40.lua"),
}


def tune(key, segs, log=print):
    """Einstiegsstufe je Abschnitt suchen (Koordinatensuche): vorher grinden, wenn die Zone dadurch schneller wird."""
    from plan import plan
    import xpmodel as X
    R = ROUTES[key]
    def cost(ss):
        st = plan(ss, L0=R["L0"], xp0=0, protect=PROTECT, log=lambda *a: None, goal=R["goal"])[0]
        return X.evaluate(st, R["L0"], 0, verbose=False)[2][2]
    best = cost(segs)
    for rnd in range(2):
        changed = False
        for i in range(1, len(segs)):
            base_l = segs[i]["l"]
            for m in (None, base_l - 1, base_l, base_l + 1):
                if m == segs[i].get("minL"): continue
                trial = [dict(x) for x in segs]
                if m is None: trial[i].pop("minL", None)
                else: trial[i]["minL"] = m
                c = cost(trial)
                if c < best - 1:
                    best, segs, changed = c, trial, True
                    log("  %s: Einstieg ab Stufe %s -> %.0f Min" % (segs[i]["name"], m, c))
        if not changed: break
    return segs


def run(key="horde_22_30", write=True, log=print, SEG_=None, do_tune=True):
    from plan import plan
    import xpmodel as X
    R = ROUTES[key]
    segs = with_pool([dict(s, q=[q for q in s["q"] if str(q) in Q]) for s in (SEG_ or R["SEG"])], R["lo"], R["hi"])
    if do_tune: segs = tune(key, segs, log)
    steps, S, val, removed, why, segs = plan(segs, L0=R["L0"], xp0=0, protect=PROTECT, log=log, goal=R["goal"])
    if write:
        log("gestrichen (Grenz-XP/Min unter Grind-Tempo):")
        for q in sorted(removed): log("  %5d %-36s %s" % (q, Q[str(q)][0][:36], why.get(q)))
        json.dump(dict(key=key, name=R["name"], min=R["rmin"], max=R["rmax"], file=R["file"], L0=R["L0"], steps=steps),
                  open("gen_steps_%s.json" % key, "w"))
        log("%d Schritte" % len(steps))
    return steps, X.evaluate(steps, R["L0"], 0, verbose=write)


if __name__ == "__main__":
    keys = sys.argv[1:] or list(ROUTES)
    for k in keys:
        print("=====", k); run(k)

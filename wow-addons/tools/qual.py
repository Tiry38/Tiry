# Quest-Bewertung: geschaetzter Ertrag (Questlevel) pro geschaetzter Zeit
import sys, json, math, statistics
sys.path.insert(0,".")
from qdb import load
from gen_route import Q, N, spawns, giver, finisher, objective_pts, trigger_pts, centroid
RAW_N = load("Npc"); RAW_Q = load("Quest")
def rank(n):
    v = RAW_N.get(n); return (v[5] if v and len(v) > 5 and isinstance(v[5], int) else 0)
def obj_lists(q):
    ob = Q[str(q)][9] if len(Q[str(q)]) > 9 else None
    if not ob: return [], [], [], []
    def l(k): return [c for c in (ob[k] if len(ob) > k and ob[k] else []) if isinstance(c, list) and c]
    return l(0), l(1), l(2), l(4) if len(ob) > 4 else []
def flags(q):
    v = RAW_Q.get(q); return (v[22] if v and len(v) > 22 and isinstance(v[22], int) else 0)
def spread(pts, area):
    sel = [(x, y) for a, x, y in pts if a == area]
    if len(sel) < 2: return 0
    cx = sum(p[0] for p in sel) / len(sel); cy = sum(p[1] for p in sel) / len(sel)
    return math.sqrt(sum((p[0]-cx)**2 + (p[1]-cy)**2 for p in sel) / len(sel))
def d(a, b):
    if not a or not b: return 0
    if a[0] != b[0]: return 60
    return math.hypot(a[1]-b[1], a[2]-b[2])
def assess(q, areas, hub=None):
    v = Q[str(q)]; ql = v[4] or v[3] or 1
    kills, objs, items, kmix = obj_lists(q)
    pts = objective_pts(q); c = centroid(pts, set(areas))
    g = giver(q); f = finisher(q)
    gp = g[0][0] if g else None; fp = f[0][0] if f else None
    if c and gp and gp[0] != c[0] and any(p[0][0] == c[0] for p in g): gp = [p for p, _ in g if p[0] == c[0]][0]
    travel = d(gp, c) + d(c, fp) if c else d(gp, fp)
    work = 0; why = []
    elite = any(rank(k[0]) in (1, 2) for k in kills) or any(rank(n) in (1, 2) for kk in kmix for n in (kk[0] if isinstance(kk[0], list) else []))
    for it in items:
        I_ = json.load(open("full.json"))["I"] if False else None
    n_obj = len(kills) + len(objs) + len(items) + len(kmix)
    work += 3 * len(kills) + 2 * len(objs) + 4.5 * len(items) + 3 * len(kmix)
    if c: work += 1.5 * spread(pts, c[0])
    if elite: work += 25; why.append("Elite")
    esc = bool(flags(q) & 2)
    if esc: work += 15; why.append("Begleitquest")
    if n_obj == 0 and not trigger_pts(q): why.append("nur Laufen")
    t = 2 + travel * 0.6 + work           # grobe Minuten-Einheit
    xp = ql ** 1.6                        # Quest-XP waechst ueberproportional mit dem Level
    return dict(q=q, name=v[0], ql=ql, travel=round(travel, 1), work=round(work, 1), t=round(t, 1), score=xp / t, why=why, elite=elite, esc=esc)
if __name__ == "__main__":
    exec(open("make_route.py").read().split("steps,done,acc")[0])
    for seg in SEG:
        rs = [assess(q, seg["areas"]) for q in seg["q"]]
        med = statistics.median([r["score"] for r in rs]) if rs else 1
        print("==", seg["name"], seg["l"])
        for r in sorted(rs, key=lambda r: r["score"]):
            print("  %5.2f  %-34s ql%-2s reise %-5s arbeit %-5s %s" % (r["score"] / med, r["name"][:34], r["ql"], r["travel"], r["work"], ",".join(r["why"])))

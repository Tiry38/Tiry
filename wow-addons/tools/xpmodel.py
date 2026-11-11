# XP-Modell fuer die Routenbewertung (LevelPilot)
# - Quest-XP: echte Werte aus QuestieDB support/Forever/QuestXP (Forever-Client-Daten)
# - Abzug fuer zu niedrige Quests: Questie-Formel  faktor = clamp(2*(ql-L)+20, 1, 10)/10
#   (voll bis 5 Stufen darunter, dann 80/60/40/20/10 %)
# - Mob-XP (Classic-Formel) fuer Gegner, die man fuer die Quest ohnehin toetet
# - Zeit: Kills/Drops (Dropraten aus Questies Wowhead-Tabelle), Objekte, Gespraeche
# Start: python3 -I tools/xpmodel.py  (bewertet tools/route.json)
import os, re, json, math, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
SUP = os.path.join(HERE, "..", "qdb", "QuestieDB", "support")

# Classic: XP bis zur naechsten Stufe
XP_LEVEL = {1: 400, 2: 900, 3: 1400, 4: 2100, 5: 2800, 6: 3600, 7: 4500, 8: 5400, 9: 6500, 10: 7600,
            11: 8800, 12: 10100, 13: 11400, 14: 12900, 15: 14400, 16: 16000, 17: 17700, 18: 19400,
            19: 21300, 20: 23200, 21: 25200, 22: 27300, 23: 29400, 24: 31700, 25: 34000, 26: 36400,
            27: 38900, 28: 41400, 29: 44300, 30: 47400, 31: 50800, 32: 54500, 33: 58600, 34: 62800,
            35: 67100, 36: 71600, 37: 76100, 38: 80800, 39: 85700, 40: 90700, 41: 95800, 42: 101000}

# Zonengroessen: aus den echten Forever-Kartengrenzen (zones.py). Die fruehere Handtabelle hatte
# Hillsbrad (1,5-fach) und Mulgore (Forever-Karte geaendert) falsch.
import zones
try:
    import navmesh as NM          # Laufwege aus der Spielgeometrie (navmesh.json, siehe navmesh.py)
except Exception:                 # pragma: no cover
    NM = None

SPEED = 7.0           # Yards/s zu Fuss (Forever: Reittier erst ab Stufe 40)
PATH = 1.2            # Umweg-Faktor Gelaende
T_KILL = 0.50         # Minuten je normalem Gegner inkl. Pause/Looten (Verstaerker, Stufe 22-30)
T_GRIND = 0.60        # Minuten je Gegner beim freien Grinden (Suchen, Laufen, Pause, volle Gebiete)
T_OBJ = 0.25          # Minuten je Objekt (anklicken, kurze Wege)
T_TALK = 0.15         # Minuten je Annehmen/Abgeben
T_ZONE = 4.0          # Minuten je Zonenwechsel (Flug inkl. Warten) - grob


def _parse_xp(path, pat):
    d = {}
    if os.path.exists(path):
        for m in re.finditer(pat, open(path, encoding="utf-8").read()):
            d[int(m.group(1))] = (int(m.group(2)), int(m.group(3)))
    return d


XPDB = _parse_xp(os.path.join(SUP, "Forever", "QuestXP", "xpDB-classic.lua"), r"\[(\d+)\] = \{(\d+), (\d+)\}")
XPDB.update(_parse_xp(os.path.join(SUP, "Forever", "QuestXP", "xpDB-traces.lua"), r"QuestXP\.db\[(\d+)\] = \{(\d+), (\d+)\}"))


def _parse_drops():
    p = os.path.join(SUP, "Forever", "DropTables", "classicItemDrops.lua")
    txt = open(p, encoding="utf-8").read() if os.path.exists(p) else ""
    out = {}
    for sect in ("cmangosData", "wowheadData"):          # Wowhead (gemessen) ueberschreibt cmangos
        m = re.search(sect + r" = \[\[return \{(.*?)\n\}\]\]", txt, re.S)
        if not m: continue
        for im in re.finditer(r"\[(\d+)\] = \{[^\n]*\n(.*?)\n    \},", m.group(1), re.S):
            rates = {int(a): float(b) for a, b in re.findall(r"\[(\d+)\] = ([0-9.]+)", im.group(2))}
            if rates: out[int(im.group(1))] = rates
    return out


DROPS = _parse_drops()

D = json.load(open(os.path.join(HERE, "full.json")))
Q, N, O, I = D["Q"], D["N"], D["O"], D["I"]
from qdb import load
RAW_N = load("Npc")


def quest_xp(q, L):
    v = XPDB.get(int(q))
    if not v: return 0, None
    ql, xp = v
    f = max(1, min(10, 2 * (ql - L) + 20)) / 10.0
    return int(xp * f), ql


def npc_level(n):
    v = RAW_N.get(int(n))
    if not v: return None
    lo = v[3] if len(v) > 3 and isinstance(v[3], int) else None
    hi = v[4] if len(v) > 4 and isinstance(v[4], int) else lo
    if lo is None: return None
    return (lo + (hi or lo)) / 2.0


def npc_rank(n):
    v = RAW_N.get(int(n)); return v[5] if v and len(v) > 5 and isinstance(v[5], int) else 0


def _zd(L):
    for top, z in ((7, 5), (9, 6), (11, 7), (15, 8), (19, 9), (29, 11), (39, 12), (44, 13), (49, 14), (54, 15)):
        if L <= top: return z
    return 16


def mob_xp(M, L, elite=False):
    if M is None: return 0
    base = L * 5 + 45
    if M >= L: x = base * (1 + 0.05 * min(M - L, 4))
    else:
        grey = L - math.floor(L / 10) - 5
        if M <= grey: return 0
        x = base * (1 - (L - M) / _zd(L))
    return x * (2 if elite else 1)


def grind_rate(L):
    return mob_xp(L, L) / T_GRIND


def _count(text, name, default):
    if not text or not name: return default
    best, bl = None, 0
    nm = name.lower()
    for m in re.finditer(r"(\d+)\s+([A-Za-z' -]+)", text):
        tail = m.group(2).lower()
        k = 0
        while k < min(len(tail), len(nm)) and tail[k] == nm[k]: k += 1
        if k > bl: best, bl = int(m.group(1)), k
    if best and bl >= 4 and best <= 40: return best
    if re.search(r"\b(a|an|the)\s+" + re.escape(nm[:6]), text.lower()): return 1
    return default


def work(q, L):
    """Arbeitszeit (Min.) und Mob-XP fuer die Ziele einer Quest auf Stufe L.
    Gegner, die mehrere Ziele zugleich liefern (toeten + Drops derselben Gegner), zaehlen nur einmal:
    je Gegnergruppe gilt das langsamste Ziel."""
    v = Q[str(q)]
    text = " ".join(v[7]) if isinstance(v[7], list) else (v[7] or "")
    ob = v[9] if len(v) > 9 else None
    t, why = 0.0, []
    need = {}                                           # Gegnergruppe -> (Kills, Stufe, Elite)

    def kill(key, kills, lv, el):
        k0 = need.get(key)
        if not k0 or kills > k0[0]: need[key] = (kills, lv, el)

    def lst(k): return [c for c in (ob[k] if ob and len(ob) > k and ob[k] else []) if isinstance(c, list) and c]
    for c in lst(0):                                    # Gegner toeten
        n = c[0]; nm = N.get(str(n), {}).get("name")
        cnt = _count(text, nm, 8); el = npc_rank(n) in (1, 2)
        kill(n, cnt, npc_level(n), el)
        if el: why.append("Elite")
    for c in lst(1):                                    # Objekte benutzen
        nm = O.get(str(c[0]), {}).get("name"); t += _count(text, nm, 4) * T_OBJ
    for c in lst(2):                                    # Gegenstaende sammeln
        it = c[0]; nm = I.get(str(it), {}).get("name"); cnt = _count(text, nm, 6)
        info = I.get(str(it)) or {}
        nd = set(info.get("nd") or []); src_obj = bool(info.get("od"))
        rates = {n: r for n, r in (DROPS.get(int(it)) or {}).items() if not nd or n in nd}
        if src_obj and (not rates or max(rates.values()) < 60):
            t += cnt * T_OBJ * 1.5                      # vom Boden/aus Objekten sammeln
        elif rates:
            p = max(rates.values()) / 100.0             # beste Quelle (man jagt die mit der hoechsten Rate)
            p = min(max(p, 0.03), 1.0)
            nb = max(rates, key=rates.get)
            kill(nb, cnt / p, npc_level(nb), npc_rank(nb) in (1, 2))
            if p < 0.35: why.append("Drop %d%%" % int(p * 100))
        elif nd:
            nb = sorted(nd)[0]; kill(nb, cnt * 1.5, npc_level(nb), False)
        else: t += cnt * T_OBJ
    for c in lst(4):                                    # Kill-Credit-Gruppen
        ids = c[0] if isinstance(c[0], list) else []
        cnt = _count(text, (N.get(str(ids[0]), {}) or {}).get("name") if ids else None, 8)
        if ids: kill(ids[0], cnt, npc_level(ids[0]), False)
    mxp = 0.0
    for kills, lv, el in need.values():
        t += kills * T_KILL * (3 if el else 1); mxp += kills * mob_xp(lv, L, el)
    if t == 0: t = 0.3
    return t, mxp, why


def yd(p, r):
    """Abstand zweier Punkte (area, x%, y%) in Yards (Luftlinie); None bei Zonenwechsel."""
    if not p or not r or p[0] != r[0]: return None
    w, h = zones.size(p[0]) or (5000.0, 3333.0)
    return math.hypot((p[1] - r[1]) * w / 100.0, (p[2] - r[2]) * h / 100.0)


T_SHIP = 10.0         # Minuten Kontinentwechsel (Zeppelin warten + fahren + Flug zum Ziel) - grob
FLY_OVER = 25.0       # Sekunden je Flug: Flugmeister ansprechen, abheben, landen
# Horde-Flugmeister (Era-Client TaxiNodes, MountCreatureID_0 > 0; Ids wie C_TaxiMap)
HORDE_FP = {1: {22, 23, 25, 29, 30, 38, 40, 42, 44, 48, 53, 55, 58, 61, 63, 69, 72, 77, 79, 80},
            0: {10, 11, 13, 17, 18, 20, 21, 56, 68, 70, 75, 76, 85, 86, 87}}
FP_START = {22, 23, 25, 77, 80}   # mit 22 sicher bekannt: Donnerfels, Orgrimmar, Wegekreuz, Camp Taurajo, Ratschet
_nm_ok = None


def _nm():
    global _nm_ok
    if _nm_ok is None:
        try:
            NM._load(); _nm_ok = True
        except Exception:
            _nm_ok = False
    return _nm_ok


def ground_yd(cont, A, B):
    """Laufweg in Yards zwischen Weltpunkten (B = stabiles Ende); ohne Wegenetz Luftlinie x PATH."""
    g = NM.ground_world(cont, A, B) if _nm() else None
    return g if g is not None else math.dist(A, B) * PATH


def flight_sec(cont, a, b, known):
    """Kuerzeste Flugzeit a -> b (Sekunden) ueber bekannte Flugmeister, gemessene Direktfluege, +5 s je Umstieg."""
    if a == b: return 0.0
    taxi, flights = NM.taxi(cont)
    adj = {}
    for x, y, t in flights:
        if x in known and y in known: adj.setdefault(x, []).append((y, t))
    D = {a: 0.0}; pq = [(0.0, a)]
    import heapq
    while pq:
        d, u = heapq.heappop(pq)
        if u == b: return d
        if d > D[u]: continue
        for v, t in adj.get(u, ()):
            nd = d + t + 5
            if nd < D.get(v, 1e18): D[v] = nd; heapq.heappush(pq, (nd, v))
    return None


def fly_min(cont, A, B, known):
    """Minuten fuer Laufen zum Flugmeister + Flug + Laufen zum Ziel (beste Kombination), None = kein Flug."""
    if not _nm(): return None
    taxi, _ = NM.taxi(cont)
    fps = [i for i in taxi if i in HORDE_FP.get(cont, ()) and (known is None or i in known)]
    if len(fps) < 2: return None
    sa = sorted(fps, key=lambda i: math.dist(taxi[i], A))[:3]
    sb = sorted(fps, key=lambda i: math.dist(taxi[i], B))[:3]
    best = None
    kn = set(fps)
    for i in sa:
        wi = ground_yd(cont, taxi[i], A)
        for j in sb:
            if i == j: continue
            air = flight_sec(cont, i, j, kn)
            if air is None: continue
            t = (wi + ground_yd(cont, taxi[j], B)) / SPEED + air + FLY_OVER
            if best is None or t < best: best = t
    return best / 60.0 if best is not None else None


def travel_min(p, r, known=None, fly=True):
    """Reisezeit in Minuten zwischen (area, x%, y%): echter Laufweg (Wegenetz), mit fly=True auch Fliegen
    ueber bekannte Flugmeister (known = Menge der Ids; None = alle Horde-Flugmeister)."""
    if not p or not r: return 0.0
    a, b = zones.world(*p), zones.world(*r)
    if not a or not b: return T_ZONE
    if a[0] != b[0]: return T_SHIP
    cont = a[0]
    walk = ground_yd(cont, a[1:], b[1:]) / SPEED / 60.0
    if not fly or walk < 2.0: return walk
    f = fly_min(cont, a[1:], b[1:], known)
    return min(walk, f) if f is not None else walk


def fp_near(p, r=150.0):
    """Horde-Flugmeister im Umkreis r (Yards) um (area, x%, y%) – beim Vorbeikommen gelernt."""
    if not _nm(): return set()
    w = zones.world(*p)
    if not w: return set()
    taxi, _ = NM.taxi(w[0])
    return {i for i, t in taxi.items() if i in HORDE_FP.get(w[0], ()) and math.dist(t, w[1:]) <= r}


def evaluate(steps, L0=22, xp0=0, verbose=True, known=None):
    """Spielt die Route durch: Stufe, XP, Zeit je Zonenblock. Reisen: Laufweg oder Flug ueber Flugmeister,
    die bis dahin bekannt sind (Start: FP_START, dazu jeder Flugmeister, an dem die Route vorbeikommt)."""
    known = set(FP_START if known is None else known)
    L, cur = L0, xp0
    blocks = []; pos = None; blk = None; seen_c = set(); per_q = {}
    for s in steps:
        key = (s["z"], s["seg"]) if "seg" in s else (s["z"], s["l"])
        if blk is None or blk["key"] != key:
            blk = dict(key=key, n=0, qxp=0, mxp=0, travel=0.0, work=0.0, talk=0.0, Lstart=L + cur / XP_LEVEL[L], quests=set(), trav_n=0)
            blocks.append(blk)
        p = s.get("_p")
        if p:
            if pos is not None:
                tm = travel_min(pos, p, known)
                blk["travel"] += tm
                if s.get("q"): per_q.setdefault(s["q"], dict(travel=0.0))["travel"] += tm
            pos = p
            known |= fp_near(p)
        q = s.get("q")
        if s["t"] == "grind":
            need = 0
            while L < s.get("to", 0):
                need += XP_LEVEL[L] - cur; cur = 0; L += 1
            blk["work"] += need / grind_rate(L); blk["mxp"] += need; blk["grind"] = blk.get("grind", 0) + need
        if s["t"] in ("fly", "go", "train", "hearth"): blk["trav_n"] += 1
        if not q: continue
        blk["n"] += 1; blk["quests"].add(q)
        pq = per_q.setdefault(q, dict(travel=0.0))
        if s["t"] in ("accept", "turnin"): blk["talk"] += T_TALK
        if s["t"] == "complete" and q not in seen_c:
            seen_c.add(q); w, m, why = work(q, L)
            blk["work"] += w; blk["mxp"] += m; pq.update(work=w, mxp=m, why=why)
            cur += m
        if s["t"] == "turnin":
            x, ql = quest_xp(q, L); blk["qxp"] += x; cur += x; pq.update(xp=x, ql=ql, L=L, z=s["z"])
        while L < max(XP_LEVEL) and cur >= XP_LEVEL[L]: cur -= XP_LEVEL[L]; L += 1
        blk["Lend"] = L + cur / XP_LEVEL[L]
    tot_t = tot_x = 0
    for b in blocks:
        t = b["travel"] + b["work"] + b["talk"]; x = b["qxp"] + b["mxp"]
        b["t"] = t; b["x"] = x; tot_t += t; tot_x += x
        if verbose:
            print("%-22s %2s  St.%5.2f->%5.2f  Quests %2d  Reise %5.1f  Arbeit %5.1f  XP %6d  XP/Min %4d"
                  % (b["key"][0][:22], b["key"][1], b["Lstart"], b.get("Lend", b["Lstart"]), len(b["quests"]),
                     b["travel"], b["work"], x, x / t if t else 0))
    if verbose:
        print("GESAMT: %.0f Min (%.1f h), %d XP, %d XP/Min, Endstufe %.2f" % (tot_t, tot_t / 60, tot_x, tot_x / tot_t, L + cur / XP_LEVEL[L]))
    return blocks, per_q, (L, cur, tot_t, tot_x)


if __name__ == "__main__":
    D = json.load(open(os.path.join(HERE, sys.argv[1] if len(sys.argv) > 1 else "gen_steps_horde_22_30.json")))
    steps, L0 = (D["steps"], D.get("L0", 22)) if isinstance(D, dict) else (D, 22)
    blocks, per_q, _ = evaluate(steps, L0)
    print("\n-- Quests nach XP/Min (Arbeit + anteilige Wege) --")
    rows = []
    for q, d in per_q.items():
        if "xp" not in d: continue
        t = d.get("work", 0.3) + d["travel"] + 2 * T_TALK
        rows.append(((d["xp"] + d.get("mxp", 0)) / t, q, d, t))
    for r, q, d, t in sorted(rows)[:30]:
        print("%5d XP/Min  %-34s ql%-2s @%d  XP %5d+%-5d  Zeit %5.1f (Weg %5.1f)  %s"
              % (r, Q[str(q)][0][:34], d["ql"], d["L"], d["xp"], d.get("mxp", 0), t, d["travel"], ",".join(d.get("why", []))))

# Routenplaner v2 (LevelPilot 4.1): Stufe mitrechnen, Quests nach Grenz-XP/Minute auswaehlen.
#  1. Abschnitte (Zone + Hub + Mindeststufe) kommen aus make_route.py (Speedrun-Konsens).
#  2. Quest-Pool: Kuratierte Liste + automatisch alle Horde-Quests der Zone aus Questies Forever-DB.
#  3. Je Abschnitt: gierig nach Naehe + Or-Opt, mit SIMULIERTER Stufe:
#     Quest nur, wenn Mindeststufe erreicht, Questlevel <= Stufe + 1 und Gegner <= Stufe + 1 (seit 5.1.5).
#  4. Grenzkosten-Filter: Quest(-Kette) fliegt raus, wenn ihr XP pro Minute (Quest-XP mit Stufenabzug
#     + Mob-XP) inkl. eingesparter Wege unter dem Grind-Tempo liegt. Danach neu bauen, bis stabil.
#  5. Fehlt vor einem Abschnitt Stufe: Grind-Schritt (zaehlt mit Grind-Tempo in die Zeit).
import os, sys, json, math, copy
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gen_route import Q, N, spawns, giver, finisher, objective_pts, trigger_pts, centroid, dist, best, pre_ok, valid, OBJ_AREA
HORDE_BITS = 2 | 16 | 32 | 128 | (1 << 33)   # Orc, Untoter, Tauren, Troll, Skyborne-Horde
def horde_ok(v):
    r = v[5]
    return (not r) or (r & HORDE_BITS) != 0
from qdb import load
import xpmodel as X

PLAN_ABOVE = 1        # Quest hoechstens 1 Stufe ueber der simulierten Stufe (Tiry 11.11.: +2/+3 war zu schwer)
PLAN_MOB = 1.0        # Gegner der Questziele hoechstens 1 Stufe ueber der simulierten Stufe (Mittel ihres Stufenbereichs)
GRIND_FACTOR = 0.85   # Quest darf knapp unter Ideal-Grinden liegen: stundenlanges Grinden ist real langsamer (volle Gebiete)
MAX_WORK = 35         # Minuten reine Questarbeit - noch laengere Quests sind getarntes Grinden (und nerven)
RAW_Q = load("Quest")


grind_rate = X.grind_rate


def grind_spot(areas, L, pos):
    """Bester Grind-Gegner: Stufe ~L, kein Elite, feindlich, viele Spawns, nah an pos."""
    best_, bs = None, -1
    for k, v in N.items():
        if v.get("fr"): continue
        sp = [(int(a), p[0], p[1]) for a, pts in (v.get("sp") or {}).items() if int(a) in areas for p in (pts or []) if isinstance(p, list) and p[0] is not None and p[0] >= 0]
        if len(sp) < 8: continue
        lv = X.npc_level(k)
        if lv is None or not (L - 1 <= lv <= L + 1.5) or X.npc_rank(k) in (1, 2, 3, 4): continue
        c = centroid(sp, set(areas))
        d = X.yd(pos, c) if pos else None
        sc = min(len(sp), 40) / (1.0 + (d if d is not None else 3000) / 600.0)
        if sc > bs: best_, bs = (int(k), v["name"], c, lv), sc
    return best_


def grind_step(L, to, prev, areas, pos, check=False):
    g = grind_spot(set(areas), max(L, to) if check else min(L + 1, to), pos)   # Gegner eher eine Stufe hoeher
    st = dict(l=L, z=prev["z"], t="grind", q=None, to=to, seg=prev["seg"], _p=g[2] if g else None)
    if check:   # Kontrollpunkt vor dem Zonenwechsel: nur offen, wenn du hinter dem Plan bist
        st["check"] = True; st["_p"] = None          # im Plan kein Umweg (nur noetig, wenn du hinterher bist)
        st.update(n="Stufe %d vor der Weiterreise" % to,
                  note=("Unter Stufe %d? Dann %s grinden – sonst bist du im nächsten Gebiet zu niedrig" % (to, g[1])) if g
                  else "Unter Stufe %d? Dann hier Gegner deiner Stufe grinden" % to)
        if g: st["gnpc"] = g[0]
    elif g:
        st.update(gnpc=g[0], n="Grinden: %s" % g[1], note="%s (Stufe %d) grinden bis Stufe %d" % (g[1], int(round(g[3])), to))
    else:
        st.update(n="Grinden bis Stufe %d" % to, note="Gegner deiner Stufe hier in der Nähe grinden bis Stufe %d" % to)
    return st


# ---------- Zwischenspeicher (Questie-Abfragen sind teuer) ----------
_G, _F, _C = {}, {}, {}
def c_giver(q):
    if q not in _G: _G[q] = giver(q)
    return _G[q]
def c_finisher(q):
    if q not in _F: _F[q] = finisher(q)
    return _F[q]
def c_centroid(q, areas):
    k = (q, areas)
    if k not in _C: _C[k] = centroid(objective_pts(q), set(areas))
    return _C[k]


# ---------- Ausschlussregeln (solo, Speedrun) ----------
def qflags(q):
    r = RAW_Q.get(int(q)) or []
    return r[22] if len(r) > 22 and isinstance(r[22], int) else 0


def start_sources(q):
    st = Q[str(q)][1] or []
    out = []
    for it in (st[2] if len(st) > 2 and st[2] else []):
        for n in (X.I.get(str(it)) or {}).get("nd") or []: out.append(n)
    return out


def bad_quest(q, curated=False):
    """Grund, warum die Quest solo nicht in eine Speedrun-Route gehoert (oder None)."""
    v = Q[str(q)]
    if qflags(q) & 2: return "Begleit-/Ereignisquest"
    src = start_sources(q)
    for n in src:
        if X.npc_rank(n) in (1, 2, 3, 4): return "startet mit Drop von Elite/Rare"
    if src and not curated and max(len(spawns("n", n)) for n in src) < 10: return "startet mit Drop eines Einzel-Gegners"
    w, _, why = X.work(q, max(int(v[4] or 20), 20))
    if w > MAX_WORK: return "dauert zu lange (%d Min.)" % w
    if any(x.startswith("Drop") and int(x[5:-1]) < 15 for x in why): return "Dropchance unter 15 %"
    if curated: return None
    ob = v[9] if len(v) > 9 else None
    for c in (ob[0] if ob and ob[0] else []):
        if isinstance(c, list) and c and X.npc_rank(c[0]) in (1, 2, 3): return "Elite-Ziel"
    for c in (ob[2] if ob and len(ob) > 2 and ob[2] else []):
        nd = (X.I.get(str(c[0])) or {}).get("nd") or []
        if nd and all(X.npc_rank(n) in (1, 2, 3) for n in nd): return "Gegenstand nur von Elite"
    return None


def start_level(q):
    lv = [X.npc_level(n) for n in start_sources(q)]
    lv = [x for x in lv if x is not None]
    return min(lv) if lv else 0


# ---------- automatischer Quest-Pool ----------
def auto_pool(areas, lo, hi, cls_ok=0, zones=None):
    out = []
    areas = set(areas)
    for k, v in Q.items():
        q = int(k)
        if int(q) not in X.XPDB: continue
        ql, rl = v[4] or 0, v[3] or 0
        if not (lo <= ql <= hi) or rl > hi: continue
        if not horde_ok(v): continue
        if v[6] and not (v[6] & cls_ok): continue                       # Klassenquest anderer Klassen
        raw = RAW_Q.get(q) or []
        if len(raw) > 23 and isinstance(raw[23], int) and raw[23] & 1: continue   # wiederholbar
        if len(raw) > 17 and raw[17]: continue                         # Berufsquest
        if len(raw) > 18 and raw[18]: continue                         # Rufvoraussetzung
        if zones is not None and v[16] not in zones: continue           # Dungeon-/Fremdzonen-Quests
        if bad_quest(q): continue
        g = c_giver(q)
        if not g: continue
        ok = False
        for p, who in g:
            if p[0] not in areas: continue
            if who[0] == "npc":
                fr = (N.get(str(who[1])) or {}).get("fr")
                if fr and "H" not in fr: continue
            ok = True; break
        if ok: out.append(q)
    return out


# ---------- Wege ----------
def path_min(st):
    tot = 0.0; pos = None
    for x in st:
        p = x.get("_p")
        if p is None: continue
        if pos is not None: tot += X.travel_min(pos, p, fly=False)
        pos = p
    return tot


def optimize(st, done0, route_set, acc0=(), comp0=()):
    """Or-Opt mit Delta-Rechnung (Bloecke 1-3 verschieben), nur gueltige Reihenfolgen."""
    if len(st) < 4: return st
    head = st[:1] if st[0].get("q") is None else []
    body = st[len(head):]
    n = len(body)
    # effektive Position je Schritt (ohne Punkt = Position davor)
    pos = []; last = head[0].get("_p") if head else None
    for s in body:
        if s.get("_p") is not None: last = s["_p"]
        pos.append(last)
    hp = head[0].get("_p") if head else None
    cache = {}
    def c(a, b):                       # a/b: Index in body, -1 = Kopf, None = Ende
        if b is None: return 0.0
        pa = hp if a == -1 else pos[a]
        pb = pos[b]
        if pa is None or pb is None: return 0.0
        k = (a, b)
        if k not in cache: cache[k] = X.travel_min(pa, pb, fly=False)
        return cache[k]
    order = list(range(n)); improved = True; rounds = 0
    while improved and rounds < 40:
        improved = False; rounds += 1
        for size in (1, 2, 3):
            i = 0
            while i + size <= len(order):
                blk = order[i:i + size]
                prev = order[i - 1] if i > 0 else -1
                nxt = order[i + size] if i + size < len(order) else None
                gain = c(prev, blk[0]) + c(blk[-1], nxt) - c(prev, nxt)
                if gain > 1e-6:
                    rest = order[:i] + order[i + size:]
                    bestj, bestd = None, gain - 1e-6
                    for j in range(len(rest) + 1):
                        if j == i: continue
                        a = rest[j - 1] if j > 0 else -1
                        b = rest[j] if j < len(rest) else None
                        add = c(a, blk[0]) + c(blk[-1], b) - c(a, b)
                        if add < bestd:
                            cand = rest[:j] + blk + rest[j:]
                            if valid([body[k] for k in cand], done0, route_set, acc0, comp0):
                                bestj, bestd = j, add
                    if bestj is not None:
                        order = rest[:bestj] + blk + rest[bestj:]; improved = True
                i += 1
    return head + [body[k] for k in order]


# ---------- Stufen-Simulation ----------
class Sim:
    def __init__(self, L, cur): self.L, self.cur = L, cur
    def add(self, x):
        self.cur += x
        while self.L < 60 and self.cur >= X.XP_LEVEL.get(self.L, 1e18):
            self.cur -= X.XP_LEVEL[self.L]; self.L += 1
    def grind_to(self, L):
        need = 0
        while self.L < L:
            need += X.XP_LEVEL[self.L] - self.cur; self.cur = 0; self.L += 1
        return need
    @property
    def lv(self): return self.L + self.cur / X.XP_LEVEL.get(self.L, 1e18)


def resim(steps, L0, xp0):
    """Stufe entlang der fertigen Schritte neu berechnen; setzt l je Schritt, liefert Werte je Quest."""
    S = Sim(L0, xp0); val = {}; seen = set()
    for s in steps:
        q = s.get("q")
        if s["t"] == "grind": S.grind_to(s["to"])
        s["l"] = S.L
        if not q: continue
        v = val.setdefault(q, dict(xp=0, mxp=0, work=0.0, L=S.L, why=[]))
        if s["t"] == "complete" and q not in seen:
            seen.add(q); w, m, why = X.work(q, S.L); v.update(work=w, mxp=m, why=why); S.add(m)
        if s["t"] == "turnin":
            x, _ = X.quest_xp(q, S.L); v["xp"] = x; v["L"] = S.L; S.add(x)
    return S, val


# ---------- Generator ----------
def last_pos(steps):
    for s in reversed(steps):
        if s.get("_p"): return s["_p"]
BAD = set()


def pre_ok_L(q, done, route_set, L0):
    """Vorquests erfuellt? Nicht in der Route = nur dann schon erledigt, wenn sie klar unter der Startstufe liegt
    (sonst haette man sie vor Routenbeginn gar nicht machen koennen -> Quest waere im Spiel nicht annehmbar)."""
    def ok(p):
        if p in done: return True
        if p in route_set: return False
        v = Q.get(str(p))
        return bool(v) and (v[4] or 0) < L0 - 1
    v = Q[str(q)]
    if any(not ok(p) for p in (v[11] or [])): return False
    sg = v[12] or []
    return not sg or any(ok(p) for p in sg)


def generate(segments, L0, xp0, extra_done=(), goal=None):
    route_set = set()
    for seg in segments: route_set |= set(seg["q"])
    for q in route_set:
        if bad_quest(q, curated=True): BAD.add(q)
    done = set(extra_done); accepted = set(); completed = set(); steps = []
    S = Sim(L0, xp0)
    for si, seg in enumerate(segments):
        areas = tuple(sorted(seg["areas"])); aset = set(areas); Z = seg["name"]
        if seg.get("minL") and S.L < seg["minL"] and steps:
            steps.append(grind_step(S.L, seg["minL"], steps[-1], segments[steps[-1]["seg"]]["areas"], last_pos(steps)))
            S.grind_to(seg["minL"])
        hubnpc = seg.get("hub"); pos = None
        seg_start = len(steps); done_before = set(done); acc_before = set(accepted); comp_before = set(completed)
        if hubnpc:
            hs = spawns("n", hubnpc[1]); pos = hs[0] if hs else None
            steps.append(dict(l=S.L, z=Z, t=seg.get("travel", "fly"), q=None, note=seg.get("tnote", hubnpc[0]), npc=hubnpc[0], _p=pos, seg=si))
        for _guard in range(600):
            cands = []
            for q in seg["q"]:
                if q in accepted or q in done: continue
                v = Q[str(q)]
                if v[15] and any(e in accepted or e in done for e in v[15]): continue   # schliessen sich aus
                if not pre_ok_L(q, done, route_set, L0): continue
                if (v[3] or 0) > S.L or (v[4] or 0) > S.L + PLAN_ABOVE: continue
                if q in BAD or start_level(q) > S.L + PLAN_ABOVE: continue
                ml = X.mob_level(q)
                if ml and ml > S.L + PLAN_MOB: continue          # Gegner zu stark fuer diese Stufe
                g = c_giver(q)
                if not g: continue
                if all(c[1][0] == "item" for c in g):
                    c = centroid([p for p, _ in g], aset)
                    if c and c[0] in aset: cands.append(("itemaccept", q, c))
                    continue
                p, who = best(g, pos, aset)
                nm = N.get(str(who[1]), {}).get("name") if who and who[0] == "npc" else None
                if p[0] in aset or nm in seg.get("near_npcs", []): cands.append(("accept", q, p))
            for q in list(accepted):
                if q in completed or q in done: continue
                if not Q[str(q)][9] and not trigger_pts(q): completed.add(q); continue
                c = c_centroid(q, areas)
                if c and c[0] in aset: cands.append(("complete", q, c))
                elif not c and OBJ_AREA.get(q) in aset: cands.append(("complete_np", q, pos))
            for q in list(accepted):
                if q in done or q not in completed: continue
                p, who = best(c_finisher(q), pos, aset)
                nm = N.get(str(who[1]), {}).get("name") if who and who[0] == "npc" else None
                if p and (p[0] in aset or nm in seg.get("near_npcs", [])): cands.append(("turnin", q, p))
            if not cands: break
            bonus = {"turnin": 0.85, "complete": 0.95, "complete_np": 0.0, "accept": 1.0, "itemaccept": 0.95}
            k = min(cands, key=lambda c: (dist(c[2], pos) if c[2] is not None else 0) * bonus[c[0]])
            kind, q, p = k; pos = p if p is not None else pos
            if kind == "accept":
                steps.append(dict(l=S.L, z=Z, t="accept", q=q, _p=p, seg=si)); accepted.add(q)
            elif kind == "itemaccept":
                steps.append(dict(l=S.L, z=Z, t="accept", q=q, note="Gegenstand looten und benutzen – startet die Quest", _p=p, seg=si)); accepted.add(q); completed.add(q)
            elif kind in ("complete", "complete_np"):
                st = dict(l=S.L, z=Z, t="complete", q=q, _p=p if kind == "complete" else None, seg=si)
                if kind == "complete_np": st["note"] = "Ziel laut Questtext"
                steps.append(st); completed.add(q); S.add(X.work(q, S.L)[1])
            else:
                steps.append(dict(l=S.L, z=Z, t="turnin", q=q, _p=p, seg=si)); done.add(q); S.add(X.quest_xp(q, S.L)[0])
        body = optimize(steps[seg_start:], done_before, route_set, acc_before, comp_before)
        if not any(x.get("q") for x in body): body = []          # nichts zu tun: Abschnitt (und Reise) entfaellt
        steps[seg_start:] = body
        if body and si < len(segments) - 1 and S.L > body[0]["l"] and not seg.get("nocheck"):
            steps.append(grind_step(S.L, S.L, steps[-1], areas, last_pos(steps), check=True))
        seg["left"] = [q for q in seg["q"] if q not in done]
    if goal and S.L < goal and steps:
        steps.append(grind_step(S.L, goal, steps[-1], segments[steps[-1]["seg"]]["areas"], last_pos(steps)))
        S.grind_to(goal)
    # angenommen, aber nie abgegeben -> raus (bringt nichts, belegt das Log)
    tin = set(s["q"] for s in steps if s["t"] == "turnin")
    steps = [s for s in steps if not s.get("q") or s["q"] in tin]
    return steps, done


# ---------- Grenzkosten ----------
def depends(route_set):
    dep = {}
    for k in route_set:
        v = Q[str(k)]
        for p in (v[11] or []):
            if p in route_set: dep.setdefault(p, set()).add(k)
        alts = [p for p in (v[12] or []) if p in route_set]
        if len(alts) == 1: dep.setdefault(alts[0], set()).add(k)
    return dep


def group_of(q, dep):
    g = {q}; todo = [q]
    while todo:
        c = todo.pop()
        for k in dep.get(c, ()):
            if k not in g: g.add(k); todo.append(k)
    return g


CLUSTER_YD = 650


def cluster_groups(steps, dep):
    """Orte (Radius ~650 yd) je Abschnitt; Gruppe = alle Quests mit einem Schritt dort + Folgequests.
    Der Ort des Hubs (Flugmeister) wird nie als Ganzes gestrichen."""
    out = []
    for si in sorted(set(s.get("seg") for s in steps if s.get("seg") is not None)):
        blk = [s for s in steps if s.get("seg") == si and s.get("_p")]
        hub = next((s["_p"] for s in blk if not s.get("q")), None)
        centers = []
        for s in blk:
            p = s["_p"]
            for c in centers:
                d = X.yd(c[0], p)
                if d is not None and d < CLUSTER_YD: c[1].append(s); break
            else: centers.append((p, [s]))
        for c, members in centers:
            if hub and X.yd(c, hub) is not None and X.yd(c, hub) < CLUSTER_YD: continue
            qs = set(m["q"] for m in members if m.get("q"))
            if len(qs) < 2: continue
            G = set()
            for q in qs: G |= group_of(q, dep)
            out.append(G)
    return out


def removal_saving(steps, G):
    save = 0.0
    for si in sorted(set(s["seg"] for s in steps if s.get("q") in G)):
        blk = [s for s in steps if s.get("seg") == si]
        save += path_min(blk) - path_min([s for s in blk if s.get("q") not in G])
    return save


def plan(SEG, L0=22, xp0=0, protect=(), log=print, max_iter=80, goal=None):
    base = copy.deepcopy(SEG); removed = set(); why_removed = {}
    for it in range(max_iter):
        segs = copy.deepcopy(base)
        for s in segs: s["q"] = [q for q in s["q"] if q not in removed]
        steps, done = generate(segs, L0, xp0, goal=goal)
        S, val = resim(steps, L0, xp0)
        route_set = set(s["q"] for s in steps if s.get("q"))
        # Gegner nach der echten Stufen-Nachrechnung zu stark? -> raus (Auswahl und Nachrechnung koennen abweichen)
        hard = [s["q"] for s in steps if s["t"] == "accept" and s.get("q") and s["q"] not in protect
                and (X.mob_level(s["q"]) or 0) > s["l"] + PLAN_MOB]
        if hard:
            for q in hard:
                removed.add(q); why_removed[q] = (Q[str(q)][0], "Gegner %.1f > Stufe %d+1" % (X.mob_level(q), next(x["l"] for x in steps if x.get("q") == q)), 0, 0)
            log("Runde %d: zu starke Gegner raus: %s" % (it + 1, ", ".join(Q[str(q)][0] for q in hard)))
            continue
        dep = depends(route_set)
        worst = []
        for q in route_set:
            if q in protect: continue
            G = group_of(q, dep)
            if G & set(protect): continue
            gain = sum(val.get(k, {}).get("xp", 0) + val.get(k, {}).get("mxp", 0) for k in G)
            work = sum(val.get(k, {}).get("work", 0) for k in G)
            talk = sum(1 for s in steps if s.get("q") in G and s["t"] in ("accept", "turnin")) * X.T_TALK
            t = work + talk + removal_saving(steps, G)
            Lq = val.get(q, {}).get("L", L0)
            r = gain / max(t, 0.5)
            th = grind_rate(Lq) * GRIND_FACTOR
            if r < th: worst.append((r / th, q, G, gain, t))
        # Abstecher: alle Quests eines entlegenen Ortes zusammen pruefen (z. B. Zoram'gar, Ratchet)
        for G in cluster_groups(steps, dep):
            if G & set(protect): continue
            gain = sum(val.get(k, {}).get("xp", 0) + val.get(k, {}).get("mxp", 0) for k in G)
            work = sum(val.get(k, {}).get("work", 0) for k in G)
            talk = sum(1 for s in steps if s.get("q") in G and s["t"] in ("accept", "turnin")) * X.T_TALK
            t = work + talk + removal_saving(steps, G)
            Lq = min(val.get(k, {}).get("L", L0) for k in G)
            r = gain / max(t, 0.5); th = grind_rate(Lq) * GRIND_FACTOR
            if r < th: worst.append((r / th, sorted(G)[0], G, gain, t))
        if not worst: break
        worst.sort(key=lambda w: w[0])
        batch = [w for w in worst if w[0] < 0.5] or worst[:1]
        for rr, q, G, gain, t in batch:
            for k in G:
                if k not in removed:
                    removed.add(k); why_removed[k] = (Q[str(q)][0], round(rr, 2), int(gain), round(t, 1))
        log("Runde %d: raus %s" % (it + 1, ", ".join("%s%s (%.0f%%)" % (Q[str(w[1])][0], " +%d" % (len(w[2]) - 1) if len(w[2]) > 1 else "", w[0] * 100) for w in batch[:6])
                                     + (" +%d" % (len(batch) - 6) if len(batch) > 6 else "")))
    return steps, S, val, removed, why_removed, segs

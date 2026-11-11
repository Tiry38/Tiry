"""Quest-Pool fuer LevelPilot (Tiry 11.11.: "immer ganz genau auf mein Level angepasst").

Der feste Plan hat Luecken: liegt man hinter dem Plan oder hat die Route an der eigenen Stufe nichts
Machbares mehr, blieb nur Grinden – obwohl es woanders passende Quests gibt. Der Pool enthaelt ALLE
Solo-Quests der Horde (Stufe 10–45) aus Questies Forever-Datenbank, die LevelPilot live einsetzen darf:
- keine Elite-/Begleit-/Ereignis-/Dungeon-/Klassen-/Berufs-/Ruf-/Wiederholungsquests,
- Questgeber NPC oder Objekt (kein Start per Beute), Geber/Abgabe/Ziele in offenen Gebieten,
- alle Gegner der Ziele mit bekannter Stufe (sonst unbekannt stark -> raus).
Je Quest: ql, rl, ml (Gegnerstufe), xp (Quest + Gegner auf Questlevel), wm (Arbeitsminuten), pre/pres.
LevelPilot waehlt daraus live nur, was zu deiner Stufe passt (Quest/Gegner hoechstens Stufe +1) und mehr
XP pro Minute bringt als Grinden – Weg (zu Fuss oder Flug) eingerechnet.

Aufruf (im Ordner tools/): python3 -I pool.py   -> ../addons/LevelPilot/Routes/Pool_Horde.lua
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
os.chdir(HERE)
import plan as P
import xpmodel as X
import zones
from build import lstr

OUT = os.path.join(HERE, "..", "addons", "LevelPilot", "Routes", "Pool_Horde.lua")
LO, HI = 10, 45
SUBZONE_OK = set()   # Unterzonen offener Gebiete, falls noetig (bisher keine)
OPEN = {v[0] for k, v in zones.ZONES.items() if v[1] in (0, 1)}      # offene Gebiete (keine Instanzen/Schlachtfelder)


def kill_levels_known(q):
    v = P.Q[str(q)]
    ob = v[9] if len(v) > 9 else None
    for c in (ob[0] if ob and ob[0] else []):
        if isinstance(c, list) and c and X.npc_level(c[0]) is None: return False
    return True


def items_known(q):
    """Jeder zu sammelnde Gegenstand braucht einen bekannten Fundort (sonst weiss der Pfeil nicht wohin)."""
    v = P.Q[str(q)]
    ob = v[9] if len(v) > 9 else None
    for c in (ob[2] if ob and len(ob) > 2 and ob[2] else []):
        if not (isinstance(c, list) and c): continue
        it = X.I.get(str(c[0])) or {}
        if not (it.get("nd") or it.get("od") or X.DROPS.get(int(c[0]))): return False
    return True


def pt(p):
    """(areaId, x%, y%) -> (uiMap, x 0..1, y 0..1, Kontinent, WeltX, WeltY) fuer den Live-Modus (Gebiets-Wahl ohne Questie)."""
    if not p: return None
    a, x, y = p[0], p[1], p[2]
    m = zones.AREA2MAP.get(int(a))
    w = zones.world(a, x, y)
    if not m or not w: return None
    return (m, round(x / 100.0, 4), round(y / 100.0, 4), w[0], round(w[1], 1), round(w[2], 1))


def dense(pts):
    """Repraesentativer Zielpunkt: der Spawnpunkt mit den meisten Nachbarn im Umkreis von 250 Yards."""
    W = [(p, zones.world(*p)) for p in pts]
    W = [(p, w) for p, w in W if w]
    if not W: return None
    best, bn = None, -1
    for p, w in W:
        n = sum(1 for _, v in W if v[0] == w[0] and (v[1] - w[1]) ** 2 + (v[2] - w[2]) ** 2 <= 250 ** 2)
        if n > bn: best, bn = p, n
    return pt(best)


def easy_pts(q):
    """Zielpunkte nur der Gegner, mit denen gerechnet wird (Tiry 11.11.: Blut droppen 4 Loewensorten,
    der Pfeil fuehrte in die Mischung und Tiry landete bei Stufe-32-Loewen). Objekte/Boden-Gegenstaende bleiben."""
    import gen_route as G
    X.work(q, 30)
    sel = X.MOBSEL.get(int(q)) or set()
    v = P.Q[str(q)]; ob = v[9] if len(v) > 9 else None
    if not sel or not ob: return P.objective_pts(q)
    def lst(k): return ob[k] if len(ob) > k and ob[k] else []
    out = list(G.trigger_pts(q))
    for n in sel: out += G.spawns("n", n)
    for c in lst(1):
        if isinstance(c, list) and c: out += G.spawns("o", c[0])
    for c in lst(2):
        if isinstance(c, list) and c and not (X.I.get(str(c[0])) or {}).get("nd"): out += G.item_src(c[0])
    return out or P.objective_pts(q)


def pick():
    out, why = [], {}
    def no(r): why[r] = why.get(r, 0) + 1
    for k, v in P.Q.items():
        q = int(k)
        if q not in X.XPDB: no("keine XP-Daten"); continue
        ql, rl = v[4] or 0, v[3] or 0
        if not (LO <= ql <= HI): continue
        if not P.horde_ok(v): continue
        if v[6]: no("Klassenquest"); continue
        if (v[16] or 0) <= 0: no("Sonderkategorie"); continue
        if v[16] not in OPEN and v[16] not in SUBZONE_OK: no("Dungeon-/Instanzquest"); continue
        raw = P.RAW_Q.get(q) or []
        if len(raw) > 23 and isinstance(raw[23], int) and raw[23] & 1: no("wiederholbar"); continue
        if len(raw) > 17 and raw[17]: no("Beruf"); continue
        if len(raw) > 18 and raw[18]: no("Ruf"); continue
        st = v[1] or []
        if len(st) > 2 and st[2]: no("Start per Gegenstand"); continue
        b = P.bad_quest(q)
        if b: no(b.split(" (")[0]); continue
        g = [(p, w) for p, w in P.c_giver(q) if p[0] in OPEN]
        ok = False
        for p, who in g:
            if who[0] == "npc":
                fr = (P.N.get(str(who[1])) or {}).get("fr")
                if fr and "H" not in fr: continue
            ok = True; break
        if not ok: no("kein Horde-Geber im Freien"); continue
        f = [p for p, _ in P.c_finisher(q) if p[0] in OPEN]
        if not f: no("Abgabe nicht im Freien"); continue
        pts = P.objective_pts(q)
        if pts and not any(a in OPEN for a, _, _ in pts): no("Ziele in Instanz"); continue
        if not kill_levels_known(q): no("Gegnerstufe unbekannt"); continue
        if not items_known(q): no("Gegenstand ohne Fundort"); continue
        L = max(ql, rl, 1)
        qx = X.quest_xp(q, L)[0] or 0
        wt, mxp, w2 = X.work(q, L)
        if "Elite" in w2: no("Elite"); continue
        xp = int(round((qx + mxp) / 50.0) * 50)
        if xp < 200: no("unter 200 XP"); continue
        mx = X.MOBMAX.get(int(q)); ml = X.mob_level(q)
        ez = [p for p in easy_pts(q) if p[0] in OPEN]
        out.append(dict(q=q, n=v[0], ql=ql, rl=rl, ml=ml, mx=mx if (mx and ml and mx > ml + 2) else None, xp=xp, wm=round(wt, 1),
                        pre=v[11] or None, pres=v[12] or None,
                        a=pt(g[0][0]), c=dense(ez or [p for p in pts if p[0] in OPEN]) if pts else None, t=pt(f[0])))
    return out, why


def write(pool):
    L = ["-- AUTOMATISCH ERZEUGT (tools/pool.py) · Quest-Pool aus Questies Forever-Datenbank (GPL-3.0, siehe LIZENZ.txt)",
         "-- Nur Solo-Quests im Freien; LevelPilot setzt sie live ein, wenn die Route an deiner Stufe nichts Besseres hat.",
         "LevelPilot_Pool = LevelPilot_Pool or {}",
         "LevelPilot_Pool.Horde = {"]
    for e in sorted(pool, key=lambda e: (e["ql"], e["q"])):
        f = ["q = %d" % e["q"], "n = %s" % lstr(e["n"]), "ql = %d" % e["ql"], "rl = %d" % e["rl"],
             "xp = %d" % e["xp"], "wm = %g" % e["wm"]]
        if e["ml"]: f.append("ml = %g" % round(e["ml"], 1))
        if e.get("mx"): f.append("mx = %g" % round(e["mx"], 1))
        if e["pre"]: f.append("pre = {%s}" % ", ".join(str(a) for a in e["pre"]))
        if e["pres"]: f.append("pres = {%s}" % ", ".join(str(a) for a in e["pres"]))
        for k in ("a", "c", "t"):
            if e.get(k): f.append("%s = {%s}" % (k, ", ".join("%g" % v for v in e[k])))
        L.append("  { " + ", ".join(f) + " },")
    L.append("}")
    open(OUT, "w").write("\n".join(L) + "\n")


if __name__ == "__main__":
    pool, why = pick()
    write(pool)
    print("Pool: %d Quests -> %s" % (len(pool), os.path.relpath(OUT, HERE)))
    for r, n in sorted(why.items(), key=lambda x: -x[1]): print("  raus: %-28s %d" % (r, n))
    for L in (27, 28, 29):
        ok = [e for e in pool if e["rl"] <= L and e["ql"] <= L + 1 and (e["ml"] or 0) <= L + 1 and e["ql"] >= L - 5]
        print("  Stufe %d: %d passende Quests im Pool" % (L, len(ok)))

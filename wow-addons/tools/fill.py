"""Aufhol-Quests (Lueckenfueller) in die erzeugten Routen-Schritte einsetzen.

Problem (Tiry, 11.11.): Der Planer streicht Quests, deren XP/Minute unter dem Modell-Grindtempo liegt
(~300 XP/Min bei Stufe 27). Spielt man langsamer oder hat Quests ausgelassen, liegt man hinter dem Plan
und steht am Abschnittsende vor Quests mit Mindeststufe ueber der eigenen -> "WARTET · grinden".
Loesung: je Abschnitt ein fester Block Quests, die schon mit niedrigerer Stufe gehen. Jeder Schritt traegt
fill = <Stufe>: Bist du schon so weit (Stufe >= fill), ueberspringt LevelPilot den Block (wie bisher);
bist du dahinter, kommen diese Quests statt Grinden. Steht eine davon schon im Questlog, bleibt sie.

Aufruf: python3 -I fill.py [key ...]  (danach build.py). make_route.py ruft es nach dem Schreiben selbst auf.
Idempotent: vorhandene fill-Schritte werden vorher entfernt.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))

# key -> Liste von Bloecken: { seg (0-basiert wie gen_steps), fill (Stufe), z, steps [(t, q, note)] }
# Reihenfolge von Hand nach Weg: Schimmernde Ebene -> Freiwindposten -> Wolkengipfel -> Weissreichposten -> Freiwind.
FILL = {
    "horde_22_30": [dict(seg=6, fill=28, z="Tausend Nadeln", steps=[
        ("accept", 5064, None),       # Grimtotem Spying – Freiwindposten
        ("complete", 5064, None),     # Notizen im Grimmtotem-Lager
        ("accept", 4904, "Begleitquest – Lakota zum Freiwindposten bringen"),
        ("complete", 4904, "Begleitquest – Lakota zum Freiwindposten bringen"),
        ("accept", 5151, None),       # Hypercapacitor Gizmo – Weissreichposten
        ("accept", 4966, "Verteidigungs-Ereignis"),
        ("complete", 4966, "Verteidigungs-Ereignis"),
        ("complete", 5151, None),
        ("turnin", 5151, None),
        ("turnin", 4966, None),
        ("accept", 4770, "Begleitquest"),
        ("complete", 4770, "Begleitquest"),
        ("turnin", 4770, None),
        ("turnin", 5064, None),
        ("turnin", 4904, None),
        # Reichen die Quests nicht (Tiry 11.11.: 27 mit 69 %, nichts mehr offen): Grinden bis 28 direkt am
        # Freiwindposten – Needles Cougar (27-28, 41 Spawns), dazwischen Pesterhide Snarler (28-29), ohne Elite
        ("grind", 4124, "Needles Cougar (Stufe 27–28) + Pesterhide Snarler westlich vom Freiwindposten"),
    ]),
    # 28 -> 30: statt "Grinden bis 30" erst die Schimmernde-Ebene-Quests (Mobs dort zaehlen ohnehin)
    dict(seg=6, fill=30, z="Tausend Nadeln", steps=[
        # nur Rocket Car Parts (Teile aufsammeln, keine Gegner). Raus seit 5.1.5: A Bump in the Road (Questlevel 33),
        # Load Lightening (Gegner Stufe 31) – zu schwer fuer Stufe 28-29 (Tiry 11.11.)
        ("accept", 1110, None), ("complete", 1110, None), ("turnin", 1110, None),
    ])],
}


def pos(t, q, z_area):
    import plan
    if t == "accept": g = plan.c_giver(q)
    elif t == "turnin": g = plan.c_finisher(q)
    else:
        c = plan.c_centroid(q, (z_area,))
        if c: return list(c)
        g = plan.c_giver(q)                # Begleit-/Ereignisquest: startet beim Geber
    return list(g[0][0]) if g else None


def apply(key):
    path = os.path.join(HERE, "gen_steps_%s.json" % key)
    d = json.load(open(path))
    steps = [s for s in d["steps"] if not s.get("fill")]
    for blk in FILL.get(key, []):
        seg = blk["seg"]
        idx = [i for i, s in enumerate(steps) if s.get("seg") == seg]
        if not idx: raise SystemExit("Abschnitt %d fehlt in %s" % (seg, key))
        last = idx[-1]
        at = last if steps[last]["t"] == "grind" else last + 1   # vor den Schluss-Grind des Abschnitts
        area = steps[idx[0]].get("_p", [None])[0]
        main_q = set(s.get("q") for s in steps if s.get("q"))   # schon im Hauptplan -> nicht doppelt
        new = []
        for t, q, note in blk["steps"]:
            if t != "grind" and q in main_q: continue
            if t == "grind":   # q = Gegner-ID; Ziel = Mitte seiner Spawns im Gebiet
                import xpmodel as XM
                NN = XM.D["N"]
                sp = (NN.get(str(q), {}).get("sp") or {}).get(str(area)) or []
                c = [area, sum(p[0] for p in sp) / len(sp), sum(p[1] for p in sp) / len(sp)] if sp else None
                nm = NN.get(str(q), {}).get("name", "Gegner")
                new.append(dict(l=blk["fill"] - 1, z=blk["z"], t="grind", q=None, to=blk["fill"], seg=seg, fill=blk["fill"],
                                _p=c, gnpc=q, n="Grinden: " + nm, note=note))
                continue
            s = dict(l=blk["fill"] - 1, z=blk["z"], t=t, q=q, seg=seg, fill=blk["fill"], _p=pos(t, q, area))
            if note: s["note"] = note
            new.append(s)
        steps[at:at] = new
    # XP je Annehmen-Schritt der Abschnitte mit Aufhol-Block (Quest-XP + Mob-XP der Ziele, Forever-Daten):
    # LevelPilot nimmt nur so viele Aufhol-Quests, wie dir XP bis zur Stufe fehlen.
    import xpmodel as X
    # Seit 5.1.4 fuer ALLE Annehmen-Schritte: xp, wm (Arbeitsminuten am Questziel), hard (Elite) -> "Neu berechnen"
    for s in steps:
        if s.get("t") == "accept" and s.get("q"):
            L = int(s.get("l") or 27)
            qx = X.quest_xp(s["q"], L)[0] or 0
            wt, mxp, why = X.work(s["q"], L)
            s["xp"] = int(round((qx + mxp) / 50.0) * 50)
            s["wm"] = round(wt, 1)
            ml = X.mob_level(s["q"])
            if ml: s["ml"] = round(ml, 1)
            else: s.pop("ml", None)
            if "Elite" in why: s["hard"] = 1
            else: s.pop("hard", None)
    d["steps"] = steps
    json.dump(d, open(path, "w"))
    return len(steps)


if __name__ == "__main__":
    sys.path.insert(0, HERE)
    for k in sys.argv[1:] or list(FILL):
        print(k, apply(k), "Schritte")

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
        new = []
        for t, q, note in blk["steps"]:
            s = dict(l=blk["fill"] - 1, z=blk["z"], t=t, q=q, seg=seg, fill=blk["fill"], _p=pos(t, q, area))
            if note: s["note"] = note
            new.append(s)
        steps[at:at] = new
    d["steps"] = steps
    json.dump(d, open(path, "w"))
    return len(steps)


if __name__ == "__main__":
    sys.path.insert(0, HERE)
    for k in sys.argv[1:] or list(FILL):
        print(k, apply(k), "Schritte")

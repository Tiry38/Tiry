"""Route-Schritte (gen_steps_<key>.json aus make_route.py) gegen die Forever-DB pruefen und als Lua schreiben.

Aufruf (im Ordner tools/):  python3 -I build.py [key ...]     ohne key: alle gen_steps_*.json
Muss "0 Probleme" melden. Ausgabe: <Datei>.lua hier + Kopie nach ../addons/LevelPilot/Routes/.
"""
import glob, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
os.chdir(HERE)
from verify import Q, N, horde_ok

NOTES = {6482: "optional – Begleitquest, einmal versuchen", 4770: "optional – Begleitquest", 6544: "Begleitquest",
         6641: "Ereignis am Strand", 4904: "Begleitquest", 4966: "Verteidigungs-Ereignis", 5147: "optional – starker Gegner",
         1149: "Von der Planke springen", 23: "Ursangous töten, Pfote benutzen", 24: "Shadumbra töten, Kopf benutzen",
         2: "Scharfklaue töten, Klaue benutzen", 1195: "Phiole am Mondbrunnen im Eschental füllen",
         1535: "Schlauch am Teich unter Brines Hütte füllen", 1536: "Roter Schlauch – Brunnen in Tarrens Mühle"}
ROUTES_DIR = os.path.join(HERE, "..", "addons", "LevelPilot", "Routes")

names = {}
for k, v in N.items():
    names.setdefault(v[0], []).append(int(k))


def npc_id(name):
    """NPC-Name -> ID (zur Horde freundliche zuerst)."""
    return sorted(names.get(name) or [], key=lambda k: 0 if N[str(k)][1] else 1)


succ = {}
for k, v in Q.items():
    for p_ in (v[11] or []) + (v[12] or []):
        succ.setdefault(p_, set()).add(int(k))


def successors(q):
    seen = set(); todo = [q]
    while todo:
        c = todo.pop()
        for n in succ.get(c, ()):
            if n not in seen: seen.add(n); todo.append(n)
    return sorted(seen)


def lstr(x):
    return '"' + str(x).replace('\\', '\\\\').replace('"', '\\"') + '"'


def check_steps(R):
    problems, hints, out = [], [], []
    in_route = set(x.get("q") for x in R if x.get("q"))
    accepted, done = set(), set()
    for i, s in enumerate(R, 1):
        s = dict(s)
        q = s.get("q")
        if s["t"] == "grind":
            # Stufen-Kontrolle direkt vor einem Pflicht-Grind ist doppelt
            nxt = R[i] if i < len(R) else None
            if s.get("check") and nxt and nxt["t"] == "grind": continue
            if not isinstance(s.get("to"), int): problems.append(f"#{i} Grind ohne Zielstufe")
            g = s.get("gnpc")
            if g and str(g) not in N: problems.append(f"#{i} Grind-NPC {g} nicht in Forever-DB")
            out.append(s); continue
        if q:
            v = Q.get(str(q))
            if not v: problems.append(f"#{i} {s['t']} {q}: FEHLT in Forever-DB"); continue
            if not horde_ok(v): problems.append(f"#{i} {q} {v[0]}: nicht Horde"); continue
            s["n"] = v[0]; s["ql"] = v[4]; s["rl"] = v[3]
            if v[6]: s["cls"] = v[6]
            if v[11]: s["pre"] = v[11]
            if v[12]: s["pres"] = v[12]
            if q == 1528: s["alt"] = [2985, 1529, 2986]
            nx = successors(q)
            for a in s.get("alt") or []: nx += successors(a)
            if nx: s["nxt"] = sorted(set(nx))[:40]
            if q in NOTES and not s.get("note"): s["note"] = NOTES[q]
            if s["t"] == "accept":
                # Vorquest gar nicht in der Route = vor Routenbeginn erledigt (sonst ueberspringt die Engine) -> Hinweis
                miss = [p for p in (v[11] or []) if p not in done]
                if [p for p in miss if p in in_route]: problems.append(f"#{i} {q} {v[0]} (accept): Vorquests fehlen vorher {miss}")
                elif miss: hints.append(f"#{i} {q} {v[0]}: Vorquest {miss} vor Routenbeginn")
                sg = v[12] or []
                if sg and not any(p in done for p in sg):
                    if any(p in in_route for p in sg): problems.append(f"#{i} {q} {v[0]} (accept): eine von {sg} nötig")
                    else: hints.append(f"#{i} {q} {v[0]}: eine von {sg} vor Routenbeginn")
                if v[3] and v[3] > s["l"] + 1: problems.append(f"#{i} {q} {v[0]}: Mindeststufe {v[3]} > Abschnitt {s['l']}")
                accepted.add(q)
            else:
                if q not in accepted: problems.append(f"#{i} {q} {v[0]} ({s['t']}): nicht vorher angenommen")
                if s["t"] == "turnin": done.add(q)
        if s.get("npc"):
            ids = npc_id(s["npc"])
            if not ids: problems.append(f"#{i} NPC '{s['npc']}' nicht gefunden")
            else: s["npcid"] = ids[0]
        out.append(s)
    return out, problems, hints


def lua_step(s):
    f = [f't = "{s["t"]}"', f'l = {s["l"]}', f'z = {lstr(s["z"])}']
    if s.get("seg") is not None: f.append(f'seg = {int(s["seg"]) + 1}')
    if s["t"] == "grind":
        f.append(f'to = {s["to"]}')
        if s.get("gnpc"): f.append(f'npc = {s["gnpc"]}')
        if s.get("n"): f.append(f'n = {lstr(s["n"])}')
        if s.get("note"): f.append(f'note = {lstr(s["note"])}')
        if s.get("check"): f.append('check = true')
        return '  { ' + ', '.join(f) + ' },'
    if s.get("q"): f.append(f'q = {s["q"]}')
    if s.get("n"): f.append(f'n = {lstr(s["n"])}')
    if s.get("npcid"): f.append(f'npc = {s["npcid"]}')
    if not s.get("q"):
        if s["t"] == "train": f.append(f'to = {lstr("Klassenlehrer " + (s.get("npc") or ""))}')
        elif s["t"] in ("fly", "go", "hearth"): f.append(f'to = {lstr(s.get("note") or s.get("npc") or "")}')
        if s.get("npc") and s["t"] != "train": f.append(f'note = {lstr("NPC: " + s["npc"])}')
        elif s.get("note") and s["t"] == "train": f.append(f'note = {lstr(s["note"])}')
    elif s.get("note"): f.append(f'note = {lstr(s["note"])}')
    if s.get("pre") and s["t"] == "accept": f.append('pre = {' + ', '.join(str(a) for a in s["pre"]) + '}')
    if s.get("pres") and s["t"] == "accept": f.append('pres = {' + ', '.join(str(a) for a in s["pres"]) + '}')
    if s.get("cls"): f.append(f'cls = {s["cls"]}')
    if s.get("alt"): f.append('alt = {' + ', '.join(str(a) for a in s["alt"]) + '}')
    if s.get("rl"): f.append(f'rl = {s["rl"]}')
    if s.get("ql"): f.append(f'ql = {s["ql"]}')
    if s.get("nxt"): f.append('nxt = {' + ', '.join(str(a) for a in s["nxt"]) + '}')
    if s["t"] == "train": f.append('cls = 64')
    return '  { ' + ', '.join(f) + ' },'


def hub_name(s):
    """Ort eines Reise-Schritts: 'Splitterholzposten – Ruhestein hier setzen' -> 'Splitterholzposten'."""
    t = s.get("note") if s["t"] != "train" else None
    t = t or s.get("to") or ""
    for sep in (" – ", ": ", " - "):
        t = t.split(sep)[0]
    return t.strip()


def segments(out):
    """Abschnitte der Route (Gebietsblöcke des Planers): Gebiet, Ort (erster Reise-Schritt), Stufen."""
    segs = {}
    for s in out:
        k = s.get("seg")
        if k is None: continue
        g = segs.setdefault(k, {"z": s["z"], "hub": "", "l0": s["l"], "l1": s["l"], "n": 0})
        g["l1"] = max(g["l1"], s["l"]); g["n"] += 1
        if not g["hub"] and s["t"] in ("fly", "go", "hearth") and not s.get("q"):
            g["hub"] = hub_name(s)
    return [segs[k] for k in sorted(segs)]


def model_xpm(D):
    """Modell-Tempo der Route (XP pro Minute, ohne ausgeruhte XP) – Maßstab für 'lohnt der Umweg?'."""
    try:
        import xpmodel
        _, _, (_, _, tot_t, tot_x) = xpmodel.evaluate(D["steps"], D.get("L0", 22), verbose=False)
        return int(round(tot_x / tot_t)) if tot_t > 0 else None
    except Exception as e:  # Modell fehlt (z. B. ohne QuestieDB) -> Add-on misst selbst
        print("   (kein Modell-Tempo:", e, ")")
        return None


def build(path):
    D = json.load(open(path))
    out, problems, hints = check_steps(D["steps"])
    print("%s: %d Schritte, %d Probleme, %d Hinweise" % (D["key"], len(out), len(problems), len(hints)))
    for p in problems: print("  ", p)
    for h in hints: print("   Hinweis:", h)
    segs = segments(out)
    xpm = model_xpm(D)
    L = ['-- AUTOMATISCH ERZEUGT (LevelPilot Routen-Werkzeug: make_route.py + build.py) · geprüft gegen Questies Forever-Datenbank',
         'LevelPilot_Routes = LevelPilot_Routes or {}',
         'LevelPilot_Routes[%s] = { name = %s, faction = "Horde", min = %d, max = %d,%s'
         % (lstr(D["key"]), lstr(D["name"]), D["min"], D["max"], (" xpm = %d," % xpm) if xpm else ""),
         '  segs = {' + ', '.join('{ z = %s, hub = %s, l0 = %d, l1 = %d }' % (lstr(g["z"]), lstr(g["hub"] or g["z"]), g["l0"], g["l1"]) for g in segs) + ' },',
         '  steps = {']
    L += [lua_step(s) for s in out]
    L.append('} }')
    open(D["file"], "w", encoding="utf-8").write("\n".join(L) + "\n")
    if os.path.isdir(ROUTES_DIR): shutil.copy(D["file"], os.path.join(ROUTES_DIR, D["file"]))
    print("   ->", D["file"])
    return len(problems)


if __name__ == "__main__":
    keys = sys.argv[1:]
    files = ["gen_steps_%s.json" % k for k in keys] if keys else sorted(glob.glob("gen_steps_*.json"))
    bad = sum(build(f) for f in files)
    sys.exit(1 if bad else 0)

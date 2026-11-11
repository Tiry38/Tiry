"""LevelPilot-Wegenetz aus der echten Spielgeometrie (Navmesh) – ersetzt die Luftlinie.

Quelle: Guidelime Pathfinder (github.com/JagTheHero/guidelime-pathfinder, GPL-3.0) baut aus Gelände, Gebäuden und
Objekten des Forever-Clients ein Navmesh (Recast/Detour) und daraus einen begehbaren Graphen: jede Kante ist eine
geprüfte, gerade begehbare Linie. Dazu Flugmeister-Positionen, gemessene Direktflug-Zeiten und Aufzüge.
Einmalig holen (wie qdb/QuestieDB, nicht im Repo):
    git clone https://github.com/JagTheHero/guidelime-pathfinder.git qdb/guidelime-pathfinder
Benötigt numpy + scipy (pip install numpy scipy).

Dieses Werkzeug verdichtet den Graphen (Kalimdor 274.000 Knoten) auf ein Grobnetz für LevelPilot:
ein Knoten je zusammenhängendem Stück in 240-Yard-Blöcken, Kantenkosten = echter kürzester Navmesh-Weg zwischen
den Blockvertretern (Schwimmen x2, schmale Stege x1,2). Ausgabe:
    ../addons/LevelPilot/Walk.lua   (LevelPilot_Walk, LevelPilot_Taxi – gepackt als Base64-Text, siehe Travel.lua)
    navmesh.json                    (Grobnetz + Flugnetz für den Routenplaner)
Aufruf (tools/):  python3 -I navmesh.py            -> bauen + Prüfbericht (Grobnetz gegen exakten Navmesh-Weg)
Im Planer:        import navmesh; navmesh.ground((area, x, y), (area, x, y)) -> Yards Bodenweg oder None
"""
import json, math, os, re, sys, heapq
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import zones

SRC = os.path.join(HERE, "..", "qdb", "guidelime-pathfinder", "addon")
FILES = {1: "Guidelime_Pathfinder_Kalimdor/Kalimdor.lua", 0: "Guidelime_Pathfinder_Azeroth/Azeroth.lua"}
ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
OFF_XY, OFF_Z, Q = 17100, 4000, 4
BLOCK = float(os.environ.get("NM_BLOCK", 240))   # Grobnetz-Block (Yards)
SWIM, NARROW = 2.0, 1.2        # Kostenfaktor: Schwimmen (kein Geisterwolf im Wasser), schmaler Steg
REACH = float(os.environ.get("NM_REACH", 720))                 # Grobkanten-Kandidaten bis zu so viel Yards Navmesh-Weg
STRETCH = float(os.environ.get("NM_STRETCH", 1.06))                # Grobnetz-Weg höchstens 5 % länger als der echte (je Kandidat)
LIFT_WAIT = 0.5                # mittlere Wartezeit = halbe Umlaufzeit
RUN = 7.0                      # Yards/s zum Umrechnen fester Zeiten (Aufzug) in Yards

# Benannte Wegstellen: der Pfeil sagt "über <Name>", wenn der Weg dort durchführt (Weltpunkt aus Kartenprozent).
# Quellen: RestedXP-Guides (.goto "Enter the Talondeep Path"), WoW-Pro Hendo, Questie-Wegweiser, Navmesh.
PLACES = [
    ("Talondeep-Pfad", 406, 78.29, 42.51), ("Talondeep-Pfad", 331, 42.30, 71.11),
    ("Brücke über den Südstrom", 14, 34.0, 42.4),
    ("Großer Aufzug", 400, 32.0, 23.4),
    ("Aufzug Freiwindposten", 400, 46.73, 48.27),
    ("Fackelpfad zum Verkohlten Tal", 406, 44.55, 63.01),
    ("Pass nach Mor'shan", 17, 48.02, 5.58),
    ("Thoradins Wall", 267, 82.62, 57.63),
]


def b64dec(s, width):
    import numpy as np
    lut = np.zeros(256, np.int64)
    for i, c in enumerate(ALPHA): lut[ord(c)] = i
    a = lut[np.frombuffer(s.encode(), np.uint8)].reshape(-1, width)
    v = np.zeros(len(a), np.int64)
    for k in range(width): v = v * 64 + a[:, k]
    return v


def b64enc(vals, width):
    out = []
    for v in vals:
        v = int(v)
        assert 0 <= v < 64 ** width, (v, width)
        out.append("".join(ALPHA[(v >> (6 * (width - 1 - k))) & 63] for k in range(width)))
    return "".join(out)


def load(cont):
    """Navmesh eines Kontinents: X (Norden), Y (Westen), Z, Knoten-Flags, Kanten (src, dst, Flags), Links."""
    import numpy as np
    path = os.path.join(SRC, FILES[cont])
    if not os.path.exists(path):
        sys.exit("Navmesh fehlt: %s\n  git clone https://github.com/JagTheHero/guidelime-pathfinder.git "
                 "qdb/guidelime-pathfinder" % path)
    text = open(path, encoding="utf-8").read()
    def field(name):
        m = re.search(r'\n\t%s = "([^"]*)"' % name, text)
        return m.group(1)
    ns, es = field("nodes"), field("edges")
    n, e = len(ns) // 14, len(es) // 4
    lut = np.zeros(256, np.int64)
    for i, c in enumerate(ALPHA): lut[ord(c)] = i
    a = lut[np.frombuffer(ns.encode(), np.uint8)].reshape(n, 14)
    def num(cols):
        v = np.zeros(n, np.int64)
        for k in cols: v = v * 64 + a[:, k]
        return v
    Y = num(range(0, 3)) / Q - OFF_XY          # HereBeDragons x = Welt-Y (Westen)
    X = num(range(3, 6)) / Q - OFF_XY          # HereBeDragons y = Welt-X (Norden)
    Z = num(range(6, 9)) / Q - OFF_Z
    F = a[:, 9]
    first = num(range(10, 14))
    b = lut[np.frombuffer(es.encode(), np.uint8)].reshape(e, 4)
    low = b[:, 0] * 4096 + b[:, 1] * 64 + b[:, 2]
    dst = low + ((b[:, 3] >> 2) << 18)
    efl = b[:, 3] & 3
    deg = np.diff(np.append(first, e))
    src = np.repeat(np.arange(n), deg)
    links = parse_links(text)
    return dict(X=X, Y=Y, Z=Z, F=F, src=src, dst=dst, efl=efl, links=links)


def parse_links(text):
    taxi, flights, rides = {}, [], []
    m = re.search(r"\n\t\ttaxi = \{(.*?)\n\t\t\},", text, re.S)
    if m:
        for i, y, x, z, piece in re.findall(r"\[(\d+)\] = \{ ([-\d.]+), ([-\d.]+), ([-\d.]+), (\d+) \}", m.group(1)):
            taxi[int(i)] = (float(x), float(y), float(z))          # (X Norden, Y Westen, Z)
    m = re.search(r"\n\t\tflights = \{(.*?)\n\t\t\},", text, re.S)
    if m:
        v = [int(t) for t in re.findall(r"\d+", m.group(1))]
        flights = [tuple(v[i:i + 3]) for i in range(0, len(v) - 2, 3)]
    m = re.search(r"\n\t\trides = \{(.*?)\n\t\t\},", text, re.S)
    if m:
        for row in re.findall(r"\{ (.*?) \},?\n", m.group(1)):
            p = [t.strip() for t in row.split(",")]
            rides.append(dict(kind=p[0].strip('"'), name=p[1].strip('"'), a=(float(p[3]), float(p[2]), float(p[4])),
                              inst=int(p[5]), b=(float(p[7]), float(p[6]), float(p[8])), ride=float(p[9]),
                              wait=float(p[10]), faction=p[11].strip('"')))
    return dict(taxi=taxi, flights=flights, rides=rides)


def full_graph(m):
    """scipy-CSR des vollen Navmesh mit Kosten (3D-Länge x Faktor)."""
    import numpy as np
    from scipy.sparse import csr_matrix
    X, Y, Z, src, dst, efl = m["X"], m["Y"], m["Z"], m["src"], m["dst"], m["efl"]
    L = np.sqrt((X[src] - X[dst]) ** 2 + (Y[src] - Y[dst]) ** 2 + (Z[src] - Z[dst]) ** 2)
    mult = np.where(efl & 1, SWIM, np.where(efl & 2, NARROW, 1.0))
    w = np.maximum(L * mult, 0.01)
    n = len(X)
    return csr_matrix((w, (src, dst)), shape=(n, n))


def coarsen(cont, m, log=print):
    import numpy as np
    from scipy.sparse import csr_matrix
    from scipy.sparse.csgraph import connected_components, dijkstra
    X, Y, F, src, dst = m["X"], m["Y"], m["F"], m["src"], m["dst"]
    n = len(X)
    G = full_graph(m)
    bx = np.floor(X / BLOCK).astype(np.int64); by = np.floor(Y / BLOCK).astype(np.int64)
    bkey = (bx + 1000) * 4096 + (by + 1000)
    same = bkey[src] == bkey[dst]
    sub = csr_matrix((np.ones(int(same.sum())), (src[same], dst[same])), shape=(n, n))
    nc, lab = connected_components(sub, directed=False)
    # Vertreter: Knoten nächst dem Schwerpunkt, Land vor Wasser
    cnt = np.bincount(lab, minlength=nc)
    cx = np.bincount(lab, X, nc) / cnt; cy = np.bincount(lab, Y, nc) / cnt
    d2 = (X - cx[lab]) ** 2 + (Y - cy[lab]) ** 2 + np.where(F & 2, 1e7, 0)
    order = np.lexsort((d2, lab))
    firsts = np.ones(n, bool); firsts[1:] = lab[order][1:] != lab[order][:-1]
    rep = np.empty(nc, np.int64); rep[lab[order][firsts]] = order[firsts]
    # Nachbar-Cluster über Navmesh-Kanten (müssen verbunden bleiben)
    cs, cd = lab[src], lab[dst]
    diff = cs != cd
    pairs = set(zip(np.minimum(cs[diff], cd[diff]).tolist(), np.maximum(cs[diff], cd[diff]).tolist()))
    # Kandidaten: echte Navmesh-Wege Vertreter -> Vertreter bis REACH Yards (begrenzte Dijkstra, stapelweise)
    fwd = {}
    for s in range(0, nc, 128):
        chunk = np.arange(s, min(nc, s + 128))
        D = dijkstra(G, directed=True, indices=rep[chunk], limit=REACH)[:, rep]
        rr, cc = np.nonzero(np.isfinite(D))
        for r, cj in zip(rr.tolist(), cc.tolist()):
            ci = int(chunk[r])
            if ci != cj: fwd[(ci, cj)] = float(D[r, cj])
    cand = {}
    for (a, b), f in fwd.items():
        if a > b: continue
        r = fwd.get((b, a))
        if r is not None: cand[(a, b)] = max(f, r)             # Einbahn (Absprung) nicht bergauf nutzen
        elif (a, b) in pairs: cand[(a, b)] = f
    for (b, a), f in fwd.items():
        if b > a and (a, b) in pairs and (a, b) not in cand and (a, b) not in fwd: cand[(a, b)] = f
    # Ausdünnen (gieriger Spanner): Kante nur, wenn das Netz ohne sie mehr als STRETCH x länger wäre
    edges, adj = {}, defaultdict(list)
    for (a, b), c in sorted(cand.items(), key=lambda kv: kv[1]):
        lim = c * STRETCH
        D = {a: 0.0}; pq = [(0.0, a)]; ok = False
        while pq:
            d, u = heapq.heappop(pq)
            if u == b: ok = True; break
            if d > D[u]: continue
            for v, w in adj[u]:
                nd = d + w
                if nd <= lim and nd < D.get(v, 1e18): D[v] = nd; heapq.heappush(pq, (nd, v))
        if not ok:
            edges[(a, b)] = c; adj[a].append((b, c)); adj[b].append((a, c))
    nodes = [(float(X[rep[c]]), float(Y[rep[c]]), float(m["Z"][rep[c]])) for c in range(nc)]
    log("Kontinent %d: Navmesh %d Knoten / %d Kanten -> Grobnetz %d Knoten, %d Kanten" % (
        cont, n, len(src), nc, len(edges)))
    return dict(nodes=nodes, edges=edges, lab=lab, rep=rep, G=G)


def add_links(cont, m, net, log=print):
    """Aufzüge (gleicher Kontinent, für die Horde nutzbar) als Sonderkanten; benannte Wegstellen."""
    nodes, edges = net["nodes"], net["edges"]
    def nearest(X, Y, Z=None):
        best, bd = None, None
        for i, (x, y, z) in enumerate(nodes):
            d = math.hypot(x - X, y - Y) + (abs(z - Z) * 2 if Z is not None else 0)
            if bd is None or d < bd: best, bd = i, d
        return best, bd
    links, done = [], set()
    for r in m["links"]["rides"]:
        if r["kind"] != "lift" or r["inst"] != cont or r["faction"] not in ("", "H"): continue
        a, da = nearest(*r["a"]); b, db = nearest(*r["b"])
        k = (min(a, b), max(a, b))
        if a == b or k in done: continue
        done.add(k)
        c = math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]) + (r["ride"] + r["wait"] * LIFT_WAIT) * RUN
        edges[k] = min(edges.get(k, 1e18), c)
        links.append((a, b, "Aufzug", "lift"))
    places = []
    for name, area, x, y in PLACES:
        w = zones.world(area, x, y)
        if not w or w[0] != cont: continue
        i, d = nearest(w[1], w[2])
        if d is not None and d < 200: places.append((i, name))
    net["links"], net["places"] = links, places
    log("  %d Aufzüge, %d benannte Stellen" % (len(links), len(places)))


def flights(cont, m):
    """Flugmeister (Navmesh-Ids = C_TaxiMap-Knoten) und gemessene Direktflüge (Sekunden)."""
    return dict(taxi={i: (round(x), round(y)) for i, (x, y, z) in m["links"]["taxi"].items()},
                flights=m["links"]["flights"])


# ---------------------------------------------------------------- Ausgabe
def write_lua(nets, fly, path):
    """Gepackt (Lua-Konstanten-Grenze 2^18 je Datei): n = je Knoten X(3)Y(3), Grad(1); e = je Kante Ziel(3) Kosten(2).
    Kanten nur einmal (a < b), Travel.lua baut beide Richtungen."""
    out = ["-- AUTOMATISCH ERZEUGT (tools/navmesh.py) – LevelPilot-Wegenetz und Flugnetz. Nicht von Hand ändern.",
           "-- Wege abgeleitet aus Guidelime Pathfinder (github.com/JagTheHero/guidelime-pathfinder, GPL-3.0):",
           "-- Navmesh aus Gelände, Gebäuden und Objekten des Forever-Clients. Vergröbert (240-Yard-Blöcke), Aufzüge",
           "-- und Wegstellen ergänzt. Lizenz GPL-3.0: siehe LIZENZ.txt und LICENSE-GPL-3.0.md in diesem Ordner.",
           "-- Format (Base64, Alphabet A-Za-z0-9+/): n = je Knoten X(3) Y(3) Grad(1), Welt-Yards + 17100;",
           "-- e = je Kante Ziel(3, 0-basiert) Kosten(2, Yards), sortiert nach Startknoten (nur a < b);",
           "-- L = Aufzüge {a, b, Name, Art}; P = benannte Wegstellen {Knoten, Name} (Knoten 1-basiert).",
           "LevelPilot_Walk = {}", "LevelPilot_Taxi = {}"]
    for cont, net in sorted(nets.items()):
        nodes, edges = net["nodes"], net["edges"]
        adj = defaultdict(list)
        for (a, b), c in edges.items():
            if a > b: a, b = b, a
            adj[a].append((b, c))
        ns, es = [], []
        for i, (X, Y, Z) in enumerate(nodes):
            lst = sorted(adj[i])
            deg = min(len(lst), 63)
            assert len(lst) <= 63, "Grad > 63"
            ns.append(b64enc([round(X) + OFF_XY, round(Y) + OFF_XY], 3) + ALPHA[deg])
            for b, c in lst:
                es.append(b64enc([b], 3) + b64enc([min(int(round(c)), 4095)], 2))
        ls = ",".join('{%d,%d,"%s","%s"}' % (a + 1, b + 1, nm, kd) for a, b, nm, kd in net["links"])
        ps = ",".join('{%d,"%s"}' % (i + 1, nm) for i, nm in net["places"])
        out.append('LevelPilot_Walk[%d]={n="%s",\ne="%s",\nL={%s},P={%s}}' % (cont, "".join(ns), "".join(es), ls, ps))
        f = fly[cont]
        ts = ",".join("[%d]={%d,%d}" % (i, x, y) for i, (x, y) in sorted(f["taxi"].items()))
        fs = ",".join("%d,%d,%d" % t for t in f["flights"])
        out.append("LevelPilot_Taxi[%d]={t={%s},\nf={%s}}" % (cont, ts, fs))
    open(path, "w", encoding="utf-8").write("\n".join(out) + "\n")


def save_json(nets, fly, path):
    j = {}
    for c, net in nets.items():
        j[str(c)] = dict(n=[[round(X), round(Y)] for X, Y, Z in net["nodes"]],
                         e=[[a, b, round(w, 1)] for (a, b), w in sorted(net["edges"].items())],
                         L=net["links"], P=net["places"],
                         taxi={str(i): v for i, v in fly[c]["taxi"].items()}, flights=fly[c]["flights"])
    json.dump(j, open(path, "w"))


# ---------------------------------------------------------------- Abfrage (Planer)
_G, _SP = {}, {}


def _load():
    if _G: return
    j = json.load(open(os.path.join(HERE, "navmesh.json")))
    for c, d in j.items():
        nodes = [tuple(x) for x in d["n"]]
        adj = [[] for _ in nodes]
        for a, b, w in d["e"]: adj[a].append((b, w)); adj[b].append((a, w))
        buck = defaultdict(list)
        for i, (X, Y) in enumerate(nodes): buck[(int(X // 160), int(Y // 160))].append(i)
        _G[int(c)] = (nodes, adj, buck, d)


SNAP_R, SNAP_MAX, SNAP_F = 300.0, 480.0, 1.15   # Anbindung: alle Knoten bis SNAP_R (sonst der nächste bis SNAP_MAX)


def near(cont, X, Y):
    """Anbindung eines Punkts ans Grobnetz: [(Knoten, Kosten)] – Luftlinie x SNAP_F zu allen Knoten im Umkreis."""
    nodes, adj, buck, _ = _G[cont]
    bx, by = int(X // 160), int(Y // 160)
    out, best = [], None
    r = int(SNAP_MAX // 160) + 1
    for i in range(-r, r + 1):
        for j in range(-r, r + 1):
            for n in buck.get((bx + i, by + j), ()):
                d = math.dist(nodes[n], (X, Y))
                if d <= SNAP_R: out.append((n, d * SNAP_F))
                if d <= SNAP_MAX and (best is None or d < best[1]): best = (n, d * SNAP_F)
    return out or ([best] if best else [])


def dijkstra(cont, X, Y):
    """Kürzeste Wege von einem Punkt (mehrere Startknoten mit ihrer Anbindung) zu allen Knoten."""
    k = (cont, round(X / 20), round(Y / 20))
    if k in _SP: return _SP[k]
    nodes, adj, buck, _ = _G[cont]
    D, pq = {}, []
    for n, c in near(cont, X, Y):
        if c < D.get(n, 1e18): D[n] = c; pq.append((c, n))
    heapq.heapify(pq)
    while pq:
        d, u = heapq.heappop(pq)
        if d > D[u]: continue
        for v, w in adj[u]:
            nd = d + w
            if nd < D.get(v, 1e18): D[v] = nd; heapq.heappush(pq, (nd, v))
    if len(_SP) > 2000: _SP.clear()
    _SP[k] = D
    return D


def ground_world(cont, a, b):
    """Bodenweg in Yards zwischen Weltpunkten (X, Y) desselben Kontinents; None = kein Netz/kein Weg.
    Gerechnet vom zweiten Punkt aus (zwischengespeichert) – b ist das stabile Ende."""
    _load()
    if cont not in _G: return None
    straight = math.dist(a, b)
    if straight < 120: return straight
    D = dijkstra(cont, *b)
    best = None
    for n, c in near(cont, *a):
        if n in D and (best is None or c + D[n] < best): best = c + D[n]
    if best is None: return None
    return max(straight, best)


def ground(p, q):
    """Bodenweg in Yards zwischen (area, x%, y%) und (area, x%, y%); None = anderer Kontinent/unbekannt."""
    a, b = zones.world(*p), zones.world(*q)
    if not a or not b or a[0] != b[0]: return None
    return ground_world(a[0], a[1:], b[1:])


def taxi(cont):
    _load()
    d = _G[cont][3]
    return {int(i): tuple(v) for i, v in d["taxi"].items()}, [tuple(t) for t in d["flights"]]


# ---------------------------------------------------------------- Prüfbericht
CHECKS = [
    ("Zoram'gar -> Steinkrallengipfel", (331, 12.2, 34.2), (406, 37.1, 8.1)),
    ("Sonnenfels -> Steinkrallengipfel", (406, 47.5, 61.0), (406, 37.1, 8.1)),
    ("Sonnenfels -> Windschergrat", (406, 47.2, 61.2), (406, 68.6, 51.2)),
    ("Sonnenfels -> Malaka'jin", (406, 47.2, 61.2), (406, 74.5, 97.9)),
    ("Sonnenfels -> Verkohltes Tal", (406, 47.2, 61.2), (406, 34.0, 72.0)),
    ("Wegkreuz -> Sonnenfels", (17, 51.5, 30.3), (406, 47.2, 61.2)),
    ("Splitterholz -> Zoram'gar", (331, 73.2, 61.6), (331, 12.2, 34.2)),
    ("Wegkreuz -> Splitterholz", (17, 51.5, 30.3), (331, 73.2, 61.6)),
    ("Orgrimmar -> Wegkreuz", (1637, 50, 50), (17, 51.5, 30.3)),
    ("Camp Taurajo -> Freiwindposten", (17, 44.5, 59.1), (400, 45.6, 50.8)),
    ("Windschergrat -> Eschental (Talondeep)", (406, 68.6, 51.2), (331, 42, 71)),
    ("Tarrens Mühle -> Hammerfall", (267, 61.5, 19.2), (45, 73.8, 32.6)),
    ("Unterstadt-Tor -> Tarrens Mühle", (85, 61.8, 65.1), (267, 61.5, 19.2)),
]


def report(nets, log=print):
    """Grobnetz gegen den exakten Navmesh-Weg (volle Dijkstra) – zeigt die Genauigkeit."""
    import numpy as np
    from scipy.sparse.csgraph import dijkstra as sdij
    global _G, _SP
    _G, _SP = {}, {}
    for nm, a, b in CHECKS:
        wa, wb = zones.world(*a), zones.world(*b)
        cont = wa[0]
        net = nets.get(cont)
        st = math.dist(wa[1:], wb[1:])
        g = ground(a, b)
        ex = None
        if net is not None:
            X, Y = net["mesh"]["X"], net["mesh"]["Y"]
            land = (net["mesh"]["F"] & 2) == 0
            def near(P):
                d = (X - P[0]) ** 2 + (Y - P[1]) ** 2 + np.where(land, 0, 1e9)
                return int(np.argmin(d))
            s, t = near(wa[1:]), near(wb[1:])
            D = sdij(net["G"], directed=True, indices=s)
            ex = float(D[t]) if np.isfinite(D[t]) else None
        log("  %-40s Luftlinie %5.0f   Navmesh %s   Grobnetz %s" % (
            nm, st, ("%5.0f (x%.2f)" % (ex, ex / st)) if ex else "    –      ",
            ("%5.0f (%+.0f%%)" % (g, (g / ex - 1) * 100 if ex else 0)) if g else "–"))


if __name__ == "__main__":
    nets, fly = {}, {}
    for cont in (1, 0):
        m = load(cont)
        net = coarsen(cont, m)
        add_links(cont, m, net)
        net["mesh"] = m
        nets[cont] = net
        fly[cont] = flights(cont, m)
        print("  %d Flugmeister, %d Direktflüge" % (len(fly[cont]["taxi"]), len(fly[cont]["flights"])))
    write_lua(nets, fly, os.path.join(HERE, "..", "addons", "LevelPilot", "Walk.lua"))
    save_json(nets, fly, os.path.join(HERE, "navmesh.json"))
    print("Walk.lua: %.0f KB" % (os.path.getsize(os.path.join(HERE, "..", "addons", "LevelPilot", "Walk.lua")) / 1024))
    print("Prüfstrecken (Yards):")
    report(nets)

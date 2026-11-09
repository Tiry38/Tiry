import re, json, math, sys
sys.path.insert(0,".")
from qdb import lua_to_py, SRC
paths={}  # area -> list of paths
for line in open(SRC+"foreverNpcDB.lua",encoding="utf-8"):
    m=re.match(r'\[(\d+)\] = (\{.*\}),\s*$', line)
    if not m or "{{{" not in line: continue
    try: v=lua_to_py(m.group(2))
    except Exception: continue
    wp=v[7] if len(v)>7 else None
    if not wp: continue
    for item in wp:
        if isinstance(item,tuple) and item[0]=='K':
            area=int(item[1]); plist=item[2]
            for p in plist or []:
                pts=[(c[0],c[1]) for c in p if isinstance(c,list) and len(c)>=2 and c[0] is not None and c[0]>=0]
                if len(pts)>=2: paths.setdefault(area,[]).append(pts)
def d(a,b): return math.hypot(a[0]-b[0],a[1]-b[1])
graph={}
for area,pl in paths.items():
    nodes=[]; edges=set(); grid={}
    def node_of(p):
        gx,gy=int(p[0]/0.5),int(p[1]/0.5)
        for dx in(-1,0,1):
            for dy in(-1,0,1):
                for i in grid.get((gx+dx,gy+dy),[]):
                    if d(nodes[i],p)<0.45: return i
        nodes.append(p); grid.setdefault((gx,gy),[]).append(len(nodes)-1); return len(nodes)-1
    pathnodes=[]
    for pts in pl:
        kept=[pts[0]]
        for p in pts[1:]:
            if d(p,kept[-1])>=1.0: kept.append(p)
        if kept[-1]!=pts[-1]: kept.append(pts[-1])
        ids=[node_of(p) for p in kept]
        for a,b in zip(ids,ids[1:]):
            if a!=b and d(nodes[a],nodes[b])<=6: edges.add((min(a,b),max(a,b)))
        pathnodes.append(set(ids))
    # Querverbindungen zwischen verschiedenen Laufwegen (sehr nah)
    owner={}
    for k,s in enumerate(pathnodes):
        for i in s: owner.setdefault(i,set()).add(k)
    for i in range(len(nodes)):
        for j in range(i+1,len(nodes)):
            if d(nodes[i],nodes[j])<1.2 and not (owner.get(i,set()) & owner.get(j,set())):
                edges.add((i,j))
    if edges: graph[area]={"n":[(round(x,2),round(y,2)) for x,y in nodes],"e":sorted(edges)}
tot_n=sum(len(g["n"]) for g in graph.values()); tot_e=sum(len(g["e"]) for g in graph.values())
print("Gebiete:",len(graph),"Knoten:",tot_n,"Kanten:",tot_e)
for a,name in [(1637,"Orgrimmar"),(1638,"Donnerfels"),(1497,"Unterstadt"),(14,"Durotar"),(17,"Brachland"),(406,"Steinkrallen"),(331,"Eschental"),(267,"Hügelland"),(400,"Tausend Nadeln"),(130,"Silberwald"),(215,"Mulgore")]:
    g=graph.get(a); print(f"  {name:15s}", (len(g['n']),len(g['e'])) if g else "-")
json.dump(graph,open("nav.json","w"))

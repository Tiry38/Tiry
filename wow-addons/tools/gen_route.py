import json, math
D=json.load(open("full.json")); Q,N,O,I=D["Q"],D["N"],D["O"],D["I"]
BIG=10000
def spawns(kind,i):
    src={"n":N,"o":O}[kind].get(str(i))
    out=[]
    if not src: return out
    for area,pts in (src.get("sp") or {}).items():
        for p in pts or []:
            if isinstance(p,list) and len(p)>=2 and p[0] is not None and p[0]>=0: out.append((int(area),p[0],p[1]))
    return out
def item_src(i):
    it=I.get(str(i)); out=[]
    if not it: return out
    for n in it.get("nd") or []: out+=spawns("n",n)
    for o in it.get("od") or []: out+=spawns("o",o)
    return out
def giver(q):
    v=Q[str(q)]; s=v[1] or []; out=[]
    if len(s)>0 and s[0]:
        for n in s[0]: out+=[(p,("npc",n)) for p in spawns("n",n)]
    if len(s)>1 and s[1]:
        for o in s[1]: out+=[(p,("obj",o)) for p in spawns("o",o)]
    if len(s)>2 and s[2]:
        for it in s[2]: out+=[(p,("item",it)) for p in item_src(it)]
    return out
def finisher(q):
    v=Q[str(q)]; s=v[2] or []; out=[]
    if len(s)>0 and s[0]:
        for n in s[0]: out+=[(p,("npc",n)) for p in spawns("n",n)]
    if len(s)>1 and s[1]:
        for o in s[1]: out+=[(p,("obj",o)) for p in spawns("o",o)]
    return out
def trigger_pts(q):
    v=Q[str(q)]; te=v[8] if len(v)>8 else None; pts=[]
    if isinstance(te,list) and len(te)>1 and te[1]:
        for it in te[1]:
            if isinstance(it,tuple) and it[0]=='K':
                for c in it[2] or []:
                    if isinstance(c,list) and len(c)>=2: pts.append((int(it[1]),c[0],c[1]))
    return pts
def objective_pts(q):
    v=Q[str(q)]; ob=v[9] if len(v)>9 else None; pts=trigger_pts(q)
    if not ob: return pts
    def lst(k): return ob[k] if len(ob)>k and ob[k] else []
    for c in lst(0):
        if isinstance(c,list) and c: pts+=spawns("n",c[0])
    for c in lst(1):
        if isinstance(c,list) and c: pts+=spawns("o",c[0])
    for c in lst(2):
        if isinstance(c,list) and c: pts+=item_src(c[0])
    for c in lst(4):
        if isinstance(c,list) and c and isinstance(c[0],list):
            for n in c[0]: pts+=spawns("n",n)
    return pts
def centroid(pts, areas):
    if not pts: return None
    cnt={}
    for a,x,y in pts: cnt[a]=cnt.get(a,0)+1
    pref=[a for a in cnt if a in areas] or list(cnt)
    a=max(pref,key=lambda k:cnt[k])
    sel=[(x,y) for aa,x,y in pts if aa==a]
    return (a,sum(p[0] for p in sel)/len(sel),sum(p[1] for p in sel)/len(sel))
def dist(p,q):
    if p is None or q is None: return BIG
    if p[0]!=q[0]: return BIG
    return math.hypot(p[1]-q[1],p[2]-q[2])
def best(cands, pos, areas):
    if not cands: return None,None
    def key(c):
        p=c[0]; return (0 if p[0] in areas else 1, dist(p,pos))
    c=min(cands,key=key); return c[0],c[1]
def pre_ok(q, done, route_set):
    v=Q[str(q)]; g=v[11] or []; s=v[12] or []
    for p in g:
        if p in route_set and p not in done: return False
    if s and any(p in route_set for p in s) and not any(p in done for p in s): return False
    return True

def path_len(st):
    tot=0; pos=None
    for x in st:
        p=x.get("_p")
        if p is None: continue
        if pos is not None: tot+=min(dist(pos,p),60)   # Zonenwechsel = Reise, gedeckelt
        pos=p
    return tot
def valid(order, done0, route_set, acc0=(), comp0=()):
    acc=set(acc0); comp=set(comp0); done=set(done0)
    for x in order:
        q=x.get("q"); t=x["t"]
        if q is None: continue
        if t=="accept":
            if not pre_ok(q,done,route_set): return False
            acc.add(q)
            if "Gegenstand" in (x.get("note") or ""): comp.add(q)
        elif t=="complete":
            if q not in acc: return False
            comp.add(q)
        elif t=="turnin":
            if q not in acc: return False
            needs_c=any(y["t"]=="complete" and y.get("q")==q for y in order)
            if needs_c and q not in comp: return False
            done.add(q)
    return True
def optimize(st, done0, route_set, acc0=(), comp0=()):
    # Or-Opt: einzelne Schritte und Paare an die guenstigste erlaubte Stelle verschieben
    if len(st)<4: return st
    head=st[:1] if st[0].get("q") is None else []
    body=st[len(head):]
    best=path_len(head+body); improved=True; rounds=0
    while improved and rounds<30:
        improved=False; rounds+=1
        for size in (1,2,3):
            i=0
            while i+size<=len(body):
                blk=body[i:i+size]; rest=body[:i]+body[i+size:]
                for j in range(len(rest)+1):
                    if j==i: continue
                    cand=rest[:j]+blk+rest[j:]
                    c=path_len(head+cand)
                    if c+1e-6<best and valid(cand,done0,route_set,acc0,comp0):
                        body=cand; best=c; improved=True; break
                i+=1
    return head+body

OBJ_AREA={1195:331, 1535:17, 1536:267, 1534:331, 882:17}  # Ziele ohne Koordinaten in der DB
def generate(segments, extra_done=()):
    route_set=set()
    for seg in segments: route_set|=set(seg["q"])
    done=set(extra_done); accepted=set(); completed=set(); steps=[]
    for seg in segments:
        areas=set(seg["areas"]); L=seg["l"]; Z=seg["name"]
        hubnpc=seg.get("hub")
        pos=None; seg_start=len(steps); done_before=set(done); acc_before=set(accepted); comp_before=set(completed)
        if hubnpc:
            hs=[p for p in spawns("n",hubnpc[1]) ]
            pos=hs[0] if hs else None
            steps.append(dict(l=L,z=Z,t=seg.get("travel","fly"),q=None,note=seg.get("tnote",hubnpc[0]),npc=hubnpc[0],_p=pos))
        # Gierig nach Naehe: in jedem Schritt die naechstgelegene sinnvolle Aktion
        # (annehmen, erledigen oder abgeben) - so wird direkt vor Ort Erledigtes nicht vertagt.
        for _guard in range(400):
            cands=[]
            for q in seg["q"]:
                if q in accepted or q in done: continue
                if not pre_ok(q,done,route_set) or (Q[str(q)][3] or 0)>L+1: continue
                g=giver(q)
                if not g: continue
                if all(c[1][0]=="item" for c in g):
                    c=centroid([p for p,_ in g],areas)
                    if c and c[0] in areas: cands.append(("itemaccept",q,c))
                    continue
                p,who=best(g,pos,areas)
                nm=N.get(str(who[1]),{}).get("name") if who and who[0]=="npc" else None
                if p[0] in areas or nm in seg.get("near_npcs",[]): cands.append(("accept",q,p))
            for q in list(accepted):
                if q in completed or q in done: continue
                if not Q[str(q)][9] and not trigger_pts(q): completed.add(q); continue
                c=centroid(objective_pts(q),areas)
                if c and c[0] in areas: cands.append(("complete",q,c))
                elif not c and OBJ_AREA.get(q) in areas: cands.append(("complete_np",q,pos))
            for q in list(accepted):
                if q in done or q not in completed: continue
                p,who=best(finisher(q),pos,areas)
                nm=N.get(str(who[1]),{}).get("name") if who and who[0]=="npc" else None
                if p and (p[0] in areas or nm in seg.get("near_npcs",[])): cands.append(("turnin",q,p))
            if not cands: break
            # Abgaben/Erledigen leicht bevorzugen (Kette laeuft weiter, Log bleibt leer)
            bonus={"turnin":0.85,"complete":0.95,"complete_np":0.0,"accept":1.0,"itemaccept":0.95}
            k=min(cands,key=lambda c:(dist(c[2],pos) if c[2] is not None else 0)*bonus[c[0]])
            kind,q,p=k; pos=p if p is not None else pos
            if kind=="accept":
                steps.append(dict(l=L,z=Z,t="accept",q=q,_p=p)); accepted.add(q)
            elif kind=="itemaccept":
                steps.append(dict(l=L,z=Z,t="accept",q=q,note="Gegenstand looten und benutzen – startet die Quest",_p=p)); accepted.add(q); completed.add(q)
            elif kind=="complete":
                steps.append(dict(l=L,z=Z,t="complete",q=q,_p=p)); completed.add(q)
            elif kind=="complete_np":
                steps.append(dict(l=L,z=Z,t="complete",q=q,note="Ziel laut Questtext",_p=None)); completed.add(q)
            else:
                steps.append(dict(l=L,z=Z,t="turnin",q=q,_p=p)); done.add(q)
        body=steps[seg_start:]
        before=path_len(body)
        body=optimize(body, done_before, route_set, acc_before, comp_before)
        steps[seg_start:]=body
        seg["len"]=(before,path_len(body))
        seg["left"]=[q for q in seg["q"] if q not in done]
    return steps, done, accepted

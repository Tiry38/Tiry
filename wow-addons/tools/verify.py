import json, sys
D=json.load(open("forever.json")); Q=D["q"]; N=D["n"]
HORDE_BITS = 2|16|32|128|(1<<33)   # Orc, Untoter, Tauren, Troll, Skyborne-Horde
def q(i): return Q.get(str(i))
def horde_ok(v):
    r=v[5]
    return (not r) or (r & HORDE_BITS)!=0 or r in (4294967295,)
def npc_ok(ids):
    out=[]
    for nid in ids or []:
        n=N.get(str(nid))
        if n: out.append((nid,n[0],n[2]))
    return out
def pre(v):
    g=v[11] if len(v)>11 else None; s=v[12] if len(v)>12 else None
    return (g or []), (s or [])
def check(steps):
    done=set(); accepted=set(); problems=[]
    for k,st in enumerate(steps,1):
        t,qid=st["t"],st.get("q")
        if not qid: continue
        v=q(qid)
        if not v: problems.append(f"#{k} {t} {qid}: NICHT in Forever-DB"); continue
        if not horde_ok(v): problems.append(f"#{k} {qid} {v[0]}: nicht für Horde (races={v[5]})")
        if t=="accept":
            g,sg=pre(v)
            miss=[p for p in g if p not in done]
            if miss: problems.append(f"#{k} {qid} {v[0]}: Vorquest(s) fehlen vorher: {miss}")
            if sg and not any(p in done for p in sg): problems.append(f"#{k} {qid} {v[0]}: eine von {sg} nötig")
            accepted.add(qid)
        if t=="turnin":
            if qid not in accepted: problems.append(f"#{k} {qid} {v[0]}: abgeben ohne annehmen")
            done.add(qid)
    return problems
if __name__=="__main__":
    print(q(6571)[:5], horde_ok(q(6571)))

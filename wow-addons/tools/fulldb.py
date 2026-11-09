import re, json, sys
sys.path.insert(0,".")
from qdb import lua_to_py, SRC
def load(kind):
    db={}
    for line in open(SRC+"forever%sDB.lua"%kind, encoding="utf-8"):
        m=re.match(r'\[(\d+)\] = (\{.*\}),\s*$', line)
        if m:
            try: db[int(m.group(1))]=lua_to_py(m.group(2))
            except Exception: pass
    return db
def kv(t):  # Lua-Keyed-Liste -> dict
    out={}
    for it in t or []:
        if isinstance(it,tuple) and it[0]=='K': out[int(it[1])]=it[2]
    return out
Q=load("Quest"); N=load("Npc"); O=load("Object"); I=load("Item")
json.dump({
 "Q":{k:v[:17] for k,v in Q.items()},
 "N":{k:{"name":v[0],"sp":kv(v[6]) if len(v)>6 else {},"fr":v[12] if len(v)>12 else None} for k,v in N.items()},
 "O":{k:{"name":v[0],"sp":kv(v[3]) if len(v)>3 else {}} for k,v in O.items()},
 "I":{k:{"name":v[0],"nd":v[1],"od":v[2]} for k,v in I.items()},
},open("full.json","w"))
print(len(Q),len(N),len(O),len(I))

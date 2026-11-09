import json, sys
sys.path.insert(0,".")
import json as _j, os as _o
if _o.path.exists("gen_steps.json"):
    R=_j.load(open("gen_steps.json"))
    NOTES={6482:"optional – Begleitquest, einmal versuchen",4770:"optional – Begleitquest",6544:"Begleitquest",6641:"Ereignis am Strand",
           4904:"Begleitquest",4966:"Verteidigungs-Ereignis",5147:"optional – starker Gegner",6284:"Elite – nur in Gruppe",
           1149:"Von der Planke springen",23:"Ursangous töten, Pfote benutzen",24:"Shadumbra töten, Kopf benutzen",2:"Scharfklaue töten, Klaue benutzen",
           1195:"Phiole am Mondbrunnen im Eschental füllen",1535:"Schlauch am Teich unter Brines Hütte füllen",1536:"Roter Schlauch – Brunnen in Tarrens Mühle"}
    for st in R:
        if st.get("q") in NOTES and not st.get("note"): st["note"]=NOTES[st["q"]]
        if st.get("q") in (6284,): st["slowq"]=True
        if st["t"]=="train": st["npc"]=st.get("npc")
else:
    from route_src import R
from verify import Q, N, horde_ok
names={}
for k,v in N.items():
    names.setdefault(v[0],[]).append(int(k))
# Freundlich zur Horde bevorzugen
def npc_id(name):
    ids=names.get(name) or []
    ids=sorted(ids, key=lambda k: 0 if N[str(k)][1] else 1)
    return ids
# Nachfolger-Ketten aus der Forever-DB (Quest X ist Vorquest von Y)
succ={}
for k,v in Q.items():
    for p_ in (v[11] or [])+(v[12] or []):
        succ.setdefault(p_,set()).add(int(k))
def successors(q):
    seen=set(); todo=[q]
    while todo:
        c=todo.pop()
        for n in succ.get(c,()):
            if n not in seen: seen.add(n); todo.append(n)
    return sorted(seen)
SLOW={1063,1064,1065,1066,1067,1086,6571,6284,1096,6283,539}
import os as _os2
if _os2.path.exists("auto_slow.json"): SLOW|=set(json.load(open("auto_slow.json")))  # bekannte Zeitfresser (Speed-Modus)
problems=[]; out=[]
accepted=set(); done=set()
for i,s in enumerate(R,1):
    q=s["q"]
    if q:
        v=Q.get(str(q))
        if not v: problems.append(f"#{i} {s['t']} {q}: FEHLT in Forever-DB"); continue
        if not horde_ok(v): problems.append(f"#{i} {q} {v[0]}: nicht Horde"); continue
        s["n"]=v[0]; s["ql"]=v[4]; s["rl"]=v[3]
        if v[6]: s["cls"]=v[6]
        if v[11]: s["pre"]=v[11]
        if v[12]: s["pres"]=v[12]
        if q==1528: s["alt"]=[2985,1529,2986]
        nx=successors(q)
        if s.get("alt"):
            for a in s["alt"]: nx+=successors(a)
        if nx: s["nxt"]=sorted(set(nx))[:40]
        if s["t"]=="accept":
            g=v[11] or []; sg=v[12] or []
            miss=[p for p in g if p not in done]
            if miss: problems.append(f"#{i} {q} {v[0]} (accept): Vorquests fehlen vorher {miss}")
            if sg and not any(p in done for p in sg): problems.append(f"#{i} {q} {v[0]} (accept): eine von {sg} nötig")
            if v[3] and v[3]>s["l"]+1: problems.append(f"#{i} {q} {v[0]}: Mindeststufe {v[3]} > Abschnitt {s['l']}")
            accepted.add(q)
        else:
            if q not in accepted: problems.append(f"#{i} {q} {v[0]} ({s['t']}): nicht vorher angenommen")
            if s["t"]=="turnin": done.add(q)
    if (q and q in SLOW) or ("Beutebucht" in (s.get("note") or "")) or s["z"].startswith("Donnerfels (Abstecher)"):
        s["slow"]=True
    if s.get("npc"):
        ids=npc_id(s["npc"])
        if not ids: problems.append(f"#{i} NPC '{s['npc']}' nicht gefunden")
        else: s["npcid"]=ids[0]
    out.append(s)
print(len(R),"Schritte,",len(problems),"Probleme")
for p in problems: print(" ",p)
json.dump(out,open("route.json","w"))

def lstr(x): return '"'+str(x).replace('\\','\\\\').replace('"','\\"')+'"'
L=['-- AUTOMATISCH ERZEUGT (LevelPilot Routen-Werkzeug) · geprüft gegen Questies Forever-Datenbank',
   'LevelPilot_Routes = LevelPilot_Routes or {}',
   'LevelPilot_Routes["horde_22_30"] = { name = "Horde 22–30 · Speedrun", faction = "Horde", min = 20, max = 30, steps = {']
for s_ in out:
    f=[f't = "{s_["t"]}"', f'l = {s_["l"]}', f'z = {lstr(s_["z"])}']
    if s_.get("q"): f.append(f'q = {s_["q"]}')
    if s_.get("n"): f.append(f'n = {lstr(s_["n"])}')
    if s_.get("npcid"): f.append(f'npc = {s_["npcid"]}')
    if not s_.get("q"):
        if s_["t"]=="train": f.append(f'to = {lstr("Klassenlehrer " + (s_.get("npc") or ""))}')
        elif s_["t"] in ("fly","go","hearth"): f.append(f'to = {lstr(s_.get("note") or s_.get("npc") or "")}')
        if s_.get("npc") and s_["t"]!="train": f.append(f'note = {lstr(("NPC: "+s_["npc"]))}')
        elif s_.get("note") and s_["t"]=="train": f.append(f'note = {lstr(s_["note"])}')
    elif s_.get("note"): f.append(f'note = {lstr(s_["note"])}')
    if s_.get("pre") and s_["t"]=="accept": f.append('pre = {'+', '.join(str(a) for a in s_["pre"])+'}')
    if s_.get("pres") and s_["t"]=="accept": f.append('pres = {'+', '.join(str(a) for a in s_["pres"])+'}')
    if s_.get("cls"): f.append(f'cls = {s_["cls"]}')
    if s_.get("alt"): f.append('alt = {'+', '.join(str(a) for a in s_["alt"])+'}')
    if s_.get("slow"): f.append('slow = true')
    if s_.get("rl"): f.append(f'rl = {s_["rl"]}')
    if s_.get("ql"): f.append(f'ql = {s_["ql"]}')
    if s_.get("nxt"): f.append('nxt = {'+', '.join(str(a) for a in s_["nxt"])+'}')
    if s_["t"]=="train": f.append('cls = 64')
    L.append('  { '+', '.join(f)+' },')
L.append('} }')
open("Horde_22_30.lua","w",encoding="utf-8").write("\n".join(L)+"\n")
print("Lua geschrieben")

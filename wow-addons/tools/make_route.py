import sys, json
import os as _os
BASE=_os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),".."))+"/"  # = wow-addons/
sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from gen_route import generate, Q, N
def npc(name):
    ids=[int(k) for k,v in N.items() if v["name"]==name and v["sp"]]
    return (name, ids[0]) if ids else (name, None)
SEG=[
 dict(name="Orgrimmar", l=22, areas=[1637], hub=npc("Kardris Dreamseeker"), travel="train", tnote="Klassenlehrer – neue Zauber",
      q=[1528,1061,235]),
 dict(name="Brachland", l=22, areas=[17], near_npcs=[], hub=npc("Omusa Thunderhorn"), tnote="Camp Taurajo – Ruhestein hier setzen",
      q=[1528,1530,1535,1536, 868,843,879,906,893,4921,899,878,5052,865,1069,1061]),
 dict(name="Steinkrallengebirge", l=23, areas=[406], near_npcs=["Seereth Stonebreak","Makaba Flathoof"], hub=npc("Tharm"), tnote="Sonnenfels – Ruhestein hier setzen",
      q=[1069,1062,6461,6284,1093,1094,1090,1092,1095,1096,6301,6381,1087,1058,6282,6393,5881,1088]),
 dict(name="Brachland", l=25, areas=[17], hub=npc("Omusa Thunderhorn"), tnote="Camp Taurajo – Ruhestein hier setzen",
      q=[846,849,885,1095,4921,899]),
 dict(name="Tausend Nadeln", l=25, areas=[400], hub=npc("Nyse"), travel="go", tnote="Südlich zum Großen Aufzug, dann Freiwindposten",
      q=[5881,4542,4841,1149,4821,4865]),
 dict(name="Donnerfels", l=26, areas=[1638], hub=npc("Tal"), tnote="Donnerfels – Schamanenlehrer, Quests abholen",
      q=[1195]),
 dict(name="Eschental", l=26, areas=[331], hub=npc("Vhulgra"), tnote="Splitterholzposten – Ruhestein hier setzen",
      q=[6383,23,24,2,247,6503,6544,25,1918,824,1195,6641,216,6462,6442,6441,1088]),
 dict(name="Steinkrallengebirge", l=28, areas=[406], hub=npc("Tharm"), tnote="Sonnenfels",
      q=[1088,6283,1095,1096]),
 dict(name="Donnerfels", l=28, areas=[1638], hub=npc("Tal"), tnote="Donnerfels – trainieren, Ruhestein setzen",
      q=[1195,1196]),
 dict(name="Tausend Nadeln", l=28, areas=[400], hub=npc("Nyse"), tnote="Freiwindposten",
      q=[1196,1197,4865,4770,4767,5064,4904,4881,4966,5147]),
 dict(name="Hügelland", l=29, areas=[267,130], hub=npc("Zarise"), tnote="Tarrens Mühle (Zeppelin → Unterstadt → Flug)",
      q=[493,494,496,498,499,501,502,527,528,546,567,529,532,539,509,1536]),
]
# ---- Qualitaetsfilter: nur schnelle, effiziente Quests ----
import statistics
from qual import assess
score={}; info={}
for seg in SEG:
    rs=[assess(q,seg["areas"]) for q in seg["q"]]
    med=statistics.median([r["score"] for r in rs]) if rs else 1
    for r in rs:
        rel=r["score"]/med
        score[r["q"]]=min(score.get(r["q"],9),rel); info[r["q"]]=r
DROP=set(q for q,v in score.items() if v<0.5)
SLOWQ=set(q for q,v in score.items() if 0.5<=v<0.62)|set(q for q,r in info.items() if r["esc"] or r["elite"])
# Vorquests behalten, wenn eine behaltene Quest sie braucht
allq=set(score)
changed=True
while changed:
    changed=False
    for q in allq-DROP:
        v=Q[str(q)]
        for p in (v[11] or [])+(v[12] or []):
            if p in DROP: DROP.discard(p); SLOWQ.add(p); changed=True
for seg in SEG: seg["q"]=[q for q in seg["q"] if q not in DROP]
SLOWQ-={1195,1196,1197}  # Heilige Flamme: starke Kette, Wert nur durch Abschnittswechsel unterschaetzt
json.dump(sorted(SLOWQ-DROP),open("auto_slow.json","w"))
print("gestrichen:",sorted((q,Q[str(q)][0]) for q in DROP))
print("Speed-Modus ueberspringt:",sorted((q,Q[str(q)][0]) for q in SLOWQ-DROP))
steps,done,acc=generate(SEG)
print(len(steps),"Schritte")
for s in SEG: 
    if s["left"]: print("offen in",s["name"],s["l"],":",s["left"])
json.dump(steps,open("gen_steps.json","w"))
for s in steps[:40]: print(s["l"],s["z"],s["t"],s["q"],Q[str(s["q"])][0] if s["q"] else s.get("note"))
from gen_route import giver, finisher, objective_pts, centroid
print("---- Diagnose")
acc_set=set(s["q"] for s in steps if s["t"]=="accept"); comp=set(s["q"] for s in steps if s["t"]=="complete"); tin=set(s["q"] for s in steps if s["t"]=="turnin")
allq=sorted(set(q for s in SEG for q in s["q"]))
for q in allq:
    v=Q[str(q)]
    st=("A" if q in acc_set else "-")+("C" if q in comp else "-")+("T" if q in tin else "-")
    if st!="ACT" and not (st=="A-T"):
        g=giver(q); f=finisher(q); o=objective_pts(q)
        print(q,v[0],"lvl",v[3],v[4],st,"pre",v[11],v[12],"giverAreas",sorted(set(p[0] for p,_ in g))[:4],"finAreas",sorted(set(p[0] for p,_ in f))[:4],"objAreas",sorted(set(p[0] for p in o))[:4])

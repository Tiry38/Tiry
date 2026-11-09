import re, json, sys
import os as _os
BASE=_os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),".."))+"/"  # = wow-addons/
SRC=BASE+"qdb/QuestieDB/data/Forever/"  # git clone https://github.com/Questie/QuestieDB.git qdb/QuestieDB
def lua_to_py(s):
    # sehr einfacher Lua-Tabellen-Parser fuer {..} mit Zahlen, Strings, nil
    i=0
    def ws():
        nonlocal i
        while i<len(s) and s[i] in ' \t\r\n': i+=1
    def val():
        nonlocal i
        ws()
        c=s[i]
        if c=='{':
            i+=1; out=[]
            while True:
                ws()
                if s[i]=='}': i+=1; return out
                if s[i]=='[':  # [key] = val
                    j=s.index(']',i); k=s[i+1:j]; i=j+1; ws(); assert s[i]=='='; i+=1
                    v=val(); out.append(('K',k,v))
                else:
                    out.append(val())
                ws()
                if s[i]==',': i+=1
        if c in '"\'':
            q=c; j=i+1; buf=''
            while s[j]!=q:
                if s[j]=='\\': buf+=s[j+1]; j+=2
                else: buf+=s[j]; j+=1
            i=j+1; return buf
        m=re.match(r'nil|true|false|-?[0-9.]+(e[0-9]+)?',s[i:])
        t=m.group(0); i+=len(t)
        return None if t=='nil' else (t=='true' if t in('true','false') else float(t) if '.' in t else int(t))
    return val()
def load(kind):
    db={}
    for line in open(SRC+"forever%sDB.lua"%kind, encoding="utf-8"):
        m=re.match(r'\[(\d+)\] = (\{.*\}),\s*$', line)
        if m:
            try: db[int(m.group(1))]=lua_to_py(m.group(2))
            except Exception as e: pass
    return db
if __name__=="__main__":
    Q=load("Quest"); N=load("Npc")
    json.dump({"q":{k:v[:17] for k,v in Q.items()},"n":{k:[v[0],v[6] if len(v)>6 else None,v[8] if len(v)>8 else None] for k,v in N.items()}}, open("forever.json","w"))
    print(len(Q), len(N))
    print(Q[6571][:5])

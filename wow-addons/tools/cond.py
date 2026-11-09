import sys,re
rows=[l.rstrip('\n').split('|') for l in open(sys.argv[1],encoding='utf-8')]
keep=[];restricted={}
for i,r in enumerate(rows):
    ex=r[6] if len(r)>6 else ''
    mo=re.search(r'only ([^;]*)',ex)
    if mo and not mo.group(1).startswith('-') and len(re.split(r'\s*,\s*',mo.group(1)))>=4:
        ex=ex.replace('only '+mo.group(1),'classes '+mo.group(1).replace(' ',''))
    if re.search(r'only (?!-)|race ',ex):
        restricted.setdefault(r[0],[]).append(r[3]+' '+r[4]); continue
    if r[2].startswith('complete'):
        q=r[3]; later=False
        for r2 in rows[i+1:]:
            if r2[3]==q and r2[2].startswith('complete') and not re.search(r'only (?!-)|race ',r2[6] if len(r2)>6 else ''): later=True;break
            if r2[3]==q and r2[2]=='turnin': break
        if later: continue
        r[2]='complete'
    if r[2]=='note' and 'NOTE' not in ex: continue
    ex=re.sub(r'\\n',' ',ex); ex=re.sub(r'only -\S+','',ex); ex=re.sub(r'obj [\d;]+','',ex).strip('; ')
    m=re.search(r'(NOTE: .*?)$',ex)
    if m:
        s=m.group(1); k=re.search(r'[^.]*(skip|not worth|optional|recommended only|abandon)[^.]*',s,re.I)
        ex=ex[:m.start()]+('NOTE: '+k.group(0).strip() if k else '')
    if 'SKIP-mention' in ex: ex=ex.replace('SKIP-mention','text mentions skip')
    keep.append(r[:6]+([ex[:110]] if ex.strip('; ') else []))
prev=None
n=0
for r in keep:
    if prev and r[2:6]==prev[2:6]: continue
    n+=1; r[1]=str(n); print('|'.join(r)); prev=r
for k,v in restricted.items(): print(f'# {k}: {len(v)} class/race-only steps omitted: '+', '.join(sorted(set(x.split(" ",1)[0]+" "+x.split(" ",1)[1] for x in v)))[:600], file=sys.stderr)

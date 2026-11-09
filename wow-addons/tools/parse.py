import re,sys,json
D=sys.argv[1]
db=open(D+'/gl/Guidelime/Data/Internal/QuestsDB.lua',encoding='utf-8').read()
Q={}
for m in re.finditer(r'\n\t\[(\d+)\] = \{(.*?)\n\t\};',db,re.S):
    b=m.group(2); n=re.search(r'\["name"\] = "((?:[^"\\]|\\.)*)"',b); z=re.search(r'\["zone"\] = "([^"]*)"',b)
    Q[int(m.group(1))]=(n.group(1) if n else '?', z.group(1) if z else '?')
def qn(i): return Q.get(i,('?','?'))
out=[]
def emit(src,typ,qid,name,zone,extra=''):
    out.append([src,typ,qid,name,zone,extra])
GTYPE={'QA':'accept','QC':'complete','QT':'turnin','QS':'skip'}
def guidelime(src,files):
    for f,start in files:
        lines=open(f,encoding='utf-8',errors='replace').read().split('\n')
        zone='?'
        for ln in lines[start-1:]:
            if ln.startswith(']]') or 'registerGuide' in ln: continue
            cls=re.findall(r'\[A ?([^\]]*)\]',ln)
            restr=('only '+cls[0]) if cls and cls[0].strip() not in ('Horde',) and not cls[0].startswith('Horde') else ''
            opt='optional' if re.search(r'\[O[C]?\]|\boptional\b',ln,re.I) else ''
            skipw='SKIP-mention' if re.search(r'\bskip|not worth|abandon',ln,re.I) else ''
            ex=';'.join(x for x in (restr,opt,skipw) if x)
            for t in re.finditer(r'\[(QA|QC|QT|QS|G|F|H|P|S|T|XP|OC|O)\s*([^\]]*)\]',ln):
                k,a=t.group(1),t.group(2)
                if k=='G':
                    zm=re.match(r'[\d.,\s]+(.*)',a)
                    if zm and zm.group(1): zone=zm.group(1).strip()
                elif k in GTYPE:
                    m=re.match(r'(\d+)(?:,(\d+))?',a)
                    if not m: continue
                    i=int(m.group(1)); n,z=qn(i)
                    emit(src,GTYPE[k]+('(obj%s)'%m.group(2) if m.group(2) else ''),i,n,z,ex)
                elif k=='F': emit(src,'fly','','',zone,(a or re.sub(r'\[[^\]]*\]','',ln).strip())[:60])
                elif k=='H': emit(src,'hearth','','',zone,(a or '')[:40])
                elif k=='P': emit(src,'fp','','',zone,a)
                elif k=='S': emit(src,'sethearth','','',zone,a)
                elif k=='T' and a=='' : emit(src,'train','','',zone,re.sub(r'\[[^\]]*\]','',ln).strip()[:50])
                elif k=='XP': emit(src,'level','','',zone,a)
WP={'A':'accept','C':'complete','T':'turnin','F':'fly','f':'fp','h':'sethearth','H':'hearth','K':'kill','l':'loot','N':'note','U':'use','B':'buy','L':'level'}
def wowpro(src,f):
    for ln in open(f,encoding='utf-8').read().split('\n'):
        if ln.startswith('; Level'): emit(src,'level','','','',ln[2:]); continue
        m=re.match(r'^([A-Za-z]) ([^|]*)\|(.*)$',ln)
        if not m or m.group(1) not in WP: continue
        k,name,rest=m.groups(); f2=rest.split('|'); d={}
        for i,x in enumerate(f2):
            if x in('QID','Z','N','C','R','QO','PRE','ACTIVE'): d[x]=f2[i+1] if i+1<len(f2) else ''
            if x in('O','OPT','S','US','CHAT'): d.setdefault('flags',[]).append(x)
        z=d.get('Z','').split(';')[-1].strip()
        note=d.get('N','')
        ex=[]
        if 'C' in d and d['C']: ex.append('only '+d['C'])
        if 'R' in d and d['R']: ex.append('race '+d['R'])
        if 'O' in d.get('flags',[]) : ex.append('optional')
        if re.search(r'skip|not worth|optional|recommended only|abandon',note,re.I): ex.append('NOTE: '+re.sub(r'\[/?color[^\]]*\]','',note)[:140])
        if 'QO' in d: ex.append('obj '+d['QO'])
        qid=d.get('QID','')
        if k in 'ACT' and qid:
            for q in qid.split('^')[0].split('&')[:1]:
                n,qz=qn(int(re.sub(r'\D.*','',q) or 0)) if re.match(r'\d',q) else ('?','?')
                emit(src,WP[k],qid,name,qz,'; '.join(ex))
        elif k in 'FfhHN':
            if k=='N' and not ex: continue
            emit(src,WP[k],qid,name,z,'; '.join(ex))
S=sys.argv[2]
cm=D+'/cm/Interface/AddOns/'
if S=='ettern': guidelime('Ettern',[(cm+'Guidelime_Ettern/Ettern_20-23_Barrens_Stonetalon.lua',50)]+[(cm+'Guidelime_Ettern/'+x,1) for x in ['Ettern_23-25_Hillsbrad.lua','Ettern_25-27_Stonetalon_Ashenvale.lua','Ettern_27-29_ThousandNeedles.lua','Ettern_29-31_Hillsbrad.lua']])
if S=='freezy': guidelime('Freezy3',[(cm+'Guidelime_Freezy3/18-23 Freezy3.lua',48),(cm+'Guidelime_Freezy3/23-26 Freezy3.lua',1),(cm+'Guidelime_Freezy3/26-30 Freezy3.lua',1)])
if S=='seven': guidelime('Sevenleaves',[(D+'/sl/Guidelime_Sevenleaves_/21-22_AshenvaleRogueQuestSilverpine.lua',11)]+[(D+'/sl/Guidelime_Sevenleaves_/'+x,1) for x in ['22-24_Hillsbrad.lua','24-26_BarrensStonetalon.lua','26-28_AshenvaleBFDsolo.lua','28-31_ThousandNeedles.lua']])
if S=='milk': guidelime('Milksmuggler',[(cm+'Guidelime_Milksmuggler_HC/15-22 Barrens.lua',303)]+[(cm+'Guidelime_Milksmuggler_HC/'+x,1) for x in ['22-24 Hillsbrad.lua','24-25 Barrens.lua','25-26 Stonetalon.lua','26-28 Ashenvale.lua','28-31 Thousand Needles.lua']])
if S=='wowpro': wowpro('WoWPro',D+'/wowpro/WoWPro_Leveling/Vanilla/Horde/21_30_Hendo_HordeChapter1.lua')
for i,r in enumerate(out,1):
    print(f"{r[0]}|{i}|{r[1]}|{r[2]}|{r[3]}|{r[4]}"+(f"|{r[5]}" if r[5] else ''))

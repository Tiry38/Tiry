# Untertitel der Text-Overlays je Schnitt: python3 tools/srt.py
import json
fmt=lambda s:f'{int(s//3600):02d}:{int(s%3600//60):02d}:{int(s%60):02d},{int(round(s*1000))%1000:03d}'
H=['Das Fundament.','Farbe als Haltung.','Gebündelt gedacht.','Auf dich gebaut.','Jeder Meter weicher.','Sehen. Bremsen. Schützen.','Bereit für mehr.']
W=['Hier entscheidest du, wie weit, wie entspannt und wie wartungsarm du fährst.','18 Farbtöne, glanz oder matt. Dein Rad erkennst du unter hunderten.','Ein Paket tauscht mehrere Teile auf einmal. Wir wählen hier jedes Teil einzeln.','Die richtige Haltung entlastet Hände, Rücken und Gesäß auf jeder Strecke.','Federung und Reifen schlucken Kanten, bevor du sie spürst.','Mehr Bremskraft, mehr Licht und ein Rad, das sich wiederfinden lässt.','Korb oder Frontträger für den Einkauf. Ein stärkeres Ladegerät für kurze Pausen.']
for cut in ['main','c60','c30','c15']:
    ev=json.load(open(f'build/ev_{cut}.json')); S=[]; T=ev['T']
    sc={s['k']:s for s in ev['scenes']}
    S.append((sc['intro']['t0']+.3,sc['intro']['t0']+sc['intro']['dur'],'AEB PRO · Modelljahr 2027'))
    if 'model' in sc: S.append((sc['model']['t0']+.3,sc['model']['t0']+sc['model']['dur'],'Allround. Neu gedacht. Ein Rahmen, vier Motoren.'))
    m=sc['motor']; S.append((m['t0']+.2,m['t0']+m['dur'],'Vier Motoren: 60, 75, 90 und 120 Nm. Gewählt: Performance Line CX, 120 Nm.'))
    QT={'AKKU':0,'DISPLAY':0,'SCHALTUNG':0,'ANTRIEB':0,'RAHMEN':0,'RAHMENFARBE':1,'LENKER':3,'SATTEL':3,'SATTELSTÜTZE':4,'GABEL':4,'BEREIFUNG':4,'BREMSEN':5,'SCHEINWERFER':5,'RAHMENSCHLOSS':5,'GPS TRACKING':5,'LADEGERÄT':6}
    tabs=[s for s in ev['scenes'] if s['k']=='tab']
    if tabs and tabs[0]['pace']=='turbo':
        S.append((tabs[0]['t0']+.1,tabs[-1]['t0']+tabs[-1]['dur'],'Basis · Style · Ergonomie · Komfort · Sicherheit · Zubehör: jedes Teil einzeln gewählt.')); tabs=[]
    for s in tabs:
        caps=[c for c in ev['caps'] if QT[c['k']]==s['ti']]
        if s['pace'] in ('full','mid'):
            hend=caps[0]['t'] if caps else s['t0']+s['dur']
            S.append((s['t0']+.2,min(hend,s['t0']+s['dur']),H[s['ti']]+' '+W[s['ti']]))
            if s['pace']=='full':
                for c in caps: S.append((c['t'],c['until'],f"{c['v']} – {c['s']}"))
            elif caps: S.append((caps[0]['t'],s['t0']+s['dur'],' · '.join(c['s'] for c in caps)))
        else:  # schneller Takt: ein Untertitel pro Reiter
            S.append((s['t0']+.1,s['t0']+s['dur'],H[s['ti']]+(' '+' · '.join(c['s'] for c in caps) if caps else '')))
    for n in ev['notes']: S.append((n['t'],n['until'],n['v']))
    su=sc['summary']; S.append((su['t0']+.2,su['t0']+su['dur'],'AEB 990CX PRO · 120 Nm · 800 Wh · Automatik + Riemen · 6.677 €'))
    o=sc['outro']; S.append((o['t0']+.2,T-.05,'Dein AEB PRO. Konfiguriere deins: konfigurator.velo-de-ville.com'))
    S.sort(); out=[]
    for i,(a,b,t) in enumerate(S):
        if i+1<len(S): b=min(b,S[i+1][0]-.04)
        b=min(b,T-.05)
        if b-a<0.8: b=a+0.8
        out.append(f'{len(out)+1}\n{fmt(a)} --> {fmt(b)}\n{t}\n')
    open(f'build/overlays_{cut}.srt','w').write('\n'.join(out))
print('ok')

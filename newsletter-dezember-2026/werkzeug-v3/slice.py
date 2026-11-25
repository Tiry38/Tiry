#!/usr/bin/env python3
"""Zerschneidet die gestaltete Seite in Bildstuecke fuer die Mail: Knopf-Flaechen = eigene verlinkte Zellen,
Animationen = eigene GIF-Zellen. Ergebnis: mail/ (HTML + Bilder flach)."""
import json, os, glob, subprocess, urllib.parse, html, shutil
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
HP='https://tiry38.github.io/velo-center-web/'
LEA={'jr':'https://www.jobrad.org/','bl':'https://www.bikeleasing.de/','bb':'https://www.businessbike.de/','dd':'https://www.deutsche-dienstrad.de/',
     'cb':'https://company-bike.com/','km':'https://www.kazenmaier.de/','lb':'https://www.lease-a-bike.de/','er':'https://www.eurorad.de/','rd':'https://radimdienst.de/'}
def res(h):
    if h=='' : return HP
    if h.startswith('#'): return HP+'#'+urllib.parse.quote(h[1:],safe='=~-')
    if h.startswith('WA:'): return 'https://wa.me/491635343133?text='+urllib.parse.quote(h[3:])
    if h=='MAPS': return 'https://www.google.com/maps/search/?api=1&query=Velocenter+Hessert+Hartmannstra%C3%9Fe+25+76744+W%C3%B6rth+am+Rhein'
    if h.startswith('LEA:'): return LEA[h[4:]]
    return h
L=json.load(open('out/layout.json')); H=L['H']; W=640
r=lambda v:int(round(v))
links=[dict(x0=max(0,r(a['x'])),y0=r(a['y']),x1=min(W,r(a['x']+a['w'])),y1=r(a['y']+a['h']),href=res(a['href']),txt=a['txt']) for a in L['links']]
anims=[dict(x0=r(a['x']),y0=r(a['y']),x1=r(a['x']+a['w']),y1=r(a['y']+a['h']),name=a['name']) for a in L['anims']]
ys=sorted({0,H}|{v for a in links+anims for v in (a['y0'],a['y1'])})
st=Image.open('out/static.png').convert('RGB')
shutil.rmtree('mail',ignore_errors=True);os.makedirs('mail');shutil.copy('out/fuss-logo.png','mail/fuss-logo.png');[shutil.copy(f'out/so-{k}.png',f'mail/so-{k}.png') for k in ('fb','ig','wa','hp')]
# GIF-Frames je Animation laden (2x -> 1x)
AF={}
for a in anims:
    fs=sorted(glob.glob(f"out/fr-{a['name']}/*.png"))
    HI=a['name'].startswith('snow') or a['name']=='leaf'
    AF[a['name']]=[(Image.open(f).convert('RGB').resize((2*(a['x1']-a['x0']),2*(a['y1']-a['y0'])),Image.LANCZOS) if HI else Image.open(f).convert('RGB').resize((a['x1']-a['x0'],a['y1']-a['y0']),Image.LANCZOS)) for f in fs]
rows=[];n=0;alts=[]
def cover(c,x0,y0,x1,y1): return c['x0']<=x0 and c['y0']<=y0 and c['x1']>=x1 and c['y1']>=y1
for yi in range(len(ys)-1):
    y0,y1=ys[yi],ys[yi+1]
    if y1-y0<1: continue
    inb=[a for a in links+anims if a['y0']<y1 and a['y1']>y0]
    xs=sorted({0,W}|{v for a in inb for v in (a['x0'],a['x1']) if 0<v<W})
    cells=[]
    for xi in range(len(xs)-1):
        x0,x1=xs[xi],xs[xi+1]
        an=next((a for a in anims if cover(a,x0,y0,x1,y1)),None)
        ln=next((l for l in links if cover(l,x0,y0,x1,y1)),None)
        n+=1
        if an:
            fr=AF[an['name']]; box=(x0-an['x0'],y0-an['y0'],x1-an['x0'],y1-an['y0'])
            if an['name'].startswith('snow') or an['name']=='leaf': box=tuple(2*v for v in box)
            seq=[f.crop(box) for f in fr]
            once=an['name'] not in ('hero','gt','leaf') and not an['name'].startswith('snow')
            if once: seq=[seq[-1]]+seq+[seq[-1]]
            dur=[50 if an['name']=='gt' else (40 if an['name'] in ('hero','leaf') else (50 if an['name'].startswith('snow') else 80))]*len(seq)
            if once: dur[0]=60; dur[-1]=1800
            pal=seq[0].quantize(colors=255,method=Image.MEDIANCUT,dither=Image.Dither.NONE)
            if an['name']=='leaf':
                import numpy as np
                b0=np.asarray(seq[0]).astype(np.float32);ns=[seq[0]]
                for f in seq[1:]:
                    f=np.asarray(f).astype(np.float32);m=(np.abs(f-b0).sum(2)>18)
                    b0=np.where(m[...,None],f,b0);ns.append(Image.fromarray(b0.astype('uint8')))
                seq=ns
            if an['name']=='hero':  # nahtlose Schleife: Ende blendet in den Anfang, kein Ruck
                import numpy as np
                F=[np.asarray(f).astype(np.float32) for f in seq]; Lh=len(F)//2
                cf=[F[k+Lh]*(1-k/Lh)+F[k]*(k/Lh) for k in range(Lh)]
                b0=cf[0];ns=[Image.fromarray(b0.astype('uint8'))]
                for f in cf[1:]:
                    m=(np.abs(f-b0).sum(2)>12)
                    b0=np.where(m[...,None],f,b0)          # Aenderungen bleiben stehen: kein Flackern, keine Stufen
                    ns.append(Image.fromarray(b0.astype('uint8')))
                seq=ns
            dz=Image.Dither.NONE
            q=[s.quantize(palette=pal,dither=dz) for s in seq]
            fn=f'n{n:03d}.gif'; q[0].save('mail/_t.gif',save_all=True,append_images=q[1:],duration=dur,loop=0,disposal=1)
            subprocess.run(['gifsicle','-O3','--lossy='+('0' if an['name'].startswith('snow') else ('60' if an['name']=='leaf' else ('80' if an['name']=='hero' else '85'))),'-o','mail/'+fn,'mail/_t.gif'],check=True); os.remove('mail/_t.gif')
        else:
            fn=f'n{n:03d}.jpg'; st.crop((x0*2,y0*2,x1*2,y1*2)).save('mail/'+fn,quality=70,subsampling=0,optimize=True,progressive=True)
        cells.append(dict(x0=x0,x1=x1,fn=fn,href=ln['href'] if ln else None,alt=(ln['txt'] if ln else '')))
    rows.append(dict(y0=y0,y1=y1,cells=cells))
json.dump(rows,open('out/rows.json','w'),indent=0)
print('Zeilen',len(rows),'Bilder',n)

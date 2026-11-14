import sys
from PIL import Image,ImageDraw,ImageFilter
import numpy as np
S=sys.argv[1];O=sys.argv[2]  # Aufruf: python3 tools/bus_bearbeiten.py img/quelle/isy-bus-original.webp img  (Räder-Scheiben bleiben unverändert)
im=Image.open(S).convert('RGBA');a=np.asarray(im).astype(np.float32)
H,W=a.shape[:2];yy,xx=np.mgrid[0:H,0:W]
lum=a[...,:3]@np.array([.299,.587,.114])
win=(yy>=31)&(yy<=146)&(xx>=20)&(xx<=958)&~((xx>=888)&(yy>=116))
win|=(yy>146)&(yy<=168)&(xx>=22)&(xx<=88)
qnv=(xx>=478)&(xx<=538)&(yy>=32)&(yy<=58)&(lum>140)
# weiche Maske
wm=np.asarray(Image.fromarray((win*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.7))).astype(np.float32)/255
wm=np.where(qnv,0,wm)
# Original im Fenster: außerhalb dunkel füllen (kein Weiß-Bluten), stark weichzeichnen
src=a[...,:3].copy();src[~win]=np.array([16,18,24])
bl=np.asarray(Image.fromarray(src.clip(0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(11))).astype(np.float32)
L=bl@np.array([.299,.587,.114])
t=np.clip((yy-31)/115.0,0,1)
base=np.array([13,16,22],np.float32)
glass=base+ (L/255.0)[...,None]*np.array([34,40,50])
# Himmelsspiegelung oben, nach unten auslaufend
tg=np.clip((yy-60)/86.0,0,1)
sky=np.clip(1-tg/0.6,0,1)**1.5
glass+=(sky*(yy>=60))[...,None]*np.array([40,47,60])
# dunkles Band über den Scheiben (Siebdruck-Rand wie beim Original)
frit=np.clip((60-yy)/3.0,0,1)
glass=glass*(1-0.45*frit[...,None])
# zwei breite, sehr weiche Lichtreflexe (nicht wiederholt)
for cx,amp in [(250,22),(700,18)]:
    d=(xx-cx)+(yy-88)*0.9
    glass+=(np.exp(-d**2/(2*70**2))*amp*(1-t*0.6))[...,None]*np.array([1,1.05,1.15])
# Rahmen: weiche Stege mit feiner Lichtkante
P=[(21,24),(146,152),(299,304),(339,348),(441,467),(545,572),(640,653),(767,780),(850,875)]
fr=np.zeros((H,W),np.float32)
for x0,x1 in P: fr=np.maximum(fr,((xx>=x0)&(xx<=x1)).astype(np.float32))
# obere Kante des Fensterbandes (Dachrand) als Rahmen
fr=np.maximum(fr,((yy>=31)&(yy<=33)).astype(np.float32))
fr=np.maximum(fr,((yy>=58)&(yy<=59)).astype(np.float32)*0.8)
frs=np.asarray(Image.fromarray((fr*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.6))).astype(np.float32)/255
# Innenschatten am Rahmen
sh=np.asarray(Image.fromarray((fr*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3.5))).astype(np.float32)/255
glass*= (1-0.35*sh)[...,None]
frame=np.array([11,12,15],np.float32)
g=glass*(1-frs[...,None])+frame*frs[...,None]
# feine Lichtkante rechts am Steg
for x0,x1 in P:
    e=(xx==x1+1)
    g=np.where(e[...,None],g*0.7+np.array([70,76,88])*0.3,g)
a[...,:3]=a[...,:3]*(1-wm[...,None])+g*wm[...,None]
for cx in (224,708.5):
    m=(yy>=229)&(np.abs(xx-cx)<=60)
    a[...,3]=np.where(m,0,a[...,3])
Image.fromarray(a.clip(0,255).astype(np.uint8)).save(O+'/isy-bus.webp',quality=92)
print('ok')

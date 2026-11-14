import sys
from PIL import Image,ImageDraw,ImageFilter
import numpy as np
S=sys.argv[1];O=sys.argv[2]
im=Image.open(S).convert('RGBA');a=np.asarray(im).astype(np.float32)
H,W=a.shape[:2];yy,xx=np.mgrid[0:H,0:W]
lum=a[...,:3]@np.array([.299,.587,.114])
# Fensterbereich
win=(yy>=31)&(yy<=146)&(xx>=20)&(xx<=958)&~((xx>=888)&(yy>=116))
qnv=(xx>=478)&(xx<=538)&(yy>=32)&(yy<=58)&(lum>140)
win|=(yy>146)&(yy<=168)&(xx>=22)&(xx<=88)
win&=~qnv
# getöntes Glas: dunkles Blau-Anthrazit, Spiegelstreifen diagonal
t=(yy-31)/115.0
gl=np.stack([14+10*t,18+12*t,30+14*t],-1)
ref=np.clip(1-np.abs(((xx*0.55+yy)%260)-130)/38,0,1)*0.0
band=np.exp(-((xx+yy*1.4-120)%330-165)**2/(2*22**2))
gl=gl+band[...,None]*np.array([38,44,58])+ (1-t)[...,None]*np.array([10,12,16])
f=np.ones_like(lum)
f=np.where(win,f,0)
fb=np.asarray(Image.fromarray((f*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.6))).astype(np.float32)/255
a[...,:3]=a[...,:3]*(1-fb[...,None])+gl*fb[...,None]
# Fensterrahmen (aus dem Originalfoto gemessen)
for x0,x1 in [(21,24),(146,152),(299,304),(339,348),(441,467),(545,572),(640,653),(767,780),(850,875)]:
    m=win&(xx>=x0)&(xx<=x1)
    a[...,:3]=np.where(m[...,None],np.array([10,11,15],np.float32),a[...,:3])
    e=win&(xx==x1+1)
    a[...,:3]=np.where(e[...,None],a[...,:3]*0.6+np.array([60,66,80])*0.4,a[...,:3])
# Reifen-Bereich unterhalb der Schwelle leeren (Räder kommen als runde Scheiben drüber)
for cx in (224,708.5):
    m=(yy>=229)&(np.abs(xx-cx)<=60)
    a[...,3]=np.where(m,0,a[...,3])
Image.fromarray(a.clip(0,255).astype(np.uint8)).save(O+'/isy-bus.webp',quality=90)
# Räder: Reifenring + Felge aus dem Foto
src=Image.open(S).convert('RGBA');K=4;R=37;RF=26
for n,(cx,cy) in [('f',(224,215)),('r',(708.5,215))]:
    D=2*R*K;w=Image.new('RGBA',(D,D),(0,0,0,0));d=ImageDraw.Draw(w)
    d.ellipse((0,0,D-1,D-1),fill=(22,22,24,255))
    for i,c in enumerate([(30,30,33),(26,26,29)]):
        p=int((4+i*10)*K/4*1);d.ellipse((p,p,D-1-p,D-1-p),outline=c+(255,),width=K)
    # Profilrillen
    import math
    for k in range(36):
        ang=k*math.pi/18;r1=R*K-2;r2=R*K-3*K
        d.line((D/2+r1*math.cos(ang),D/2+r1*math.sin(ang),D/2+r2*math.cos(ang),D/2+r2*math.sin(ang)),fill=(40,40,44,255),width=K)
    c=src.crop((round(cx-RF),round(cy-RF),round(cx+RF),round(cy+RF))).resize((2*RF*K,2*RF*K),Image.LANCZOS)
    m=Image.new('L',c.size,0);ImageDraw.Draw(m).ellipse((K,K,c.size[0]-K,c.size[1]-K),fill=255);m=m.filter(ImageFilter.GaussianBlur(K*1.2))
    c.putalpha(m);o=(D-c.size[0])//2;w.alpha_composite(c,(o,o))
    mm=Image.new('L',(D,D),0);ImageDraw.Draw(mm).ellipse((1,1,D-2,D-2),fill=255);mm=mm.filter(ImageFilter.GaussianBlur(1.5))
    w.putalpha(Image.fromarray(np.minimum(np.asarray(w.split()[3]),np.asarray(mm))))
    w.resize((2*R*2,2*R*2),Image.LANCZOS).save(O+'/isy-bus-rad-%s.webp'%n,quality=90)
print('ok')

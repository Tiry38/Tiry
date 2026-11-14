# i:SY Werbe-Bus: hochauflösend, glatte Kanten, getönte Fenster, Räder als drehende Scheiben
# Aufruf: python3 tools/bus_bearbeiten.py img/quelle/isy-bus-original.webp img
import sys,math
from PIL import Image,ImageDraw,ImageFilter
import numpy as np
SRC=sys.argv[1];O=sys.argv[2];K=3
o=Image.open(SRC).convert('RGBA');W0,H0=o.size;W,H=W0*K,H0*K
# 1) Hochrechnen mit vormultipliziertem Alpha (keine hellen Säume)
p=np.asarray(o).astype(np.float32);al=p[...,3:4]/255
pm=np.concatenate([p[...,:3]*al,p[...,3:4]],-1)
up=np.stack([np.asarray(Image.fromarray(pm[...,c].clip(0,255).astype(np.uint8)).resize((W,H),Image.LANCZOS)).astype(np.float32) for c in range(4)],-1)
A=up[...,3]/255
# 2) Außenkante glätten: weichzeichnen + weiche Schwelle = saubere Kantenglättung statt Treppen
Ab=np.asarray(Image.fromarray((A*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))).astype(np.float32)/255
t=np.clip((Ab-0.32)/0.36,0,1);Anew=t*t*(3-2*t)
rgb=up[...,:3]/np.maximum(A[...,None],1e-3)
# Farbe an der Kante aus dem Inneren nachziehen (verhindert dunkle/helle Ränder)
fill=np.asarray(Image.fromarray(np.clip(up[...,:3],0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32)
fa=np.asarray(Image.fromarray((A*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32)/255
rgb=np.where((A<0.6)[...,None],fill/np.maximum(fa[...,None],1e-3),rgb)
a=np.dstack([np.clip(rgb,0,255),Anew*255])
yy,xx=np.mgrid[0:H,0:W].astype(np.float32);yy/=K;xx/=K    # Koordinaten in Original-Pixeln
lum=a[...,:3]@np.array([.299,.587,.114])
def mask(draw_fn,blur=0.6):
    m=Image.new('L',(W*2,H*2),0);d=ImageDraw.Draw(m);draw_fn(d,2*K);m=m.resize((W,H),Image.LANCZOS)
    return np.asarray(m.filter(ImageFilter.GaussianBlur(blur))).astype(np.float32)/255
def P(pts,s):return [(x*s,y*s) for x,y in pts]
def glass_shape(d,s):
    d.rectangle(P([(96,31),(958,146)],s),fill=255)
    d.polygon(P([(887,129.5),(962,116.5),(962,152),(887,152)],s),fill=0)
    d.rectangle(P([(36,31),(97,62)],s),fill=255)
    d.polygon(P([(40,62),(97,62),(97,146),(88,150),(62,168),(40,168)],s),fill=255)
    d.polygon(P([(19,62),(36,62),(36,170),(19,165)],s),fill=255)
    d.polygon(P([(30,80),(32,66),(46,66),(47,100),(33,102)],s),fill=0)
wm=mask(glass_shape)*(a[...,3]/255)
qnv=(xx>=478)&(xx<=538)&(yy>=32)&(yy<=58)
wm=np.where(qnv&(lum>120),0,wm)
wm=np.where(qnv,np.minimum(wm,np.clip((150-lum)/40,0,1)),wm)
# Glas aus dem Original: stark weich, dunkel getönt
src=a[...,:3].copy();src[wm<0.5]=np.array([16,18,24])
bl=np.asarray(Image.fromarray(src.clip(0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(11*K))).astype(np.float32)
L=bl@np.array([.299,.587,.114])
glass=np.array([13,16,22],np.float32)+(L/255.0)[...,None]*np.array([34,40,50])
tg=np.clip((yy-60)/86.0,0,1);sky=np.clip(1-tg/0.6,0,1)**1.5
glass+=(sky*(yy>=60))[...,None]*np.array([40,47,60])
frit=np.clip((60-yy)/3.0,0,1);glass*=(1-0.45*frit)[...,None]
tt=np.clip((yy-31)/115.0,0,1)
for cx,amp in [(250,22),(700,18)]:
    dd=(xx-cx)+(yy-88)*0.9
    glass+=(np.exp(-dd**2/(2*70**2))*amp*(1-tt*0.6))[...,None]*np.array([1,1.05,1.15])
PIL_=[(36,39),(91,96),(146,152),(299,304),(339,348),(441,467),(545,572),(640,653),(767,780),(850,875)]
def frames(d,s):
    for x0,x1 in PIL_: d.rectangle(P([(x0,31),(x1+1,170)],s),fill=255)
    d.rectangle(P([(19,31),(961,33)],s),fill=255)
    d.rectangle(P([(36,58),(961,59.6)],s),fill=200)
frs=mask(frames,0.5)
sh=np.asarray(Image.fromarray((frs*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3.5*K))).astype(np.float32)/255
glass*=(1-0.35*sh)[...,None]
g=glass*(1-frs[...,None])+np.array([11,12,15],np.float32)*frs[...,None]
a[...,:3]=a[...,:3]*(1-wm[...,None])+g*wm[...,None]
# Reifenbereich unter der Schwelle weich ausblenden (Räder kommen als Scheiben)
for cx in (224,708.5):
    def rr(d,s,cx=cx): d.rectangle(P([(cx-60,229),(cx+60,H0+2)],s),fill=255)
    m=mask(rr,1.0);a[...,3]*=(1-m)
Image.fromarray(a.clip(0,255).astype(np.uint8)).save(O+'/isy-bus.webp',quality=90,method=6)
# Räder: Reifen gezeichnet, Felge aus dem Foto (hochgerechnet), glatter Rand
R=37;RF=26;Q=4*K
for n,(cx,cy) in [('f',(224,215)),('r',(708.5,215))]:
    D=2*R*Q;w=Image.new('RGBA',(D,D),(0,0,0,0));d=ImageDraw.Draw(w)
    d.ellipse((0,0,D-1,D-1),fill=(22,22,24,255))
    for i,c in enumerate([(30,30,33),(26,26,29)]):
        pp=int((4+i*10)*Q/4);d.ellipse((pp,pp,D-1-pp,D-1-pp),outline=c+(255,),width=Q)
    c=o.crop((round(cx-RF),round(cy-RF),round(cx+RF),round(cy+RF))).resize((2*RF*Q,2*RF*Q),Image.LANCZOS)
    m=Image.new('L',c.size,0);ImageDraw.Draw(m).ellipse((Q,Q,c.size[0]-Q,c.size[1]-Q),fill=255);m=m.filter(ImageFilter.GaussianBlur(Q*1.2))
    c.putalpha(m);off=(D-c.size[0])//2;w.alpha_composite(c,(off,off))
    w=w.resize((2*R*K,2*R*K),Image.LANCZOS)
    mm=Image.new('L',(2*R*K*4,2*R*K*4),0);ImageDraw.Draw(mm).ellipse((2,2,2*R*K*4-3,2*R*K*4-3),fill=255);mm=mm.resize((2*R*K,2*R*K),Image.LANCZOS)
    w.putalpha(Image.fromarray(np.minimum(np.asarray(w.split()[3]),np.asarray(mm))))
    w.save(O+'/isy-bus-rad-%s.webp'%n,quality=90,method=6)
print('ok',W,H)

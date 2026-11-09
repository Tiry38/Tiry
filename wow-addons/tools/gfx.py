import numpy as np, math
import os as _os
BASE=_os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),".."))+"/"  # = wow-addons/
from PIL import Image, ImageDraw, ImageFilter
OUT=BASE+"addons/LevelPilot/Media/"
NEON=(57,255,107); TEAL=(38,242,217)
def save(img,name): img.save(OUT+name+".tga")
def ss(size,f):  # Supersampling: zeichnen in 8x, herunterrechnen
    S=8; big=Image.new("RGBA",(size*S,size*S) if isinstance(size,int) else (size[0]*S,size[1]*S),(0,0,0,0))
    d=ImageDraw.Draw(big); f(d,S,big); 
    return big.resize((size,size) if isinstance(size,int) else size, Image.LANCZOS)
W=(255,255,255,255)
# ---------------- Symbole (weiss, wird im Spiel eingefaerbt) ----------------
def ic_scroll(d,S,mark):
    s=S
    d.rounded_rectangle([14*s,10*s,46*s,54*s],radius=5*s,outline=W,width=4*s)
    d.rounded_rectangle([10*s,8*s,50*s,15*s],radius=3*s,fill=W)
    d.rounded_rectangle([10*s,50*s,50*s,57*s],radius=3*s,fill=W)
    if mark=="plus":
        d.rounded_rectangle([28*s,21*s,32*s,45*s],radius=2*s,fill=W); d.rounded_rectangle([18*s,31*s,42*s,35*s],radius=2*s,fill=W)
    else:
        d.line([20*s,34*s,27*s,41*s,41*s,24*s],fill=W,width=5*s,joint="curve")
def ic_swords(d,S,_):
    s=S
    for flip in (1,-1):
        x0,x1=(14,50) if flip==1 else (50,14)
        d.line([x0*s,50*s,x1*s,12*s],fill=W,width=5*s)
        gx=(22 if flip==1 else 42)*s; d.line([gx-7*s,40*s,gx+7*s,46*s] if flip==1 else [gx-7*s,46*s,gx+7*s,40*s],fill=W,width=5*s)
def ic_wing(d,S,_):
    s=S
    pts=[(8,44),(18,22),(34,10),(56,8),(46,18),(54,20),(42,28),(50,32),(36,38),(42,44),(22,46)]
    d.polygon([(x*s,y*s) for x,y in pts],fill=W)
def ic_house(d,S,_):
    s=S
    d.polygon([(32*s,8*s),(58*s,30*s),(52*s,30*s),(52*s,56*s),(12*s,56*s),(12*s,30*s),(6*s,30*s)],fill=W)
    d.rounded_rectangle([26*s,38*s,38*s,56*s],radius=3*s,fill=(0,0,0,0))
    d.ellipse([27*s,20*s,37*s,30*s],fill=(0,0,0,0))
def ic_pin(d,S,_):
    s=S
    d.ellipse([16*s,6*s,48*s,38*s],fill=W); d.polygon([(18*s,28*s),(46*s,28*s),(32*s,58*s)],fill=W)
    d.ellipse([25*s,15*s,39*s,29*s],fill=(0,0,0,0))
def ic_book(d,S,_):
    s=S
    d.polygon([(6*s,14*s),(30*s,18*s),(30*s,56*s),(6*s,50*s)],fill=W); d.polygon([(58*s,14*s),(34*s,18*s),(34*s,56*s),(58*s,50*s)],fill=W)
    for y in (26,34,42): d.line([12*s,y*s,26*s,(y+2)*s],fill=(0,0,0,0),width=2*s); d.line([38*s,(y+2)*s,52*s,y*s],fill=(0,0,0,0),width=2*s)
def ic_sword(d,S,_):
    s=S
    d.polygon([(32*s,4*s),(37*s,12*s),(37*s,40*s),(27*s,40*s),(27*s,12*s)],fill=W)
    d.rounded_rectangle([16*s,40*s,48*s,45*s],radius=2*s,fill=W); d.rounded_rectangle([29*s,45*s,35*s,56*s],radius=2*s,fill=W); d.ellipse([27*s,54*s,37*s,62*s],fill=W)
def ic_info(d,S,_):
    s=S
    d.ellipse([6*s,6*s,58*s,58*s],outline=W,width=5*s); d.ellipse([28*s,15*s,36*s,23*s],fill=W); d.rounded_rectangle([28*s,27*s,36*s,48*s],radius=3*s,fill=W)
def ic_bolt(d,S,_):
    s=S
    d.polygon([(36*s,4*s),(12*s,36*s),(30*s,36*s),(24*s,60*s),(52*s,24*s),(34*s,24*s),(42*s,4*s)],fill=W)
def ic_target(d,S,_):
    s=S
    for r,w in ((26,4),(16,4)): d.ellipse([(32-r)*s,(32-r)*s,(32+r)*s,(32+r)*s],outline=W,width=w*s)
    d.ellipse([27*s,27*s,37*s,37*s],fill=W)
def ic_hourglass(d,S,_):
    s=S
    d.rounded_rectangle([12*s,6*s,52*s,11*s],radius=2*s,fill=W); d.rounded_rectangle([12*s,53*s,52*s,58*s],radius=2*s,fill=W)
    d.polygon([(16*s,11*s),(48*s,11*s),(34*s,32*s),(48*s,53*s),(16*s,53*s),(30*s,32*s)],outline=W,width=4*s)
    d.polygon([(22*s,48*s),(42*s,48*s),(32*s,38*s)],fill=W)
def ic_map(d,S,_):
    s=S
    d.polygon([(6*s,14*s),(22*s,8*s),(42*s,16*s),(58*s,10*s),(58*s,50*s),(42*s,56*s),(22*s,48*s),(6*s,54*s)],outline=W,width=4*s)
    d.line([22*s,8*s,22*s,48*s],fill=W,width=3*s); d.line([42*s,16*s,42*s,56*s],fill=W,width=3*s)
def ic_nav(d,S,_):
    s=S
    d.polygon([(32*s,6*s),(54*s,56*s),(32*s,44*s),(10*s,56*s)],fill=W)
def ic_loop(d,S,_):
    s=S
    d.arc([10*s,10*s,54*s,54*s],start=200,end=520,fill=W,width=6*s)
    d.polygon([(10*s,14*s),(26*s,14*s),(14*s,28*s)],fill=W)
ICONS={"i_accept":(ic_scroll,"plus"),"i_turnin":(ic_scroll,"check"),"i_complete":(ic_swords,None),"i_fly":(ic_wing,None),
 "i_hearth":(ic_house,None),"i_go":(ic_pin,None),"i_train":(ic_book,None),"i_grind":(ic_sword,None),"i_note":(ic_info,None),
 "i_xph":(ic_bolt,None),"i_need":(ic_target,None),"i_time":(ic_hourglass,None),"i_route":(ic_map,None),"i_arrow":(ic_nav,None),"i_auto":(ic_loop,None)}
for n,(f,a) in ICONS.items(): save(ss(64,lambda d,S,b,f=f,a=a: f(d,S,a)),n)

# ---------------- Flaechen ----------------
def grad_img(w,h,c1,c2,diag=True,alpha=1.0):
    y,x=np.mgrid[0:h,0:w]; t=((x/w+y/h)/2) if diag else (y/h)
    arr=np.zeros((h,w,4)); 
    for k in range(3): arr[...,k]=c1[k]+(c2[k]-c1[k])*t
    arr[...,3]=255*alpha; return arr
def rounded_mask(w,h,r,S=8):
    m=Image.new("L",(w*S,h*S),0); ImageDraw.Draw(m).rounded_rectangle([0,0,w*S-1,h*S-1],radius=r*S,fill=255)
    return np.asarray(m.resize((w,h),Image.LANCZOS))/255.0
def to_img(arr): return Image.fromarray(np.clip(arr,0,255).astype(np.uint8),"RGBA")
# Panel: Glas mit Verlauf, feiner Verlaufsrand, Glanz oben
P=128; R=26
body=grad_img(P,P,(9,22,18),(13,14,24),alpha=0.96)
m_out=rounded_mask(P,P,R); m_in=np.pad(rounded_mask(P-4,P-4,R-2),2)
edge=grad_img(P,P,NEON,TEAL)
y=np.mgrid[0:P,0:P][0]
sheen=np.clip(1-y/34,0,1)**2*0.10
arr=body.copy()
for k in range(3): arr[...,k]=arr[...,k]*(1-sheen)+255*sheen
ring=np.clip(m_out-m_in,0,1)
for k in range(3): arr[...,k]=arr[...,k]*(1-ring)+edge[...,k]*ring
arr[...,3]=np.where(ring>0, 255*ring*0.75+arr[...,3]*m_in*(1-ring), arr[...,3]*m_in)
save(to_img(arr),"panel")
# Weiches Leuchten um das Panel (wird mit Rand 48 gestreckt)
g=Image.new("L",(256,256),0); ImageDraw.Draw(g).rounded_rectangle([48,48,207,207],radius=30,fill=255); g=g.filter(ImageFilter.GaussianBlur(16))
ga=np.asarray(g)/255.0; garr=np.zeros((256,256,4)); garr[...,0:3]=255; garr[...,3]=ga*255
save(to_img(garr),"glow")
# Karten (weiss, einfaerbbar)
for name,(sz,r) in {"card":(64,14),"card_s":(32,8)}.items():
    mm=rounded_mask(sz,sz,r); a=np.zeros((sz,sz,4)); a[...,0:3]=255; a[...,3]=mm*255; save(to_img(a),name)
# Orb-Abzeichen: Kugel mit Glanz
O=64; yy,xx=np.mgrid[0:O,0:O]; cx=cy=31.5
rr=np.hypot(xx-cx,yy-cy)/31.5
disc=np.clip((1-rr)*32,0,1)
shade=0.78+0.22*(1-np.clip(rr,0,1)) 
hl=np.exp(-((xx-cx)**2/(2*14**2)+(yy-18)**2/(2*7**2)))*0.45
a=np.zeros((O,O,4)); 
for k in range(3): a[...,k]=255*np.clip(shade+hl,0,1)
a[...,3]=disc*255; save(to_img(a),"orb")
# Weicher Punkt
D=32; yy,xx=np.mgrid[0:D,0:D]; rr=np.hypot(xx-15.5,yy-15.5)
a=np.zeros((D,D,4)); a[...,0:3]=255; a[...,3]=np.exp(-(rr**2)/(2*5.5**2))*255; save(to_img(a),"dot")

# ---------------- Kompass + Pfeil ----------------
C=256; yy,xx=np.mgrid[0:C,0:C]; cx=cy=127.5; rr=np.hypot(xx-cx,yy-cy); ang=np.arctan2(xx-cx,-(yy-cy))
a=np.zeros((C,C,4))
glass=np.clip((118-rr)*0.5,0,1)
base=np.zeros((C,C,3)); 
tcol=(rr/118)
for k,(c1,c2) in enumerate(zip((10,14,14),(18,26,30))): base[...,k]=c1+(c2-c1)*tcol
ringm=np.exp(-((rr-112)**2)/(2*2.2**2))
vy=(yy/C)
ringc=np.zeros((C,C,3))
for k in range(3): ringc[...,k]=NEON[k]+(TEAL[k]-NEON[k])*vy
ticks=np.zeros((C,C))
for i in range(72):
    th=i*2*math.pi/72; major=(i%18==0); mid=(i%6==0)
    L= 18 if major else (11 if mid else 6); wdt=2.4 if major else (1.6 if mid else 1.1)
    d_ang=np.abs(np.angle(np.exp(1j*(ang-th))))*rr
    m=(d_ang<wdt)&(rr<106)&(rr>106-L); ticks=np.maximum(ticks,m*(1.0 if major else (0.7 if mid else 0.45)))
north=((np.abs(np.angle(np.exp(1j*ang)))*rr<7-(106-rr)*0.0)&(rr>84)&(rr<100)&(np.abs(np.angle(np.exp(1j*ang)))*rr< (rr-84)*0.45+0.5))
inner=np.exp(-((rr-60)**2)/(2*30**2))*0.06
out=base.copy()
for k in range(3):
    out[...,k]=out[...,k]+255*inner
    out[...,k]=out[...,k]*(1-ringm)+ringc[...,k]*ringm
    out[...,k]=out[...,k]*(1-ticks*0.9)+ (200+55*0)*ticks*0.9
    out[...,k]=np.where(north, NEON[k], out[...,k])
a[...,0:3]=out; a[...,3]=np.clip(glass*235+ringm*255,0,255)
save(to_img(a),"compass")
def arrow(d,S,_):
    s=S
    pts=[(64,17),(100,111),(64,91),(28,111)]
    d.polygon([(x*s,y*s) for x,y in pts],fill=W)
ar=ss(128,arrow); arr=np.asarray(ar).astype(float)
yy=np.mgrid[0:128,0:128][0]/128.0
for k in range(3): arr[...,k]=(NEON[k]*(1-yy)+TEAL[k]*yy)
hl=np.zeros((128,128)); 
xx=np.mgrid[0:128,0:128][1]
hl=np.exp(-((xx-64)**2)/(2*3**2))*np.clip(1-yy*1.3,0,1)*0.55
for k in range(3): arr[...,k]=arr[...,k]*(1-hl)+255*hl
save(to_img(arr),"arrow")
gl=ar.filter(ImageFilter.GaussianBlur(7)); ga=np.asarray(gl).astype(float); ga[...,0:3]=255; save(to_img(ga),"arrow_glow")

# ---------------- Strahl ----------------
def beam(w,h,sig,name,fadepow=1.6):
    yy,xx=np.mgrid[0:h,0:w]; prof=np.exp(-((xx-(w-1)/2)**2)/(2*sig**2))
    v=(yy/h)  # 0 = oben, 1 = unten
    fade=np.clip(v,0,1)**fadepow
    a=np.zeros((h,w,4)); a[...,0:3]=255; a[...,3]=prof*fade*255; save(to_img(a),name)
beam(64,512,3.2,"beam_core",1.2); beam(128,512,20,"beam_glow",1.8)
# fliessende Energie-Schlieren (vertikal kachelbar)
rng=np.random.default_rng(3); Wf,Hf=64,256
yy,xx=np.mgrid[0:Hf,0:Wf]; streak=np.zeros((Hf,Wf))
for i in range(14):
    x0=rng.uniform(16,48); wdt=rng.uniform(1.2,3.5); f=rng.integers(1,4); ph=rng.uniform(0,2*np.pi)
    xs=x0+3*np.sin(2*np.pi*(yy/Hf)*f+ph)
    inten=(0.5+0.5*np.sin(2*np.pi*(yy/Hf)*rng.integers(1,3)+ph*1.7))**3
    streak+=np.exp(-((xx-xs)**2)/(2*wdt**2))*inten*rng.uniform(0.4,1)
streak/=streak.max(); env=np.exp(-((xx-31.5)**2)/(2*12**2))
a=np.zeros((Hf,Wf,4)); a[...,0:3]=255; a[...,3]=np.clip(streak*env*1.3,0,1)*255; save(to_img(a),"flow")
# Schockwellen-Ring + Lichtreflex
Rg=256; yy,xx=np.mgrid[0:Rg,0:Rg]; rr=np.hypot(xx-127.5,yy-127.5)
a=np.zeros((Rg,Rg,4)); a[...,0:3]=255; a[...,3]=np.clip(np.exp(-((rr-100)**2)/(2*6**2))+np.exp(-((rr-100)**2)/(2*22**2))*0.35,0,1)*255; save(to_img(a),"ring")
F=128; yy,xx=np.mgrid[0:F,0:F]; dx,dy=xx-63.5,yy-63.5; rr=np.hypot(dx,dy)
core=np.exp(-(rr**2)/(2*9**2)); halo=np.exp(-(rr**2)/(2*26**2))*0.45
rayh=np.exp(-(dy**2)/(2*1.6**2))*np.exp(-np.abs(dx)/34)*0.9; rayv=np.exp(-(dx**2)/(2*1.4**2))*np.exp(-np.abs(dy)/22)*0.6
a=np.zeros((F,F,4)); a[...,0:3]=255; a[...,3]=np.clip(core+halo+rayh+rayv,0,1)*255; save(to_img(a),"flare")
print("Grafiken ok")

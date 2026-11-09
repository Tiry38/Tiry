# Strahl nach Waypoint-UI-Art: schlanke Lichtsaeule, weicher Schein, Kontext-Symbol im Ring.
# Alle Texturen weiss (Farbe kommt im Spiel per Vertex-Farbe).
import numpy as np, math
from PIL import Image, ImageDraw, ImageFilter
import os as _os
SP=_os.path.abspath(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)),".."))+"/"  # = wow-addons/
OUT=SP+"addons/LevelPilot/Media/"
def save(a,name):
    img=Image.fromarray(np.clip(a*255,0,255).astype(np.uint8),"RGBA"); img.save(OUT+name+".tga"); return img
def rgba(alpha):
    a=np.zeros(alpha.shape+(4,)); a[...,0:3]=1; a[...,3]=np.clip(alpha,0,1); return a
def vfade(h, top_pow, base_ramp=0.025):
    y=np.linspace(0,1,h)[:,None]          # 0 = oben, 1 = unten
    up=1-y                                  # Hoehe ueber Grund (1 = Grund)
    f=(1-up)**top_pow                       # zum Himmel hin weich auslaufen
    ramp=np.clip((1-y)/base_ramp,0,1)       # unten minimal weich
    return f*ramp
def hprof(w, sig):
    x=np.linspace(-w/2+0.5,w/2-0.5,w)[None,:]
    return np.exp(-x**2/(2*sig**2))
H=512
core=(0.75*hprof(32,2.4)+0.25*hprof(32,5.5))*vfade(H,1.25)                       # gleissende Mittellinie
save(rgba(core),"wb_core")
glow=(0.55*hprof(128,9)+0.45*hprof(128,24))*vfade(H,1.55)   # weicher Schein
save(rgba(glow),"wb_glow")
# wandernder Lichtpuls (sehr dezent)
y=np.linspace(-1,1,128)[:,None]; x=np.linspace(-1,1,64)[None,:]
shine=np.exp(-(y**2)/(2*0.28**2))*np.exp(-(x**2)/(2*0.22**2))
save(rgba(shine),"wb_shine")
# Bodenschein (flache Ellipse)
y=np.linspace(-1,1,64)[:,None]; x=np.linspace(-1,1,256)[None,:]
r=np.sqrt(x**2+y**2)
base=np.exp(-(r**2)/(2*0.33**2))
save(rgba(base),"wb_base")
# Kontext-Ring: Leuchtkante + weicher Halo (128px)
S=128; c=(S-1)/2
yy,xx=np.mgrid[0:S,0:S]; rr=np.sqrt((xx-c)**2+(yy-c)**2)
R0=44
rim=np.exp(-((rr-R0)**2)/(2*1.25**2))
halo=np.exp(-((rr-R0)**2)/(2*7.0**2))*0.55
save(rgba(np.clip(rim+halo,0,1)),"ctx_ring")
# Kontext-Scheibe (gefuellt, weiche Kante) -> wird dunkel eingefaerbt
disc=np.clip((R0-0.5-rr)/1.6,0,1)
save(rgba(disc),"ctx_disc")
# innerer Glanz (oben heller)
gl=disc*np.clip(1-(yy/(S*0.9)),0,1)**2*0.5
save(rgba(gl),"ctx_gloss")
# Fortschritts-Bogen-Segmente nicht noetig.
print("Texturen geschrieben")

# ---------- Vorschau ----------
BGF=SP+"previews/hintergrund.webp"
if not _os.path.exists(BGF): print("Vorschau uebersprungen (previews/hintergrund.webp fehlt)"); raise SystemExit
bg=Image.open(BGF).convert("RGB")
bg=bg.crop((690,120,1070,780)).resize((570,990),Image.LANCZOS)
B=np.asarray(bg).astype(float)/255
def add(B,tex,cx,by,w,h,col,alpha,anchor="bottom"):
    t=np.asarray(Image.open(OUT+tex+".tga").convert("RGBA").resize((int(w),int(h)),Image.LANCZOS)).astype(float)/255
    a=t[...,3:4]*alpha
    x0=int(cx-w/2); y0=int(by-h) if anchor=="bottom" else int(by-h/2)
    H_,W_=B.shape[:2]
    xs,ys=max(0,x0),max(0,y0); xe,ye=min(W_,x0+int(w)),min(H_,y0+int(h))
    sub=t[ys-y0:ye-y0, xs-x0:xe-x0]; aa=a[ys-y0:ye-y0, xs-x0:xe-x0]
    B[ys:ye,xs:xe]=np.clip(B[ys:ye,xs:xe]+sub[...,:3]*np.array(col)*aa,0,1)
def blend(B,tex,cx,cy,w,h,col,alpha):
    t=np.asarray(Image.open(OUT+tex+".tga").convert("RGBA").resize((int(w),int(h)),Image.LANCZOS)).astype(float)/255
    a=t[...,3:4]*alpha; x0=int(cx-w/2); y0=int(cy-h/2)
    B[y0:y0+int(h),x0:x0+int(w)]=B[y0:y0+int(h),x0:x0+int(w)]*(1-a)+np.array(col)*a
NEON=(0.22,1.0,0.42); MINT=(0.80,1.0,0.88)
gx,gy=300,760   # Bodenpunkt
sc=1.0
add(B,"wb_base",gx,gy+18,230*sc,58*sc,NEON,0.55)
add(B,"wb_glow",gx,gy,150*sc,640*sc,NEON,0.75)
add(B,"wb_core",gx,gy,30*sc,640*sc,MINT,1.0)
add(B,"wb_shine",gx,gy-300,40*sc,110*sc,MINT,0.30,anchor="center")
# Kontext-Symbol ueber dem Bodenpunkt
cy=gy-0
add(B,"ctx_ring",gx,cy,64,64,NEON,0.0,anchor="center")
blend(B,"ctx_disc",gx,cy,58,58,(0.03,0.05,0.045),0.88)
add(B,"ctx_gloss",gx,cy,58,58,(1,1,1),0.18,anchor="center")
add(B,"ctx_ring",gx,cy,64,64,NEON,1.0,anchor="center")
img=Image.fromarray((B*255).astype(np.uint8))
# Symbol (Fragezeichen-Ersatz: gelbes Ausrufezeichen wie Questgeber-Atlas) + Text
d=ImageDraw.Draw(img)
try:
    from PIL import ImageFont
    f1=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",22)
    f2=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",15)
    f3=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",13)
except Exception:
    f1=f2=f3=None
d.text((gx,cy+1),"!",fill=(255,214,60),font=f1,anchor="mm",stroke_width=2,stroke_fill=(40,30,0))
d.text((gx,cy+46),"249 m",fill=(235,255,240),font=f2,anchor="mm",stroke_width=2,stroke_fill=(0,0,0))
d.text((gx,cy+64),"Ruf des Wassers",fill=(150,255,180),font=f3,anchor="mm",stroke_width=2,stroke_fill=(0,0,0))
img.save(SP+"previews/Strahl_Neu_Vorschau.png")
print("Vorschau gespeichert")

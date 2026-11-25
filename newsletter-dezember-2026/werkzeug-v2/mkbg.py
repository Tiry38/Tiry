import sys, numpy as np
from PIL import Image, ImageFilter, ImageDraw
H=int(sys.argv[1]); W=640; P=820
rng=np.random.default_rng(11)
src=Image.open('a/herbst-2400.webp').convert('RGB')
cw=int(1602*W/P); x0=1205-cw//2
photo=np.asarray(src.crop((x0,0,x0+cw,1602)).resize((W,P),Image.LANCZOS)).astype(np.float32)
# Foto nach unten zunehmend vertikal verwischen (Fahrt), damit es nahtlos in die Strasse uebergeht
def vblur(a,r):
  if r<1: return a
  pad=np.concatenate([np.repeat(a[:1],r,0),a,np.repeat(a[-1:],r,0)])
  c=np.cumsum(pad,0); c=np.concatenate([np.zeros((1,)+a.shape[1:],np.float32),c])
  return (c[2*r+1:]-c[:-2*r-1])/(2*r+1)
lv=[0,6,14,28,50,80]; bl=[vblur(photo,r) for r in lv]
y0=520; res=photo.copy()
for y in range(y0,P):
  t=((y-y0)/(P-y0))**1.3*(len(lv)-1); i=int(min(t,len(lv)-2)); f=t-i
  res[y]=bl[i][y]*(1-f)+bl[i+1][y]*f
photo=res
# Asphalt aus dem Foto ableiten: Farbe + Korn
ref=photo[P-60:P-4]
mask_line=np.zeros((W,),bool); 
# Linienposition/-breite am unteren Fotorand messen (gelb: R hoch, B niedrig)
row=photo[P-12]
yel=(row[:,0]>150)&(row[:,2]<110)
xs=np.where(yel)[0]; lx0,lx1=int(xs.min()),int(xs.max()); print('Linie',lx0,lx1)
asph_cols=np.concatenate([ref[:,:lx0-20].reshape(-1,3),ref[:,lx1+20:].reshape(-1,3)])
base=np.median(asph_cols,axis=0); print('Asphalt',base)
line_col=np.median(photo[P-12:P-2,lx0+10:lx1-10].reshape(-1,3),axis=0); print('Linie Farbe',line_col)
h=H-P+200
def noise(sig,blur):
  n=rng.normal(0,1,(h,W)).astype(np.float32)
  if blur: n=np.asarray(Image.fromarray(((n*40)+128).clip(0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur))).astype(np.float32)-128; n/=max(n.std(),1e-3)
  return n*sig
g=noise(9,1.0)+noise(4,3)+noise(2.5,30)
spk=(rng.random((h,W))>.993)*rng.uniform(18,40,(h,W))
prof=photo[P-6:P].mean(0)            # Zeilenprofil am Fotorand
prof=np.asarray(Image.fromarray(prof.clip(0,255).astype(np.uint8)[None]).filter(ImageFilter.GaussianBlur(1.5)))[0].astype(np.float32)
A=np.repeat(prof[None],h,0)
st=vblur(rng.normal(0,1,(h+200,W)).astype(np.float32)[...,None],40)[100:100+h,:,0]; st=np.asarray(Image.fromarray(((st/st.std())*30+128).clip(0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.8))).astype(np.float32)-128; st/=st.std()
ramp=np.clip(np.linspace(0,1,h)/ (900/h),0,1)[:,None]
gs=st*(1.5+3.5*ramp)+noise(3,1.6)*ramp
A+=gs[...,None]
# Laub am Boden (statisch)
im=Image.fromarray(A.clip(0,255).astype(np.uint8)); d=ImageDraw.Draw(im)
cols=[(196,110,40),(170,80,30),(214,150,60),(150,60,30)]
for i in range(0):
  x=rng.uniform(0,W); y=rng.uniform(0,h); s=rng.uniform(4,9); c=cols[rng.integers(4)]; a=rng.uniform(0,6.28)
  pts=[(x+np.cos(a+t)*s*(1 if k%2==0 else .45),y+np.sin(a+t)*s*(1 if k%2==0 else .45)) for k,t in enumerate(np.linspace(0,6.28,8,endpoint=False))]
  d.polygon(pts,fill=c)
im=im.filter(ImageFilter.GaussianBlur(.5))
A=np.asarray(im).astype(np.float32)
# nach unten langsam dunkler (Abend), Raender leicht dunkler
yy=np.linspace(0,1,h)[:,None]; xx=np.abs(np.linspace(-1,1,W))[None,:]
A*= (1-.30*yy)[...,None]*(1-.18*(xx**2)*np.clip(yy*h/900,0,1))[...,None]
out=np.zeros((H,W,3),np.float32); out[:P]=photo
# Uebergang 200px
ov=6; t=np.linspace(0,1,ov)[:,None,None]; t=t*t*(3-2*t)
out[P-ov:P]=photo[P-ov:P]*(1-t)+A[:ov]*t
out[P:]=A[ov:ov+H-P]
Image.fromarray(out.clip(0,255).astype(np.uint8)).save('out/hintergrund.jpg',quality=62,subsampling=2,optimize=True,progressive=True)
end=out[-40:].reshape(-1,3).mean(0); print('Ende-Farbe #%02X%02X%02X'%tuple(int(v) for v in end))
import os; print(os.path.getsize('out/hintergrund.jpg')//1024,'KB', W,H)

import numpy as np, sys
from PIL import Image, ImageFilter, ImageEnhance
H=int(sys.argv[1]); W=1280
src=Image.open('a/herbst-2400.webp').convert('RGB')
src=ImageEnhance.Color(src).enhance(1.15)
crops=[(0,0,1000,1100),(1400,0,2400,1100),(500,0,1900,800),(0,300,900,1150),(1500,250,2400,1150),(700,100,1700,900),(200,150,1200,1000),(1300,100,2300,1000)]
END=2800   # unten: die Allee selbst (Weg fuehrt zum Laden)
seg=1500; ov=700
out=np.zeros((H,W,3),np.float32); wsum=np.zeros((H,1,1),np.float32)
def add(a,y):
  h=min(a.shape[0],H-y); w=np.ones((a.shape[0],1,1),np.float32)
  r=np.linspace(0,1,ov)[:,None,None]; r=r*r*(3-2*r)
  if y>0: w[:ov]=r
  if y+a.shape[0]<H: w[-ov:]*=r[::-1]
  out[y:y+h]+=a[:h]*w[:h]; wsum[y:y+h]+=w[:h]
y=0;k=0
while y<H-END-ov:
  blur=34 if y<5000 else 16      # unten mehr Struktur
  c=src.crop(crops[k%len(crops)]).resize((W,seg+ov),Image.LANCZOS).filter(ImageFilter.GaussianBlur(blur))
  add(np.asarray(c).astype(np.float32),y); y+=seg;k+=1
# Schluss: ganze Allee (leicht weich), oben weich eingeblendet
al=src.resize((int(1602*0),1)) if False else None
ph=src.crop((380,0,2020,1602)).resize((W,END+ov),Image.LANCZOS).filter(ImageFilter.GaussianBlur(2.5))
add(np.asarray(ph).astype(np.float32),H-END-ov)
out/=np.maximum(wsum,1e-3)
fog=np.array([236,230,222],np.float32)
yy=np.linspace(0,1,H)[:,None,None]
m=np.where(yy<(H-END-ov)/H, 0.40, np.clip(0.40-(yy-(H-END-ov)/H)*6,0.12,0.40))
out=out*(1-m)+fog*m
out+=np.random.default_rng(3).normal(0,2.0,out.shape)
Image.fromarray(out.clip(0,255).astype(np.uint8)).save('v4/bg2.jpg',quality=88)
print('ok',W,H)

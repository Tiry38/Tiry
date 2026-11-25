import numpy as np, sys
from PIL import Image, ImageFilter
H=int(sys.argv[1]); W=1280
src=Image.open('a/herbst-2400.webp').convert('RGB')
# Ausschnitte der Allee (x0,y0,x1,y1) – Laub links/rechts, Krone, Nebel
crops=[(0,0,1000,1100),(1400,0,2400,1100),(500,0,1900,800),(0,300,900,1150),(1500,250,2400,1150),(700,100,1700,900)]
seg=1500; ov=700
out=np.zeros((H,W,3),np.float32); wsum=np.zeros((H,1,1),np.float32)
y=0;k=0
while y<H:
  c=src.crop(crops[k%len(crops)]).resize((W,seg+ov),Image.LANCZOS).filter(ImageFilter.GaussianBlur(34))
  a=np.asarray(c).astype(np.float32)
  h=min(seg+ov,H-y)
  w=np.ones((seg+ov,1,1),np.float32)
  r=np.linspace(0,1,ov)[:,None,None]; r=r*r*(3-2*r)
  w[:ov]=r if y>0 else 1; w[-ov:]=w[-ov:]*r[::-1]
  out[y:y+h]+=a[:h]*w[:h]; wsum[y:y+h]+=w[:h]
  y+=seg;k+=1
out/=np.maximum(wsum,1e-3)
# Nebel: insgesamt aufhellen (hell, ruhig), leichter Verlauf
fog=np.array([236,230,222],np.float32)
yy=np.linspace(0,1,H)[:,None,None]
m=0.42+0.18*yy
out=out*(1-m)+fog*m
# feines Korn gegen Banding
out+=np.random.default_rng(3).normal(0,2.2,out.shape)
Image.fromarray(out.clip(0,255).astype(np.uint8)).save('v4/bg2.jpg',quality=88)
print('ok',W,H)

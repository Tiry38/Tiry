import sys,glob,os,subprocess
import numpy as np
from PIL import Image,ImageFilter
n=sys.argv[1];lossy=sys.argv[2];thr=int(sys.argv[3]) if len(sys.argv)>3 else 30
fs=sorted(glob.glob(f'fr/{n}/*.png'))
fr=[np.asarray(Image.open(f).convert('RGB').resize((640,600) if n in ('hero','hero30') else None or Image.open(f).size,Image.LANCZOS)) if False else np.asarray((lambda im: im.resize((im.width//2,im.height//2),Image.LANCZOS))(Image.open(f).convert('RGB'))) for f in fs]
base=fr[0].astype(np.int16)
out=[]
for f in fr:
  d=np.abs(f.astype(np.int16)-base).sum(2)>thr
  m=Image.fromarray((d*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
  m=np.asarray(m)>0
  o=np.where(m[...,None],f,fr[0]).astype(np.uint8); out.append(Image.fromarray(o))
pal=out[0].quantize(colors=255,method=Image.MEDIANCUT,dither=Image.Dither.NONE)
q=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in out]
q[0].save(f'out/_{n}.gif',save_all=True,append_images=q[1:],duration=80,loop=0,disposal=1)
subprocess.run(['gifsicle','-O3',f'--lossy={lossy}','-o',f'out/{n}.gif',f'out/_{n}.gif'],check=True);os.remove(f'out/_{n}.gif')
out[0].save(f'out/first-{n}.png');print(n,len(out),os.path.getsize(f'out/{n}.gif')//1024,'KB',out[0].size)

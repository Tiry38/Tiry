import sys,glob,os,subprocess
from PIL import Image
# seq2gif.py name delay_cs lossy [crop_h_css]
n=sys.argv[1];dl=int(sys.argv[2]);lossy=sys.argv[3];ch=int(sys.argv[4]) if len(sys.argv)>4 else None
fs=sorted(glob.glob(f'fr/{n}/*.png'))
fr=[]
for f in fs:
  im=Image.open(f).convert('RGB');w,h=im.width//2,im.height//2
  im=im.resize((w,h),Image.LANCZOS)
  if ch: im=im.crop((0,0,w,ch))
  fr.append(im)
probe=Image.new('RGB',(fr[0].width,fr[0].height*2));probe.paste(fr[0],(0,0));probe.paste(fr[len(fr)//2],(0,fr[0].height))
pal=probe.quantize(colors=255,method=Image.MEDIANCUT,dither=Image.Dither.NONE)
q=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in fr]
tmp=f'out/_{n}.gif';q[0].save(tmp,save_all=True,append_images=q[1:],duration=dl*10,loop=0,disposal=1)
subprocess.run(['gifsicle','-O3',f'--lossy={lossy}','-o',f'out/{n}.gif',tmp],check=True);os.remove(tmp)
fr[0].save(f'out/first-{n}.png');print(n,len(fr),os.path.getsize(f'out/{n}.gif')//1024,'KB',fr[0].size)

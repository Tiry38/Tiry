import sys,glob,os,subprocess
from PIL import Image
# Aufruf: mkgif.py name hold_final_cs [lossy]
n=sys.argv[1]; hold=int(sys.argv[2]); lossy=sys.argv[3] if len(sys.argv)>3 else '40'
fs=sorted(glob.glob(f'fr/{n}/*.png'))
fr=[Image.open(f).convert('RGB').resize((Image.open(f).width//2,Image.open(f).height//2),Image.LANCZOS) for f in fs]
final=fr[-1]
seq=[final]+fr[:-1]+[final]
# gemeinsame Palette aus Final + Mitte
probe=Image.new('RGB',(final.width,final.height*3));probe.paste(final,(0,0));probe.paste(fr[len(fr)//2],(0,final.height));probe.paste(fr[len(fr)//4],(0,final.height*2))
pal=probe.quantize(colors=255,method=Image.MEDIANCUT,dither=Image.Dither.NONE)
q=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in seq]
dur=[hold*10]+[80]*(len(seq)-2)+[hold*10]
os.makedirs('out',exist_ok=True)
tmp=f'out/_{n}.gif'
q[0].save(tmp,save_all=True,append_images=q[1:],duration=dur,loop=0,optimize=False,disposal=1)
subprocess.run(['gifsicle','-O3',f'--lossy={lossy}','--no-comments','-o',f'out/x-{n}.gif',tmp],check=True)
os.remove(tmp)
final.save(f'out/first-{n}.png')
print(n,len(seq),'frames',os.path.getsize(f'out/x-{n}.gif')//1024,'KB')

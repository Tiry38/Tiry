import sys,glob,os,subprocess
from PIL import Image
# loopgif.py name lossy : Bilder in Reihenfolge, Endlosschleife ohne Haltebild
n=sys.argv[1];lossy=sys.argv[2]
fs=sorted(glob.glob(f'fr/{n}/*.png'))
fr=[Image.open(f).convert('RGB') for f in fs];fr=[im.resize((im.width//2,im.height//2),Image.LANCZOS) for im in fr]
probe=Image.new('RGB',(fr[0].width,fr[0].height*2));probe.paste(fr[0],(0,0));probe.paste(fr[len(fr)//2],(0,fr[0].height))
pal=probe.quantize(colors=255,method=Image.MEDIANCUT,dither=Image.Dither.NONE)
q=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in fr]
q[0].save(f'out/_{n}.gif',save_all=True,append_images=q[1:],duration=80,loop=0,disposal=1)
subprocess.run(['gifsicle','-O3',f'--lossy={lossy}','-o',f'out/{n}.gif',f'out/_{n}.gif'],check=True);os.remove(f'out/_{n}.gif')
fr[0].save(f'out/first-{n}.png');print(n,len(fr),os.path.getsize(f'out/{n}.gif')//1024,'KB',fr[0].size)

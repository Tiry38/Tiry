import glob,subprocess,os
from PIL import Image
fs=sorted(glob.glob('fr/leaves/*.png'))
pal_src=Image.new('RGB',(640,960*3),(0,0,0))
frames=[Image.open(f).convert('RGBA') for f in fs]
for i,k in enumerate([0,20,40]): pal_src.paste(frames[k].convert('RGB'),(0,960*i),frames[k])
pal=pal_src.quantize(colors=63,method=Image.MEDIANCUT,dither=Image.Dither.NONE)
out=[]
for fr in frames:
  a=fr.getchannel('A')
  q=fr.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE)
  q.putpalette(pal.getpalette()[:63*3]+[255,0,255]+[0]*(256-64)*3)
  mask=a.point(lambda v:255 if v<110 else 0)
  q.paste(63,mask=mask)
  out.append(q)
out[0].save('out/_l.gif',save_all=True,append_images=out[1:],duration=80,loop=0,transparency=63,disposal=2)
subprocess.run(['gifsicle','-O3','--lossy=30','-o','out/laub.gif','out/_l.gif'],check=True);os.remove('out/_l.gif')
print(os.path.getsize('out/laub.gif')//1024,'KB')

# Große GIFs von www.velo-center.de laden (rapidmail-ZIP max. 4 MB), Qualität unverändert
import sys,os,shutil
EXT={'n001.gif':'nl-dez26-kopf.gif','n002.gif':'nl-dez26-laub.gif','n013.gif':'nl-dez26-winter.gif'}
BASE='https://raw.githubusercontent.com/Tiry38/Tiry/26739b3ccdc8675d57b21be2062e19a9ae193d42/newsletter-dezember-2026/extern/'
src,dst=sys.argv[1],sys.argv[2]
shutil.rmtree(dst,ignore_errors=True);os.makedirs(dst)
h=open(f'{src}/newsletter-dezember-2026.html').read()
for k,v in EXT.items():
    assert h.count(f'src="{k}"')==1,k; h=h.replace(f'src="{k}"',f'src="{BASE}{v}"')
open(f'{dst}/newsletter-dezember-2026.html','w').write(h)
for f in os.listdir(src):
    if f not in EXT and f!='newsletter-dezember-2026.html': shutil.copy(f'{src}/{f}',f'{dst}/{f}')
print('ok')

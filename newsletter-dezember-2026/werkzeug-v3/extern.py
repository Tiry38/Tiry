# Alle GIFs unverändert extern laden (rapidmail-ZIP max. 4 MB), Qualität unverändert
import sys,os,shutil,glob
BASE=sys.argv[3] if len(sys.argv)>3 else ''
src,dst=sys.argv[1],sys.argv[2]
shutil.rmtree(dst,ignore_errors=True);os.makedirs(dst)
h=open(f'{src}/newsletter-dezember-2026.html').read()
for f in sorted(os.listdir(src)):
    if f.endswith('.gif'):
        assert h.count(f'src="{f}"')==1,f; h=h.replace(f'src="{f}"',f'src="{BASE}nl-dez26-{f}"')
    elif f=='unterlage.jpg':
        assert h.count('url(unterlage.jpg)')==1; h=h.replace('url(unterlage.jpg)',f'url({BASE}nl-dez26-unterlage.jpg)')
    elif f!='newsletter-dezember-2026.html': shutil.copy(f'{src}/{f}',f'{dst}/{f}')
open(f'{dst}/newsletter-dezember-2026.html','w').write(h)
print('ok')

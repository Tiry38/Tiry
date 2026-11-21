"""Baut die Vorlage „Nebel, See & Schnee“: python3 inject.py <live-index.html> <ziel.html> [nebel|see|winter] [--feste-bilder]
Ändert nur den Hintergrund; Inhalt, Übergänge und Funktionen bleiben die Live-Seite."""
import sys,os
D=os.path.dirname(os.path.abspath(__file__))
a=[x for x in sys.argv[1:] if not x.startswith('--')]
s=open(a[0],encoding='utf8').read()
modus=a[2] if len(a)>2 else 'nebel'
rd=lambda n:open(D+'/'+n,encoding='utf8').read()
def rep(x,y):
    global s
    assert s.count(x)==1,('nicht eindeutig/gefunden',x[:80],s.count(x))
    s=s.replace(x,y)
s=s.replace('<meta name="robots" content="index,follow">','<meta name="robots" content="noindex,nofollow">',1)
assert 'noindex,nofollow' in s
i=s.index('<title>');j=s.index('</title>')+8;s=s[:i]+'<title>Vorlage Nebel, See & Schnee</title>'+s[j:]
if '--feste-bilder' in sys.argv:
    rep('PV=function(p,w){var v=PVV[p];if(!v||!p)return p;',
        'PV=function(p,w){var v=PVV[p];if(!v||!p)return p;var b=v.filter(function(x){return x<=960}).pop()||v[0];return p.slice(0,-5)+"-"+b+".webp";')
i=s.index('</style>')+8;s=s[:i]+'\n<style id="vHg">\n'+rd('hg12.css')+'</style>\n<script>document.documentElement.classList.add("hg3")</script>\n'+s[i:]
k=s.rfind('</html>');k=k if k>=0 else len(s)
s=s[:k]+'<script id="vHg11Js">window.HG12_DEFAULT='+repr(modus)+';\n'+rd('hg12.js')+'</script>\n'+s[k:]
open(a[1],'w',encoding='utf8').write(s)
print('ok',a[1],modus)

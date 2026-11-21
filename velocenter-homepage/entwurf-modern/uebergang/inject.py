"""Baut die Vorlage „Übergänge“: python3 inject.py <live-index.html> <ziel.html> [linse|lamellen|tiefe] [--feste-bilder]
Ändert nur den Seitenwechsel (Router go()); alles andere bleibt die Live-Seite.
--feste-bilder: PV() wählt immer dieselbe Bildgröße (für die Artifact-Vorschau mit begrenzter Dateizahl)."""
import sys,os
D=os.path.dirname(os.path.abspath(__file__))
a=[x for x in sys.argv[1:] if not x.startswith('--')]
s=open(a[0],encoding='utf8').read()
modus=a[2] if len(a)>2 else 'linse'
rd=lambda n:open(D+'/'+n,encoding='utf8').read()
def rep(x,y):
    global s
    assert s.count(x)==1,('nicht eindeutig/gefunden',x[:80],s.count(x))
    s=s.replace(x,y)
s=s.replace('<meta name="robots" content="index,follow">','<meta name="robots" content="noindex,nofollow">',1)
assert 'noindex,nofollow' in s
i=s.index('<title>');j=s.index('</title>')+8;s=s[:i]+'<title>Vorlage Übergänge</title>'+s[j:]
rep("if(busy){pend=true;return}busy=true;const w=$('#wipe');",
    "if(busy){pend=true;return}busy=true;if(window.VTX&&VTX(()=>show(v,anchor),()=>{busy=false;if(pend){pend=false;const [v2,a2]=target();if(v2!==cur||a2)go(false)}},v))return;const w=$('#wipe');")
if '--feste-bilder' in sys.argv:
    rep('PV=function(p,w){var v=PVV[p];if(!v||!p)return p;',
        'PV=function(p,w){var v=PVV[p];if(!v||!p)return p;var b=v.filter(function(x){return x<=960}).pop()||v[0];return p.slice(0,-5)+"-"+b+".webp";')
i=s.index('</style>')+8;s=s[:i]+'\n<style id="vUe">\n'+rd('uebergang.css')+'</style>\n<script>(function(){var m='+repr(modus)+';try{var q=new URLSearchParams(location.search).get("ue")||localStorage.getItem("vc_ue");if(q)m=q}catch(e){}var b={linse:"klinge",lamellen:"glas",tiefe:"facette"}[m]||"klinge";document.documentElement.classList.add("bgx","bg-"+b)})()</script>\n'+s[i:]
i=s.rindex('</html>');s=s[:i]+'<script id="vUeJs">window.UE_DEFAULT='+repr(modus)+';\n'+rd('uebergang.js')+'</script>\n'+s[i:]
open(a[1],'w',encoding='utf8').write(s)
print('ok',a[1],modus)

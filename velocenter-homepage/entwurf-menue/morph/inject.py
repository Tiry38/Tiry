"""Baut die Vorlage „Verwandlung“ (Showroom): python3 inject.py <live-index.html> <ziel.html>
Ändert nur den Rad-/Logo-Wechsel im Start-Showroom und im Marken-Showroom; der Umschalter unten wählt „Wie jetzt“ / „Verwandlung“."""
import sys,os
D=os.path.dirname(os.path.abspath(__file__))
s=open(sys.argv[1],encoding='utf8').read()
rd=lambda n:open(D+'/'+n,encoding='utf8').read()
def rep(a,b):
    global s
    assert s.count(a)==1,('nicht eindeutig/gefunden',a[:80],s.count(a))
    s=s.replace(a,b)
s=s.replace('<meta name="robots" content="index,follow">','<meta name="robots" content="noindex,nofollow">',1)
assert 'noindex,nofollow' in s
i=s.index('<title>');j=s.index('</title>')+8;s=s[:i]+'<title>Vorlage Showroom-Verwandlung</title>'+s[j:]
# Start-Showroom: Wechsel über die Verwandlung
rep("wt.then(()=>{on.classList.add('off');lg.classList.add('swap');on=el;",
    "wt.then(()=>{if(window.VM&&VM.on&&VM.ok){const o=on;on=el;VM.run({root:hv,bike:{oldEl:o,newEl:el,to:el.currentSrc||el.src},logo:{el:lg,to:logo}}).then(()=>{busy=0});return}on.classList.add('off');lg.classList.add('swap');on=el;")
rep("setInterval(()=>{if(cur!=='start'||scrollY>innerHeight||document.hidden||busy)return;",
    "const vmTick=f=>{if(busy||(!f&&(cur!=='start'||scrollY>innerHeight||document.hidden)))return;")
rep("pre.decode?pre.decode().then(go,go):(pre.onload=go)},4800);",
    "pre.decode?pre.decode().then(go,go):(pre.onload=go)};window.VMhero=vmTick;setInterval(()=>vmTick(),4800);")
# Marken-Showroom
rep("bk.classList.add('out-l');wm.classList.add('swap');rf.style.opacity=0;",
    "if(window.VM&&VM.on&&VM.ok){const op0=getComputedStyle(wm).opacity,from=bk.currentSrc||bk.src,lf=wm.currentSrc||wm.src;"
    "Promise.race([Promise.all([dec(x.img),dec(b.logo)]),new Promise(r=>setTimeout(r,2500))]).then(()=>{thSet(i,x.img);"
    "const pr=VM.run({root:area,bike:{oldEl:bk,newEl:bk,from,to:x.img,alt:x.m+(x.f?' in '+x.f:'')},logo:{el:wm,from:lf,to:b.logo,op0}});paint();pr.then(()=>{rf.src=x.img;busy=0})});return}"
    "bk.classList.add('out-l');wm.classList.add('swap');rf.style.opacity=0;")
i=s.index('</style>')+8;s=s[:i]+'\n<style id="vMorph">\n'+rd('morph.css')+'</style>\n'+s[i:]
i=s.rindex('</html>');s=s[:i]+'<script id="vMorphJs">\n'+rd('morph.js')+'\n'+rd('panel.js')+'</script>\n'+s[i:]
open(sys.argv[2],'w',encoding='utf8').write(s)
print('ok',sys.argv[2])

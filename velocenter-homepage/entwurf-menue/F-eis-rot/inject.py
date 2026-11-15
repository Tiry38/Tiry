import sys
T=sys.argv[1]
s=open(T+'/index.html',encoding='utf8').read()
css=''.join(open(f,encoding='utf8').read()+'\n' for f in ['base.css','F.css','bg.css','rv.css','switch.css'])
js=''.join(open(f,encoding='utf8').read()+'\n' for f in ['F.js','er.js','rv.js'])
s=s.replace('<title>Velocenter Hessert · E-Bikes &amp; Werkstatt in Wörth am Rhein</title>','<title>Vorlage Eis und Rot</title>',1)
s=s.replace('<meta name="robots" content="index,follow">','<meta name="robots" content="noindex,nofollow">',1)
head="\n<script>document.documentElement.classList.add('er');try{document.documentElement.setAttribute('data-rv',localStorage.getItem('rv')||'1')}catch(_){document.documentElement.setAttribute('data-rv','1')}</script>\n<style id=\"entwurfER\">\n"+css+"</style>\n"
i=s.index('</style>')+len('</style>');s=s[:i]+head+s[i:]
i=s.rindex('</html>');s=s[:i]+'<script id="entwurfERjs">\n'+js+'</script>\n'+s[i:]
open('index.html','w',encoding='utf8').write(s)

"""Baut die Vorlage „Metall gebürstet“: python3 inject.py <live-index.html> <ziel.html>"""
import sys,os
D=os.path.dirname(os.path.abspath(__file__))
s=open(sys.argv[1],encoding='utf8').read()
css=open(D+'/metall.css',encoding='utf8').read();js=open(D+'/metall.js',encoding='utf8').read()
s=s.replace('<meta name="robots" content="index,follow">','<meta name="robots" content="noindex,nofollow">',1)
assert 'noindex,nofollow' in s
i=s.index('<title>');j=s.index('</title>')+8;s=s[:i]+'<title>Vorlage Metall gebürstet</title>'+s[j:]
i=s.index('</style>')+8;s=s[:i]+'\n<style id="vMetall">\n'+css+'</style>\n'+s[i:]
i=s.rindex('</html>');s=s[:i]+'<script id="vMetallJs">\n'+js+'</script>\n'+s[i:]
open(sys.argv[2],'w',encoding='utf8').write(s)

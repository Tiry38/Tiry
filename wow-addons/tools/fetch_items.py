import json, re, sys, time, urllib.request, os
ids = [int(x) for x in sys.argv[1].split(',')]
out = {}
if os.path.exists('items.json'):
    out = json.load(open('items.json'))
def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                return json.loads(r.read().decode('utf-8'))
        except Exception as e:
            err = e; time.sleep(1.5)
    return {'error': str(err)}
def money(tt):
    m = re.search(r'whtt-sellprice">(.*?)</div>', tt or '')
    if not m: return None
    s = m.group(1); c = 0
    for v, unit in re.findall(r'money(gold|silver|copper)">(\d+)', s) and [(int(b), a) for a, b in re.findall(r'money(gold|silver|copper)">(\d+)', s)] or []:
        c += v * {'gold': 10000, 'silver': 100, 'copper': 1}[unit]
    return c
for i in ids:
    if str(i) in out and 'en' in out[str(i)]: continue
    en = get(f'https://nether.wowhead.com/forever/tooltip/item/{i}')
    de = get(f'https://nether.wowhead.com/forever/tooltip/item/{i}?locale=3')
    tt = en.get('tooltip', '')
    stack = re.search(r'Max Stack: (\d+)', tt)
    out[str(i)] = {
        'en': en.get('name'), 'de': de.get('name'), 'q': en.get('quality'), 'icon': en.get('icon'),
        'sell': money(tt), 'stack': int(stack.group(1)) if stack else None,
        'reagent': 'Crafting Reagent' in tt, 'err': en.get('error') or de.get('error'),
        'nosell': ('whtt-sellprice' not in tt),
    }
    time.sleep(0.25)
json.dump(out, open('items.json', 'w'), ensure_ascii=False, indent=1)
for i in ids:
    d = out[str(i)]
    print(f"{i:>6} | {d['en']} | {d['de']} | q{d['q']} | sell {d['sell']} | stack {d['stack']} | reag {d['reagent']} | {d['icon']} {d['err'] or ''}")

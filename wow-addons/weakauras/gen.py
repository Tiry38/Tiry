import zlib, re
ALPH = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789()"
def enc_print(b):
    out=[]; i=0; n=len(b)
    while i <= n-3:
        c=b[i]+b[i+1]*256+b[i+2]*65536; i+=3
        for _ in range(4): out.append(ALPH[c%64]); c//=64
    c=0; bl=0
    while i<n: c+=b[i]<<bl; bl+=8; i+=1
    while bl>0: out.append(ALPH[c%64]); c//=64; bl-=6
    return "".join(out)
def dec_print(s):
    vals=[ALPH.index(ch) for ch in s]; out=bytearray(); i=0
    while i+4<=len(vals):
        c=vals[i]+vals[i+1]*64+vals[i+2]*4096+vals[i+3]*262144; i+=4
        out+=bytes([c&255,(c>>8)&255,(c>>16)&255])
    c=0; bl=0
    while i<len(vals): c+=vals[i]<<bl; bl+=6; i+=1
    while bl>=8: out.append(c&255); c>>=8; bl-=8
    return bytes(out)
def esc(s):
    def h(m):
        n=ord(m.group(0))
        if n==30: return "~z"
        if n<=32: return "~"+chr(n+64)
        return {94:"~}",126:"~|",127:"~{"}[n]
    return re.sub(r"[\x00-\x20\x5e\x7e\x7f]", h, s)
def ser(v):
    if isinstance(v,bool): return "^B" if v else "^b"
    if isinstance(v,str): return "^S"+esc(v)
    if isinstance(v,(int,float)):
        s=repr(v) if isinstance(v,float) else str(v)
        if isinstance(v,float) and v.is_integer(): s=str(int(v))
        return "^N"+s
    if isinstance(v,list): v={i+1:x for i,x in enumerate(v)}
    if isinstance(v,dict): return "^T"+"".join(ser(k)+ser(x) for k,x in v.items())+"^t"
    raise TypeError(v)

FROST=[0.3,0.85,1,1]; GOLD=[1,0.85,0.25,1]; GREEN=[0.25,1,0.35,1]; RED=[1,0.2,0.12,1]; ORANGE=[1,0.45,0.08,1]
def txt(text, anchor, size, color, visible=True, y=0):
    return {"type":"subtext","text_text":text,"text_text_format_s_format":"none","text_text_format_p_format":"timed",
            "text_text_format_p_time_format":0,"text_text_format_p_time_precision":1,"text_text_format_p_time_dynamic_threshold":60,
            "text_text_format_2.s_format":"none","text_text_format_2.p_format":"timed","text_text_format_2.p_time_format":0,
            "text_text_format_2.p_time_precision":1,"text_text_format_2.p_time_dynamic_threshold":60,
            "text_anchorPoint":anchor,"text_selfPoint":"AUTO","anchorXOffset":0,"anchorYOffset":y,
            "text_font":"Friz Quadrata TT","text_fontSize":size,"text_fontType":"OUTLINE","text_color":color,
            "text_justify":"CENTER","text_visible":visible,"text_shadowColor":[0,0,0,1],"text_shadowXOffset":1,"text_shadowYOffset":-1,
            "text_wordWrap":"WordWrap","text_automaticWidth":"Auto","text_fixedWidth":64}
data = {
 "id":"Blitzschlagschild · Tiry","uid":"TiryLSFrostFeuer1","internalVersion":78,"tocversion":16001,
 "regionType":"icon","width":64,"height":64,"zoom":0.3,"keepAspectRatio":False,
 "anchorFrameType":"SCREEN","anchorPoint":"CENTER","selfPoint":"CENTER","xOffset":0,"yOffset":-150,"frameStrata":1,
 "iconSource":0,"displayIcon":"Interface\\Icons\\Spell_Nature_LightningShield","desaturate":False,"color":[1,1,1,1],"alpha":1,
 "cooldown":False,"cooldownTextDisabled":True,"inverse":False,"cooldownEdge":False,"useCooldownModRate":True,
 "triggers":{
   1:{"trigger":{"type":"aura2","unit":"player","debuffType":"HELPFUL","useExactSpellId":True,
     "auraspellids":["324","325","905","945","8134","10431","10432","25469","25472"],"matchesShowOn":"showOnActive","ownOnly":True,
     "event":"Health","subeventPrefix":"SPELL","subeventSuffix":"_CAST_START","spellIds":[],"names":[]},"untrigger":{}},
   2:{"trigger":{"type":"aura2","unit":"player","debuffType":"HELPFUL","useName":True,
     "auranames":["Blitzschlagschild","Lightning Shield"],"matchesShowOn":"showAlways","ownOnly":True,"event":"Health",
     "subeventPrefix":"SPELL","subeventSuffix":"_CAST_START","spellIds":[],"names":[]},"untrigger":{}},
   3:{"trigger":{"type":"unit","event":"Conditions","unit":"player","use_unit":True,"use_incombat":True,
     "subeventPrefix":"SPELL","subeventSuffix":"_CAST_START","spellIds":[],"names":[]},"untrigger":{}},
   "activeTriggerMode":-10,"disjunctive":"any"},
 "load":{"use_class":True,"class":{"single":"SHAMAN","multi":{"SHAMAN":True}},"size":{"multi":{}},"spec":{"multi":{}},
   "talent":{"multi":{}},"race":{"multi":{}},"difficulty":{"multi":{}},"zone":"","use_never":False},
 "subRegions":[
   {"type":"subbackground"},
   txt("%p\n|cff40ff59%s|r","CENTER",17,[1,1,1,1],True),   # 2 Zeit + gruene Ladungen
   txt("FEHLT","CENTER",17,RED,False),                     # 3 Hinweis
   txt("?","CENTER",22,FROST,False),                       # 4 im Kampf nicht lesbar
   {"type":"subborder","border_visible":True,"border_edge":"Square Full White","border_color":FROST,"border_size":2,"border_offset":1,"border_anchor":"bg"},
   {"type":"subglow","glow":False,"glowType":"Pixel","useGlowColor":True,"glowColor":RED,"glowLines":8,"glowFrequency":0.25,
    "glowLength":10,"glowThickness":2,"glowXOffset":0,"glowYOffset":0,"glowBorder":False,"glowScale":1},
 ],
 "conditions":[
   {"check":{"trigger":-2,"variable":"AND","checks":[{"trigger":1,"variable":"show","value":0},{"trigger":2,"variable":"buffed","value":0},
                                                     {"trigger":3,"variable":"show","value":0}]},
    "changes":[{"property":"desaturate","value":True},{"property":"color","value":[1,0.45,0.45,0.85]},
               {"property":"sub.2.text_visible","value":False},{"property":"sub.3.text_visible","value":True},
               {"property":"sub.5.border_color","value":RED},{"property":"sub.6.glow","value":True}]},
   {"check":{"trigger":-2,"variable":"AND","checks":[{"trigger":1,"variable":"show","value":0},{"trigger":2,"variable":"buffed","value":0},
                                                     {"trigger":3,"variable":"show","value":1}]},
    "changes":[{"property":"sub.2.text_visible","value":False},{"property":"sub.4.text_visible","value":True}]},
   {"check":{"trigger":-1,"variable":"stacks","op":"<=","value":"1"},
    "changes":[{"property":"sub.5.border_color","value":ORANGE}]},
 ],
 "animation":{"start":{"type":"none","easeType":"none","duration_type":"seconds"},
              "main":{"type":"none","easeType":"none","duration_type":"seconds"},
              "finish":{"type":"none","easeType":"none","duration_type":"seconds"}},
 "actions":{"init":{},"start":{},"finish":{}},"information":{},"config":{},"authorOptions":[],
 "semver":"1.7.0","version":9,"desc":"Blitzschlagschild: aktiv/fehlt, Aufladungen, Restzeit. Frost & Feuer.",
}
transmit={"m":"d","d":data,"v":1421,"s":"Tiry"}
raw=("^1"+ser(transmit)+"^^").encode("utf-8")
co=zlib.compressobj(9,zlib.DEFLATED,-15); comp=co.compress(raw)+co.flush()
out="!"+enc_print(comp)
# Gegenprobe
assert zlib.decompress(dec_print(out[1:]),-15)==raw
open("Blitzschlagschild_WeakAura.txt","w").write(out+"\n")
print(len(out)); print(raw[:160])

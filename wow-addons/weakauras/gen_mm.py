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
 "id":"Minimap Post · Tiry","uid":"TiryMiniMailA1","internalVersion":78,"tocversion":16001,
 "regionType":"text","displayText":"","font":"Friz Quadrata TT","fontSize":12,"outline":"OUTLINE",
 "justify":"LEFT","color":[1,1,1,1],"automaticWidth":"Auto","fixedWidth":200,"wordWrap":"WordWrap",
 "shadowColor":[0,0,0,1],"shadowXOffset":1,"shadowYOffset":-1,
 "anchorFrameType":"SCREEN","anchorPoint":"CENTER","selfPoint":"BOTTOM","xOffset":0,"yOffset":0,"frameStrata":1,
 "triggers":{1:{"trigger":{"type":"unit","event":"Conditions","unit":"player","use_unit":True,
   "subeventPrefix":"SPELL","subeventSuffix":"_CAST_START","spellIds":[],"names":[]},"untrigger":{}},
   "activeTriggerMode":-10,"disjunctive":"any"},
 "load":{"size":{"multi":{}},"spec":{"multi":{}},"class":{"multi":{}},"talent":{"multi":{}},"race":{"multi":{}},
   "difficulty":{"multi":{}},"zone":"","use_never":False},
 "subRegions":[],"conditions":[],
 "animation":{"start":{"type":"none","easeType":"none","duration_type":"seconds"},
              "main":{"type":"none","easeType":"none","duration_type":"seconds"},
              "finish":{"type":"none","easeType":"none","duration_type":"seconds"}},
 "actions":{"init":{"do_custom":True,"custom":open("minimap.lua").read()},"start":{},"finish":{}},
 "information":{},"config":{},"authorOptions":[],
 "semver":"1.0.0","version":1,"desc":"Post-Symbol unter die Uhr, alle anderen Minimap-Knöpfe unsichtbar.",
}
transmit={"m":"d","d":data,"v":1421,"s":"Tiry"}
raw=("^1"+ser(transmit)+"^^").encode("utf-8")
co=zlib.compressobj(9,zlib.DEFLATED,-15); comp=co.compress(raw)+co.flush()
out="!"+enc_print(comp)
assert zlib.decompress(dec_print(out[1:]),-15)==raw
open("Minimap_Post_WeakAura.txt","w").write(out+"\n")
print(len(out))

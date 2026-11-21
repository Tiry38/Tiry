import sys, time, json, torch, torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
torch.set_num_threads(4)
t0=time.time(); m=ChatterboxMultilingualTTS.from_pretrained(device="cpu"); print("load",round(time.time()-t0,1),flush=True)
jobs=json.load(open(sys.argv[1]))
for j in jobs:
    t=time.time()
    w=m.generate(j["text"], language_id="de", audio_prompt_path=j["ref"], exaggeration=j.get("ex",0.5), cfg_weight=j.get("cfg",0.5))
    ta.save(f"a3/{j['id']}.wav", w, m.sr); print(j["id"], round(time.time()-t,1), flush=True)

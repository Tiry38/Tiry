"""Wählt je Zeile die Variante mit sauberer Verständlichkeit (Whisper) und höchster Natürlichkeitsnote (DNSMOS)."""
import glob, json, re, difflib, shutil, subprocess
import numpy as np, librosa
from faster_whisper import WhisperModel
from speechmos import dnsmos

wm = WhisperModel("small", device="cpu", compute_type="int8")
jobs = {j["id"]: j for j in json.load(open("jobs.json"))}
NUM = {"sechzehn": "16", "neunundachtzig": "89", "achtzehn": "18", "neun": "9"}
FILL = {"ähm", "äh", "ah", "oh"}

def norm(s):
    s = s.lower().replace("ei-wox", "eiwox").replace("iwox", "eiwox").replace("i-wox", "eiwox").replace("aivox", "eiwox")
    for k, v in NUM.items():
        s = re.sub(r"\b" + k + r"\b", v, s)
    return [w for w in re.sub(r"[^a-zäöüß0-9 ]", " ", s).split() if w not in FILL]

best, report = {}, []
for f in sorted(glob.glob("a3/*__v*.wav")):
    base = f.split("/")[-1].split("__")[0]
    y, _ = librosa.load(f, sr=16000)
    text = "".join(s.text for s in wm.transcribe(y, language="de")[0])
    acc = difflib.SequenceMatcher(None, norm(jobs[base]["text"]), norm(text)).ratio()
    mos = dnsmos.run(y, sr=16000)
    nat = (float(mos["ovrl_mos"]) + float(mos["p808_mos"])) / 2
    score = nat if acc >= 0.9 else nat - 5 + acc  # Verständlichkeit hat Vorrang
    report.append((f, round(acc, 3), round(nat, 2), text))
    print(f, round(acc, 3), round(nat, 2), text, flush=True)
    if score > best.get(base, (-99,))[0]:
        best[base] = (score, f, acc, nat)
for b, (s, f, acc, nat) in sorted(best.items()):
    shutil.copy(f, f"a3/{b}.wav")
    print("BEST", b, f.split("__")[1][:2], "verst.", round(acc, 3), "natur", round(nat, 2))

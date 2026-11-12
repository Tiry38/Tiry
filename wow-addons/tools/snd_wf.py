# WindBaem-Sounds v3 (Tiry: "simples, nicht nerviges Geraeusch"): kurz, weich, leise.
#   pling : weicher Glas-Pling, 0,25 s (Standard)
#   tick  : sanftes Holz-Tick, 0,08 s (am unauffaelligsten)
#   wusch : kurzer Windhauch, 0,2 s (passt zu Windzorn)
# Reine Synthese mit numpy/scipy, keine Aufnahmen. Pegel: RMS des hoerbaren Teils ca. -26 dBFS, Spitze <= -10 dBFS
# (leiser als LevelPilots Ankunftston, -20). Aufruf: python3 -I tools/snd_wf.py   (aus wow-addons/)
import numpy as np, wave, subprocess, os
from scipy.signal import lfilter

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MEDIA = os.path.join(ROOT, "addons", "WindBaem", "Media")
PREV = os.path.join(ROOT, "previews")
TARGET_RMS = -29.0   # nach Vorbis-Mono-Mix gemessen = ca. -26
PEAK = -10.0
rng = np.random.default_rng(1012)


def fade_in_out(y, a_ms, r_ms):
    a = max(1, int(a_ms * SR / 1000)); r = max(1, int(r_ms * SR / 1000))
    y[:a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    y[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return y


def reson(x, f, bw):
    r = np.exp(-np.pi * bw / SR); th = 2 * np.pi * f / SR
    return lfilter([1 - r], [1, -2 * r * np.cos(th), r * r], x)


def pling():
    T = 0.25; t = np.arange(int(SR * T)) / SR
    f = 1046.5                                     # C6, weich, nicht schrill
    y = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.075)
         + 0.22 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t / 0.045)
         + 0.06 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.03))
    return fade_in_out(y, 2.5, 40)


def tick():
    T = 0.08; n = int(SR * T); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 820 * t) * np.exp(-t / 0.012)                 # Holz-Klang
    click = reson(rng.standard_normal(n), 2400, 900) * np.exp(-t / 0.003)  # weicher Anschlag
    y = body + 0.35 * click / np.max(np.abs(click))
    return fade_in_out(y, 0.8, 15)


def wusch():
    T = 0.20; n = int(SR * T); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    fc = 700 + 2300 * np.clip(t / 0.12, 0, 1) ** 0.7                       # Hauch steigt kurz an
    r = np.exp(-np.pi * 900 / SR)
    y = np.empty(n); y1 = y2 = 0.0
    for i in range(n):                                                       # gleitender Bandpass, ohne Bloecke
        v = (1 - r) * noise[i] + 2 * r * np.cos(2 * np.pi * fc[i] / SR) * y1 - r * r * y2
        y2, y1 = y1, v; y[i] = v
    for _ in range(2):                                                       # Tiefen raus (kein Rumpeln)
        k = np.exp(-2 * np.pi * 600 / SR)
        y = lfilter([(1 + k) / 2, -(1 + k) / 2], [1, -k], y)
    e = np.interp(t, [0, 0.05, 0.09, T], [0, 1, 0.7, 0])
    return fade_in_out(y * e, 1, 20)


def active_rms(x):
    m = x.mean(1) if x.ndim == 2 else x
    w = 441; n = max(1, len(m) // w)
    r = np.sqrt((m[: n * w].reshape(n, w) ** 2).mean(1))
    a = r[r > r.max() * 0.1]
    return 20 * np.log10(np.sqrt((a ** 2).mean()))


def decode(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def write(name, mono):
    os.makedirs(MEDIA, exist_ok=True)
    st = np.stack([mono, mono], 1)
    gain = 10 ** ((TARGET_RMS - active_rms(st)) / 20)
    gain = min(gain, 10 ** (PEAK / 20) / np.max(np.abs(st)))
    st = st * gain
    wav = os.path.join(MEDIA, name + ".wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes())
    ogg = os.path.join(MEDIA, name + ".ogg")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "6", ogg], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-q:a", "2",
                    os.path.join(PREV, "Sound_WindBaem_" + name + ".mp3")], check=True)
    os.remove(wav)
    y = decode(ogg)
    print(name, "RMS %.1f dBFS  Spitze %.1f dBFS  %.2f s" % (active_rms(y), 20 * np.log10(np.max(np.abs(y))), len(y) / SR))


if __name__ == "__main__":
    write("pling", pling())
    write("tick", tick())
    write("wusch", wusch())

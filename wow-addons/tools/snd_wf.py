# WindBaem-Sounds: "baem" (geschrienes BAEAEM + Einschlag) und "braam" (tiefes Kino-Horn mit Einschlag)
# Reine Synthese mit numpy (Formant-Stimme, Saegezahn-Blech, Sub-Boom). Keine fremden Aufnahmen.
# Aufruf: python3 -I tools/snd_wf.py   (aus wow-addons/)
import numpy as np, wave, subprocess, os
SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MEDIA = os.path.join(ROOT, "addons", "WindBaem", "Media")
PREV = os.path.join(ROOT, "previews")
rng = np.random.default_rng(1990)


def band(x, lo, hi):
    N = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(N, 1 / SR)
    m = np.ones_like(f)
    if lo: m *= 1 / (1 + (lo / np.maximum(f, 1e-3)) ** 4)
    if hi: m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, N)


def reverb(x, seed, length=1.0, tau=0.25):
    r = np.random.default_rng(seed); L = int(SR * length); tt = np.arange(L) / SR
    ir = band(r.standard_normal(L) * np.exp(-tt / tau), 150, 6000)
    ir[: int(0.015 * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    n = len(x)
    return np.fft.irfft(np.fft.rfft(x, n + L) * np.fft.rfft(ir, n + L))[:n]


def env(t, pts):
    """lineare Huellkurve aus (Zeit, Wert)-Punkten"""
    xs, ys = zip(*pts)
    return np.interp(t, xs, ys)


def formant_gain(f, formants):
    g = np.zeros_like(f)
    for fc, bw, a in formants:
        g += a / (1 + ((f - fc) / (bw / 2)) ** 2)
    return g


def voice(t, f0, vowel_mix, seed):
    """Additive Stimme: Harmonische von f0(t), gewichtet mit Formanten von AE (offen) -> M (nasal)."""
    AE = [(620, 110, 1.0), (1780, 160, 0.55), (2550, 220, 0.30), (3500, 300, 0.12)]
    M = [(260, 70, 1.0), (1050, 200, 0.10), (2300, 300, 0.04)]
    phase = 2 * np.pi * np.cumsum(f0) / SR
    out = np.zeros_like(t)
    r = np.random.default_rng(seed)
    for k in range(1, 46):
        fk = k * f0
        live = fk < 7000
        ga = formant_gain(fk, AE); gm = formant_gain(fk, M)
        g = (1 - vowel_mix) * ga + vowel_mix * gm
        out += live * g * (1.0 / k ** 0.6) * np.sin(k * phase + r.uniform(0, 2 * np.pi))
    return out


def sweep_lp(x, cut):
    """zeitvariabler Tiefpass (2 x 1-Pol), keine Bloecke -> keine Klicks"""
    a = 1 - np.exp(-2 * np.pi * cut / SR)
    y1 = 0.0; y2 = 0.0; out = np.empty_like(x)
    for i in range(len(x)):
        y1 += a[i] * (x[i] - y1); y2 += a[i] * (y1 - y2); out[i] = y2
    return out


def soft(x, drive):
    return np.tanh(drive * x) / np.tanh(drive)


def finish(L, R, fade_s, peak_db=-0.8):
    n = len(L); fade = np.ones(n); k = int(fade_s * SR)
    fade[-k:] = np.cos(np.linspace(0, np.pi / 2, k)) ** 2
    st = np.stack([L * fade, R * fade], 1)
    st /= np.max(np.abs(st)); st *= 10 ** (peak_db / 20)
    return st


def write(name, st):
    os.makedirs(MEDIA, exist_ok=True)
    wav = os.path.join(MEDIA, name + ".wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "6",
                    os.path.join(MEDIA, name + ".ogg")], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-q:a", "2",
                    os.path.join(PREV, "Sound_WindBaem_" + name + ".mp3")], check=True)
    os.remove(wav)


def impact(t):
    """B-Plosiv + Einschlag: tiefer Schlag mit fallender Tonhoehe und kurzer Knall"""
    f = 38 + 70 * np.exp(-t / 0.06)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.42)
    crack = band(rng.standard_normal(len(t)), 900, 7000) * np.exp(-t / 0.012)
    thump = band(rng.standard_normal(len(t)), 40, 300) * np.exp(-t / 0.035)
    return 1.0 * sub + 0.35 * crack + 0.5 * thump


def baem():
    T = 1.45; n = int(SR * T); t = np.arange(n) / SR
    # Stimme: setzt nach 18 ms ein (B-Verschluss), BAEAEAE bis ~0.85 s, dann M
    f0 = 158 - 30 * np.clip(t / 1.1, 0, 1) + 2.5 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.25) / 0.3, 0, 1)
    mix = np.clip((t - 0.80) / 0.14, 0, 1)                    # AE -> M
    a = env(t, [(0, 0), (0.018, 0), (0.05, 1.0), (0.80, 0.85), (0.95, 0.55), (1.25, 0.25), (T, 0)])
    vL = voice(t, f0, mix, 1) + 0.6 * voice(t, f0 * 1.007, mix, 2)     # zwei Stimmen = kraeftiger Ruf
    vR = voice(t, f0, mix, 3) + 0.6 * voice(t, f0 * 0.993, mix, 4)
    vL = soft(vL / np.max(np.abs(vL)) * a, 2.2); vR = soft(vR / np.max(np.abs(vR)) * a, 2.2)
    # Blech-Unterlage (Oktave tiefer), oeffnet mit dem Ruf
    b0 = f0 / 2
    ph = 2 * np.pi * np.cumsum(b0) / SR
    brass = sum(np.sin(k * ph) / k for k in range(1, 30))
    brass = soft(band(brass, 30, 1400) * env(t, [(0, 0), (0.03, 0.9), (0.8, 0.7), (1.3, 0.1), (T, 0)]), 1.6)
    hit = impact(t)
    hit = band(hit, 38, None)
    L = 1.0 * vL + 0.40 * brass + 0.60 * hit
    R = 1.0 * vR + 0.40 * brass + 0.60 * hit
    L = L + 0.22 * reverb(L, 11); R = R + 0.22 * reverb(R, 12)
    return finish(L, R, 0.18)


def braam():
    T = 1.6; n = int(SR * T); t = np.arange(n) / SR
    f0 = 55 * (1 - 0.03 * np.clip(t / T, 0, 1))
    out = []
    for det, seed in ((1.0, 5), (1.006, 6), (0.994, 7)):
        ph = 2 * np.pi * np.cumsum(f0 * det) / SR
        saw = sum(np.sin(k * ph + seed) / k for k in range(1, 60))
        out.append(saw)
    body = out[0] + 0.7 * out[1] + 0.7 * out[2]
    # Filter oeffnet schnell (BRAA) und schliesst langsam (AAM): gleitender 2-Pol-Tiefpass, Probe fuer Probe
    cut = env(t, [(0, 250), (0.06, 2600), (0.5, 1500), (1.2, 350), (T, 200)])
    y = sweep_lp(body, cut)
    y = soft(y / np.max(np.abs(y)) * env(t, [(0, 0), (0.012, 1), (0.9, 0.8), (1.4, 0.15), (T, 0)]), 2.6)
    hit = band(impact(t), 38, None)
    y = band(y, 38, None)
    L = 0.9 * y + 0.85 * hit; R = 0.9 * np.roll(y, 90) + 0.85 * hit
    L = L + 0.25 * reverb(L, 21); R = R + 0.25 * reverb(R, 22)
    return finish(L, R, 0.2)


if __name__ == "__main__":
    write("baem", baem())
    write("braam", braam())
    print("ok:", os.listdir(MEDIA))

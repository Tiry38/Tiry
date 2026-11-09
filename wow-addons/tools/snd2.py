# LevelPilot Sounds v2: Amboss-Schlag (beam), Schloss (lock), Ankunft (arrive)
# Reine Modal-Synthese mit numpy. KEIN Aufladen/Whoosh vor dem Anschlag, kein Pitch-Anstieg.
import numpy as np, wave, subprocess, os, sys
SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
SCR = os.path.dirname(HERE)
MEDIA = os.path.join(SCR, "addons", "LevelPilot", "Media")
rng = np.random.default_rng(2026)

def band(x, lo, hi, soft=0.15):
    """Bandpass per FFT-Maske mit weichen Flanken (kein Klingeln)."""
    N = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(N, 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1e-3)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, N)

def mode(t, f, amp, dec, beat=0.0, phase=0.0):
    """gedaempfte Sinus-Mode, optional mit leichter Schwebung (zwei nahe Teiltoene)."""
    y = np.sin(2 * np.pi * f * t + phase)
    if beat:
        y = 0.86 * y + 0.14 * np.sin(2 * np.pi * (f + beat) * t + phase * 1.7)
    return amp * y * np.exp(-t / dec)

def reverb(x, seed, length=0.9, tau=0.22, damp_hi=6500):
    r = np.random.default_rng(seed); L = int(SR * length); tt = np.arange(L) / SR
    ir = r.standard_normal(L) * np.exp(-tt / tau)
    ir = band(ir, 180, damp_hi)
    ir[: int(0.012 * SR)] = 0            # Vorverzoegerung 12 ms (Raum, kein Verschmieren des Anschlags)
    ir /= np.sqrt(np.sum(ir ** 2))
    n = len(x)
    return np.fft.irfft(np.fft.rfft(x, n + L) * np.fft.rfft(ir, n + L))[:n]

def finish(L, R, fade_s, peak_db=-1.0):
    n = len(L)
    fade = np.ones(n); k = int(fade_s * SR)
    fade[-k:] = np.cos(np.linspace(0, np.pi / 2, k)) ** 2
    st = np.stack([L * fade, R * fade], 1)
    st /= np.max(np.abs(st))
    st *= 10 ** (peak_db / 20)
    return st

def write_wav(path, st):
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes())

def encode(wav, ogg=None, mp3=None):
    if ogg:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "6", ogg], check=True)
    if mp3:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-q:a", "2", mp3], check=True)

# ---------------------------------------------------------------- Amboss
def anvil():
    T = 1.5; n = int(SR * T); t = np.arange(n) / SR
    # 1) Anschlag: 2 ms gefiltertes Rauschen, sofort voll da
    hitn = rng.standard_normal(n) * np.exp(-t / 0.0018)
    hit = band(hitn, 900, 9000) * 2.2
    # 2) Koerper-Thump: 105 Hz, fester Ton (kein Sweep), ~100 ms
    thump = np.sin(2 * np.pi * 105 * t) * np.exp(-t / 0.13) + 0.5 * np.sin(2 * np.pi * 68 * t) * np.exp(-t / 0.22)
    thump *= np.minimum(1, t / 0.0008)           # 0.8 ms Einschwingen gegen Knacksen
    thump *= 0.9
    # 3) Metall-Moden (inharmonisch, hohe klingen schneller ab)
    modes = [  # f, amp, decay, beat
        (612, 0.40, 0.75, 2.1),     # Grundmode des Ambosses, klingt am laengsten
        (1047, 0.55, 0.60, 3.3),
        (1618, 0.40, 0.48, 4.6),
        (2291, 0.30, 0.30, 0.0),
        (2967, 0.22, 0.20, 5.8),
        (3655, 0.15, 0.13, 0.0),
        (4472, 0.10, 0.085, 0.0),
        (5530, 0.07, 0.055, 0.0),
    ]
    ring = np.zeros(n)
    for i, (f, a, d, b) in enumerate(modes):
        ring += mode(t, f, a, d, b, phase=i * 0.9)
    ring *= np.minimum(1, t / 0.0006) * 0.62
    # 4) dezentes Klirren: wenige leise, hohe, kurze Metallticks zwischen 80 und 350 ms
    clink = np.zeros(n)
    for t0, f, a in [(0.085, 6150, 0.040), (0.142, 7420, 0.026), (0.205, 5310, 0.030),
                     (0.268, 8380, 0.015), (0.336, 6790, 0.012)]:
        i0 = int(t0 * SR); tt = np.arange(n - i0) / SR
        clink[i0:] += (np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * f * 1.53 * tt)) * a * np.exp(-tt / 0.018) * np.minimum(1, tt / 0.0004)
    dry = hit + thump + ring + clink
    # Stereo: Klirren leicht verteilt, Raum dekorreliert
    clinkL = np.roll(clink, int(0.0015 * SR)) * 0.9
    L = hit + thump + ring + clinkL + 0.20 * reverb(dry, 1)
    R = hit + thump + ring + clink * 1.05 + 0.20 * reverb(dry, 2)
    # weiche Saettigung fuer Dichte, Spitze bleibt der Anschlag
    L = np.tanh(L * 0.7) / np.tanh(0.7); R = np.tanh(R * 0.7) / np.tanh(0.7)
    return finish(L, R, 0.35, -1.0)

# ---------------------------------------------------------------- Schloss
def click(n, t0, lo, hi, dec, amp):
    out = np.zeros(n); i0 = int(t0 * SR); m = n - i0
    tt = np.arange(m) / SR
    out[i0:] = band(rng.standard_normal(m) * np.exp(-tt / dec), lo, hi) * amp
    return out

def lock(T=0.72, scale=1.0, slide=True):
    """Riegel schnappt satt zu (Spitze sofort), danach Gleiten + zwei leise Nachklicks der Zuhaltung."""
    n = int(SR * T); t = np.arange(n) / SR
    x = np.zeros(n)
    # 1) satter Clack: kurzer Breitband-Anschlag + tiefer Thump + Metallresonanz
    clack = band(rng.standard_normal(n) * np.exp(-t / 0.0022), 600, 7500) * 1.6
    thump = (np.sin(2 * np.pi * 118 * t) * np.exp(-t / 0.09) + 0.45 * np.sin(2 * np.pi * 74 * t) * np.exp(-t / 0.16)) * 0.85
    thump *= np.minimum(1, t / 0.0008)
    res = (mode(t, 880, 0.22, 0.20) + mode(t, 1590, 0.22, 0.15) + mode(t, 2380, 0.26, 0.10, 0.9) + mode(t, 3170, 0.12, 0.06)) * np.minimum(1, t / 0.0005)
    x += clack + thump + res
    # 2) Riegel gleitet nach (abfallend, leise) und zwei Nachklicks
    if slide:
        i0 = int(0.055 * SR); m = int(0.035 * SR); tt = np.arange(m) / SR
        x[i0:i0 + m] += band(rng.standard_normal(m), 1800, 5200) * 0.07 * np.exp(-tt / 0.02)
    x += click(n, 0.092 if slide else 0.075, 1800, 8500, 0.0013, 0.38)
    x += click(n, 0.150 if slide else 0.125, 2200, 9000, 0.0010, 0.22)
    i3 = int((0.092 if slide else 0.075) * SR); tt = np.arange(n - i3) / SR
    x[i3:] += mode(tt, 2950, 0.06, 0.05)
    dry = x
    L = dry + 0.10 * reverb(dry, 3, 0.5, 0.12)
    R = np.roll(dry, int(0.0008 * SR)) + 0.10 * reverb(dry, 4, 0.5, 0.12)
    return finish(L, R, 0.18, -1.0 + 20 * np.log10(scale))

# ---------------------------------------------------------------- Analyse
def analyse(name, st):
    mono = st.mean(1); n = len(mono)
    hop = int(0.005 * SR)
    env = np.array([np.max(np.abs(mono[i:i + hop])) for i in range(0, n, hop)])
    peak_t = np.argmax(np.abs(mono)) / SR
    pre = env[: max(1, int(np.argmax(env)))]
    rising_before = bool(len(pre) > 1 and np.any(np.diff(pre) > 0.02))
    # Spektral-Schwerpunkt in 50-ms-Fenstern
    W = int(0.05 * SR); cents = []
    for i in range(0, n - W, W):
        seg = mono[i:i + W] * np.hanning(W); S = np.abs(np.fft.rfft(seg)); f = np.fft.rfftfreq(W, 1 / SR)
        if S.sum() > 1e-6: cents.append(float((S * f).sum() / S.sum()))
    rms = np.sqrt(np.mean(mono ** 2))
    print(f"{name}: Laenge {n / SR:.2f}s, Spitze bei {peak_t * 1000:.1f} ms, Spitze {20 * np.log10(np.max(np.abs(st))):.1f} dBFS, RMS {20 * np.log10(rms):.1f} dBFS")
    print("  Huellkurve (5-ms-Schritte, erste 12):", " ".join(f"{v:.2f}" for v in env[:12]))
    print("  Anstieg vor der Spitze:", rising_before)
    print("  Schwerpunkt Hz je 50 ms:", " ".join(f"{c:.0f}" for c in cents[:12]))
    return cents

def spectrogram(st, path, title):
    from PIL import Image, ImageDraw
    mono = st.mean(1); W = 1024; hop = 128
    frames = [mono[i:i + W] * np.hanning(W) for i in range(0, len(mono) - W, hop)]
    S = np.abs(np.fft.rfft(np.array(frames), axis=1)).T
    S = 20 * np.log10(S + 1e-9); S -= S.max(); S = np.clip((S + 80) / 80, 0, 1)
    fmax_bin = int(12000 / (SR / W))
    S = S[:fmax_bin][::-1]
    img = (S * 255).astype(np.uint8)
    im = Image.fromarray(img).resize((900, 420))
    im = Image.merge("RGB", (im.point(lambda v: min(255, v * 1.2)), im, im.point(lambda v: v // 2)))
    d = ImageDraw.Draw(im); d.text((6, 4), title + " (0-12 kHz, x = Zeit)", fill=(255, 255, 255))
    im.save(path)

if __name__ == "__main__":
    os.makedirs(MEDIA, exist_ok=True)
    tmp = os.path.join(SCR, "sndtmp"); os.makedirs(tmp, exist_ok=True)
    a = anvil(); write_wav(os.path.join(tmp, "anvil.wav"), a); analyse("Amboss", a)
    spectrogram(a, os.path.join(tmp, "spec_anvil.png"), "Amboss")
    l = lock(); write_wav(os.path.join(tmp, "lock.wav"), l); analyse("Schloss", l)
    spectrogram(l, os.path.join(tmp, "spec_lock.png"), "Schloss")
    r = lock(T=0.45, scale=10 ** (-5 / 20), slide=False)   # Ankunft: kurz, ohne Gleiten, -6 dB
    write_wav(os.path.join(tmp, "arrive.wav"), r); analyse("Ankunft", r)
    encode(os.path.join(tmp, "anvil.wav"), os.path.join(MEDIA, "beam.ogg"), os.path.join(SCR, "previews", "Sound_Amboss.mp3"))
    encode(os.path.join(tmp, "lock.wav"), os.path.join(MEDIA, "lock.ogg"), os.path.join(SCR, "previews", "Sound_Schloss.mp3"))
    encode(os.path.join(tmp, "arrive.wav"), os.path.join(MEDIA, "arrive.ogg"))
    print("fertig")

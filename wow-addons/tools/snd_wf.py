# WindBaem-Sounds v2: kurzer, heller Kampfschrei "Baem!" (Kampfkunst-Stil), kein Bass-Einschlag.
# Eigene Formant-Synthese (Stimmlippen-Impulse -> Vokaltrakt-Resonanzen), keine Aufnahmen, keine echte Stimme nachgemacht.
#   baem  : schnell, ~0,3 s, Ruf faellt von oben (Standard)
#   hoch  : noch kuerzer und hoeher, scharfer Ansatz
# Lautheit: RMS des hoerbaren Teils -21 dBFS (LevelPilots Ankunft: -20), Spitze <= -6 dBFS.
# (LUFS geht nicht: ebur128 misst Klaenge unter 0,4 s nicht.)
# Aufruf: python3 -I tools/snd_wf.py   (aus wow-addons/)
import numpy as np, wave, subprocess, os, re
from scipy.signal import lfilter

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MEDIA = os.path.join(ROOT, "addons", "WindBaem", "Media")
PREV = os.path.join(ROOT, "previews")
TARGET_RMS = -24.0   # gemessen nach Vorbis-Mono-Mix = ca. -21


def env(t, pts):
    xs, ys = zip(*pts)
    return np.interp(t, xs, ys)


def glottal(f0, rng, open_q=0.45, close_q=0.12):
    """Rosenberg-Impulsfolge mit gleitender Tonhoehe, leichtem Jitter; abgeleitet (Lippenabstrahlung)."""
    jit = 1 + 0.006 * rng.standard_normal(len(f0))
    ph = np.cumsum(f0 * jit) / SR
    p = ph - np.floor(ph)
    g = np.where(p < open_q, 0.5 * (1 - np.cos(np.pi * p / open_q)),
                 np.where(p < open_q + close_q, np.cos(np.pi * (p - open_q) / (2 * close_q)), 0.0))
    return np.diff(g, prepend=0.0), p


def resonators(x, formants):
    """Kaskade aus 2-Pol-Resonatoren (Vokaltrakt)."""
    y = x
    for f, bw in formants:
        r = np.exp(-np.pi * bw / SR); th = 2 * np.pi * f / SR
        a = [1, -2 * r * np.cos(th), r * r]
        y = lfilter([1 - r], a, y)
    return y


def hp(x, fc):
    r = np.exp(-2 * np.pi * fc / SR)
    return lfilter([(1 + r) / 2, -(1 + r) / 2], [1, -r], x)


def shout(T, f0pts, voice_on, m_start, seed, bright=1.0):
    rng = np.random.default_rng(seed)
    n = int(SR * T); t = np.arange(n) / SR
    f0 = env(t, f0pts)
    src, ph = glottal(f0, rng)
    # Hauch (Kampfschrei = gepresst + Luft): Rauschen, im Takt der Stimmlippen moduliert
    asp = rng.standard_normal(n) * (0.35 + 0.65 * (ph < 0.5)) * 0.05 * bright
    exc = src + asp
    # Vokal AE (offen, gerufen: F1 hoch) und M (Lippen zu, nasal)
    AE = [(780, 90), (1720, 110), (2650, 150), (3600, 220), (4500, 300)]
    M = [(270, 60), (1150, 250), (2300, 350)]
    ae = resonators(exc, AE)
    m = resonators(exc, M) * 0.55
    ae /= np.max(np.abs(ae)); m /= np.max(np.abs(m))
    mix = np.clip((t - m_start) / 0.025, 0, 1)                  # schneller Lippenschluss -> M
    v = (1 - mix) * ae + mix * m
    amp = env(t, [(0, 0), (voice_on, 0), (voice_on + 0.012, 1.0), (m_start, 0.8), (m_start + 0.03, 0.45), (T - 0.03, 0.12), (T, 0)])
    v *= amp
    # B: kurzer Stimmton hinter geschlossenen Lippen + Verschluss-Loesung (Knack, hell)
    bar = resonators(src, [(180, 60)]) * env(t, [(0, 0), (0.004, 0.10), (voice_on, 0.10), (voice_on + 0.005, 0)])
    burst = hp(rng.standard_normal(n), 400) * np.exp(-np.maximum(t - voice_on, 0) / 0.004) * (t >= voice_on) * 0.25
    y = v + bar / (np.max(np.abs(bar)) + 1e-9) * 0.08 + burst
    y = np.tanh(1.6 * y) / np.tanh(1.6)                          # gepresst, ohne Matsch
    y = hp(y, 140)                                                # nichts Dumpfes
    # kleiner, kurzer Raum (keine Halle)
    L = int(0.18 * SR); tt = np.arange(L) / SR
    ir = rng.standard_normal(L) * np.exp(-tt / 0.045); ir[: int(0.008 * SR)] = 0; ir = hp(ir, 600)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet = np.convolve(y, ir)[:n]
    Lc = y + 0.10 * wet
    Rc = y + 0.10 * np.roll(wet, 23)
    k = int(0.02 * SR); fade = np.ones(n); fade[-k:] = np.cos(np.linspace(0, np.pi / 2, k)) ** 2
    st = np.stack([Lc * fade, Rc * fade], 1)
    return st / np.max(np.abs(st)) * 0.5


def active_rms(x):
    """RMS (dBFS) der 10-ms-Fenster, die hoechstens 20 dB unter dem lautesten liegen."""
    m = x.mean(1) if x.ndim == 2 else x
    w = 441; n = len(m) // w
    r = np.sqrt((m[: n * w].reshape(n, w) ** 2).mean(1))
    a = r[r > r.max() * 0.1]
    return 20 * np.log10(np.sqrt((a ** 2).mean()))


def decode(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def write(name, st):
    os.makedirs(MEDIA, exist_ok=True)
    wav = os.path.join(MEDIA, name + ".wav")

    def dump(x):
        with wave.open(wav, "wb") as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    gain = 10 ** ((TARGET_RMS - active_rms(st)) / 20)
    gain = min(gain, 10 ** (-6.0 / 20) / np.max(np.abs(st)))   # Spitze nie ueber -6 dBFS
    dump(st * gain)
    ogg = os.path.join(MEDIA, name + ".ogg")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "6", ogg], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-q:a", "2",
                    os.path.join(PREV, "Sound_WindBaem_" + name + ".mp3")], check=True)
    os.remove(wav)
    y = decode(ogg)
    print(name, "RMS %.1f dBFS  Spitze %.1f dBFS  %.2f s" % (active_rms(y), 20 * np.log10(np.max(np.abs(y))), len(y) / SR))


if __name__ == "__main__":
    # Ruf setzt nach 15 ms ein, Tonhoehe springt hoch und faellt (Kampfschrei), M ab 0,21 s
    write("baem", shout(0.32, [(0, 250), (0.015, 300), (0.05, 330), (0.20, 270), (0.32, 230)], 0.015, 0.21, 7))
    write("hoch", shout(0.26, [(0, 320), (0.010, 380), (0.04, 410), (0.16, 340), (0.26, 300)], 0.010, 0.165, 9, bright=1.3))

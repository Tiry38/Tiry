"""Sounddesign + Musik, komplett selbst erzeugt (keine Fremdlizenzen).
python3 tools/audio.py build/ev_main.json build/audio_main.wav
Musik: 100 BPM, A-Moll, Pad + Pluck-Arpeggio + weicher Kick; UI-Ticks, mechanische Klicks, Freilauf, Motorsummen."""
import json, sys, numpy as np
SR = 48000
rs = np.random.default_rng(7)
ev = json.load(open(sys.argv[1])); out = sys.argv[2]; NOBGM = '--nobgm' in sys.argv
import subprocess, os
MIX = os.environ.get('MIXKIT', '/root/.claude/plugins/synced/7f8b61a0-ca0f-464b-bd68-09fe3affcc3a_4a6d179b-84d6-4884-87c1-abcfc68dc82d/74655670-1540-4e3d-8509-c2f446898c2c/assets/audio/sfx')
_cache = {}
def smp(name):  # Mixkit-Sample (Mixkit Sound Effects Free License) als Mono-Array, Spitze = 1
    if name not in _cache:
        p = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'{MIX}/{name}.mp3', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
        a = np.frombuffer(p, np.float32).copy(); _cache[name] = a / max(1e-6, np.abs(a).max())
    return _cache[name]
T = ev['T']; N = int((T + 1.5) * SR)
mus = np.zeros((N, 2)); fx = np.zeros((N, 2))

def env(n, a, d):
    e = np.ones(n); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na)
    e *= np.exp(-np.arange(n) / (d * SR)); return e
def lp(x, fc):  # einpoliger Tiefpass
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); s = 0.0
    for i in range(len(x)): s = (1 - a) * x[i] + a * s; y[i] = s
    return y
def lpf(x, fc):  # schneller Tiefpass via FFT (Blockweise reicht)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / np.sqrt(1 + (f / fc) ** 4); return np.fft.irfft(X, len(x))
def bp(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= ((f > lo) & (f < hi)); return np.fft.irfft(X, len(x))
def put(buf, t, sig, gain=1.0, pan=0.0):
    i = int(t * SR); sig = sig[: max(0, N - i)]
    if i < 0 or len(sig) == 0: return
    l = np.sqrt(0.5 * (1 - pan)); r = np.sqrt(0.5 * (1 + pan))
    buf[i:i + len(sig), 0] += sig * gain * l; buf[i:i + len(sig), 1] += sig * gain * r
nf = lambda f: 440 * 2 ** ((f - 69) / 12)

# ---------- Musik ----------
bpm = 100; beat = 60 / bpm; bar = beat * 4
scenes = ev['scenes']; sc = {s['k']: s for s in scenes}
t_motor = sc['motor']['t0']; t_cfg = [s for s in scenes if s['k'] == 'tab'][0]['t0']
t_color = ev.get('color') or t_cfg + 20; t_sum = sc['summary']['t0']; t_out = sc['outro']['t0']
chords = [[57, 60, 64, 71], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 67]]  # Am(add9) F C G
t = np.arange(int(bar * SR)) / SR
def pad_chord(notes, length):
    n = int(length * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    for m in notes:
        for det in (-0.07, 0.07):
            f = nf(m) * 2 ** (det / 12); s += ((tt * f) % 1 * 2 - 1)
    s = lpf(s, 900) * 0.035; a = np.minimum(1, tt / 0.8) * np.minimum(1, (length - tt) / 0.6); return s * a
k = 0; tb = 0.0
while tb < T:
    ch = chords[k % 4]; seg = pad_chord(ch, bar + 0.6)
    lvl = 0.55 if tb < t_motor else (0.8 if tb < t_color else 1.0)
    if tb > t_out: lvl *= max(0, 1 - (tb - t_out) / 8)
    put(mus, tb, seg, lvl, -0.2 if k % 2 else 0.2)
    # Bass
    if tb >= t_motor - 0.01:
        n = int(bar * SR); tt = np.arange(n) / SR; b = np.sin(2 * np.pi * nf(ch[0] - 24) * tt) * 0.16 * np.minimum(1, tt / 0.05) * np.exp(-tt / 2.2)
        put(mus, tb, b, 1.0 if tb < t_out else 0.6)
    # Arpeggio (Pluck) ab Konfigurator
    if t_cfg - bar <= tb < t_out + bar:
        for i in range(16):
            m = ch[[0, 1, 2, 3, 2, 1, 3, 2][i % 8]] + (12 if i % 4 == 3 else 0)
            n = int(0.35 * SR); tt = np.arange(n) / SR; f = nf(m + 12)
            pl = (np.sign(np.sin(2 * np.pi * f * tt)) * 0.3 + np.sin(2 * np.pi * f * tt)) * np.exp(-tt / 0.09) * 0.045
            put(mus, tb + i * beat / 4, pl, 0.7 if tb < t_color else 1.0, 0.35 if i % 2 else -0.35)
    # Kick + Hat
    if t_cfg <= tb < t_out:
        for i in range(4):
            n = int(0.4 * SR); tt = np.arange(n) / SR; f = 50 + 70 * np.exp(-tt / 0.03)
            kk = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.16) * 0.42; put(mus, tb + i * beat, kk)
            if tb >= t_color:
                h = bp(rs.standard_normal(int(0.05 * SR)), 7000, 14000) * np.exp(-np.arange(int(0.05 * SR)) / (0.012 * SR)) * 0.05
                put(mus, tb + i * beat + beat / 2, h, 1, 0.3)
    tb += bar; k += 1

# ---------- SFX ----------
def tick(f=2600, d=0.018, g=0.25):
    n = int(0.06 * SR); tt = np.arange(n) / SR; return (np.sin(2 * np.pi * f * tt) * np.exp(-tt / d) + bp(rs.standard_normal(n), 2000, 9000) * np.exp(-tt / 0.004) * 0.5) * g
def mech(g=0.4):
    n = int(0.25 * SR); tt = np.arange(n) / SR; s = bp(rs.standard_normal(n), 600, 3500) * np.exp(-tt / 0.012)
    s += np.sin(2 * np.pi * 180 * tt) * np.exp(-tt / 0.03) * 0.6; s2 = np.roll(s, int(0.035 * SR)) * 0.55; return (s + s2) * g
def whoosh(d=0.7, lo=300, hi=5000, g=0.18):
    n = int(d * SR); tt = np.arange(n) / SR; x = rs.standard_normal(n); o = np.zeros(n); steps = 40
    for i in range(steps):
        a, b = i * n // steps, (i + 1) * n // steps; fc = lo + (hi - lo) * np.sin(np.pi * (i + .5) / steps)
        o[a:b] = bp(x, fc * .7, fc * 1.3)[a:b]
    return o * np.sin(np.pi * tt / d) ** 2 * g
def hum(d=2.2, g=0.16):
    n = int(d * SR); tt = np.arange(n) / SR; f = 90 + 140 * (1 - np.exp(-tt / 0.5)); ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.15 * np.sin(5 * ph); return s * np.minimum(1, tt / .3) * np.minimum(1, (d - tt) / .8) * g
def thump(g=0.5):
    n = int(0.5 * SR); tt = np.arange(n) / SR; f = 40 + 60 * np.exp(-tt / 0.05); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / .18) * g
def ratchet(d=2.0, g=0.12):
    n = int(d * SR); o = np.zeros(n); tt = 0.0
    while tt < d - 0.02:
        rate = 30 * np.exp(-tt / 1.2) + 6; c = tick(3200 + rs.random() * 600, 0.004, 1)[: int(0.02 * SR)]
        i = int(tt * SR); o[i:i + len(c)] += c[: n - i]; tt += 1 / rate
    return o * np.minimum(1, (d - np.arange(n) / SR) / .5) * g
def swell(d=2.6, g=0.22):
    n = int(d * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    for m in (69, 76, 81, 88): s += np.sin(2 * np.pi * nf(m) * tt + np.sin(2 * np.pi * 5 * tt) * .3)
    return s / 4 * (tt / d) ** 1.5 * np.exp(-np.maximum(0, tt - d * .8) / .2) * g

for e in ev['sfx']:
    t0, k = e['t'], e['k']
    if k == 'tick': put(fx, t0 - .01, smp('ui/switch-click-quick'), .32, .25)
    elif k == 'hover': put(fx, t0, smp('ui/switch-tap'), .12, .25)
    elif k == 'select': put(fx, t0 - .01, smp('ui/ui-option-select'), .3, .25); put(fx, t0 + .02, smp('mech/gear-lock-metallic'), .22, 0)
    elif k == 'build': put(fx, t0 - .08, smp('transition/sweep-metal-quick'), .22, -0.2); put(fx, t0 + .55, smp('mech/lock-quick'), .2, -0.1)
    elif k == 'color': put(fx, t0 - .4, swell(2.6, .14)); put(fx, t0 - .1, smp('light/shimmer-sparkle-sweep'), .3, .2); put(fx, t0, smp('transition/air-woosh-deep'), .3, -.2)
    elif k == 'tab': put(fx, t0, smp('transition/sweep-short'), .14, .1)
    elif k == 'rise':
        put(fx, t0 + 1.35, smp('impact/bass-hit-futuristic'), .35)
        for i in range(4): put(fx, t0 + 1.4 + i * .22, thump(.25), 1, -0.5 + i * .33)
    elif k == 'hum': put(fx, t0 - .2, hum(2.4, .12)); put(fx, t0 - .1, smp('mech/mech-tech-movement'), .22)
    elif k == 'ui': put(fx, t0, smp('transition/transition-tech-slide'), .22, .5)
    elif k == 'scan': put(fx, t0 + .3, smp('transition/transition-soft'), .2, 0)
    elif k == 'free': put(fx, t0 + .2, ratchet(2.2, .1), 1, .1)
    elif k == 'sum': put(fx, t0, smp('light/light-aura'), .22)
if ev.get('beam'): put(fx, ev['beam'] - .02, smp('ui/switch-light'), .35); put(fx, ev['beam'], hum(1.5, .04))
if NOBGM: mus[:] = 0
# Ducking der Musik unter SFX
envfx = np.abs(fx).max(axis=1); envfx = lpf(envfx, 6); duck = 1 - np.clip(envfx * 1.6, 0, .45)
mix = mus * duck[:, None] * 0.9 + fx
fade = np.ones(N); fl = int(1.0 * SR); end = int(T * SR); fade[end - fl:end] = np.linspace(1, 0, fl); fade[end:] = 0
mix *= fade[:, None]; mix = mix[:end]
pk = np.abs(mix).max(); mix = mix / pk * 0.89
import wave
w = wave.open(out, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((mix * 32767).astype('<i2').tobytes()); w.close()
print(out, round(T, 2), 's, peak normiert')

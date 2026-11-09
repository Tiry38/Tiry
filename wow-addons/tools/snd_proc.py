# ProcAlarm-Ton: "Schattenglocke" (ca. 1,1 s) fuer Schattentrance.
# Tiefer weicher Anschlag + dunkle Glocke in Moll (D-F-A) + kurzes aufsteigendes Funkeln, mit Raum.
# Nutzt die Helfer aus snd2.py. Start: python3 -I tools/snd_proc.py
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
from snd2 import SR, band, mode, reverb, finish, write_wav, encode, analyse

SCR = os.path.dirname(HERE)
MEDIA = os.path.join(SCR, "addons", "ProcAlarm", "Media")


def bell(t, f0, amp, dec, t0=0.0):
    """Glocke mit inharmonischen Teiltoenen, setzt bei t0 ein."""
    tt = np.maximum(t - t0, 0)
    on = (t >= t0).astype(float)
    att = 1 - np.exp(-tt / 0.004)                      # 4 ms weicher Anschlag, kein Klick
    y = (mode(tt, f0, 1.0, dec, beat=0.7)
         + mode(tt, f0 * 2.01, 0.45, dec * 0.6)
         + mode(tt, f0 * 2.76, 0.30, dec * 0.42, beat=1.3)
         + mode(tt, f0 * 5.40, 0.10, dec * 0.18))
    return amp * y * att * on


def proc_sound(T=1.15):
    n = int(T * SR); t = np.arange(n) / SR
    # tiefer Impuls (gedaempft, kein Wummern)
    sub = mode(t, 73.4, 0.55, 0.09) * (1 - np.exp(-t / 0.003))
    thump = band(np.random.default_rng(7).standard_normal(n) * np.exp(-t / 0.025), 90, 900) * 0.25
    # dunkle Glocke D4-F4-A4, leicht versetzt (gerollt)
    chord = bell(t, 293.66, 0.55, 0.42) + bell(t, 349.23, 0.42, 0.38, 0.018) + bell(t, 440.0, 0.36, 0.34, 0.036)
    # aufsteigendes Funkeln (D6, F6, A6, D7) - kurz, leise
    spark = sum(bell(t, f, 0.11, 0.09, t0) for f, t0 in ((1174.7, 0.07), (1396.9, 0.12), (1760.0, 0.17), (2349.3, 0.22)))
    dry = sub + thump + chord + spark
    dry = band(dry, 45, 9000)
    L = 0.82 * dry + 0.30 * reverb(dry, 11, length=0.8, tau=0.20)
    R = 0.82 * dry + 0.30 * reverb(dry, 29, length=0.8, tau=0.20)
    return finish(L, R, fade_s=0.30, peak_db=-1.5)


if __name__ == "__main__":
    os.makedirs(MEDIA, exist_ok=True)
    tmp = os.path.join(SCR, "sndtmp"); os.makedirs(tmp, exist_ok=True)
    s = proc_sound(); wav = os.path.join(tmp, "proc.wav")
    write_wav(wav, s); analyse("Schattenglocke", s)
    encode(wav, os.path.join(MEDIA, "trance.ogg"), os.path.join(SCR, "previews", "Sound_Schattentrance.mp3"))
    print("fertig")

import numpy as np, wave
SR=44100; rng=np.random.default_rng(11)
T=2.8; n=int(SR*T); t=np.arange(n)/SR
hit=0.42  # Zeitpunkt des Schlags (davor: Aufladen)
ti=np.clip(t-hit,0,None); on=(t>=hit).astype(float)
# 1) Aufladen: rueckwaerts laufender Metall-Schimmer, schwillt zum Schlag an
sw=np.zeros(n); m=t<hit
noise=rng.standard_normal(n)
hp=noise-np.convolve(noise,np.ones(8)/8,"same")
sw=hp*np.clip(t/hit,0,1)**3*m*0.35
for f in (1640,2460,3330): sw+=np.sin(2*np.pi*f*t)*np.clip(t/hit,0,1)**4*m*0.08
# 2) Aufprall: harter Transient
click=on*np.exp(-ti/0.004)*rng.standard_normal(n)*1.4
# 3) Amboss-Klang: unharmonische Teiltoene mit Schwebung
ring=np.zeros(n)
for r,amp,dec in [(1,1.0,1.7),(2.37,0.7,1.2),(3.81,0.55,0.85),(5.2,0.35,0.6),(6.73,0.25,0.45),(8.4,0.18,0.3),(10.9,0.1,0.2)]:
    f=780*r
    ring+=amp*(np.sin(2*np.pi*f*ti)+0.6*np.sin(2*np.pi*(f+1.3)*ti))*np.exp(-ti/dec)
ring*=on*0.55
# 4) Tiefer Wumms mit Tonhoehen-Abfall
f_boom=38+30*np.exp(-ti/0.08); ph=2*np.pi*np.cumsum(f_boom)/SR
boom=on*np.sin(ph)*np.exp(-ti/0.45)*1.3+on*np.sin(ph*0.5)*np.exp(-ti/0.6)*0.6
# 5) Funkenregen: kurze helle Klicks kurz nach dem Schlag
sp=np.zeros(n)
for k in range(28):
    t0=hit+0.03+rng.exponential(0.25); i0=int(t0*SR)
    if i0<n-2000:
        L=1500; tt=np.arange(L)/SR; f=rng.uniform(4500,9000)
        sp[i0:i0+L]+=np.sin(2*np.pi*f*tt)*np.exp(-tt/0.012)*rng.uniform(0.05,0.15)
dry=sw+click+ring+boom+sp
# 6) Hall: Faltung mit abklingendem Rauschen (Stereo dekorreliert)
def reverb(x,seed):
    r=np.random.default_rng(seed); L=int(SR*2.2); tt=np.arange(L)/SR
    ir=r.standard_normal(L)*np.exp(-tt/0.55); ir-=np.convolve(ir,np.ones(30)/30,"same")*0.6
    ir/=np.sqrt(np.sum(ir**2))
    y=np.fft.irfft(np.fft.rfft(x,n+L)*np.fft.rfft(ir,n+L))[:n]; return y
L=dry+0.55*reverb(dry,1); R=dry+0.55*reverb(dry,2)
st=np.stack([L,R],1); st/=np.max(np.abs(st)); st=np.tanh(st*1.6)/np.tanh(1.6)*0.92
fade=np.ones(n); fade[-int(0.3*SR):]=np.linspace(1,0,int(0.3*SR)); st*=fade[:,None]
with wave.open("anvil.wav","wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st*32767).astype(np.int16).tobytes())
print("ok")

import numpy as np, wave
SR=44100
def env(n,a,d):
    t=np.arange(n)/SR; e=np.minimum(1,t/a)*np.exp(-np.maximum(0,t-a)/d); return e
def write(name,x):
    x=x/np.max(np.abs(x))*0.85
    st=(np.clip(x,-1,1)*32767).astype(np.int16)
    with wave.open(name,"wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())
rng=np.random.default_rng(7)
# --- Strahl erscheint: aufsteigendes Rauschen + gleitender Glanz + Kristallglocke
T=1.6; n=int(SR*T); t=np.arange(n)/SR
noise=rng.standard_normal(n)
# gleitender Bandpass ueber Differenzen verschiedener Glaettungen
out=np.zeros(n)
for k,(lo,hi) in enumerate([(400,900),(900,2000),(2000,4500)]):
    w1=int(SR/hi); w2=int(SR/lo)
    a=np.convolve(noise,np.ones(w1)/w1,"same")-np.convolve(noise,np.ones(w2)/w2,"same")
    gate=np.clip((t-0.12*k)/0.35,0,1)*np.exp(-np.maximum(0,t-0.45-0.1*k)/0.25)
    out+=a*gate*(0.5+0.25*k)
whoosh=out*0.6
f0=520*np.power(2,np.clip(t/0.55,0,1)*1.15)            # Glissando aufwaerts
phase=2*np.pi*np.cumsum(f0)/SR
trem=0.75+0.25*np.sin(2*np.pi*9*t)
shim=(np.sin(phase)+0.5*np.sin(2*phase)+0.3*np.sin(1.5*phase))*trem*env(n,0.05,0.5)*0.55
bell=np.zeros(n); start=int(0.42*SR); tb=np.arange(n-start)/SR
for r,amp,dec in [(1,1,0.9),(2.76,0.45,0.45),(5.4,0.25,0.25),(8.93,0.12,0.15)]:
    bell[start:]+=amp*np.sin(2*np.pi*1318*r*tb)*np.exp(-tb/dec)
bell*=0.7
mono=whoosh+shim+bell
L=mono+0.15*np.roll(bell,int(0.004*SR)); R=mono+0.15*np.roll(shim,int(0.006*SR))
fade=np.ones(n); fade[-int(0.2*SR):]=np.linspace(1,0,int(0.2*SR))
write("beam.wav",np.stack([L*fade,R*fade],1).ravel())
# --- Angekommen: zwei helle Toene (Quinte) mit Glitzer
T=0.9; n=int(SR*T); t=np.arange(n)/SR; x=np.zeros(n)
for st,f in [(0,880),(0.11,1318)]:
    s=int(st*SR); tt=np.arange(n-s)/SR
    for r,amp,dec in [(1,1,0.35),(2,0.35,0.2),(3,0.15,0.12)]:
        x[s:]+=amp*np.sin(2*np.pi*f*r*tt)*np.exp(-tt/dec)*np.minimum(1,tt/0.004)
write("arrive.wav",np.stack([x,np.roll(x,int(0.003*SR))],1).ravel())
print("ok")

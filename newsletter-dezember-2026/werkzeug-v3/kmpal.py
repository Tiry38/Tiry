import numpy as np
def kmeans_pal(frames,k=255,n=120000,it=20,seed=1):
    X=np.concatenate([np.asarray(f).reshape(-1,3) for f in frames]).astype(np.float32)
    rng=np.random.default_rng(seed);S=X[rng.choice(len(X),min(n,len(X)),replace=False)]
    C=S[rng.choice(len(S),k,replace=False)].copy()
    for _ in range(it):
        lab=np.empty(len(S),np.int32)
        for i in range(0,len(S),20000):
            b=S[i:i+20000];d=(b*b).sum(1)[:,None]-2*b@C.T+(C*C).sum(1)[None];lab[i:i+20000]=d.argmin(1)
        cnt=np.bincount(lab,minlength=k);sm=np.zeros_like(C)
        for c in range(3): sm[:,c]=np.bincount(lab,weights=S[:,c],minlength=k)
        e=cnt==0;C[~e]=sm[~e]/cnt[~e,None]
        if e.any(): C[e]=S[rng.choice(len(S),e.sum(),replace=False)]
    return np.clip(np.round(C),0,255).astype(np.uint8)
def bayer(h,w,amp):
    M=np.array([[0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],[12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],[3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],[15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21]],np.float32)/64-.5+1/128
    return (np.tile(M,(h//8+1,w//8+1))[:h,:w]*amp)[...,None]

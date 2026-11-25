from PIL import Image, ImageFilter
import numpy as np, math, json
im=np.asarray(Image.open('a/rest-04.webp').convert('RGBA')).astype(np.float32)
H,W=im.shape[:2]; out=im.copy()
wh=json.load(open('wheels.json'))
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
def inarc(th,a0,a1):  # Winkelbereich a0->a1 (Grad, im Uhrzeigersinn steigend, darf ueber 180 laufen)
    d=(th-a0)%360; return d<=((a1-a0)%360)
def bil(img,x,y):
    x=np.clip(x,0,W-1.001);y=np.clip(y,0,H-1.001);x0=np.floor(x).astype(int);y0=np.floor(y).astype(int);fx=(x-x0)[...,None];fy=(y-y0)[...,None]
    return img[y0,x0]*(1-fx)*(1-fy)+img[y0,x0+1]*fx*(1-fy)+img[y0+1,x0]*(1-fx)*fy+img[y0+1,x0+1]*fx*fy
rgbf=im[...,:3];lum=rgbf.mean(2);frameish=((rgbf[...,2]-rgbf[...,0])>5)&(lum>48)
def poly_mask(pts):
    from PIL import ImageDraw
    m=Image.new('L',(W,H),0);ImageDraw.Draw(m).polygon(pts,fill=255);return np.asarray(m)>0
fork=poly_mask([(818,150),(895,150),(990,470),(922,470)])   # Gabel vom Steuerrohr bis Ausfallende
seat=poly_mask([(418,60),(462,60),(496,368),(454,368)])      # Sattelrohr/Sattelstuetze
protect=frameish|fork|seat
# 1) Gepaecktraeger oben + Ruecklicht wegnehmen
box=(xx>=78)&(xx<=345)&(yy>=155)&(yy<=236)&~protect; out[box,3]=0
# 2) Streben des Traegers zwischen den Speichen: dicke dunkle Linien (Oeffnung entfernt duenne Speichen)
rgb=im[...,:3];dark=(rgb.max(2)<70)&(im[...,3]>100)
reg=(xx>=95)&(xx<=270)&(yy>=200)&(yy<=445)
m=Image.fromarray(((dark&reg)*255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MaxFilter(5))
sm=np.asarray(m)>0
# Kassette/Nabe/Rahmen schuetzen: nur deutlich oberhalb der Nabe
sm&=(yy<425)&~protect
out[sm,3]=0
for key,cover in [('rear',(-166,6)),('front',(156,-38))]:
    cx,cy,R=wh[key]
    dx=xx-cx;dy=yy-cy;r=np.sqrt(dx*dx+dy*dy);th=np.degrees(np.arctan2(dy,dx))
    cov=inarc(th,*cover)
    out[cov&inarc(th,cover[0],(-16 if key=='rear' else cover[1]))&(r>R*1.0)&(r<=R*1.22)&~protect,3]=0
    band=cov&(r>=R*0.84)&(r<=R*1.01)&~fork&~seat&~(frameish&(xx>320)&(xx<520)&(key=='rear'))
    span=(cover[1]-cover[0])%360; d=(th-cover[0])%360
    w=np.clip(np.minimum(d,span-d)/12.0,0,1)[...,None]
    samp=bil(im,2*cx-xx,2*cy-yy)          # Rad 180 Grad um die Nabe gedreht
    if key=='rear':                        # links oben: an der Nabe gespiegelt (Quelle unten links, ohne Kette)
        mir=bil(im,xx,2*cy-yy); k=np.clip((th+128)/-10,0,1)[...,None]   # -166..-138 Spiegel, ab -128 Drehung
        samp=mir*k+samp*(1-k)
    out[band]=samp[band]*w[band]+out[band]*(1-w[band])
# Speichen oben links im Hinterrad aus unterer Haelfte spiegeln (Streben weg)
cx,cy,R=wh['rear'];dx=xx-cx;dy=yy-cy;r=np.sqrt(dx*dx+dy*dy);th=np.degrees(np.arctan2(dy,dx))
tgt=(th>=-172)&(th<=-52)&(r>=R*0.20)&(r<R*0.857)&~protect
d=(th+172)%24; ths=np.radians(126+d)   # Quelle: sauberer Bereich unten links (112..168 Grad)
samp=bil(im,cx+r*np.cos(ths),cy+r*np.sin(ths))
out[tgt]=samp[tgt]
stub=(xx>=426)&(xx<=463)&(yy>=300)&(yy<=375)&(lum<75)
cxr,cyr,Rr=wh['rear'];rr=np.sqrt((xx-cxr)**2+(yy-cyr)**2)
out[stub&(rr>Rr*1.005),3]=0
thr=np.degrees(np.arctan2(yy-cyr,xx-cxr))
fend=(thr>=-34)&(thr<=7)&(rr>Rr*1.008)&(rr<Rr*1.13)&(yy<452)&~seat
fend&=~(frameish&(lum>70))
out[fend,3]=0
out[(xx>=423)&(xx<=449)&(yy>=286)&(yy<=318),3]=0
# Rahmen zurueckholen: blaugrauer Lack aus dem Original im Bereich Sattelrohr/Sitzstreben
orig=im; ob=orig[...,2]-orig[...,0]
keep=(xx>=360)&(xx<=520)&(yy>=180)&(yy<=480)&(ob>6)&(orig[...,:3].mean(2)>55)&(orig[...,3]>200)
kp=Image.fromarray((keep*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
keep=np.asarray(kp)>0
out[keep]=orig[keep]
res=Image.fromarray(out.clip(0,255).astype(np.uint8),'RGBA')
res.save('a/rest-04-ohne.webp',quality=95)
bg=Image.new('RGBA',res.size,(255,255,255,255));bg.alpha_composite(res);bg.convert('RGB').save('/tmp/claude-0/-home-user/81f098d1-e8e1-5590-ae66-e9aa510acead/scratchpad/ant4.png')

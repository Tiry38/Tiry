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
seat=poly_mask([(395,60),(470,60),(520,360),(440,360)])      # Sattelrohr/Sattelstuetze
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
for key,cover,src in [('rear',(-170,-24),(50,150)),('front',(160,-42),(18,140))]:
    cx,cy,R=wh[key]
    dx=xx-cx;dy=yy-cy;r=np.sqrt(dx*dx+dy*dy);th=np.degrees(np.arctan2(dy,dx))
    cov=inarc(th,*cover)
    # Blech ausserhalb des Reifens weg (bis 1.2 R)
    out[cov&(r>R*1.0)&(r<=R*1.2)&~protect,3]=0
    # Reifenband aus sauberem Bereich nachbilden
    band=cov&(r>=R*0.855)&(r<=R*1.006)&~fork&~seat
    span_s=(src[1]-src[0])%360; span_c=(cover[1]-cover[0])%360
    d=(th-cover[0])%360
    ths=np.radians(src[0]+(d%span_s))
    sx=cx+r*np.cos(ths);sy=cy+r*np.sin(ths)
    samp=bil(im,sx,sy)
    out[band]=samp[band]
    # weicher Rand an der Aussenkante
    edge=cov&(r>R*0.995)&(r<=R*1.006)&~fork&~seat
    out[edge,3]=np.minimum(out[edge,3],255*(1-(r[edge]-R*0.995)/(R*0.011)))
# Speichen oben links im Hinterrad aus unterer Haelfte spiegeln (Streben weg)
cx,cy,R=wh['rear'];dx=xx-cx;dy=yy-cy;r=np.sqrt(dx*dx+dy*dy);th=np.degrees(np.arctan2(dy,dx))
tgt=(th>=-172)&(th<=-52)&(r>=R*0.20)&(r<R*0.857)&~protect
d=(th+172)%24; ths=np.radians(126+d)   # Quelle: sauberer Bereich unten links (112..168 Grad)
samp=bil(im,cx+r*np.cos(ths),cy+r*np.sin(ths))
out[tgt]=samp[tgt]
res=Image.fromarray(out.clip(0,255).astype(np.uint8),'RGBA')
res.save('a/rest-04-ohne.webp',quality=95)
bg=Image.new('RGBA',res.size,(255,255,255,255));bg.alpha_composite(res);bg.convert('RGB').save('/tmp/claude-0/-home-user/81f098d1-e8e1-5590-ae66-e9aa510acead/scratchpad/ant4.png')

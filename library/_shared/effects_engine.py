"""Original deterministic OpenCV finishing effects. BGR uint8, integer global frames.
HyperFrames owns composition/capture. This module never touches audio or the presenter.
"""
import math
from functools import lru_cache
import cv2
import numpy as np

VERSION = 1
SPATIAL = ('vhs','night_vision','thermal','edge_hud','cyber_poster','halftone','neon_bloom','chroma_bars','rgb_split','hologram','flash','cool_grade','grain','bloom','halation','vignette','chromatic','light_leak','scanlines','glitch','zoom_blur','whip','prism','iris','ripple','focus','letterbox','pixel_stretch','pixelate','glass','film_burn','shutter','camera_shake','duotone','neon_edges','parallax','crt')
TEMPORAL = ('pause','rewind','echo')
CATALOG = SPATIAL + TEMPORAL
cv2.setNumThreads(1)

def unit(x): return float(np.clip(x,0,1))
def smooth(x):
    x=unit(x);return x*x*(3-2*x)
def u8(a): return np.clip(np.rint(a),0,255).astype(np.uint8)
@lru_cache(maxsize=8)
def grid(h,w):
    y,x=np.mgrid[0:h,0:w].astype(np.float32)
    return x,y,(x/(w-1)-.5)*2,(y/(h-1)-.5)*2

def effect(name,img,progress,amount=1,frame=0,seed=1):
    """Stateless spatial effect. Zero amount is bit-identical. No source mutation."""
    if name not in SPATIAL: raise ValueError('Unknown spatial effect: '+name)
    if img.dtype!=np.uint8 or img.ndim!=3 or img.shape[2]!=3: raise ValueError('Expected BGR uint8 image')
    if not math.isfinite(amount) or not 0<=amount<=1: raise ValueError('amount must be 0..1')
    if amount==0:return img.copy()
    p=unit(progress);h,w=img.shape[:2];x,y,nx,ny=grid(h,w);a=float(amount)
    rng=np.random.default_rng(np.random.SeedSequence([int(seed),int(frame)]))
    f=img.astype(np.float32)/255
    if name=='pixel_stretch':
        # Sample a moving column, extending its actual colors into the right wing.
        seam=int(w*(.25+.5*p));extent=int((w-seam)*a)
        out=img.copy()
        if extent:out[:,seam:seam+extent]=img[:,seam:seam+1]
        return out
    if name=='pixelate':
        size=max(1,int(1+a*w*.045));small=cv2.resize(img,(max(1,w//size),max(1,h//size)),interpolation=cv2.INTER_AREA)
        return cv2.resize(small,(w,h),interpolation=cv2.INTER_NEAREST)
    if name=='glass':
        dx=np.sin(nx*16+p*5)*w*.025*a;dy=np.cos(ny*11-p*4)*h*.012*a
        bent=cv2.remap(img,x+dx,y+dy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
        return cv2.GaussianBlur(bent,(0,0),max(.1,w*.006*a))
    if name=='film_burn':
        edge=-1.6+3.2*p;noise=np.sin(ny*7+p*4)*.15+np.sin(ny*19)*.04
        band=np.exp(-((nx-edge+noise)/.22)**2)*a
        warm=np.stack([band**3,band**1.7,band],axis=2)
        return u8((1-(1-f)*(1-warm))*255)
    if name=='shutter':
        # One authored shutter closure, not an automatic flashing loop.
        out=img.copy();closed=int(h*.5*a);out[:closed]=0
        if closed:out[h-closed:]=0
        return out
    if name=='camera_shake':
        dx=math.sin(frame*1.73)*w*.012*a;dy=math.cos(frame*1.17)*h*.008*a
        m=cv2.getRotationMatrix2D((w/2,h/2),math.sin(frame*.83)*a,1+.05*a);m[:,2]+=[dx,dy]
        return cv2.warpAffine(img,m,(w,h),borderMode=cv2.BORDER_REFLECT_101)
    if name=='duotone':
        lum=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY)[...,None]
        tone=np.array([.18,.07,.03])*(1-lum)+np.array([.84,.96,.65])*lum
        return u8((f*(1-a)+tone*a)*255)
    if name=='neon_edges':
        edges=cv2.Canny(img,70,160).astype(np.float32)/255
        glow=cv2.GaussianBlur(edges,(0,0),max(1,w*.005));light=(edges*.4+glow*2)[...,None]*np.array([1.,.6,.8])*a
        return u8((1-(1-f)*(1-np.clip(light,0,1)))*255)
    if name=='parallax':
        # Nested frame planes; not depth inferred from a single photograph.
        out=img.copy()
        for k in range(3,0,-1):
            scale=1-k*.09*a;m=cv2.getRotationMatrix2D((w/2,h/2),k*a*math.sin(p*math.pi)*2,scale)
            plane=cv2.warpAffine(img,m,(w,h));mask=cv2.warpAffine(np.ones((h,w),np.uint8)*255,m,(w,h))
            out[mask>250]=plane[mask>250]
        return out
    if name=='crt':
        r=nx*nx+ny*ny;out=cv2.remap(img,x+nx*r*w*.025*a,y+ny*r*h*.025*a,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
        return effect('scanlines',effect('chromatic',out,p,a*.4,frame,seed),p,a,frame,seed)
    if name=='vhs':
        # Tape playback: colour bleeding sideways, a rolling tracking band and soft luma noise.
        out=f.copy();k=max(1,int(w*.02*a))|1
        out[:,:,2]=np.roll(cv2.blur(f[:,:,2],(k,1)),int(w*.008*a),axis=1);out[:,:,0]=np.roll(cv2.blur(f[:,:,0],(k,1)),-int(w*.008*a),axis=1)
        band=np.exp(-(((y/h-(frame*.013)%1.2+.1))/.035)**2)*a
        out=cv2.remap(out,x+band*w*.06,y,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
        out+=rng.normal(0,.04*a,(h,1,1)).astype(np.float32)+band[...,None]*.18
        return u8(out*255)
    if name=='night_vision':
        # Green phosphor scope: boosted luminance, grain and a hard circular falloff.
        lum=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY);lum=np.clip(lum*1.5+rng.normal(0,.05,(h,w)).astype(np.float32),0,1)
        scope=np.clip(1.25-(nx*nx+ny*ny)*.8,0,1);tone=np.stack([lum*.25,lum,lum*.35],axis=2)*scope[...,None]
        return u8((f*(1-a)+tone*a)*255)
    if name=='thermal':
        # False-colour heat camera: brightness mapped through a cold-to-hot palette.
        lum=cv2.GaussianBlur(cv2.cvtColor(img,cv2.COLOR_BGR2GRAY),(0,0),max(1,w*.006))
        heat=cv2.applyColorMap(lum,cv2.COLORMAP_INFERNO).astype(np.float32)/255
        return u8((f*(1-a)+heat*a)*255)
    if name=='edge_hud':
        # The picture darkens and its outlines are redrawn in glowing cyan, as if being analysed.
        edges=cv2.Canny(cv2.GaussianBlur(img,(0,0),1.2),50,130).astype(np.float32)/255
        glow=cv2.GaussianBlur(edges,(0,0),max(1,w*.004));lines=np.clip(edges+glow*1.6,0,1)[...,None]*np.array([1.,.94,.24],np.float32)
        return u8(np.clip(f*(1-a*.72)+lines*a,0,1)*255)
    if name=='cyber_poster':
        # Flattens the picture into a few bands of the theme colours: ink, teal, magenta, cyan, white.
        lum=cv2.cvtColor(cv2.GaussianBlur(f,(0,0),max(1,w*.003)),cv2.COLOR_BGR2GRAY)
        palette=np.array([[.05,.03,.02],[.5,.3,.08],[.64,.25,1.],[1.,.94,.24],[1.,.99,.91]],np.float32)
        poster=palette[np.clip((lum*5).astype(np.int32),0,4)]
        return u8((f*(1-a)+poster*a)*255)
    if name=='halftone':
        # A screen of cyan dots whose size follows brightness, over a dark base.
        cell=max(4,int(w*.022));gx=(x%cell)/cell-.5;gy=(y%cell)/cell-.5
        lum=cv2.resize(cv2.resize(cv2.cvtColor(f,cv2.COLOR_BGR2GRAY),(max(1,w//cell),max(1,h//cell)),interpolation=cv2.INTER_AREA),(w,h),interpolation=cv2.INTER_NEAREST)
        dots=np.clip((np.sqrt(lum)*.62-np.hypot(gx,gy))*cell*.5,0,1)[...,None]*np.array([1.,.94,.24],np.float32)
        return u8((f*(1-a)+(dots+.03)*a)*255)
    if name=='neon_bloom':
        # Highlights bleed cyan, mid-tones bleed magenta: a soft neon haze over the whole picture.
        bright=np.maximum(f-.55,0)/.45;hi=cv2.GaussianBlur(bright,(0,0),max(1,w*.02));mid=cv2.GaussianBlur(np.maximum(f-.3,0),(0,0),max(1,w*.045))
        haze=hi.mean(axis=2,keepdims=True)*np.array([1.,.94,.24],np.float32)*.9+mid.mean(axis=2,keepdims=True)*np.array([.64,.25,1.],np.float32)*.45
        return u8((1-(1-f)*(1-np.clip(haze*a,0,1)))*255)
    if name=='chroma_bars':
        # Vertical strips slide up and down by different amounts, each fringed in a different channel.
        bars=np.floor(nx*6+6).astype(np.int32);offset=(np.sin(bars*2.4+p*6.283)*h*.06*a).astype(np.float32)
        out=cv2.remap(img,x,y+offset,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
        out[:,:,2]=cv2.remap(img[:,:,2],x,y+offset*1.6,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
        return out
    if name=='rgb_split':
        # Red and blue slide apart sideways; green stays, so edges fringe magenta/cyan.
        d=int(round(w*.035*a));out=img.copy()
        if d:out[:,:,2]=np.roll(img[:,:,2],d,axis=1);out[:,:,0]=np.roll(img[:,:,0],-d,axis=1)
        return out
    if name=='hologram':
        # Cyan projection: tint, scanlines and a few rows nudged sideways each frame.
        lum=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY)[...,None];tint=lum*np.array([1.,.94,.24],np.float32)*1.25
        out=f*(1-a*.75)+tint*a*.75;out*=(1-a*.28*(.5+.5*np.sin(y*math.pi*.7+frame*.9)))[...,None]
        out=u8(out*255);shift=np.zeros(h,np.float32)
        for _ in range(4):
            start=int(rng.integers(h));shift[start:start+int(rng.integers(2,max(3,h//40)))]=rng.uniform(-1,1)*w*.03*a
        return cv2.remap(out,x+shift[:,None],y,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
    if name=='flash':
        return u8((1-(1-f)*(1-np.array([1.,.97,.78],np.float32)*a))*255)
    if name=='cool_grade':
        # A cold, contrasty look: teal lifted in the shadows, highlights kept clean.
        lum=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY)[...,None];graded=np.clip((f-.5)*1.12+.5,0,1)*np.array([1.06,1.,.9],np.float32)+(1-lum)*np.array([.07,.04,0.],np.float32)
        return u8((f*(1-a)+np.clip(graded,0,1)*a)*255)
    if name=='grain':
        # Fine monochrome grain, toned down in highlights; no colored pixel snow.
        noise=rng.normal(0,.025*a,(h,w,1)).astype(np.float32)
        lum=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY)[...,None]
        return u8((f+noise*(.35+np.sqrt(np.clip(lum,0,1)))*(1-lum*.55))*255)
    if name in ('bloom','halation'):
        bright=np.maximum(f-.62,0)/.38
        blur=cv2.GaussianBlur(bright,(0,0),max(1,w*.012))
        if name=='halation':blur*=np.array([.14,.38,1],np.float32)
        return u8((1-(1-f)*(1-blur*a*.6))*255)
    if name=='vignette':return u8(f*(1-a*.32*np.clip((nx*nx+ny*ny)/2,0,1))[...,None]*255)
    if name=='chromatic':
        d=nx*nx+ny*ny;dx=nx*d*a*w*.008;dy=ny*d*a*h*.008
        out=img.copy();out[:,:,2]=cv2.remap(img[:,:,2],x+dx,y+dy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101);out[:,:,0]=cv2.remap(img[:,:,0],x-dx,y-dy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101);return out
    if name=='light_leak':
        cx=-1.8+3.6*p;g=np.exp(-((nx-cx)**2/.18+(ny+.25*np.sin(p*6))**2/2))
        light=g[...,None]*np.array([.15,.55,1.],np.float32)*a
        return u8((1-(1-f)*(1-light))*255)
    if name=='scanlines':return u8(f*(1-a*.16*(.5+.5*np.sin(y*math.pi*.5+frame*.7)))[...,None]*255)
    if name=='glitch':
        offsets=np.zeros(h,np.float32)
        for _ in range(7):
            start=int(rng.integers(h));length=int(rng.integers(2,max(3,h//15)));offsets[start:start+length]=rng.uniform(-1,1)*w*.07*a
        out=cv2.remap(img,x+offsets[:,None],y,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
        return effect('chromatic',out,p,a,frame,seed)
    if name=='zoom_blur':
        acc=np.zeros_like(f);n=32
        for k in range(n):
            scale=1+a*.45*k/(n-1);m=cv2.getRotationMatrix2D((w/2,h/2),0,scale)
            acc+=cv2.warpAffine(f,m,(w,h),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)/n
        return u8(acc*255)
    if name=='whip':
        return cv2.GaussianBlur(img,(0,0),sigmaX=max(.1,a*w*.07),sigmaY=.3,borderType=cv2.BORDER_REFLECT_101)
    if name=='prism':
        bands=np.floor((nx+ny*.28)*5);dx=np.sin(bands*1.8+p*5)*a*w*.055
        out=cv2.remap(img,x+dx,y,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
        return effect('chromatic',out,p,a,frame,seed)
    if name=='iris':
        radius=(1-a)*1.55;mask=np.clip((np.hypot(nx,ny)-radius)*14,0,1)
        return u8(f*(1-mask[...,None]*.96)*255)
    if name=='ripple':
        r=np.sqrt(nx*nx+ny*ny);wave=np.sin(r*18-p*10)*np.exp(-r*1.3)*a*w*.015
        return cv2.remap(img,x+nx*wave,y+ny*wave,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
    if name=='focus':
        blur=cv2.GaussianBlur(img,(0,0),max(.1,a*w*.015));mask=np.clip((nx*nx+ny*ny-.1)*1.2,0,1)[...,None]
        return u8(img*(1-mask)+blur*mask)
    if name=='letterbox':
        out=img.copy();n=int(h*.12*a);out[:n]=0
        if n:out[-n:]=0
        return out
    raise AssertionError(name)

def validate(plan,width,height,total):
    if plan.get('version')!=VERSION:raise ValueError('Unsupported effects plan version')
    roi=plan.get('roi',{});vals=[roi.get(k) for k in ('x','y','width','height')]
    if any(type(v)!=int for v in vals):raise ValueError('Integer ROI required')
    x,y,w,h=vals
    if x<0 or y<0 or w<2 or h<2 or x+w>width or y+h>height:raise ValueError('ROI out of frame')
    temporal=[]
    for e in plan.get('events',[]):
        if e.get('effect') not in CATALOG:raise ValueError('Unknown effect')
        s,t=e.get('start'),e.get('end')
        if type(s)!=int or type(t)!=int or not 0<=s<t<=total:raise ValueError('Invalid half-open event range')
        if not isinstance(e.get('amount',1),(int,float)) or not math.isfinite(e.get('amount',1)) or not 0<=e.get('amount',1)<=1:raise ValueError('Invalid amount')
        if e.get('envelope','pulse') not in ('pulse','constant','fade'):raise ValueError('Unknown envelope')
        if e['effect'] in TEMPORAL:
            temporal.append(e)
            if e['effect']!='echo':
                sf=e.get('sourceFrame');rate=e.get('rate',1)
                if type(sf)!=int or not isinstance(rate,(float,int)) or not math.isfinite(rate) or rate<=0:raise ValueError('Invalid temporal source')
                last=sf if e['effect']=='pause' else sf-round((t-s-1)*rate)
                if not 0<=last<=sf<total:raise ValueError('Temporal sample outside capture')
    for i,e in enumerate(temporal):
        if any(max(e['start'],b['start'])<min(e['end'],b['end']) for b in temporal[i+1:]):raise ValueError('Overlapping temporal edits')
    return tuple(vals)

def source_frame(e,f,total):
    if e['effect']=='pause':return e['sourceFrame']
    if e['effect']=='rewind':return e['sourceFrame']-round((f-e['start'])*e.get('rate',1))
    return f

def composite(base,f,plan,read_frame,total):
    """Replace only ROI. A temporal edit never freezes/reverses narrator/captions."""
    x,y,w,h=(plan['roi'][k] for k in ('x','y','width','height'))
    active=[e for e in plan.get('events',[]) if e['start']<=f<e['end']]
    img=base[y:y+h,x:x+w].copy()
    for e in active:
        if e['effect'] in ('pause','rewind'):
            sf=source_frame(e,f,total);img=read_frame(sf)[y:y+h,x:x+w].copy()
        elif e['effect']=='echo':
            acc=img.astype(np.float32)*.6
            for lag,weight in [(3,.25),(6,.15)]:acc+=read_frame(max(0,f-lag))[y:y+h,x:x+w]*weight
            img=u8(acc)
    for e in active:
        if e['effect'] in TEMPORAL:continue
        p=(f-e['start'])/max(1,e['end']-e['start']-1)
        env={'pulse':math.sin(math.pi*p)**2,'constant':1,'fade':smooth(p)}[e.get('envelope','pulse')]
        img=effect(e['effect'],img,p,e.get('amount',1)*env,f,plan.get('seed',1))
    transport=next((e for e in active if e['effect'] in ('pause','rewind')),None)
    if transport and h>=200:
        title='DIAGRAM '+('PAUSED' if transport['effect']=='pause' else 'REWIND')
        cv2.rectangle(img,(0,0),(w,104),(36,18,7),-1)
        scale=1.7;size=cv2.getTextSize(title,cv2.FONT_HERSHEY_DUPLEX,scale,2)[0]
        cv2.putText(img,title,((w-size[0])//2,68),cv2.FONT_HERSHEY_DUPLEX,scale,(213,249,167),2,cv2.LINE_AA)
    result=base.copy();result[y:y+h,x:x+w]=img;return result


# ---------------------------------------------------------------- GTA6 theme
# Appended effects for library/themes/gta6: sunset grades, comic ink and print looks.
# Nothing above is changed; `effect` is rebound to a wrapper that handles the new names and
# hands every other name to the original function. Same contract: stateless, deterministic,
# zero amount is bit-identical, the source is never modified. Colours are BGR, 0..1.
COAST = ('sunset_grade','comic_ink','cel_shade','halftone_print','sun_bloom','vhs_vacation','pop_flash')
SPATIAL = SPATIAL + COAST
CATALOG = SPATIAL + TEMPORAL
_INK=np.array([.2,.043,.098],np.float32);_CREAM=np.array([.878,.957,1.],np.float32)
_PINK=np.array([.592,.247,1.],np.float32);_ORANGE=np.array([.188,.541,1.],np.float32)
_YELLOW=np.array([.278,.831,1.],np.float32);_VIOLET=np.array([.941,.235,.478],np.float32)
_effect_base = effect

def _flatten(img,w,passes=2):
    """Edge-keeping smoothing at reduced size, so it costs the same on any frame."""
    h=img.shape[0];k=max(1.,w/400.);small=cv2.resize(img,(max(2,int(w/k)),max(2,int(h/k))),interpolation=cv2.INTER_AREA)
    for _ in range(passes):small=cv2.bilateralFilter(small,7,42,5)
    return cv2.resize(small,(w,h),interpolation=cv2.INTER_LINEAR)

def _ink_lines(img,w,weight=1.,detail=.55):
    """0..1 mask of drawn outlines: where the smoothed picture is locally darker than its surroundings."""
    grey=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY).astype(np.float32)/255
    s=max(.8,w*.0022*weight);fine=cv2.GaussianBlur(grey,(0,0),s);wide=cv2.GaussianBlur(grey,(0,0),s*2.6)
    return np.clip((wide-fine-.012/detail)*(42*detail),0,1)

def _bands(v,levels,soft):
    """Quantise 0..1 into flat steps with a short smooth ramp between them."""
    q=v*levels;base=np.floor(q);fr=q-base
    return (base+np.clip((fr-.5)/max(soft,1e-3)+.5,0,1))/levels

def effect(name,img,progress,amount=1,frame=0,seed=1):
    """Stateless spatial effect. Zero amount is bit-identical. No source mutation."""
    if name not in COAST: return _effect_base(name,img,progress,amount,frame,seed)
    if img.dtype!=np.uint8 or img.ndim!=3 or img.shape[2]!=3: raise ValueError('Expected BGR uint8 image')
    if not math.isfinite(amount) or not 0<=amount<=1: raise ValueError('amount must be 0..1')
    if amount==0:return img.copy()
    p=unit(progress);h,w=img.shape[:2];x,y,nx,ny=grid(h,w);a=float(amount)
    rng=np.random.default_rng(np.random.SeedSequence([int(seed),int(frame)]))
    f=img.astype(np.float32)/255
    if name=='sunset_grade':
        # Golden-hour look: richer colour, warm highlights, violet in the shadows, a pink wash from the top.
        lum=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY)[...,None]
        g=lum+(f-lum)*1.3;g=(g-.5)*1.1+.5
        g=g*(1+lum*np.array([-.10,.0,.07],np.float32))+((1-lum)**2)*np.array([.085,.0,.05],np.float32)
        sky=np.clip(.55-ny*.5,0,1)[...,None]*.16
        g=1-(1-np.clip(g,0,1))*(1-_PINK*sky*(1-lum*.6))
        return u8((f*(1-a)+np.clip(g,0,1)*a)*255)
    if name in ('comic_ink','cel_shade'):
        comic=name=='comic_ink';flat=_flatten(img,w,3 if comic else 2)
        hsv=cv2.cvtColor(flat.astype(np.float32)/255,cv2.COLOR_BGR2HSV)
        hsv[...,2]=np.clip(_bands(hsv[...,2]*1.06,5 if comic else 5,.14 if comic else .32),0,1)
        hsv[...,1]=np.clip(hsv[...,1]*(1.45 if comic else 1.3),0,1)
        col=cv2.cvtColor(hsv,cv2.COLOR_HSV2BGR);lum=cv2.cvtColor(col,cv2.COLOR_BGR2GRAY)[...,None]
        if comic: col=col+(1-lum)**2*np.array([.07,.0,.04],np.float32)                 # shadows lean violet, as in print
        else:
            hi=cv2.GaussianBlur(np.clip((lum[...,0]-.7)/.3,0,1),(0,0),max(1,w*.004))[...,None]
            col=1-(1-col)*(1-_ORANGE*hi*.22)                                           # warm rim light on the brightest planes
        line=_ink_lines(flat,w,1.5 if comic else 1.,.75 if comic else .62)[...,None]*(1. if comic else .9)
        col=col*(1-line)+_INK*line
        return u8((f*(1-a)+np.clip(col,0,1)*a)*255)
    if name=='halftone_print':
        # Four-colour print on cream stock: cyan, magenta and yellow dot screens at different angles, then dark ink.
        cell=max(4.,w*.02);soft=cv2.GaussianBlur(f,(0,0),cell*.42)
        sat=cv2.cvtColor(soft,cv2.COLOR_BGR2GRAY)[...,None];soft=np.clip(sat+(soft-sat)*1.35,0,1)
        key=np.clip(1-soft.max(axis=2)*1.7,0,1)**1.4
        def screen(value,angle):
            c,s=math.cos(angle),math.sin(angle);u=(x*c+y*s)/cell;v=(-x*s+y*c)/cell
            d=np.hypot(u-np.floor(u)-.5,v-np.floor(v)-.5)
            return np.clip((np.sqrt(np.clip(value,0,1))*.6-d)*cell*.55+.5,0,1)
        out=np.empty_like(f)
        for ch,angle in ((2,.262),(1,1.309),(0,0.)):                                   # R<-cyan, G<-magenta, B<-yellow
            out[...,ch]=_CREAM[ch]*(1-screen(np.clip((1-soft[...,ch])*.85-key*.4,0,1),angle)*.9)
        k=screen(key,.785)[...,None]*.92;out=out*(1-k)+_INK*k
        return u8((f*(1-a)+out*a)*255)
    if name=='sun_bloom':
        # Film warmth: highlights spill orange then pink, blacks lift a touch.
        bright=np.maximum(f-.55,0)/.45;near=cv2.GaussianBlur(bright,(0,0),max(1,w*.012)).mean(axis=2,keepdims=True)
        wide=cv2.GaussianBlur(bright,(0,0),max(1,w*.05)).mean(axis=2,keepdims=True)
        glow=near*_ORANGE*.55+wide*_PINK*.6
        out=1-(1-f)*(1-np.clip(glow*a,0,1));out=out*(1-.05*a)+np.array([.03,.035,.06],np.float32)*a
        return u8(np.clip(out,0,1)*255)
    if name=='vhs_vacation':
        # A holiday tape left in the sun: faded and warm, colour smeared sideways, a soft tracking band, light noise.
        lum=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY)[...,None]
        out=lum+(f-lum)*(1+.1*a);out=out*(1-.16*a)+np.array([.07,.08,.13],np.float32)*a
        out=out*(1+np.array([-.06,.0,.07],np.float32)*a)
        k=max(1,int(w*.03*a))|1;d=int(round(w*.006*a))
        out[:,:,2]=np.roll(cv2.blur(out[:,:,2],(k,1)),d,axis=1);out[:,:,0]=np.roll(cv2.blur(out[:,:,0],(k,1)),-d,axis=1)
        band=np.exp(-(((y/h-(frame*.011)%1.25+.12))/.03)**2)*a
        out=cv2.remap(out,x+band*w*.035,y,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
        out+=rng.normal(0,.008*a,(h,1,1)).astype(np.float32)+rng.normal(0,.03*a,(h,w,1)).astype(np.float32)+band[...,None]*.12
        out*=(1-a*.035*(.5+.5*np.sin(y*math.pi)))[...,None]
        return u8(np.clip(out,0,1)*255)
    if name=='pop_flash':
        # A cut flash in the theme colours: pink at the top through orange to yellow at the bottom.
        t=np.clip(ny*.5+.5,0,1)[...,None];tone=np.where(t<.5,_PINK+(_ORANGE-_PINK)*(t*2),_ORANGE+(_YELLOW-_ORANGE)*(t*2-1))
        return u8((1-(1-f)*(1-tone*a))*255)
    raise AssertionError(name)


# ---------- theme effects ----------
# A theme can bring its own effects without touching this file: put them in
# library/themes/<theme>/effects/theme_effects.py as
#     EFFECTS = {'name': fn}   with   fn(img, progress, amount, frame, seed) -> img   (BGR uint8, amount 0..1)
# The pipeline calls load_theme() with the storyboard's theme folder before applying effects.
_theme_effects = {}
def load_theme(theme_dir):
    import importlib.util
    from pathlib import Path
    file = Path(theme_dir) / 'effects' / 'theme_effects.py' if theme_dir else None
    if not file or not file.exists(): return
    spec = importlib.util.spec_from_file_location('theme_effects_' + Path(theme_dir).name.replace('-', '_'), file)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    _theme_effects.update(module.EFFECTS)

_shared_effect = effect
def effect(name, img, progress, amount=1, frame=0, seed=1):
    fn = _theme_effects.get(name)
    if fn is None: return _shared_effect(name, img, progress, amount, frame, seed)
    if amount == 0: return img.copy()
    return fn(img, unit(progress), float(amount), frame, seed)


# ---------------------------------------------------------------- Lighting (every theme)
# 24 lighting setups from library/_shared/lighting.py, named light_<scheme>. Registered like theme
# effects, so a theme can still override one by shipping an effect of the same name.
from lighting import LIGHTS as _LIGHTS
SPATIAL = SPATIAL + tuple(_LIGHTS)
CATALOG = SPATIAL + TEMPORAL
_theme_effects.update(_LIGHTS)


# ---------------------------------------------------------------- Signature effects: moments and two looks (every theme)
# The signature footage effects (library/_shared/signature.py): cop_lights, gta6_poster, text_behind_slice,
# reel_flythrough, color_grade. Registered like lighting. They take options: `props` (the storyboard
# effect entry's "props", plus the pipeline's `seconds` and `fps`) reaches any effect function marked `takes_props`.
from signature import SIGNATURE as _SIGNATURE
SPATIAL = SPATIAL + tuple(_SIGNATURE)
CATALOG = SPATIAL + TEMPORAL
_theme_effects.update(_SIGNATURE)
_before_props = effect
def effect(name, img, progress, amount=1, frame=0, seed=1, props=None):
    fn = _theme_effects.get(name)
    if not getattr(fn, 'takes_props', False): return _before_props(name, img, progress, amount, frame, seed)
    if amount == 0: return img.copy()
    return fn(img, unit(progress), float(amount), frame, seed, props=props)


# ---------------------------------------------------------------- a style's grade (library/_shared/style.js "grade")
def style_grade(img, p, a, frame, seed, props=None):
    """The colour grade of a style profile, as gentle nudges (each -1..1, 0 = leave alone):
    warmth (towards amber / blue), saturation, contrast, brightness, fade (lifted blacks), grain, vignette."""
    g = dict(props or {}); f = img.astype(np.float32) / 255
    warm = float(g.get('warmth', 0)) * .08
    f[..., 2] += warm; f[..., 0] -= warm; f[..., 1] += warm * .25
    lum = (f[..., 0] * .114 + f[..., 1] * .587 + f[..., 2] * .299)[..., None]
    f = lum + (f - lum) * (1 + float(g.get('saturation', 0)) * .6)
    f = (f - .5) * (1 + float(g.get('contrast', 0)) * .5) + .5 + float(g.get('brightness', 0)) * .12
    fade = max(0., float(g.get('fade', 0))) * .14; f = fade + f * (1 - fade)
    h, w = f.shape[:2]
    vig = float(g.get('vignette', 0))
    if vig:
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32); d = ((xx / w - .5) ** 2 + (yy / h - .5) ** 2 * .6) / .35
        f *= (1 - np.clip(d, 0, 1) ** 1.6 * vig * .45)[..., None]
    grain = float(g.get('grain', 0))
    if grain:
        noise = np.random.default_rng([int(seed), int(frame)]).standard_normal((h // 2 + 1, w // 2 + 1)).astype(np.float32)
        f += cv2.resize(noise, (w, h))[..., None] * grain * .035
    out = np.clip(f, 0, 1) * 255
    return np.rint(img.astype(np.float32) + (out - img) * a).clip(0, 255).astype(np.uint8)
style_grade.takes_props = True
_theme_effects['style_grade'] = style_grade

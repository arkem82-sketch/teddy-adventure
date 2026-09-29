# Step 2: build compressed game assets (assets/*.webp) + js/meta.js from the original pack
import os
HERE=os.path.dirname(os.path.abspath(__file__))
import os, json, glob, math
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFilter
P=os.path.join(HERE,'..','..','2D Stylized Adventure Game Asset Pack')+'/'  # original pack folder, placed next to this project
O=os.path.join(HERE,'..','assets')+'/'
meta={}
def save(im,name,q=86):
    im.save(O+name+'.webp','WEBP',quality=q,method=3); meta[name]=[im.width,im.height]
def load(p): return Image.open(P+p).convert('RGBA')
def sc(im,s): return im.resize((max(1,round(im.width*s)),max(1,round(im.height*s))),Image.LANCZOS)
def trim(im):
    b=im.getbbox(); return im.crop(b) if b else im
# ---- Teddy rig ----
R=os.path.join(HERE,'rig')+'/'; rig=json.load(open(R+'rig.json')); RS=0.3
for n,q in rig.items():
    save(sc(Image.open(R+n+'.png'),RS),'t_'+n,90)
rigm={n:{k:round(v*RS,1) for k,v in q.items()} for n,q in rig.items()}
turn=Image.open(os.path.join(HERE,'source','turn.png')).convert('RGBA')
a=np.array(turn)[...,3]; cols=np.where(a.max(0)>20)[0]
# split into figures by gaps
groups=[];start=cols[0];prev=cols[0]
for c in cols[1:]:
    if c-prev>15: groups.append((start,prev));start=c
    prev=c
groups.append((start,prev)); print('turn groups',groups)
g=groups[1]; back=trim(turn.crop((g[0],0,g[1]+1,turn.height)))
# scale back to match teddy height (hero full h 1287 -> body height)
save(sc(back,0.3*1287/ (752*0.98)*0.93),'t_back',88)
full=Image.open(os.path.join(HERE,'source','hero.png')).convert('RGBA'); save(sc(full,0.4),'teddy_full',88)
save(sc(full.crop((200,60,850,560)),0.14),'teddy_head',90)
# ---- env ----
env={'Enviroment/Tile/Ground_A.png':('tileA',0.5),'Enviroment/Tile/Ground_B.png':('tileB',0.5),
'Enviroment/Ground/Platforms .png':('plat',0.4),'Enviroment/Door.png':('door',0.42),
'Enviroment/Fence_1.png':('fence1',0.3),'Enviroment/Fence_2.png':('fence2',0.3),'Enviroment/Cloud.png':('cloud',0.6),
'Enviroment/Crystal_ground.png':('crystalg',0.35),'Enviroment/bowl.png':('bowl',0.3),'Enviroment/Bone_B.png':('boneb',0.35)}
for i in range(1,6): env[f'Enviroment/Ground/Ground_{i}.png']=(f'gd{i}',0.35)
for i in range(1,5): env[f'Enviroment/Mountains/Mountains_{i}.png']=(f'mtn{i}',0.6)
for i in range(1,5): env[f'Enviroment/Trees/Tree_{i}.png']=(f'tree{i}',0.4)
env['Enviroment/Trees/Trees.png']=('trees',0.4)
for i in range(1,7): env[f'Enviroment/Rocks/Rock_{i}.png']=(f'rock{i}',0.3 if i<5 else 0.22)
for i in range(1,12): env[f'Enviroment/Rocks/Stone_{i}.png']=(f'stone{i}',0.3)
for i in range(1,11): env[f'Enviroment/Rocks Symbols/Symbol_{i}.png']=(f'sym{i}',0.3)
for i in range(1,17): env[f'Enviroment/Rune stone/Symbol_Stone_{i}.png']=(f'rune{i}',0.45)
for p,(n,s) in env.items():
    im=load(p); im=sc(im,s)
    if not n.startswith('tile') and n!='plat': im=trim(im)
    save(im,n)
for tn in ('tileA','tileB'):
    t=sc(load('Enviroment/Tile/Ground_'+tn[-1]+'.png'),0.5); a=np.array(t); r=np.clip(np.arange(a.shape[1])/18.0,0,1); a[...,3]=(a[...,3]*r[None,:]).astype(np.uint8)
    save(Image.fromarray(a),tn+'_f')
# ---- UI ----
for f in glob.glob(P+'UI/*.png'):
    n='ui_'+os.path.basename(f)[:-4].replace('.','').lower()
    im=Image.open(f).convert('RGBA'); s=1.0 if im.width<400 else 0.8
    save(sc(im,s),n,90)
# ---- animations -> sheets ----
def sheet(folder,prefix,name,s,step=1,cols=10):
    fs=sorted([f for f in glob.glob(P+folder+'/*.png') if any(c.isdigit() for c in os.path.basename(f))],key=lambda f:int(''.join(c for c in os.path.basename(f) if c.isdigit()) or 0))[::step]
    ims=[sc(Image.open(f).convert('RGBA'),s) for f in fs]
    w,h=ims[0].size; c=min(cols,len(ims)); r=math.ceil(len(ims)/c)
    S=Image.new('RGBA',(w*c,h*r),(0,0,0,0))
    for i,im in enumerate(ims): S.alpha_composite(im,((i%c)*w,(i//c)*h))
    save(S,name,84); meta[name]=[w,h,len(ims),c]
sheet('Animation/Dog/Dog_Idle','','dog_idle',0.6,2)
sheet('Animation/Dog/Dog_Walk','','dog_walk',0.6,1)
sheet('Animation/Dog/Dog_Sniffing','','dog_sniff',0.6,2)
sheet('Animation/Dog/Dog_Bone','','dog_bone',0.6,1)
sheet('Animation/Grass','','grass',0.32,1)
sheet('Animation/Cave','','cave',0.55,1)
save(trim(sc(load('Animation/Cave/Cave_A_.png'),0.55)),'cave_a')
sheet('Animation/Buterflay','','butterfly',0.4,2)
sheet('Animation/Flies','','flies',0.4,1)
sheet('Animation/Bubble','','bubbles',0.6,1)
# ---- Thorn critters (new art, bark texture from pack trees) ----
tree=load('Enviroment/Trees/Tree_1.png')
bark=np.array(tree.crop((250,520,470,780)).convert('RGB')).astype(np.float32)
def critter(name,W,H,rx,ry,nthorn,seed,eye=(255,120,40),antlers=False,big=False):
    rs=np.random.RandomState(seed); SS=4
    w,h=W*SS,H*SS; cx,cy=w/2,h*0.58
    OL=(40,30,24,255); OW=int((4 if big else 3.5)*SS)
    I=Image.new('RGBA',(w,h),(0,0,0,0)); d=ImageDraw.Draw(I)
    def outlined(poly,fill,width=OW):
        d.line(poly+[poly[0]],fill=OL,width=width*2,joint='curve')
        d.polygon(poly,fill=OL); 
        # shrink by drawing fill polygon inset via mask erosion
        m=Image.new('L',(w,h),0); ImageDraw.Draw(m).polygon(poly,fill=255)
        m=m.filter(ImageFilter.MinFilter(width//2*2+1))
        I.paste(Image.new('RGBA',(w,h),fill),(0,0),m)
        return m
    # thorns behind body
    thorns=[]
    for i in range(nthorn):
        t=-math.pi*0.02-(i+0.5)/nthorn*math.pi*1.04+rs.randn()*0.07
        L=(0.55+0.3*rs.rand())*ry*SS*(1.15 if big else 1)
        bx,by=cx+math.cos(t)*rx*SS*0.8,cy+math.sin(t)*ry*SS*0.8
        tip=(bx+math.cos(t)*L+math.sin(t)*L*0.25,by+math.sin(t)*L-math.cos(t)*L*0.25)
        pn=(-math.sin(t),math.cos(t)); bw=(9+rs.rand()*4)*SS*(1.4 if big else 1)
        thorns.append([(bx+pn[0]*bw,by+pn[1]*bw),tip,(bx-pn[0]*bw,by-pn[1]*bw)])
    if antlers:
        for sgn in (-1,1):
            x0,y0=cx+sgn*rx*SS*0.35,cy-ry*SS*0.7
            p1=(x0+sgn*14*SS,y0-38*SS); p2=(x0+sgn*6*SS,y0-66*SS); p3=(p1[0]+sgn*24*SS,p1[1]-18*SS)
            for seg,wd in (([(x0,y0),p1,p2],9),([p1,p3],6)):
                d.line(seg,fill=OL,width=(wd+5)*SS,joint='curve')
            for seg,wd in (([(x0,y0),p1,p2],9),([p1,p3],6)):
                d.line(seg,fill=(118,98,74,255),width=wd*SS-2*SS,joint='curve')
    for tri in thorns: outlined(tri,(186,160,118,255),int(OW*0.8))
    # thorn shading line
    for tri in thorns:
        mid=((tri[0][0]*0.3+tri[2][0]*0.7),(tri[0][1]*0.3+tri[2][1]*0.7))
        d.polygon([mid,tri[1],tri[2]],fill=(140,112,80,255))
    # body
    pts=[]
    for i in range(64):
        t=i/64*2*math.pi; r=1+0.05*math.sin(6*t+seed)+0.025*math.sin(11*t)
        pts.append((cx+math.cos(t)*rx*SS*r,cy+math.sin(t)*ry*SS*r))
    bm=outlined(pts,(124,98,70,255))
    # cel shading: dark bottom, light top-left
    sh=Image.new('L',(w,h),0); ImageDraw.Draw(sh).ellipse((cx-rx*SS*1.2,cy+ry*SS*0.15,cx+rx*SS*1.3,cy+ry*SS*1.6),fill=255)
    sh=Image.fromarray(np.minimum(np.array(sh),np.array(bm)))
    I.paste(Image.new('RGBA',(w,h),(92,70,50,255)),(0,0),sh)
    hl=Image.new('L',(w,h),0); ImageDraw.Draw(hl).ellipse((cx-rx*SS*0.85,cy-ry*SS*0.95,cx+rx*SS*0.1,cy-ry*SS*0.35),fill=255)
    hl=Image.fromarray(np.minimum(np.array(hl),np.array(bm)))
    I.paste(Image.new('RGBA',(w,h),(156,128,94,255)),(0,0),hl)
    d=ImageDraw.Draw(I)
    # bark cracks
    for k in range(5 if not big else 8):
        x=cx+rs.uniform(-0.7,0.7)*rx*SS; y=cy+rs.uniform(0.1,0.7)*ry*SS
        seg=[(x,y),(x+rs.uniform(-8,8)*SS,y+rs.uniform(-12,-4)*SS),(x+rs.uniform(-10,10)*SS,y+rs.uniform(-22,-12)*SS)]
        d.line(seg,fill=(50,44,36,255),width=int(2.2*SS),joint='curve')
    # moss patches
    for k in range(3):
        x=cx+rs.uniform(-0.6,0.5)*rx*SS; y=cy-ry*SS*rs.uniform(0.55,0.8)
        r=rs.uniform(9,15)*SS*(1.4 if big else 1)
        poly=[(x+math.cos(t)*r*(1+0.25*math.sin(3*t+k)),y+math.sin(t)*r*0.55) for t in np.linspace(0,2*math.pi,20)]
        d.polygon(poly,fill=(160,150,64,255)); d.line(poly+[poly[0]],fill=(96,90,40,255),width=int(1.6*SS))
    # re-clip to body+thorns
    # face
    er=(11 if not big else 15)*SS; ex=rx*SS*0.36; ey=cy-ry*SS*0.08
    glow=Image.new('RGBA',(w,h),(0,0,0,0)); gd=ImageDraw.Draw(glow)
    for sgn in (-1,1): gd.ellipse((cx+sgn*ex-er*1.5,ey-er*1.3,cx+sgn*ex+er*1.5,ey+er*1.5),fill=eye+(120,))
    glow=glow.filter(ImageFilter.GaussianBlur(5*SS)); I.alpha_composite(glow); d=ImageDraw.Draw(I)
    for sgn in (-1,1):
        x=cx+sgn*ex
        poly=[(x-sgn*er*1.1,ey-er*0.25),(x+sgn*er*1.1,ey-er*0.9),(x+sgn*er*0.95,ey+er*0.8),(x-sgn*er*0.9,ey+er*0.75)]
        d.polygon(poly,fill=(28,18,12,255))
        d.ellipse((x-er*0.5,ey-er*0.15,x+er*0.5,ey+er*0.6),fill=eye+(255,))
        d.ellipse((x-er*0.18,ey,x+er*0.12,ey+er*0.28),fill=(255,240,190,255))
    my=cy+ry*SS*0.32; mw=rx*SS*(0.4 if not big else 0.5); mh=(12 if not big else 18)*SS
    mouth=[(cx-mw,my),(cx+mw,my),(cx+mw*0.7,my+mh),(cx-mw*0.7,my+mh)]
    d.polygon(mouth,fill=(40,16,12,255)); 
    for i in range(4 if not big else 5):
        tx=cx-mw*0.8+i*(1.6*mw/((4 if not big else 5)-1))
        d.polygon([(tx-5*SS,my),(tx+5*SS,my),(tx,my+mh*0.55)],fill=(225,210,170,255))
    d.line(mouth+[mouth[0]],fill=OL,width=int(2.5*SS),joint='curve')
    I=I.resize((W,H),Image.LANCZOS)
    save(I,name,90)
critter('thorn_walk',175,150,52,42,9,1)
critter('thorn_hop',170,200,46,40,8,2,eye=(255,200,40),antlers=True)
critter('thorn_big',300,250,92,72,14,3,eye=(255,60,40),big=True)
open(os.path.join(HERE,'..','js','meta.js'),'w').write('// Generated by tools/build_assets.py\nconst META='+json.dumps({k:v for k,v in meta.items() if k not in ('tileA','tileB')})+';\nconst RIG='+json.dumps({n:{k:round(v*RS,1) for k,v in q.items()} for n,q in rig.items()},indent=1)+';\n')
tot=sum(os.path.getsize(O+f) for f in os.listdir(O)); print('total MB',tot/1e6, len(os.listdir(O)))

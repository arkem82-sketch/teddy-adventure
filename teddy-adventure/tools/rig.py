# Step 1: cut Teddy (source/hero.png) into rig pieces -> tools/rig/
import os
HERE=os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(HERE,'rig'),exist_ok=True)
import numpy as np, cv2, json
from PIL import Image, ImageDraw
im=Image.open(os.path.join(HERE,'source','hero.png')).convert('RGBA'); W,H=im.size
A=np.array(im)
def polymask(pts):
    m=Image.new('L',(W,H),0); ImageDraw.Draw(m).polygon(pts,fill=255); return np.array(m)>0
def ellmask(box):
    m=Image.new('L',(W,H),0); ImageDraw.Draw(m).ellipse(box,fill=255); return np.array(m)>0
alpha=A[...,3]>0
# --- pieces ---
shield=ellmask((22,438,512,1016))
arm=polymask([(745,585),(800,560),(930,480),(1040,180),(1040,55),(1221,55),(1221,640),(1085,650),(1085,720),(1015,790),(920,790),(900,740),(840,735),(760,720)])
cape=polymask([(778,690),(860,700),(1000,820),(1050,900),(1050,930),(820,930),(778,900)]) & ~arm
lleg=polymask([(250,965),(300,948),(505,948),(520,990),(500,1280),(170,1280),(170,1100)])
rleg=polymask([(630,960),(660,940),(840,930),(900,1060),(1010,1150),(1010,1280),(640,1280),(650,1040)])
pieces={}
def save(name,mask,pivot,extra=None):
    m=mask&alpha
    ys,xs=np.where(m); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    P=A.copy(); P[~m,3]=0
    Image.fromarray(P[y0:y1,x0:x1]).save(os.path.join(HERE,'rig',f'{name}.png'))
    pieces[name]=dict(x=int(x0),y=int(y0),w=int(x1-x0),h=int(y1-y0),px=pivot[0],py=pivot[1])
save('shield',shield,(268,727)); save('arm',arm,(790,640)); save('cape',cape,(790,700))
save('lleg',lleg,(400,965)); save('rleg',rleg,(740,955))
# --- body: everything else, legs cut below hip but keep overlap ---
body=alpha & ~shield & ~arm & ~cape
legcut=(lleg|rleg) & (np.arange(H)[:,None]>1000)
body&=~legcut
B=A.copy(); B[~body,3]=0
# fill hole behind shield: body silhouette polygon
behind=polymask([(498,455),(400,470),(340,530),(312,640),(308,800),(296,900),(262,990),(262,1000),(498,1002)]) & shield
# fill hole behind arm over cape/body
behind_arm=ellmask((720,570,875,725)) & arm
hole=(behind|behind_arm)
base=np.array([176,106,58],np.float32)
rs=np.random.RandomState(3)
low=cv2.resize(rs.randn(H//40+1,W//40+1).astype(np.float32),(W,H),interpolation=cv2.INTER_CUBIC)
fine=cv2.GaussianBlur(rs.randn(H,W).astype(np.float32),(0,0),1.2)
tile=base[None,None,:]*(1+0.06*low[...,None])+fine[...,None]*14
# shading: darker toward left edge for behind-shield area
xs_=np.arange(W)[None,:,None]
shade=np.clip((xs_-300)/200,0,1)*0.25+0.75
fill=np.clip(tile*shade,0,255).astype(np.uint8)
hh=hole&~body
B[hh,:3]=fill[hh]; B[hh,3]=255
# outline on exposed left edge of behind-shield fill
ol=Image.fromarray(B); d=ImageDraw.Draw(ol)
d.line([(400,470),(340,530),(312,640),(308,800),(296,900),(262,990)],fill=(35,22,15,255),width=9,joint='curve')
d.arc((720,570,875,725),-70,80,fill=(35,22,15,255),width=8)
B=np.array(ol)
ys,xs=np.where(B[...,3]>0); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
Image.fromarray(B[y0:y1,x0:x1]).save(os.path.join(HERE,'rig','body.png'))
pieces['body']=dict(x=int(x0),y=int(y0),w=int(x1-x0),h=int(y1-y0),px=560,py=900)
json.dump(pieces,open(os.path.join(HERE,'rig','rig.json'),'w'),indent=1)
# preview: exploded
prev=Image.new('RGBA',(W*2,H),(120,170,120,255))
for n in ['lleg','rleg','body','cape','arm','shield']:
    p=Image.open(os.path.join(HERE,'rig',f'{n}.png')); q=pieces[n]; prev.alpha_composite(p,(q['x'],q['y']))
off={'lleg':(-60,40),'rleg':(60,40),'body':(0,0),'cape':(120,40),'arm':(160,-30),'shield':(-40,0)}
for n in ['body','lleg','rleg','cape','arm']:
    p=Image.open(os.path.join(HERE,'rig',f'{n}.png')); q=pieces[n]; prev.alpha_composite(p,(W+q['x']+off[n][0]+30,q['y']+off[n][1]))
prev.resize((W,H//2)).save(os.path.join(HERE,'rigprev.png'))
print(pieces)

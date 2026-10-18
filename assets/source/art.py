import json,math,subprocess,os,random
C=json.load(open('/tmp/constants.json'));random.seed(8)
A=[]
def rect(x,y,w,h,c):
 if w>0 and h>0:A.append(dict(op='fill_rect',x=round(x),y=round(y),width=round(w),height=round(h),color=c))
def circ(x,y,r,c):A.append(dict(op='fill_circle',cx=round(x),cy=round(y),r=max(0,round(r)),color=c))
def line(x,y,x2,y2,c):A.append(dict(op='line',x0=round(x),y0=round(y),x1=round(x2),y1=round(y2),color=c))
def poly(points,c):
 for y in range(math.floor(min(p[1] for p in points)),math.ceil(max(p[1] for p in points))):
  xs=[]
  for i,(x1,y1) in enumerate(points):
   x2,y2=points[(i+1)%len(points)]
   if min(y1,y2)<=y<max(y1,y2):xs.append(x1+(y-y1)*(x2-x1)/(y2-y1))
  xs.sort()
  for i in range(0,len(xs)-1,2):rect(xs[i],y,max(1,xs[i+1]-xs[i]),1,c)
def save(path,w,h,sheet=False):
 os.makedirs('assets/'+os.path.dirname(path),exist_ok=True);json.dump(A,open('/tmp/art/ops.json','w'));cmd=['draw-sheet' if sheet else 'draw','render','--actions','/tmp/art/ops.json','--out','assets/'+path,'--width',str(w),'--height',str(h),'--no-layers'];subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL);A.clear()
ink='#101a24';gold='#d5a65b';light='#fff1bc';blue='#6ca6b1';red='#c96b64';purple='#8c7fa2'
def lamp(f=0):
 off=round(math.sin(f*math.pi/3));rect(7,26,4,5,ink);rect(13,26+off,4,5-off,ink);poly([(7,12),(15,12),(18,27),(4,27)],'#364553');poly([(7,13),(10,13),(8,25),(5,25)],'#708387');rect(8,6,8,7,'#b49b79');rect(7,4,9,4,ink);rect(5,7,14,2,ink);rect(13,9,2,1,light);rect(14,15,5,3,gold);rect(19,12,1,10,gold);rect(17,19,6,8,ink);rect(18,20,4,5,gold);rect(19,21,2,3,light);rect(16,18,8,1,gold)
lamp();save(C['LAMPLIGHTER_IDLE_PATH'],24,32)
for f in range(6):lamp(f);save(C['LAMPLIGHTER_WALK_SHEET']['dir']+'/'+str(f)+'.png',24,32,True)
for idx,(id,e) in enumerate(C['ENEMIES'].items()):
 n=e['radius']*2
 for f in range(4):
  x=n/2;y=n/2;flap=math.sin(f*math.pi/2)*n*.13;col=[purple,blue,'#8d7f72','#849789','#616d80'][idx%5]
  if id=='owl':
   poly([(x,n*.08),(n*.73,n*.22),(n*.94,n*.77),(n*.65,n*.68),(x,n*.96),(n*.35,n*.68),(n*.06,n*.77),(n*.27,n*.22)],ink)
   circ(x,n*.4,n*.29,col);circ(x-n*.13,n*.37,n*.13,gold);circ(x+n*.13,n*.37,n*.13,gold);circ(x-n*.13,n*.37,n*.07,ink);circ(x+n*.13,n*.37,n*.07,ink)
   poly([(x,n*.48),(x+4,n*.55),(x,n*.62),(x-4,n*.55)],light)
   for j in range(3):poly([(x-12+j*8,n*.64),(x-8+j*8,n*.86+flap/4),(x-4+j*8,n*.64)],col)
  elif id in ['bat','crow']:
   for side in [-1,1]:
    poly([(x,y),(x+side*n*.2,y-n*.32),(x+side*n*.48,y-n*.45+flap),(x+side*n*.4,y+n*.1),(x+side*n*.3,y-n*.03),(x+side*n*.2,y+n*.2),(x+side*n*.1,y+n*.05)],ink)
    poly([(x,y),(x+side*n*.2,y-n*.23),(x+side*n*.43,y-n*.36+flap),(x+side*n*.3,y-n*.04),(x+side*n*.16,y+n*.07)],col)
   if id=='crow':
    poly([(x-2,y),(x+2,y),(x+6,n*.96),(x,n*.8),(x-6,n*.96)],col);poly([(x+2,y-5),(n*.79,y-2),(x+2,y)],gold)
   else:
    poly([(x-4,y+4),(x-4,y-10),(x,y-5),(x+4,y-10),(x+4,y+4),(x,n*.8)],col)
  elif id in ['moth','mothwing','gnat']:
   for side in [-1,1]:
    poly([(x,y),(x+side*n*.45,y-n*.35+flap),(x+side*n*.39,y+n*.25),(x+side*n*.2,y+n*.1)],ink)
    poly([(x+side*2,y),(x+side*n*.39,y-n*.28+flap),(x+side*n*.31,y+n*.15)],col)
    circ(x+side*n*.26,y,n*.075,gold)
   poly([(x-2,y-n*.25),(x+2,y-n*.25),(x+3,y+n*.3),(x,y+n*.4),(x-3,y+n*.3)],ink)
   if id=='mothwing':
    for side in [-1,1]:poly([(x+side*n*.2,y+n*.05),(x+side*n*.4,y+n*.15),(x+side*n*.23,n*.98)],gold)
  elif id=='wisp':
   poly([(x,n*.02),(n*.72,n*.32),(n*.66,n*.56),(n*.85,n*.77),(x,n*.98),(n*.2,n*.77),(n*.34,n*.5),(n*.26,n*.3)],'#507c8b')
   poly([(x,n*.16),(n*.6,n*.4),(n*.55,n*.6),(n*.7,n*.76),(x,n*.82),(n*.35,n*.65)],'#add2c4')
  elif id in ['spider','beetle']:
   for side in [-1,1]:
    for j in range(4):
     yy=y+(j-1.5)*n*.14;line(x,yy,x+side*n*.32,yy-n*.12+flap/3,col);line(x+side*n*.32,yy-n*.12+flap/3,x+side*n*.46,yy+n*.13,col)
   circ(x,y,n*.3,ink);circ(x,y,n*.23,col);rect(x-1,y-n*.2,2,n*.4,ink)
  elif id in ['rat','hound']:
   poly([(n*.1,n*.6),(n*.23,n*.3),(n*.63,n*.24),(n*.8,n*.4),(n*.96,n*.5),(n*.82,n*.67),(n*.32,n*.7)],ink);poly([(n*.2,n*.5),(n*.3,n*.33),(n*.65,n*.32),(n*.8,n*.5),(n*.7,n*.6)],col);poly([(n*.64,n*.4),(n*.65,n*.12),(n*.8,n*.35)],col)
   for j in range(2):rect(n*(.3+j*.4),n*.62,3,n*.25+flap/4,col)
   line(n*.2,n*.55,1,n*.25,col)
  else:
   poly([(x,n*.05),(n*.72,n*.2),(n*.8,n*.6),(n*.95,n*.94),(n*.6,n*.8),(n*.4,n*.98),(n*.05,n*.9),(n*.22,n*.5),(n*.25,n*.2)],ink);poly([(x,n*.16),(n*.66,n*.3),(n*.64,n*.62),(n*.77,n*.8),(x,n*.72),(n*.3,n*.83),(n*.38,n*.35)],col)
   if id=='dark':poly([(n*.2,n*.25),(n*.12,1),(n*.38,n*.15),(x,0),(n*.62,n*.15),(n*.9,1),(n*.8,n*.3)],gold)
  circ(x-2,y-n*.12,1,light);circ(x+3,y-n*.12,1,light)
  if id in ['wisp','shade','dark']:
   for op in A:
    if op['op']=='fill_rect' and op['y']>n*.55:op['x']+=round(math.sin(f*math.pi/2)*2)
  save(f"sprites/enemies/{id}/{f}.png",n,n,True)
for tier,n in C['GEM_SPRITE_SIZES'].items():
 poly([(n/2,0),(n-1,n/2),(n/2,n-1),(0,n/2)],'#264e63');poly([(n/2,1),(n-2,n/2),(n/2,n-2),(2,n/2)],'#69c3c6');poly([(n/2,1),(n/2,n-3),(2,n/2)],'#b9edda');save(C['GEM_PATHS'][tier],n,n)
for id in C['PICKUP_PATHS']:
 if id=='chest':rect(2,8,20,13,ink);rect(3,9,18,10,'#805b3e');rect(3,7,18,4,gold);rect(6,7,2,14,gold);rect(17,7,2,14,gold);rect(10,12,4,4,light)
 elif id=='bread':circ(12,13,9,'#754a35');circ(11,11,8,gold);line(7,7,9,11,light);line(12,5,14,9,light)
 else:
  for j in range(3):line(3,7+j*5,18-j*3,5+j*5,blue);line(18-j*3,5+j*5,21-j*3,8+j*5,light)
 save(C['PICKUP_PATHS'][id],24,24)
# Individual tool emblems, detailed at native pixel scale.
def icon(id):
 evo=id in C['EVOLUTION_IDS'];base=C['EVOLUTIONS'][id]['from'] if evo else id;c=light if evo else gold
 if base=='wick':
  rect(5,5,14,3,gold);rect(7,8,10,11,'#88745a');rect(5,19,14,3,gold)
  for j in range(4):line(7,9+j*2,16,11+j*2,light)
 elif base=='tallow':
  rect(4,9,16,12,'#c6b78f');rect(6,7,12,3,light);rect(8,3,1,5,ink);rect(15,3,1,5,ink);rect(6,12,2,6,'#f4e8b7')
 elif base=='tinder':
  for j in range(3):line(4+j*5,20,8+j*5,7,gold);circ(8+j*5,6,2,red)
 elif base in ['taper']:
  rect(9,9,7,12,'#8c7256');rect(10,9,4,11,light);poly([(12,0),(16,5),(14,9),(10,8),(9,5)],'#eaa65c');circ(12,6,2,light)
 elif base in ['ember','flare','spark','soot']:
  poly([(12,1),(15,8),(20,5),(18,14),(21,17),(13,22),(4,17),(6,9),(9,12)],'#a55748');poly([(12,5),(15,13),(17,16),(12,20),(8,16)],c)
 elif base in ['pin','shard']:
  poly([(20,2),(14,17),(3,22),(9,7)],blue);poly([(20,2),(12,16),(9,7)],light)
 elif base in ['lantern','sconce']:
  rect(7,5,11,15,ink);rect(8,8,9,10,c);rect(10,10,5,6,light);rect(5,6,15,2,gold);rect(5,19,15,2,gold);line(9,5,10,2,gold);line(10,2,15,2,gold);line(15,2,16,5,gold)
 elif base=='lure':
  line(12,2,12,15,gold);line(12,15,17,19,gold);line(17,19,20,15,gold);circ(8,7,4,blue);circ(8,7,2,light)
 elif base=='glass':
  poly([(5,2),(19,2),(17,17),(12,22),(7,17)],blue);poly([(7,4),(12,4),(10,17),(8,15)],light)
 elif base in ['halo','mirror']:
  circ(12,11,9,gold);circ(12,11,7,ink);circ(12,11,5,blue);line(9,12,13,7,light)
 elif base in ['oil-splash','oil','lamp-oil']:
  rect(9,2,7,4,gold);poly([(8,6),(16,6),(20,19),(17,22),(6,22),(4,19)],'#455b66');rect(7,13,10,6,gold);rect(8,8,2,4,light)
 elif base=='brass':poly([(3,4),(12,1),(21,4),(19,16),(12,23),(5,16)],gold);poly([(6,6),(12,4),(18,6),(16,15),(12,19),(8,15)],'#775f46');rect(11,6,2,12,light)
 elif base=='bellows':poly([(3,9),(14,3),(21,12),(11,20)],'#9b6d55');line(5,9,13,17,gold);line(8,7,16,15,gold);line(11,5,19,13,gold)
 if evo:
  for x,y in [(2,2),(21,3),(2,20)]:rect(x,y,2,2,light)
for id,path in C['ICON_PATHS'].items():icon(id);save(path,24,24)
for id,e in C['EFFECT_SPRITES'].items():
 w=e['width'];h=e['height'];x=w/2;y=h/2;ev=id in C['EVOLUTION_IDS'];c='#f8e4a4' if ev else '#d2a462'
 for f in range(e['frames']):
  if id in ['taper','pyre']: 
   for j in range(5):poly([(0,y),(w*.35,y-4-j*2),(w*.9,y-12-j),(w-1,y),(w*.7,y+4+j),(w*.3,y+2)],['#624e44','#98734c',c,'#fff6cf','#fff6cf'][j])
  elif id in ['halo','corona','flare','oil-splash','blaze']:
   r=min(w,h)/2-2
   if id in ['oil-splash','blaze']:
    for k in range(17):a=k*2.4;rr=r*(.3+.6*(k%4)/4);circ(x+math.cos(a)*rr,y+math.sin(a)*rr,r*.28,['#705142aa','#be884e88',c+'99'][k%3])
   else:
    rr=r*(.4+f*.11) if id=='flare' else r
    for k in range(160):a=k*math.pi/80;circ(x+math.cos(a)*rr,y+math.sin(a)*rr,1+(k%5==0),c+'99')
    for k in range(12):a=k*math.pi/6;circ(x+math.cos(a)*rr,y+math.sin(a)*rr,2,'#fff2c2')
  elif id=='spark':
   pts=[(x,0),(x-10+f*3,y*.5),(x+8,y),(x-5,y*1.5),(x,h-1)]
   for a,b in zip(pts,pts[1:]):line(*a,*b,light);line(a[0]+1,a[1],b[0]+1,b[1],gold)
   for k in range(8):a=k*math.pi/4;line(x,y,x+math.cos(a)*(12+f*7),y+math.sin(a)*(12+f*7),gold)
  elif id in ['lantern','chandelier','sconce']:icon(id)
  elif id in ['pin','hail','shard']:poly([(w-1,1),(w*.65,h*.65),(1,h-1),(w*.3,h*.3)],c);line(w-2,2,3,h-3,light)
  else:
   circ(x,y,w*.45,'#b8744455');circ(x,y,w*.28,c);circ(x-1,y-1,w*.12,light)
  if id=='sconce' and f:
   for op in A:
    for turn in range(f):
     if op['op']=='fill_rect':op['x'],op['y'],op['width'],op['height']=w-op['y']-op['height'],op['x'],op['height'],op['width']
     elif op['op']=='fill_circle':op['cx'],op['cy']=w-1-op['cy'],op['cx']
     elif op['op']=='line':op['x0'],op['y0'],op['x1'],op['y1']=w-1-op['y0'],op['x0'],w-1-op['y1'],op['x1']
  save(e['path']+('/'+str(f)+'.png' if e['frames']>1 else ''),w,h,e['frames']>1)
for f in range(4):
 for k in range(10):a=k*2.4;r=3+f*2;circ(12+math.cos(a)*r,12+math.sin(a)*r,max(1,3-f),['#c9b899','#75868b','#dfd1a9'][k%3])
 save(f'sprites/puff/{f}.png',24,24,True)
rect(0,0,64,64,'#111b23')
for yy in range(0,64,16):
 for xx in range(-16,64,32):
  x=xx+(16 if yy%32 else 0);rect(x+1,yy+1,30,14,'#1b2830');rect(x+3,yy+2,26,1,'#25323a');rect(x+2,yy+13,28,1,'#0d171f')
for k in range(35):rect(random.randrange(64),random.randrange(64),1,1,'#2b363b')
save(C['GROUND_TILE_PATH'],64,64)

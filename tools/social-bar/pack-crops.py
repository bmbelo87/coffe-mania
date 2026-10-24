"""Export original raster regions for the social bar; no generated illustration."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
from collections import deque
import hashlib, json, shutil, sys
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'game/public/assets/ui/social'
REF=ROOT/'tools/social-bar'
OUT.mkdir(parents=True,exist_ok=True)
REF.mkdir(parents=True,exist_ok=True)
GUIDO=ROOT/'artes-referencia/cafe-mania-acervo-complementar-2/cafe-mania-acervo-2/artes/4059699/014.jpg'
MARIANO=ROOT/'artes-referencia/cafe-mania-behance-alta-qualidade-documentado/cafe-mania-behance/artes/15414597/007.png'
ATLAS=ROOT/'game/public/assets/ui/cafe_action_bar.png'
VIDEO=ROOT/'.runtime/recipe-video/todos/quadros/quadro-487.png'
records=[]
def source(path):
 return {'path':path.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'size':list(Image.open(path).size)}
def record(output,path,crop,operations,variant,notes=None):
 im=Image.open(output)
 records.append({'output':output.relative_to(ROOT).as_posix(),'source':source(path),'cropLTRB':crop,'operations':operations,'historicalVariant':variant,'size':list(im.size),'mode':im.mode,'notes':notes or []})
def rounded_cut(im,radius):
 # The mask removes the screenshot/atlas background outside the existing rounded contour.
 scale=4
 mask=Image.new('L',(im.width*scale,im.height*scale),0)
 ImageDraw.Draw(mask).rounded_rectangle((0,0,im.width*scale-1,im.height*scale-1),radius=radius*scale,fill=255)
 im=im.convert('RGBA')
 im.putalpha(mask.resize(im.size,Image.Resampling.LANCZOS))
 return im
def export_white_card():
 # The original card's unobscured upper rim and white header supply all nine
 # slices. Mirroring that rim below avoids the source's beige lower gradient.
 original=Image.open(MARIANO).convert('RGBA')
 regions={
  'whiteInterior':[395,997,408,1005],
  'topLeft':[384,990,398,1004],
  'topEdge':[398,990,408,1004],
  'topRight':[484,990,498,1004],
  'leftEdge':[384,1004,398,1014],
  'rightEdge':[484,1004,498,1014],
 }
 parts={name:original.crop(bounds) for name,bounds in regions.items()}
 im=parts['whiteInterior'].resize((114,165),Image.Resampling.NEAREST)
 placements=[
  (parts['topLeft'],(0,0),(14,14)),
  (parts['topEdge'],(14,0),(86,14)),
  (parts['topRight'],(100,0),(14,14)),
  (parts['leftEdge'],(0,14),(14,137)),
  (parts['rightEdge'],(100,14),(14,137)),
  (ImageOps.flip(parts['topLeft']),(0,151),(14,14)),
  (ImageOps.flip(parts['topEdge']),(14,151),(86,14)),
  (ImageOps.flip(parts['topRight']),(100,151),(14,14)),
 ]
 for part,position,size in placements:
  im.paste(part.resize(size,Image.Resampling.LANCZOS),position)
 im=rounded_cut(im,13).resize((100,150),Image.Resampling.LANCZOS)
 im.save(OUT/'card.png')
 record(OUT/'card.png',MARIANO,[384,990,498,1155],
  ['sample original flat white interior','nine-slice assembly from unobscured original upper corners and edges','vertically mirror upper corners and edge for lower border','mask existing rounded contour','resize 100x150'],
  'Mariano portfolio published 2014 / white friend card raster reconstruction',
  ['Only original raster pixels are reused. Interior is flat white; no title, portrait or progress is baked into the asset.','Lower rim is reconstructed by vertically mirroring the original upper rim to avoid the source beige gradient. This is not an untouched standalone original PNG.'])
 records[-1]['sliceRegionsLTRB']=regions
 records[-1]['sliceLayout']={'workingCanvas':[114,165],'borderPixels':14,'lowerEdge':'vertically mirrored upper edge and corners'}

export_white_card()
if '--card-only' in sys.argv:
 # Exporting one shared frame must not replace the generated portrait or other
 # unrelated assets with their superseded reference crops.
 item=records[-1]
 for path,key in [(REF/'crops.json','items'),(OUT/'source.json','originalAssets')]:
  manifest=json.loads(path.read_text(encoding='utf-8'))
  manifest[key]=[item if old['output']==item['output'] else old for old in manifest[key]]
  path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('Exported white social card only:',OUT/'card.png')
 sys.exit(0)
# Guido supplies the orange frame at higher resolution than the video. Its level
# overlaps the lower edge: repeat the unobscured upper raster half vertically.
crop=(1081,1011,1209,1139)
im=Image.open(GUIDO).crop(crop).convert('RGBA')
upper=im.crop((0,0,128,64))
im.paste(ImageOps.flip(upper),(0,64))
# Cyan on the outside of the source frame is screenshot background, not artwork.
a=Image.new('L',im.size)
a.putdata([max(0,min(255,round((155-b)*255/120))) for r,g,b,_ in im.getdata()])
im.putalpha(a)
im=im.resize((82,82),Image.Resampling.LANCZOS)
im.save(OUT/'portrait-frame.png')
record(OUT/'portrait-frame.png',GUIDO,list(crop),['crop','replace obscured lower half with vertically mirrored unobscured upper half','remove cyan source background by blue-channel matte','resize 82x82'],'Guido 2012 portfolio / orange-brown frame also observed in circa-2013 video',['The missing lower edge is assembled from original pixels; not a raw untouched crop. No label, name, level or number remains.'])
# Only the unobscured head and upper shoulders exist in the compressed video.
crop=(390,580,438,623)
im=Image.open(VIDEO).crop(crop).convert('RGBA')
alpha=[]
for r,g,b,_ in im.getdata():
 # Neutral bluish-gray bust separates from orange and gold surroundings.
 grayish=(b>=r-18 and g>=r-20 and b>75)
 alpha.append(255 if grayish else 0)
im.putalpha(Image.frombytes('L',im.size,bytes(alpha)))
# Compressed screenshot noise sometimes keys as neutral. Keep only the connected
# bust component; disconnected UI/glint pixels do not belong to the silhouette.
seen=set(); largest=set(); w,h=im.size
for i,value in enumerate(alpha):
 if not value or i in seen: continue
 component=set(); queue=deque([i]); seen.add(i)
 while queue:
  current=queue.popleft(); component.add(current); x=current%w; y=current//w
  for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
   nxt=ny*w+nx
   if 0<=nx<w and 0<=ny<h and alpha[nxt] and nxt not in seen:
    seen.add(nxt); queue.append(nxt)
 if len(component)>len(largest): largest=component
im.putalpha(Image.frombytes('L',im.size,bytes(255 if i in largest else 0 for i in range(w*h))))
im=im.resize((68,61),Image.Resampling.LANCZOS)
canvas=Image.new('RGBA',(82,82),(0,0,0,0));canvas.alpha_composite(im,(7,10))
canvas.save(OUT/'portrait-placeholder.png')
record(OUT/'portrait-placeholder.png',VIDEO,list(crop),['crop unobscured head and upper shoulders','key neutral gray from orange/gold background','retain largest connected bust component','resize and place in transparent 82x82 canvas'],'circa-2013 runtime video at 00:45.245',['Low-resolution partial bust. The original level obscures the lower shoulders; no replacement anatomy was painted. Prefer a generated replacement if the upsampled source is insufficient.'])
# Original Papa dos Pudins promotion, kept optional because its surrounding UI
# belongs to a different historical presentation than the orange runtime card.
crop=(1031,987,1152,1155)
im=rounded_cut(Image.open(MARIANO).crop(crop),10).resize((100,150),Image.Resampling.LANCZOS)
im.save(OUT/'promotion-chef.png')
record(OUT/'promotion-chef.png',MARIANO,list(crop),['crop','mask existing rounded card corners','resize 100x150'],'Mariano portfolio published 2014; older interface variant',['Optional historical promotion; includes original Papa dos Pudins text.'])
# Preserve the four complete original banners byte for byte, including their sizes.
base=MARIANO.parent
for src,name in [('021.png','banner-mobile.png'),('022.png','banner-taqueria.png'),('023.png','banner-cash.png'),('024.png','banner-beach-stoves.png')]:
 shutil.copyfile(base/src,OUT/name)
 record(OUT/name,base/src,None,['byte-for-byte copy'],'Mariano portfolio published 2014',['Full original banner, not Image Gen.'])
# Reference-only crops for future reconstruction and calibration.
refcro=(242,1007,393,1140)
Image.open(GUIDO).crop(refcro).save(REF/'add-friend-reference.png')
record(REF/'add-friend-reference.png',GUIDO,list(refcro),['crop without name or button label'],'Guido 2012 portfolio / orange invitation illustration',['Reference for Image Gen; opaque screenshot background remains.'])
for number,time,name in [('008','01:20.080','carousel-mobile-reference.png'),('009','01:30.090','carousel-favorites-reference.png'),('011','01:50.110','carousel-cupcake-reference.png')]:
 path=ROOT/f'artes-referencia/cenario-praia/video/quadros/quadro-{number}.png'
 crop=(230,551,1053,675)
 Image.open(path).crop(crop).save(REF/name)
 record(REF/name,path,list(crop),['crop only'],'runtime video, recording date unconfirmed',[f'Time {time}. Reference includes baked text, paging and close button. Video clips the lowest edge; do not present as a complete recovered standalone banner.'])
manifest={'generatedOn':'2026-10-23','method':'Original raster crops, alpha isolation, calibration, and byte-preserving banner copies. No Image Gen used for these files.','sources':{'Guido':'https://www.behance.net/gallery/4059699/Caf-Mania-Social-Games-Vostu','GuidoPublished':'2012-05-28','MarianoProject':'15414597','MarianoPublished':'2014-03-19','videoDate':'unconfirmed; existing project audit estimates circa 2013'},'items':records}
(REF/'crops.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for p in OUT.glob('*.png'):
 im=Image.open(p)
 print(p.relative_to(ROOT),im.size,im.mode,im.getchannel('A').getextrema() if im.mode=='RGBA' else 'opaque original')

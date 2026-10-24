"""Finalize generated social assets with original invitation illustration pixels."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFilter, ImageChops
from collections import deque
import hashlib,json
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
OUT=ROOT/'game/public/assets/ui/social'
def provenance(path,kind):
 return {'path':path.relative_to(ROOT).as_posix(),'kind':kind,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'size':list(Image.open(path).size)}
def normalize_alpha(im):
 im=im.convert('RGBA');im.putalpha(im.getchannel('A').point(lambda value:255 if value>=250 else value));return im
# Keep the generated perimeter and blank button; retain the original painted
# faces/clothes in the upper panel so the illustration is not reinterpreted.
frame_source=HERE/'add-friend-frame-generated.png'
original_source=HERE/'add-friend-reference.png'
frame_crop=(18,25,1008,1510)
canvas=normalize_alpha(Image.open(frame_source).crop(frame_crop)).resize((400,600),Image.Resampling.LANCZOS)
original_crop=(0,0,151,131)
illustration=Image.open(original_source).crop(original_crop).convert('RGBA').resize((392,384),Image.Resampling.LANCZOS)
canvas.alpha_composite(illustration,(4,4))
# This alpha contour removes the halo outside the existing rounded frame.
mask=Image.new('L',(1600,2400),0)
ImageDraw.Draw(mask).rounded_rectangle((0,0,1599,2399),radius=108,fill=255)
canvas.putalpha(mask.resize((400,600),Image.Resampling.LANCZOS))
canvas.save(OUT/'add-friend.png')
# Keep only the connected bust, preserving its antialiased alpha; the generator's
# disconnected low-alpha residues below the shoulders are not part of the asset.
placeholder_source=HERE/'portrait-placeholder-generated.png'
im=Image.open(placeholder_source).convert('RGBA');w,h=im.size
alpha=im.getchannel('A');data=alpha.tobytes();seen=bytearray(w*h);largest=[]
for idx,value in enumerate(data):
 if value<=64 or seen[idx]:continue
 queue=deque([idx]);seen[idx]=1;component=[]
 while queue:
  current=queue.popleft();component.append(current);x=current%w;y=current//w
  for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
   nxt=ny*w+nx
   if 0<=nx<w and 0<=ny<h and data[nxt]>64 and not seen[nxt]:seen[nxt]=1;queue.append(nxt)
 if len(component)>len(largest):largest=component
kept=bytearray(w*h)
for idx in largest:kept[idx]=255
mask=Image.frombytes('L',(w,h),bytes(kept)).filter(ImageFilter.MaxFilter(5))
im.putalpha(ImageChops.multiply(alpha,mask))
bbox=im.getchannel('A').getbbox()
im=normalize_alpha(im.crop(bbox))
im=ImageOps.contain(im,(74,76),Image.Resampling.LANCZOS)
canvas=Image.new('RGBA',(82,82),(0,0,0,0));canvas.alpha_composite(im,((82-im.width)//2,(82-im.height)//2))
canvas.save(OUT/'portrait-placeholder.png')
items=[{
 'output':'game/public/assets/ui/social/add-friend.png','kind':'composite-original-and-generated','size':[400,600],
 'sources':[provenance(frame_source,'Image Gen reconstructed blank frame and button'),provenance(original_source,'crop of original Guido 014 illustration')],
 'operations':{'frameCropLTRB':list(frame_crop),'frameResize':[400,600],'originalIllustrationCropLTRB':list(original_crop),'originalIllustrationResize':[392,384],'originalIllustrationPosition':[4,4],'alphaContour':'rounded contour matching frame, radius27px; outside and corners alpha0'},
 'limitations':['Frame/button reconstructed with Image Gen. Chef faces and clothes are original raster pixels resized from the reference.','No text baked into the output. Original screenshot illustration is low resolution.','Top of the chef hats remains clipped as in the original reference crop. Illustration fills the upper panel without an extra header strip.']},
 {'output':'game/public/assets/ui/social/portrait-placeholder.png','kind':'imagegen-reconstruction','size':[82,82],
 'sources':[provenance(placeholder_source,'Image Gen neutral gray bust based on original runtime placeholder')],
 'operations':{'componentThresholdAlpha':64,'keep':'largest connected bust only','retainAntialiasNeighborhoodPixels':2,'cropLTRB':list(bbox),'fitWithin':[74,76],'transparentCanvas':[82,82]},
 'limitations':['Generated reconstruction, not recovered original silhouette pixels. Replaces the earlier partial video crop.']}]
meta={'generatedOn':'2026-10-23','historicalTarget':'Café Mania circa 2012–2014, orange runtime invitation variant','items':items,'generatorOrigins':{'add-friend-frame-generated.png':'exec-c6cd906a-88b7-4214-91c9-3edba9a6e2c1.png','portrait-placeholder-generated.png':'exec-2c98561b-be48-4749-b51b-4f5f75d14194.png'}}
(HERE/'generated.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
crops=json.loads((HERE/'crops.json').read_text(encoding='utf-8'))
replacements={entry['output'] for entry in items}
originals=[entry for entry in crops['items'] if entry['output'].startswith('game/public/assets/ui/social/') and entry['output'] not in replacements]
manifest={'historicalTarget':meta['historicalTarget'],'provenance':'Original raster crops and original copied banners are distinguished from reconstructed/composited assets below. Portfolio dates do not establish release dates.','sourceRecords':['tools/social-bar/crops.json','tools/social-bar/generated.json'],'originalAssets':originals,'reconstructedAssets':items,'rebuildOrder':['python tools/social-bar/pack-crops.py','python tools/social-bar/finalize-generated.py'],'warning':'pack-crops.py alone exports the superseded partial silhouette; finalize-generated.py must run last.'}
if (HERE/'news-background.json').exists():
 manifest['sourceRecords'].append('tools/social-bar/news-background.json')
 manifest['newsBackground']=json.loads((HERE/'news-background.json').read_text(encoding='utf-8'))
(OUT/'source.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for filename in ['add-friend.png','portrait-placeholder.png']:
 im=Image.open(OUT/filename)
 print(filename,im.size,im.mode,'alpha',im.getchannel('A').getextrema(),'corners',[im.getpixel(p)[3] for p in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]])

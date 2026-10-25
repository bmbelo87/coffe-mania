"""Register generated flat-finish edits with the existing canvases, without stretching the objects."""
from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib
from scipy import ndimage
ROOT=Path(__file__).resolve().parents[2]
GEN=Path(__file__).resolve().parent/'generated'
def box(im):
 a=np.array(im.getchannel('A'));labels,n=ndimage.label(a>=128);sizes=np.bincount(labels.ravel());sizes[0]=0;ys,xs=np.where(labels==sizes.argmax());return(int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1))
def register(source,original,destination):
 old=Image.open(original).convert('RGBA');new=Image.open(source).convert('RGBA');b=box(old);cut=new.crop(box(new));scale=min((b[2]-b[0])/cut.width,(b[3]-b[1])/cut.height);size=(round(cut.width*scale),round(cut.height*scale));cut=cut.convert('RGBa').resize(size,Image.Resampling.LANCZOS).convert('RGBA');out=Image.new('RGBA',old.size);left=round((b[0]+b[2]-cut.width)/2);top=b[3]-cut.height;out.paste(cut,(left,top));out.save(destination);return{'file':str(destination.relative_to(ROOT)).replace('\\','/'),'size':list(out.size),'sourceBox':box(new),'targetBox':b,'scale':scale,'offset':[left,top],'sha256':hashlib.sha256(destination.read_bytes()).hexdigest()}
report=[]
for stage in range(1,4):
 folder=ROOT/'game/public/assets/items/coffee_machine/stages';report.append(register(GEN/f'machine-{stage}.png',folder/f'stage-{stage}.png',folder/f'stage-{stage}-room-source.png'))
folder=ROOT/'game/public/assets/scenery/beach-extras'
for source,name in [('bather','bather'),('vendor','ice-cream-vendor')]:report.append(register(GEN/f'{source}.png',folder/f'{name}.png',folder/f'{name}-flat.png'))
registration=json.loads((folder/'registration.json').read_text(encoding='utf-8'));registration['flatFinishRevision']={'method':'ImageGen removes exterior strokes; uniform registration to original canvas. Previous sources are retained.','exports':report[-2:]};(folder/'registration.json').write_text(json.dumps(registration,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(Path(__file__).parent/'exports.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))

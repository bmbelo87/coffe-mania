"""Uniformly sample calibrated sprites and anchor their bottom contact independently of the footprint."""
from pathlib import Path
from PIL import Image
import numpy as np,json
ROOT=Path(__file__).resolve().parents[2]
for stage in range(1,4):
 path=ROOT/f'game/public/assets/items/coffee_machine/stages/stage-{stage}.png'
 source=path.with_name(f'stage-{stage}-room-source.png')
 aligned=path.with_name(f'stage-{stage}-room-aligned.png')
 if aligned.exists():source=aligned
 if not source.exists():source=path
 im=Image.open(source).convert('RGBA');a=np.array(im.getchannel('A'))
 ys,xs=np.where(a>=128);bottom=int(ys.max());contact=float(np.median(xs[ys>=bottom-2]));scale=170/im.width
 size=(170,round(im.height*scale));out=im.convert('RGBa').resize(size,Image.Resampling.LANCZOS).convert('RGBA')
 out.save(path.with_name(f'room-stage-{stage}.png'))
 registration={'left':-round(contact*scale),'top':80-round(bottom*scale),'source':{'mode':'uniform','image':source.name,'scale':scale,'contact':{'x':contact,'y':bottom},'reason':'PNG proportions remain independent of the logical footprint. Rounded bodies and feet are not reliable diamond corners.'}}
 (ROOT/f'tools/coffee-machine/generated/stage-{stage}-registration.json').write_text(json.dumps(registration,indent=2)+'\n')
 print(stage,size,registration['left'],registration['top'])

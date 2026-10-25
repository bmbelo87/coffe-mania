"""Export four floor facings per evolution stage without changing the modal preview artwork."""
from pathlib import Path
from PIL import Image
from scipy.ndimage import label,binary_dilation
import numpy as np,json,shutil,subprocess
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent;ITEMS=ROOT/'game/public/assets/items'
BEFORE=ROOT/'.runtime/furniture-rotations/before'

def clean(image):
 image=image.convert('RGBA');a=np.array(image.getchannel('A'));labels,_=label(a>=64);sizes=np.bincount(labels.ravel());sizes[0]=0
 retained=np.flatnonzero(sizes>=max(64,sizes.max()*.0005));mask=binary_dilation(np.isin(labels,retained),iterations=2);a[~mask]=0
 image.putalpha(Image.fromarray(a));return image.crop(image.getbbox())

report=[]
for kind,prefix in [('coffee_machine','coffee'),('juice_machine','juice')]:
 folder=ITEMS/kind;source_catalog=json.loads((folder/'stages/catalog.json').read_text(encoding='utf-8'));stages=[]
 for entry in source_catalog['stages']:
  stage=entry['stage'];frame=entry['frame'];front=Image.open(folder/'stages'/frame['file']).convert('RGBA')
  # The generator supplies a genuine rear; horizontal counterparts use the same symmetry contract as other furniture.
  back=clean(Image.open(HERE/f'generated/{prefix}-{stage}-back.png'));scale=frame['height']/back.height
  back=back.convert('RGBa').resize((round(back.width*scale),frame['height']),Image.Resampling.LANCZOS).convert('RGBA')
  a=np.array(back.getchannel('A'));ys,xs=np.where(a>=128);bottom=int(ys.max());contact=float(np.median(xs[ys>=bottom-2]));back_frame=dict(width=back.width,height=back.height,left=-round(contact),top=80-bottom)
  # The square-reservoir rear's authored camera uses the complementary diagonal.
  back_rotation=3 if kind=='juice_machine' and stage==2 else 2
  poses=[]
  for r in range(4):
   image=front if r<2 else back;f=frame if r<2 else back_frame
   flip=r==1 if r<2 else r!=back_rotation
   if flip:image=image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
   file=f'stage-{stage}-rotation-{r}.png';image.save(folder/'stages'/file)
   poses.append(dict(rotation=r,frame=dict(file=file,width=image.width,height=image.height,left=-f['left']-image.width if flip else f['left'],top=f['top'])))
  entry['poses']=poses;stages.append(entry);report.append(dict(classname=kind,stage=stage,backScale=scale,backSize=list(back.size),backRotation=back_rotation,poses=poses))
 catalog=dict(stages=stages);(folder/'stages/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 manifest=json.loads((folder/'item.json').read_text(encoding='utf-8'));manifest['parts']=[]
 for p in stages[0]['poses']:
  f=p['frame'];target=f"rotation-{p['rotation']}.png";shutil.copyfile(folder/'stages'/f['file'],folder/target)
  manifest['parts'].append(dict(**{**f,'file':target},rotation=p['rotation']))
 manifest.setdefault('source',{})['rotations']=dict(prompts='tools/furniture-rotations/prompts.json',export='tools/furniture-rotations/machines-export.json',method='Frentes atuais preservadas; traseiras reconstruídas com ImageGen. Vistas complementares espelhadas e calibradas em escala uniforme.',limitation='Painéis traseiros sem fonte original recuperada; detalhes ocultos são reconstruções simples, não uma confirmação histórica.')
 (folder/'item.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(HERE/'machines-export.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('Sete estágios, quatro poses por estágio; prévias da interface preservadas.')
subprocess.run(['node',str(HERE/'align-back-support.mjs')],cwd=ROOT,check=True)

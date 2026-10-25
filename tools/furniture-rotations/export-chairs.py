"""Uniformly register generated chair views by ground support; store a distinct hip contact per pose."""
from pathlib import Path
from PIL import Image
import json,sys
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
SPECS=[
 dict(key='pink',name='pink_square_chair',width=84,
  views=dict(front=dict(ground=[272,728],seat=[245,463],rotation=1),back=dict(ground=[280,590],seat=[309,308],rotation=3)),
  masks=dict(back=[[36,4,268,120,267,419,39,308],[0,0,45,0,45,586,12,586],[267,128,316,128,321,717,264,717]])),
 dict(key='pacman',name='acervo_chair_yellow_black',width=110,
  # The front opens toward +x (SE); its pelvis contact sits by the cushion/backrest joint,
  # leaving the forward part of the cushion for the thighs rather than the hip itself.
  views=dict(front=dict(ground=[338.5,512],seat=[375,360],rotation=0,opening=[[335,337],[495,430]]),back=dict(ground=[388.5,506.5],seat=[388,365],rotation=2,opening=[[450,405],[270,310]])),
  masks=dict(front=[[0,330,40,215,128,160,229,211,227,397,381,488,376,575,309,627,198,614,78,570,16,477]],
   back=[[258,216,514,63,641,113,698,329,677,437,340,553,274,505],
    [0,294,40,226,161,307,154,164,201,138,261,190,340,357,344,527,302,573,180,590,58,547,16,447],
    [478,25,530,0,588,33,649,110,702,221,710,365,671,433,657,360,639,255,579,156,535,125,479,143]])),
]
report=[]
for spec in SPECS:
 if sys.argv[1:] and spec['name'] not in sys.argv[1:] and spec['key'] not in sys.argv[1:]: continue
 folder=ROOT/'game/public/assets/items'/spec['name'];m=json.loads((folder/'item.json').read_text(encoding='utf-8'))
 parts=[];anchors=[];layers=[];views={}
 for view,geometry in spec['views'].items():
  source=Image.open(HERE/f"generated/{spec['key']}-{view}.png").convert('RGBA');scale=spec['width']/source.width
  out=source.convert('RGBa').resize((spec['width'],round(source.height*scale)),Image.Resampling.LANCZOS).convert('RGBA')
  file=f'{view}-v2.png';out.save(folder/file)
  sx=out.width/source.width;sy=out.height/source.height
  # Ground remains the tile center (0,40); the seat can have a lower physical height than the classic chair.
  left=-round(geometry['ground'][0]*sx);top=round(40-geometry['ground'][1]*sy)
  anchor=dict(x=round(left+geometry['seat'][0]*sx,4),y=round(top+geometry['seat'][1]*sy,4))
  rotation=geometry['rotation'];mate=rotation^1
  for r,flip in [(rotation,False),(mate,True)]:
   p=dict(file=file,width=out.width,height=out.height,left=-left-out.width if flip else left,top=top,rotation=r)
   if flip:p['flipX']=True
   parts.append(p);anchors.append(dict(rotation=r,x=-anchor['x'] if flip else anchor['x'],y=anchor['y']))
   polygons=spec['masks'].get(view)
   if polygons:
    scaled=[[round((out.width-value*sx if flip else value*sx) if i%2==0 else value*sy,4) for i,value in enumerate(poly)] for poly in polygons]
    layers.append(dict(rotation=r,polygons=scaled))
  views[view]=dict(source=f"tools/furniture-rotations/generated/{spec['key']}-{view}.png",sourceSize=list(source.size),ground=geometry['ground'],seat=geometry['seat'],scale=scale,frame=dict(left=left,top=top,width=out.width,height=out.height),rotation=rotation)
  if geometry.get('opening'): views[view]['opening']=geometry['opening']
 m['parts']=sorted(parts,key=lambda p:p['rotation']);m['seatingAnchors']=sorted(anchors,key=lambda p:p['rotation']);m['seatingBackrests']=sorted(layers,key=lambda p:p['rotation']);m['itemHeight']=max(40-p['top'] for p in parts)
 m.setdefault('source',{})['art']='Reconstrução nova com ImageGen integrado; tools/furniture-rotations/prompts.json. Não é PNG original recuperado.'
 m['source']['seatingCalibration']=dict(method='Escala uniforme, apoio no chão e contato do quadril por vista; ajuste visual do corpo separado do tile e da sombra.',views=views,foregroundMasks=m['seatingBackrests'])
 (folder/'item.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');report.append(dict(classname=spec['name'],views=views,anchors=m['seatingAnchors']))
record=HERE/'chairs-export.json'
previous=json.loads(record.read_text(encoding='utf-8')) if record.exists() else []
updated={r['classname']:r for r in previous}
updated.update({r['classname']:r for r in report})
record.write_text(json.dumps(list(updated.values()),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'{len(report)} cadeira(s) registrada(s), quatro poses cada, com contato do assento e máscaras próprias.')

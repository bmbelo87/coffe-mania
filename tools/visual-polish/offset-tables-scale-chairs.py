from pathlib import Path
import json,shutil
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];dx,dy=-3,-8
def align_mirrored_parts(manifest):
 for part in manifest['parts']:
  if part.get('flipX'):
   mate=next((v for v in manifest['parts'] if v['file']==part['file'] and not v.get('flipX')),None)
   if mate:part['left']=-mate['left']-mate['width']
for name in ['acervo_lote02_table_italy_green_check','acervo_lote02_table_italy_red_check']:
 p=ROOT/'game/public/assets/items'/name/'item.json';m=json.loads(p.read_text(encoding='utf-8'));old=m['source'].get('runtimeArtOffset',{'x':0,'y':0})
 for part in m['parts']:part['left']+=dx-old['x'];part['top']+=dy-old['y']
 m['source']['runtimeArtOffset']={'x':dx,'y':dy,'reason':'Registro visual da mesa; a origem lógica e a pegada permanecem iguais.'};m['mealAnchor']={'x':dx,'y':round(40+(-9-40)*.86+dy,3)};p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for name in ['acervo_lote02_chair_italy_green','acervo_lote02_chair_italy_red']:
 folder=ROOT/'game/public/assets/items'/name;p=folder/'item.json';m=json.loads(p.read_text(encoding='utf-8'))
 if m['source'].get('runtimeVisualScale',{}).get('factor')==.93:
  align_mirrored_parts(m);p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');continue
 backup=ROOT/'.runtime/visual-polish/chairs-before'/name;backup.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,backup/'item.json');oldparts=[dict(v)for v in m['parts']];sizes={}
 for file in set(v['file']for v in m['parts']):
  source=folder/file;shutil.copyfile(source,backup/file);im=Image.open(source).convert('RGBA');size=(round(im.width*.93),round(im.height*.93));sizes[file]=(im.size,size);im.convert('RGBa').resize(size,Image.Resampling.LANCZOS).convert('RGBA').save(source)
 for part in m['parts']:
  old,new=sizes[part['file']];part.update(width=new[0],height=new[1],left=round(part['left']*.93),top=round(8+(part['top']-8)*.93))
 align_mirrored_parts(m)
 for layer in m.get('seatingBackrests',[]):
  before=next(p for p in oldparts if p['rotation']==layer['rotation']);after=next(p for p in m['parts']if p['rotation']==layer['rotation']);sx=after['width']/before['width'];sy=after['height']/before['height'];layer['polygons']=[[round(v*(sy if i%2 else sx),4)for i,v in enumerate(poly)]for poly in layer['polygons']]
 m['itemHeight']=round(m['itemHeight']*.93,3);m['source']['runtimeVisualScale']={'factor':.93,'center':[0,8],'beforeParts':oldparts,'reason':'Escala uniforme preservando o centro do assento usado pela pose do ocupante; máscaras acompanham a reamostragem.'};p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

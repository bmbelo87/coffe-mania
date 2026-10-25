from pathlib import Path
from PIL import Image
import json,shutil
root=Path.cwd();scale=.86
for name in ['acervo_lote02_table_italy_green_check','acervo_lote02_table_italy_red_check']:
 folder=root/'game/public/assets/items'/name;manifest=json.loads((folder/'item.json').read_text(encoding='utf-8'))
 if manifest.get('source',{}).get('runtimeVisualScale',{}).get('factor')==scale:continue
 backup=root/'.runtime/visual-polish/tables-before'/name;backup.mkdir(parents=True,exist_ok=True)
 if (backup/'item.json').exists():manifest=json.loads((backup/'item.json').read_text(encoding='utf-8'))
 else:shutil.copyfile(folder/'item.json',backup/'item.json')
 before=[]
 for part in manifest['parts']:
  file=folder/part['file'];original=backup/part['file']
  if not original.exists():shutil.copyfile(file,original)
  im=Image.open(original).convert('RGBA');print(name,part['file'],'before alpha',im.getchannel('A').getbbox(),'frame',part['left'],part['top']);before.append(dict(part));size=(round(im.width*scale),round(im.height*scale));im=im.convert('RGBa').resize(size,Image.Resampling.LANCZOS).convert('RGBA');im.save(file);part.update(width=size[0],height=size[1],left=round(part['left']*scale),top=round(40+(part['top']-40)*scale));print('after',part)
 manifest['itemHeight']=round(manifest['itemHeight']*scale,3);manifest['source']['runtimeVisualScale']={'factor':scale,'center':[0,40],'beforeParts':before,'reason':'Escala uniforme intermediária de 0,86 sobre o centro do apoio. Mantém proporções e reduz a ocupação da toalha; não representa inscrição completa no losango. Pegada lógica e navegação preservadas.'};(folder/'item.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

"""Review active surface PNGs without changing game assets."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import map_coordinates

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.runtime/surface-cleanup'

def flat(image, floor):
    arr = np.array(image.convert('RGBA')).astype(float)
    if floor:
        v, u = (np.mgrid[0:256, 0:256].astype(float) + .5) / 256
        x, y = (u-v)*80+81, (u+v)*40+1
    else:
        h, x = np.mgrid[0:208, 0:160].astype(float)
        x = (x+.5)/2; y = h+.5+x/2
    rgb = np.stack([map_coordinates(arr[:,:,c], [y, x], order=1, mode='nearest') for c in range(3)], -1)
    return Image.fromarray(np.uint8(np.clip(rgb, 0, 255)))

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    records = []
    for folder in sorted((ROOT/'game/public/assets/items').glob('behance_*')):
        m = json.loads((folder/'item.json').read_text(encoding='utf-8'))
        if m['type'] not in (0, 1): continue
        parts = []
        for p in m['parts']:
            im = Image.open(folder/p['file']).convert('RGBA')
            target = OUT/'before'/folder.name/p['file']; target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists(): im.save(target)
            parts.append(flat(im, m['type']==0))
        f = parts[0]; f.save(OUT/f'{folder.name}-flat.png')
        records.append(dict(classname=folder.name, type=m['type'], source=m.get('source', {}), parts=m['parts']))
    for kind, label in [(0,'floors'), (1,'walls')]:
        group = [m for m in records if m['type']==kind]
        w,h = (300,294) if kind==0 else (300,250)
        sheet = Image.new('RGB',(4*w, ((len(group)+3)//4)*h),'#e9e5de'); d=ImageDraw.Draw(sheet)
        for i,m in enumerate(group):
            x,y=(i%4)*w,(i//4)*h
            im=Image.open(OUT/f"{m['classname']}-flat.png")
            if kind==1:
                repeated=Image.new('RGB',(240,208))
                for n in range(3): repeated.paste(im.resize((80,208)),(80*n,0))
                im=repeated
            sheet.paste(im,(x+16,y+26)); d.text((x+8,y+6),m['classname'].replace('behance_',''), fill='black')
        sheet.save(OUT/f'{label}.jpg',quality=96)
    (OUT/'inventory.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'{len(records)} active surfaces reviewed; sheets: {OUT}')

if __name__=='__main__': main()

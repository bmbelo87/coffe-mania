"""Replace only the dedicated hairstyle thumbnail, retaining every UV texture and ID."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
AVATAR = ROOT / 'game/public/assets/avatar'
SOURCE = Path(__file__).resolve().parent / 'hair-icon-source.png'

image = Image.open(SOURCE).convert('RGBA')
mask = image.getchannel('A').point(lambda a: 255 if a >= 96 else 0)
cols = [x for x in range(image.width) if mask.crop((x,0,x+1,image.height)).histogram()[255] > 12]
rows = [y for y in range(image.height) if mask.crop((0,y,image.width,y+1)).histogram()[255] > 12]
image = image.crop((min(cols), min(rows), max(cols)+1, max(rows)+1))
image.thumbnail((120, 120), Image.Resampling.LANCZOS)
icon = Image.new('RGBA', (128,128))
icon.paste(image, ((128-image.width)//2, (128-image.height)//2))
icon.save(AVATAR / 'starter/hair-icon.png', optimize=True)
atlas = json.loads((AVATAR / 'atlas.json').read_text(encoding='utf-8'))
symbol = atlas['symbols']['StarterHairIcon']
sheet = Image.open(AVATAR / 'atlas.png').convert('RGBA')
sheet.paste(icon, (symbol['sx'], symbol['sy']))
sheet.save(AVATAR / 'atlas.png', optimize=True)
(AVATAR / 'starter/hair-icon-source.json').write_text(json.dumps(dict(
    method='Built-in Image Gen; generated faceless thumbnail matched to Hair03; alpha crop and downscale',
    master='tools/avatar-fallback/hair-icon-source.png', prompt='tools/avatar-fallback/hair-icon-prompt.txt',
    styleReference='tools/avatar-fallback/hair-icon-style-reference.png',
    output='game/public/assets/avatar/starter/hair-icon.png', symbol='StarterHairIcon', size=[128,128]
), ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print('Updated StarterHairIcon; other atlas pixels and wardrobe IDs retained.')

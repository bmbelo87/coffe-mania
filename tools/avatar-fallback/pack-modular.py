"""Pack the Image Gen transparent UV layers into the existing avatar catalogue."""
import json
from pathlib import Path
from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[2]
AVATAR = ROOT / 'game/public/assets/avatar'
atlas = json.loads((AVATAR / 'atlas.json').read_text(encoding='utf-8'))
original = Image.open(AVATAR / 'atlas.png').convert('RGBA')
source = Image.open(AVATAR / 'starter/modular-source.png').convert('RGBA').resize((256, 256), Image.Resampling.LANCZOS)
base_height = atlas.get('starterRow', atlas['sheet'][1])
sheet = Image.new('RGBA', (2048, base_height + 256))
sheet.paste(original.crop((0, 0, 2048, base_height)), (0, 0))

parts = {
    'Eyes': ('StarterEyes', (26, 43, 102, 62), 1050022, 'Olhos Café Mania', [], 1),
    'Mouth': ('StarterMouth', (49, 67, 80, 83), 1060025, 'Sorriso Café Mania', [], 1),
    'Eyebrows': ('StarterEyebrows', (27, 31, 103, 42), 1070012, 'Sobrancelhas Café Mania', [], 2),
    'Pants': ('StarterPants', (175, 186, 256, 256), 1000021, 'Calça castanha Café Mania', ['pants01'], 0),
    'Shirt': ('StarterShirt', (0, 123, 256, 256), 1020056, 'Uniforme azul Café Mania', ['shirt01', 'armleft', 'armright'], 0),
}
for column, (group, (symbol, box, item_id, name, objects, priority)) in enumerate(parts.items()):
    layer = source.crop(box)
    if group == 'Shirt':
        # The trouser island shares this bounding rectangle, but belongs to another slot.
        layer.paste((0, 0, 0, 0), (175, 186 - box[1], 256, layer.height))
    layer.save(AVATAR / f'starter/{group.lower()}.png')
    x = column * 256
    sheet.paste(layer, (x, base_height))
    atlas['symbols'][symbol] = dict(sx=x, sy=base_height, w=layer.width, h=layer.height, tx=box[0], ty=box[1])

# Normalize the generated brown albedo to a light value map, retaining its facets.
# The renderer multiplies it by the user's chosen hair colour.
hair = Image.open(AVATAR / 'starter/hair.png').convert('L').resize((256, 256), Image.Resampling.LANCZOS)
mean = ImageStat.Stat(hair).mean[0]
hair = hair.point(lambda value: max(0, min(255, round(value * 230 / mean)))).convert('RGBA')
hair.save(AVATAR / 'starter/hair-shading.png')
sheet.paste(hair, (1280, base_height))
atlas['symbols']['StarterHairShading'] = dict(sx=1280, sy=base_height, w=256, h=256, tx=0, ty=0)
icon_path = AVATAR / 'starter/hair-icon.png'
if icon_path.exists():
    icon = Image.open(icon_path).convert('RGBA').resize((128, 128))
    sheet.paste(icon, (1536, base_height))
    atlas['symbols']['StarterHairIcon'] = dict(sx=1536, sy=base_height, w=128, h=128, tx=0, ty=0)
atlas['sheet'] = list(sheet.size)
atlas['starterRow'] = base_height
sheet.save(AVATAR / 'atlas.png')
(AVATAR / 'atlas.json').write_text(json.dumps(atlas, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

wardrobe = json.loads((AVATAR / 'wardrobe.json').read_text(encoding='utf-8'))
for group, (symbol, box, item_id, name, objects, priority) in parts.items():
    wardrobe['items'] = [item for item in wardrobe['items'] if item['id'] != item_id]
    wardrobe['items'].append(dict(id=item_id, name=name, group=group, objects=objects, hideGroups=[], texture=symbol, cost=0, priority=priority))
wardrobe['items'] = [item for item in wardrobe['items'] if item['id'] != 1040016]
wardrobe['items'].append(dict(id=1040016, name='Cabelo pontudo Café Mania', group='Hair', objects=['hairStarter'], hideGroups=[], cost=0, priority=0, iconName='StarterHairIcon'))
# Keep each addition easy to discover without changing existing default selections.
new_ids = {value[2] for value in parts.values()} | {1040016}
additions = {item['group']: item for item in wardrobe['items'] if item['id'] in new_ids}
ordered = []
for item in wardrobe['items']:
    if item['id'] in new_ids:
        continue
    if item['group'] in additions:
        ordered.append(additions.pop(item['group']))
    ordered.append(item)
wardrobe['items'] = ordered + list(additions.values())
(AVATAR / 'wardrobe.json').write_text(json.dumps(wardrobe, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

catalog_path = ROOT / 'database/appearance/catalog.json'
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
for group, (_, _, item_id, _, _, _) in parts.items():
    if item_id not in catalog['slots'][group]:
        catalog['slots'][group].append(item_id)
if 1040016 not in catalog['slots']['Hair']:
    catalog['slots']['Hair'].append(1040016)
catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Packed 6 selectable parts and synchronized appearance validation.')

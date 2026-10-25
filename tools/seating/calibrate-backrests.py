"""Register foreground masks over the existing, assembled rear chair poses."""
import json
import argparse
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
ITEMS = ROOT / 'game/public/assets/items'

# Polygons follow the visible back/post surfaces. They do not change pixels or ground geometry.
classic = [
    [34,0,83,0,83,62,34,62],
    [49,71,54,66,59,63,64,63,69,66,72,71,73,78,69,76,65,72,61,71,57,73,53,78,49,83],
    [38,35,43,32,49,36,49,102,47,115,47,139,40,142,38,139,39,109,42,102,39.75,67,39,63,38,49],
    [73,22,78,17,82,20,82,34,80,84,80,99,82,109,83,122,77,124,72,108,70,97,72,86],
]
italy = [
    [0,0,92,0,92,43,0,43],
    [35,40,47,40,48,117,39,121,35,115],
    [70,29,83,29,84,99,73,101,69,82],
    [46,52,72,40,73,45,46,58],
    [46,69,72,57,73,62,46,75],
    [46,93,73,79,74,86,46,100],
]
shapes = {
    'classic_chair': (classic, False),
    'acervo_lote02_chair_italy_red': (italy, False),
    'acervo_lote02_chair_italy_green': (italy, False),
    'pink_square_chair': ([[35,0,82,0,82,56,43,76,35,70], [35,18,45,18,45,121,37,122], [73,0,82,0,82,104,73,104]], False),
    'acervo_chair_50_red': ([[26,0,89,0,89,40,40,64,26,58], [43,51,49,51,49,113,43,113], [79,27,85,27,85,93,79,93]], False),
    'acervo_chair_yellow_black': ([[18,0,92,0,92,53,48,80,20,64]], False),
    'original_gold_armchair': ([[0,0,82,0,82,57,48,76,0,49]], True),
}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true', help='Validate saved masks without writing manifests.')
parser.add_argument('--preview', type=Path, help='Export a contact sheet of all masks (requires Pillow).')
args = parser.parse_args()
previews = []
for name, (polygons, reverse) in shapes.items():
    path = ITEMS / name / 'item.json'
    data = json.loads(path.read_text(encoding='utf-8'))
    authored = data.get('source', {}).get('seatingCalibration', {}).get('foregroundMasks')
    if authored is not None:
        if args.check:
            assert data.get('seatingBackrests') == authored, f'{name}: foreground masks differ from their authored calibration'
        else:
            data['seatingBackrests'] = authored
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
        for layer in authored:
            part = next(p for p in data['parts'] if p.get('rotation',0)==layer['rotation'])
            assert all(0 <= value <= (part['height'] if i % 2 else part['width']) for polygon in layer['polygons'] for i,value in enumerate(polygon)), name
            if args.preview:
                from PIL import Image,ImageDraw,ImageChops
                image=Image.open(path.parent/part['file']).convert('RGBA')
                if part.get('flipX'):image=image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                mask=Image.new('L',image.size)
                for polygon in layer['polygons']:ImageDraw.Draw(mask).polygon(list(zip(polygon[::2],polygon[1::2])),fill=255)
                mask=ImageChops.multiply(mask,image.getchannel('A')).point(lambda v:round(v*.55));overlay=Image.new('RGBA',image.size,(255,0,100,0));overlay.putalpha(mask)
                previews.append((name,layer['rotation'],Image.alpha_composite(image,overlay)))
        continue
    layers = []
    for rotation in [2,3]:
        part = next(p for p in data['parts'] if p.get('rotation',0)==rotation)
        flip = (rotation==3) != reverse
        reference = next((p for p in data.get('source', {}).get('runtimeVisualScale', {}).get('beforeParts', []) if p.get('rotation',0)==rotation), part)
        width = reference['width']
        reference_height = reference['height']
        points = [[max(0, min(reference_height if i % 2 else width,
                             width-value if i % 2 == 0 and flip else value))
                   for i, value in enumerate(polygon)] for polygon in polygons]
        if reference is not part:
            points = [[round(value * (part['height'] / reference_height if i % 2 else part['width'] / width), 4) for i, value in enumerate(polygon)] for polygon in points]
        layers.append(dict(rotation=rotation, polygons=points))
        assert all(0 <= value <= (part['height'] if i % 2 else part['width'])
                   for polygon in points for i, value in enumerate(polygon)), name
        if args.preview:
            from PIL import Image, ImageDraw
            image = Image.open(path.parent / part['file']).convert('RGBA')
            if part.get('flipX'): image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            mask = Image.new('L', image.size)
            draw = ImageDraw.Draw(mask)
            for polygon in points:
                draw.polygon(list(zip(polygon[::2], polygon[1::2])), fill=255)
            # Tint only existing pixels; transparent holes stay holes.
            from PIL import ImageChops
            mask = ImageChops.multiply(mask, image.getchannel('A')).point(lambda v: round(v * .55))
            overlay = Image.new('RGBA', image.size, (255, 0, 100, 0))
            overlay.putalpha(mask)
            previews.append((name, rotation, Image.alpha_composite(image, overlay)))
    if args.check:
        assert data.get('seatingBackrests') == layers, f'{name}: run calibration to synchronize masks'
        continue
    data['seatingBackrests'] = layers
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
if args.preview:
    from PIL import Image, ImageDraw
    sheet = Image.new('RGB', (960, ((len(previews)+1)//2) * 325), '#e5e0d4')
    draw = ImageDraw.Draw(sheet)
    for i, (name, rotation, image) in enumerate(previews):
        x, y = (i % 2) * 480, (i // 2) * 325
        draw.text((x + 8, y + 8), f'{name} / {rotation}', fill='black')
        image = image.resize((image.width * 2, image.height * 2))
        sheet.paste(image, (x + 140, y + 32), image)
    args.preview.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.preview)
print(('Checked' if args.check else 'Registered') + ' rear backrest masks for 7 chair models; original PNGs unchanged.')

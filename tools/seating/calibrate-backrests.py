"""Register foreground masks over the existing, assembled rear chair poses."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
ITEMS = ROOT / 'game/public/assets/items'

# Polygons follow the visible back/post surfaces. They do not change pixels or ground geometry.
classic = [
    [34,0,83,0,83,62,34,62],
    [47,71,52,65,58,62,64,62,70,65,74,73,74,85,69,77,65,72,60,70,55,73,50,81,47,84],
    [37,32,49,32,49,103,47,140,39,143,37,141],
    [71,15,83,15,83,94,83,124,76,125,69,97],
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
for name, (polygons, reverse) in shapes.items():
    path = ITEMS / name / 'item.json'
    data = json.loads(path.read_text(encoding='utf-8'))
    layers = []
    for rotation in [2,3]:
        part = next(p for p in data['parts'] if p.get('rotation',0)==rotation)
        flip = (rotation==3) != reverse
        width = part['width']
        points = [[(width-value if i%2==0 and flip else value) for i,value in enumerate(polygon)] for polygon in polygons]
        layers.append(dict(rotation=rotation, polygons=points))
    data['seatingBackrests'] = layers
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
print('Registered rear backrest masks for 7 chair models; original PNGs unchanged.')

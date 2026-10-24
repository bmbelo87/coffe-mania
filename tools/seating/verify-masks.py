"""Check semantic chair landmarks: the occupant must cover the seat, not the backrest."""
import json
from pathlib import Path
from PIL import Image

items = Path(__file__).resolve().parents[2] / 'game/public/assets/items'

def contains(polygon, x, y):
    vertices = list(zip(polygon[::2], polygon[1::2]))
    inside = False
    for (ax, ay), (bx, by) in zip(vertices, vertices[1:] + vertices[:1]):
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            inside = not inside
    return inside

chair = json.loads((items / 'classic_chair/item.json').read_text(encoding='utf-8'))
# Measured on the actual wood surfaces, not derived from the authored polygon vertices.
seat = [(37.5, 86), (70, 90), (50, 83.5), (26, 84), (58, 91)]
backrest = [(43, 85), (60, 66), (60, 38), (76, 86)]
for layer in chair['seatingBackrests']:
    rotation = layer['rotation']
    for expected, samples in [(False, seat), (True, backrest)]:
        for x, y in samples:
            if rotation == 3:
                x = 83 - x
            actual = any(contains(polygon, x, y) for polygon in layer['polygons'])
            assert actual == expected, f'rotation {rotation}: ({x}, {y}) should be {"backrest" if expected else "seat behind body"}'
    image = Image.open(items / f'classic_chair/rotation-{rotation}.png').convert('RGBA')
    # Flat seat paint is a semantic region, not a handful of handpicked edge points.
    # Check pixel centers across the whole seat height, including the taper beside the post.
    leaks = []
    for y in range(64, 108):
        for x in range(image.width):
            r, g, b, a = image.getpixel((x, y))
            if a > 240 and max(abs(r - 163), abs(g - 135), abs(b - 95)) <= 3:
                if any(contains(polygon, x + .5, y + .5) for polygon in layer['polygons']):
                    leaks.append((x, y))
    assert not leaks, f'rotation {rotation}: {len(leaks)} seat pixels enter the foreground mask: {leaks[:8]}'
print('Chair masks: exposed seat excluded, posts and arches retained in both rear poses: OK')

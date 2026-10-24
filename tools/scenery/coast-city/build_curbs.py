"""Curb, crosswalk and road-marking rasters measured from the original city coast.

Source: "cafe mania muito tempo de jogo.mp4", frames 1:52-2:12 (t118, t124, t130, t132),
1280x720, same camera zoom. The cafe floor grid repeats every 33.5 px on both iso
projections, so one video pixel is 80/33.5 = 2.39 world pixels. Colors are medians taken
along each edge (perpendicular profiles averaged over 100+ columns, joints excluded); the
video blur is not reproduced, edges are kept crisp like the Flash art.

Textures are authored at 2x (repeat 0.5 in scene.json). Joints repeat every 160 world px
(measured 64.3 video px = 154 world px, rounded to two tile steps).
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
TERRAIN = ROOT / 'game/public/assets/scenery/coast-city/terrain'
SCALE = 2  # texture px per world px
JOINT = 160
TILE_W = 320  # two joints per texture tile, at u = 80 and 240

# Street-facing curb of the far sidewalk, top to bottom (world px, RGB).
# Video profile: top 9 px, lip 2, front edge 2, riser 9, dark foot 3.
FAR_ROWS = [
    (22, (198, 197, 198)),  # top
    (5, (207, 206, 207)),   # lit front lip
    (2, (190, 189, 190)),
    (2, (170, 170, 171)),
    (21, (155, 155, 156)),  # riser
    (2, (139, 139, 139)),
    (5, (123, 123, 123)),   # foot line on the asphalt
]
FAR_TOP = 27  # rows above the riser: they lie over the sidewalk
# Top-only edges (riser hidden). Cafe side: road, top, light inner bevel, sidewalk.
NEAR_ROWS = [
    (2, (178, 176, 175)),
    (19, (200, 198, 197)),
    (2, (215, 212, 205)),
    (3, (228, 224, 216)),
    (2, (219, 212, 202)),
    (2, (203, 197, 183)),
]
# Beach side: sand, top, dark seam, faint light line, sidewalk.
BEACH_ROWS = [
    (19, (197, 195, 195)),
    (2, (183, 181, 182)),
    (5, (193, 190, 185)),
    (2, (183, 179, 172)),
]


def profile(rows):
    out = []
    for height, color in rows:
        out += [color] * (height * SCALE)
    return out


def mix(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def joint_weight(distance, core, soft):
    """1 inside the dark core of a joint, fading to 0 across `soft` world px."""
    if distance <= core:
        return 1.0
    return max(0.0, 1 - (distance - core) / soft)


def curb_far():
    rows = profile(FAR_ROWS)
    image = Image.new('RGB', (TILE_W * SCALE, len(rows)))
    px = image.load()
    for y, base in enumerate(rows):
        v = y / SCALE
        for x in range(image.width):
            u = (x + .5) / SCALE
            color = base
            for j in (80, 240):
                if v < FAR_TOP:
                    # On the top the joint follows the other floor axis: 45 degrees in this strip.
                    w = joint_weight(abs(u - (j + FAR_TOP - v)), 1.2, 1.8)
                    color = mix(color, (158, 157, 158), w)
                else:
                    w = joint_weight(abs(u - j), 1.5, 2.0)
                    color = mix(color, (132, 132, 133), w)
            px[x, y] = color
    return image


def curb_top(rows, dark):
    rows = profile(rows)
    image = Image.new('RGB', (TILE_W * SCALE, len(rows)))
    px = image.load()
    for y, base in enumerate(rows):
        for x in range(image.width):
            u = (x + .5) / SCALE
            color = base
            for j in (80, 240):
                color = mix(color, dark, joint_weight(abs(u - j), 2.0, 3.0))
            px[x, y] = color
    return image


# Original crosswalk, relative to the foot of the curb riser at the road end (world px):
# centers along the road A=40.3 and across B=30.4, 58.1, 89.1, 122.0; each block 26.8 x 17.7.
# The uneven spacing is in all frames of that camera, so it is kept.
CROSS_B = (30.4, 58.1, 89.1, 122.0)
CROSS_A = 40.3
CROSS_SIZE = (17.7, 26.8)  # (B, A)
CROSS_COLOR = (240, 239, 242, 255)
CROSS_LOCAL = (270, 60)  # part size in local units: x = 2*B, y = 2*(A - A0) from the part origin


def crosswalk():
    # Local axes of the part: x -> (-1, .5) = B/2, y -> (1, .5) = A/2, at 2 texture px per unit.
    image = Image.new('RGBA', (CROSS_LOCAL[0] * SCALE, CROSS_LOCAL[1] * SCALE), (0, 0, 0, 0))
    px = image.load()
    a0 = CROSS_A - CROSS_LOCAL[1] / 4  # part origin sits A0 along the road from the riser foot
    for b in CROSS_B:
        for y in range(image.height):
            for x in range(image.width):
                lb = (x + .5) / SCALE / 2  # local unit -> B
                la = (y + .5) / SCALE / 2 + a0
                cb = min(1, max(0, CROSS_SIZE[0] / 2 - abs(lb - b) + .25) * 2)
                ca = min(1, max(0, CROSS_SIZE[1] / 2 - abs(la - CROSS_A) + .25) * 2)
                coverage = cb * ca
                if coverage > 0:
                    r, g, bl, _ = CROSS_COLOR
                    old = px[x, y][3] / 255
                    px[x, y] = (r, g, bl, round(255 * min(1, old + coverage)))
    return image, a0


# Center line: dashes 38.2 long every 67.4 (world px along the road), 8.4 across.
DASH = 38.2
DASH_PITCH = 67.4
DASH_WIDTH = 8.4


def road_marking():
    width = round(DASH_PITCH * SCALE * 2)  # two dashes per tile keeps the period exact
    image = Image.new('RGBA', (width, round(DASH_WIDTH * SCALE)), (0, 0, 0, 0))
    px = image.load()
    for x in range(image.width):
        u = (x + .5) / SCALE % DASH_PITCH
        coverage = min(1, max(0, min(u, DASH - u) + .25) * 2) if u < DASH + .5 else 0
        if coverage <= 0:
            continue
        for y in range(image.height):
            px[x, y] = (249, 249, 249, round(255 * coverage))
    return image


if __name__ == '__main__':
    import hashlib, json
    outputs = {
        'curb': curb_far(),
        'curb-top': curb_top(NEAR_ROWS, (170, 168, 166)),
        'curb-top-beach': curb_top(BEACH_ROWS, (152, 150, 150)),
        'crosswalk': crosswalk()[0],
        'road-marking': road_marking(),
    }
    files = {}
    for name, image in outputs.items():
        path = TERRAIN / f'{name}.png'
        image.save(path)
        files[f'terrain/{name}.png'] = {'width': image.width, 'height': image.height,
                                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    registry = {
        'origin': 'measured-from-original-video',
        'video': 'videos-jogo/cafe mania muito tempo de jogo.mp4',
        'frames': ['1:52', '1:58', '2:04', '2:10', '2:12'],
        'scale': '1 video px = 2.39 world px (floor grid period 33.5 px = one 160x80 tile)',
        'note': 'Flat rasters drawn by this script from the measured colors and sizes; not '
                'extracted sprites. The video blur is not reproduced.',
        'files': files,
    }
    (Path(__file__).parent / 'curbs.json').write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(', '.join(files))

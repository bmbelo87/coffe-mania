"""Extract floors and wallpapers from the high-resolution showcase rooms (Behance 9287765).

Each room is an isometric render whose tile is about 3.2x the game's 160x80 tile. A surface is
rectified in tile units from the room's back floor corner, its repeat period is measured on the
rectified plane, and every listed cell of that period is stacked. The cleanest cell is the seed, and
its pixels covered by furniture or characters are filled from cells where that spot is free.

Usage: python tools/surfaces-behance/rooms.py [--write] [--review DIR] [classname ...]
Without --write nothing in the game folder changes.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib, json, sys
import numpy as np
from scipy.ndimage import map_coordinates

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
ARCHIVE = ROOT / 'artes-referencia/cafe-mania-behance-alta-qualidade-documentado/cafe-mania-behance'
ITEMS = ROOT / 'game/public/assets/items'
PROJECT = '9287765'
Image.MAX_IMAGE_PIXELS = None
# One tile edge step at room scale 1: 257.4 px across, 128.7 px down; walls 673 px tall.
STEP, WALL = 257.4, 673
SS = 3  # Output supersampling before the final reduction.

# Back corner at the top of the walls (silhouette fit) and room scale.
ROOMS = {
    5: dict(top=(2053, -0.5), scale=1, theme='Aniversário'),
    6: dict(top=(2071, -0.5), scale=1, theme='Las Vegas'),
    # 7 (Cinema): the carpets do not repeat on the fitted grid; scale and origin still uncalibrated.
    7: dict(top=(2709.2, 3.4), scale=.95, theme='Cinema'),
    8: dict(top=(2058.5, -0.8), scale=1, theme='Egito'),
    9: dict(top=(2066, 2.5), scale=1, theme='Espanha'),
    10: dict(top=(2099, 159), scale=1, theme='Medieval'),
    11: dict(top=(2099.5, -0.8), scale=1, theme='Videogame'),
    12: dict(top=(2051, 1), scale=1, theme='Itália'),
    13: dict(top=(2098.5, 0.8), scale=1, theme='México'),
    14: dict(top=(1650.5, 416.8), scale=.96, theme='Natal (release 73)'),
    15: dict(top=(1346, 3.5), scale=.434, theme='Paris'),
    16: dict(top=(2052, 0), scale=1, theme='Mosqueteiros'),
    17: dict(top=(2108, 158), scale=1, theme='Páscoa'),
}

# kind: floor | left | right. Floor cells are (i, j) tiles along the right and left walls; wall
# cells are segment indices from the corner. period is in tiles/segments (2 = two-cell motif).
SURFACES = []

def surface(classname, name, room, kind, cells, period=1, **extra):
    SURFACES.append(dict(classname=classname, name=name, room=room, kind=kind, cells=cells, period=period, **extra))

def box(i0, i1, j0, j1, skip=()):
    return [(i, j) for i in range(i0, i1) for j in range(j0, j1) if (i, j) not in skip]

# --- Surfaces -------------------------------------------------------------------------------
# Re-extractions of the portfolio sheet items keep their classnames, ids and shop names. Walls list
# whole segments, or (segment, h0, h1) bands checked free on the rectified wall (0 = top), and may
# borrow ('left'|'right', segment, h0, h1) from the room's other wall when it shows the same paper.
ALL8 = list(range(8))
surface('behance_wall_balloons', 'Parede Balões', 5, 'left', ALL8)
surface('behance_wall_confetti', 'Parede Confetes', 5, 'right', ALL8)
surface('behance_floor_classic', 'Piso Clássico', 6, 'floor', box(0, 4, 1, 8) + box(4, 7, 5, 8))
surface('behance_floor_cards', 'Piso Cartas', 6, 'floor', box(0, 7, 0, 1) + box(1, 7, 1, 3) + box(4, 8, 3, 5))
surface('behance_floor_egypt', 'Piso Egípcio', 8, 'floor', box(2, 8, 0, 3) + box(3, 8, 3, 8))
surface('behance_floor_oriental', 'Piso Oriental', 8, 'floor', [(0, 1), (0, 2), (1, 2), (0, 3), (1, 3), (2, 3)] + box(0, 4, 4, 8))
surface('behance_wall_oriental', 'Parede Oriental', 8, 'left', ALL8, vertical=(.2, 1, .2))
surface('behance_floor_blue_tiles', 'Piso Azulejos Azuis', 9, 'floor', box(0, 3, 1, 8) + box(3, 6, 6, 8))
surface('behance_floor_parquet', 'Piso Parquet', 9, 'floor', box(1, 7, 0, 3) + box(3, 7, 3, 6))

# New surfaces from the showcase rooms.
surface('behance_floor_party_lilac', 'Piso Lilás Quadriculado', 5, 'floor', box(0, 3, 3, 7))
surface('behance_floor_party_teal', 'Piso Azul-Petróleo', 5, 'floor', box(4, 8, 0, 4))
surface('behance_floor_medieval_stone', 'Piso Pedras com Flores', 10, 'floor', box(0, 8, 0, 4))
surface('behance_floor_medieval_grass', 'Piso Grama Florida', 10, 'floor', box(0, 8, 4, 8))
surface('behance_floor_games_grid', 'Piso Grade Neon', 11, 'floor', box(3, 8, 0, 5) + box(2, 3, 0, 3))
surface('behance_floor_games_checker', 'Piso Xadrez Verde', 11, 'floor', box(0, 2, 2, 8) + [(2, 3), (2, 7), (3, 6), (3, 7), (4, 6)])
surface('behance_wall_games_sky', 'Parede Céu e Morros', 11, 'left', ALL8)
surface('behance_wall_games_neon', 'Parede Neon', 11, 'right',
        [7, (2, 0, 1), (3, 0, .35), (4, 0, .35), (5, 0, .3), (0, 0, .3), (1, 0, .2)])
surface('behance_wall_italy_cantina', 'Parede Cantina', 12, 'left', [0, 1, 3, (2, 0, .2), (2, .68, 1)])
surface('behance_floor_mexico_talavera', 'Piso Talavera', 13, 'floor', [(i, j) for i in range(8) for j in range(8) if i > j and (i, j) != (2, 0)])
surface('behance_floor_mexico_terracotta', 'Piso Terracota', 13, 'floor', [(i, j) for i in range(8) for j in range(8) if i < j])
surface('behance_wall_mexico_arches', 'Parede Arcos', 13, 'right', [0, 1, 2, 3, 5, 6, 7])
surface('behance_floor_christmas', 'Piso Flocos de Neve', 14, 'floor', box(0, 6, 0, 6))
surface('behance_floor_paris_star', 'Piso Estrela Cinza', 15, 'floor', box(0, 6, 0, 6))
surface('behance_floor_paris_blue', 'Piso Medalhão Azul', 15, 'floor', box(6, 13, 0, 5))
surface('behance_floor_paris_brown', 'Piso Medalhão Marrom', 15, 'floor', box(0, 13, 6, 12))
surface('behance_floor_musketeer_star', 'Piso Rosa dos Ventos', 16, 'floor', box(0, 4, 2, 8))
surface('behance_floor_musketeer_brown', 'Piso Ladrilho Marrom', 16, 'floor', box(1, 8, 0, 2) + box(4, 8, 2, 8))
surface('behance_wall_musketeer_damask', 'Parede Damasco Verde', 16, 'left',
        [(0, 0, .55), (2, 0, .5), (4, 0, .13), (4, .72, .9), (6, 0, .18), (6, .72, .9)], period=2, vertical=(0, 1, .44))
surface('behance_wall_musketeer_stone', 'Parede Pedra e Lambri', 16, 'right',
        [(6, 0, .86), (0, 0, .4), (1, 0, .4), (2, 0, .2), (2, .62, .85), (3, 0, .2), (3, .62, .85), (4, 0, .1), (5, 0, .2), (7, 0, .85)],
        vertical=(.6, 1, .04))
surface('behance_floor_easter_grass', 'Piso Gramado', 17, 'floor', box(2, 8, 0, 3) + box(4, 8, 3, 6))
surface('behance_floor_easter_star', 'Piso Estrela Azul', 17, 'floor', box(0, 4, 3, 8) + [(1, 2)])
surface('behance_wall_easter_patchwork', 'Parede Retalhos', 17, 'left', ALL8)

class Room:
    def __init__(self, n):
        spec = ROOMS[n]
        self.n, self.spec = n, spec
        self.asset = next(a for a in catalog()['assets'] if a['project'] == PROJECT and a['order'] == n)
        image = Image.open(ARCHIVE / self.asset['file']).convert('RGBA')
        flat = Image.new('RGBA', image.size, 'white'); flat.alpha_composite(image)
        self.rgb = np.array(flat.convert('RGB')).astype(float)
        s = spec['scale']; self.step, self.wall = STEP*s, WALL*s
        self.base = (spec['top'][0], spec['top'][1] + self.wall)

    def floor_xy(self, u, v):
        bx, by = self.base
        return bx + self.step*(u - v), by + self.step/2*(u + v)

    def wall_xy(self, kind, x, h):
        """x segments from the corner, h in 0..1 from the top of the wall."""
        bx, by = self.floor_xy(x, 0) if kind == 'right' else self.floor_xy(0, x)
        return bx, by - self.wall*(1 - h)

    def sample(self, xs, ys):
        return np.stack([map_coordinates(self.rgb[:, :, c], [ys, xs], order=1, mode='nearest') for c in range(3)], axis=-1)

def catalog():
    if not hasattr(catalog, 'data'):
        catalog.data = json.loads((ARCHIVE/'catalogo.json').read_text(encoding='utf-8'))
    return catalog.data

def wall_cells(s):
    """Wall cells as (kind, segment, h0, h1, x0, x1): a bare segment is whole; a tuple keeps only the
    band of heights (0 = top, 1 = floor) and of the segment's width known to be free, optionally from
    the other wall of the same room."""
    out = []
    for c in s['cells']:
        c = (c,) if isinstance(c, int) else tuple(c)
        if not isinstance(c[0], str): c = (s['kind'],) + c
        out.append(c + (0., 1., 0., 1.)[len(c) - 2:])
    return out

def plane(room, s, res=160):
    """Rectified plane covering the surface cells, `res` pixels per tile, plus its origin in tiles."""
    if s['kind'] == 'floor':
        i0, i1 = min(c[0] for c in s['cells']), max(c[0] for c in s['cells']) + s['period']
        j0, j1 = min(c[1] for c in s['cells']), max(c[1] for c in s['cells']) + s['period']
        v, u = np.mgrid[0:(j1-j0)*res, 0:(i1-i0)*res].astype(float) / res
        xs, ys = room.floor_xy(u + i0, v + j0)
        return room.sample(xs, ys), (i0, j0)
    ks = [c[1] for c in wall_cells(s) if c[0] == s['kind']]
    k0, k1 = min(ks), max(ks) + s['period']
    h, x = np.mgrid[0:int(res*208/80), 0:(k1-k0)*res//2].astype(float)
    xs, ys = room.wall_xy(s['kind'], x/(res/2) + k0, h/(res*208/80))
    return room.sample(xs, ys), (k0, 0)

def autocorrelation(gray, axis, lag):
    a, b = (gray[:, :-lag], gray[:, lag:]) if axis == 1 else (gray[:-lag], gray[lag:])
    a, b = a - a.mean(), b - b.mean()
    return float((a*b).mean() / np.sqrt((a*a).mean()*(b*b).mean()))

def measure(room, s, res=160):
    """Size of one tile (or segment) in room tiles, from the repeat period of the whole motif."""
    rect, _ = plane(room, s, res)
    gray = rect.mean(axis=2)
    unit = res if s['kind'] == 'floor' else res // 2
    out = []
    for axis in ((1, 0) if s['kind'] == 'floor' else (1,)):
        nominal = s['period']*unit
        if gray.shape[axis] <= nominal*1.2: out.append((1., None)); continue
        lags = list(range(int(nominal*.9), int(nominal*1.1) + 1))
        scores = [autocorrelation(gray, axis, lag) for lag in lags]
        i = int(np.argmax(scores)); offset = 0
        if 0 < i < len(scores) - 1:
            l, c, r = scores[i-1:i+2]; offset = .5*(l - r)/(l - 2*c + r) if l - 2*c + r else 0
        size = (lags[i] + offset)/unit/s['period']
        # Furniture can hide the repeat; then the room scale itself (checked on its grid) is used.
        out.append((size, scores[i]) if scores[i] >= .35 and abs(size - 1) <= .04 else (1., scores[i]))
    return out

def consensus(stack, threshold=36):
    """Complete the cleanest sample (the seed) with the other samples where the seed is covered.

    Per pixel, the colour most samples agree on is the repeated art: furniture differs from cell to
    cell, so it loses even where more than half of the cells are covered by different objects. The
    seed keeps its own pixels wherever it agrees with that consensus, so lines and antialiasing come
    from one real cell; only its covered pixels are taken from samples where that spot is free.
    Samples are NaN outside the part declared free (a wall band or a shifted vertical repeat).
    """
    stack = stack.astype(np.float32)
    valid = ~np.isnan(stack[..., 0])
    if not valid.any(axis=0).all():
        raise ValueError('Há pixels sem nenhuma amostra livre; amplie as células.')
    filled = np.where(valid[..., None], stack, 1e6)
    votes = np.zeros(stack.shape[:-1], np.int16)
    for a in range(len(stack)):
        votes[a] = ((np.abs(filled - filled[a]).sum(axis=-1) < threshold) & valid).sum(axis=0)
    votes[~valid] = -1
    # Ties go to the sample nearest the median, which keeps flat colours stable.
    median = np.nanmedian(stack, axis=0)
    closeness = -np.abs(filled - median).sum(axis=-1)
    pick = (votes.astype(np.float32)*1000 + closeness/1e7).argmax(axis=0)
    mode = np.take_along_axis(filled, pick[None, ..., None], axis=0)[0]
    agree = (np.abs(filled - mode).sum(axis=-1) < threshold) & valid
    seed = int(agree.reshape(len(stack), -1).mean(axis=1).argmax())
    consensus.coverage = float(agree[seed].mean())
    return np.where(agree[seed][..., None], filled[seed], mode)

def finish(rgb, polygon, size):
    mask = Image.new('L', (size[0]*SS, size[1]*SS)); ImageDraw.Draw(mask).polygon([(x*SS, y*SS) for x, y in polygon], fill=255)
    image = Image.fromarray(np.dstack([np.uint8(np.clip(rgb, 0, 255)), np.array(mask)]), 'RGBA')
    return image.resize(size, Image.Resampling.LANCZOS)

def floor_cell(room, s, tile, phase=(0, 0)):
    """Tile (a, b) of the motif; the consensus runs over every listed motif origin (i, j)."""
    y, x = np.mgrid[0:82*SS, 0:162*SS].astype(float) + .5
    x, y = x/SS, y/SS
    # The half-pixel bleed past the diamond wraps inside the motif instead of reaching a neighbour cell.
    u = np.mod(((x - 81) + 2*(y - 1))/160, 1); v = np.mod((-(x - 81) + 2*(y - 1))/160, 1)
    if s.get('texturePhase'):
        du, dv = s['texturePhase']
        u, v = np.mod(u + du, 1), np.mod(v + dv, 1)
    (tu, tv), (a, b) = tile, phase
    stack = []
    for i, j in s['cells']:
        sample = room.sample(*room.floor_xy((i + a + u)*tu, (j + b + v)*tv))
        if s.get('reviewRegions'):
            usable = np.zeros(u.shape, dtype=bool)
            for cell, (u0, v0, u1, v1) in s['reviewRegions']:
                if cell == [i, j]:
                    usable |= (u >= u0) & (u <= u1) & (v >= v0) & (v <= v1)
            sample = np.where(usable[..., None], sample, np.nan)
        stack.append(sample)
    return finish(consensus(np.stack(stack)), [(81, 0), (162, 41), (81, 82), (0, 41)], (162, 82))

def generated_patch(image, spec):
    """Pack only approved restored regions back into the unchanged isometric registration.

    ImageGen supplies the artwork. This mapping changes neither alpha nor untouched RGB pixels;
    a full generated repaint must not silently replace a partly clean historical extraction.
    """
    size = (256, 256) if image.size == (162, 82) else (80, 208)
    master = np.array(Image.open(HERE/spec['file']).convert('RGB').resize(size,Image.Resampling.LANCZOS)).astype(float)
    pixels = np.array(image)
    y, x = np.mgrid[0:image.height, 0:image.width].astype(float) + .5
    if image.size == (162, 82):
        u = np.mod(((x - 81) + 2*(y - 1))/160, 1)
        v = np.mod((-(x - 81) + 2*(y - 1))/160, 1)
    else:
        u = np.clip(x/80, 0, 1)
        v = np.clip((y-x/2)/208, 0, 1)
    selected = np.zeros(u.shape, dtype=bool)
    for x0, y0, x1, y1 in spec['rects']:
        # The clipped wall coordinate reaches exactly 1 on its antialiased bottom edge. A patch
        # ending at 256 includes that last row; excluding it leaks the old contaminated fringe.
        selected |= ((u*256 >= x0) & ((u*256 < x1) | ((x1 == 256) & (u == 1))) &
                     (v*256 >= y0) & ((v*256 < y1) | ((y1 == 256) & (v == 1))))
    selected &= pixels[:, :, 3] > 0
    replacement = np.stack([map_coordinates(master[:,:,c], [v*master.shape[0]-.5, u*master.shape[1]-.5],
                           order=1, mode='nearest') for c in range(3)], -1)
    pixels[selected, :3] = np.uint8(np.clip(replacement[selected], 0, 255))
    return Image.fromarray(pixels, 'RGBA')

def wall_cell(room, s, tile, phase=0, vertical=None):
    """Segment `phase` of the motif. With vertical=(h0, h1, ph), the art between heights h0 and h1
    (0 = top) also repeats every ph, so a covered lower area can be completed from higher repeats."""
    y, x = np.mgrid[0:248*SS, 0:80*SS].astype(float) + .5
    x, y = x/SS, y/SS
    h = np.clip((y - x/2)/208, 0, 1)
    along = lambda k: (k + phase + np.mod(x/80, 1))*tile
    shifts = [0.]
    if vertical:
        h0, h1, ph = vertical
        # A few repeats on each side are enough to uncover a band; every sample costs O(n) in the vote.
        reach = min(int((h1 - h0)/ph) + 1, 6)
        shifts += [n*ph for n in range(-reach, reach + 1) if n]
    stack = []
    frac = np.mod(x/80, 1)
    for kind, k, b0, b1, x0, x1 in wall_cells(s):
        for shift in shifts:
            source = h - shift
            usable = (source >= b0) & (source <= b1) & (frac >= x0) & (frac <= x1)
            if shift: usable &= (h >= h0) & (h <= h1) & (source >= h0) & (source <= h1)
            if not usable.any(): continue
            sample = room.sample(*room.wall_xy(kind, along(k), np.clip(source, 0, 1)))
            stack.append(np.where(usable[..., None], sample, np.nan))
    return finish(consensus(np.stack(stack)), [(0, 0), (80, 40), (80, 248), (0, 208)], (80, 248))

def vertical_period(room, s, res=160):
    """Refine the declared vertical repeat on the rectified wall, between h0 and h1."""
    h0, h1, ph = s['vertical']
    rect, _ = plane(room, s, res)
    g = rect.mean(axis=2); H = g.shape[0]
    band = g[int(h0*H):int(h1*H)]
    lags = list(range(int(ph*H*.88), int(ph*H*1.12) + 1))
    scores = [autocorrelation(band, 0, lag) for lag in lags]
    i = int(np.argmax(scores))
    # A weak peak means the band is plain (fabric folds, planks): keep the declared step.
    return (lags[i]/H, scores[i]) if scores[i] >= .3 else (ph, scores[i])

def seam_ratio(parts, floor):
    """Colour step across the repeat seam relative to an ordinary step one pixel inside the art.

    About 1 means the motif continues across neighbouring tiles; well above 2 shows a visible seam.
    """
    if floor:
        img = np.concatenate([np.array(p.convert('RGB')).astype(float) for p in parts[:1]])
        def at(u, v):
            x, y = (u - v)*80 + 81, (u + v)*40 + 1
            return img[int(y), int(x)]
        ts = np.linspace(.08, .92, 40)
        seam = np.mean([np.abs(at(.006, t) - at(.994, t)).sum() + np.abs(at(t, .006) - at(t, .994)).sum() for t in ts])
        inner = np.mean([np.abs(at(.5, t) - at(.512, t)).sum() + np.abs(at(t, .5) - at(t, .512)).sum() for t in ts])
    else:
        first, last = np.array(parts[0].convert('RGB')).astype(float), np.array(parts[-1].convert('RGB')).astype(float)
        hs = np.linspace(.03, .97, 60)
        seam = np.mean([np.abs(first[int(208*h) + 1, 0] - last[int(208*h + 39.5), 79]).sum() for h in hs])
        inner = np.mean([np.abs(first[int(208*h + 20), 40] - first[int(208*h + 20.5), 41]).sum() for h in hs])
    return float(seam / max(inner, 1))

def review_sheet(room, s, parts, tile):
    """Source with the sampled cells outlined, and the result repeated 4x4 / along 6 segments."""
    image = Image.fromarray(np.uint8(room.rgb))
    d = ImageDraw.Draw(image); p = s['period']
    if s['kind'] == 'floor':
        tu, tv = tile
        for i, j in s['cells']:
            q = [room.floor_xy(a*tu, b*tv) for a, b in ((i, j), (i+p, j), (i+p, j+p), (i, j+p))]
            d.polygon(q, outline=(255, 0, 255), width=6)
    else:
        for kind, k, h0, h1, x0, x1 in wall_cells(s):
            q = [room.wall_xy(kind, x*tile[0], h) for x, h in ((k + x0*p, h0), (k + x1*p, h0), (k + x1*p, h1), (k + x0*p, h1))]
            d.polygon(q, outline=(255, 0, 255), width=6)
    image.thumbnail((900, 600))
    sheet = Image.new('RGB', (900 + 700, 600), (225, 230, 209))
    sheet.paste(image, (0, 0))
    if s['kind'] == 'floor':
        for tx in range(4):
            for ty in range(4):
                part = parts[(ty % p)*p + tx % p]
                sheet.paste(part, (900 + 270 + (tx - ty)*80, 20 + (tx + ty)*40), part)
    else:
        for n in range(6):
            part = parts[n % p]
            sheet.paste(part, (900 + 20 + n*80, 20 + n*40), part)
    return sheet

def extract(s):
    review_file = HERE/'repairs/reviewed.json'
    review = json.loads(review_file.read_text(encoding='utf-8')).get(s['classname']) if review_file.exists() else None
    if review:
        s['restorationReview'] = review
        if review.get('regions'):
            s['reviewRegions'] = review['regions']
            s['cells'] = list(dict.fromkeys(tuple(cell) for cell, _ in review['regions']))
        if review.get('wallCells'): s['cells'] = review['wallCells']
        if review.get('texturePhase'): s['texturePhase'] = review['texturePhase']
    room = Room(s['room'])
    # Keep the room's measured geometry while narrowing sampling to visibly clear cells/bands.
    sizes = [(t, None) for t in review['tile']] if review else measure(room, s)
    tile = tuple(t for t, _ in sizes)
    p = s['period']
    vertical = None
    if s.get('vertical'):
        ph, score = vertical_period(room, s)
        vertical = (s['vertical'][0], s['vertical'][1], ph); s['verticalPeriod'] = (round(ph, 4), round(score, 3))
    parts, coverage = [], []
    for phase in ([(a, b) for b in range(p) for a in range(p)] if s['kind'] == 'floor' else range(p)):
        part = floor_cell(room, s, tile, phase) if s['kind'] == 'floor' else wall_cell(room, s, tile[0], phase, vertical)
        if review and review.get('generatedPatch'): part = generated_patch(part, review['generatedPatch'])
        parts.append(part)
        coverage.append(round(consensus.coverage, 3))
    s['seedCoverage'] = coverage
    s['seam'] = round(seam_ratio(parts, s['kind'] == 'floor'), 2)
    return room, sizes, parts

def manifest_id(classname, kind):
    """Existing items keep their id; new ones continue each type's range in table order."""
    path = ITEMS/classname/'item.json'
    if path.exists():
        return json.loads(path.read_text(encoding='utf-8'))['id']
    base = 9150201 if kind == 'floor' else 9160201
    used = set()
    for item in ITEMS.glob('behance_*/item.json'):
        used.add(json.loads(item.read_text(encoding='utf-8'))['id'])
    return next(n for n in range(base + 12, base + 1000) if n not in used)

def write(s, room, sizes, parts):
    folder = ITEMS/s['classname']; folder.mkdir(exist_ok=True)
    floor = s['kind'] == 'floor'
    names = ['tile.png' if floor else 'wall.png'] if len(parts) == 1 else [f'phase-{n}.png' for n in range(len(parts))]
    for part, name in zip(parts, names): part.save(folder/name)
    asset, project = room.asset, next(p for p in catalog()['projects'] if p['id'] == PROJECT)
    manifest = dict(
        id=manifest_id(s['classname'], s['kind']), classname=s['classname'], name=s['name'],
        type=0 if floor else 1, kind='decor' if floor else 'wall', priceGold=10, purchasable=True,
        sizeX=1, sizeY=1, itemHeight=0 if floor else 208,
        parts=[dict(file=name, width=part.width, height=part.height, left=-81 if floor else -80, top=-1 if floor else -168,
                    **({'rotation': n} if len(parts) > 1 else {})) for n, (part, name) in enumerate(zip(parts, names))],
        source=dict(
            art=asset['file'], page=asset['page'], imageURL=asset['url'], artist=project['artist'],
            archiveSha256=asset['sha256'], room=f"{room.n:03d} ({room.spec['theme']}, identificação visual)",
            method=('Retificação de PNG de divulgação em alta resolução (tile ≈ 3,2× o do jogo) e redução; '
                    'não é PNG original recuperado nem geração.'),
            cells=[list(c) for c in (s['cells'] if floor else wall_cells(s))],
            calibration=('A semente é a célula mais limpa; os pixels cobertos por móveis ou personagens vêm de '
                         'outras células onde o mesmo ponto está livre (consenso por pixel, sem mistura). '
                         'Projeção 2:1, tile lógico inalterado.'),
            measuredTile=[round(float(t), 4) for t, _ in sizes], seedCoverage=s['seedCoverage'],
            **({'verticalRepeat': s['verticalPeriod'][0]} if s.get('verticalPeriod') else {}),
            names='Nomes descritivos do projeto, sem confirmação do nome comercial histórico.',
            provisionalRules=dict(priceGold=dict(value=10, reason='Preço provisório de projeto; a sala de divulgação não informa valores.'))))
    if len(parts) > 1:
        # Cells of a motif longer than one tile; the room picks one by world position.
        manifest['surfacePattern'] = dict(columns=s['period'], rows=s['period'] if floor else 1)
    if not floor: manifest['wallpaperRotation'] = 1
    if s.get('restorationReview'):
        review = s['restorationReview']
        manifest['source']['restoration'] = dict(
            date='2026-10-25', review='tools/surfaces-behance/repairs/reviewed.json',
            method='Células/faixas originais visualmente livres; geometria medida preservada.',
            **({'regions': review['regions']} if review.get('regions') else {}),
            **({'wallCells': review['wallCells']} if review.get('wallCells') else {}))
        if review.get('texturePhase'): manifest['source']['restoration']['texturePhase'] = review['texturePhase']
        manifest['source']['calibration'] = ('Amostras originais selecionadas por revisão visual, sem mistura de cores; '
            'as regiões cobertas foram excluídas antes do consenso. Projeção, período e registro preservados.')
        if review.get('generatedPatch'):
            manifest['source']['method'] = ('Extração da sala original, com reconstrução localizada por ImageGen; '
                'não é PNG original recuperado. Fora das regiões corrigidas, conserva os pixels da extração.')
            manifest['source']['restoration']['method'] = 'ImageGen somente nos resíduos delimitados; demais pixels e alfa preservados.'
            manifest['source']['restoration']['generatedPatch'] = review['generatedPatch']
            manifest['source']['restoration']['prompts'] = 'tools/surfaces-behance/repairs/generations.json'
            manifest['source']['calibration'] = ('Consenso original, seguido de reconstrução localizada indicada em restoration; '
                'projeção, período e alfa preservados. A afirmação de pixels originais não se aplica às regiões geradas.')
            if review['generatedPatch']['rects'] == [[0, 0, 256, 256]]:
                manifest['source']['method'] = ('Reconstrução integral por ImageGen baseada na referência original; '
                    'não é extração nem PNG original recuperado.')
                manifest['source']['restoration']['method'] = 'Arte gerada integral aprovada; projeção, registro e alfa geométrico preservados.'
                manifest['source']['calibration'] = 'Master gerado retificado para a face isométrica existente, com o mesmo alfa, registro e tamanho.'
    (folder/'item.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def main():
    args = sys.argv[1:]
    review, save = None, '--write' in args
    if save: args.remove('--write')
    if '--review' in args:
        i = args.index('--review'); review = Path(args[i+1]); del args[i:i+2]; review.mkdir(parents=True, exist_ok=True)
    chosen = [s for s in SURFACES if not args or s['classname'] in args]
    for s in chosen:
        try:
            room, sizes, parts = extract(s)
        except ValueError as error:
            print(s['classname'], 'FALHOU:', error); continue
        print(s['classname'], s['kind'], 'tile', [(round(t, 4), None if c is None else round(c, 3)) for t, c in sizes], 'seed', s['seedCoverage'], 'seam', s['seam'], s.get('verticalPeriod', ''))
        if review: review_sheet(room, s, parts, tuple(t for t, _ in sizes)).save(review/f"{s['classname']}.png")
        if save: write(s, room, sizes, parts)

if __name__ == '__main__':
    main()

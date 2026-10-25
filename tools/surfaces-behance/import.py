"""Extract the portfolio floor and wall samples as one-tile repeat cells.

Only the samples absent from the showcase rooms are written here (see rooms.py).
Each sample on sheets 008/009 shows a 2x2-tile room whose pattern repeats every tile. The plane is
rectified, its period is measured, and exactly one period is resampled into the 160x80 tile (floor)
or the 80 px segment (wall). Sampling stays inside the clean interior: the back edges carry the wall
baseboard and the front edges the sheet's drop shadow, so neither enters the cell.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json
import numpy as np
from scipy.ndimage import map_coordinates

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
ARCHIVE = ROOT / 'artes-referencia/cafe-mania-behance-alta-qualidade-documentado/cafe-mania-behance'
ITEMS = ROOT / 'game/public/assets/items'
SCALE = 4  # Rectified plane pixels per room pixel; keeps the measured period sub-pixel accurate.
# Back, right, front, left floor vertices. Wall vertices are top-inner, top-outer, bottom-outer, bottom-inner.
SPECS = [
 ('egypt','Egípcio','Egípcia',8,[(154,185),(263,241),(154,295),(45,241)],[(154,43),(263,99),(263,241),(154,185)]),
 ('classic','Clássico','Clássica',8,[(408,180),(518,234),(408,289),(299,234)],[(408,36),(518,91),(518,234),(408,180)]),
 ('cards','Cartas','Cartas',8,[(666,174),(776,230),(666,288),(556,230)],[(666,40),(776,95),(776,230),(666,174)]),
 ('oriental','Oriental','Oriental',8,[(156,477),(266,531),(156,586),(49,531)],[(156,335),(266,390),(266,531),(156,477)]),
 ('balloons','Balões','Balões',8,[(420,476),(526,530),(420,583),(314,530)],[(420,340),(526,393),(526,530),(420,476)]),
 ('confetti','Confetes','Confetes',8,[(659,476),(766,530),(659,583),(554,530)],[(659,340),(766,393),(766,530),(659,476)]),
 ('june_festival','Festa Junina','Festa Junina',9,[(155,181),(262,235),(155,289),(48,235)],[(155,43),(262,97),(262,235),(155,181)]),
 ('circus','Estrelas de Circo','Listras de Circo',9,[(410,180),(518,235),(410,289),(303,235)],[(410,42),(518,96),(518,235),(410,180)]),
 ('circus_deluxe','Madeira de Circo','Circo Decorado',9,[(667,179),(776,234),(667,289),(558,234)],[(667,39),(776,94),(776,234),(667,179)]),
 ('night','Verde Noturno','Céu Noturno',9,[(155,475),(263,530),(155,583),(48,530)],[(155,337),(263,390),(263,530),(155,475)]),
 ('blue_tiles','Azulejos Azuis','Azulejos Azuis',9,[(420,477),(525,530),(420,583),(315,530)],[(420,340),(525,391),(525,530),(420,477)]),
 ('parquet','Parquet','Geométrica',9,[(657,477),(762,530),(657,583),(552,530)],[(657,340),(762,393),(762,530),(657,477)]),
]

def flatten(image, corners, size):
    # PIL QUAD order: upper-left, lower-left, lower-right, upper-right.
    quad = [corners[i] for i in [0,3,2,1]]
    return np.array(image.transform(size, Image.Transform.QUAD, tuple(n for p in quad for n in p), Image.Resampling.BICUBIC)).astype(float)

def period(plane, axis, nominal, rows, cols):
    """Autocorrelation peak near the nominal one-tile period, refined to a fraction of a pixel."""
    gray = plane.mean(axis=2)[rows, cols]
    gray = gray - gray.mean()
    n = gray.shape[axis]
    def score(lag):
        a, b = (gray[:, :n-lag], gray[:, lag:]) if axis == 1 else (gray[:n-lag], gray[lag:])
        return (a*b).mean() / np.sqrt((a*a).mean() * (b*b).mean())
    lags = range(int(nominal*.85), int(nominal*1.15)+1)
    scores = [score(lag) for lag in lags]
    i = int(np.argmax(scores))
    if 0 < i < len(scores)-1:
        l, c, r = scores[i-1:i+2]
        offset = .5*(l-r)/(l-2*c+r) if l-2*c+r else 0
    else:
        offset = 0
    return lags[i] + offset, scores[i]

def source_position(fraction, size):
    # The second tile is clean except near the front edge; that last tenth comes from the first tile.
    return np.where(fraction < .9, size*(1+fraction), size*fraction)

def sample(plane, sy, sx):
    return np.stack([map_coordinates(plane[:,:,c], [sy, sx], order=3, mode='nearest') for c in range(3)], axis=2)

def floor_tile(plane, pu, pv):
    y, x = np.mgrid[0:82,0:162].astype(float) + .5
    u = x-81+2*(y-1); v = -(x-81)+2*(y-1)  # Room pixels along each tile edge, 0..160 inside the diamond.
    rgb = sample(plane, source_position((v % 160)/160, pv), source_position((u % 160)/160, pu))
    # Supersampled coverage is independent of the artwork; the half-pixel bleed covers shared edges.
    mask = Image.new('L',(162*4,82*4)); ImageDraw.Draw(mask).polygon([(81*4,0),(162*4,41*4),(81*4,82*4),(0,41*4)],fill=255)
    alpha = np.array(mask.resize((162,82),Image.Resampling.LANCZOS))
    return Image.fromarray(np.dstack([np.uint8(np.clip(rgb,0,255)),alpha]),'RGBA')

def wall_segment(plane, p):
    y, x = np.mgrid[0:248,0:80].astype(float) + .5
    sy = np.clip((y-.5*x)*SCALE, 0, plane.shape[0]-1)
    rgb = sample(plane, sy, source_position(x/80, p))
    mask = Image.new('L',(320,992)); ImageDraw.Draw(mask).polygon([(0,0),(320,160),(320,992),(0,832)],fill=255)
    alpha = np.array(mask.resize((80,248),Image.Resampling.LANCZOS))
    return Image.fromarray(np.dstack([np.uint8(np.clip(rgb,0,255)),alpha]),'RGBA')

def main():
    # Items also visible in the high-resolution showcase rooms are written by rooms.py instead.
    from rooms import SURFACES
    replaced = {s['classname'] for s in SURFACES}
    catalog = json.loads((ARCHIVE/'catalogo.json').read_text(encoding='utf-8'))
    project = next(p for p in catalog['projects'] if p['id']=='43063757')
    records = []; (HERE/'planes').mkdir(parents=True, exist_ok=True)
    tile = 160*SCALE
    clean = slice(int(tile*.15), int(tile*1.85))
    for index,(key,floor_name,wall_name,sheet,floor_points,wall_points) in enumerate(SPECS):
        source = next(a for a in catalog['assets'] if a['project']=='43063757' and a['order']==sheet)
        image = Image.open(ARCHIVE/source['file']).convert('RGB')
        floor = flatten(image, floor_points, (2*tile, 2*tile))
        wall = flatten(image, wall_points, (2*80*SCALE, 208*SCALE))
        pu, su = period(floor, 1, tile, clean, clean); pv, sv = period(floor, 0, tile, clean, clean)
        pw, sw = period(wall, 1, 80*SCALE, slice(int(208*SCALE*.1), int(208*SCALE*.9)), slice(None))
        Image.fromarray(np.uint8(floor)).resize((320,320), Image.Resampling.LANCZOS).save(HERE/f'planes/{key}-floor.png')
        Image.fromarray(np.uint8(wall)).resize((160,208), Image.Resampling.LANCZOS).save(HERE/f'planes/{key}-wall.png')
        for kind,name,cell,periods in [('floor',floor_name,floor_tile(floor,pu,pv),dict(u=pu/SCALE,v=pv/SCALE,correlation=[su,sv])),
                                       ('wall',wall_name,wall_segment(wall,pw),dict(x=pw/SCALE,correlation=[sw]))]:
            classname = f'behance_{kind}_{key}'; folder = ITEMS/classname
            if classname in replaced: continue
            folder.mkdir(exist_ok=True)
            for old in folder.glob('phase-*.png'): old.unlink()
            file = 'tile.png' if kind=='floor' else 'wall.png'; cell.save(folder/file)
            part = dict(file=file,width=cell.width,height=cell.height,left=-81 if kind=='floor' else -80,top=-1 if kind=='floor' else -168)
            manifest = dict(id=(9150201 if kind=='floor' else 9160201)+index, classname=classname,
                name=('Piso ' if kind=='floor' else 'Parede ')+name, type=0 if kind=='floor' else 1,
                kind='decor' if kind=='floor' else 'wall', priceGold=10, purchasable=True, sizeX=1, sizeY=1,
                itemHeight=0 if kind=='floor' else 208, parts=[part],
                source=dict(art=source['file'], page=source['page'], imageURL=source['url'], artist=project['artist'],
                    archiveSha256=source['sha256'],
                    method='Recorte e retificação de imagem JPEG do portfólio; não é PNG original recuperado nem geração.',
                    sourceCorners=floor_points if kind=='floor' else wall_points,
                    calibration=('A amostra mostra um quarto de 2×2 tiles com padrão repetido a cada tile. O período medido no plano '
                        'retificado (em px do quarto, nominal 160 no piso e 80 na parede) é reamostrado num único tile, com janela '
                        'interna sem rodapé nem sombra. Projeção 2:1, tile lógico inalterado.'),
                    measuredPeriod={k:round(float(v),2) if not isinstance(v,list) else [round(float(n),3) for n in v] for k,v in periods.items()},
                    names='Nomes descritivos do projeto, sem confirmação do nome comercial histórico.',
                    provisionalRules=dict(priceGold=dict(value=10,reason='Preço provisório de projeto; a prancha não informa valores.'))))
            if kind=='wall': manifest['wallpaperRotation'] = 1
            (folder/'item.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            records.append(dict(classname=classname,name=manifest['name'],sheet=source['file'],part=part,measuredPeriod=manifest['source']['measuredPeriod']))
    (HERE/'exports.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'{len(records)} revestimentos extraídos das pranchas 008/009; os demais vêm de rooms.py.')

if __name__=='__main__': main()

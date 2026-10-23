"""Split the Image Gen modular sheet, retaining each piece's alpha edges."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
source = Image.open(ROOT / 'tools/thought-bubble/source.png').convert('RGBA')
output = ROOT / 'game/public/assets/ui/thought-bubble'
regions = {
    'oval': (0, 0, source.width, 715),
    'dot-large': (300, 715, 800, source.height),
    'dot-small': (800, 715, 1200, source.height),
}
for name, region in regions.items():
    part = source.crop(region)
    bounds = part.getchannel('A').point(lambda alpha: 255 if alpha >= 64 else 0).getbbox()
    if not bounds:
        raise ValueError(f'Missing part: {name}')
    part = part.crop((max(0, bounds[0]-2), max(0, bounds[1]-2), min(part.width, bounds[2]+2), min(part.height, bounds[3]+2)))
    part.thumbnail((512, 384) if name == 'oval' else (96, 96), Image.Resampling.LANCZOS)
    part.save(output / f'{name}.png')
    print(name, part.size)

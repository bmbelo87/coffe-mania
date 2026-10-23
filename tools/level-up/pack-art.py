"""Crop Image Gen exports without changing their drawing or alpha edges (requires Pillow)."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'tools/level-up'
OUTPUT = ROOT / 'game/public/assets/ui'


def tight(image):
    # Faint near-transparent generation noise must not shrink the visible icon.
    bounds = image.getchannel('A').point(lambda alpha: 255 if alpha >= 32 else 0).getbbox()
    if not bounds:
        raise ValueError('Empty generated icon')
    return image.crop((max(0, bounds[0]-2), max(0, bounds[1]-2),
                       min(image.width, bounds[2]+2), min(image.height, bounds[3]+2)))


padlock = tight(Image.open(SOURCE / 'padlock-source.png').convert('RGBA'))
padlock.thumbnail((256, 256), Image.Resampling.LANCZOS)
padlock.save(OUTPUT / 'padlock.png')
sheet = Image.open(SOURCE / 'reward-icons-source.png').convert('RGBA')
split = round(sheet.width * .535)
for name, box in [('waiter', (0, 0, split, sheet.height)), ('dish', (split, 0, sheet.width, sheet.height))]:
    icon = tight(sheet.crop(box))
    icon.thumbnail((256, 256), Image.Resampling.LANCZOS)
    icon.save(OUTPUT / f'level-up/{name}.png')

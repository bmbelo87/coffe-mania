"""Pack the generated raster panel without painting or changing its colors."""
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
folder = Path(__file__).resolve().parent
master = folder / 'card-locked-imagegen.png'
destination = ROOT / 'game/public/assets/ui/recipe-book/card-locked.png'
with Image.open(master) as image:
    bounds = image.getchannel('A').point(lambda a: 255 if a > 32 else 0).getbbox()
    packed = image.crop(bounds).resize((792,398), Image.Resampling.LANCZOS)
    packed.save(destination, optimize=True)
(folder / 'source.json').write_text(json.dumps({
    'reference':'artes-referencia/video-cafe-mania-muito-tempo/receitas-0029-0046/selecionados/avancado-06-card-05.png',
    'referenceRecipe':'Ovos Benedict', 'generationTool':'built-in image_gen', 'prompt':'prompt.txt',
    'master':'card-locked-imagegen.png', 'crop':bounds, 'output':destination.relative_to(ROOT).as_posix(),
    'size':[792,398], 'sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),
    'processing':'Alpha-bounds crop and Lanczos resize only; generated master preserved.',
    'reusedPadlock':'game/public/assets/ui/padlock.png',
    'limitation':'The source has a paid early-unlock button; this visual change implements level locking only. Prices and purchases remain unimplemented.'
},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

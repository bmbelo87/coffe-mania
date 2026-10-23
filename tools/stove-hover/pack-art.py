"""Recorta a moldura e o livro gerados, preservando as bordas transparentes."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
source = Image.open(root / 'tools/stove-hover/source.png').convert('RGBA')
output = root / 'game/public/assets/ui/stove-hover'
for name, region, size in [
    ('panel', (0, 0, source.width, source.height // 2), (768, 384)),
    ('book', (0, source.height // 2, source.width, source.height), (256, 320)),
]:
    part = source.crop(region)
    bounds = part.getchannel('A').point(lambda a: 255 if a >= 64 else 0).getbbox()
    if not bounds:
        raise ValueError(f'Asset ausente: {name}')
    part = part.crop((max(0, bounds[0]-2), max(0, bounds[1]-2), min(part.width, bounds[2]+2), min(part.height, bounds[3]+2)))
    part.thumbnail(size, Image.Resampling.LANCZOS)
    part.save(output / f'{name}.png')
    print(name, part.size)

# A edição do livro é independente da folha original e conserva a resolução de consumo.
clean_book = root / 'tools/stove-hover/book-clean-source.png'
if clean_book.exists():
    book = Image.open(clean_book).convert('RGBA')
    book.resize((256, 317), Image.Resampling.LANCZOS).save(output / 'book.png')

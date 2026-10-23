"""Optimize existing reference illustrations; never change the archived originals."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / 'artes-referencia/cafe-mania-behance-alta-qualidade-documentado/cafe-mania-behance'
OUT = ROOT / 'game/public/assets/ui/cafe-welcome'
SELECTION = [
    ('007', 'cafe-cozinha', 'Os chefs reunidos na cozinha do Café Mania.'),
    ('009', 'cafe-encontro', 'Um encontro de personagens na frente do café.'),
    ('008', 'natal', 'Papai Noel e os presentes de Natal do Café Mania.'),
    ('010', 'pascoa', 'Os personagens e o coelho de Páscoa do Café Mania.'),
    ('013', 'festa-junina', 'Os personagens do Café Mania na festa junina.'),
    ('005', 'praia', 'Os personagens no café da praia.'),
]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--generated-frame', type=Path)
    parser.add_argument('--generated-button', type=Path)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    project = next(p for p in json.loads((ARCHIVE / 'catalogo.json').read_text(encoding='utf-8'))['projects'] if p['id'] == '13020873')
    entries = []
    for number, identifier, alt in SELECTION:
        source = ARCHIVE / 'artes/13020873' / f'{number}.jpg'
        art = Image.open(source).convert('RGB')
        art.thumbnail((1920, 1920), Image.Resampling.LANCZOS)
        art.save(OUT / f'{identifier}.webp', quality=88, method=6)
        entries.append(dict(id=identifier, file=f'{identifier}.webp', alt=alt,
                            source=str(source.relative_to(ROOT)).replace('\\', '/'),
                            sourceSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),
                            width=art.width, height=art.height))
    # Runtime configuration is kept separate so repacking cannot reset a scheduled season.
    (OUT / 'sources.json').write_text(json.dumps(dict(project=project, wallpapers=entries, classicRestoration='classic-source.json',
        frame=dict(file='name-frame.png', method='Built-in Image Gen; alpha crop and downscale only',
                   prompt='tools/cafe-name/frame-prompt.txt', master='tools/cafe-name/name-frame-source.png'),
        button=dict(file='ok-button.png', method='Built-in Image Gen reconstruction from the user crop; live text rendered separately',
                    prompt='tools/cafe-name/ok-button-prompt.txt', master='tools/cafe-name/ok-button-source.png')),
        ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if args.generated_frame:
        art = Image.open(args.generated_frame).convert('RGBA')
        mask = art.getchannel('A').point(lambda p: 255 if p >= 96 else 0)
        # Ignore isolated near-transparent speckles when measuring the sprite's support.
        cols = [x for x in range(art.width) if mask.crop((x, 0, x + 1, art.height)).histogram()[255] > 12]
        rows = [y for y in range(art.height) if mask.crop((0, y, art.width, y + 1)).histogram()[255] > 12]
        art = art.crop((max(0, min(cols)-2), max(0, min(rows)-2), min(art.width, max(cols)+3), min(art.height, max(rows)+3)))
        art.thumbnail((1200, 400), Image.Resampling.LANCZOS)
        art.save(OUT / 'name-frame.png', optimize=True)
    if args.generated_button:
        art = Image.open(args.generated_button).convert('RGBA')
        mask = art.getchannel('A').point(lambda p: 255 if p >= 96 else 0)
        cols = [x for x in range(art.width) if mask.crop((x, 0, x + 1, art.height)).histogram()[255] > 12]
        rows = [y for y in range(art.height) if mask.crop((0, y, art.width, y + 1)).histogram()[255] > 12]
        art = art.crop((max(0, min(cols)-2), max(0, min(rows)-2), min(art.width, max(cols)+3), min(art.height, max(rows)+3)))
        art = art.resize((612, 316), Image.Resampling.LANCZOS)
        art.save(OUT / 'ok-button.png', optimize=True)
    print(f'Packed {len(entries)} archived illustrations into {OUT}')

if __name__ == '__main__':
    main()

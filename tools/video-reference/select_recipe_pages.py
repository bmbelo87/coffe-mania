"""Find loaded recipe cards among every decoded frame; preserve their source pixels."""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'artes-referencia/video-cafe-mania-muito-tempo/receitas-0029-0046'
ALL = ROOT / '.runtime/recipe-video/todos'
PAGES = [('basico-01', 8), ('basico-02', 13), ('avancado-01', 18),
         ('avancado-02', 22), ('avancado-03', 27), ('avancado-04', 31),
         ('avancado-05', 34), ('avancado-06', 39)]
CARDS = [(240 + c * 268, 200 + r * 144, 488 + c * 268, 325 + r * 144)
         for r in range(3) for c in range(2)]


def titles(rgb):
    return np.concatenate([rgb[y:y + 30, x:x + 240].reshape(-1)
                           for x, y, _, _ in CARDS]).astype(float)


def artwork_score(rgb, card):
    x, y, _, _ = card
    # The picture region excludes names, clocks, XP, buttons and the plus control.
    area = rgb[y + 36:y + 91, x + 4:x + 115].astype(float)
    background = np.median(area.reshape(-1, 3), axis=0)
    foreground = (np.abs(area - background).max(axis=2) > 40).sum()
    # Loaded plates cover more area than a sharp mouse pointer on an empty card.
    return float(foreground + np.abs(np.diff(area, axis=0)).mean())


def main():
    references = []
    for name, frame in PAGES:
        with Image.open(DEST / f'quadros/quadro-{frame:03d}.png') as image:
            references.append(titles(np.asarray(image.convert('RGB'))))
    groups = {name: [] for name, _ in PAGES}
    manifest = json.loads((ALL / 'quadros.json').read_text(encoding='utf-8'))
    for record in manifest['frames']:
        with Image.open(ALL / record['file']) as image:
            rgb = np.asarray(image.convert('RGB'))
        header = titles(rgb)
        errors = [np.abs(header - reference).mean() for reference in references]
        best = int(np.argmin(errors))
        if errors[best] > 8:
            continue
        groups[PAGES[best][0]].append((record, [artwork_score(rgb, card) for card in CARDS]))
    selected = DEST / 'selecionados'
    selected.mkdir(exist_ok=True)
    records = []
    for name, _ in PAGES:
        candidates = groups[name]
        if not candidates:
            raise RuntimeError(f'No stable frames found for {name}')
        full, _ = max(candidates, key=lambda item: sum(item[1]))
        with Image.open(ALL / full['file']) as image:
            image.save(selected / f'{name}.png')
        page = {'page': name, 'file': f'selecionados/{name}.png',
                'timestampSeconds': full['timestampSeconds'], 'timecode': full['timecode'],
                'stableCandidates': len(candidates), 'cards': []}
        for slot, box in enumerate(CARDS):
            source, _ = max(candidates, key=lambda item: item[1][slot])
            file = f'selecionados/{name}-card-{slot + 1:02d}.png'
            with Image.open(ALL / source['file']) as image:
                image.crop(box).save(DEST / file)
            page['cards'].append({'slot': slot + 1, 'file': file, 'cropBox': box,
                                  'timestampSeconds': source['timestampSeconds'],
                                  'timecode': source['timecode']})
        records.append(page)
    result = {'method': 'Title matching and picture-region foreground-area scoring over every native video frame, followed by visual review. Each PNG is one source frame or a rectangular crop; no compositing.',
              'decodedFramesReviewedBySelection': len(manifest['frames']), 'pages': records}
    (DEST / 'paginas.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps([{k: p[k] for k in ('page', 'timecode', 'stableCandidates')} for p in records], indent=2))


if __name__ == '__main__':
    main()

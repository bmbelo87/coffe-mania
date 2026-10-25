"""Crop ImageGen masters by visible alpha; split the four ordered drink atlases."""
from pathlib import Path
import json

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
MASTER = Path(__file__).resolve().parent / 'generated'
MACHINES = ROOT / 'game/public/assets/items/coffee_machine/stages'
DRINKS = ROOT / 'game/public/assets/coffees'
GROUPS = {
    'basic': ['espresso', 'descafeinado', 'cafe_com_leite', 'cafe_com_creme'],
    'medium': ['cortado', 'cafe_com_canela', 'cappuccino', 'macchiato'],
    'advanced': ['mocaccino', 'cafe_irlandes', 'macchiato_caramelo', 'submarino'],
    'expert': ['frappe', 'chai_com_especiarias', 'iced_coffee_com_menta', 'capuccino_com_laranja'],
}


def visible_crop(image):
    # ImageGen can leave alpha=1 noise outside the artwork. It must not determine registration.
    alpha = np.asarray(image.getchannel('A'))
    box = Image.fromarray((alpha >= 8).astype('uint8') * 255).getbbox()
    if not box or not (alpha == 0).any():
        raise ValueError('Expected artwork with a genuine transparent backdrop.')
    left, top, right, bottom = box
    crop = (max(0, left - 3), max(0, top - 3), min(image.width, right + 3), min(image.height, bottom + 3))
    return image.crop(crop), crop


def resize(image, dimensions):
    return image.convert('RGBa').resize(dimensions, Image.Resampling.LANCZOS).convert('RGBA')


def main():
    MACHINES.mkdir(parents=True, exist_ok=True); DRINKS.mkdir(parents=True, exist_ok=True)
    report = {'machines': [], 'drinks': []}
    for stage in range(1, 4):
        source = Image.open(MASTER / f'stage-{stage}-master.png').convert('RGBA')
        cut, box = visible_crop(source)
        width = 496; height = round(cut.height * width / cut.width)
        output = Image.new('RGBA', (512, height + 16))
        output.paste(resize(cut, (width, height)), (8, 8))
        output.save(MACHINES / f'stage-{stage}.png', optimize=True)
        report['machines'].append({'stage': stage, 'crop': box, 'size': output.size, 'padding': 8})
    qa = Image.new('RGB', (4 * 280, 4 * 300), '#ed42a6'); draw = ImageDraw.Draw(qa)
    for group_index, (group, ids) in enumerate(GROUPS.items()):
        source = Image.open(MASTER / f'{group}-atlas.png').convert('RGBA')
        for index, name in enumerate(ids):
            col = index % 2; row = index // 2
            cell_box = (col * source.width // 2, row * source.height // 2,
                        (col + 1) * source.width // 2, (row + 1) * source.height // 2)
            cell = source.crop(cell_box); cut, box = visible_crop(cell)
            scale = 240 / max(cut.size)
            dimensions = (round(cut.width * scale), round(cut.height * scale))
            cut = resize(cut, dimensions)
            output = Image.new('RGBA', (cut.width + 16, cut.height + 16))
            output.paste(cut, (8, 8)); output.save(DRINKS / f'{name}.png', optimize=True)
            report['drinks'].append({'id': name, 'group': group, 'atlasCell': cell_box, 'crop': box, 'size': output.size})
            x = index * 280; y = group_index * 300
            qa.paste(output, (x + (280 - output.width) // 2, y + 30), output)
            draw.text((x + 8, y + 6), name, fill='white')
    qa.save(MASTER / 'drinks-qa.png')
    (MASTER / 'export-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()

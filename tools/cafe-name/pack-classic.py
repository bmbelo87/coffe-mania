"""Pack an Image Gen restoration while retaining source pixels outside the approved edits."""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OUT = ROOT / 'game/public/assets/ui/cafe-welcome'
CROP = (178, 5, 1329, 830)
PATCHES = [
    ('caption', (449, 635, 1054, 681), 5),
    ('name-field', (510, 682, 993, 807), 22),
    ('confirm-button', (995, 699, 1160, 789), 12),
    ('capture-mark-top', (1257, 10, 1497, 36), 3),
    ('capture-mark-bottom', (0, 804, 227, 829), 3),
]

def main():
    source = Image.open(HERE / 'classic-reference.png').convert('RGB')
    generated = Image.open(HERE / 'classic-restoration-source.png').convert('RGB').resize(source.size, Image.Resampling.LANCZOS)
    mask = Image.new('L', source.size)
    draw = ImageDraw.Draw(mask)
    for _, bounds, radius in PATCHES:
        draw.rounded_rectangle(bounds, radius=radius, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    restored = Image.composite(generated, source, mask)
    original_pixels = np.asarray(source)
    result_pixels = np.asarray(restored)
    preserved = np.asarray(mask) == 0
    assert np.array_equal(original_pixels[preserved], result_pixels[preserved]), 'Unmasked source pixels changed'
    native = restored.crop(CROP)
    # Lossless master permits exact verification before the uniform high-resolution export.
    native.save(OUT / 'cafe-classico-native.png', optimize=True)
    highres = native.resize((native.width * 3, native.height * 3), Image.Resampling.LANCZOS)
    highres.save(OUT / 'cafe-classico.png', optimize=True)
    metadata = dict(
        source='tools/cafe-name/classic-reference.png',
        sourceSHA256=hashlib.sha256((HERE / 'classic-reference.png').read_bytes()).hexdigest(),
        restoredSource='tools/cafe-name/classic-restoration-source.png',
        prompt='tools/cafe-name/classic-background-prompt.txt',
        method='Built-in Image Gen reconstruction restricted to UI/capture marks; original pixels retained elsewhere',
        patches=[dict(id=name, bounds=bounds, radius=radius) for name,bounds,radius in PATCHES],
        crop=CROP, nativeSize=native.size, outputSize=highres.size,
        upscale='3x uniform Lanczos, no invented detail',
        preservedPixelsUnchanged=True,
        controls=dict(field=dict(left=338,top=681,width=469,height=113),button=dict(left=822,top=699,width=153,height=79)),
    )
    (OUT / 'classic-source.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(dict(native=native.size,output=highres.size,preservedPixelsUnchanged=True)))

if __name__ == '__main__': main()

"""Rebuild the registered grandma animation from its source video, without changing item geometry."""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

from matting import border_color, neutral_vapor, opaque_cutout

ROOT = Path(__file__).resolve().parents[2]


def plate_envelope(rgb: np.ndarray, background: np.ndarray, right: int) -> np.ndarray:
    """The first bright food/plate pixel in each column separates steam from solid artwork.

    A narrow horizontal expansion and four source pixels of allowance preserve dark food
    outlines. The boundary follows the plate instead of cutting the steam with a rectangle.
    Values are calibrated in the 768 x 1344 source, never in room/tile coordinates.
    """
    strong = np.max(np.abs(rgb.astype(np.float32) - background), axis=2) > 95
    strong[:250] = False
    ceiling = np.argmax(strong, axis=0).astype(np.float32)
    ceiling[~strong.any(axis=0)] = 480
    ceiling = ndi.minimum_filter1d(ceiling, size=7) - 4
    yy, xx = np.indices(rgb.shape[:2])
    return (xx < right) & (yy < ceiling[None, :])


def premultiplied(image: Image.Image) -> np.ndarray:
    pixels = np.asarray(image, dtype=np.float32) / 255
    pixels[..., :3] *= pixels[..., 3:4]
    return pixels


def resize(frame: np.ndarray, size: tuple[int, int]) -> Image.Image:
    # Quantizing premultiplied RGB to 8 bits before resizing corrupts faint wisps: one RGB
    # step at alpha .03 becomes 33 steps after unpremultiplication. Filter in float instead.
    filtered = np.stack([np.asarray(Image.fromarray(frame[..., channel]).resize(size, Image.Resampling.LANCZOS))
                         for channel in range(4)], axis=2)
    alpha = np.clip(filtered[..., 3:4], 0, 1)
    colors = np.divide(filtered[..., :3], alpha, out=np.zeros_like(filtered[..., :3]), where=alpha > 1e-6)
    pixels = np.round(np.clip(np.concatenate([colors, alpha], axis=2), 0, 1) * 255).astype(np.uint8)
    pixels[pixels[..., 3] == 0] = 0
    return Image.fromarray(pixels)


def rebuild(paths: list[Path], config: dict, manifest: dict, output: Path, qa: Path | None) -> None:
    animation = config['animation']
    if {key: manifest['animation'][key] for key in animation} != animation:
        raise ValueError('The item registration changed; review grandma.json before rebuilding.')
    if len(paths) < config['loopEnd']:
        raise ValueError('Incomplete source frames.')
    left, top, right, bottom = config['crop']
    cache = {}

    def layers(index: int):
        if index in cache:
            return cache[index]
        image = Image.open(paths[index]).convert('RGB')
        if list(image.size) != config['sourceSize']:
            raise ValueError('Unexpected source dimensions.')
        rgb = np.array(image)
        background = border_color(rgb)
        steam_domain = plate_envelope(rgb, background, config['steamRight'])
        # The source watermark is above the registered crop and cannot join the subject.
        excluded = steam_domain.copy(); excluded[:100] = True
        body = opaque_cutout(rgb, background, excluded, config['opaqueThreshold'], config['edgeSigma'],
                             tuple(config['chromaThresholds']), config['edgeInset'], config['coverageWidth'])
        yy = np.indices(rgb.shape[:2])[0]
        fade = np.clip((yy - top) / config['steamTopFade'], 0, 1)
        steam = neutral_vapor(rgb, background, steam_domain * fade, tuple(config['steamColor']),
                              config['steamNoiseFloor'], config['steamStrength'], config['steamSigma'])
        crop = (left, top, right, bottom)
        result = (premultiplied(Image.fromarray(body).crop(crop)),
                  premultiplied(Image.fromarray(steam).crop(crop)))
        # Keep only the lead-in frames needed by the closing dissolve, not the entire video.
        if index < config['loopStart']:
            cache[index] = result
        return result

    frames = []
    for index in range(config['loopStart'], config['loopEnd'], config['sourceStep']):
        body, steam = layers(index)
        for layer, duration in ((body, config['bodyCrossfade']), (steam, config['steamCrossfade'])):
            lead = index - (config['loopEnd'] - duration)
            if lead >= 0:
                other = config['loopStart'] - duration + lead
                previous = layers(other)[0 if layer is body else 1]
                weight = (lead + 1) / (duration + 1)
                layer[:] = layer * (1 - weight) + previous * weight
        # Body is in front of the vapor. Both are premultiplied before filtering/dissolving.
        combined = body + steam * (1 - body[..., 3:4])
        frames.append(resize(combined, (animation['frameWidth'] * animation['resolution'],
                                        animation['frameHeight'] * animation['resolution'])))
    if len(frames) != animation['frames']:
        raise ValueError('Unexpected loop length.')
    cell_w = (animation['frameWidth'] + 2 * animation['gutter']) * animation['resolution']
    cell_h = (animation['frameHeight'] + 2 * animation['gutter']) * animation['resolution']
    rows = (len(frames) + animation['columns'] - 1) // animation['columns']
    sheet = Image.new('RGBA', (animation['columns'] * cell_w, rows * cell_h))
    for index, frame in enumerate(frames):
        sheet.paste(frame, ((index % animation['columns']) * cell_w + animation['gutter'] * animation['resolution'],
                            (index // animation['columns']) * cell_h + animation['gutter'] * animation['resolution']))
    output.mkdir(parents=True, exist_ok=True)
    # Lossless color as well as alpha prevents dark RGB from leaking into faint steam.
    sheet.save(output / 'animation.webp', lossless=True, method=6, exact=True)
    resize(premultiplied(frames[0]), (animation['frameWidth'], animation['frameHeight'])).save(output / 'frame-000.png')
    if qa:
        qa.mkdir(parents=True, exist_ok=True)
        for background, color in (('rosa', '#e93c9b'), ('roxo', '#8b189d')):
            for page in range(3):
                contact = Image.new('RGB', (8 * 206, 3 * 244), color)
                draw = ImageDraw.Draw(contact)
                for k in range(24):
                    index = page * 24 + k
                    x, y = (k % 8) * 206, (k // 8) * 244
                    frame = frames[index].convert('RGBa').resize((189, 207), Image.Resampling.LANCZOS).convert('RGBA')
                    contact.paste(frame, (x + 8, y + 25), frame)
                    draw.text((x + 8, y + 7), f'{index:02d}', fill='white')
                contact.save(qa / f'{background}-{page + 1}.png')
        # Preserve a true-alpha animated preview; lossless frames are the same as the atlas.
        frames[0].save(qa / 'animacao.webp', save_all=True, append_images=frames[1:], duration=1000 / animation['fps'],
                       loop=0, lossless=True, method=4)
    print(f'{len(frames)} frames; atlas {sheet.width}x{sheet.height}; {output}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--frames-dir', type=Path, help='Previously decoded source frames f0001.png..f0240.png')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--qa-dir', type=Path)
    args = parser.parse_args()
    config = json.loads(Path(__file__).with_name('grandma.json').read_text(encoding='utf-8'))
    item = ROOT / config['item']
    manifest = json.loads((item / 'item.json').read_text(encoding='utf-8'))
    if args.frames_dir:
        rebuild(sorted(args.frames_dir.glob('f*.png')), config, manifest, args.output or item, args.qa_dir)
    else:
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            subprocess.run(['ffmpeg', '-v', 'error', '-i', str(ROOT / config['video']), str(folder / 'f%04d.png')], check=True)
            rebuild(sorted(folder.glob('f*.png')), config, manifest, args.output or item, args.qa_dir)


if __name__ == '__main__':
    main()

"""Extract unchanged reference frames with original video timestamps and contact sheets."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('video', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--start', type=float, default=29)
    parser.add_argument('--end', type=float, default=46)
    parser.add_argument('--interval', type=float, default=0.25)
    args = parser.parse_args()
    if not (0 <= args.start < args.end and args.interval > 0):
        parser.error('Require 0 <= start < end and interval > 0')
    args.output.mkdir(parents=True, exist_ok=True)
    frames = args.output / 'quadros'
    frames.mkdir(exist_ok=True)
    probe = json.loads(subprocess.run([
        'ffprobe', '-v', 'error', '-show_entries',
        'format=duration:stream=index,codec_type,width,height,r_frame_rate',
        '-of', 'json', str(args.video),
    ], check=True, capture_output=True, text=True).stdout)
    # showinfo runs after select: each logged PTS belongs to a saved source frame.
    select = (f"select=between(t\\,{args.start}\\,{args.end})*"
              f"(isnan(prev_selected_t)+gte(t-prev_selected_t\\,{args.interval})),showinfo")
    result = subprocess.run([
        'ffmpeg', '-hide_banner', '-i', str(args.video), '-an', '-vf', select,
        '-fps_mode', 'vfr', '-t', str(args.end + 1),
        '-y', str(frames / 'quadro-%03d.png'),
    ], check=True, capture_output=True, text=True, encoding='utf-8', errors='replace')
    times = [float(t) for t in re.findall(r'\bn:\s*\d+.*?\bpts_time:([\d.]+)', result.stderr)]
    paths = sorted(frames.glob('quadro-*.png'))
    if len(paths) != len(times):
        raise RuntimeError(f'Frame/PTS mismatch: {len(paths)} != {len(times)}')
    records = []
    for path, timestamp in zip(paths, times):
        records.append({'file': path.relative_to(args.output).as_posix(),
                        'timestampSeconds': timestamp,
                        'timecode': f'{int(timestamp // 60):02d}:{timestamp % 60:06.3f}'})
    # Sheets are navigation aids. The PNG frames preserve the decoded native pixels.
    overview = []
    for record in records:
        if not overview or record['timestampSeconds'] - overview[-1]['timestampSeconds'] >= 0.9:
            overview.append(record)
    for sheet_start in range(0, len(overview), 6):
        subset = overview[sheet_start:sheet_start + 6]
        sheet = Image.new('RGB', (1350, 730), '#eee8db')
        draw = ImageDraw.Draw(sheet)
        for i, record in enumerate(subset):
            with Image.open(args.output / record['file']) as source:
                thumb = source.crop((190, 0, 1080, 670)).resize((445, 335), Image.Resampling.LANCZOS)
            x, y = (i % 3) * 450, (i // 3) * 365
            sheet.paste(thumb, (x, y + 25))
            draw.text((x + 8, y + 5), f"{record['timecode']} | {Path(record['file']).name}", fill='#201a12')
        sheet.save(args.output / f'contato-{sheet_start // 6 + 1:02d}.jpg', quality=94)
    manifest = {
        'source': args.video.name,
        'sha256': hashlib.file_digest(args.video.open('rb'), 'sha256').hexdigest(),
        'probe': probe, 'requestedRangeSeconds': [args.start, args.end],
        'minimumSamplingIntervalSeconds': args.interval,
        'processing': 'Native decoded PNG frames; no enhancement, reconstruction or text replacement. Contact sheets are cropped and resized previews only.',
        'frames': records,
    }
    (args.output / 'quadros.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(records)} frames; {len(overview)} overview samples; output: {args.output}')


if __name__ == '__main__':
    main()

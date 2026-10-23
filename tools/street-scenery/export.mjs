import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';

// SHARP_MODULE supports a bundled runtime without adding an application dependency.
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const folder = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(folder, '../../game/public/assets/indoor');
const patch = await sharp(path.join(folder, 'junction.svg')).png().toBuffer();
await fs.mkdir(path.join(folder, '../../.runtime/street'), { recursive: true });
await fs.writeFile(path.join(folder, '../../.runtime/street/junction.png'), patch);
for (const [file, left, width] of [
  ['CityBackground.png', -3200, 3200],
  ['CityBackground-East.png', 0, 3200],
]) {
  const x = Math.max(-340, left);
  const end = Math.min(1650, left + width);
  const piece = await sharp(patch).extract({ left: x + 340, top: 0, width: end - x, height: 2200 }).toBuffer();
  // Slice one world-space master across both files, preserving dimensions and offsets.
  await sharp(path.join(folder, 'source', file))
    .composite([{ input: piece, left: x - left, top: 230 }])
    .png().toFile(path.join(target, file));
}

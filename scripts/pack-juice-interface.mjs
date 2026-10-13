import fs from 'node:fs';
import path from 'node:path';
import { readPng, writePng } from './png.mjs';
import '../tools/asset-positioner/fit-geometry.js';

const root = path.resolve(import.meta.dirname, '..');
const ui = path.join(root, 'game/public/assets/ui/juice-machine');
const stages = path.join(root, 'game/public/assets/items/juice_machine/stages');
const F = globalThis.AssetFitGeometry;
function trim(image, mainCard = false) {
  let box = F.alphaBox(image.data, image.width, image.height);
  if (mainCard) {
    // The opaque card is one connected component; ignore stray alpha in its transparent export margin.
    const count = image.width * image.height, seen = new Uint8Array(count), queue = new Uint32Array(count);
    let largest = 0;
    for (let start = 0; start < count; start++) {
      if (seen[start] || image.data[start * 4 + 3] < 128) continue;
      let read = 0, write = 1, left = image.width, top = image.height, right = 0, bottom = 0;
      seen[start] = 1; queue[0] = start;
      while (read < write) {
        const index = queue[read++], x = index % image.width, y = Math.floor(index / image.width);
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        for (const next of [x > 0 ? index - 1 : -1, x + 1 < image.width ? index + 1 : -1, y > 0 ? index - image.width : -1, y + 1 < image.height ? index + image.width : -1]) {
          if (next < 0 || seen[next] || image.data[next * 4 + 3] < 128) continue;
          seen[next] = 1; queue[write++] = next;
        }
      }
      if (write > largest) { largest = write; box = { left: Math.max(0, left - 1), top: Math.max(0, top - 1), width: Math.min(image.width, right + 2) - Math.max(0, left - 1), height: Math.min(image.height, bottom + 2) - Math.max(0, top - 1) }; }
    }
  }
  const data = new Uint8ClampedArray(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    const offset = ((y + box.top) * image.width + box.left) * 4;
    data.set(image.data.subarray(offset, offset + box.width * 4), y * box.width * 4);
  }
  return { width: box.width, height: box.height, data, box };
}
for (const name of ['logo', 'evolution-card']) {
  const cropped = trim(readPng(path.join(ui, name + '-v1.png')), name === 'evolution-card');
  writePng(path.join(ui, name + '.png'), cropped);
}
const catalogue = [];
for (let stage = 1; stage <= 4; stage++) {
  const sourceFile = stage === 2 ? 'stage-2-source-v2.png' : `stage-${stage}-source-v1.png`;
  const preview = trim(readPng(path.join(stages, sourceFile)));
  writePng(path.join(stages, `stage-${stage}.png`), preview);
  let frame, calibration;
  if (stage === 1) {
    frame = { ...JSON.parse(fs.readFileSync(path.join(stages, '../item.json'), 'utf8')).parts[0], file: '../rotation-0.png' };
  } else {
    // The fitter's plausibility bounds operate at the native sprite scale.
    const normalized = trim(F.render(preview.data, preview.width, preview.height, F.rectTransform(0, 0, 220 / preview.width)));
    const detected = F.detect(F.alphaChannel(normalized.data, normalized.width, normalized.height), normalized.width, normalized.height);
    // Rounded cabinets need their visible floor contact, rather than extrapolated edge intersections.
    for (let y = normalized.height - 1; y >= 0; y--) {
      const feet = [];
      for (let x = Math.floor(normalized.width * .2); x < normalized.width * .8; x++) {
        if (normalized.data[(y * normalized.width + x) * 4 + 3] >= 160) feet.push(x);
      }
      if (feet.length < 3) continue;
      detected.base.front = { x: feet.reduce((sum, x) => sum + x, 0) / feet.length, y };
      break;
    }
    const fit = F.solve({ points: { base: detected.base, top: null }, plane: 'base', mode: 'angle' });
    const rendered = F.render(normalized.data, normalized.width, normalized.height, fit.transform);
    const cropped = trim(rendered);
    const file = `stage-${stage}-room.png`;
    writePng(path.join(stages, file), cropped);
    frame = { file, width: cropped.width, height: cropped.height, left: rendered.left + cropped.box.left, top: rendered.top + cropped.box.top };
    calibration = { normalizationWidth: 220, base: detected.base, transform: fit.transform };
  }
  catalogue.push({ stage, preview: `stage-${stage}.png`, frame, calibration,
    source: stage === 1 ? 'Recorte original 4432119/003, 05.png.' : 'imagegen: evolução baseada nas referências do responsável; exterior sem contorno branco, RGBA transparente.' });
}
fs.writeFileSync(path.join(stages, 'catalog.json'), JSON.stringify({ stages: catalogue }, null, 2) + '\n');
console.info('Título, painel e quatro estágios exportados com RGBA; bases dos sprites alinhadas ao tile 160×80.');

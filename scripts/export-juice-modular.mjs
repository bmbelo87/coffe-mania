import fs from 'node:fs';
import path from 'node:path';
import { readPng, writePng } from './png.mjs';
import '../tools/asset-positioner/fit-geometry.js';

const root = path.resolve(import.meta.dirname, '..');
const folder = path.join(root, 'game/public/assets/ui/juice-machine/modular-v2');
const F = globalThis.AssetFitGeometry;
const parts = [
  { id: 'panel', source: 'panel-final.png', file: 'painel-vazio.png', width: 594, height: 508, x: 0, y: 0 },
  { id: 'tab-active', source: 'tab-active.png', file: 'aba-ativa.png', width: 130, height: 35 },
  { id: 'tab-inactive', source: 'tab-inactive.png', file: 'aba-inativa.png', width: 130, height: 35 },
  { id: 'tab-locked', source: 'tab-locked.png', file: 'aba-bloqueada.png', width: 130, height: 35 },
  { id: 'machine-window', source: 'machine-window.png', file: 'janela-maquina.png', width: 154, height: 162, x: 28, y: 135 },
  { id: 'evolution-background', source: 'evolution-background.png', file: 'evolucao-fundo.png', width: 154, height: 174, x: 28, y: 314 },
  { id: 'evolution-title', source: 'evolution-title.png', file: 'evolucao-titulo.png', width: 140, height: 49, x: 35, y: 319, preserveAspect: true },
  { id: 'evolution-silhouette', source: 'evolution-silhouette.png', file: 'evolucao-silhueta.png', width: 62, height: 82, x: 74, y: 372, preserveAspect: true },
  { id: 'recipe-card', source: 'recipe-card.png', file: 'linha-suco.png', width: 362, height: 77 },
  { id: 'recipe-card-serving', source: 'recipe-card-serving.png', file: 'linha-suco-servindo.png', width: 362, height: 77 },
];

function contentCrop(image) {
  // Union of substantial opaque components keeps detached letters/accents, without export-margin speckles.
  const size = image.width * image.height, visited = new Uint8Array(size), queue = new Uint32Array(size);
  const minimum = Math.max(200, size * .00015);
  let left = image.width, top = image.height, right = -1, bottom = -1;
  for (let start = 0; start < size; start++) {
    if (visited[start] || image.data[start * 4 + 3] < 128) continue;
    let read = 0, write = 1, minX = image.width, minY = image.height, maxX = 0, maxY = 0;
    visited[start] = 1; queue[0] = start;
    while (read < write) {
      const index = queue[read++], x = index % image.width, y = Math.floor(index / image.width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const next of [x ? index - 1 : -1, x + 1 < image.width ? index + 1 : -1, y ? index - image.width : -1, y + 1 < image.height ? index + image.width : -1]) {
        if (next < 0 || visited[next] || image.data[next * 4 + 3] < 128) continue;
        visited[next] = 1; queue[write++] = next;
      }
    }
    if (write < minimum) continue;
    left = Math.min(left, minX); top = Math.min(top, minY); right = Math.max(right, maxX); bottom = Math.max(bottom, maxY);
  }
  if (right < left) throw Error('No opaque artwork');
  left = Math.max(0, left - 2); top = Math.max(0, top - 2);
  right = Math.min(image.width - 1, right + 2); bottom = Math.min(image.height - 1, bottom + 2);
  const width = right - left + 1, height = bottom - top + 1, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const offset = ((y + top) * image.width + left) * 4;
    data.set(image.data.subarray(offset, offset + width * 4), y * width * 4);
  }
  return { width, height, data, crop: { left, top, width, height } };
}
function panelSeam(image) {
  const x = Math.floor(image.width / 2);
  for (let y = Math.floor(image.height * .15); y < image.height * .4; y++) {
    const i = (y * image.width + x) * 4, [r, g, b, a] = image.data.slice(i, i + 4);
    if (a > 240 && r > 145 && g > 175 && r / b > .73) return y;
  }
  throw Error('Mint content edge not found');
}
function render(image, part, scale) {
  const width = part.width * scale, height = part.height * scale;
  let inverse;
  if (part.preserveAspect) {
    const ratio = Math.min((width - 2) / image.width, (height - 2) / image.height);
    const x = (width - image.width * ratio) / 2, y = (height - image.height * ratio) / 2;
    inverse = p => ({ x: (p.x - x) / ratio, y: (p.y - y) / ratio });
  } else if (part.id === 'panel') {
    const inputSeam = panelSeam(image), outputSeam = 119 * scale;
    // Register the two empty color regions at the tab seam; the reference exports remain untouched.
    inverse = p => ({ x: p.x * image.width / width, y: p.y < outputSeam
      ? p.y * inputSeam / outputSeam
      : inputSeam + (p.y - outputSeam) * (image.height - inputSeam) / (height - outputSeam) });
    part.sourceSeam = inputSeam;
  } else inverse = p => ({ x: p.x * image.width / width, y: p.y * image.height / height });
  return F.renderMapped(image.data, image.width, image.height, { bounds: { minX: 0, minY: 0, maxX: width, maxY: height }, inverse });
}

for (const part of parts) {
  const image = contentCrop(readPng(path.join(folder, 'sources', part.source)));
  part.sourceCrop = image.crop;
  for (const scale of [1, 2]) {
    const file = scale === 1 ? part.file : part.file.replace('.png', '@2x.png');
    writePng(path.join(folder, file), render(image, part, scale));
  }
}
const layout = {
  version: 2, scope: 'Assets separados para montagem; não altera a interface ativa do jogo.',
  canvas: { width: 594, height: 508 }, contentTop: 119, overlap: 2,
  parts,
  tabs: { positions: [12, 147, 284, 419].map(x => ({ x, y: 86, width: 130, height: 35 })),
    labels: ['Simples', 'Elaborados', 'Poderosos', 'Exóticos'],
    attachment: 'A base das abas sobrepõe 2 px do corpo; a aba ativa não tem contorno inferior.' },
  evolutionCaption: { text: 'Aprimore seus sucos\npara descobrir!', x: 39, y: 455, width: 132, height: 28, font: 'Arial', fontSize: 11, color: '#174d70' },
  existing: {
    logo: { file: '../logo.png', x: 152, y: -10, width: 286, height: 84, preserveAspect: true },
    machine: { file: '../../../items/juice_machine/stages/stage-1.png', x: 41, y: 139, width: 128, height: 153, preserveAspect: true },
    drinks: { folder: '../../../juices/', ids: ['orange', 'grape', 'lemon', 'pineapple'], rows: [135, 225, 315, 405] },
    close: { file: '../../buttons_collection_1.png', frame: { x: 1206, y: 297, width: 227, height: 234 }, x: 541, y: -6, width: 26, height: 26 },
    resourceIcons: { atlas: '../../icon_bundle_1.png', energy: '../../resource-icons/energy-blue.png' },
    buttonsAndProgress: 'Reutilizar os componentes atuais de JuiceInterfaceParts.ts/CookScreenModal.ts; não foram gerados ícones ou botões novos.',
  },
  provenance: 'Reconstrução raster com imagegen baseada na captura; não é extração pixel a pixel do original. Prompts em prompts.json, fontes intactas em sources/.',
};
fs.writeFileSync(path.join(folder, 'layout.json'), JSON.stringify(layout, null, 2) + '\n');
fs.writeFileSync(path.join(folder, 'layout.js'), 'globalThis.JuiceModularLayout = ' + JSON.stringify(layout, null, 2) + ';\n');
console.info('10 peças RGBA exportadas em 1× e 2×. Texto e silhueta preservam proporção; encaixe das abas em y=119.');

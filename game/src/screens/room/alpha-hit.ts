import { Rectangle, Texture, type TextureSource } from 'pixi.js';

/**
 * Área de clique pelo desenho, não pelo retângulo da imagem: as partes transparentes de um móvel
 * deixam o clique passar para o que está atrás (ex.: a cadeira na frente do fogão). Uma folga de
 * alguns pixels em volta do desenho evita exigir pontaria na borda.
 */

/** Resolução da máscara (px de textura por célula) e folga em volta do desenho, em células. */
const CELL = 2;
const DILATE_CELLS = 2;
const ALPHA_THRESHOLD = 40;

interface Mask { columns: number; rows: number; cells: Uint8Array }

const masks = new WeakMap<TextureSource, Map<string, Mask | null>>();

function readPixels(texture: Texture): { data: Uint8ClampedArray; width: number; height: number } | null {
  const source = texture.source;
  const resource = source.resource as CanvasImageSource | undefined;
  if (!resource || typeof document === 'undefined') return null;
  const ratio = source.pixelWidth / Math.max(1, source.width);
  const width = Math.max(1, Math.round(texture.frame.width * ratio));
  const height = Math.max(1, Math.round(texture.frame.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  try {
    context.drawImage(resource, texture.frame.x * ratio, texture.frame.y * ratio, width, height, 0, 0, width, height);
    return { data: context.getImageData(0, 0, width, height).data, width, height };
  } catch {
    return null; // fonte sem pixels legíveis: cai para o retângulo
  }
}

function maskFor(texture: Texture): Mask | null {
  let bySource = masks.get(texture.source);
  if (!bySource) { bySource = new Map(); masks.set(texture.source, bySource); }
  const key = `${texture.frame.x},${texture.frame.y},${texture.frame.width},${texture.frame.height}`;
  if (bySource.has(key)) return bySource.get(key)!;
  const pixels = readPixels(texture);
  let mask: Mask | null = null;
  if (pixels) {
    const scale = pixels.width / Math.max(1, texture.frame.width);
    const columns = Math.ceil(texture.frame.width / CELL), rows = Math.ceil(texture.frame.height / CELL);
    const solid = new Uint8Array(columns * rows);
    for (let py = 0; py < pixels.height; py++) {
      for (let px = 0; px < pixels.width; px++) {
        if (pixels.data[(py * pixels.width + px) * 4 + 3] < ALPHA_THRESHOLD) continue;
        const cx = Math.min(columns - 1, Math.floor(px / scale / CELL));
        const cy = Math.min(rows - 1, Math.floor(py / scale / CELL));
        solid[cy * columns + cx] = 1;
      }
    }
    const cells = new Uint8Array(columns * rows);
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < columns; cx++) {
        if (!solid[cy * columns + cx]) continue;
        for (let dy = -DILATE_CELLS; dy <= DILATE_CELLS; dy++) {
          for (let dx = -DILATE_CELLS; dx <= DILATE_CELLS; dx++) {
            const x = cx + dx, y = cy + dy;
            if (x >= 0 && y >= 0 && x < columns && y < rows) cells[y * columns + x] = 1;
          }
        }
      }
    }
    mask = { columns, rows, cells };
  }
  bySource.set(key, mask);
  return mask;
}

/** hitArea para um Sprite de âncora 0 e sem recorte: coordenadas locais = pixels da textura. */
export function alphaHitArea(texture: Texture): { contains(x: number, y: number): boolean } {
  return {
    contains(x: number, y: number): boolean {
      if (x < 0 || y < 0 || x >= texture.frame.width || y >= texture.frame.height) return false;
      const mask = maskFor(texture);
      if (!mask) return true;
      return mask.cells[Math.floor(y / CELL) * mask.columns + Math.floor(x / CELL)] === 1;
    },
  };
}

const contentTextures = new WeakMap<Texture, Texture>();

/** Presentation-only crop: transparent PNG padding must not change a thought icon's visible size.
 * The floor picking mask and its dilation remain independent of this unrotated icon crop. */
export function contentTexture(texture: Texture): Texture {
  const cached = contentTextures.get(texture);
  if (cached) return cached;
  const pixels = readPixels(texture);
  if (!pixels || texture.rotate) { contentTextures.set(texture, texture); return texture; }
  let left = pixels.width, top = pixels.height, right = -1, bottom = -1;
  for (let y = 0; y < pixels.height; y++) for (let x = 0; x < pixels.width; x++) {
    if (pixels.data[(y * pixels.width + x) * 4 + 3] < ALPHA_THRESHOLD) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < left) { contentTextures.set(texture, texture); return texture; }
  const scale = pixels.width / texture.frame.width;
  const crop = new Texture({ source: texture.source, frame: new Rectangle(texture.frame.x + left / scale,
    texture.frame.y + top / scale, (right - left + 1) / scale, (bottom - top + 1) / scale) });
  contentTextures.set(texture, crop); return crop;
}

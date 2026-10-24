import { Container, Sprite, Texture } from 'pixi.js';

/** Native raster measurements. The donor includes the existing grey rim, not the slabs. */
export const PARKING_PLATFORM_RASTER_CALIBRATION = {
  width: 1280, height: 640,
  corners: [[640, 2], [1276, 320], [640, 638], [4, 320]],
  stripeWidth: 8.75,
  patchDepth: 24,
  blendFrom: 20,
  cyclesPerEdge: 13,
  donorStart: 222,
  donorLength: 53.75,
} as const;

const textures = new WeakMap<Texture, Texture>();
const INV_SQRT_5 = 1 / Math.sqrt(5);
const EDGE_LENGTH = 636 * Math.sqrt(5) / 2;
const EDGE_CYCLE_LENGTH = EDGE_LENGTH / PARKING_PLATFORM_RASTER_CALIBRATION.cyclesPerEdge;

// NW is reflected around x=640 and y=320. Distances are measured on the floor plane;
// every side therefore keeps the same stripe width and number of complete cycles.
const EDGES = [
  { x: 640, y: 2, tx: -2 * INV_SQRT_5, ty: INV_SQRT_5, nx: INV_SQRT_5, ny: 2 * INV_SQRT_5 },
  { x: 640, y: 2, tx: 2 * INV_SQRT_5, ty: INV_SQRT_5, nx: -INV_SQRT_5, ny: 2 * INV_SQRT_5 },
  { x: 640, y: 638, tx: -2 * INV_SQRT_5, ty: -INV_SQRT_5, nx: INV_SQRT_5, ny: -2 * INV_SQRT_5 },
  { x: 640, y: 638, tx: 2 * INV_SQRT_5, ty: -INV_SQRT_5, nx: -INV_SQRT_5, ny: -2 * INV_SQRT_5 },
] as const;

/** Reuses one black/yellow cycle from the north-west edge. Alpha and all pixels
 * deeper than 24 native pixels remain unchanged; this is raster registration,
 * never a replacement drawing of the floor or its markings. */
export function calibrateParkingPlatformPixels(source: Uint8ClampedArray): Uint8ClampedArray {
  const { width, height, patchDepth, blendFrom, donorStart, donorLength } = PARKING_PLATFORM_RASTER_CALIBRATION;
  if (source.length !== width * height * 4) throw new RangeError('Parking platform requires a native 1280×640 RGBA raster.');
  const result = source.slice();

  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    if (source[index + 3] === 0) continue;
    let depth = Infinity;
    let nearest: typeof EDGES[number] = EDGES[0];
    for (const edge of EDGES) {
      const distance = (x - edge.x) * edge.nx + (y - edge.y) * edge.ny;
      if (distance < depth) { depth = distance; nearest = edge; }
    }
    if (depth < 0 || depth >= patchDepth) continue;

    const along = (x - nearest.x) * nearest.tx + (y - nearest.y) * nearest.ty;
    const phase = along / EDGE_CYCLE_LENGTH - Math.floor(along / EDGE_CYCLE_LENGTH);
    const donorAlong = donorStart + phase * donorLength;
    const sx = 4 + donorAlong * 2 * INV_SQRT_5 + depth * INV_SQRT_5;
    const sy = 320 - donorAlong * INV_SQRT_5 + depth * 2 * INV_SQRT_5;
    const ix = Math.floor(sx), iy = Math.floor(sy);
    const fx = sx - ix, fy = sy - iy;
    const mix = depth <= blendFrom ? 1 : (patchDepth - depth) / (patchDepth - blendFrom);

    for (let channel = 0; channel < 3; channel++) {
      const a = source[(iy * width + ix) * 4 + channel];
      const b = source[(iy * width + ix + 1) * 4 + channel];
      const c = source[((iy + 1) * width + ix) * 4 + channel];
      const d = source[((iy + 1) * width + ix + 1) * 4 + channel];
      const sample = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
      result[index + channel] = source[index + channel] * (1 - mix) + sample * mix;
    }
  }
  return result;
}

function calibratedTexture(original: Texture): Texture {
  const cached = textures.get(original);
  if (cached) return cached;
  const { width, height } = PARKING_PLATFORM_RASTER_CALIBRATION;
  if (original.orig.width !== width || original.orig.height !== height || original.rotate) {
    throw new Error('Parking platform calibration requires the unrotated native 1280×640 texture.');
  }
  const resource = original.source.resource as CanvasImageSource | undefined;
  if (!resource) throw new Error('Parking platform raster is not readable.');
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Parking platform raster requires a 2D canvas.');
  const ratio = original.source.pixelWidth / Math.max(1, original.source.width);
  const frame = original.frame;
  context.drawImage(resource, frame.x * ratio, frame.y * ratio, frame.width * ratio, frame.height * ratio,
    original.trim?.x ?? 0, original.trim?.y ?? 0, frame.width, frame.height);
  const pixels = context.getImageData(0, 0, width, height);
  pixels.data.set(calibrateParkingPlatformPixels(pixels.data));
  context.putImageData(pixels, 0, 0);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'linear';
  texture.source.autoGenerateMipmaps = true;
  texture.source.mipLevelCount = Math.floor(Math.log2(Math.max(width, height))) + 1;
  texture.source.minFilter = 'linear';
  texture.source.mipmapFilter = 'linear';
  textures.set(original, texture);
  return texture;
}

/** Native 1280×640 view, origin at the PNG's top-left. The caller applies world
 * position/scale and the (640,2) support. Its cached texture is shared by views. */
export function createParkingPlatformView(texture: Texture): Container {
  const view = new Container();
  view.label = 'scenery:parking-platform';
  view.eventMode = 'none';
  const raster = new Sprite(calibratedTexture(texture));
  raster.eventMode = 'none';
  view.addChild(raster);
  return view;
}

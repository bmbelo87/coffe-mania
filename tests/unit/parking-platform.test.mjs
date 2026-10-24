import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { test } from 'node:test';
import { build } from 'esbuild';

const compiled = await build({ entryPoints: ['game/src/screens/room/ParkingPlatform.ts'], bundle: true,
  write: false, format: 'esm', platform: 'node', external: ['pixi.js'] });
const code = compiled.outputFiles[0].text.replaceAll('"pixi.js"', JSON.stringify(import.meta.resolve('pixi.js')));
const { calibrateParkingPlatformPixels, PARKING_PLATFORM_RASTER_CALIBRATION: calibration } =
  await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

// Only the repository's native non-interlaced RGBA fixture is needed here.
function nativePngPixels(path) {
  const png = readFileSync(path), compressed = [];
  let width, height;
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    const bytes = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = bytes.readUInt32BE(0); height = bytes.readUInt32BE(4);
      assert.equal(bytes[8], 8); assert.equal(bytes[9], 6); assert.equal(bytes[12], 0);
    }
    if (type === 'IDAT') compressed.push(bytes);
    offset += length + 12;
  }
  assert.equal(width, calibration.width); assert.equal(height, calibration.height);
  const raw = inflateSync(Buffer.concat(compressed)), pixels = new Uint8ClampedArray(width * height * 4);
  const stride = width * 4;
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x, left = x >= 4 ? pixels[index - 4] : 0;
      const above = y > 0 ? pixels[index - stride] : 0;
      const upperLeft = x >= 4 && y > 0 ? pixels[index - stride - 4] : 0;
      let predict = 0;
      if (filter === 1) predict = left;
      else if (filter === 2) predict = above;
      else if (filter === 3) predict = Math.floor((left + above) / 2);
      else if (filter === 4) {
        const p = left + above - upperLeft;
        const dl = Math.abs(p - left), da = Math.abs(p - above), du = Math.abs(p - upperLeft);
        predict = dl <= da && dl <= du ? left : da <= du ? above : upperLeft;
      } else assert.equal(filter, 0);
      pixels[index] = (raw[y * (stride + 1) + 1 + x] + predict) & 255;
    }
  }
  return pixels;
}

const source = nativePngPixels('game/public/assets/scenery/coast-city/parking/platform.png');
const corrected = calibrateParkingPlatformPixels(source);
const k = 1 / Math.sqrt(5), edgeLength = 636 * Math.sqrt(5) / 2;
const edges = [
  { x: 640, y: 2, tx: -2*k, ty: k, nx: k, ny: 2*k },
  { x: 640, y: 2, tx: 2*k, ty: k, nx: -k, ny: 2*k },
  { x: 640, y: 638, tx: -2*k, ty: -k, nx: k, ny: -2*k },
  { x: 640, y: 638, tx: 2*k, ty: -k, nx: -k, ny: -2*k },
];
function sample(edge, along, depth) {
  const x = Math.round(edge.x + along * edge.tx + depth * edge.nx);
  const y = Math.round(edge.y + along * edge.ty + depth * edge.ny);
  return corrected.subarray((y * calibration.width + x) * 4, (y * calibration.width + x) * 4 + 4);
}

test('calibration preserves transparency, 2:1 corners and every interior pixel', () => {
  let alphaChanges = 0, interiorChanges = 0;
  for (let y = 0; y < calibration.height; y++) for (let x = 0; x < calibration.width; x++) {
    const index = (y * calibration.width + x) * 4;
    if (source[index + 3] !== corrected[index + 3]) alphaChanges++;
    const depth = Math.min(...edges.map(edge => (x-edge.x)*edge.nx + (y-edge.y)*edge.ny));
    if (depth >= calibration.patchDepth || depth < 0) {
      if ([0, 1, 2].some(channel => source[index + channel] !== corrected[index + channel])) interiorChanges++;
    }
  }
  assert.equal(alphaChanges, 0); assert.equal(interiorChanges, 0);
  assert.notDeepEqual(corrected, source);
});

test('all four sides have equal complete stripe cycles and a constant grey inner boundary', () => {
  const cycle = edgeLength / calibration.cyclesPerEdge;
  for (const [edgeIndex, edge] of edges.entries()) for (let step = 0; step < calibration.cyclesPerEdge; step++) {
    const black = sample(edge, cycle * (step + .25), 4.5);
    const yellow = sample(edge, cycle * (step + .75), 4.5);
    assert.ok(black[0] < 90 && black[1] < 90 && black[2] < 90, `edge ${edgeIndex}, cycle ${step}: black`);
    assert.ok(yellow[0] > 170 && yellow[1] > 170 && yellow[2] < 110, `edge ${edgeIndex}, cycle ${step}: yellow`);
    const inner = sample(edge, cycle * (step + .5), 12);
    assert.ok(Math.max(...inner.subarray(0,3)) - Math.min(...inner.subarray(0,3)) < 20,
      `edge ${edgeIndex}, cycle ${step}: taper crosses inner rim`);
  }
});

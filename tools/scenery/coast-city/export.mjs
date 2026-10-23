import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const folder = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(folder, '../../../game/public/assets/scenery/coast-city');
const sha = data => createHash('sha256').update(data).digest('hex');
const assets = [];
await fs.mkdir(path.join(output, 'terrain'), { recursive: true });
await fs.mkdir(path.join(output, 'props'), { recursive: true });

async function publish(id, input, group, settings = {}) {
  const master = await fs.readFile(path.join(folder, 'masters', input + '.png'));
  const meta = await sharp(master).metadata();
  let image = sharp(master);
  let crop;
  if (settings.crop) {
    crop = settings.crop;
    image = image.extract(crop);
  }
  if (meta.hasAlpha && !settings.crop) {
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 16) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    if (x1 < x0) throw Error('Empty alpha: ' + id);
    // Trim transparent margins only; retain the generated alpha and its antialiasing.
    crop = { left: Math.max(0, x0 - 2), top: Math.max(0, y0 - 2), width: Math.min(info.width - Math.max(0, x0 - 2), x1 - x0 + 5), height: Math.min(info.height - Math.max(0, y0 - 2), y1 - y0 + 5) };
    image = image.extract(crop);
  }
  let data;
  if (settings.paintTile) {
    // Reuse one generated paint block; only crop, resize and transparent padding.
    const trimmed = await image.png().toBuffer();
    const { data: pixels, info } = await sharp(trimmed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = (x,y)=>pixels[(y*info.width+x)*4+3];
    const row = Math.floor(info.height/2);
    let x0=0; while(x0<info.width && alpha(x0,row)<128) x0++;
    let x1=x0; while(x1<info.width && alpha(x1,row)>=128) x1++;
    if(x1===x0) throw Error('Missing generated paint block');
    const middle=Math.floor((x0+x1)/2);
    let y0=0; while(y0<info.height && alpha(middle,y0)<128) y0++;
    let y1=info.height; while(y1>y0 && alpha(middle,y1-1)<128) y1--;
    const dash=await sharp(trimmed).extract({left:x0,top:y0,width:x1-x0,height:y1-y0}).resize(128,16).png().toBuffer();
    data=await sharp({create:{width:256,height:16,channels:4,background:'#00000000'}}).composite([{input:dash,left:0,top:0}]).png().toBuffer();
  } else if (settings.mirrorTile) {
    const size = settings.mirrorTile;
    const tile = await image.resize(size, size, { fit: 'fill' }).png().toBuffer();
    const horizontal = await sharp(tile).flop().toBuffer();
    const vertical = await sharp(tile).flip().toBuffer();
    const both = await sharp(tile).flip().flop().toBuffer();
    data = await sharp({ create: { width: size * 2, height: size * 2, channels: 4, background: '#00000000' } })
      .composite([{ input: tile, left: 0, top: 0 }, { input: horizontal, left: size, top: 0 }, { input: vertical, left: 0, top: size }, { input: both, left: size, top: size }]).png().toBuffer();
  } else if (id === 'shoreline') {
    const tile = await image.resize(512, 64, { fit: 'fill' }).png().toBuffer();
    const mirrored = await sharp(tile).flop().toBuffer();
    data = await sharp({ create: { width: 1024, height: 64, channels: 4, background: '#00000000' } })
      .composite([{ input: tile, left: 0, top: 0 }, { input: mirrored, left: 512, top: 0 }]).png().toBuffer();
  } else {
    data = await image.resize(settings.width || 512, settings.height, { fit: settings.height ? 'fill' : 'inside' }).png().toBuffer();
  }
  const file = `${group}/${id}.png`;
  await fs.writeFile(path.join(output, file), data);
  const published = await sharp(data).metadata();
  assets.push({ id, file, width: published.width, height: published.height, alpha: published.hasAlpha, origin: 'imagegen-reconstruction', master: `masters/${input}.png`, masterSha256: sha(master), prompt: `prompts/${input}.txt`, crop, sha256: sha(data), export: settings });
}

await publish('water', 'water-calm-aligned', 'terrain', { mirrorTile: 1024 });
await publish('sand', 'sand', 'terrain', { mirrorTile: 256 });
await publish('wet-sand', 'wet-sand', 'terrain', { width: 1024, height: 96 });
await publish('grass', 'grass', 'terrain', { mirrorTile: 64 });
await publish('sidewalk', 'sidewalk-muted', 'terrain', { mirrorTile: 256 });
// The master includes two baked curb faces; geometry supplies those separately.
// Reuse the asphalt band only so no second border bleeds into the intersections.
await publish('road', 'road-start', 'terrain', { width: 1024, height: 320, crop: { left: 0, top: 85, width: 2172, height: 550 } });
await publish('road-start', 'road-start', 'terrain', { width: 1024, height: 320, crop: { left: 0, top: 85, width: 2172, height: 550 } });
await publish('road-marking', 'crosswalk-crisp', 'terrain', { paintTile: true });
await publish('curb', 'curb-blocks', 'terrain', { width: 1024, height: 24, crop: { left: 0, top: 150, width: 2172, height: 424 } });
await publish('shoreline', 'shoreline-clean', 'terrain');
// Twice the logical size, with the calibrated aspect baked before projection.
// Direct runtime sampling keeps the gaps between the five paint bars distinct.
await publish('crosswalk', 'crosswalk-crisp', 'terrain', { width: 540, height: 110 });
for (const [id, input, width, height] of [
  ['tree-round', 'tree-round', 300], ['tree-conifer', 'tree-conifer', 220],
  ['umbrella-green', 'umbrella-green', 300], ['umbrella-orange', 'umbrella-orange', 300],
  ['umbrella-folded', 'umbrella-folded', 180], ['beach-chair', 'beach-chair', 180],
  ['rock-palm', 'rock-palm', 320], ['pier', 'pier-open-entry', 700, 675],
  ['pier-arch', 'pier-arch', 300, 600], ['pier-steps', 'pier-steps', 300], ['pier-shadow', 'pier-shadow', 700, 420],
  ['boat', 'boat-clean', 400], ['surfboards', 'surfboards', 240], ['lifebuoy', 'lifebuoy', 160],
]) await publish(id, input, 'props', { width, ...(height ? { height } : {}) });

const provenance = {
  created: '2026-10-22', scope: 'Static urban coast beside the city cafe; no beach branch, boat trip, or new navigation.',
  method: 'Built-in Image Gen; source crops are references, published art is reconstructed, not original extracted sprites. Cropping, resizing, transparent padding and mirrored repetition only during export; no new illustrated vector paths. Road markings reuse one generated crosswalk paint block.',
  references: ['references/urban-coast.png', 'references/pier-boat.png', 'references/umbrellas-rock.png', 'references/trees.png', 'references/surfboards.png', 'references/original-city-dock.png', 'references/pier-lamp-reference.png', 'references/wet-sand-detail.png', 'references/road-curb-original.png', 'references/pier-gate-original.png'],
  sources: ['artes-referencia/cenario-praia/detalhes/118s.png', 'artes-referencia/cafe-mania-acervo-complementar-2/cafe-mania-acervo-2/artes/49023909/002.png'],
  assets,
};
await fs.writeFile(path.join(folder, 'source.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(`${assets.length} modular PNG assets exported.`);

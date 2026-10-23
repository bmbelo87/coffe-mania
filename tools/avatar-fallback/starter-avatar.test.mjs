import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const source = await build({
  stdin: { contents: `export { lookupFrame } from './game/src/avatar/AvatarBaker';
    export { CLIP, CLIP_DIRECTIONS, clipFrames } from './game/src/avatar/clips';
    export { Wardrobe, resolveLook } from './game/src/avatar/wardrobe';
    export { starterLook, STARTER_PARTS } from './game/src/avatar/starter-look';
    export { serializeAppearance, restoreAppearance } from './game/src/avatar/appearance';`,
    resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false,
});
const M = await import('data:text/javascript;base64,' + Buffer.from(source.outputFiles[0].text).toString('base64'));
const root = new URL('../../game/public/assets/avatar/placeholder/', import.meta.url);
const metadata = JSON.parse(await readFile(new URL('starter-atlas.json', root), 'utf8'));
const old = JSON.parse(await readFile(new URL('atlas.json', root), 'utf8'));
const png = await readFile(new URL('starter-atlas.png', root));
const atlas = { ...metadata, index: new Map(metadata.cells.map(cell => [`${cell.clip}:${cell.direction}:${cell.frame}`, cell])) };
const avatarRoot = new URL('../../game/public/assets/avatar/', import.meta.url);
const wardrobe = M.Wardrobe.from(JSON.parse(await readFile(new URL('wardrobe.json', avatarRoot), 'utf8')));
const textureAtlas = JSON.parse(await readFile(new URL('atlas.json', avatarRoot), 'utf8'));
const serverCatalog = JSON.parse(await readFile(new URL('../../database/appearance/catalog.json', import.meta.url), 'utf8'));

test('As seis peças têm slot, ícone ou textura e permissão no servidor', () => {
  for (const [group, id] of Object.entries(M.STARTER_PARTS)) {
    const item = wardrobe.byId(id);
    assert.equal(item.group, group);
    assert.ok(!item.invisible);
    assert.ok(serverCatalog.slots[group].includes(id));
    assert.ok(textureAtlas.symbols[item.iconName || item.texture]);
    assert.equal(wardrobe.inGroup(group).filter(item => !item.invisible)[0].id, id);
  }
});

test('Cada peça pode ser trocada sem apagar as outras e sobrevive ao salvamento da aparência', () => {
  const starter = M.starterLook(wardrobe);
  assert.deepEqual(M.restoreAppearance(wardrobe, M.serializeAppearance(starter)), starter);
  for (const [group, id] of Object.entries(M.STARTER_PARTS)) {
    const replacement = wardrobe.defaultOf(group);
    const look = { ...starter, itemIds: starter.itemIds.map(value => value === id ? replacement.id : value) };
    const resolved = M.resolveLook(wardrobe, look);
    for (const [otherGroup, otherId] of Object.entries(M.STARTER_PARTS)) {
      if (otherGroup === group) continue;
      const other = wardrobe.byId(otherId);
      if (other.texture) assert.ok(resolved.textureLayers.includes(other.texture));
      for (const object of other.objects) assert.ok(resolved.objects.includes(object));
    }
    assert.deepEqual(M.restoreAppearance(wardrobe, M.serializeAppearance(look)), look);
  }
});

test('Entrada sem aparência usa o personagem inicial, preservando looks personalizados', async () => {
  const initial = JSON.parse(await readFile(new URL('../../shared/avatarappearance/starter.json', import.meta.url), 'utf8'));
  const expected = { itemIds: initial.itemIds, skinColour: initial.skinColour, hairColour: initial.hairColour };
  assert.deepEqual(M.starterLook(wardrobe), expected);
  assert.deepEqual(M.restoreAppearance(wardrobe), expected);
  assert.deepEqual(M.restoreAppearance(wardrobe, ''), expected);
  const custom = wardrobe.defaultLook();
  assert.deepEqual(M.restoreAppearance(wardrobe, M.serializeAppearance(custom)), custom);
});

test('O fallback mantém o apoio e a escala e possui imagem correspondente ao manifesto', () => {
  assert.equal(metadata.version, 1);
  assert.deepEqual(metadata.ground, old.ground);
  assert.equal(metadata.scale, old.scale);
  assert.equal(png.readUInt32BE(16), metadata.width);
  assert.equal(png.readUInt32BE(20), metadata.height);
  assert.equal(atlas.index.size, metadata.cells.length);
  for (const cell of metadata.cells) {
    assert.ok(cell.x >= 0 && cell.y >= 0);
    assert.ok(cell.x + metadata.cell <= metadata.width);
    assert.ok(cell.y + metadata.cell <= metadata.height);
  }
});

test('Todas as ações do jogador têm quadros e mãos para as direções suportadas', () => {
  for (const clip of [M.CLIP.IDLE, M.CLIP.WALK, M.CLIP.SIT, M.CLIP.EAT, M.CLIP.WAITOR_WALK, M.CLIP.COOKING]) {
    for (const direction of M.CLIP_DIRECTIONS[clip]) {
      for (const frame of M.clipFrames(clip)) {
        const result = M.lookupFrame(atlas, clip, direction, frame);
        assert.ok(result, `Ausente: ${clip}:${direction}:${frame}`);
        if (clip === M.CLIP.WAITOR_WALK || clip === M.CLIP.COOKING) {
          assert.ok(Number.isFinite(result.cell.carryingHand?.x));
          assert.ok(Number.isFinite(result.cell.carryingLeftHand?.y));
        }
      }
    }
  }
});

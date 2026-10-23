import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Container, Texture, TextureSource } from 'pixi.js';

process.on('uncaughtException', error => { console.error(`${error.name}: ${error.message}`); process.exit(1); });

async function load(path) {
  const result = await build({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'node', external: ['pixi.js'], loader: { '.css': 'empty' } });
  const code = result.outputFiles[0].text.replaceAll('"pixi.js"', JSON.stringify(import.meta.resolve('pixi.js')));
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
const { StoreActionBar } = await load('game/src/screens/room/StoreActionBar.ts');
const { RoomStoreController } = await load('game/src/screens/room/RoomStoreController.ts');
const { RoomModel } = await load('game/src/world/RoomModel.ts');
const { IndoorArt } = await load('game/src/game/indoor-art.ts');
const { tileToScreen } = await load('game/src/world/iso.ts');
const texture = (width, height) => new Texture({ source: new TextureSource({ width, height }) });
const sheet = texture(1800, 1100);
const root = new Container(), store = new StoreActionBar(sheet, sheet);
root.position.set(27, 43); root.scale.set(.8); root.addChild(store.view);
const content = store.view.getChildByLabel('store-action-bar', true);
store.open();
for (const delta of [0, 80, 100, 80]) {
  store.update(delta);
  assert.equal(store.containsGlobalPoint(content.toGlobal({ x: 200, y: 100 })), true);
  assert.equal(store.containsGlobalPoint(content.toGlobal({ x: -100, y: 100 })), false);
  assert.equal(store.containsGlobalPoint(content.toGlobal({ x: 200, y: -160 })), false);
}
store.setHudScale(.75);
assert.equal(store.containsGlobalPoint(content.toGlobal({ x: 200, y: 100 })), true);
store.close(); assert.equal(store.containsGlobalPoint({ x: 900, y: 900 }), false);
store.open(); store.update(260);

const world = new Container(); world.position.set(500, 50); world.scale.set(.55);
const item = { id: 1, classname: 'test-table', name: 'Mesa', type: 3, kind: 'table', priceGold: 100, purchasable: false, sizeX: 2, sizeY: 1 };
const unit = { unitId: 'test-unit', itemId: 1, placed: true, tx: 2, ty: 2, rotation: 0 };
let snapshot = { revision: 1, tilesX: 10, tilesY: 10, catalog: [item], inventory: [unit], playerState: { level: 1 } };
const calls = [], alpha = new Map();
let reject = false;
const frames = Array.from({ length: 4 }, (_, rotation) => ({ file: `rotation-${rotation}`, rotation, left: -70, top: -100, width: 160, height: 160 }));
const textures = new Map(frames.map(frame => [frame.file, texture(160, 160)]));
const controller = new RoomStoreController({
  snapshot, model: new RoomModel({ tilesX: 10, tilesY: 10, items: [], walls: false }), world,
  art: { art: new IndoorArt({ [item.classname]: { frames, sizeX: 2, sizeY: 1, itemHeight: 100 } }), textureFor: file => textures.get(file) },
  client: {
    async mutate(action, revision, payload) {
      calls.push({ action, revision, ...payload });
      if (reject) throw Error('Conflito simulado');
      snapshot = { ...snapshot, revision: revision + 1, inventory: [{ ...snapshot.inventory[0], ...payload, placed: action !== 'store' }] };
      return snapshot;
    },
    async refresh() { return snapshot; },
  },
  apply() {}, alpha: (id, value) => alpha.set(id, value),
});
controller.attach(store);
let timeStamp = 0;
const event = (tx, ty, extra = {}) => {
  const point = tileToScreen(tx, ty); point.y += 40;
  return { pointerId: 1, timeStamp: ++timeStamp, button: 0, global: world.toGlobal(point), stopPropagation() {}, ...extra };
};
const flush = () => new Promise(resolve => setImmediate(resolve));
controller.pointerDown(event(2, 2), unit.unitId);
assert.equal(alpha.get(unit.unitId), 0);
assert.equal(controller.preview.children.length, 1, 'O móvel selecionado deve ter uma prévia visível');
controller.endDrag(event(2, 2));
assert.equal(calls.length, 0, 'Selecionar sem arrastar não salva uma nova posição');
controller.hover(event(5, 3));
for (let rotation = 1; rotation <= 4; rotation++) {
  controller.key({ key: 'r' });
  assert.equal(controller.preview.children[0].texture, textures.get(`rotation-${rotation % 4}`));
  assert.equal(controller.indicator.children.length, 2, 'A pegada deve acompanhar a rotação');
}
controller.pointerDown(event(5, 3)); await flush();
assert.deepEqual(calls[0], { action: 'move', revision: 1, unitId: unit.unitId, tx: 5, ty: 3, rotation: 0 });
assert.equal(alpha.get(unit.unitId), 1);
assert.equal(controller.preview.children.length, 0);
controller.pointerDown(event(5, 3), unit.unitId); controller.endDrag(event(5, 3));
controller.hover(event(6, 4)); controller.key({ key: 'Escape' });
assert.equal(alpha.get(unit.unitId), 1); assert.equal(calls.length, 1);
controller.pointerDown(event(5, 3), unit.unitId);
controller.endDrag(event(6, 4)); await flush();
assert.equal(calls.length, 2); assert.equal(calls[1].tx, 6); assert.equal(calls[1].ty, 4);
controller.interact(event(6, 4, { shiftKey: true }), unit.unitId); await flush();
assert.equal(calls[2].rotation, 1); assert.equal(calls[2].tx, 6); assert.equal(calls[2].ty, 4);
reject = true;
controller.pointerDown(event(6, 4), unit.unitId); controller.endDrag(event(6, 4));
controller.pointerDown(event(7, 5)); await flush();
assert.equal(controller.preview.children.length, 1, 'Uma recusa deve manter a prévia disponível');
controller.cancel(); assert.equal(alpha.get(unit.unitId), 1);
controller.destroy(); store.destroy();
console.log('OK: hitbox animada e HUD, seleção, quatro rotações, clique para mover, arrasto, Shift, cancelamento e recusa do servidor.');

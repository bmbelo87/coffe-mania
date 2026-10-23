import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Container } from 'pixi.js';

async function load(path) {
  const result = await build({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'node', external: ['pixi.js'] });
  const code = result.outputFiles[0].text.replaceAll('"pixi.js"', JSON.stringify(import.meta.resolve('pixi.js')));
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const { Actor } = await load('game/src/world/Actor.ts');
const { itemDepth } = await load('game/src/world/iso.ts');
const { RoomDepthSorter, setActorRoomDepth, setItemRoomDepth, setItemOverlayDepth, setSeatedActorRoomDepth } = await load('game/src/screens/room/RoomDepthSorter.ts');

for (const anchor of ['center', 'front-edge']) for (const size of [1, 2]) {
  const world = new Container();
  const chairView = new Container(), occupantView = new Container(), backrestView = new Container();
  const behindView = new Container(), aheadView = new Container();
  world.addChild(chairView, occupantView, backrestView, behindView, aheadView);
  const occupant = new Actor('occupant'); occupant.setTilePosition(4, 4);
  const behind = new Actor('behind'); behind.setTilePosition(2, 2);
  const ahead = new Actor('ahead'); ahead.setTilePosition(7, 7);
  setActorRoomDepth(behindView, behind); setActorRoomDepth(aheadView, ahead);
  const sorter = new RoomDepthSorter();
  for (const rotation of [0, 1, 2, 3, 0, 3, 1]) {
    const chair = { id: 1, name: 'chair', kind: 'chair', tx: 4, ty: 4, rotation, sizeX: size, sizeY: size, occlusionAnchor: anchor };
    const nominal = itemDepth(chair.tx + size - 1, chair.ty + size - 1, 4, anchor);
    setItemRoomDepth(chairView, chair, nominal);
    setItemOverlayDepth(backrestView, chair, 2);
    backrestView.visible = rotation >= 2;
    for (let tick = 0; tick < 4; tick++) {
      // Avatar sync resets its nominal index on every animation frame.
      occupantView.zIndex = occupant.drawPriority;
      setSeatedActorRoomDepth(occupantView, occupant, chair);
      sorter.sync(world);
      assert.ok(occupantView.zIndex > chairView.zIndex && (!backrestView.visible || backrestView.zIndex > occupantView.zIndex),
        `chair rotation ${rotation}, anchor ${anchor}, footprint ${size}: incorrect seated overlap`);
      assert.ok(behindView.zIndex < chairView.zIndex && behindView.zIndex < occupantView.zIndex);
      assert.ok(aheadView.zIndex > chairView.zIndex && aheadView.zIndex > occupantView.zIndex);
    }
    occupant.setTilePosition(7, 7);
    setSeatedActorRoomDepth(occupantView, occupant);
    sorter.sync(world);
    assert.ok(occupantView.zIndex > chairView.zIndex, 'standing retained the seated layer');
    occupant.setTilePosition(4, 4);
  }
  world.destroy({ children: true });
}
const actor = new Actor('walking');
const move = { from: { tx: 4, ty: 4 }, to: { tx: 5, ty: 4 }, startedAt: 0, duration: 1000 };
actor.syncAuthoritative(4, 4, 1, false, move, 490);
assert.equal(actor.tileX, 4); const x = actor.x;
actor.syncAuthoritative(4, 4, 1, false, move, 510);
assert.equal(actor.tileX, 5);
assert.ok(actor.x > x && actor.x < 80, 'walking stopped interpolating across the logical half-step');
console.log('Seated layers: four rotations, cached animation frames, footprint/anchor, neighbors, standing and logical half-step: OK');

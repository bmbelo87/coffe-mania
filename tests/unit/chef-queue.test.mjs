import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

await mkdir('.runtime/tests', { recursive: true });
const outfile = path.resolve('.runtime/tests/chef-queue.mjs');
const result = await build({ stdin: { contents: "export { RoomScreen } from './game/src/screens/room/RoomScreen'; export { ChefQueue } from './game/src/game/chef-queue';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, outfile, packages: 'external',
  define: { 'import.meta.env.BASE_URL': JSON.stringify('/'), 'import.meta.env.DEV': 'false', 'document.baseURI': JSON.stringify('http://localhost/') },
  plugins: [{ name: 'skip-browser-styles', setup(b) { b.onResolve({ filter: /\.css$/ }, args => ({ path: args.path, namespace: 'empty' })); b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' })); } }],
});
await writeFile(outfile, result.outputFiles[0].text);
const { RoomScreen, ChefQueue } = await import(pathToFileURL(outfile));

function screen() {
  const room = Object.create(RoomScreen.prototype);
  const stoves = [1, 2, 3].map(n => ({ kind: 'stove', instanceId: `s${n}`, tx: n, ty: 1 }));
  Object.assign(room, { chefQueue: new ChefQueue(), model: { items: stoves }, networkPending: 0, dirtyStoves: new Set(),
    occupiedStoves: new Map(), player: { reachedPathEnd: () => true }, stoveViews: new Map(), realtime: { connected: true, selfId: 'chef', actors: new Map([['chef', { state: 'cooking' }]]) } });
  return { room, stoves, self: room.realtime.actors.get('chef') };
}
test('selecting three stoves while preparing preserves FIFO and captured recipe/stove pairs', () => {
  const { room, stoves, self } = screen(); const events = [];
  room.performCooking = (recipe, stove) => { events.push([stove.instanceId, recipe.id]); self.state = 'cooking'; };
  for (const [i, stove] of stoves.entries()) { room.selectedStove = stove; room.startCooking({ id: ['nachos', 'x_tudo', 'passion_fruit_mousse'][i] }); }
  assert.equal(room.chefQueue.size, 3);
  assert.ok(stoves.every(stove => room.chefQueue.has(stove.instanceId)));
  room.advanceChefQueue(); assert.deepEqual(events, []);
  for (let i = 0; i < 3; i++) { self.state = 'idle'; room.advanceChefQueue(); }
  assert.deepEqual(events, [['s1', 'nachos'], ['s2', 'x_tudo'], ['s3', 'passion_fruit_mousse']]);
  assert.equal(room.chefQueue.size, 0);
});
test('a busy chef can open another stove book; duplicates and removed stoves do not execute', () => {
  const { room, stoves, self } = screen(); const events = [];
  room.cookModal = { open: () => events.push('book') };
  room.startingCook = true; room.pendingCook = { stove: stoves[0] };
  room.openCookScreen(stoves[1]); assert.deepEqual(events, ['book']);
  room.selectedStove = stoves[1]; room.startCooking({ id: 'x_tudo' }); room.startCooking({ id: 'nachos' });
  assert.equal(room.chefQueue.size, 1);
  room.startingCook = false; room.pendingCook = undefined; self.state = 'idle';
  room.model.items = [stoves[0], stoves[2]];
  room.performCooking = () => assert.fail('removed stove dispatched'); room.advanceChefQueue();
  assert.equal(room.chefQueue.size, 0);
});
test('cleaning and serving share the queue and wait for the chef to finish carrying', () => {
  const { room, stoves, self } = screen(); const events = [];
  room.dirtyStoves.add('s1'); room.performCleaning = stove => { events.push('clean:' + stove.instanceId); self.state = 'cleaning'; };
  room.performServing = stove => events.push('serve:' + stove.instanceId);
  room.startCleaning(stoves[0]); room.startServing(stoves[1]);
  self.state = 'carrying'; room.advanceChefQueue(); assert.deepEqual(events, []);
  self.state = 'idle'; room.advanceChefQueue(); assert.deepEqual(events, ['clean:s1']);
  self.state = 'placing'; room.advanceChefQueue(); assert.equal(events.length, 1);
  self.state = 'idle'; room.advanceChefQueue(); assert.deepEqual(events, ['clean:s1', 'serve:s2']);
});
test('queued stove transparency clears when its pending intent is removed', () => {
  const { room, stoves } = screen();
  Object.assign(room, { liveActors: new Map(), heldUnits: new Set(), sharedCookingProgress: new Map(), spiceGlows: new Map(), sharedCookingViews: new Map() });
  const views = stoves.map(() => ({ alpha: 1, tint: 0xffffff }));
  stoves.forEach((stove, i) => room.stoveViews.set(stove, [views[i]]));
  room.selectedStove = stoves[1]; room.startCooking({ id: 'nachos' });
  room.updateSharedStoves(0);
  assert.deepEqual(views.map(view => view.alpha), [1, .38, 1]);
  room.chefQueue.clear(); room.updateSharedStoves(1);
  assert.deepEqual(views.map(view => view.alpha), [1, 1, 1]);
});

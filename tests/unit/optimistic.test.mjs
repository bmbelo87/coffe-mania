import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

await mkdir('.runtime/tests', { recursive: true });
const outfile = path.resolve('.runtime/tests/optimistic.mjs');
const result = await build({
  stdin: { contents: "export { PredictedBalance, SerialQueue } from './game/src/game/optimistic'; export { projectRoom } from './game/src/screens/room/RoomStoreController'; export { predictSupply } from './game/src/game/supplies';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, outfile, packages: 'external',
  define: { 'import.meta.env.BASE_URL': JSON.stringify('/'), 'import.meta.env.DEV': 'false', 'document.baseURI': JSON.stringify('http://localhost/') },
  plugins: [{ name: 'skip-browser-styles', setup(b) { b.onResolve({ filter: /\.css$/ }, args => ({ path: args.path, namespace: 'empty' })); b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' })); } }],
});
await writeFile(outfile, result.outputFiles[0].text);
const { PredictedBalance, SerialQueue, projectRoom, predictSupply } = await import(pathToFileURL(outfile));

const state = (gold, cash = 10, energy = 50) => ({
  cafeName: 'Café', cash, gold, level: 1,
  experience: { current: 0, maximum: 100 }, energy: { current: energy, maximum: 50 },
  crates: { current: 4, maximum: 4 }, satisfaction: { current: 50, maximum: 100 },
});

test('pintar vários tiles: cada resposta do servidor abate um gasto, sem contar duas vezes', () => {
  const balance = new PredictedBalance();
  const server = state(100);
  for (let i = 0; i < 5; i++) balance.add({ gold: -3 }, server);
  assert.equal(balance.apply(server).gold, 85);
  // The answers arrive one by one; the number on screen never moves back up.
  for (let paid = 1; paid <= 5; paid++) assert.equal(balance.apply(state(100 - 3 * paid)).gold, 85);
  assert.equal(balance.size, 0);
});

test('o estado do servidor pode chegar antes ou depois da resposta', () => {
  const balance = new PredictedBalance();
  const token = balance.add({ gold: -30 }, state(100));
  assert.equal(balance.apply(state(70)).gold, 70);
  balance.settle(token);
  assert.equal(balance.apply(state(70)).gold, 70);
  const late = balance.add({ cash: -4 }, state(70));
  balance.settle(late);
  assert.equal(balance.apply(state(70, 6)).cash, 6);
});

test('recusa: a previsão sai e o saldo volta ao do servidor', () => {
  const balance = new PredictedBalance();
  const token = balance.add({ gold: -30, energy: -5 }, state(100));
  assert.deepEqual([balance.apply(state(100)).gold, balance.apply(state(100)).energy.current], [70, 45]);
  balance.settle(token);
  assert.deepEqual([balance.apply(state(100)).gold, balance.apply(state(100)).energy.current], [100, 50]);
});

test('um ganho de outra origem não abate um gasto previsto', () => {
  const balance = new PredictedBalance();
  balance.add({ gold: -30 }, state(100));
  assert.equal(balance.apply(state(112)).gold, 82);
  assert.equal(balance.apply(state(82)).gold, 82);
  assert.equal(balance.size, 0);
});

test('a fila manda uma tarefa por vez, mesmo depois de uma falha', async () => {
  const queue = new SerialQueue();
  const order = [];
  const step = (name, fail) => () => new Promise((resolve, reject) => setTimeout(() => {
    order.push(name);
    if (fail) reject(new Error(name)); else resolve(name);
  }, 5));
  const results = await Promise.allSettled([queue.run(step('a')), queue.run(step('b', true)), queue.run(step('c'))]);
  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.deepEqual(results.map((r) => r.status), ['fulfilled', 'rejected', 'fulfilled']);
  assert.equal(queue.pending, 0);
});

test('a sala na tela é a do servidor com as mudanças pendentes por cima, em ordem', () => {
  const chair = { id: 7, name: 'Cadeira', kind: 'chair', type: 3, sizeX: 1, sizeY: 1 };
  const floor = { id: 9, name: 'Piso', kind: 'decor', type: 0, sizeX: 1, sizeY: 1 };
  const server = { revision: 4, inventory: [{ unitId: 'u1', itemId: 7, placed: true, tx: 1, ty: 1, rotation: 0 }, { unitId: 'u2', itemId: 7, placed: true, tx: 3, ty: 3, rotation: 0 }] };
  const shown = projectRoom(server, [
    { id: 1, action: 'purchase', item: floor, tile: { tx: 2, ty: 2 }, rotation: 0 },
    { id: 2, action: 'move', item: chair, unitId: 'u1', tile: { tx: 4, ty: 1 }, rotation: 2 },
    { id: 3, action: 'store', item: chair, unitId: 'u2', rotation: 0 },
  ]);
  assert.deepEqual(shown.inventory.map(({ unitId, placed, tx, ty, rotation }) => [unitId, placed, tx, ty, rotation]), [
    ['u1', true, 4, 1, 2], ['u2', false, 3, 3, 0], ['pending:1', true, 2, 2, 0],
  ]);
  assert.equal(shown.revision, 4);
  assert.deepEqual(server.inventory[0], { unitId: 'u1', itemId: 7, placed: true, tx: 1, ty: 1, rotation: 0 });
  const sold = projectRoom(server, [{ id: 4, action: 'sell', item: chair, unitId: 'u2', rotation: 0 }]);
  assert.deepEqual(sold.inventory.map((unit) => unit.unitId), ['u1']);
});

test('encomendas: pedido, pressa, coleta e descarte aparecem na hora', () => {
  const now = 1_000_000;
  const kinds = [{ id: 'small', name: 'Pequena', seconds: 60, quantity: 5, gold: 50, level: 1, rushGranas: 2 }];
  const snapshot = { serverNow: now, slots: 2, kinds, orders: [], playerState: { ...state(100), crates: { current: 2, maximum: 4 } }, saveGranas: 3, collectEnergy: 5 };
  const ordered = predictSupply(snapshot, 'order', { kind: 'small' }, now);
  assert.deepEqual(ordered.delta, { gold: -50 });
  assert.deepEqual(ordered.snapshot.orders.map(({ slot, quantity, arrivesAt }) => [slot, quantity, arrivesAt]), [[0, 5, now + 60_000]]);
  const order = { id: 'o1', slot: 1, kind: 'small', quantity: 5, arrivesAt: now + 30_000, spoilsAt: now + 90_000 };
  const rushed = predictSupply({ ...snapshot, orders: [order] }, 'rush', { orderId: 'o1' }, now);
  assert.deepEqual([rushed.delta, rushed.snapshot.orders[0].arrivesAt], [{ cash: -2 }, now]);
  const collected = predictSupply({ ...snapshot, orders: [{ ...order, arrivesAt: now - 1 }] }, 'collect', { orderId: 'o1' }, now);
  assert.deepEqual([collected.delta, collected.snapshot.orders[0].quantity], [{ crates: 2, energy: -5 }, 3]);
  assert.equal(predictSupply({ ...snapshot, orders: [order] }, 'discard', { orderId: 'o1' }, now).snapshot.orders.length, 0);
  // Without gold, a free slot or a known order the screen waits for the server instead.
  assert.equal(predictSupply({ ...snapshot, playerState: state(10) }, 'order', { kind: 'small' }, now), undefined);
  assert.equal(predictSupply({ ...snapshot, slots: 1, orders: [{ ...order, slot: 0 }] }, 'order', { kind: 'small' }, now), undefined);
  assert.equal(snapshot.orders.length, 0);
});

test('piso pintado por cima de outro guarda o antigo, como no servidor', () => {
  const floor = { id: 9, name: 'Piso', kind: 'decor', type: 0, sizeX: 1, sizeY: 1 };
  const server = { revision: 1, catalog: [floor], inventory: [{ unitId: 'f1', itemId: 9, placed: true, tx: 2, ty: 2, rotation: 0 }, { unitId: 'f2', itemId: 9, placed: true, tx: 3, ty: 2, rotation: 0 }] };
  const shown = projectRoom(server, [{ id: 1, action: 'purchase', item: floor, tile: { tx: 2, ty: 2 }, rotation: 0 }]);
  assert.deepEqual(shown.inventory.map((unit) => [unit.unitId, unit.placed]), [['f1', false], ['f2', true], ['pending:1', true]]);
});

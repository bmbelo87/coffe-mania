import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({ entryPoints: ['game/src/game/level-rewards.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { LevelRewardQueue } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const reward = level => ({ level, gold: 700, waiters: 0, waiterSlots: 1, recipes: [] });

test('Snapshots repetidos preservam a fila ordenada sem repetir avisos já fechados', () => {
  const queue = new LevelRewardQueue();
  queue.add([reward(4), reward(2), reward(3)]);
  queue.add([reward(2), reward(3), reward(4)]);
  assert.equal(queue.current.level, 2);
  queue.dismiss(4);
  assert.equal(queue.current.level, 2);
  queue.dismiss(2);
  queue.add([reward(2), reward(3), reward(4)]);
  assert.equal(queue.current.level, 3);
  queue.dismiss(3);
  assert.equal(queue.current.level, 4);
  queue.dismiss(4);
  assert.equal(queue.current, undefined);
});

test('Novos níveis entram depois dos pendentes e não dependem de delta local de XP', () => {
  const queue = new LevelRewardQueue();
  queue.add([reward(7)]);
  queue.add([reward(8), reward(9)]);
  assert.equal(queue.current.level, 7);
  queue.dismiss(7);
  assert.equal(queue.current.level, 8);
  queue.dismiss(8);
  assert.equal(queue.current.level, 9);
});

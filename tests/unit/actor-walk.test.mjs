import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

await mkdir('.runtime/tests', { recursive: true });
const outfile = path.resolve('.runtime/tests/actor-walk.mjs');
const result = await build({
  stdin: { contents: "export { Actor, TILE_STEP_MS } from './game/src/world/Actor';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, outfile, packages: 'external',
});
await writeFile(outfile, result.outputFiles[0].text);
const { Actor, TILE_STEP_MS } = await import(pathToFileURL(outfile));

const route = [{ tx: 2, ty: 1 }, { tx: 3, ty: 1 }, { tx: 4, ty: 1 }, { tx: 5, ty: 1 }];

function walk(frameMs, totalMs) {
  const actor = new Actor();
  actor.setTilePosition(1, 1);
  actor.setMovePath(route);
  for (let elapsed = 0; elapsed < totalMs; elapsed += frameMs) actor.tick(Math.min(frameMs, totalMs - elapsed));
  return actor;
}

test('quadros longos não atrasam a caminhada: o tempo que sobra passa para o passo seguinte', () => {
  const smooth = walk(16, TILE_STEP_MS * 2.5);
  const slow = walk(500, TILE_STEP_MS * 2.5);
  assert.ok(Math.abs(smooth.x - slow.x) < 0.5 && Math.abs(smooth.y - slow.y) < 0.5, `${smooth.x},${smooth.y} × ${slow.x},${slow.y}`);
  assert.deepEqual([slow.tileX, slow.tileY], [smooth.tileX, smooth.tileY]);
});

test('a rota termina no destino com o tempo exato', () => {
  for (const frame of [16, 120, 1000, 5000]) {
    const actor = walk(frame, TILE_STEP_MS * 4 + 1);
    assert.deepEqual([actor.tileX, actor.tileY, actor.moving, actor.reachedPathEnd()], [5, 1, false, true], `quadro ${frame} ms`);
  }
  const early = walk(16, TILE_STEP_MS * 4 - 50);
  assert.equal(early.moving, true);
});

test('a hitbox troca de tile na metade do passo', () => {
  const before = walk(16, TILE_STEP_MS * 0.45);
  const after = walk(16, TILE_STEP_MS * 0.55);
  assert.deepEqual([before.tileX, after.tileX], [1, 2]);
});

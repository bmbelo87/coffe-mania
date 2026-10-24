import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Sprite, Texture, TextureSource, Point } from 'pixi.js';

const built = await build({ entryPoints: ['game/src/screens/room/scenery-shadow.ts'], bundle: true,
  write: false, format: 'esm', platform: 'node', external: ['pixi.js'] });
const code = built.outputFiles[0].text.replaceAll('"pixi.js"', JSON.stringify(import.meta.resolve('pixi.js')));
const { createSceneryShadow, expandContactPolygon } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

// Independent measurements from the shoes and stake base, not the canvas center/bottom.
for (const sample of [
  { kind: 'vendor', size: [400, 640], anchor: [200, 628], scale: .5, contact: [226, 620], expected: [13, -4] },
  { kind: 'land-sign', size: [476, 616], anchor: [0, 0], scale: 1 / 3, contact: [238, 582], expected: [0, -10], offset: [-238 / 3, -204] },
]) {
  for (const mirror of [1, -1]) {
    const art = new Sprite(new Texture({ source: new TextureSource({ width: sample.size[0], height: sample.size[1] }) }));
    art.anchor.set(sample.anchor[0] / sample.size[0], sample.anchor[1] / sample.size[1]);
    art.scale.set(sample.scale * mirror, sample.scale);
    art.position.set(100 + (sample.offset?.[0] ?? 0), 200 + (sample.offset?.[1] ?? 0));
    const origin = { x: 73, y: -19 };
    const shadow = createSceneryShadow(sample.kind, art, origin);
    const b = shadow.getLocalBounds();
    const localCenter = new Point((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
    const actual = shadow.toGlobal(localCenter);
    const expected = art.toGlobal(new Point(sample.contact[0] - sample.anchor[0], sample.contact[1] - sample.anchor[1]));
    close(actual.x, expected.x + origin.x); close(actual.y, expected.y + origin.y);
    if (mirror === 1) {
      close(actual.x, 100 + origin.x + sample.expected[0]);
      close(actual.y, 200 + origin.y + sample.expected[1]);
    }
    shadow.destroy(); art.destroy({ texture: true, textureSource: true });
  }
}

const contacts = [[122.5, 545], [296.5, 627], [682, 475], [508, 393]];
const expanded = expandContactPolygon(contacts, 14);
for (let i = 0; i < contacts.length; i++) {
  const j = (i + 1) % contacts.length;
  const dx = contacts[j][0] - contacts[i][0], dy = contacts[j][1] - contacts[i][1];
  const ex = expanded[j * 2] - expanded[i * 2], ey = expanded[j * 2 + 1] - expanded[i * 2 + 1];
  close((dx * ey - dy * ex) / Math.hypot(dx, dy), 0);
  close((-dy * (expanded[i * 2] - contacts[i][0]) + dx * (expanded[i * 2 + 1] - contacts[i][1])) / Math.hypot(dx, dy), 14);
}
const sign = new Sprite(new Texture({ source: new TextureSource({ width: 600, height: 560 }) }));
sign.anchor.set(314 / 600, 478 / 560); sign.scale.set(.375);
const signShadow = createSceneryShadow('expansion-sign', sign);
const signBounds = signShadow.getLocalBounds();
close(signBounds.minX, 175 - 44 - 314); close(signBounds.maxX, 450 + 44 - 314);
close(signBounds.minY, 385 - 22 - 478); close(signBounds.maxY, 536 + 22 - 478);
assert.ok(signShadow.containsPoint({ x: 175 - 314, y: 385 - 478 }));
assert.ok(signShadow.containsPoint({ x: 450 - 314, y: 536 - 478 }));
assert.equal(signShadow.containsPoint({ x: 0, y: 0 }), false, 'the gap between stakes must not receive a floating oval');
signShadow.destroy(); sign.destroy({ texture: true, textureSource: true });
console.log('Scenery contacts: measured centers, frame offsets, mirroring and parallel stall footprint: OK');

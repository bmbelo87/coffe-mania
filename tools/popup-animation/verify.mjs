import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Container, Texture, TextureSource } from 'pixi.js';

async function load(path) {
  const result = await build({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'node', external: ['pixi.js'] });
  const code = result.outputFiles[0].text.replaceAll('"pixi.js"', JSON.stringify(import.meta.resolve('pixi.js')));
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
const { PopupOpening } = await load('game/src/screens/room/PopupOpening.ts');
const { modalAnimationFrame } = await load('game/src/screens/room/ModalAnimation.ts');
const parent = new Container(), before = new Container(), content = new Container(), after = new Container(), backdrop = new Container();
content.position.set(100, 200); content.pivot.set(5, 9); content.scale.set(1.85);
parent.addChild(before, content, after);
const original = content.toGlobal({ x: 17, y: 29 });
const popup = new PopupOpening(content, 960, 540, backdrop);
assert.deepEqual(parent.children, [before, popup.view, after]);
for (let cycle = 0; cycle < 3; cycle++) {
  popup.open();
  let elapsed = 0;
  for (const delta of [0, 60, 80, 60, 60]) {
    elapsed += delta; popup.update(delta);
    const frame = modalAnimationFrame('opening', elapsed);
    assert.equal(popup.view.scale.x, frame.scale);
    assert.equal(popup.view.alpha, frame.alpha);
  }
  assert.deepEqual(content.toGlobal({ x: 17, y: 29 }), original);
  assert.equal(content.scale.x, 1.85);
  popup.setCenter(800, 450);
  assert.deepEqual(content.toGlobal({ x: 17, y: 29 }), original);
}
const { ThoughtBubble } = await load('game/src/screens/room/ThoughtBubble.ts');
const texture = (width, height) => new Texture({ source: new TextureSource({ width, height }) });
const art = { oval: texture(512, 281), dotLarge: texture(96, 95), dotSmall: texture(96, 95) };
let activated = 0, stopped = false;
const bubble = new ThoughtBubble(art, () => activated++);
const icon = bubble.view.children[3];
const tall = texture(40, 100), wide = texture(200, 50);
bubble.setIcon(tall); assert.equal(icon.height, 86); assert.equal(icon.width, 34.4);
bubble.setIcon(wide); assert.equal(icon.width, 76); assert.equal(icon.height, 19);
bubble.setIcon(); assert.equal(icon.visible, false);
for (const y of [-105, -33, -8]) assert.equal(bubble.view.hitArea.contains(0, y), true);
assert.equal(bubble.view.hitArea.contains(0, -47), false);
bubble.view.emit('pointertap', { stopPropagation() { stopped = true; } });
assert.equal(activated, 1); assert.equal(stopped, true);
bubble.destroy();
for (const part of Object.values(art)) assert.equal(part.destroyed, false);
assert.equal(tall.destroyed, false); assert.equal(wide.destroyed, false);
console.log('OK: curva compartilhada, três reaberturas, layout preservado, ícones proporcionais, clique e texturas reutilizáveis.');

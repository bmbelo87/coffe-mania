import { Application, Assets, Rectangle, Sprite, Texture, Text } from 'pixi.js';
import { ThoughtBubble } from '../src/screens/room/ThoughtBubble';
import { loadThoughtBubbleArt } from '../src/game/thought-bubble';
import { loadJuiceArt } from '../src/game/juices';

const app = new Application();
await app.init({ width: 1100, height: 650, background: '#e7ddc8', antialias: true, preserveDrawingBuffer: true });
document.body.append(app.canvas);
const [art, juices, atlas, baked] = await Promise.all([
  loadThoughtBubbleArt(), loadJuiceArt(), Assets.load('/assets/avatar/placeholder/starter-atlas.png'),
  fetch('/assets/avatar/placeholder/starter-atlas.json').then(response => response.json()),
]);
const cell = baked.cells.find(cell => cell.clip === 2 && cell.direction === 1) ?? baked.cells[0];
const avatarTexture = new Texture({ source: atlas.source, frame: new Rectangle(cell.x, cell.y, baked.cell, baked.cell) });
const bubbles = [];
let clicks = 0;
for (const [index, id] of ['orange', 'grape', null].entries()) {
  const x = 220 + index * 330, y = 475;
  const avatar = new Sprite(avatarTexture);
  avatar.anchor.set(baked.ground.x / baked.cell, baked.ground.y / baked.cell);
  avatar.scale.set(baked.scale * .9); avatar.position.set(x, y); app.stage.addChild(avatar);
  const bubble = new ThoughtBubble(art, () => { clicks++; });
  bubble.setIcon(id ? juices.textures.get(id) : undefined);
  bubble.view.position.set(x, y - 155); app.stage.addChild(bubble.view); bubbles.push(bubble);
  const label = new Text({ text: id ? juices.recipes.find(recipe => recipe.id === id).name : 'Moldura reutilizável', style: { fontSize: 20, fill: '#603a1e' } });
  label.anchor.set(.5); label.position.set(x, 550); app.stage.addChild(label);
}
window.bubblePreview = { app, bubbles, juices, clicks: () => clicks };

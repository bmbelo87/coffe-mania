import { AvatarRenderer } from '../src/avatar/AvatarRenderer';
import { bakeAvatar } from '../src/avatar/AvatarBaker';
import { PLAYER_ROOM_CLIPS } from '../src/avatar/bake';
import { AVATAR_URLS, loadAvatarAssets } from '../src/game/asset-manifest';
import { starterLook, STARTER_PARTS } from '../src/avatar/starter-look';
import { resolveLook } from '../src/avatar/wardrobe';

const { wardrobe, atlas, atlasImage } = await loadAvatarAssets();
const look = starterLook(wardrobe);
const renderer = await AvatarRenderer.create({
  modelUrl: AVATAR_URLS.model, atlas, atlasImage,
  size: 512, unlit: true, preserveDrawingBuffer: true,
});
const missing = renderer.setLook(resolveLook(wardrobe, look));
if (missing.length) throw new Error(`Texturas ausentes: ${missing.join(', ')}`);

const baked = bakeAvatar(renderer, { clips: PLAYER_ROOM_CLIPS, cell: 256 });
const metadata = {
  version: 1, name: 'Café Mania — personagem inicial',
  objects: resolveLook(wardrobe, look).objects,
  width: baked.canvas.width, height: baked.canvas.height, cell: baked.cell,
  ground: baked.ground, scale: baked.scale, cells: baked.cells,
};
const preview = document.createElement('canvas');
preview.width = 5 * 256; preview.height = 2 * 256;
const context = preview.getContext('2d');
for (let direction = 0; direction < 8; direction++) {
  renderer.setDirection(direction); renderer.setFrame(20); renderer.render();
  context.drawImage(renderer.canvas, 0, 0, 512, 512, direction % 5 * 256, Math.floor(direction / 5) * 256, 256, 256);
}
document.querySelector('#preview').append(preview);
const actions = document.createElement('canvas');
actions.width = 6 * 256; actions.height = 256;
const actionContext = actions.getContext('2d');
for (const [column, clip] of PLAYER_ROOM_CLIPS.entries()) {
  const cell = baked.cells.find(value => value.clip === clip && value.direction === 1);
  actionContext.drawImage(baked.canvas, cell.x, cell.y, 256, 256, column * 256, 0, 256, 256);
}
document.querySelector('#preview').append(actions);
document.querySelector('#status').textContent = `${baked.cells.length} quadros: parado, andando, sentado, comendo, transportando e cozinhando. Prévia: direção 0–7, frame 20 (2 s), posição de referência (0, 0).`;
renderer.setDirection(0); renderer.setFrame(20); renderer.render();
// The menu icon is an authored faceless illustration, independent of the 3D bake.
const icon = document.createElement('canvas'); icon.width = 128; icon.height = 128;
const iconImage = new Image();
iconImage.src = '/assets/avatar/starter/hair-icon.png';
await iconImage.decode();
icon.getContext('2d').drawImage(iconImage, 0, 0, 128, 128);
window.starterAvatar = { icon: icon.toDataURL('image/png'), png: baked.canvas.toDataURL('image/png'), metadata, preview: preview.toDataURL('image/png'), actions: actions.toDataURL('image/png') };
document.querySelector('#export').disabled = false;
document.querySelector('#export').onclick = () => {
  for (const [name, href] of [['starter-atlas.png', window.starterAvatar.png],
    ['starter-atlas.json', 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(metadata, null, 2))]]) {
    const link = document.createElement('a'); link.download = name; link.href = href; link.click();
  }
};
const controls = document.createElement('div');
const live = document.createElement('div'); live.append(renderer.canvas);
for (const [group, id] of Object.entries(STARTER_PARTS)) {
  const label = document.createElement('label');
  label.textContent = group + ' ';
  const select = document.createElement('select'); select.id = 'part-' + group;
  for (const item of wardrobe.inGroup(group).filter(value => !value.invisible)) {
    const option = document.createElement('option'); option.value = item.id; option.textContent = item.name;
    option.selected = item.id === id; select.append(option);
  }
  select.onchange = () => {
    look.itemIds = look.itemIds.filter(value => wardrobe.slotOf(wardrobe.byId(value)) !== group);
    look.itemIds.push(Number(select.value));
    renderer.setLook(resolveLook(wardrobe, look)); renderer.render();
  };
  label.append(select); controls.append(label, document.createElement('br'));
}
for (const key of ['skinColour', 'hairColour']) {
  const label = document.createElement('label'); label.textContent = key === 'skinColour' ? 'Pele ' : 'Cabelo ';
  const input = document.createElement('input'); input.type = 'color'; input.id = key;
  input.value = '#' + look[key].toString(16).padStart(6, '0');
  input.oninput = () => { look[key] = parseInt(input.value.slice(1), 16); renderer.setLook(resolveLook(wardrobe, look)); renderer.render(); };
  label.append(input); controls.append(label);
}
document.querySelector('#preview').before(controls, live);
window.starterAvatar.getLook = () => structuredClone(look);
window.starterAvatar.getVisibleBounds = () => renderer.projectMeshBounds(20, 1);
window.addEventListener('pagehide', () => renderer.destroy(), { once: true });

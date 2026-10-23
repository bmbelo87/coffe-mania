import { Application } from 'pixi.js';
import { loadFonts } from '../src/core/fonts';
import { WaiterScreenModal } from '../src/screens/room/WaiterScreenModal';
import { createNpcAvatarSource } from '../src/avatar/NpcAvatarSource';

await loadFonts();
const app = new Application();
await app.init({ width: 1920, height: 1080, background: '#e7ddc8', antialias: true, preserveDrawingBuffer: true });
document.querySelector('main').append(app.canvas);
const { candidates, policy } = await fetch('./waiter-faces.json').then(response => response.json());
const state = { employees: [candidates[0]], candidates, unlockLevels: [1, 7, 15, 23, 31, 39, 47], slots: 2 };
const client = { async request(id) {
  if (id && !state.employees.some(employee => employee.id === id) && state.employees.length < state.slots) state.employees.push(candidates.find(employee => employee.id === id));
  return state;
} };
const source = await createNpcAvatarSource(policy);
const modal = new WaiterScreenModal(source, client);
app.stage.addChild(modal.view);
app.ticker.add(ticker => modal.update(ticker.deltaMS));
document.querySelector('#open').onclick = () => { void modal.open(); };
// Exercise the same card handlers through accessible fixture controls.
document.querySelector('#pick').onclick = () => {
  const button = modal.view.getChildByLabel('employee-button:Contratar', true);
  button?.emit('pointertap', { stopPropagation() {} });
};
document.querySelector('#hire').onclick = () => {
  const button = modal.view.getChildByLabel('employee-button:Contratar', true);
  button?.emit('pointertap', { stopPropagation() {} });
  document.querySelector('#result').textContent = 'Contratação simulada; os dados da conta foram preservados.';
};
await modal.open();

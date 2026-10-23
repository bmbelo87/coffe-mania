import { Application } from 'pixi.js';
import '@fontsource/fredoka/latin-700.css';
import { LevelUpModal } from '../src/screens/room/LevelUpModal';
import { JuiceScreenModal } from '../src/screens/room/JuiceScreenModal';
import { emptyPlayerState } from '../src/game/player-state';
import levels from '../../database/playerstate/levels.json';
import extras from '../../database/playerstate/level-extras.json';

await document.fonts.ready;
const app = new Application();
await app.init({ width: 1920, height: 1080, background: '#bbdce1', antialias: true, resolution: 1, preserveDrawingBuffer: true });
document.body.append(app.canvas);
const acknowledgements = [];
const modal = new LevelUpModal(async level => { acknowledgements.push(level); });
const recipes = (await (await fetch('/assets/foods/catalog.json')).json()).recipes;
function reward(level) {
  const slots = value => extras.waiterLevels.filter(minimum => minimum <= value).length;
  return { level, title: extras.titles[level], gold: levels.levels[level - 1].rewardGold,
    waiters: slots(level) - slots(level - 1), waiterSlots: slots(level),
    recipes: recipes.filter(recipe => recipe.inBook && recipe.level === level).map(({ id, name }) => ({ id, name })) };
}
const snapshot = { unlocked: true, stock: {}, mastery: {}, groups: ['basic', 'medium'], masteryServings: 100, playerState: emptyPlayerState(), evolutionStage: 1 };
const juice = new JuiceScreenModal({ refresh: async () => snapshot, act: async () => snapshot }, undefined, () => {});
app.stage.addChild(juice.view, modal.view);
app.ticker.add(ticker => { juice.update(ticker.deltaMS); modal.update(ticker.deltaMS); });
document.querySelector('#juice').onclick = () => { void juice.open('preview-machine'); };
document.querySelector('#level7').onclick = () => modal.sync([reward(7)]);
document.querySelector('#level80').onclick = () => modal.sync([reward(80)]);
document.querySelector('#multiple').onclick = () => modal.sync([reward(2), reward(3), reward(4)]);
window.uiPreview = { app, modal, juice, reward, acknowledgements };
if (new URLSearchParams(location.search).get('view') === 'juice') await juice.open('preview-machine');
else modal.sync([reward(Number(new URLSearchParams(location.search).get('level') || 80))]);

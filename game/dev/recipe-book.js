import { Application } from 'pixi.js';
import '@fontsource/fredoka/latin-700.css';
import { loadCookScreenTextures } from '../src/game/asset-manifest';
import { CookScreenModal } from '../src/screens/room/CookScreenModal';
import { emptyPlayerState } from '../src/game/player-state';

const app = new Application();
await app.init({ width: 1920, height: 1080, background: '#e7ddc8', antialias: true, preserveDrawingBuffer: true });
document.querySelector('main').append(app.canvas);
const textures = await loadCookScreenTextures();
await document.fonts.ready;
const state = { ...emptyPlayerState(), gold: 100000, level: 60 };
const output = document.querySelector('#result');
const modal = new CookScreenModal({ textures, playerState: state, sfxUrls: [], onCookRecipe: recipe => {
  output.textContent = `Selecionado: ${recipe.name}`;
} });
app.stage.addChild(modal.view);
app.ticker.add(ticker => modal.update(ticker.deltaMS));
document.querySelector('#open').onclick = () => modal.open();
document.querySelector('#level').onchange = event => {
  state.level = Number(event.target.value);
  modal.close();
  setTimeout(() => modal.open(), 500);
};
output.textContent = `${textures.recipes.filter(recipe => recipe.inBook).length} receitas carregadas`;
for (const recipe of textures.recipes.filter(recipe => recipe.inBook)) {
  const figure = document.createElement('figure');
  const image = document.createElement('img');
  image.src = `/assets/foods/${recipe.id}/stage_2.png`;
  image.alt = recipe.name;
  const caption = document.createElement('figcaption');
  caption.textContent = recipe.name;
  figure.append(image, caption);
  document.querySelector('#dishes').append(figure);
}
modal.open();

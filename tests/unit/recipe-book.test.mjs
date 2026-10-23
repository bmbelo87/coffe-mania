import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from 'esbuild';

const source = await build({ stdin: { contents: "export { recipeBlockReason } from './game/src/game/recipes';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false,
  define: { 'import.meta.env.BASE_URL': JSON.stringify('/'), 'document.baseURI': JSON.stringify('http://localhost/') },
  plugins: [{ name: 'unused-pixi', setup(b) { b.onResolve({ filter: /^pixi\.js$/ }, () => ({ path: 'pixi', namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const Assets = {};', loader: 'js' })); } }] });
const { recipeBlockReason } = await import('data:text/javascript;base64,' + Buffer.from(source.outputFiles[0].text).toString('base64'));
const { recipes } = JSON.parse(fs.readFileSync('game/public/assets/foods/catalog.json', 'utf8'));

test('book keeps the observed opening order and separates eight advanced dishes', () => {
  const basic = recipes.filter(r => r.inBook && r.category === 'basic');
  assert.deepEqual(basic.slice(0, 6).map(r => r.id), ['nachos', 'x_tudo', 'passion_fruit_mousse', 'churrasco', 'pamonha', 'tacos_triplos']);
  assert.equal(basic.length, 12);
  assert.deepEqual(recipes.filter(r => r.category === 'advanced').map(r => r.id), ['super_a_la_minuta', 'carre_carneiro', 'torta_limao_vovo', 'lagosta_nobre', 'batatas_sorridentes', 'salmao_alcaparras', 'pimentao_recheado_chef', 'banana_split']);
});

test('level and currency both gate cooking; estimates remain machine-readable', () => {
  const banana = recipes.find(r => r.id === 'banana_split');
  assert.match(recipeBlockReason(banana, 56, 100000), /57/);
  assert.match(recipeBlockReason(banana, 57, 489), /insuficientes/);
  assert.equal(recipeBlockReason(banana, 57, 490), '');
  const provisional = recipes.filter(r => r.provisionalRules);
  assert.deepEqual(provisional.map(r => r.id).sort(), ['arroz_carreteiro', 'mandioquinha', 'quindim']);
  for (const recipe of provisional) for (const [field, rule] of Object.entries(recipe.provisionalRules)) {
    assert.equal(recipe[field], rule.value);
    assert.ok(rule.reason.length > 10);
  }
});

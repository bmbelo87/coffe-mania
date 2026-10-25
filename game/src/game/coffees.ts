import { Assets, Rectangle, Texture } from 'pixi.js';
import { loadNpcEmotionTextures, UI_PADLOCK_URL, UI_RESOURCE_ICON_URLS } from './asset-manifest';
import type { PlayerState } from './player-state';
import type { CoffeeGroup } from './coffee-model';
import { loadMachinePoses, type MachinePose, type MachinePoseSpec } from './machine-poses';
export { COFFEE_GROUPS, coffeeMastery, type CoffeeGroup } from './coffee-model';
export interface CoffeeRecipe {
  id: string; name: string; group: CoffeeGroup; file: string;
  energyCost: number; gold: number; xp: number; popularityTenths: number; masteryReward?: string;
}
export interface CoffeeMachine { machineId: string; recipeId: string; stage: number }
export interface CoffeeSnapshot {
  selected: Record<string, string>; mastery: Record<string, number>; groups: string[];
  masteryThresholds: readonly number[]; evolutionStage: number; playerState: PlayerState;
  rewards?: { recipeId: string; name: string; eligible: boolean; delivered: boolean; pending: boolean }[];
}
export interface CoffeeStage {
  poses: MachinePose[];
  stage: number; texture: Texture; previewTexture: Texture;
  frame: { file: string; width: number; height: number; left: number; top: number };
}

const assetUrl = (path: string) => new URL(path, new URL(import.meta.env.BASE_URL, document.baseURI)).href;
let machinePromise: Promise<CoffeeStage[]> | undefined;
export function loadCoffeeMachineArt(): Promise<CoffeeStage[]> {
  return machinePromise ??= (async () => {
    const root = assetUrl('assets/items/coffee_machine/stages/');
    const response = await fetch(new URL('catalog.json', root));
    if (!response.ok) throw new Error('Não foi possível carregar as cafeteiras.');
    const data = await response.json() as { stages: { stage: number; frame: CoffeeStage['frame']; poses?: MachinePoseSpec[] }[] };
    return Promise.all(data.stages.map(async ({ stage, frame, poses }) => ({ stage, frame,
      poses: await loadMachinePoses(root, frame, poses),
      texture: await Assets.load<Texture>(new URL(frame.file, root).href),
      previewTexture: await Assets.load<Texture>(new URL(`stage-${stage}.png`, root).href) })));
  })().catch(error => { machinePromise = undefined; throw error; });
}

let drinkPromise: Promise<{ recipes: CoffeeRecipe[]; textures: Map<string, Texture> }> | undefined;
export function loadCoffeeArt() {
  return drinkPromise ??= (async () => {
    const root = assetUrl('assets/coffees/');
    const response = await fetch(new URL('catalog.json', root));
    if (!response.ok) throw new Error('Não foi possível carregar os cafés.');
    const data = await response.json() as { recipes: CoffeeRecipe[] };
    const textures = new Map(await Promise.all(data.recipes.map(async recipe => [recipe.id,
      await Assets.load<Texture>(new URL(recipe.file, root).href)] as const)));
    return { recipes: data.recipes, textures };
  })().catch(error => { drinkPromise = undefined; throw error; });
}

export interface CoffeeInterfaceArt {
  panel: Texture; dominado: Texture; servindo: Texture; header: Texture; help: Texture; close: Texture; tab: Texture; tabActive: Texture; card: Texture; cardServing: Texture; cardReference: Texture; cardServingReference: Texture; portrait: Texture; body: Texture; machineWindow: Texture; evolutionWindow: Texture; button: Texture; lock: Texture;
  energy: Texture; gold: Texture; xp: Texture; popularity: Texture; machines: CoffeeStage[];
}
let interfacePromise: Promise<CoffeeInterfaceArt> | undefined;
export function loadCoffeeInterfaceArt(): Promise<CoffeeInterfaceArt> {
  return interfacePromise ??= (async () => {
    const [panel, dominado, servindo, header, help, close, tab, tabActive, card, cardServing, cardReference, cardServingReference, reference, machineWindow, evolutionWindow, button, icons, energy, lock, emotions, machines] = await Promise.all([
      Assets.load<Texture>(assetUrl('assets/ui/coffee-machine/panel.png')),
      Assets.load<Texture>(assetUrl('assets/ui/coffee-machine/dominado.png')),
      Assets.load<Texture>(assetUrl('assets/ui/coffee-machine/servindo.png')),
      Assets.load<Texture>(assetUrl('assets/ui/coffee-machine/header.png')),
      Assets.load<Texture>(assetUrl('assets/ui/coffee-machine/help.png')),
      Assets.load<Texture>(assetUrl('assets/ui/coffee-machine/close.png')),
      Assets.load<Texture>(assetUrl('assets/ui/coffee-machine/tab-inactive-v2.png')),
      Assets.load<Texture>(assetUrl('assets/ui/coffee-machine/tab-active-v2.png')),
      Assets.load<Texture>(assetUrl('assets/ui/coffee-machine/card.png')),
      Assets.load<Texture>(assetUrl('assets/ui/coffee-machine/card-serving.png')),
      Assets.load<Texture>(assetUrl('assets/ui/coffee-machine/card-reference.png')),
      Assets.load<Texture>(assetUrl('assets/ui/coffee-machine/card-serving-reference.png')),
      Assets.load<Texture>(assetUrl('assets/ui/coffee-machine/interface-reference.png')),
      Assets.load<Texture>(assetUrl('assets/ui/coffee-machine/machine-window.png')),
      Assets.load<Texture>(assetUrl('assets/ui/coffee-machine/evolution-window.png')),
      Assets.load<Texture>(assetUrl('assets/ui/coffee-machine/select-button.png')),
      Assets.load<Texture>(assetUrl('assets/ui/icon_bundle_1.png')),
      Assets.load<Texture>(UI_RESOURCE_ICON_URLS.energyRed), Assets.load<Texture>(UI_PADLOCK_URL),
      loadNpcEmotionTextures(), loadCoffeeMachineArt(),
    ]);
    return { panel, dominado, servindo, header, help, close, tab, tabActive, card, cardServing, cardReference, cardServingReference, portrait: new Texture({ source: card.source, frame: new Rectangle(20, 35, 112, 121) }), body: new Texture({ source: reference.source, frame: new Rectangle(34, 202, 4, 4) }), machineWindow, evolutionWindow, button, energy, lock, machines,
      gold: new Texture({ source: icons.source, frame: new Rectangle(360, 342, 314, 299) }),
      xp: new Texture({ source: icons.source, frame: new Rectangle(691, 273, 301, 382) }),
      popularity: emotions.satisfied[4]!,
    };
  })().catch(error => { interfacePromise = undefined; throw error; });
}

export { CoffeeClient } from './coffee-client';

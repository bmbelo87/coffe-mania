import { Assets, Rectangle, Texture } from 'pixi.js';
import type { PlayerState } from './player-state';
import { UI_PADLOCK_URL } from './asset-manifest';
import { loadMachinePoses, type MachinePose, type MachinePoseSpec } from './machine-poses';
export interface JuiceRecipe {
  id: string;
  name: string;
  group: 'basic' | 'medium' | 'tropical';
  file: string;
  energyCost: number;
  portions: number;
  gold: number;
  xp: number;
  popularityTenths: number;
  masteryReward: string;
}
export interface JuiceStock {
  machineId: string;
  recipeId: string;
  portions: number;
  unlocked: boolean;
  stage?: number;
}
export interface JuiceSnapshot {
  unlocked: boolean;
  stock: Record<string, {
    recipeId: string;
    portions: number;
  }>;
  mastery: Record<string, number>;
  groups: string[];
  masteryServings: number;
  playerState: PlayerState;
  evolutionStage?: number;
}

export interface JuiceMachineStage {
  poses: MachinePose[];
  stage: number;
  preview: Texture;
  texture: Texture;
  frame: { width: number; height: number; left: number; top: number };
}
let machineArtPromise: Promise<JuiceMachineStage[]> | undefined;
export function loadJuiceMachineArt(): Promise<JuiceMachineStage[]> {
  return machineArtPromise ??= (async () => {
    const base = new URL('assets/items/juice_machine/stages/', new URL(import.meta.env.BASE_URL, document.baseURI));
    const response = await fetch(new URL('catalog.json', base));
    if (!response.ok) throw Error('Não foi possível carregar as máquinas.');
    const data = await response.json() as { stages: Array<{ stage: number; preview: string; frame: JuiceMachineStage['frame'] & { file: string }; poses?: MachinePoseSpec[] }> };
    return Promise.all(data.stages.map(async item => {
      const [preview, texture] = await Promise.all([Assets.load<Texture>(new URL(item.preview, base).href), Assets.load<Texture>(new URL(item.frame.file, base).href)]);
      return { stage: item.stage, preview, texture, frame: item.frame, poses: await loadMachinePoses(base, item.frame, item.poses) };
    }));
  })().catch(error => { machineArtPromise = undefined; throw error; });
}
/** Empty modular pieces exported at 2x; sprites are sized to the logical measures in modular-v2/layout.json. */
export interface JuiceInterfaceParts {
  panel: Texture;
  panelFront: Texture;
  padlock: Texture;
  tabActive: Texture;
  tabInactive: Texture;
  tabLocked: Texture;
  machineWindow: Texture;
  evolutionBackground: Texture;
  evolutionTitle: Texture;
  evolutionSilhouette: Texture;
  card: Texture;
  cardServing: Texture;
  close: Texture;
}
export interface JuiceInterfaceArt {
  logo: Texture;
  parts: JuiceInterfaceParts;
  energy: Texture;
  gold: Texture;
  xp: Texture;
  machines: JuiceMachineStage[];
}
let interfaceArtPromise: Promise<JuiceInterfaceArt> | undefined;
export function loadJuiceInterfaceArt(): Promise<JuiceInterfaceArt> {
  return interfaceArtPromise ??= (async () => {
    const base = new URL(import.meta.env.BASE_URL, document.baseURI);
    const part = (name: string) => Assets.load<Texture>(new URL(`assets/ui/juice-machine/modular-v2/${name}@2x.png`, base).href);
    const [logo, partList, buttons, energy, icons, machines, padlock] = await Promise.all([
      Assets.load<Texture>(new URL('assets/ui/juice-machine/logo.png', base).href),
      Promise.all(['painel-vazio', 'aba-ativa', 'aba-inativa', 'aba-bloqueada', 'janela-maquina', 'evolucao-fundo', 'evolucao-titulo', 'evolucao-silhueta', 'linha-suco', 'linha-suco-servindo'].map(part)),
      Assets.load<Texture>(new URL('assets/ui/buttons_collection_1.png', base).href),
      Assets.load<Texture>(new URL('assets/ui/resource-icons/energy-blue.png', base).href),
      Assets.load<Texture>(new URL('assets/ui/icon_bundle_1.png', base).href),
      loadJuiceMachineArt(),
      Assets.load<Texture>(UI_PADLOCK_URL),
    ]);
    // Resource icons come from the current HUD atlas, preserving its generation.
    const gold = new Texture({ source: icons.source, frame: new Rectangle(360, 342, 314, 299) });
    const xp = new Texture({ source: icons.source, frame: new Rectangle(691, 273, 301, 382) });
    const [panel, tabActive, tabInactive, tabLocked, machineWindow, evolutionBackground, evolutionTitle, evolutionSilhouette, card, cardServing] = partList;
    const close = new Texture({ source: buttons.source, frame: new Rectangle(1206, 297, 227, 234) });
    const scale = panel.height / 508;
    // O corpo cobre a base das abas na mesma emenda da arte (y=119).
    const panelFront = new Texture({ source: panel.source, frame: new Rectangle(0, 119 * scale, panel.width, 389 * scale) });
    const parts = { panel, panelFront, padlock, tabActive, tabInactive, tabLocked, machineWindow, evolutionBackground, evolutionTitle, evolutionSilhouette, card, cardServing, close };
    return { logo, parts, energy, gold, xp, machines };
  })().catch(error => { interfaceArtPromise = undefined; throw error; });
}
let artPromise: Promise<{
  recipes: JuiceRecipe[];
  textures: Map<string, Texture>;
}> | undefined;
export function loadJuiceArt() {
  return artPromise ??= (async () => {
    const base = new URL('assets/juices/', new URL(import.meta.env.BASE_URL, document.baseURI));
    const response = await fetch(new URL('catalog.json', base));
    if (!response.ok)
      throw Error('Não foi possível carregar os sabores.');
    const data = await response.json() as {
      recipes: JuiceRecipe[];
    };
    const textures = new Map<string, Texture>(await Promise.all(data.recipes.map(async (recipe) => [recipe.id, await Assets.load<Texture>(new URL(recipe.file, base).href)] as const)));
    return { recipes: data.recipes, textures };
  })().catch(error => { artPromise = undefined; throw error; });
}
export class JuiceClient {
  async refresh(): Promise<JuiceSnapshot> { return this.read(await fetch('/api/coffe/juices', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) })); }
  async act(action: 'unlock' | 'prepare' | 'recharge' | 'serve', machineId: string, extra: {
    recipeId?: string;
    actorId?: string;
    juiceRequestId?: string;
  } = {}): Promise<JuiceSnapshot> {
    return this.read(await fetch('/api/coffe/juices/' + action, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ machineId, requestId: crypto.randomUUID(), ...extra }), signal: AbortSignal.timeout(12000) }));
  }
  private async read(response: Response): Promise<JuiceSnapshot> { const body = await response.json() as JuiceSnapshot & {
    message?: string;
  }; if (!response.ok)
    throw Error(body.message ?? 'Não foi possível atualizar os sucos.'); return body; }
}

import { Assets, type Texture } from 'pixi.js';
import { UI_THOUGHT_BUBBLE_URLS } from './asset-manifest';

export interface ThoughtBubbleArt { oval: Texture; dotLarge: Texture; dotSmall: Texture }
let pending: Promise<ThoughtBubbleArt> | undefined;

/** Moldura compartilhada; a bebida ou outro conteúdo não é incorporado à arte. */
export function loadThoughtBubbleArt(): Promise<ThoughtBubbleArt> {
  return pending ??= Promise.all([
    Assets.load<Texture>(UI_THOUGHT_BUBBLE_URLS.oval),
    Assets.load<Texture>(UI_THOUGHT_BUBBLE_URLS.dotLarge),
    Assets.load<Texture>(UI_THOUGHT_BUBBLE_URLS.dotSmall),
  ]).then(([oval, dotLarge, dotSmall]) => ({ oval, dotLarge, dotSmall }))
    .catch(error => { pending = undefined; throw error; });
}

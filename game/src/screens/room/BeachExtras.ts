import { Assets, Container, Sprite, type Texture } from 'pixi.js';

/**
 * Figurantes da orla da cidade: o sorveteiro com o carrinho e o banhista com picolé, parados
 * na areia como no original (vídeo "cafe mania muito tempo de jogo", 1:54, e quadro 005).
 * São só decoração do cliente: não entram na navegação, no servidor nem no clique.
 */

/**
 * Apoio no chão de cada arte (`scenery/beach-extras/registration.json`) e posição em
 * coordenadas do cenário, antes do deslocamento da parede. As posições vêm do quadro de 1:54
 * levado para o nosso cenário pelo letreiro e pelo degrau do píer e pela boia; a escala, da
 * altura deles no vídeo (62 e 82 px, com 1 px = 2,39 px do mundo).
 */
const EXTRAS = {
  vendor: { file: 'ice-cream-vendor-flat.png', anchor: { x: 311.5, y: 600 }, scale: 0.32, at: { x: -730, y: 190 } },
  bather: { file: 'bather-flat.png', anchor: { x: 125.5, y: 472 }, scale: 0.31, at: { x: -1000, y: 250 } },
} as const;

export interface BeachProp {
  /** Ground line of the prop in scene coordinates (already offset like its view). */
  footY: number;
  zIndex: number;
}

let texturesPromise: Promise<Record<keyof typeof EXTRAS, Texture>> | undefined;
export function loadBeachExtrasArt(): Promise<Record<keyof typeof EXTRAS, Texture>> {
  const base = new URL('assets/scenery/beach-extras/', new URL(import.meta.env.BASE_URL ?? '/', document.baseURI));
  return texturesPromise ??= Promise.all([EXTRAS.vendor.file, EXTRAS.bather.file].map((file) => Assets.load<Texture>(new URL(file, base).href)))
    .then(([vendor, bather]) => ({ vendor, bather }))
    .catch((error: unknown) => { texturesPromise = undefined; throw error; });
}

/**
 * The scene keeps the painter order of `scene.json`; each extra slips in just above the last
 * standing prop whose ground line is behind its feet.
 */
export function createBeachExtras(
  textures: Record<keyof typeof EXTRAS, Texture>,
  props: readonly BeachProp[],
  offset: { x: number; y: number },
  groundZ: number,
): Container[] {
  return (Object.keys(EXTRAS) as (keyof typeof EXTRAS)[]).map((kind) => {
    const piece = EXTRAS[kind], texture = textures[kind];
    const sprite = new Sprite(texture);
    sprite.label = `beach-extra-${kind}`;
    sprite.anchor.set(piece.anchor.x / texture.width, piece.anchor.y / texture.height);
    sprite.scale.set(piece.scale);
    sprite.eventMode = 'none';
    const footY = piece.at.y + offset.y;
    sprite.position.set(piece.at.x + offset.x, footY);
    let z = groundZ;
    for (const prop of props) if (prop.footY <= footY) z = Math.max(z, prop.zIndex);
    sprite.zIndex = z + 0.5 + footY / 1e6;
    return sprite;
  });
}

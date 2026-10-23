import { Assets, Container, Sprite, type Texture } from 'pixi.js';

import { UI_CAFE_SCENERY_URLS } from '../../game/asset-manifest';
import { tileToScreenX, tileToScreenY } from '../../world/iso';

export interface CafeSceneryArt {
  expansionSign: Texture;
  noParkingSign: Texture;
  barrier: Texture;
  slab: Texture;
  curb: Texture;
}

let pending: Promise<CafeSceneryArt> | undefined;

/** Placa "Expansão à venda" e peças do estacionamento (registro dos apoios nos `registration.json`). */
export function loadCafeSceneryArt(): Promise<CafeSceneryArt> {
  const urls = UI_CAFE_SCENERY_URLS;
  return pending ??= Promise.all([urls.expansionSign, urls.noParkingSign, urls.barrier, urls.slab, urls.curb].map((url) => Assets.load<Texture>(url)))
    .then(([expansionSign, noParkingSign, barrier, slab, curb]) => ({ expansionSign, noParkingSign, barrier, slab, curb }))
    .catch((error: unknown) => { pending = undefined; throw error; });
}

/** Apoio no chão de cada arte, em pixels da imagem (ver os `registration.json`). */
const ANCHORS = {
  expansionSign: { x: 314, y: 478, size: { width: 600, height: 560 } },
  noParkingSign: { x: 254, y: 454, size: { width: 512, height: 512 } },
  barrier: { x: 255, y: 303, size: { width: 512, height: 512 } },
  slab: { x: 256, y: 256, size: { width: 512, height: 512 } },
  curb: { x: 256, y: 255, size: { width: 512, height: 512 } },
} as const;

export const EXPANSION_SIGN_SCALE = 0.375;
/** Lado do estacionamento em tiles; cada ladrilho cobre 2x2. */
export const PARKING_SIZE = 4;

/** Sprite com o apoio no ponto da grade (tx, ty). `mirror` usa a outra diagonal isométrica. */
export function groundSprite(texture: Texture, piece: keyof typeof ANCHORS, tx: number, ty: number, scale = 1, mirror = false): Sprite {
  const anchor = ANCHORS[piece];
  const sprite = new Sprite(texture);
  sprite.anchor.set(anchor.x / anchor.size.width, anchor.y / anchor.size.height);
  sprite.scale.set(mirror ? -scale : scale, scale);
  sprite.position.set(tileToScreenX(tx, ty), tileToScreenY(tx, ty));
  sprite.eventMode = 'none';
  return sprite;
}

export interface ParkingPieces {
  /** Ladrilhos e bordas: ficam no chão, abaixo dos móveis e dos personagens. */
  ground: Container[];
  /** Barreiras e placa: ordenadas pela profundidade do tile em que se apoiam. */
  standing: Array<{ view: Sprite; tx: number; ty: number }>;
}

/**
 * Estacionamento do original (vídeo de ~2013, quadro 003; "Encomenda de Suprimentos", 2014): quatro
 * ladrilhos de concreto, borda zebrada nos três lados de grama, barreiras brancas na frente e a
 * placa "E" junto da entrada. O lado ty = y0 fica aberto para a calçada.
 */
export function buildParking(art: CafeSceneryArt, x0: number, y0: number): ParkingPieces {
  const n = PARKING_SIZE;
  const ground: Container[] = [];
  for (const dx of [1, 3]) for (const dy of [1, 3]) ground.push(groundSprite(art.slab, 'slab', x0 + dx, y0 + dy));
  ground.push(
    groundSprite(art.curb, 'curb', x0, y0 + n / 2),
    groundSprite(art.curb, 'curb', x0 + n, y0 + n / 2),
    groundSprite(art.curb, 'curb', x0 + n / 2, y0 + n, 1, true),
  );
  const standing: ParkingPieces['standing'] = [];
  for (const dy of [1, 3]) standing.push({ view: groundSprite(art.barrier, 'barrier', x0 + n + 0.3, y0 + dy, 0.5), tx: x0 + n, ty: y0 + dy });
  for (const dx of [1, 3]) standing.push({ view: groundSprite(art.barrier, 'barrier', x0 + dx, y0 + n + 0.3, 0.5, true), tx: x0 + dx, ty: y0 + n });
  standing.push({ view: groundSprite(art.noParkingSign, 'noParkingSign', x0 + n + 0.6, y0 + 0.2, 0.5), tx: x0 + n, ty: y0 });
  return { ground, standing };
}

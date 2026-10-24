import { Assets, Container, Sprite, type Texture } from 'pixi.js';

import { UI_CAFE_SCENERY_URLS } from '../../game/asset-manifest';
import { tileToScreenX, tileToScreenY } from '../../world/iso';
import { createSceneryShadow } from './scenery-shadow';
import { createParkingPlatformView } from './ParkingPlatform';

export interface CafeSceneryArt {
  expansionSign: Texture;
  noParkingSign: Texture;
  barrier: Texture;
  platform: Texture;
  entry: Texture;
  stall: Texture;
  vendor: Texture;
}

let pending: Promise<CafeSceneryArt> | undefined;

/** Placa "Expansão à venda", plataforma de encomendas e barraca de feira (apoios nos `registration.json`). */
export function loadCafeSceneryArt(): Promise<CafeSceneryArt> {
  const urls = UI_CAFE_SCENERY_URLS;
  return pending ??= Promise.all([urls.expansionSign, urls.noParkingSign, urls.barrier, urls.platform, urls.entry, urls.stall, urls.vendor]
    .map((url) => Assets.load<Texture>(url)))
    .then(([expansionSign, noParkingSign, barrier, platform, entry, stall, vendor]) => ({ expansionSign, noParkingSign, barrier, platform, entry, stall, vendor }))
    .catch((error: unknown) => { pending = undefined; throw error; });
}

/** Apoio no chão de cada arte, em pixels da imagem (ver os `registration.json`). */
const ANCHORS = {
  expansionSign: { x: 314, y: 478, size: { width: 600, height: 560 } },
  noParkingSign: { x: 254, y: 454, size: { width: 512, height: 512 } },
  barrier: { x: 255, y: 353, size: { width: 512, height: 562 } },
  platform: { x: 640, y: 2, size: { width: 1280, height: 640 } },
  entry: { x: 184.5, y: 444, size: { width: 960, height: 560 } },
  stall: { x: 400, y: 628, size: { width: 800, height: 640 } },
  vendor: { x: 200, y: 628, size: { width: 400, height: 640 } },
} as const;

export const EXPANSION_SIGN_SCALE = 0.375;
/** Lado da plataforma em tiles: no vídeo ela mede 4,15 tiles; a arte de 1280 px cobre isso na escala 0,52. */
export const PLATFORM_SIZE = 4.16;
/**
 * Posições medidas no vídeo "Testando o Game" (4:36, café novo 6x9 sem a loja aberta), em tiles a
 * partir do canto direito do piso, onde termina a parede da porta (tx = tilesX, ty = 1). A grade
 * foi ajustada pelos cantos do piso; o erro de medida fica em torno de 0,2 tile.
 */
export const CAFE_SCENERY_LAYOUT = {
  /** Canto de trás da plataforma: um tile além da borda da frente, rente à linha da parede da porta. */
  platform: { dx: 1.05, dy: 0.35 },
  noParkingSign: { dx: 0.65, dy: -0.1 },
  /**
   * Barreiras pelo ponto entre os pés, relativas ao canto da plataforma (quadro ampliado 8x): duas
   * logo antes da borda do lado do café e duas a 0,8 tile da borda da frente-direita.
   */
  barriers: [
    { dx: -0.2, dy: 1.15 }, { dx: -0.2, dy: 3.2 },
    { dx: 4.97, dy: 1.25 }, { dx: 4.97, dy: 3.35 },
  ],
  /** Barraca pela base da perna da frente e vendedora pelos pés, relativas ao canto da plataforma. */
  stall: { dx: 4.2, dy: 9.7 },
  vendor: { dx: 4.6, dy: 8 },
  /** Placa "Expansão à venda" na frente da borda esquerda da plataforma (vídeo "Café mania 4"). */
  expansionSign: { dx: 0.8, dy: 5.4 },
} as const;
const PLATFORM_SCALE = 0.52;
/** Os pés de cada barreira ficam 1,3 tile afastados no vídeo; na arte, 294 px. */
const BARRIER_SCALE = 0.36;
/** A borda da entrada que encosta na plataforma tem 351 px de arte e cobre 2 tiles. */
const ENTRY_SCALE = 160 / 351;
/** Barraca e vendedora na altura medida no vídeo (a barraca tem cerca de 2 tiles de largura). */
const STALL_SCALE = 0.5;

/**
 * Vagas das encomendas: as quatro lajes pequenas no canto de trás da plataforma, junto da entrada
 * (vídeo "Testando o Game", 5:06). Centros medidos na arte da plataforma, em tiles a partir do
 * canto (x0, y0); a vaga 0 é a de trás, a 3 a da frente.
 */
export const PLATFORM_SLOTS: readonly { dx: number; dy: number }[] = [
  { dx: 0.58, dy: 0.58 }, { dx: 1.51, dy: 0.59 }, { dx: 0.58, dy: 1.52 }, { dx: 1.52, dy: 1.53 },
];

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

export interface SceneryPieces {
  /** Piso, entrada e sombras de contato: abaixo dos móveis e dos personagens. */
  ground: Container[];
  /** Barreiras, placa e barraca: ordenadas pela profundidade do tile em que se apoiam. */
  standing: Array<{ view: Sprite; tx: number; ty: number }>;
}

/**
 * Plataforma de encomendas do café novo (vídeo "Testando o Game", 5:06): piso 4x4 com as vagas
 * no canto de trás, entrada de asfalto até a rua com setas e barreira zebrada, barreiras brancas
 * na borda do lado do café e na borda da frente, e a placa "E" na quina junto da calçada.
 */
export function buildPlatform(art: CafeSceneryArt, x0: number, y0: number): SceneryPieces {
  const layout = CAFE_SCENERY_LAYOUT;
  const platform = createParkingPlatformView(art.platform);
  platform.pivot.set(ANCHORS.platform.x, ANCHORS.platform.y);
  platform.scale.set(PLATFORM_SCALE);
  platform.position.set(tileToScreenX(x0, y0), tileToScreenY(x0, y0));
  const ground: Container[] = [
    platform,
    groundSprite(art.entry, 'entry', x0 + 1, y0, ENTRY_SCALE),
  ];
  const standing: SceneryPieces['standing'] = [];
  for (const { dx, dy } of layout.barriers) {
    standing.push({ view: groundSprite(art.barrier, 'barrier', x0 + dx, y0 + dy, BARRIER_SCALE), tx: Math.floor(x0 + dx), ty: Math.floor(y0 + dy) });
  }
  const sign = { tx: x0 - layout.platform.dx + layout.noParkingSign.dx, ty: y0 - layout.platform.dy + layout.noParkingSign.dy };
  standing.push({ view: groundSprite(art.noParkingSign, 'noParkingSign', sign.tx, sign.ty, 0.5), tx: Math.floor(sign.tx), ty: Math.floor(sign.ty) });
  return { ground, standing };
}

/** Barraca de feira com a vendedora ao lado, no gramado em frente ao café (mesmo vídeo). */
export function buildMarketStall(art: CafeSceneryArt, x0: number, y0: number): SceneryPieces {
  const { stall, vendor } = CAFE_SCENERY_LAYOUT;
  const at = (offset: { dx: number; dy: number }) => ({ tx: x0 + offset.dx, ty: y0 + offset.dy });
  const s = at(stall), v = at(vendor);
  const stallView = groundSprite(art.stall, 'stall', s.tx, s.ty, STALL_SCALE);
  const vendorView = groundSprite(art.vendor, 'vendor', v.tx, v.ty, STALL_SCALE);
  return {
    ground: [createSceneryShadow('stall', stallView), createSceneryShadow('vendor', vendorView)],
    standing: [
      { view: stallView, tx: Math.floor(s.tx), ty: Math.floor(s.ty) },
      { view: vendorView, tx: Math.floor(v.tx), ty: Math.floor(v.ty) },
    ],
  };
}

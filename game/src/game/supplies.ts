import { Assets, type Texture } from 'pixi.js';
import type { PlayerState } from './player-state';

export const SUPPLY_KIND_IDS = ['express', 'media', 'premium', 'jumbo'] as const;
export type SupplyKindId = typeof SUPPLY_KIND_IDS[number];
export type SupplyAction = 'order' | 'rush' | 'collect' | 'save' | 'discard';
export type SupplyStatus = 'onTheWay' | 'arrived' | 'spoiled';

/** Catálogo do servidor; tempos em segundos, preço em caféOuros, entrega imediata em caféGranas. */
export interface SupplyKind {
  id: SupplyKindId;
  name: string;
  seconds: number;
  quantity: number;
  gold: number;
  level: number;
  rushGranas: number;
}

/** Instantes em milissegundos do relógio do servidor. */
export interface SupplyOrder {
  id: string;
  slot: number;
  kind: SupplyKindId;
  quantity: number;
  arrivesAt: number;
  spoilsAt: number;
}

export interface SupplySnapshot {
  serverNow: number;
  slots: number;
  kinds: SupplyKind[];
  orders: SupplyOrder[];
  playerState: PlayerState;
  saveGranas: number;
  collectEnergy: number;
}

export function supplyStatus(order: SupplyOrder, serverNow: number): SupplyStatus {
  if (serverNow < order.arrivesAt) return 'onTheWay';
  return serverNow < order.spoilsAt ? 'arrived' : 'spoiled';
}

/** "HH:MM:SS", como o contador do balão do original. */
export function formatSupplyCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

export function formatSupplyDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = seconds / 3600;
  return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
}

/** Leitura e ações privadas do dono; cada ação leva um requestId novo e o servidor revalida tudo. */
export class SupplyClient {
  private anchorServer = 0;
  private anchorLocal = 0;

  serverNowMs(): number { return this.anchorServer + performance.now() - this.anchorLocal; }

  async refresh(): Promise<SupplySnapshot> {
    return this.read(await fetch('/api/coffe/supplies', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) }));
  }

  async act(action: SupplyAction, body: { kind?: SupplyKindId; orderId?: string }): Promise<SupplySnapshot> {
    return this.read(await fetch('/api/coffe/supplies/' + action, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, requestId: crypto.randomUUID() }), signal: AbortSignal.timeout(12000),
    }));
  }

  private async read(response: Response): Promise<SupplySnapshot> {
    const body = await response.json() as SupplySnapshot & { message?: string };
    if (!response.ok) throw new Error(body.message ?? 'Não foi possível atualizar as encomendas.');
    this.anchorServer = body.serverNow; this.anchorLocal = performance.now();
    return body;
  }
}

export interface SupplyArt {
  cone: Texture;
  boxes: Record<SupplyKindId | 'spoiled', Texture>;
  window: Texture;
}

/**
 * Apoio no chão (centro da pegada) e silhueta convexa de cada peça, em pixels da imagem
 * (`scenery/supplies/registration.json`, gerado por `tools/supplies/cut-art.py`).
 */
export const SUPPLY_PIECES: Record<'cone' | SupplyKindId | 'spoiled', { anchor: { x: number; y: number }; outline: readonly number[] }> = {
  cone: { anchor: { x: 240.5, y: 286 }, outline: [15, 288, 250, 6, 268, 12, 465, 265, 460, 301, 351, 386, 331, 386, 28, 321] },
  express: { anchor: { x: 121, y: 178 }, outline: [5, 66, 112, 10, 126, 5, 230, 57, 237, 62, 237, 175, 118, 237, 5, 179] },
  media: { anchor: { x: 141.5, y: 212.8 }, outline: [5, 75, 150, 4, 278, 69, 278, 209, 136, 281, 133, 281, 9, 218, 5, 214] },
  premium: { anchor: { x: 141.5, y: 214.2 }, outline: [4, 76, 148, 4, 279, 69, 279, 210, 274, 214, 136, 283, 121, 277, 5, 217] },
  jumbo: { anchor: { x: 161.5, y: 399.8 }, outline: [5, 234, 17, 77, 163, 4, 294, 69, 318, 229, 318, 397, 157, 478, 6, 403] },
  spoiled: { anchor: { x: 142.5, y: 310.8 }, outline: [4, 189, 67, 87, 166, 5, 248, 78, 281, 191, 279, 308, 144, 380, 4, 304] },
};

let artPromise: Promise<SupplyArt> | undefined;

export function loadSupplyArt(): Promise<SupplyArt> {
  const base = new URL('assets/', new URL(import.meta.env.BASE_URL ?? '/', document.baseURI));
  const url = (path: string) => new URL(path, base).href;
  return artPromise ??= Promise.all([
    'scenery/supplies/cone.png', 'scenery/supplies/express.png', 'scenery/supplies/media.png', 'scenery/supplies/premium.png',
    'scenery/supplies/jumbo.png', 'scenery/supplies/spoiled.png', 'ui/supplies/window.png',
  ].map((path) => Assets.load<Texture>(url(path))))
    .then(([cone, express, media, premium, jumbo, spoiled, window]) => ({ cone, boxes: { express, media, premium, jumbo, spoiled }, window }))
    .catch((error: unknown) => { artPromise = undefined; throw error; });
}

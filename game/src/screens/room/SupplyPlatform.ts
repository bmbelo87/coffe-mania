import { Container, Polygon, Sprite, type FederatedPointerEvent, type Texture } from 'pixi.js';
import { itemDepth, POPUP_DRAW_PRIORITY, tileToScreenX, tileToScreenY } from '../../world/iso';
import {
  formatSupplyCountdown, SUPPLY_PIECES, supplyStatus,
  type SupplyAction, type SupplyArt, type SupplyClient, type SupplyKindId, type SupplyOrder, type SupplySnapshot,
} from '../../game/supplies';
import { PLATFORM_SLOTS } from './cafe-scenery';
import { HoverBalloon } from './HoverBalloon';

/** O cone ocupa cerca de 80% da laje pequena, como no vídeo "level 400"; a caixa comum, 75%, como em P125_09. */
const CONE_SCALE = 0.2;
const BOX_SCALE = 0.32;
const BALLOON_COLOR = 0x5a3915;

export interface SupplyPlatformOptions {
  client: SupplyClient;
  art: SupplyArt;
  balloon?: Texture;
  /** False while the store, a window or a camera drag owns the pointer. */
  canInteract: () => boolean;
  confirm: (text: string) => Promise<boolean>;
  onSnapshot: (snapshot: SupplySnapshot) => void;
  onError: (message: string) => void;
}

interface SlotView {
  order: SupplyOrder;
  view: Container;
  sprite: Sprite;
  status: ReturnType<typeof supplyStatus>;
}

/**
 * Encomendas do dono sobre as quatro lajes pequenas da plataforma: cone laranja enquanto vem,
 * a caixa do tamanho pedido quando chega e a caixa estragada depois do prazo. O balão mostra o
 * contador; o clique pede entrega imediata, recolhe (1 de energia) ou salva a caixa estragada.
 */
export class SupplyPlatform {
  snapshot?: SupplySnapshot;
  private world?: Container;
  private origin?: { tx: number; ty: number };
  private readonly slots: SlotView[] = [];
  private balloon?: HoverBalloon;
  private hovered?: SlotView;
  private busy = false;
  private destroyed = false;

  constructor(private readonly options: SupplyPlatformOptions) {}

  async refresh(): Promise<void> {
    try { this.apply(await this.options.client.refresh()); }
    catch (error) { if (!this.destroyed) this.options.onError(error instanceof Error ? error.message : 'Não foi possível carregar as encomendas.'); }
  }

  apply(snapshot: SupplySnapshot): void {
    if (this.destroyed) return;
    this.snapshot = snapshot;
    this.options.onSnapshot(snapshot);
    this.rebuild();
  }

  /** Called whenever the scenery is rebuilt (the platform follows the café's front edge). */
  place(world: Container, origin: { tx: number; ty: number }): void {
    this.world = world; this.origin = origin;
    this.rebuild();
  }

  /** Cone becomes a box, a box spoils and the countdown advances on the server clock. */
  update(): void {
    if (!this.snapshot) return;
    const now = this.options.client.serverNowMs();
    if (this.slots.some((slot) => supplyStatus(slot.order, now) !== slot.status)) this.rebuild();
    if (this.hovered) this.showBalloon(this.hovered);
  }

  async act(action: SupplyAction, body: { kind?: SupplyKindId; orderId?: string }): Promise<void> {
    this.apply(await this.options.client.act(action, body));
  }

  private rebuild(): void {
    // The pointer stays over the same slot when its piece changes (cone to box, collected box).
    const hoveredSlot = this.hovered?.order.slot;
    this.hovered = undefined;
    this.slots.splice(0).forEach(({ view }) => view.destroy({ children: true }));
    this.hideBalloon();
    const { world, origin, snapshot } = this;
    if (!world || !origin || !snapshot) return;
    const now = this.options.client.serverNowMs();
    for (const order of snapshot.orders) {
      const at = PLATFORM_SLOTS[order.slot];
      if (!at) continue;
      const status = supplyStatus(order, now);
      const key = status === 'onTheWay' ? 'cone' : status === 'spoiled' ? 'spoiled' : order.kind;
      const texture = key === 'cone' ? this.options.art.cone : this.options.art.boxes[key];
      const scale = key === 'cone' ? CONE_SCALE : BOX_SCALE;
      const sprite = new Sprite(texture);
      const { anchor, outline } = SUPPLY_PIECES[key];
      sprite.anchor.set(anchor.x / texture.width, anchor.y / texture.height);
      sprite.scale.set(scale);
      sprite.eventMode = 'none';
      const tx = origin.tx + at.dx, ty = origin.ty + at.dy;
      const view = new Container();
      view.label = `supply-slot-${order.slot}`;
      view.position.set(tileToScreenX(tx, ty), tileToScreenY(tx, ty));
      view.zIndex = itemDepth(Math.floor(tx), Math.floor(ty));
      view.addChild(sprite);
      // The silhouette, not the box: a tall Jumbo in front must not catch clicks for the box behind.
      view.hitArea = new Polygon(outline.map((value, index) => (value - (index % 2 ? anchor.y : anchor.x)) * scale));
      view.eventMode = 'static'; view.cursor = 'pointer';
      const slot: SlotView = { order, view, sprite, status };
      view.on('pointerover', () => { if (this.options.canInteract()) { this.hovered = slot; this.showBalloon(slot); } });
      view.on('pointerout', () => { if (this.hovered === slot) { this.hovered = undefined; this.hideBalloon(); } });
      view.on('pointertap', (event: FederatedPointerEvent) => {
        if (!this.options.canInteract()) return;
        event.stopPropagation();
        void this.click(slot);
      });
      world.addChild(view);
      this.slots.push(slot);
      if (order.slot === hoveredSlot) this.hovered = slot;
    }
  }

  private kindName(order: SupplyOrder): string {
    return this.snapshot?.kinds.find((kind) => kind.id === order.kind)?.name ?? order.kind;
  }

  private async click(slot: SlotView): Promise<void> {
    const snapshot = this.snapshot;
    if (this.busy || !snapshot) return;
    const { order } = slot;
    const status = supplyStatus(order, this.options.client.serverNowMs());
    const name = this.kindName(order);
    this.busy = true;
    try {
      if (status === 'onTheWay') {
        const granas = snapshot.kinds.find((kind) => kind.id === order.kind)?.rushGranas ?? 0;
        if (await this.options.confirm(`Entrega imediata da encomenda ${name} por ${granas} caféGrana${granas === 1 ? '' : 's'}?`)) {
          await this.act('rush', { orderId: order.id });
        }
      } else if (status === 'arrived') {
        await this.act('collect', { orderId: order.id });
      } else if (await this.options.confirm(`A encomenda ${name} estragou. Salvar por ${snapshot.saveGranas} caféGrana${snapshot.saveGranas === 1 ? '' : 's'}?`)) {
        await this.act('save', { orderId: order.id });
      } else if (await this.options.confirm(`Jogar fora a encomenda ${name} estragada?`)) {
        await this.act('discard', { orderId: order.id });
      }
    } catch (error) {
      this.options.onError(error instanceof Error ? error.message : 'Não foi possível atualizar a encomenda.');
    } finally { this.busy = false; }
  }

  private showBalloon(slot: SlotView): void {
    const snapshot = this.snapshot;
    if (!this.options.balloon || !this.world || !snapshot) return;
    const now = this.options.client.serverNowMs();
    const { order } = slot;
    const name = this.kindName(order);
    const status = supplyStatus(order, now);
    // Texts of the original callout: "Premium / Chega em HH:MM:SS / Clique para Entrega Imediata".
    const content = status === 'onTheWay'
      ? { title: `${name}: chega em ${formatSupplyCountdown(order.arrivesAt - now)}`, hint: 'Clique para Entrega Imediata' }
      : status === 'arrived'
        ? { title: `${name}: ${order.quantity} suprimentos`, hint: `Clique para recolher (${snapshot.collectEnergy} de energia)` }
        : { title: 'Encomenda estragada', hint: `Clique para salvar por ${snapshot.saveGranas} caféGrana` };
    if (!this.balloon) {
      this.balloon = new HoverBalloon(this.options.balloon, 'supply-callout');
      this.balloon.view.zIndex = POPUP_DRAW_PRIORITY + 6;
      this.world.addChild(this.balloon.view);
    }
    this.balloon.set({ ...content, titleColor: BALLOON_COLOR });
    const top = slot.sprite.getBounds();
    const local = this.world.toLocal({ x: top.x + top.width / 2, y: top.y });
    this.balloon.view.position.set(local.x, local.y - 6);
    this.balloon.view.visible = true;
  }

  private hideBalloon(): void {
    this.balloon?.destroy();
    this.balloon = undefined;
  }

  destroy(): void {
    this.destroyed = true;
    this.hideBalloon();
    this.slots.splice(0).forEach(({ view }) => view.destroy({ children: true }));
  }
}

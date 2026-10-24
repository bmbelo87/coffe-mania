import { Container, FillGradient, Graphics, Rectangle, Sprite, Text, TextStyle, type Texture } from 'pixi.js';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../../core/stage';
import { playRandomSfx } from '../../audio/sfx';
import { SFX_BOOK_URLS } from '../../game/asset-manifest';
import { formatSupplyDuration, SUPPLY_KIND_IDS, type SupplyArt, type SupplyKind, type SupplyKindId, type SupplySnapshot } from '../../game/supplies';
import { modalAnimationFrame, type ModalPhase } from './ModalAnimation';

/** Mesmo quadro da janela de Temperos: a arte "Encomendas" é a reconstrução dela com outro título. */
export const SUPPLY_SCREEN_LAYOUT = {
  width: 1330, height: 600,
  card: { left: 115, top: 84, width: 260, height: 430, gap: 20 },
  box: { y: 150, width: 190, height: 150 },
  button: { x: 30, y: 352, width: 200, height: 56 },
  footer: { y: 548 },
  close: { x: 1235, y: 16, size: 44 },
} as const;

export interface SupplyOrderTextures {
  art: SupplyArt;
  buy: Texture;
  disabled: Texture;
  close: Texture;
}

function text(value: string, size: number, color: number, extra: ConstructorParameters<typeof TextStyle>[0] = {}): Text {
  const label = new Text({ text: value, style: new TextStyle({
    fontFamily: ['Arial', 'sans-serif'], fontSize: size, fill: color, align: 'center', padding: 3, ...extra,
  }) });
  label.eventMode = 'none';
  return label;
}

const goldFormat = new Intl.NumberFormat('pt-BR');

/** Cartão de um tamanho de encomenda; preço e bloqueio vêm do catálogo do servidor. */
class SupplyCard {
  readonly view = new Container();
  private readonly title: Text;
  private readonly art: Sprite;
  private readonly quantity: Text;
  private readonly time: Text;
  private readonly price: Text;
  private readonly button: Container;
  private readonly face: Sprite;
  private readonly buttonLabel: Text;
  private enabled = false;

  constructor(readonly id: SupplyKindId, private readonly textures: SupplyOrderTextures, onOrder: () => void) {
    const { width, height } = SUPPLY_SCREEN_LAYOUT.card;
    this.view.label = `supply-card-${id}`;
    // Cards in the colors of the Temperos window, so both panels read as one family.
    const gradient = new FillGradient({ colorStops: [
      { offset: 0, color: 0xd4b66b }, { offset: 0.55, color: 0xd6b974 }, { offset: 1, color: 0xd8b973 },
    ] });
    const background = new Graphics().roundRect(0, 0, width, height, 5).fill(gradient)
      .stroke({ color: 0xe1c780, width: 2 })
      .rect(7, 66, width - 14, 170).fill({ color: 0xffedbd, alpha: 0.24 });
    background.eventMode = 'none';
    this.view.addChild(background);
    this.title = text('', 30, 0x30230e, { fontWeight: '700' });
    this.title.anchor.set(0.5, 0); this.title.position.set(width / 2, 18);
    this.art = new Sprite(textures.art.boxes[id]); this.art.anchor.set(0.5); this.art.eventMode = 'none';
    const box = SUPPLY_SCREEN_LAYOUT.box;
    this.art.scale.set(Math.min(box.width / this.art.texture.width, box.height / this.art.texture.height));
    this.art.position.set(width / 2, box.y);
    this.quantity = text('', 34, 0xffffff, { fontWeight: '900', stroke: { color: 0x593b1d, width: 6, join: 'round' } });
    this.quantity.anchor.set(0.5); this.quantity.position.set(width / 2, 252);
    this.time = text('', 22, 0x94743d, { fontWeight: '700' });
    this.time.anchor.set(0.5, 0); this.time.position.set(width / 2, 282);
    this.price = text('', 22, 0x6b4a1c, { fontWeight: '700' });
    this.price.anchor.set(0.5, 0); this.price.position.set(width / 2, 312);
    const button = new Container();
    button.label = `supply-order-${id}`;
    const layout = SUPPLY_SCREEN_LAYOUT.button;
    button.position.set(layout.x, layout.y);
    this.face = new Sprite(textures.disabled); this.face.width = layout.width; this.face.height = layout.height; this.face.eventMode = 'none';
    this.buttonLabel = text('Encomendar', 25, 0xffffff, { fontWeight: '700', stroke: { color: 0x27802c, width: 2.5, join: 'round' } });
    this.buttonLabel.anchor.set(0.5); this.buttonLabel.position.set(layout.width / 2, layout.height / 2);
    button.addChild(this.face, this.buttonLabel);
    button.hitArea = new Rectangle(0, 0, layout.width, layout.height);
    button.eventMode = 'static';
    button.on('pointertap', (event) => { event.stopPropagation(); if (this.enabled) onOrder(); });
    button.on('pointerover', () => { if (this.enabled) this.face.tint = 0xe7ffdd; });
    button.on('pointerout', () => { this.face.tint = 0xffffff; });
    button.on('pointerdown', () => { if (this.enabled) this.face.tint = 0xc6ddbd; });
    button.on('pointerup', () => { this.face.tint = 0xffffff; });
    this.button = button;
    this.view.addChild(this.title, this.art, this.quantity, this.time, this.price, button);
  }

  setState(kind: SupplyKind | undefined, snapshot: SupplySnapshot | undefined, busy: boolean): void {
    const state = snapshot?.playerState;
    this.title.text = kind?.name ?? '';
    this.quantity.text = kind ? `${kind.quantity} suprimentos` : '';
    this.quantity.scale.set(Math.min(1, (SUPPLY_SCREEN_LAYOUT.card.width - 20) / Math.max(1, this.quantity.getLocalBounds().width)));
    this.time.text = kind ? `Chega em ${formatSupplyDuration(kind.seconds)}` : '';
    this.price.text = kind ? `${goldFormat.format(kind.gold)} caféOuros` : '';
    const locked = Boolean(kind && state && state.level < kind.level);
    const free = snapshot ? snapshot.slots - snapshot.orders.length : 0;
    this.buttonLabel.text = locked && kind ? `Nível ${kind.level}` : 'Encomendar';
    const enabled = Boolean(kind && state && !busy && !locked && free > 0 && state.gold >= kind.gold);
    this.enabled = enabled;
    this.face.texture = enabled ? this.textures.buy : this.textures.disabled;
    this.face.width = SUPPLY_SCREEN_LAYOUT.button.width; this.face.height = SUPPLY_SCREEN_LAYOUT.button.height;
    this.face.tint = 0xffffff;
    this.button.cursor = enabled ? 'pointer' : 'default';
    this.art.alpha = locked ? 0.55 : 1;
  }
}

export interface SupplyOrderModalOptions {
  textures: SupplyOrderTextures;
  onOrder: (kind: SupplyKindId) => Promise<void>;
  onError?: (message: string) => void;
}

/**
 * Janela de encomenda de suprimentos. Nenhuma captura a mostra aberta: é reconstrução no estilo da
 * janela de Temperos, com os quatro tamanhos do original (Express, Média, Premium e Jumbo).
 */
export class SupplyOrderModal {
  readonly view = new Container();
  private readonly panel = new Container();
  private readonly backdrop = new Graphics();
  private readonly cards: SupplyCard[];
  private readonly footer: Text;
  private snapshot?: SupplySnapshot;
  private busy = false;
  private phase: ModalPhase = 'closed';
  private animTimer = 0;
  private generation = 0;

  constructor(private readonly options: SupplyOrderModalOptions) {
    const layout = SUPPLY_SCREEN_LAYOUT;
    this.view.label = 'supply-order-modal'; this.view.visible = false;
    this.backdrop.rect(-12000, -12000, 24000, 24000).fill(0x000000);
    this.backdrop.alpha = 0; this.backdrop.eventMode = 'static';
    this.backdrop.on('pointertap', (event) => { event.stopPropagation(); this.close(); });
    this.panel.label = 'supply-order-window';
    this.panel.pivot.set(layout.width / 2, layout.height / 2);
    this.panel.position.set(STAGE_WIDTH / 2, STAGE_HEIGHT / 2);
    this.panel.eventMode = 'static'; this.panel.hitArea = new Rectangle(0, 0, layout.width, layout.height);
    this.panel.on('pointertap', (event) => event.stopPropagation());
    const background = new Sprite(options.textures.art.window);
    background.width = layout.width; background.height = layout.height; background.eventMode = 'none';
    this.panel.addChild(background);
    this.cards = SUPPLY_KIND_IDS.map((id, index) => {
      const card = new SupplyCard(id, options.textures, () => { void this.order(id); });
      card.view.position.set(layout.card.left + index * (layout.card.width + layout.card.gap), layout.card.top);
      this.panel.addChild(card.view);
      return card;
    });
    this.footer = text('', 24, 0xffffff, { fontWeight: '700', stroke: { color: 0x4a2a10, width: 4, join: 'round' } });
    this.footer.label = 'supply-order-footer';
    this.footer.anchor.set(0.5); this.footer.position.set(layout.width / 2, layout.footer.y);
    const close = new Container(); close.label = 'supply-order-close';
    close.position.set(layout.close.x, layout.close.y);
    close.eventMode = 'static'; close.cursor = 'pointer';
    close.hitArea = new Rectangle(0, 0, layout.close.size, layout.close.size);
    const closeFace = new Sprite(options.textures.close);
    closeFace.width = layout.close.size; closeFace.height = layout.close.size; closeFace.eventMode = 'none';
    close.addChild(closeFace);
    close.on('pointertap', (event) => { event.stopPropagation(); this.close(); });
    this.panel.addChild(this.footer, close);
    this.view.addChild(this.backdrop, this.panel);
    window.addEventListener('keydown', this.onKeyDown);
  }

  get isOpen(): boolean { return this.phase !== 'closed'; }

  open(snapshot: SupplySnapshot | undefined): void {
    this.setSnapshot(snapshot);
    if (this.phase === 'open' || this.phase === 'opening') return;
    playRandomSfx(SFX_BOOK_URLS);
    this.phase = 'opening'; this.animTimer = 0; this.view.visible = true;
    this.backdrop.alpha = 0; this.panel.alpha = 0; this.panel.scale.set(0.7);
  }

  close(): void {
    if (this.phase === 'closed' || this.phase === 'closing') return;
    this.phase = 'closing'; this.animTimer = 0;
  }

  setSnapshot(snapshot: SupplySnapshot | undefined): void { this.snapshot = snapshot; this.refresh(); }

  update(deltaMs: number): void {
    if (this.phase !== 'opening' && this.phase !== 'closing') return;
    this.animTimer += Math.max(0, deltaMs);
    const frame = modalAnimationFrame(this.phase, this.animTimer);
    this.panel.scale.set(frame.scale); this.panel.alpha = frame.alpha; this.backdrop.alpha = frame.backdropAlpha;
    if (frame.finished) {
      if (this.phase === 'opening') this.phase = 'open';
      else { this.phase = 'closed'; this.view.visible = false; this.panel.scale.set(0.7); }
    }
  }

  private refresh(): void {
    const snapshot = this.snapshot;
    for (const card of this.cards) card.setState(snapshot?.kinds.find((kind) => kind.id === card.id), snapshot, this.busy || this.phase === 'closing');
    if (!snapshot) { this.footer.text = 'Carregando…'; return; }
    const free = snapshot.slots - snapshot.orders.length;
    const crates = snapshot.playerState.crates;
    this.footer.text = `Despensa: ${crates.current}/${crates.maximum}    ·    Vagas livres na plataforma: ${free} de ${snapshot.slots}`;
  }

  private async order(id: SupplyKindId): Promise<void> {
    if (this.busy || this.phase === 'closing') return;
    this.busy = true; this.refresh();
    const generation = this.generation;
    try {
      await this.options.onOrder(id);
      if (generation === this.generation) this.close();
    } catch (error) {
      if (generation === this.generation) this.options.onError?.(error instanceof Error ? error.message : 'Não foi possível encomendar.');
    } finally {
      if (generation === this.generation) { this.busy = false; this.refresh(); }
    }
  }

  private onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape' && this.isOpen) { event.preventDefault(); this.close(); } };

  destroy(): void { this.generation++; window.removeEventListener('keydown', this.onKeyDown); this.view.destroy({ children: true }); }
}

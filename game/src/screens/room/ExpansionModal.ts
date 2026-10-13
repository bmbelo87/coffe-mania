import { Container, Graphics, Rectangle, Sprite, Text, TextStyle, type Texture } from 'pixi.js';

import { FONT_FAMILY } from '../../core/font-tokens';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../../core/stage';
import type { RoomExpansionOffer } from '../../game/room-inventory';
import { modalAnimationFrame, type ModalPhase } from './ModalAnimation';

export type ExpansionPayment = 'cash' | 'gold' | 'gold_unlock';

const PANEL = { width: 760, height: 470 } as const;
const BLUE_TEXT = 0x1d4f86;
const integer = new Intl.NumberFormat('pt-BR');

function label(text: string, size: number, fill: number, extra: ConstructorParameters<typeof TextStyle>[0] = {}): Text {
  const value = new Text({ text, style: new TextStyle({
    fontFamily: [FONT_FAMILY, 'sans-serif'], fontSize: size, fontWeight: '800', fill, padding: 6, ...extra,
  }) });
  value.eventMode = 'none';
  return value;
}

/**
 * "Comprar Expansão?" window, after the original (2010): the block is paid in caféOuros or
 * caféGranas. Below the level, the caféOuros button gives way to the "Bloqueado!" notice with
 * "Desbloquear por N", which pays the unlock in caféGranas together with the caféOuros price.
 * The frame and buttons are drawn here; the icon is the expansion symbol of the current UI.
 */
export class ExpansionModal {
  readonly view = new Container();
  private readonly panel = new Container();
  private readonly backdrop = new Graphics();
  private readonly body = new Container();
  private phase: ModalPhase = 'closed';
  private animTimer = 0;
  private resolve?: (payment: ExpansionPayment | null) => void;
  private disposed = false;

  constructor(private readonly icon?: Texture) {
    this.view.label = 'expansion-modal';
    this.view.visible = false;
    this.backdrop.rect(-12000, -12000, 24000, 24000).fill(0x000000);
    this.backdrop.alpha = 0;
    this.backdrop.eventMode = 'static';
    for (const name of ['pointerdown', 'pointerup', 'wheel'] as const) this.backdrop.on(name, (event) => event.stopPropagation());
    this.backdrop.on('pointertap', (event) => { event.stopPropagation(); this.finish(null); });

    this.panel.label = 'expansion-window';
    this.panel.pivot.set(PANEL.width / 2, PANEL.height / 2);
    this.panel.position.set(STAGE_WIDTH / 2, STAGE_HEIGHT / 2);
    this.panel.eventMode = 'static';
    this.panel.hitArea = new Rectangle(0, 0, PANEL.width, PANEL.height);
    for (const name of ['pointerdown', 'pointerup', 'pointertap', 'wheel'] as const) this.panel.on(name, (event) => event.stopPropagation());

    const frame = new Graphics()
      .roundRect(0, 0, PANEL.width, PANEL.height, 40).fill(0x9a5a2c).stroke({ color: 0x5e3115, width: 6 })
      .roundRect(18, 18, PANEL.width - 36, PANEL.height - 36, 28).fill(0x7fd3f2).stroke({ color: 0x4aa6d1, width: 4 });
    // Light rays of the original background, from the window's center.
    const rays = new Graphics();
    const cx = PANEL.width / 2, cy = PANEL.height / 2;
    for (let index = 0; index < 18; index++) {
      const a = (index / 18) * Math.PI * 2, b = a + Math.PI / 36;
      rays.moveTo(cx, cy).lineTo(cx + Math.cos(a) * 700, cy + Math.sin(a) * 700).lineTo(cx + Math.cos(b) * 700, cy + Math.sin(b) * 700).closePath();
    }
    rays.fill({ color: 0xffffff, alpha: 0.12 });
    const raysMask = new Graphics().roundRect(18, 18, PANEL.width - 36, PANEL.height - 36, 28).fill(0xffffff);
    rays.mask = raysMask;
    frame.eventMode = 'none'; rays.eventMode = 'none';

    const close = new Container();
    close.label = 'expansion-close';
    close.position.set(PANEL.width - 40, 40);
    close.eventMode = 'static'; close.cursor = 'pointer';
    close.hitArea = new Rectangle(-34, -34, 68, 68);
    const closeFace = new Graphics().roundRect(-28, -28, 56, 56, 10).fill(0xc92410).stroke({ color: 0xffffff, width: 4 })
      .moveTo(-11, -11).lineTo(11, 11).moveTo(11, -11).lineTo(-11, 11).stroke({ color: 0xffffff, width: 8, cap: 'round' });
    closeFace.eventMode = 'none';
    close.addChild(closeFace);
    close.on('pointertap', (event) => { event.stopPropagation(); this.finish(null); });
    close.on('pointerover', () => close.scale.set(1.1));
    close.on('pointerout', () => close.scale.set(1));

    this.panel.addChild(frame, rays, raysMask, this.body, close);
    this.view.addChild(this.backdrop, this.panel);
    window.addEventListener('keydown', this.onKeyDown, true);
  }

  get isOpen(): boolean { return this.phase !== 'closed'; }

  /** Resolves with the chosen payment, or null when the window is closed. */
  ask(offer: RoomExpansionOffer, level: number): Promise<ExpansionPayment | null> {
    if (this.disposed) return Promise.resolve(null);
    this.resolve?.(null);
    this.render(offer, level);
    this.phase = 'opening';
    this.animTimer = 0;
    this.view.visible = true;
    this.backdrop.alpha = 0;
    this.panel.alpha = 0;
    this.panel.scale.set(0.7);
    return new Promise((resolve) => { this.resolve = resolve; });
  }

  private render(offer: RoomExpansionOffer, level: number): void {
    this.body.removeChildren().forEach((child) => child.destroy({ children: true }));
    const locked = level < offer.level;
    const title = label(locked ? 'Bloqueado!' : 'Comprar Expansão?', 58, 0xffffff, { stroke: { color: BLUE_TEXT, width: 12, join: 'round' } });
    title.anchor.set(0.5, 0); title.position.set(PANEL.width / 2, 40);
    this.body.addChild(title);

    const art = new Container();
    art.position.set(175, 285);
    if (this.icon) {
      const sprite = new Sprite(this.icon);
      sprite.anchor.set(0.5);
      sprite.scale.set(Math.min(230 / this.icon.width, 190 / this.icon.height));
      art.addChild(sprite);
    }
    const size = label(`${offer.floorX}x${offer.floorY}`, 34, 0xffffff, { stroke: { color: 0x5e3115, width: 8, join: 'round' } });
    size.anchor.set(0.5); size.position.set(0, -118);
    art.addChild(size);
    this.body.addChild(art);

    const right = 330, width = 360;
    const cash = this.button(`${integer.format(offer.priceCash)} Granas`, 'bill', 0x168a2a, 0x0c5a17, right, 300, width, () => this.finish('cash'));
    cash.label = 'expansion-pay-cash';
    if (!locked) {
      const gold = this.button(`${integer.format(offer.priceGold)} Ouros`, 'coin', 0x2fb83a, 0x0c5a17, right, 190, width, () => this.finish('gold'));
      gold.label = 'expansion-pay-gold';
      this.body.addChild(gold, cash);
      return;
    }
    const lock = new Graphics()
      .roundRect(-22, -6, 44, 36, 7).fill(0x8a8f96).stroke({ color: 0x3d4146, width: 3 })
      .arc(0, -6, 14, Math.PI, 0).stroke({ color: 0x3d4146, width: 6 });
    lock.position.set(right + width / 2, 150); lock.eventMode = 'none';
    const notice = label(`Desbloqueia no nível ${offer.level}.\nDestrave Antes!`, 26, 0xffffff, {
      align: 'center', stroke: { color: 0x3a2a14, width: 6, join: 'round' }, lineHeight: 32,
    });
    notice.anchor.set(0.5, 0); notice.position.set(right + width / 2, 184);
    const unlock = this.button(`Desbloquear por ${integer.format(offer.unlockCash)}`, 'bill', 0x6a6fd8, 0x353a96, right, 268, width, () => this.finish('gold_unlock'), 46);
    unlock.label = 'expansion-unlock';
    const unlockNote = label(`+ ${integer.format(offer.priceGold)} Ouros da expansão`, 18, 0xffffff, { stroke: { color: 0x3a2a14, width: 5, join: 'round' } });
    unlockNote.anchor.set(0.5, 0); unlockNote.position.set(right + width / 2, 318);
    const or = label('ou pague só em caféGranas:', 18, 0xffffff, { stroke: { color: 0x3a2a14, width: 5, join: 'round' } });
    or.anchor.set(0.5, 0); or.position.set(right + width / 2, 344);
    cash.position.y = 374;
    this.body.addChild(lock, notice, unlock, unlockNote, or, cash);
  }

  private button(text: string, symbol: 'coin' | 'bill', fill: number, stroke: number, x: number, y: number, width: number, onTap: () => void, height = 64): Container {
    const button = new Container();
    button.position.set(x, y);
    button.eventMode = 'static'; button.cursor = 'pointer';
    button.hitArea = new Rectangle(0, 0, width, height);
    const face = new Container();
    face.pivot.set(width / 2, height / 2); face.position.set(width / 2, height / 2);
    face.addChild(new Graphics().roundRect(0, 0, width, height, 14).fill(fill).stroke({ color: stroke, width: 5 }));
    const icon = symbol === 'coin'
      ? new Graphics().circle(0, 0, 17).fill(0xffc21a).stroke({ color: 0xc77d00, width: 4 }).circle(0, 0, 8).stroke({ color: 0xc77d00, width: 3 })
      : new Graphics().roundRect(-20, -12, 40, 24, 4).fill(0x48c45a).stroke({ color: 0x14612a, width: 3 }).circle(0, 0, 6).fill(0x14612a);
    icon.position.set(42, height / 2);
    const value = label(text, height > 50 ? 28 : 24, 0xffffff, { stroke: { color: 0x123d17, width: 6, join: 'round' } });
    value.anchor.set(0, 0.5); value.position.set(72, height / 2);
    face.addChild(icon, value);
    button.addChild(face);
    button.on('pointerover', () => face.scale.set(1.05));
    button.on('pointerout', () => face.scale.set(1));
    button.on('pointertap', (event) => { event.stopPropagation(); onTap(); });
    return button;
  }

  private finish(payment: ExpansionPayment | null): void {
    if (this.phase === 'closed' || this.phase === 'closing') return;
    this.phase = 'closing';
    this.animTimer = 0;
    const resolve = this.resolve;
    this.resolve = undefined;
    resolve?.(payment);
  }

  update(deltaMs: number): void {
    if (this.phase !== 'opening' && this.phase !== 'closing') return;
    this.animTimer += Math.max(0, deltaMs);
    const frame = modalAnimationFrame(this.phase, this.animTimer);
    this.panel.scale.set(frame.scale);
    this.panel.alpha = frame.alpha;
    this.backdrop.alpha = frame.backdropAlpha;
    if (frame.finished) {
      if (this.phase === 'opening') this.phase = 'open';
      else { this.phase = 'closed'; this.view.visible = false; this.panel.scale.set(0.7); }
    }
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.phase !== 'open' && this.phase !== 'opening') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.finish(null);
    }
    // The question is modal: no shortcut reaches the room while it is open.
    event.stopImmediatePropagation();
  };

  destroy(): void {
    this.disposed = true;
    this.resolve?.(null);
    window.removeEventListener('keydown', this.onKeyDown, true);
    this.view.destroy({ children: true });
  }
}

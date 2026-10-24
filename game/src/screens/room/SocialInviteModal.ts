import { Container, Graphics, Rectangle, Sprite, Text, TextStyle, type Texture } from 'pixi.js';

import { FONT_FAMILY } from '../../core/font-tokens';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../../core/stage';

export interface SocialInviteModalOptions {
  textures: { frame: Texture; button: Texture; close: Texture };
  inviteUrl: string;
  /** Invoked only from the player's click; rejection keeps an explicit copy failure visible. */
  onCopy?: () => Promise<void>;
}

const PANEL_WIDTH = 700;
const PANEL_HEIGHT = 460;
const BROWN = 0x704721;

/** Local link invitation, using shared dialog art; not a reconstruction of an archived social popup. */
export class SocialInviteModal {
  readonly view = new Container();
  private readonly panel = new Container();
  private readonly copyButton = new Container();
  private readonly copyLabel: Text;
  private readonly feedback: Text;
  private busy = false;
  private disposed = false;
  private generation = 0;

  constructor(private readonly options: SocialInviteModalOptions) {
    this.view.label = 'social-invite-modal';
    this.view.visible = false;
    this.view.eventMode = 'passive';

    const backdrop = new Graphics().rect(-12000, -12000, 24000, 24000)
      .fill({ color: 0x342c23, alpha: 0.38 });
    backdrop.label = 'social-invite-backdrop';
    backdrop.eventMode = 'static';
    for (const type of ['pointerdown', 'pointerup', 'pointerupoutside', 'wheel'] as const) {
      backdrop.on(type, event => event.stopPropagation());
    }
    backdrop.on('pointertap', event => { event.stopPropagation(); this.close(); });

    this.panel.label = 'social-invite-window';
    this.panel.position.set((STAGE_WIDTH - PANEL_WIDTH) / 2, (STAGE_HEIGHT - PANEL_HEIGHT) / 2);
    this.panel.eventMode = 'static';
    this.panel.hitArea = new Rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT);
    for (const type of ['pointerdown', 'pointerup', 'pointerupoutside', 'pointertap', 'wheel'] as const) {
      this.panel.on(type, event => event.stopPropagation());
    }
    const frame = this.image(options.textures.frame, 0, 0, PANEL_WIDTH, PANEL_HEIGHT);
    frame.label = 'social-invite-frame';
    this.panel.addChild(frame);

    const title = this.text('Agregar Amigo', PANEL_WIDTH / 2, 62, 38);
    const message = this.text('Compartilhe o link do seu café para receber visitas.', PANEL_WIDTH / 2, 146, 26);
    message.style.wordWrap = true;
    message.style.wordWrapWidth = 550;
    message.style.lineHeight = 34;
    const url = this.text(options.inviteUrl, PANEL_WIDTH / 2, 238, 19);
    url.label = 'social-invite-url';
    url.style.wordWrap = true;
    url.style.wordWrapWidth = 560;
    url.style.breakWords = true;
    url.style.lineHeight = 25;
    if (url.height > 76) url.scale.set(76 / url.height);
    this.panel.addChild(title, message, url);

    const close = new Container();
    close.label = 'social-invite-close';
    close.position.set(PANEL_WIDTH - 46, 40);
    close.addChild(this.image(options.textures.close, -24, -24, 48, 48));
    this.buttonEvents(close, new Rectangle(-28, -28, 56, 56), () => this.close());
    this.panel.addChild(close);

    this.copyButton.label = 'social-invite-copy';
    this.copyButton.position.set(PANEL_WIDTH / 2, 356);
    this.copyButton.addChild(this.image(options.textures.button, -142, -32, 284, 64));
    this.copyLabel = this.text('Copiar convite', 0, -18, 28, 0xffffff);
    this.copyLabel.style.stroke = { color: 0x1c741c, width: 3, join: 'round' };
    this.copyLabel.style.padding = 3;
    this.copyButton.addChild(this.copyLabel);
    this.buttonEvents(this.copyButton, new Rectangle(-142, -32, 284, 64), () => { void this.copy(); });
    this.panel.addChild(this.copyButton);

    this.feedback = this.text('', PANEL_WIDTH / 2, 403, 21);
    this.feedback.label = 'social-invite-feedback';
    this.panel.addChild(this.feedback);
    this.view.addChild(backdrop, this.panel);
    window.addEventListener('keydown', this.onKeyDown, true);
  }

  get isOpen(): boolean { return this.view.visible; }

  open(): void {
    if (this.disposed) return;
    this.generation++;
    this.busy = false;
    this.feedback.text = '';
    this.copyLabel.text = 'Copiar convite';
    this.copyButton.alpha = 1;
    this.copyButton.scale.set(1);
    this.view.visible = true;
  }

  close(): void {
    this.generation++;
    this.busy = false;
    this.view.visible = false;
  }

  private image(texture: Texture, x: number, y: number, width: number, height: number): Sprite {
    const sprite = new Sprite(texture);
    sprite.position.set(x, y);
    sprite.width = width;
    sprite.height = height;
    sprite.eventMode = 'none';
    return sprite;
  }

  private text(value: string, x: number, y: number, size: number, color = BROWN): Text {
    const text = new Text({
      text: value,
      style: new TextStyle({
        fontFamily: [FONT_FAMILY, 'sans-serif'], fontSize: size, fontWeight: '600',
        fill: color, align: 'center', padding: 2,
      }),
    });
    text.anchor.set(0.5, 0);
    text.position.set(x, y);
    text.eventMode = 'none';
    return text;
  }

  private buttonEvents(button: Container, hitArea: Rectangle, action: () => void): void {
    button.hitArea = hitArea;
    button.eventMode = 'static';
    button.cursor = 'pointer';
    for (const type of ['pointerdown', 'pointerup', 'pointerupoutside', 'wheel'] as const) {
      button.on(type, event => event.stopPropagation());
    }
    button.on('pointertap', event => { event.stopPropagation(); action(); });
    button.on('pointerover', () => { if (!this.busy) button.scale.set(1.035); });
    button.on('pointerout', () => button.scale.set(1));
  }

  private async copy(): Promise<void> {
    if (this.disposed || !this.isOpen || this.busy) return;
    this.busy = true;
    this.feedback.text = '';
    this.copyLabel.text = 'Copiando…';
    this.copyButton.alpha = 0.7;
    this.copyButton.scale.set(1);
    const generation = this.generation;
    try {
      // Clipboard access stays in the user's click, never in open(), construction or a timer.
      if (this.options.onCopy) await this.options.onCopy();
      else await navigator.clipboard.writeText(this.options.inviteUrl);
      if (!this.disposed && generation === this.generation) this.feedback.text = 'Convite copiado!';
    } catch {
      if (!this.disposed && generation === this.generation) this.feedback.text = 'Não foi possível copiar o convite.';
    } finally {
      if (!this.disposed && generation === this.generation) {
        this.busy = false;
        this.copyLabel.text = 'Copiar convite';
        this.copyButton.alpha = 1;
      }
    }
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.isOpen) return;
    event.stopImmediatePropagation();
    if (event.key === 'Escape') { event.preventDefault(); this.close(); }
  };

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.close();
    window.removeEventListener('keydown', this.onKeyDown, true);
    this.view.destroy({ children: true });
  }
}

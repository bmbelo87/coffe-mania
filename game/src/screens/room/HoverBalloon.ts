import { Container, Sprite, Text, TextStyle, type Texture } from 'pixi.js';

/** Medidas no mundo 2x; a arte é a mesma do balão "Comida estragada" restaurado do original. */
const SIZE = { width: 560, height: 148 } as const;
/** Ponta do balão, que fica sobre o objeto apontado. */
const TIP = { x: 134, y: 143 } as const;
const ICON_BOX = { x: 75, y: 54, width: 166, height: 111 } as const;
const TEXT_LEFT_WITH_ICON = 168;

export interface HoverBalloonContent {
  title: string;
  hint?: string;
  icon?: Texture;
  /** Cor do título; o verde é o do balão de comida estragada. */
  titleColor?: number;
}

/**
 * Balão branco de dica do original (estragado, prato pronto, máquina de sucos, balcão).
 * O texto é dinâmico e o ícone é opcional; sem ícone, o texto fica centralizado no balão.
 */
export class HoverBalloon {
  readonly view = new Container();
  private readonly icon = new Sprite();
  private readonly title: Text;
  private readonly hint: Text;

  constructor(background: Texture, label: string, content?: HoverBalloonContent) {
    this.view.label = label;
    this.view.eventMode = 'none';
    this.view.interactiveChildren = false;
    this.view.visible = false;
    this.view.pivot.set(TIP.x, TIP.y);
    const frame = new Sprite(background);
    frame.width = SIZE.width;
    frame.height = SIZE.height;
    this.icon.label = `${label}-icon`;
    this.icon.anchor.set(0.5);
    this.icon.position.set(ICON_BOX.x, ICON_BOX.y);
    this.title = new Text({ text: '', style: new TextStyle({
      fontFamily: ['Arial', 'sans-serif'], fontSize: 36, fontWeight: '700', fill: 0x49651e, padding: 2,
    }) });
    this.hint = new Text({ text: '', style: new TextStyle({
      fontFamily: ['Arial', 'sans-serif'], fontSize: 27, fill: 0x716654, padding: 2,
    }) });
    this.view.addChild(frame, this.icon, this.title, this.hint);
    if (content) this.set(content);
  }

  set({ title, hint, icon, titleColor = 0x49651e }: HoverBalloonContent): void {
    this.title.text = title;
    this.title.style.fill = titleColor;
    this.hint.text = hint ?? '';
    this.hint.visible = !!hint;
    this.icon.visible = !!icon;
    if (icon && this.icon.texture !== icon) this.icon.texture = icon;
    if (icon) this.icon.scale.set(Math.min(ICON_BOX.width / icon.width, ICON_BOX.height / icon.height));
    // Uma linha só fica no meio do corpo do balão; duas linhas mantêm as posições do original.
    const bodyMiddle = 54;
    const titleY = hint ? 15 : bodyMiddle - this.title.height / 2;
    if (icon) {
      this.title.anchor.set(0, 0);
      this.title.position.set(TEXT_LEFT_WITH_ICON, titleY);
      this.hint.anchor.set(0, 0);
      this.hint.position.set(TEXT_LEFT_WITH_ICON + 1, 55);
    } else {
      this.title.anchor.set(0.5, 0);
      this.title.position.set(SIZE.width / 2, titleY);
      this.hint.anchor.set(0.5, 0);
      this.hint.position.set(SIZE.width / 2, 55);
    }
    // Títulos longos encolhem para caber no corpo; a arte não estica.
    const room = SIZE.width - (icon ? TEXT_LEFT_WITH_ICON : 0) - 24;
    for (const text of [this.title, this.hint]) {
      text.scale.set(1);
      if (text.width > room) text.scale.set(room / text.width);
    }
  }

  destroy(): void { this.view.destroy({ children: true }); }
}

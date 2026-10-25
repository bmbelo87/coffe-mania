import { Circle, Container, Ellipse, Sprite, Texture } from 'pixi.js';
import { contentTexture } from './alpha-hit';
import type { ThoughtBubbleArt } from '../../game/thought-bubble';

/** Medidas no mundo 2x. A origem é o apoio do último círculo, acima da cabeça. */
export const THOUGHT_BUBBLE_LAYOUT = {
  oval: { x: 0, y: -105, width: 168, height: 110 },
  dotLarge: { x: 0, y: -33, width: 22, height: 22 },
  dotSmall: { x: 0, y: -8, width: 16, height: 16 },
  icon: { x: 0, y: -170, width: 136, height: 112 },
} as const;

/** Balão sem semântica de bebida: o chamador escolhe ícone, ação, posição e profundidade. */
export class ThoughtBubble {
  readonly view = new Container();
  private readonly icon = new Sprite(Texture.EMPTY);

  constructor(art: ThoughtBubbleArt, onActivate?: () => void) {
    this.view.label = 'customer-thought-bubble';
    for (const [texture, bounds] of [
      [art.oval, THOUGHT_BUBBLE_LAYOUT.oval],
      [art.dotLarge, THOUGHT_BUBBLE_LAYOUT.dotLarge],
      [art.dotSmall, THOUGHT_BUBBLE_LAYOUT.dotSmall],
    ] as const) {
      const part = new Sprite(texture);
      part.anchor.set(.5); part.position.set(bounds.x, bounds.y);
      part.width = bounds.width; part.height = bounds.height;
      part.eventMode = 'none'; this.view.addChild(part);
    }
    this.icon.anchor.set(.5, 0);
    this.icon.position.set(THOUGHT_BUBBLE_LAYOUT.icon.x, THOUGHT_BUBBLE_LAYOUT.icon.y);
    this.icon.eventMode = 'none'; this.icon.visible = false;
    this.view.addChild(this.icon);
    const oval = new Ellipse(0, -105, 84, 55);
    const large = new Circle(0, -33, 11), small = new Circle(0, -8, 8);
    this.view.hitArea = { contains: (x, y) => oval.contains(x, y) || large.contains(x, y) || small.contains(x, y) ||
      (this.icon.visible && Math.abs(x - this.icon.x) <= this.icon.width / 2 && y >= this.icon.y && y <= this.icon.y + this.icon.height) };
    this.view.eventMode = onActivate ? 'static' : 'none';
    if (onActivate) {
      this.view.cursor = 'pointer';
      this.view.on('pointertap', event => { event.stopPropagation(); onActivate(); });
    }
  }

  setIcon(texture?: Texture): void {
    this.icon.visible = Boolean(texture);
    this.icon.texture = texture ? contentTexture(texture) : Texture.EMPTY;
    if (texture) this.icon.scale.set(Math.min(THOUGHT_BUBBLE_LAYOUT.icon.width / this.icon.texture.width, THOUGHT_BUBBLE_LAYOUT.icon.height / this.icon.texture.height));
  }

  destroy(): void { this.view.destroy({ children: true }); }
}

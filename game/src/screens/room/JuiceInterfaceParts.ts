import { Container, FillGradient, Graphics, Rectangle, Sprite, Text, type Texture } from 'pixi.js';
import { FONT_FAMILY } from '../../core/font-tokens';

/** Panel-space measures from modular-v2/layout.json; the logo and close button overhang the top edge by 12 px. */
export const JUICE_SHEET = { width: 594, height: 508, overhang: 12, scale: 1.75 };
export const JUICE_ROWS = [135, 225, 315, 405] as const;
/** Card content is laid out from x=200; the 362 px card art itself starts at x=199. */
export const JUICE_CARD_X = 200;
export const JUICE_TAB_Y = 86;
export const JUICE_TAB_X = [12, 147, 284, 419] as const;
const gradient = (...colors: number[]) => new FillGradient({ start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: colors.map((color, i) => ({ color, offset: i / (colors.length - 1) })) });
const GREEN = gradient(0x04dc0c, 0x00bc09, 0x008d05);

export function juiceText(text: string, x: number, y: number, size = 14, color = 0x713000, weight: '400' | '700' = '700', stroke?: number): Text {
  const view = new Text({ text, resolution: 2, style: { fontFamily: FONT_FAMILY, fontWeight: weight, fontSize: size, fill: color,
    padding: 3, ...(stroke === undefined ? {} : { stroke: { color: stroke, width: size > 15 ? 3 : 1.4 } }) } });
  view.position.set(x, y);
  return view;
}
export function fitJuiceImage(texture: Texture, x: number, y: number, width: number, height: number): Sprite {
  const view = new Sprite(texture);
  view.scale.set(Math.min(width / texture.width, height / texture.height));
  view.position.set(x + (width - view.width) / 2, y + (height - view.height) / 2);
  view.eventMode = 'none';
  return view;
}
/** Sprite sized to its logical (1x) measures, so the 2x PNG keeps its sharpness when the panel is scaled. */
export function juicePart(texture: Texture, x: number, y: number, width: number, height: number): Sprite {
  const view = new Sprite(texture);
  view.position.set(x, y); view.width = width; view.height = height; view.eventMode = 'none';
  return view;
}
/** Tab label over the exported blank tab; locked tabs reserve room on the left for the padlock. */
export function juiceTab(art: { active: Texture; inactive: Texture; locked: Texture; padlock: Texture }, label: string, x: number, selected: boolean, locked: boolean, click: () => void): Container {
  const view = new Container();
  view.label = 'juice-tab:' + label;
  view.position.set(x, JUICE_TAB_Y);
  view.addChild(juicePart(locked ? art.locked : selected ? art.active : art.inactive, 0, 0, 130, 35));
  if (locked) {
    view.addChild(fitJuiceImage(art.padlock, 10, 4, 15, 23));
  }
  const text = juiceText(label, 0, 5, 15, locked ? 0xa0a4a4 : selected ? 0xffffff : 0x629fa8, '700', locked ? 0x777f80 : selected ? 0x62a8b1 : 0x5aa3ad);
  text.x = locked ? 27 : (130 - text.width) / 2;
  view.addChild(text);
  view.eventMode = 'static'; view.cursor = 'pointer'; view.hitArea = new Rectangle(0, 0, 130, 35);
  view.on('pointertap', event => { event.stopPropagation(); click(); });
  return view;
}
export function juiceCard(texture: Texture, y: number): Container {
  const view = new Container(); view.label = 'juice-card'; view.position.set(JUICE_CARD_X, y);
  view.addChild(juicePart(texture, -1, 0, 362, 77));
  return view;
}
export function juiceButton(label: string, x: number, y: number, width: number, click: () => void, enabled = true, tone: 'green' | 'red' | 'blue' | 'grey' = 'green'): Container {
  const view = new Container(); view.label = 'juice-button:' + label; view.position.set(x, y);
  const edge = tone === 'grey' ? 0x888888 : tone === 'red' ? 0xa00009 : tone === 'blue' ? 0x047289 : 0x003d02;
  const face = tone === 'grey' ? gradient(0xf2f2f2, 0xe5e5e5, 0xcccccc) : tone === 'red' ? gradient(0xff4450, 0xe40012, 0xbe0012) : tone === 'blue' ? gradient(0x51e8ef, 0x03bdda, 0x0586ae) : GREEN;
  view.addChild(new Graphics().roundRect(-1, 1, width + 2, 25, 4).fill({ color: 0, alpha: .23 })
    .roundRect(0, 0, width, 23, 4).fill(edge).roundRect(1.4, 1.4, width - 2.8, 20.2, 3).fill(face)
    .roundRect(3, 2, width - 6, 7, 2).fill({ color: 0xffffff, alpha: .14 }));
  const text = juiceText(label, 0, 1, label.length > 20 ? 11 : 15, tone === 'grey' ? 0x999999 : 0xffffff, '700', tone === 'grey' ? 0xeeeeee : edge);
  text.x = (width - text.width) / 2; view.addChild(text);
  view.alpha = enabled ? 1 : .55; view.eventMode = enabled ? 'static' : 'none'; view.cursor = 'pointer';
  view.hitArea = new Rectangle(0, 0, width, 26);
  view.on('pointertap', event => { event.stopPropagation(); click(); });
  view.on('pointerover', () => { view.tint = 0xe4ffff; }); view.on('pointerout', () => { view.tint = 0xffffff; });
  return view;
}
export function juiceProgress(value: number): Graphics {
  const width = 95 * Math.max(0, Math.min(1, value));
  const view = new Graphics().roundRect(0, 0, 100, 14, 2).fill(0x6d361a)
    .roundRect(2, 2, 96, 10, 1).fill(gradient(0x7e592c, 0x936635));
  if (width > 0) {
    view.roundRect(2.5, 2.5, width, 8.5, 1).fill(gradient(0x96fff5, 0x27d4f5, 0x1b91eb));
    for (let x = 4; x < width - 7; x += 17) view.poly([x, 11, x + 6, 2.5, x + 13, 2.5, x + 7, 11]).fill({ color: 0xffffff, alpha: .23 });
  }
  return view;
}
export function juiceSmile(): Graphics {
  return new Graphics().circle(8, 8, 7).fill(0xffd222).stroke({ color: 0x9e680c, width: 1 })
    .circle(5.5, 5.5, 1).fill(0x352303).circle(10.5, 5.5, 1).fill(0x352303)
    .moveTo(4, 9).quadraticCurveTo(8, 14, 12, 9).stroke({ color: 0x6f360b, width: 1.4 });
}

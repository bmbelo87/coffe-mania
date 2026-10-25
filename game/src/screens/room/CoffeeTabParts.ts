import { Container, Rectangle, Sprite, Texture } from 'pixi.js';

const slices = new WeakMap<Texture, { cap: Texture; stem: Texture; edge: Texture }>();
/** The rounded cap stays undistorted; only the upright stem continues behind the front panel. */
export function coffeeTabSkin(texture: Texture, active: boolean, width: number, height: number): Container {
  let parts = slices.get(texture);
  if (!parts) {
    const nativeHeight = active ? 47 : 43, scale = texture.height / nativeHeight, capHeight = 39 * scale;
    const region = (top: number, h: number) => new Texture({ source: texture.source,
      frame: new Rectangle(texture.frame.x, texture.frame.y + top, texture.width, h) });
    parts = { cap: region(0, capHeight), stem: region(capHeight - scale, scale), edge: region(texture.height - 3 * scale, 3 * scale) };
    slices.set(texture, parts);
  }
  const view = new Container(); view.eventMode = 'none';
  const add = (texture: Texture, y: number, h: number) => { const sprite = new Sprite(texture); sprite.width = width; sprite.height = h; sprite.y = y; sprite.eventMode = 'none'; view.addChild(sprite); };
  add(parts.cap, 0, 39); add(parts.stem, 39, height - 39);
  if (!active) add(parts.edge, 39, 3);
  return view;
}

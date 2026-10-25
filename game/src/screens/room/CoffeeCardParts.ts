import { Container, Rectangle, Sprite, Texture } from 'pixi.js';

const regions = new WeakMap<Texture, Map<string, Texture>>();

/** Clean source pixels only: the reference's lettering, drink and button are never rendered.
 * Measures are normalized to the 391×89 card in the newer-interface video. */
export function coffeeCard(source: Texture, portrait: Texture | undefined): Container {
  const view = new Container(); view.eventMode = 'none';
  const piece = (sx: number, sy: number, sw: number, sh: number, x: number, y: number, w: number, h: number) => {
    const rx = source.width / 391, ry = source.height / 89;
    let cache = regions.get(source);
    if (!cache) { cache = new Map(); regions.set(source, cache); }
    const key = [sx, sy, sw, sh].join(':');
    let texture = cache.get(key);
    if (!texture) {
      texture = new Texture({ source: source.source,
        frame: new Rectangle(source.frame.x + sx * rx, source.frame.y + sy * ry, sw * rx, sh * ry) });
      cache.set(key, texture);
    }
    const sprite = new Sprite(texture); sprite.position.set(x, y); sprite.width = w; sprite.height = h; sprite.eventMode = 'none';
    view.addChild(sprite);
  };
  // Flat interior sampled beside the title, followed by the original narrow border.
  piece(72, 24, 4, 4, 7, 7, 377, 75);
  piece(0, 0, 8, 8, 0, 0, 8, 8); piece(383, 0, 8, 8, 383, 0, 8, 8);
  piece(0, 81, 8, 8, 0, 81, 8, 8); piece(383, 81, 8, 8, 383, 81, 8, 8);
  piece(8, 0, 375, 7, 8, 0, 375, 7); piece(8, 82, 375, 7, 8, 82, 375, 7);
  piece(0, 8, 7, 73, 0, 8, 7, 73); piece(384, 8, 7, 73, 384, 8, 7, 73);
  if (portrait) {
    const sprite = new Sprite(portrait); sprite.position.set(8, 15); sprite.width = 60; sprite.height = 66; sprite.eventMode = 'none'; view.addChild(sprite);
  }
  // Left/right caps and an unlettered middle preserve the original strip color and tiny corners.
  for (const y of [31, 56]) {
    piece(79, y, 6, 21, 79, y, 6, 21);
    piece(237, y, 13, 21, 85, y, 172, 21);
    piece(257, y, 6, 21, 257, y, 6, 21);
  }
  return view;
}

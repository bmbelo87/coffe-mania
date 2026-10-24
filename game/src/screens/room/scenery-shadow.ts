import { Graphics, type PointData, type Sprite } from 'pixi.js';

type ContactEllipse = { center: readonly [number, number]; radius: readonly [number, number] };
type ContactProfile = {
  size: readonly [number, number];
  alpha: number;
  ellipses?: readonly ContactEllipse[];
  polygon?: readonly (readonly [number, number])[];
  padding?: number;
};

/** Native PNG measurements of the ground-facing surfaces, not the lowest image vertex. */
export const SCENERY_CONTACTS = {
  stall: {
    size: [800, 640], alpha: 0.23,
    polygon: [[122.5, 545], [296.5, 627], [682, 475], [508, 393]], padding: 14,
  },
  vendor: { size: [400, 640], alpha: 0.43, ellipses: [{ center: [226, 620], radius: [42, 14] }] },
  'land-sign': { size: [476, 616], alpha: 0.43, ellipses: [{ center: [238, 582], radius: [66, 33] }] },
  'expansion-sign': { size: [600, 560], alpha: 0.43, ellipses: [
    { center: [175, 385], radius: [44, 22] }, { center: [450, 536], radius: [44, 22] },
  ] },
} as const satisfies Record<string, ContactProfile>;

/** Parallel expansion preserves the artwork's own diagonals instead of forcing its
 * feet onto an ideal tile. Screen-space points run counterclockwise. */
export function expandContactPolygon(points: readonly (readonly [number, number])[], padding: number): number[] {
  const edges = points.map((point, i) => {
    const next = points[(i + 1) % points.length];
    const dx = next[0] - point[0], dy = next[1] - point[1], length = Math.hypot(dx, dy);
    return { nx: -dy / length, ny: dx / length, c: (-dy * point[0] + dx * point[1]) / length + padding };
  });
  return edges.flatMap((edge, i) => {
    const previous = edges[(i + edges.length - 1) % edges.length];
    const det = previous.nx * edge.ny - edge.nx * previous.ny;
    return [(previous.c * edge.ny - edge.c * previous.ny) / det,
      (previous.nx * edge.c - edge.nx * previous.c) / det];
  });
}

/** The shadow shares the art's image transform. `origin` translates a nested sign
 * into its parent's ground layer without adjusting the contact inside the PNG. */
export function createSceneryShadow(kind: keyof typeof SCENERY_CONTACTS, sprite: Sprite, origin: PointData = { x: 0, y: 0 }): Graphics {
  const profile: ContactProfile = SCENERY_CONTACTS[kind];
  const width = sprite.texture.width, height = sprite.texture.height;
  const x = (value: number) => value * width / profile.size[0] - sprite.anchor.x * width;
  const y = (value: number) => value * height / profile.size[1] - sprite.anchor.y * height;
  const shadow = new Graphics();
  if (profile.polygon) {
    const points = expandContactPolygon(profile.polygon, profile.padding ?? 0);
    shadow.poly(points.map((value, i) => i % 2 ? y(value) : x(value))).fill(0x0a0c09);
  }
  for (const ellipse of profile.ellipses ?? []) {
    shadow.ellipse(x(ellipse.center[0]), y(ellipse.center[1]),
      ellipse.radius[0] * width / profile.size[0], ellipse.radius[1] * height / profile.size[1]).fill(0x0a0c09);
  }
  shadow.label = `scenery:${kind}:ground-shadow`;
  shadow.alpha = profile.alpha;
  shadow.eventMode = 'none';
  shadow.position.set(origin.x + sprite.x, origin.y + sprite.y);
  shadow.scale.copyFrom(sprite.scale);
  shadow.pivot.copyFrom(sprite.pivot);
  shadow.skew.copyFrom(sprite.skew);
  shadow.rotation = sprite.rotation;
  return shadow;
}

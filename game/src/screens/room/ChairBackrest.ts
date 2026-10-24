import { Graphics, type Sprite, type Texture } from 'pixi.js';
import { rotatedArt, type IndoorArtEntry } from '../../game/indoor-art';
import type { RoomItem } from '../../world/RoomModel';
import { createArtView } from './iso-art';
import { setItemOverlayDepth } from './RoomDepthSorter';

/** Reuses the chair pixels. Authored masks isolate the backrest without promoting
 * its seat, shadow or PNG margins in front of the seated body. */
export function createChairBackrest(item: RoomItem, entry: IndoorArtEntry, texture: Texture): Sprite | undefined {
  const shape = entry.seatingBackrests?.find(mask => mask.rotation === item.rotation);
  if (!shape) return undefined;
  const { frame } = rotatedArt(entry, item.rotation);
  const view = createArtView(item, frame, texture, { suffix: ':backrest' });
  const mask = new Graphics();
  // The texture and stencil must snap to the same physical pixel at fractional zooms.
  mask.roundPixels = view.roundPixels;
  for (const polygon of shape.polygons) mask.poly(polygon).fill(0xffffff);
  mask.eventMode = 'none';
  view.addChild(mask);
  view.mask = mask;
  view.eventMode = 'none';
  view.visible = false;
  setItemOverlayDepth(view, item, 2);
  return view;
}

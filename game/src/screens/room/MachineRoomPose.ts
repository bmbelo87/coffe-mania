import type { Sprite } from 'pixi.js';
import type { MachinePose } from '../../game/machine-poses';
import type { RoomItem } from '../../world/RoomModel';
import { tileToScreenX, tileToScreenY } from '../../world/iso';
import { alphaHitArea } from './alpha-hit';

/** Texture, picking and registration change together; the item's ground geometry remains authoritative. */
export function applyMachineRoomPose(view: Sprite, item: RoomItem, pose: MachinePose, label: string): void {
  view.texture = pose.texture;
  view.scale.set(pose.frame.width / pose.texture.width, pose.frame.height / pose.texture.height);
  view.position.set(tileToScreenX(item.tx, item.ty) + pose.frame.left, tileToScreenY(item.tx, item.ty) + pose.frame.top);
  view.hitArea = alphaHitArea(pose.texture);
  view.label = label;
}

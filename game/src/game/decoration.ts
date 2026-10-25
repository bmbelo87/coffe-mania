import type { RoomCatalogItem, RoomUnit } from './room-inventory';
import type { SharedActor } from './room-realtime';
import type { RoomItem } from '../world/RoomModel';
import type { Tile } from '../world/iso';

/** NPCs never veto decoration. Furniture/room geometry is validated separately; other
 * humans retain their occupancy protection on both ends of an interpolated step. */
export function actorsAllowDecoration(item: RoomCatalogItem, tile: Tile, rotation: number, id: string | undefined, actors: Iterable<SharedActor>): boolean {
  const sx = rotation % 2 ? item.sizeY : item.sizeX, sy = rotation % 2 ? item.sizeX : item.sizeY;
  for (const actor of actors) {
    if (actor.kind === 'npc' || actor.kind === 'waiter') continue;
    if (id && (actor.chairId === id || actor.tableId === id)) return false;
    if (item.type < 2 || item.kind === 'window' || item.kind === 'panel') continue;
    for (const position of [actor, ...(actor.move ? [actor.move.from, actor.move.to] : [])]) {
      if (position.tx >= tile.tx && position.ty >= tile.ty && position.tx < tile.tx + sx && position.ty < tile.ty + sy) return false;
    }
  }
  return true;
}

/** A finishing customer stays on their old visual support; never look up the moved
 * instance's new position to place their body or meal. This does not draw a ghost item. */
export function detachedDecorationItem(unit: RoomUnit | undefined, catalog: readonly RoomCatalogItem[]): RoomItem | undefined {
  if (!unit) return undefined;
  const item = catalog.find(entry => entry.id === unit.itemId);
  if (!item) return undefined;
  return { id: item.id, name: item.name, kind: item.kind, className: item.classname, inventoryUnitId: unit.unitId,
    tx: unit.tx, ty: unit.ty, rotation: unit.rotation,
    sizeX: unit.rotation % 2 ? item.sizeY : item.sizeX, sizeY: unit.rotation % 2 ? item.sizeX : item.sizeY };
}

import type { IndoorArtEntry } from './indoor-art';
export const DEFAULT_SEATING_ANCHOR = { x: 0, y: 8 } as const;
/** Pelvis-to-cushion allowance in room pixels, shared by the authored chair contacts. */
export const SEATING_HIP_CLEARANCE = 3;

export function seatingAnchorFor(entry?: IndoorArtEntry, rotation = 0): { x: number; y: number } | undefined {
  return entry?.seatingAnchors?.find(value => value.rotation === rotation);
}

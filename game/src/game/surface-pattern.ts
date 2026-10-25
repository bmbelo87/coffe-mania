import type { IndoorArtEntry, IndoorArtFrame } from './indoor-art';

/** World-anchored phase keeps a motif continuous across independently owned surface units. */
export function surfacePatternFrame(entry: IndoorArtEntry, x: number, y = 0, rotation = 0): IndoorArtFrame {
  const pattern = entry.surfacePattern;
  if (!pattern) return entry.frames[0];
  const r = ((rotation % 4) + 4) % 4;
  const [u, v] = r === 1 ? [y, -x - 1] : r === 2 ? [-x - 1, -y - 1] : r === 3 ? [-y - 1, x] : [x, y];
  const mod = (n: number, size: number): number => ((n % size) + size) % size;
  return entry.frames[mod(v, pattern.rows) * pattern.columns + mod(u, pattern.columns)];
}

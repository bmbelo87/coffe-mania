/** Public display data only; a social card never needs the player's wallet or credentials. */
export interface SocialPlayer {
  playerId: string;
  displayName: string;
  roomId?: string;
  level: number;
  /** Cumulative experience shown below the level badge. */
  experience: number;
  appearance?: string;
}

/** Six player cards sit between the two permanent invitation cards. */
export const SOCIAL_PAGE_SIZE = 6;

/** An unavailable display name is a neighbour label, never a fabricated player identity. */
export function socialDisplayName(value: string): string {
  return value.trim() || 'Vizinho';
}

export type SocialSlot<T extends SocialPlayer = SocialPlayer> =
  | { kind: 'player'; player: T }
  | { kind: 'empty' }
  | { kind: 'invite' };

/** Keep the server's order and the first entry for each identity. Empty IDs are not players. */
export function uniqueSocialPlayers<T extends SocialPlayer>(players: readonly T[]): T[] {
  const seen = new Set<string>();
  return players.filter(player => {
    const id = player.playerId.trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Invitations occupy their own end slots and never require an extra friends page. */
export function socialPageCount(playerCount: number): number {
  const count = Number.isFinite(playerCount) ? Math.max(0, Math.floor(playerCount)) : 0;
  return Math.max(1, Math.ceil(count / SOCIAL_PAGE_SIZE));
}

export function clampSocialPage(page: number, playerCount: number): number {
  const index = Number.isFinite(page) ? Math.floor(page) : 0;
  return Math.min(socialPageCount(playerCount) - 1, Math.max(0, index));
}

export function socialPageSlots<T extends SocialPlayer>(players: readonly T[], page: number): SocialSlot<T>[] {
  const first = clampSocialPage(page, players.length) * SOCIAL_PAGE_SIZE;
  return [
    { kind: 'invite' },
    ...Array.from({ length: SOCIAL_PAGE_SIZE }, (_, index): SocialSlot<T> => {
      const player = players[first + index];
      return player ? { kind: 'player', player } : { kind: 'empty' };
    }),
    { kind: 'invite' },
  ];
}

/** Missing progress stays visibly missing rather than acquiring an invented level or score. */
export function socialProgressLabel(value: number): string {
  return Number.isFinite(value) && value >= 0 ? String(Math.floor(value)) : '—';
}

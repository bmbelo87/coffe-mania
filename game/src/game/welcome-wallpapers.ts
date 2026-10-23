export interface WelcomeWallpaper {
  id: string;
  file: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface WelcomeCatalog {
  timeZone: string;
  rotationDays: number;
  activeSeason: string | null;
  defaultPool: string[];
  seasons: Record<string, string[]>;
  calendar: { season: string; from: string; through: string }[];
  wallpapers: WelcomeWallpaper[];
}

const ROOT = '/assets/ui/cafe-welcome/';
export const FALLBACK_WALLPAPER: WelcomeWallpaper = {
  id: 'cafe-classico', file: 'cafe-classico.png', alt: 'A entrada original do Café Mania ao pôr do sol, com seus cinco personagens.', width: 1151, height: 825,
};

/** Cosmetic calendar only: it never controls rewards or the shared simulation. */
export function chooseWelcomeWallpaper(catalog: WelcomeCatalog, now = new Date()): WelcomeWallpaper {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: catalog.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  const today = `${value('year')}-${value('month')}-${value('day')}`;
  const season = catalog.activeSeason ?? catalog.calendar.find((entry) => entry.from <= today && today <= entry.through)?.season;
  const configured = season ? catalog.seasons[season] : undefined;
  const pool = (configured?.length ? configured : catalog.defaultPool)
    .map((id) => catalog.wallpapers.find((entry) => entry.id === id)).filter((entry): entry is WelcomeWallpaper => !!entry);
  if (!pool.length) return FALLBACK_WALLPAPER;
  const day = Math.floor(Date.parse(today + 'T00:00:00Z') / 86400000);
  const period = Math.max(1, Math.floor(catalog.rotationDays) || 1);
  return pool[Math.floor(day / period) % pool.length]!;
}

export function wallpaperURL(wallpaper: WelcomeWallpaper): string { return ROOT + wallpaper.file; }

export async function loadWelcomeWallpaper(): Promise<WelcomeWallpaper> {
  try {
    const response = await fetch(ROOT + 'catalog.json', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return FALLBACK_WALLPAPER;
    return chooseWelcomeWallpaper(await response.json() as WelcomeCatalog);
  } catch { return FALLBACK_WALLPAPER; }
}

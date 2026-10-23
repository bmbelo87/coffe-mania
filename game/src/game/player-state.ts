/** Server-owned values. Percentages are derived, never persisted independently. */
export interface ResourceValue {
  current: number;
  maximum: number;
  /** Where the bar starts. Experience is cumulative, so its bar starts at the level's requirement. */
  minimum?: number;
}

export interface PlayerState {
  levelUps?: LevelReward[];
  waiterSlots?: number;
  /** Estoque privado, atualizado pelo snapshot/SSE do PocketBase. */
  spiceInventory?: Record<string, number>;
  /** Versioned JSON string; empty/absent means the catalogue's default avatar. */
  appearance?: string;
  cafeName: string;
  cafeNameChosen?: boolean;
  cash: number;
  gold: number;
  level: number;
  experience: ResourceValue;
  energy: ResourceValue;
  crates: ResourceValue;
  satisfaction: ResourceValue;
}

export interface LevelReward {
  level: number;
  title?: string;
  gold: number;
  /** Novas vagas de funcionários, não contratação automática. */
  waiters: number;
  waiterSlots: number;
  recipes: { id: string; name: string }[];
}

export async function acknowledgeLevel(level: number): Promise<void> {
  const response = await fetch('/api/coffe/level-ups/ack', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Não foi possível confirmar o aviso. Tente novamente.');
}

export function resourcePercentage(value: ResourceValue): number {
  const minimum = value.minimum ?? 0;
  if (!Number.isFinite(value.current) || !Number.isFinite(value.maximum) || !Number.isFinite(minimum) || value.maximum <= minimum) return 0;
  return Math.min(100, Math.max(0, (value.current - minimum) * 100 / (value.maximum - minimum)));
}

/** Unloaded HUDs are hidden; this only keeps isolated screens deterministic. */
export function emptyPlayerState(): PlayerState {
  return {
    cafeName: '',
    cafeNameChosen: false,
    cash: 0, gold: 0, level: 1,
    experience: { current: 0, maximum: 7 },
    energy: { current: 0, maximum: 50 },
    crates: { current: 0, maximum: 4 },
    satisfaction: { current: 0, maximum: 105 },
  };
}

export async function saveCafeName(name: string, initial: boolean): Promise<PlayerState> {
  const response = await fetch('/api/coffe/cafe-name', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, initial }), signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401) {
    window.location.replace('/');
    throw new Error('Sua sessão expirou. Entre novamente.');
  }
  // Another tab may have completed the initial screen while this one was open.
  if (response.status === 409 && initial) {
    const current = await loadPlayerState();
    if (current.cafeNameChosen) return current;
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(error?.message || 'Não foi possível salvar. Tente novamente.');
  }
  return response.json() as Promise<PlayerState>;
}

/** Authenticated snapshot at entry or after realtime notifications; no polling. */
export async function loadPlayerState(signal?: AbortSignal): Promise<PlayerState> {
  let response: Response;
  try {
    response = await fetch('/api/coffe/player-state', {
      credentials: 'same-origin', cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor para carregar seus dados.');
  }
  if (response.status === 401) {
    window.location.replace('/');
    throw new Error('Sua sessão expirou. Entre novamente.');
  }
  if (!response.ok) throw new Error('Não foi possível carregar seus dados. Tente novamente.');
  return response.json() as Promise<PlayerState>;
}

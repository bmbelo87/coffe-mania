export const COFFEE_GROUPS = [
  { id: 'basic', name: 'Básico' }, { id: 'medium', name: 'Médio' },
  { id: 'advanced', name: 'Avançado' }, { id: 'expert', name: 'Expert' },
] as const;
export type CoffeeGroup = typeof COFFEE_GROUPS[number]['id'];

/** Thresholds are cumulative server configuration, never the historical player's served count. */
export function coffeeMastery(count: number, thresholds: readonly number[]) {
  const total = Math.max(0, Math.floor(count));
  const completed = thresholds.filter(goal => total >= goal).length;
  const dominated = completed === thresholds.length && thresholds.length > 0;
  const goal = thresholds[Math.min(completed, thresholds.length - 1)] ?? 1;
  const previous = completed > 0 ? thresholds[completed - 1] ?? 0 : 0;
  return { count: total, level: Math.min(3, completed + 1), dominated, goal,
    progress: dominated ? 1 : Math.min(1, Math.max(0, (total - previous) / Math.max(1, goal - previous))) };
}

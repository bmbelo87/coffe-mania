import type { LevelReward } from './player-state';

/** SSE e respostas HTTP podem repetir o mesmo recibo; cada nível entra uma vez por sessão. */
export class LevelRewardQueue {
  private readonly seen = new Set<number>();
  private readonly pending: LevelReward[] = [];

  add(rewards: readonly LevelReward[]): void {
    for (const reward of rewards) {
      if (this.seen.has(reward.level)) continue;
      this.seen.add(reward.level);
      this.pending.push(reward);
    }
    this.pending.sort((a, b) => a.level - b.level);
  }

  get current(): LevelReward | undefined { return this.pending[0]; }

  dismiss(level: number): void {
    if (this.current?.level === level) this.pending.shift();
  }
}

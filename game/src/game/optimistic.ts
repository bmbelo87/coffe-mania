import type { PlayerState } from './player-state';

/**
 * Resposta imediata (A5): o cliente mostra o resultado provável de uma ação na hora e o
 * servidor continua decidindo. Estas peças guardam as previsões até a resposta chegar.
 */

export type BalanceDelta = Partial<Record<'gold' | 'cash' | 'energy' | 'crates', number>>;

type Balances = Record<keyof BalanceDelta, number>;
const KEYS = ['gold', 'cash', 'energy', 'crates'] as const;

/** What a window needs to show a balance change at once (RoomScreen.predictBalance/settleBalance). */
export interface BalancePrediction {
  predict(delta: BalanceDelta): number | undefined;
  settle(token: number | undefined, accepted: boolean): void;
}

/** A player state with a change applied, for windows that draw their own copy of it. */
export function withBalance(state: PlayerState, delta: BalanceDelta): PlayerState {
  return {
    ...state,
    gold: state.gold + (delta.gold ?? 0), cash: state.cash + (delta.cash ?? 0),
    energy: { ...state.energy, current: state.energy.current + (delta.energy ?? 0) },
    crates: { ...state.crates, current: state.crates.current + (delta.crates ?? 0) },
  };
}

function balances(state: PlayerState): Balances {
  return { gold: state.gold, cash: state.cash, energy: state.energy.current, crates: state.crates.current };
}

/**
 * Saldos previstos por cima do estado do servidor. Cada mudança que o servidor mostra abate as
 * previsões pendentes em ordem (um débito abate débitos; um ganho, ganhos), então pintar vários
 * tiles seguidos nunca conta o mesmo gasto duas vezes. Ganhos de outra origem no mesmo intervalo
 * (um cliente pagando) não abatem um débito; a previsão sai com a resposta da ação (`settle`).
 */
export class PredictedBalance {
  private readonly pending = new Map<number, Balances>();
  private last?: Balances;
  private next = 0;

  get size(): number { return this.pending.size; }

  add(delta: BalanceDelta, server: PlayerState): number {
    this.consume(balances(server));
    const token = ++this.next;
    this.pending.set(token, { gold: delta.gold ?? 0, cash: delta.cash ?? 0, energy: delta.energy ?? 0, crates: delta.crates ?? 0 });
    return token;
  }

  settle(token: number): void { this.pending.delete(token); }

  clear(): void { this.pending.clear(); }

  /** O estado do servidor com o que ainda falta ele mostrar. */
  apply(server: PlayerState): PlayerState {
    const now = balances(server);
    this.consume(now);
    const shown: Balances = { ...now };
    for (const remaining of this.pending.values()) {
      for (const key of KEYS) shown[key] += remaining[key];
    }
    return {
      ...server,
      gold: Math.max(0, shown.gold), cash: Math.max(0, shown.cash),
      energy: { ...server.energy, current: Math.max(0, shown.energy) },
      crates: { ...server.crates, current: Math.max(0, shown.crates) },
    };
  }

  private consume(now: Balances): void {
    const last = this.last;
    this.last = now;
    if (!last) return;
    for (const key of KEYS) {
      let change = now[key] - last[key];
      for (const remaining of this.pending.values()) {
        if (change === 0) break;
        const value = remaining[key];
        if (value === 0 || Math.sign(value) !== Math.sign(change)) continue;
        const taken = Math.sign(value) * Math.min(Math.abs(value), Math.abs(change));
        remaining[key] -= taken;
        change -= taken;
      }
    }
    for (const [token, remaining] of this.pending) if (KEYS.every((key) => remaining[key] === 0)) this.pending.delete(token);
  }
}

/**
 * Fila em ordem: cada tarefa só começa quando a anterior terminou, com sucesso ou não. As
 * colocações de móveis usam a revisão devolvida pela anterior, então não podem se cruzar.
 */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private count = 0;

  get pending(): number { return this.count; }

  run<T>(task: () => Promise<T>): Promise<T> {
    this.count++;
    const result = this.tail.then(task, task);
    this.tail = result.then(() => undefined, () => undefined).finally(() => { this.count--; });
    return result;
  }
}

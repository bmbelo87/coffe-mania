import type { CoffeeSnapshot } from './coffees';

export class CoffeeClient {
  private pending?: { key: string; requestId: string };
  async refresh(): Promise<CoffeeSnapshot> {
    return this.read(await fetch('/api/coffe/coffees', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) }));
  }
  async act(action: 'select' | 'serve' | 'recharge', machineId: string,
            extra: { recipeId?: string; actorId?: string; coffeeRequestId?: string } = {}): Promise<CoffeeSnapshot> {
    const key = JSON.stringify([action, machineId, extra]);
    // An ambiguous network failure retains its idempotency key until retried or superseded.
    // Starting another operation invalidates the old key: a later selection is a new intent.
    const operation = this.pending?.key === key ? this.pending : { key, requestId: crypto.randomUUID() };
    this.pending = operation;
    const response = await fetch('/api/coffe/coffees/' + action, { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ machineId, requestId: operation.requestId, ...extra }),
      signal: AbortSignal.timeout(12000) });
    try {
      const state = await this.read(response);
      if (this.pending === operation) this.pending = undefined;
      return state;
    } catch (error) {
      // A truncated success response is ambiguous too: keep the same receipt for a retry.
      if (response.status >= 400 && response.status < 500 && this.pending === operation) this.pending = undefined;
      throw error;
    }
  }
  private async read(response: Response): Promise<CoffeeSnapshot> {
    const body = await response.json() as CoffeeSnapshot & { message?: string };
    if (!response.ok) throw new Error(body.message ?? 'Não foi possível atualizar os cafés.');
    return body;
  }
}

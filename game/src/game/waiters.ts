export interface Employee { id: string; name: string; appearance: string }
export interface WaiterSnapshot { employees: Employee[]; candidates: Employee[]; unlockLevels: number[]; slots: number }
export class WaiterClient {
  async request(candidateId?: string): Promise<WaiterSnapshot> {
    const response = await fetch(`/api/coffe/waiters${candidateId ? '/hire' : ''}`, {
      method: candidateId ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      ...(candidateId ? { body: JSON.stringify({ candidateId }) } : {}), signal: AbortSignal.timeout(15000),
    });
    const data = await response.json() as WaiterSnapshot & { message?: string };
    if (!response.ok) throw new Error(data.message ?? 'Não foi possível carregar os empregados.');
    return data;
  }
}

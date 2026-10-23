/** Session intents only: the server still validates movement, cost and each stove action. */
export class ChefQueue<T extends { stoveKey: string }> {
  private readonly tasks: T[] = [];
  enqueue(task: T): boolean {
    if (this.has(task.stoveKey)) return false;
    this.tasks.push(task); return true;
  }
  has(stoveKey: string): boolean { return this.tasks.some(task => task.stoveKey === stoveKey); }
  take(): T | undefined { return this.tasks.shift(); }
  clear(): void { this.tasks.length = 0; }
  get size(): number { return this.tasks.length; }
}

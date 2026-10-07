import type { QueuedAction, QueueStore } from './queue';

/** In-memory QueueStore for tests. */
export class MemoryStore implements QueueStore {
  private readonly items = new Map<string, QueuedAction>();

  async list(): Promise<QueuedAction[]> {
    return [...this.items.values()];
  }

  async put(a: QueuedAction): Promise<void> {
    this.items.set(a.id, a);
  }

  async remove(id: string): Promise<void> {
    this.items.delete(id);
  }
}

export class TtlCache<T> {
  private readonly storage = new Map<string, { expiresAt: number; value: T }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const item = this.storage.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiresAt) {
      this.storage.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key: string, value: T): void {
    this.storage.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }
}

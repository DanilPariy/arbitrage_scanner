type Unsubscribe = () => void;

// Map of event name -> payload type
export type EventMap = Record<string, unknown>;

export class TypedBus<E extends EventMap> {
  private handlers: {
    [K in keyof E]?: Set<(payload: E[K]) => void>;
  } = {};

  on<K extends keyof E>(event: K, handler: (payload: E[K]) => void): Unsubscribe {
    const set = (this.handlers[event] ??= new Set());
    set.add(handler);
    return () => set.delete(handler);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.handlers[event];
    if (!set || set.size === 0) return;
    for (const handler of set) handler(payload);
  }

  clear(): void {
    for (const key of Object.keys(this.handlers) as (keyof E)[]) {
      this.handlers[key]?.clear();
    }
  }
}

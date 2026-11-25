import type { CoreEventMap, CoreEventName } from "@terrascope/plugin-api";

type Handler = (payload: unknown) => void;

/**
 * Small typed pub/sub bus. A throwing subscriber never breaks the emitter or
 * other subscribers — plugin errors must not take the application down.
 */
export class EventBus {
  private handlers = new Map<string, Set<Handler>>();

  on<K extends CoreEventName>(event: K, handler: (payload: CoreEventMap[K]) => void): () => void {
    const fn = handler as Handler;
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  }

  once<K extends CoreEventName>(event: K, handler: (payload: CoreEventMap[K]) => void): () => void {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  emit<K extends CoreEventName>(event: K, payload: CoreEventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (error) {
        console.error(`[core] event handler for "${event}" failed`, error);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

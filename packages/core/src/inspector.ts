import type {
  Coordinate,
  InspectorEntry,
  InspectorResult,
  LayerInfo,
} from "@terrascope/plugin-api";

export interface RegisteredInspector extends InspectorEntry {
  pluginId: string;
}

function timeout(ms: number, signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error("Inspector timed out.")), ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/** Asks every active plugin that can supply a value at the clicked coordinate. */
export class InspectorService {
  private entries: RegisteredInspector[] = [];

  register(pluginId: string, entry: InspectorEntry): () => void {
    this.remove(pluginId, entry.id);
    this.entries.push({ ...entry, pluginId });
    return () => this.remove(pluginId, entry.id);
  }

  remove(pluginId: string, id: string): void {
    this.entries = this.entries.filter((entry) => !(entry.pluginId === pluginId && entry.id === id));
  }

  removeAll(pluginId: string): void {
    this.entries = this.entries.filter((entry) => entry.pluginId !== pluginId);
  }

  list(): RegisteredInspector[] {
    return [...this.entries].sort((a, b) => (b.priority ?? 100) - (a.priority ?? 100));
  }

  async inspect(
    coordinate: Coordinate,
    time: string,
    layers: LayerInfo[],
    signal: AbortSignal,
  ): Promise<InspectorResult[]> {
    const candidates = this.list().filter((entry) => {
      try {
        return entry.supports ? entry.supports(coordinate, { time, layers }) : true;
      } catch {
        return false;
      }
    });

    const settled = await Promise.all(
      candidates.map(async (entry) => {
        try {
          const result = await Promise.race([
            entry.inspect(coordinate, { time, signal, layers }),
            timeout(10_000, signal),
          ]);
          return result;
        } catch (error) {
          if (signal.aborted) throw error;
          console.warn(`[core] inspector "${entry.pluginId}.${entry.id}" failed`, error);
          return null;
        }
      }),
    );

    return settled.filter((result): result is InspectorResult => result !== null);
  }
}

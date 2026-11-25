import type {
  DataApi,
  JsonValue,
  RasterProvider,
  TimeSeriesProvider,
  TimeSeriesRequest,
  TimeSeriesResult,
  TileRequest,
  TileResponse,
} from "@terrascope/plugin-api";

const JSON_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 120;

/**
 * Provider registry and fetch infrastructure. The core ships no data sources:
 * every source is registered by a plugin.
 */
export class DataService implements DataApi {
  private rasterProviders = new Map<string, RasterProvider>();
  private seriesProviders = new Map<string, TimeSeriesProvider>();
  private cache = new Map<string, { value: unknown; expires: number }>();

  registerRasterProvider(provider: RasterProvider): () => void {
    this.rasterProviders.set(provider.id, provider);
    return () => {
      if (this.rasterProviders.get(provider.id) === provider) this.rasterProviders.delete(provider.id);
    };
  }

  registerTimeSeriesProvider(provider: TimeSeriesProvider): () => void {
    this.seriesProviders.set(provider.id, provider);
    return () => {
      if (this.seriesProviders.get(provider.id) === provider) this.seriesProviders.delete(provider.id);
    };
  }

  getRasterProvider(id: string): RasterProvider | undefined {
    return this.rasterProviders.get(id);
  }

  getTimeSeriesProvider(id: string): TimeSeriesProvider | undefined {
    return this.seriesProviders.get(id);
  }

  async getTile(providerId: string, request: TileRequest): Promise<TileResponse> {
    const provider = this.rasterProviders.get(providerId);
    if (!provider) throw new Error(`Unknown raster provider "${providerId}".`);
    return provider.getTile(request);
  }

  async getSeries(providerId: string, request: TimeSeriesRequest): Promise<TimeSeriesResult> {
    const provider = this.seriesProviders.get(providerId);
    if (!provider) throw new Error(`Unknown time series provider "${providerId}".`);
    return provider.getSeries(request);
  }

  async fetchJson<T = JsonValue>(
    url: string,
    options?: { signal?: AbortSignal; headers?: Record<string, string> },
  ): Promise<T> {
    const cached = this.cache.get(url);
    if (cached && cached.expires > Date.now()) return cached.value as T;
    const response = await fetch(url, {
      ...(options?.signal ? { signal: options.signal } : {}),
      ...(options?.headers ? { headers: options.headers } : {}),
    });
    if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
    const value: unknown = await response.json();
    this.cache.set(url, { value, expires: Date.now() + JSON_TTL_MS });
    if (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    return value as T;
  }

  async fetchArrayBuffer(url: string, options?: { signal?: AbortSignal }): Promise<ArrayBuffer> {
    const response = await fetch(url, options?.signal ? { signal: options.signal } : {});
    if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
    return response.arrayBuffer();
  }

  removeAll(pluginId: string): void {
    for (const id of [...this.rasterProviders.keys()]) {
      if (id.startsWith(`${pluginId}.`)) this.rasterProviders.delete(id);
    }
    for (const id of [...this.seriesProviders.keys()]) {
      if (id.startsWith(`${pluginId}.`)) this.seriesProviders.delete(id);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

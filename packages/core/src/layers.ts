import type {
  BlendMode,
  LayerDescriptor,
  LayerInfo,
  SourceInfo,
} from "@terrascope/plugin-api";
import type { EventBus } from "./events.js";

export function validateDescriptor(descriptor: LayerDescriptor): string[] {
  const errors: string[] = [];
  if (!descriptor.id) errors.push("Layer descriptor is missing an id.");
  if (!descriptor.name) errors.push(`Layer "${descriptor.id}" is missing a name.`);
  if (!descriptor.unit) errors.push(`Layer "${descriptor.id}" is missing a unit.`);
  const source: Partial<SourceInfo> = descriptor.source ?? {};
  for (const field of ["name", "url", "license", "attribution"] as const) {
    if (!source[field]) errors.push(`Layer "${descriptor.id}" is missing source.${field}.`);
  }
  if (descriptor.kind === "raster" && descriptor.tiles.length === 0) {
    errors.push(`Raster layer "${descriptor.id}" has no tile templates.`);
  }
  if (descriptor.kind === "hillshade" && descriptor.demTiles.length === 0) {
    errors.push(`Hillshade layer "${descriptor.id}" has no DEM tile templates.`);
  }
  if (descriptor.opacity !== undefined && (descriptor.opacity < 0 || descriptor.opacity > 1)) {
    errors.push(`Layer "${descriptor.id}" opacity must be between 0 and 1.`);
  }
  return errors;
}

interface Entry {
  info: LayerInfo;
  seq: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Ordered layer registry. Holds no rendering code and no data; the map adapter
 * consumes the ordered list.
 */
export class LayerRegistry {
  private entries = new Map<string, Entry>();
  private sequence = 0;
  private listeners = new Set<(layers: LayerInfo[]) => void>();

  constructor(private events: EventBus) {}

  add(pluginId: string, descriptor: LayerDescriptor): LayerInfo {
    const errors = validateDescriptor(descriptor);
    if (errors.length > 0) throw new Error(errors.join(" "));
    const uid = `${pluginId}:${descriptor.id}`;
    if (this.entries.has(uid)) throw new Error(`Layer "${uid}" is already registered.`);
    const info: LayerInfo = {
      ...descriptor,
      uid,
      pluginId,
      visible: descriptor.visible ?? true,
      opacity: clamp01(descriptor.opacity ?? 1),
      blendMode: descriptor.blendMode ?? "normal",
      zIndex: descriptor.zIndex ?? 0,
    };
    this.entries.set(uid, { info, seq: this.sequence++ });
    this.emitChange();
    this.events.emit("layer:added", info);
    return info;
  }

  update(pluginId: string, id: string, patch: Partial<LayerDescriptor>): void {
    const uid = `${pluginId}:${id}`;
    const entry = this.entries.get(uid);
    if (!entry) return;
    const next = {
      ...entry.info,
      ...patch,
      uid,
      pluginId,
      opacity: patch.opacity === undefined ? entry.info.opacity : clamp01(patch.opacity),
    } as LayerInfo;
    entry.info = next;
    this.emitChange();
    this.events.emit("layer:updated", next);
  }

  remove(pluginId: string, id: string): void {
    const uid = `${pluginId}:${id}`;
    if (!this.entries.has(uid)) return;
    this.entries.delete(uid);
    this.emitChange();
    this.events.emit("layer:removed", { uid });
  }

  removeAll(pluginId: string): void {
    let changed = false;
    for (const [uid, entry] of [...this.entries]) {
      if (entry.info.pluginId !== pluginId) continue;
      this.entries.delete(uid);
      changed = true;
      this.events.emit("layer:removed", { uid });
    }
    if (changed) this.emitChange();
  }

  get(id: string, pluginId?: string): LayerInfo | undefined {
    if (pluginId) return this.entries.get(`${pluginId}:${id}`)?.info;
    const exact = this.entries.get(id);
    if (exact) return exact.info;
    return [...this.entries.values()].find((entry) => entry.info.id === id)?.info;
  }

  list(): LayerInfo[] {
    return [...this.entries.values()]
      .sort((a, b) => a.info.zIndex - b.info.zIndex || a.seq - b.seq)
      .map((entry) => entry.info);
  }

  setVisibility(id: string, visible: boolean, pluginId?: string): void {
    const entry = this.find(id, pluginId);
    if (!entry) return;
    entry.info = { ...entry.info, visible };
    this.emitChange();
    this.events.emit("layer:updated", entry.info);
  }

  setOpacity(id: string, opacity: number, pluginId?: string): void {
    const entry = this.find(id, pluginId);
    if (!entry) return;
    entry.info = { ...entry.info, opacity: clamp01(opacity) };
    this.emitChange();
    this.events.emit("layer:updated", entry.info);
  }

  setBlendMode(id: string, blendMode: BlendMode, pluginId?: string): void {
    const entry = this.find(id, pluginId);
    if (!entry) return;
    entry.info = { ...entry.info, blendMode };
    this.emitChange();
    this.events.emit("layer:updated", entry.info);
  }

  setOrder(pluginId: string, ids: string[]): void {
    ids.forEach((id, index) => {
      const entry = this.entries.get(`${pluginId}:${id}`);
      if (!entry) return;
      entry.info = { ...entry.info, zIndex: index };
    });
    this.emitChange();
  }

  onChange(handler: (layers: LayerInfo[]) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  private find(id: string, pluginId?: string): Entry | undefined {
    if (pluginId) return this.entries.get(`${pluginId}:${id}`);
    return this.entries.get(id) ?? [...this.entries.values()].find((entry) => entry.info.id === id);
  }

  private emitChange(): void {
    const layers = this.list();
    for (const listener of this.listeners) {
      try {
        listener(layers);
      } catch (error) {
        console.error("[core] layer listener failed", error);
      }
    }
  }
}

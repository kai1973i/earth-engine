import type { SlotEntry, SlotName } from "@terrascope/plugin-api";

export const SLOT_NAMES: SlotName[] = [
  "sidebar",
  "toolbar",
  "map-overlay",
  "legend",
  "detail",
  "settings",
  "context-menu",
  "statusbar",
];

export interface RegisteredSlot extends SlotEntry {
  pluginId: string;
}

/** Holds plugin UI contributions until the React `<SlotHost>` mounts them. */
export class SlotRegistry {
  private entries: RegisteredSlot[] = [];
  private listeners = new Set<(entries: RegisteredSlot[]) => void>();

  register(pluginId: string, entry: SlotEntry): () => void {
    if (!SLOT_NAMES.includes(entry.slot)) {
      throw new Error(`Unknown UI slot "${entry.slot}".`);
    }
    if (!entry.id || !entry.title) {
      throw new Error("A slot entry needs an id and a title.");
    }
    this.remove(pluginId, entry.id);
    this.entries.push({ ...entry, pluginId });
    this.entries.sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.title.localeCompare(b.title));
    this.emit();
    return () => this.remove(pluginId, entry.id);
  }

  remove(pluginId: string, id: string): void {
    const before = this.entries.length;
    this.entries = this.entries.filter((entry) => !(entry.pluginId === pluginId && entry.id === id));
    if (this.entries.length !== before) this.emit();
  }

  removeAll(pluginId: string): void {
    const before = this.entries.length;
    this.entries = this.entries.filter((entry) => entry.pluginId !== pluginId);
    if (this.entries.length !== before) this.emit();
  }

  list(slot?: SlotName): RegisteredSlot[] {
    return slot ? this.entries.filter((entry) => entry.slot === slot) : [...this.entries];
  }

  onChange(handler: (entries: RegisteredSlot[]) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  private emit(): void {
    const entries = this.list();
    for (const listener of this.listeners) {
      try {
        listener(entries);
      } catch (error) {
        console.error("[core] slot listener failed", error);
      }
    }
  }
}

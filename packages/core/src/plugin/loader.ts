import type { PluginApi, PluginDefinition, PluginManifest } from "@terrascope/plugin-api";
import type { EventBus } from "../events.js";
import { validateManifest } from "../manifest.js";
import { satisfies } from "../version.js";

export type PluginStatus = "installed" | "active" | "error";

export interface PluginRecord {
  id: string;
  manifest: PluginManifest;
  status: PluginStatus;
  error?: string;
}

export interface CreateApiResult {
  api: PluginApi;
  dispose(): void;
}

export interface PluginLoaderOptions {
  coreApiVersion: string;
  events: EventBus;
  createApi(manifest: PluginManifest): CreateApiResult;
}

interface InternalRecord {
  definition: PluginDefinition;
  status: PluginStatus;
  error?: string;
  dispose?: () => void;
}

/**
 * Owns the plugin lifecycle. A failing plugin is isolated: it is marked as
 * errored, its contributions are disposed, and the application keeps running.
 */
export class PluginLoader {
  private records = new Map<string, InternalRecord>();
  private listeners = new Set<(records: PluginRecord[]) => void>();

  constructor(private options: PluginLoaderOptions) {}

  install(definition: PluginDefinition): PluginRecord {
    const errors = validateManifest(definition.manifest);
    if (errors.length > 0) throw new Error(`Invalid manifest: ${errors.join(" ")}`);
    if (typeof definition.activate !== "function") {
      throw new Error(`Plugin "${definition.manifest.id}" has no activate() function.`);
    }
    const { id, version, coreApi } = definition.manifest;
    if (!satisfies(this.options.coreApiVersion, coreApi)) {
      throw new Error(
        `Plugin "${id}" requires core API "${coreApi}", but this core provides ${this.options.coreApiVersion}.`,
      );
    }
    if (this.records.has(id)) {
      const existing = this.records.get(id);
      if (existing?.definition.manifest.version === version) return this.toRecord(id);
      throw new Error(`Plugin "${id}" is already installed with version ${existing?.definition.manifest.version}.`);
    }

    this.records.set(id, { definition, status: "installed" });
    this.emit();
    return this.toRecord(id);
  }

  async activate(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record || record.status === "active") return;

    for (const [dependencyId] of Object.entries(record.definition.manifest.dependencies ?? {})) {
      if (!this.records.has(dependencyId)) {
        this.fail(id, `Missing dependency "${dependencyId}".`);
        return;
      }
      if (this.records.get(dependencyId)?.status !== "active") {
        await this.activate(dependencyId);
      }
    }

    let created: CreateApiResult | null = null;
    try {
      created = this.options.createApi(record.definition.manifest);
      await record.definition.activate(created.api);
      record.status = "active";
      record.error = undefined;
      record.dispose = created.dispose;
      this.options.events.emit("plugin:activated", {
        id,
        version: record.definition.manifest.version,
      });
    } catch (error) {
      created?.dispose();
      const message = error instanceof Error ? error.message : String(error);
      this.fail(id, message);
      return;
    }
    this.emit();
  }

  async deactivate(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record || record.status !== "active") return;
    try {
      await record.definition.deactivate?.();
    } catch (error) {
      console.warn(`[core] plugin "${id}" deactivate() failed`, error);
    }
    record.dispose?.();
    record.dispose = undefined;
    record.status = "installed";
    this.options.events.emit("plugin:deactivated", { id });
    this.emit();
  }

  async uninstall(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    await this.deactivate(id);
    this.records.delete(id);
    this.emit();
  }

  get(id: string): PluginRecord | undefined {
    return this.records.has(id) ? this.toRecord(id) : undefined;
  }

  list(): PluginRecord[] {
    return [...this.records.keys()].map((id) => this.toRecord(id));
  }

  onChange(handler: (records: PluginRecord[]) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  private fail(id: string, message: string): void {
    const record = this.records.get(id);
    if (!record) return;
    record.status = "error";
    record.error = message;
    record.dispose = undefined;
    console.error(`[core] plugin "${id}" failed: ${message}`);
    this.options.events.emit("plugin:error", { id, message });
    this.emit();
  }

  private toRecord(id: string): PluginRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Unknown plugin "${id}".`);
    return {
      id,
      manifest: record.definition.manifest,
      status: record.status,
      ...(record.error ? { error: record.error } : {}),
    };
  }

  private emit(): void {
    const records = this.list();
    for (const listener of this.listeners) {
      try {
        listener(records);
      } catch (error) {
        console.error("[core] plugin listener failed", error);
      }
    }
  }
}

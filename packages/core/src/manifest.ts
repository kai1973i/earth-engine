import type { Capability, PluginManifest } from "@terrascope/plugin-api";

const CAPABILITIES: Capability[] = ["layers", "tools", "ui", "analysis", "network"];
const ID_PATTERN = /^[a-z0-9]+(\.[a-z0-9][a-z0-9-]*)+$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+([-+].*)?$/;
const HOST_PATTERN = /^[a-z0-9.-]+$/;

/** Validates a parsed plugin.json and returns human-readable errors. */
export function validateManifest(value: unknown): string[] {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null) return ["The manifest must be an object."];
  const manifest = value as Partial<PluginManifest>;

  if (typeof manifest.id !== "string" || !ID_PATTERN.test(manifest.id)) {
    errors.push('The manifest "id" must be reverse-DNS style, e.g. "org.example.my-plugin".');
  }
  if (typeof manifest.name !== "string" || manifest.name.trim().length === 0) {
    errors.push('The manifest "name" is required.');
  }
  if (typeof manifest.version !== "string" || !VERSION_PATTERN.test(manifest.version)) {
    errors.push('The manifest "version" must be SemVer, e.g. "1.2.0".');
  }
  if (typeof manifest.author !== "string" || manifest.author.trim().length === 0) {
    errors.push('The manifest "author" is required.');
  }
  if (typeof manifest.license !== "string" || manifest.license.trim().length === 0) {
    errors.push('The manifest "license" is required.');
  }
  if (typeof manifest.coreApi !== "string" || manifest.coreApi.trim().length === 0) {
    errors.push('The manifest "coreApi" range is required.');
  }
  if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) {
    errors.push('The manifest "capabilities" must list at least one capability.');
  } else {
    for (const capability of manifest.capabilities) {
      if (!CAPABILITIES.includes(capability)) {
        errors.push(`Unknown capability "${String(capability)}".`);
      }
    }
  }
  if (manifest.network !== undefined) {
    if (!Array.isArray(manifest.network)) {
      errors.push('"network" must be an array of hostnames.');
    } else {
      for (const host of manifest.network) {
        if (typeof host !== "string" || !HOST_PATTERN.test(host)) {
          errors.push(`Invalid network hostname "${String(host)}".`);
        }
      }
    }
  }
  if (manifest.dependencies !== undefined && (typeof manifest.dependencies !== "object" || manifest.dependencies === null)) {
    errors.push('"dependencies" must map plugin ids to SemVer ranges.');
  }
  if (manifest.settingsSchema !== undefined && (typeof manifest.settingsSchema !== "object" || manifest.settingsSchema === null)) {
    errors.push('"settingsSchema" must be a JSON Schema object.');
  }
  return errors;
}

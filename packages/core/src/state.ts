import type { JsonObject, Locale, MapViewState, ThemePreference, TimeState } from "@terrascope/plugin-api";

export const STATE_VERSION = 1;

export interface LayerState {
  /** Fully qualified layer id ("pluginId:layerId"). */
  uid: string;
  visible: boolean;
  opacity: number;
}

export interface PluginState {
  id: string;
  version: string;
  enabled: boolean;
}

/**
 * Serializable, reproducible application state. Everything needed to restore a
 * view — including plugin ids and versions — lives here.
 */
export interface AppState {
  version: number;
  view: MapViewState;
  time: TimeState;
  theme: ThemePreference;
  locale: Locale;
  layers: LayerState[];
  plugins: PluginState[];
  settings: Record<string, JsonObject>;
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeState(state: AppState): string {
  return toBase64Url(JSON.stringify(state));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function decodeState(encoded: string): AppState | null {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(encoded));
    return isAppState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isAppState(value: unknown): value is AppState {
  if (!isRecord(value)) return false;
  if (value.version !== STATE_VERSION) return false;
  const view = value.view;
  const time = value.time;
  if (!isRecord(view) || !isRecord(time)) return false;
  return (
    Array.isArray(value.layers) &&
    Array.isArray(value.plugins) &&
    isRecord(value.settings) &&
    (value.theme === "light" || value.theme === "dark" || value.theme === "system") &&
    (value.locale === "de" || value.locale === "en")
  );
}

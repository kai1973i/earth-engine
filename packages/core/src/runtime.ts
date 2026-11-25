import type {
  AnalysisApi,
  Capability,
  Coordinate,
  CoordinateApi,
  CoreEventMap,
  DataApi,
  Geometry,
  I18nApi,
  InspectorApi,
  InspectorResult,
  JsonObject,
  JsonValue,
  LayerApi,
  LayerInfo,
  Locale,
  MapApi,
  MapEventName,
  MapViewState,
  PluginApi,
  PluginDefinition,
  PluginManifest,
  ResolvedTheme,
  SettingsApi,
  SlotEntry,
  StorageApi,
  TemporalSupport,
  ThemePreference,
  TimeApi,
  UiApi,
} from "@terrascope/plugin-api";
import { CORE_API_VERSION } from "@terrascope/plugin-api";
import { AnalysisService } from "./analysis/service.js";
import { CoordinateService } from "./coordinates.js";
import { DataService } from "./data.js";
import { EventBus } from "./events.js";
import { I18nService } from "./i18n.js";
import { InspectorService, type RegisteredInspector } from "./inspector.js";
import { LayerRegistry } from "./layers.js";
import { DrawController, type DrawMode } from "./map/draw.js";
import type { MapAdapter } from "./map/adapter.js";
import { MapLibreAdapter } from "./map/maplibre-adapter.js";
import type { CreateApiResult, PluginLoaderOptions, PluginRecord } from "./plugin/loader.js";
import { PluginLoader } from "./plugin/loader.js";
import { SlotRegistry, type RegisteredSlot } from "./slots.js";
import { STATE_VERSION, decodeState, encodeState, type AppState } from "./state.js";
import { shiftInstant, TimeService } from "./time.js";

const DEFAULT_VIEW: MapViewState = {
  center: [8.5, 47.5],
  zoom: 2.2,
  bearing: 0,
  pitch: 0,
  projection: "globe",
};

const SETTINGS_PREFIX = "terrascope.settings.";

export interface ToastMessage {
  id: number;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

export interface InspectionState {
  coordinate: Coordinate;
  results: InspectorResult[];
  pending: boolean;
}

export interface CoreSnapshot {
  revision: number;
  ready: boolean;
  bootError: string | null;
  view: MapViewState;
  time: ReturnType<TimeApi["get"]>;
  timeBounds: { start: string; end: string };
  themePreference: ThemePreference;
  theme: ResolvedTheme;
  locale: Locale;
  layers: LayerInfo[];
  plugins: PluginRecord[];
  slots: RegisteredSlot[];
  inspectors: RegisteredInspector[];
  cursor: Coordinate | null;
  displayCrs: string;
  coordinateFormat: "decimal" | "dms";
  selection: Geometry | null;
  drawMode: DrawMode;
  drawPreview: Geometry | null;
  inspection: InspectionState | null;
  toasts: ToastMessage[];
  settings: Record<string, JsonObject>;
}

export interface CoreRuntimeOptions {
  container: HTMLElement;
  plugins?: PluginDefinition[];
  workerFactory?: () => Worker;
  mapAdapter?: MapAdapter;
}

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage can be disabled; settings then live for the session only */
  }
}

function removeLocal(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * The core application runtime. It owns the services, the plugin loader and the
 * core state, but no data source whatsoever.
 */
export class CoreRuntime {
  readonly events = new EventBus();
  readonly coordinates = new CoordinateService();
  readonly time: TimeService;
  readonly layers: LayerRegistry;
  readonly data = new DataService();
  readonly analysis: AnalysisService;
  readonly inspector = new InspectorService();
  readonly slots = new SlotRegistry();
  readonly draw: DrawController;
  readonly i18n = new I18nService();
  readonly plugins: PluginLoader;
  readonly map: MapAdapter;

  private options: CoreRuntimeOptions;
  private ready = false;
  private bootError: string | null = null;
  private listeners = new Set<() => void>();
  private snapshot: CoreSnapshot;
  private resolvedTheme: ResolvedTheme = "light";
  private themePreference: ThemePreference = "system";
  private pluginSettings = new Map<string, JsonObject>();
  private settingsListeners = new Map<string, Set<(settings: JsonObject) => void>>();
  private toasts: ToastMessage[] = [];
  private toastId = 0;
  private inspection: InspectionState | null = null;
  private inspectionAbort: AbortController | null = null;
  private selection: Geometry | null = null;
  private preview: Geometry | null = null;
  private cursor: Coordinate | null = null;
  private coordinateFormat: "decimal" | "dms" = "decimal";
  private media: MediaQueryList | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private snapshotFrame: number | null = null;
  private restoring = false;

  constructor(options: CoreRuntimeOptions) {
    this.options = options;
    this.time = new TimeService(this.events);
    this.layers = new LayerRegistry(this.events);
    this.analysis = new AnalysisService(
      options.workerFactory ? { workerFactory: options.workerFactory } : {},
    );
    this.draw = new DrawController(this.coordinates);
    this.map = options.mapAdapter ?? new MapLibreAdapter(options.container);

    const loaderOptions: PluginLoaderOptions = {
      coreApiVersion: CORE_API_VERSION,
      events: this.events,
      createApi: (manifest) => this.createApi(manifest),
    };
    this.plugins = new PluginLoader(loaderOptions);
    this.snapshot = this.buildSnapshot();
  }

  async init(): Promise<void> {
    const restored = readStateFromUrl();
    if (restored) {
      this.themePreference = restored.theme;
      this.i18n.setLocale(restored.locale);
    }

    this.setupTheme();
    this.applyTheme(this.themePreference, false);

    if (restored) {
      this.time.setRange(restored.time.range.start, restored.time.range.end);
      this.time.setResolution(restored.time.resolution);
      this.time.setInstant(restored.time.instant);
      for (const [pluginId, settings] of Object.entries(restored.settings)) {
        this.pluginSettings.set(pluginId, settings);
        writeLocal(`${SETTINGS_PREFIX}${pluginId}`, JSON.stringify(settings));
      }
    }

    try {
      await this.map.init({ view: restored?.view ?? DEFAULT_VIEW, theme: this.resolvedTheme });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.bootError = this.i18n.t("error.map").replace("{message}", message);
      this.emitSnapshot();
      return;
    }

    this.bindServices();

    for (const definition of this.options.plugins ?? []) {
      try {
        this.plugins.install(definition);
      } catch (error) {
        console.error(`[core] could not install "${definition.manifest.id}"`, error);
        this.notify("error", error instanceof Error ? error.message : String(error));
      }
    }

    this.restoring = true;
    const enabled = restored ? new Set(restored.plugins.filter((entry) => entry.enabled).map((entry) => entry.id)) : null;
    for (const record of this.plugins.list()) {
      if (enabled && !enabled.has(record.id)) continue;
      await this.plugins.activate(record.id);
    }

    if (restored) {
      for (const layer of restored.layers) {
        this.layers.setVisibility(layer.uid, layer.visible);
        this.layers.setOpacity(layer.uid, layer.opacity);
      }
      this.map.setView(restored.view);
      if (restored.time) {
        this.time.setResolution(restored.time.resolution);
      }
    }
    this.restoring = false;

    this.ready = true;
    this.map.sync(this.layers.list(), this.time.get().instant);
    this.emitSnapshot();
    this.persist();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): CoreSnapshot => this.snapshot;

  t(key: string, fallback?: string): string {
    return this.i18n.t(key, fallback);
  }

  // ---------------------------------------------------------------- theme ---

  private setupTheme(): void {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    this.media = window.matchMedia("(prefers-color-scheme: dark)");
    this.media.addEventListener("change", this.onSystemThemeChange);
  }

  private onSystemThemeChange = (): void => {
    if (this.themePreference === "system") this.applyTheme("system", true);
  };

  setTheme(preference: ThemePreference): void {
    this.applyTheme(preference, true);
  }

  private applyTheme(preference: ThemePreference, notify: boolean): void {
    this.themePreference = preference;
    const resolved: ResolvedTheme =
      preference === "system" ? (this.media?.matches ? "dark" : "light") : preference;
    this.resolvedTheme = resolved;
    if (typeof document !== "undefined") {
      document.documentElement.dataset["theme"] = resolved;
      document.documentElement.style.colorScheme = resolved;
    }
    this.map.setTheme(resolved);
    if (notify) {
      this.events.emit("theme:changed", { theme: resolved, preference });
      this.emitSnapshot();
      this.persist();
    }
  }

  // --------------------------------------------------------------- locale ---

  setLocale(locale: Locale): void {
    this.i18n.setLocale(locale);
    this.emitSnapshot();
    this.persist();
  }

  setDisplayCrs(code: string): void {
    this.coordinates.setDisplayCrs(code);
    this.emitSnapshot();
  }

  setCoordinateFormat(format: "decimal" | "dms"): void {
    this.coordinateFormat = format;
    this.coordinates.setFormat(format);
    this.emitSnapshot();
  }

  // ----------------------------------------------------------------- time ---

  setTimeInstant(instant: string): void {
    this.time.setInstant(instant);
  }

  setTimeRange(start: string, end: string): void {
    this.time.setRange(start, end);
  }

  stepTime(direction: 1 | -1): void {
    const state = this.time.get();
    this.time.setInstant(shiftInstant(state.instant, state.resolution, direction));
  }

  // ---------------------------------------------------------------- tools ---

  setDrawMode(mode: DrawMode): void {
    this.draw.setMode(mode);
  }

  finishDrawing(): void {
    const geometry = this.draw.finish();
    if (geometry) this.setSelection(geometry);
    this.emitSnapshot();
  }

  cancelDrawing(): void {
    this.draw.cancel();
  }

  clearSelection(): void {
    this.setSelection(null);
    this.emitSnapshot();
  }

  private setSelection(geometry: Geometry | null): void {
    this.selection = geometry;
    if (this.preview) {
      this.map.removeOverlay("draw-preview");
      this.preview = null;
    }
    this.map.removeOverlay("selection");
    if (geometry) {
      this.map.addOverlay("selection", geometry, { color: accentFromCss(), lineWidth: 2 });
    }
    this.events.emit("selection:changed", { geometry });
    this.emitSnapshot();
  }

  private updatePreview(preview: Geometry | null): void {
    if (this.preview) {
      this.map.removeOverlay("draw-preview");
      this.preview = null;
    }
    if (preview) {
      this.map.addOverlay("draw-preview", preview, {
        color: accentFromCss(),
        lineWidth: 2,
        fillOpacity: 0.12,
      });
      this.preview = preview;
    }
  }

  // ------------------------------------------------------------- layers ----

  setLayerVisibility(uid: string, visible: boolean): void {
    this.layers.setVisibility(uid, visible);
  }

  setLayerOpacity(uid: string, opacity: number): void {
    this.layers.setOpacity(uid, opacity);
  }

  // ------------------------------------------------------------ inspect ----

  async inspectAt(coordinate: Coordinate): Promise<void> {
    this.inspectionAbort?.abort();
    const controller = new AbortController();
    this.inspectionAbort = controller;
    this.inspection = { coordinate, results: [], pending: true };
    this.emitSnapshot();

    try {
      const results = await this.inspector.inspect(
        coordinate,
        this.time.get().instant,
        this.layers.list().filter((layer) => layer.visible),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      this.inspection = { coordinate, results, pending: false };
      this.events.emit("inspect:result", { coordinate, results });
    } catch (error) {
      if (controller.signal.aborted) return;
      console.warn("[core] inspection failed", error);
      this.inspection = { coordinate, results: [], pending: false };
    }
    this.emitSnapshot();
  }

  // ---------------------------------------------------------- analysis -----

  async runAnalysis(graph: Parameters<AnalysisApi["run"]>[0]): Promise<Awaited<ReturnType<AnalysisApi["run"]>>> {
    try {
      return await this.analysis.run(graph);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.notify("error", this.t("toast.analysisFailed").replace("{message}", message));
      throw error;
    }
  }

  // ---------------------------------------------------------- plugins ------

  async activatePlugin(id: string): Promise<void> {
    await this.plugins.activate(id);
    this.persist();
  }

  async deactivatePlugin(id: string): Promise<void> {
    await this.plugins.deactivate(id);
    this.persist();
  }

  async uninstallPlugin(id: string): Promise<void> {
    await this.plugins.uninstall(id);
    this.pluginSettings.delete(id);
    removeLocal(`${SETTINGS_PREFIX}${id}`);
    this.persist();
  }

  async loadPluginFromUrl(url: string): Promise<PluginRecord> {
    const manifestUrl = new URL(url, window.location.href);
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error(`Could not load manifest (${response.status}).`);
    const manifest: unknown = await response.json();
    const entry = (manifest as PluginManifest).entry;
    const moduleUrl = new URL(entry ?? "index.js", manifestUrl).href;
    const module: unknown = await import(/* @vite-ignore */ moduleUrl);
    const definition = extractDefinition(module);
    if (!definition) throw new Error("The plugin module does not export a PluginDefinition.");
    const record = this.plugins.install(definition);
    await this.plugins.activate(record.id);
    this.notify("success", this.t("toast.pluginInstalled").replace("{id}", record.id));
    return record;
  }

  // -------------------------------------------------------------- state ----

  exportState(): AppState {
    const pluginStates = this.plugins.list().map((record) => ({
      id: record.id,
      version: record.manifest.version,
      enabled: record.status === "active",
    }));
    return {
      version: STATE_VERSION,
      view: this.ready ? this.map.getView() : this.snapshot.view,
      time: this.time.get(),
      theme: this.themePreference,
      locale: this.i18n.locale,
      layers: this.layers.list().map((layer) => ({
        uid: layer.uid,
        visible: layer.visible,
        opacity: layer.opacity,
      })),
      plugins: pluginStates,
      settings: Object.fromEntries(this.pluginSettings),
    };
  }

  applyState(state: AppState): void {
    this.applyTheme(state.theme, true);
    this.i18n.setLocale(state.locale);
    this.time.setRange(state.time.range.start, state.time.range.end);
    this.time.setInstant(state.time.instant);
    this.time.setResolution(state.time.resolution);
    this.map.setView(state.view);
    for (const [pluginId, settings] of Object.entries(state.settings)) {
      this.pluginSettings.set(pluginId, settings);
      writeLocal(`${SETTINGS_PREFIX}${pluginId}`, JSON.stringify(settings));
    }
    for (const plugin of state.plugins) {
      if (plugin.enabled) void this.plugins.activate(plugin.id);
      else void this.plugins.deactivate(plugin.id);
    }
    for (const layer of state.layers) {
      this.layers.setVisibility(layer.uid, layer.visible);
      this.layers.setOpacity(layer.uid, layer.opacity);
    }
    this.emitSnapshot();
    this.persist();
  }

  shareLink(): string {
    const url = new URL(window.location.href);
    url.searchParams.set("state", encodeState(this.exportState()));
    url.hash = "";
    return url.toString();
  }

  async copyShareLink(): Promise<string> {
    const link = this.shareLink();
    try {
      await navigator.clipboard.writeText(link);
      this.notify("success", this.t("share.copied"));
    } catch {
      this.notify("warning", link);
    }
    return link;
  }

  resetView(): void {
    this.map.setView(DEFAULT_VIEW);
    this.layers.list().forEach((layer) => {
      if (layer.temporal) this.time.setInstant(layer.temporal.end);
    });
    this.emitSnapshot();
  }

  resize(): void {
    this.map.resize();
  }

  // -------------------------------------------------------------- toasts ---

  notify(level: ToastMessage["level"], message: string): void {
    const toast: ToastMessage = { id: ++this.toastId, level, message };
    this.toasts = [...this.toasts, toast].slice(-4);
    this.events.emit("notification", { level, message });
    this.emitSnapshot();
    setTimeout(() => this.dismissToast(toast.id), 6000);
  }

  dismissToast(id: number): void {
    this.toasts = this.toasts.filter((toast) => toast.id !== id);
    this.emitSnapshot();
  }

  // -------------------------------------------------------------- wiring ---

  private bindServices(): void {
    this.layers.onChange(() => {
      if (this.ready) this.map.sync(this.layers.list(), this.time.get().instant);
      this.emitSnapshot();
      this.persist();
    });
    this.time.onChange(() => {
      if (this.ready) this.map.sync(this.layers.list(), this.time.get().instant);
      this.emitSnapshot();
      this.persist();
    });
    this.slots.onChange(() => this.emitSnapshot());
    this.plugins.onChange(() => {
      this.emitSnapshot();
      this.persist();
    });
    this.i18n.onChange(() => this.emitSnapshot());
    this.draw.onChange((state, completed) => {
      this.updatePreview(state.preview);
      if (completed) this.setSelection(completed);
      this.emitSnapshot();
    });
    this.events.on("plugin:error", ({ id, message }) => {
      this.notify("error", this.t("toast.pluginError").replace("{id}", id).replace("{message}", message));
    });
    this.events.on("plugin:activated", ({ id }) => {
      if (this.restoring) return;
      this.notify("success", this.t("toast.pluginActivated").replace("{id}", id));
    });

    this.map.on("click", (payload) => {
      const coordinate = this.coordinates.normalize(payload.coordinate);
      if (this.draw.getMode() !== "none") {
        this.draw.addPoint(coordinate);
        this.emitSnapshot();
        return;
      }
      this.events.emit("map:click", { coordinate, time: this.time.get().instant });
      void this.inspectAt(coordinate);
    });

    this.map.on("mousemove", ({ coordinate }) => {
      this.cursor = this.coordinates.normalize(coordinate);
      this.events.emit("map:hover", { coordinate: this.cursor, time: this.time.get().instant });
      this.scheduleSnapshot();
    });

    this.map.on("moveend", ({ view }) => {
      this.events.emit("map:moveend", { view });
      this.emitSnapshot();
      this.persist();
    });
  }

  // ------------------------------------------------------- plugin API ------

  private createApi(manifest: PluginManifest): CreateApiResult {
    const pluginId = manifest.id;
    const runtime = this;
    const disposers: Array<() => void> = [];
    const track = (dispose: () => void): (() => void) => {
      disposers.push(dispose);
      return dispose;
    };
    this.assertNetworkDeclared(manifest);

    const layers: LayerApi = {
      add: (descriptor) => this.layers.add(pluginId, descriptor),
      update: (id, patch) => this.layers.update(pluginId, id, patch),
      remove: (id) => this.layers.remove(pluginId, id),
      get: (id) => this.layers.get(id, pluginId),
      list: () => this.layers.list().filter((layer) => layer.pluginId === pluginId),
      setVisibility: (id, visible) => this.layers.setVisibility(id, visible, pluginId),
      setOpacity: (id, opacity) => this.layers.setOpacity(id, opacity, pluginId),
      setOrder: (ids) => this.layers.setOrder(pluginId, ids),
      onChange: (handler) =>
        track(
          this.layers.onChange((all) => handler(all.filter((layer) => layer.pluginId === pluginId))),
        ),
    };

    const map: MapApi = {
      getView: () => this.map.getView(),
      setView: (view) => this.map.setView(view),
      flyTo: (view) => this.map.setView(view),
      fitBounds: (bounds, options) => this.map.fitBounds(bounds, options),
      project: (coordinate) => this.map.project(coordinate),
      unproject: (point) => this.map.unproject(point),
      addOverlay: (overlay) => {
        this.map.addOverlay(`plugin:${pluginId}:${overlay.id}`, overlay.geometry, overlay.style);
        return track(() => this.map.removeOverlay(`plugin:${pluginId}:${overlay.id}`));
      },
      on: (event: MapEventName, handler) => {
        const off = this.map.on(event, (payload) => {
          if ("coordinate" in payload) {
            handler({ ...payload, time: this.time.get().instant });
          } else {
            handler({
              coordinate: { lon: payload.view.center[0], lat: payload.view.center[1] },
              point: { x: 0, y: 0 },
              time: this.time.get().instant,
            });
          }
        });
        return track(off);
      },
    };

    const ui: UiApi = {
      registerSlot: (entry: SlotEntry) => track(this.slots.register(pluginId, entry)),
      theme: {
        current: () => this.resolvedTheme,
        preference: () => this.themePreference,
        set: (preference) => this.setTheme(preference),
        onChange: (handler) =>
          track(this.events.on("theme:changed", ({ theme }) => handler(theme))),
      },
      notify: (level, message) => this.notify(level, message),
    };

    const settings: SettingsApi = {
      get: <T extends JsonObject = JsonObject>() => ({ ...this.settingsFor(pluginId) }) as unknown as T,
      set: (patch) => this.updatePluginSetting(pluginId, patch),
      onChange: (handler) => {
        const set = this.settingsListeners.get(pluginId) ?? new Set();
        set.add(handler);
        this.settingsListeners.set(pluginId, set);
        return track(() => set.delete(handler));
      },
    };

    const storage: StorageApi = {
      get: <T extends JsonValue>(key: string, fallback: T): T => {
        const raw = readLocal(`terrascope.plugin.${pluginId}.${key}`);
        if (raw === null) return fallback;
        try {
          return JSON.parse(raw) as T;
        } catch {
          return fallback;
        }
      },
      set: (key, value) => writeLocal(`terrascope.plugin.${pluginId}.${key}`, JSON.stringify(value)),
      remove: (key) => removeLocal(`terrascope.plugin.${pluginId}.${key}`),
      clear: () => {
        try {
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith(`terrascope.plugin.${pluginId}.`)) localStorage.removeItem(key);
          }
        } catch {
          /* ignore */
        }
      },
    };

    const coordinates: CoordinateApi = this.coordinates;
    const time: TimeApi = this.time;
    const events = this.events;
    const data: DataApi = this.data;
    const analysis: AnalysisApi = this.analysis;
    const inspector: InspectorApi = {
      register: (entry) => track(this.inspector.register(pluginId, entry)),
    };

    const i18n: I18nApi = {
      get locale() {
        return runtime.i18n.locale;
      },
      register: (messages) => {
        runtime.i18n.register(messages, pluginId);
        disposers.push(() => runtime.i18n.removeAll(pluginId));
      },
      t: (key, fallback) => runtime.i18n.t(key, fallback),
      onChange: (handler) => track(runtime.i18n.onChange(handler)),
    };

    const api: PluginApi = {
      manifest,
      coreApiVersion: CORE_API_VERSION,
      map,
      layers,
      ui,
      coordinates,
      time,
      data,
      analysis,
      inspector,
      events,
      storage,
      settings,
      i18n,
      logger: {
        debug: (message, ...args) => console.debug(`[${pluginId}] ${message}`, ...args),
        info: (message, ...args) => console.info(`[${pluginId}] ${message}`, ...args),
        warn: (message, ...args) => console.warn(`[${pluginId}] ${message}`, ...args),
        error: (message, ...args) => console.error(`[${pluginId}] ${message}`, ...args),
      },
    };

    return {
      api,
      dispose: () => {
        for (const dispose of disposers.reverse()) {
          try {
            dispose();
          } catch (error) {
            console.warn(`[core] cleanup for "${pluginId}" failed`, error);
          }
        }
        this.layers.removeAll(pluginId);
        this.slots.removeAll(pluginId);
        this.inspector.removeAll(pluginId);
        this.data.removeAll(pluginId);
        this.analysis.removeAll(pluginId);
        this.i18n.removeAll(pluginId);
        this.settingsListeners.delete(pluginId);
      },
    };
  }

  private assertNetworkDeclared(manifest: PluginManifest): void {
    const capabilities: Capability[] = manifest.capabilities;
    if (capabilities.includes("network") && (manifest.network ?? []).length === 0) {
      throw new Error(`Plugin "${manifest.id}" declares network capability but no allowed hostnames.`);
    }
  }

  pluginSettingsFor(pluginId: string): JsonObject {
    return { ...this.settingsFor(pluginId) };
  }

  updatePluginSetting(pluginId: string, patch: JsonObject): void {
    const next = { ...this.settingsFor(pluginId), ...patch };
    this.pluginSettings.set(pluginId, next);
    writeLocal(`${SETTINGS_PREFIX}${pluginId}`, JSON.stringify(next));
    for (const listener of this.settingsListeners.get(pluginId) ?? []) listener(next);
    this.emitSnapshot();
    this.persist();
  }

  private settingsFor(pluginId: string): JsonObject {
    const existing = this.pluginSettings.get(pluginId);
    if (existing) return existing;
    const raw = readLocal(`${SETTINGS_PREFIX}${pluginId}`);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as JsonObject;
      this.pluginSettings.set(pluginId, parsed);
      return parsed;
    } catch {
      return {};
    }
  }

  // ------------------------------------------------------------ snapshot ---

  private buildSnapshot(): CoreSnapshot {
    const time = this.time.get();
    return {
      revision: this.snapshot?.revision ?? 0,
      ready: this.ready,
      bootError: this.bootError,
      view: this.map.getView(),
      time,
      timeBounds: this.timeBounds(),
      themePreference: this.themePreference,
      theme: this.resolvedTheme,
      locale: this.i18n.locale,
      layers: this.layers.list(),
      plugins: this.plugins.list(),
      slots: this.slots.list(),
      inspectors: this.inspector.list(),
      cursor: this.cursor,
      displayCrs: this.coordinates.currentCrs(),
      coordinateFormat: this.coordinateFormat,
      selection: this.selection,
      drawMode: this.draw.getMode(),
      drawPreview: this.draw.getState().preview,
      inspection: this.inspection,
      toasts: this.toasts,
      settings: Object.fromEntries(this.pluginSettings),
    };
  }

  private timeBounds(): { start: string; end: string } {
    const supports = this.layers
      .list()
      .map((layer) => layer.temporal)
      .filter((support): support is TemporalSupport => Boolean(support));
    if (supports.length === 0) return this.time.get().range;
    const start = supports.reduce(
      (earliest, support) => (support.start < earliest ? support.start : earliest),
      supports[0]?.start ?? this.time.get().range.start,
    );
    const end = supports.reduce(
      (latest, support) => (support.end > latest ? support.end : latest),
      supports[0]?.end ?? this.time.get().range.end,
    );
    return { start, end };
  }

  private emitSnapshot(): void {
    this.snapshot = { ...this.buildSnapshot(), revision: this.snapshot.revision + 1 };
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        console.error("[core] snapshot listener failed", error);
      }
    }
  }

  private scheduleSnapshot(): void {
    if (typeof requestAnimationFrame !== "function") {
      this.emitSnapshot();
      return;
    }
    if (this.snapshotFrame !== null) return;
    this.snapshotFrame = requestAnimationFrame(() => {
      this.snapshotFrame = null;
      this.emitSnapshot();
    });
  }

  private persist(): void {
    if (!this.ready || typeof window === "undefined") return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("state", encodeState(this.exportState()));
        window.history.replaceState(null, "", url);
      } catch (error) {
        console.warn("[core] could not persist state to the URL", error);
      }
    }, 300);
  }

  destroy(): void {
    this.media?.removeEventListener("change", this.onSystemThemeChange);
    this.inspectionAbort?.abort();
    this.analysis.dispose();
    this.map.destroy();
    this.listeners.clear();
  }
}

function readStateFromUrl(): AppState | null {
  if (typeof window === "undefined") return null;
  const encoded = new URL(window.location.href).searchParams.get("state");
  return encoded ? decodeState(encoded) : null;
}

function accentFromCss(): string {
  if (typeof document === "undefined") return "#c9922e";
  const value = getComputedStyle(document.documentElement).getPropertyValue("--ts-accent").trim();
  return value || "#c9922e";
}

function extractDefinition(module: unknown): PluginDefinition | null {
  if (typeof module !== "object" || module === null) return null;
  const record = module as Record<string, unknown>;
  const candidate = record["default"] ?? record["plugin"] ?? record["definition"];
  if (typeof candidate !== "object" || candidate === null) return null;
  const definition = candidate as Partial<PluginDefinition>;
  if (!definition.manifest || typeof definition.activate !== "function") return null;
  return definition as PluginDefinition;
}

export { DEFAULT_VIEW };

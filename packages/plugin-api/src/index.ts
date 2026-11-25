/**
 * @terrascope/plugin-api
 *
 * The contract between the core application and every plugin. This package
 * contains types and constants only — no runtime code, no data sources and no
 * dependency on the core implementation.
 */

/* -------------------------------------------------------------------------- */
/* JSON & primitives                                                          */
/* -------------------------------------------------------------------------- */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type MaybePromise<T> = T | Promise<T>;

/** Semantic version range, e.g. "^0.1.0", "~0.1.2", ">=0.1.0 <0.3.0". */
export type SemVerRange = string;

export type Capability = "layers" | "tools" | "ui" | "analysis" | "network";

export type Locale = "de" | "en";
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/* -------------------------------------------------------------------------- */
/* Manifest                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `plugin.json` — every plugin ships one. The loader validates it before a
 * plugin is installed.
 */
export interface PluginManifest {
  /** Reverse-DNS style, unique: "org.example.basemap-osm". */
  id: string;
  name: string;
  version: string;
  author: string;
  license: string;
  /** SemVer range of the core plugin API this plugin needs. */
  coreApi: SemVerRange;
  description?: string;
  capabilities: Capability[];
  /** Exact hostnames the plugin may contact, e.g. ["tile.openstreetmap.org"]. */
  network?: string[];
  /** Plugin id -> SemVer range. */
  dependencies?: Record<string, SemVerRange>;
  /** Lucide icon name, rendered by the core `<Icon>` component. */
  icon?: string;
  /** JSON Schema (draft 2020-12 subset) for the plugin settings UI. */
  settingsSchema?: JsonObject;
  /** Entry module for locally loaded plugins (relative to plugin.json). */
  entry?: string;
}

/* -------------------------------------------------------------------------- */
/* Geometry & coordinates                                                     */
/* -------------------------------------------------------------------------- */

export interface PointGeometry {
  type: "Point";
  coordinates: [number, number] | [number, number, number];
}
export interface LineStringGeometry {
  type: "LineString";
  coordinates: Array<[number, number] | [number, number, number]>;
}
export interface PolygonGeometry {
  type: "Polygon";
  coordinates: Array<Array<[number, number] | [number, number, number]>>;
}
export type Geometry = PointGeometry | LineStringGeometry | PolygonGeometry;

export interface Feature<G extends Geometry = Geometry> {
  type: "Feature";
  id?: string;
  geometry: G;
  properties: JsonObject | null;
}
export interface FeatureCollection {
  type: "FeatureCollection";
  features: Array<Feature>;
}

/** A coordinate that may carry an optional height (meters above ellipsoid). */
export interface Coordinate {
  lon: number;
  lat: number;
  height?: number;
  /** CRS of this coordinate. Defaults to "EPSG:4326". */
  crs?: string;
}

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface CrsInfo {
  code: string;
  name: string;
  unit: string;
}

export interface CoordinateApi {
  readonly crsList: CrsInfo[];
  /** Register an additional proj4 definition, e.g. an UTM zone. */
  registerCrs(code: string, definition: string, info?: Omit<CrsInfo, "code">): void;
  transform(coordinate: Coordinate, from: string, to: string): Coordinate;
  toWgs84(coordinate: Coordinate): Coordinate;
  fromWgs84(coordinate: Coordinate, to: string): Coordinate;
  /** Format a WGS84 coordinate using the user's current format preference. */
  format(coordinate: Coordinate, options?: { crs?: string; format?: "decimal" | "dms" }): string;
  parse(text: string, crs?: string): Coordinate | null;
  distance(a: Coordinate, b: Coordinate): number;
  area(ring: Coordinate[]): number;
  bounds(coordinates: Coordinate[]): BoundingBox;
  /** Which CRS is currently selected in the status bar. */
  currentCrs(): string;
}

/* -------------------------------------------------------------------------- */
/* Time                                                                       */
/* -------------------------------------------------------------------------- */

export interface TemporalResolution {
  unit: "hour" | "day" | "month" | "year";
  step: number;
}

export interface TemporalSupport {
  resolution: TemporalResolution;
  /** ISO 8601 instant (UTC). */
  start: string;
  /** ISO 8601 instant (UTC). */
  end: string;
  availability: "continuous" | "discrete";
}

export interface TimeState {
  /** ISO 8601 instant in UTC. */
  instant: string;
  /** ISO 8601 interval in UTC. */
  range: { start: string; end: string };
  resolution: TemporalResolution;
}

export interface TimeApi {
  get(): TimeState;
  setInstant(instant: string): void;
  setRange(start: string, end: string): void;
  setResolution(resolution: TemporalResolution): void;
  /** ISO 8601 timestamp a layer with the given time support should display. */
  resolveFor(support: TemporalSupport): string;
  format(instant: string, options?: { dateStyle?: "short" | "medium" | "long"; timeStyle?: "short" | "medium" }): string;
  onChange(handler: (state: TimeState) => void): () => void;
}

/* -------------------------------------------------------------------------- */
/* Layers                                                                     */
/* -------------------------------------------------------------------------- */

export interface SourceInfo {
  name: string;
  url: string;
  license: string;
  licenseUrl?: string;
  /** Rendered in the attribution panel, e.g. "© OpenStreetMap contributors". */
  attribution: string;
}

export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten";

export type LegendSpec =
  | { type: "continuous"; colormap: string; min: number; max: number; unit?: string }
  | { type: "gradient"; stops: Array<{ value: number; color: string }>; unit?: string }
  | { type: "categorical"; items: Array<{ value: string; label: string; color?: string }> };

export interface LayerDescriptorBase {
  /** Plugin-local id; the core namespaces it per plugin. */
  id: string;
  name: string;
  description?: string;
  /** Physical unit, e.g. "m", "°C", "1". Always rendered next to values. */
  unit: string;
  valueRange?: [number, number];
  noData?: number | null;
  /** value = raw * scale + offset */
  scale?: number;
  offset?: number;
  source: SourceInfo;
  temporal?: TemporalSupport | null;
  visible?: boolean;
  opacity?: number;
  blendMode?: BlendMode;
  /** Lower values render below higher values. Base maps use -100. */
  zIndex?: number;
  colormap?: string;
  legend?: LegendSpec;
}

export interface RasterLayerDescriptor extends LayerDescriptorBase {
  kind: "raster";
  /** XYZ templates using {z}/{x}/{y} and optionally {time}. */
  tiles: string[];
  tileSize?: 256 | 512;
  minZoom?: number;
  maxZoom?: number;
  /** Replace {time} in tile URLs with the resolved ISO date. */
  timeTemplate?: boolean;
}

export interface HillshadeLayerDescriptor extends LayerDescriptorBase {
  kind: "hillshade";
  demTiles: string[];
  encoding?: "terrarium" | "mapbox";
  tileSize?: number;
  exaggeration?: number;
}

export interface VectorStyle {
  color?: string;
  fillColor?: string;
  fillOpacity?: number;
  lineWidth?: number;
  pointRadius?: number;
  outlineColor?: string;
}

export interface VectorLayerDescriptor extends LayerDescriptorBase {
  kind: "vector";
  data: FeatureCollection | Feature | Geometry;
  style?: VectorStyle;
}

export type LayerDescriptor = RasterLayerDescriptor | HillshadeLayerDescriptor | VectorLayerDescriptor;

/** Read-only view of a registered layer. */
export type LayerInfo = LayerDescriptor & {
  /** Fully qualified id: "<pluginId>:<descriptorId>". */
  uid: string;
  pluginId: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  zIndex: number;
};

export interface LayerApi {
  add(descriptor: LayerDescriptor): LayerInfo;
  update(id: string, patch: Partial<LayerDescriptorBase>): void;
  remove(id: string): void;
  get(id: string): LayerInfo | undefined;
  list(): LayerInfo[];
  setVisibility(id: string, visible: boolean): void;
  setOpacity(id: string, opacity: number): void;
  /** Reorder plugin layers by plugin-local ids (bottom to top). */
  setOrder(ids: string[]): void;
  onChange(handler: (layers: LayerInfo[]) => void): () => void;
}

/* -------------------------------------------------------------------------- */
/* Map                                                                        */
/* -------------------------------------------------------------------------- */

export interface MapViewState {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  projection: "globe" | "mercator";
}

export interface MapOverlay {
  id: string;
  geometry: Geometry | FeatureCollection;
  style?: VectorStyle;
}

export interface MapApi {
  getView(): MapViewState;
  setView(view: Partial<MapViewState>): void;
  flyTo(view: Partial<MapViewState>): void;
  fitBounds(bounds: BoundingBox, options?: { padding?: number; maxZoom?: number }): void;
  project(coordinate: Coordinate): { x: number; y: number } | null;
  unproject(point: { x: number; y: number }): Coordinate | null;
  /** Draw a transient overlay on top of all layers. Returns a disposer. */
  addOverlay(overlay: MapOverlay): () => void;
  on(event: MapEventName, handler: (payload: MapEventPayload) => void): () => void;
}

export type MapEventName = "click" | "mousemove" | "moveend" | "load";
export interface MapEventPayload {
  coordinate: Coordinate;
  time: string;
  point: { x: number; y: number };
}

/* -------------------------------------------------------------------------- */
/* UI                                                                         */
/* -------------------------------------------------------------------------- */

export type SlotName =
  | "sidebar"
  | "toolbar"
  | "map-overlay"
  | "legend"
  | "detail"
  | "settings"
  | "context-menu"
  | "statusbar";

export interface SlotContext {
  theme: ResolvedTheme;
  locale: Locale;
  /** Translate a keyspaced plugin string ("pluginId.key"). */
  t(key: string, fallback?: string): string;
  /** Open a URL in a new tab after checking the plugin's network allowlist. */
  openExternal(url: string): void;
}

export interface SlotEntry {
  id: string;
  slot: SlotName;
  title: string;
  /** Lucide icon name. Required for toolbar buttons, optional elsewhere. */
  icon?: string;
  order?: number;
  mount(container: HTMLElement, context: SlotContext): void | (() => void);
}

export interface ThemeApi {
  current(): ResolvedTheme;
  preference(): ThemePreference;
  set(preference: ThemePreference): void;
  onChange(handler: (theme: ResolvedTheme) => void): () => void;
}

export interface UiApi {
  registerSlot(entry: SlotEntry): () => void;
  readonly theme: ThemeApi;
  notify(level: "info" | "success" | "warning" | "error", message: string): void;
}

export type PluginSettingsSchema = JsonObject;

export interface SettingsApi {
  get<T extends JsonObject = JsonObject>(): T;
  set(patch: JsonObject): void;
  onChange(handler: (settings: JsonObject) => void): () => void;
}

/* -------------------------------------------------------------------------- */
/* Data providers                                                             */
/* -------------------------------------------------------------------------- */

export interface TileRequest {
  z: number;
  x: number;
  y: number;
  time?: string;
  signal?: AbortSignal;
}

export interface TileResponse {
  data: ArrayBuffer;
  contentType: string;
}

export interface RasterProvider {
  id: string;
  title: string;
  getTile(request: TileRequest): Promise<TileResponse>;
}

export interface TimeSeriesRequest {
  coordinate: Coordinate;
  start: string;
  end: string;
  resolution?: TemporalResolution;
  signal?: AbortSignal;
}

export interface TimeSeriesPoint {
  time: string;
  value: number | null;
}

export interface TimeSeriesResult {
  unit: string;
  points: TimeSeriesPoint[];
  source: SourceInfo;
}

export interface TimeSeriesProvider {
  id: string;
  title: string;
  getSeries(request: TimeSeriesRequest): Promise<TimeSeriesResult>;
}

export interface DataApi {
  registerRasterProvider(provider: RasterProvider): () => void;
  registerTimeSeriesProvider(provider: TimeSeriesProvider): () => void;
  getRasterProvider(id: string): RasterProvider | undefined;
  getTimeSeriesProvider(id: string): TimeSeriesProvider | undefined;
  /** Cached fetch with AbortSignal support. */
  fetchJson<T = JsonValue>(url: string, options?: { signal?: AbortSignal; headers?: Record<string, string> }): Promise<T>;
  fetchArrayBuffer(url: string, options?: { signal?: AbortSignal }): Promise<ArrayBuffer>;
}

/* -------------------------------------------------------------------------- */
/* Pixel inspector                                                            */
/* -------------------------------------------------------------------------- */

export interface InspectorContext {
  time: string;
  signal: AbortSignal;
  layers: LayerInfo[];
}

export interface InspectorRow {
  label: string;
  value: string | number;
  unit?: string;
}

export interface InspectorResult {
  id: string;
  title: string;
  rows: InspectorRow[];
  note?: string;
}

export interface InspectorEntry {
  id: string;
  title: string;
  priority?: number;
  supports?(coordinate: Coordinate, context: { time: string; layers: LayerInfo[] }): boolean;
  inspect(coordinate: Coordinate, context: InspectorContext): Promise<InspectorResult | null>;
}

export interface InspectorApi {
  register(entry: InspectorEntry): () => void;
}

/* -------------------------------------------------------------------------- */
/* Analysis graphs                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A declarative, serializable computation graph. Nodes reference operations by
 * id; inputs may be literals, other node ids or bound values. The same graph
 * can therefore run in a web worker today and on a server later.
 */
export interface AnalysisNode {
  id: string;
  op: string;
  /** Port name -> literal value or `{ "$node": "<id>" }`. */
  inputs?: Record<string, JsonValue>;
  params?: JsonObject;
}

export interface AnalysisGraph {
  schemaVersion: 1;
  nodes: AnalysisNode[];
  /** Node ids whose values are returned. */
  outputs: string[];
}

export interface TableColumn {
  key: string;
  label: string;
  unit?: string;
}

export interface TableResult {
  kind: "table";
  columns: TableColumn[];
  rows: JsonObject[];
}

export interface ChartSeries {
  key: string;
  label: string;
  color?: string;
}

export interface ChartResult {
  kind: "chart";
  chartType: "line" | "bar" | "area";
  xKey: string;
  series: ChartSeries[];
  rows: JsonObject[];
  title?: string;
  unit?: string;
}

export interface ValueResult {
  kind: "value";
  value: JsonValue;
  label?: string;
  unit?: string;
}

export type AnalysisResult = TableResult | ChartResult | ValueResult;
export type AnalysisResultKind = AnalysisResult["kind"];

export interface AnalysisRunResult {
  graphId?: string;
  results: Record<string, AnalysisResult>;
  durationMs: number;
  /** Where the graph was executed. */
  executedOn: "worker" | "server";
}

/**
 * A plugin-defined operation. The `implements` block aliases a core operation
 * with preset params so the definition stays serializable and worker-safe.
 */
export interface AnalysisOperation {
  id: string;
  title: string;
  description?: string;
  implements: { op: string; params?: JsonObject };
}

export interface AnalysisValidation {
  valid: boolean;
  errors: string[];
}

export interface AnalysisApi {
  registerOperation(operation: AnalysisOperation): () => void;
  listOperations(): AnalysisOperation[];
  validate(graph: AnalysisGraph): AnalysisValidation;
  run(graph: AnalysisGraph, options?: { signal?: AbortSignal }): Promise<AnalysisRunResult>;
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

export interface CoreEventMap {
  "map:click": { coordinate: Coordinate; time: string };
  "map:hover": { coordinate: Coordinate; time: string };
  "map:moveend": { view: MapViewState };
  "map:ready": { view: MapViewState };
  "time:changed": TimeState;
  "layer:added": LayerInfo;
  "layer:updated": LayerInfo;
  "layer:removed": { uid: string };
  "theme:changed": { theme: ResolvedTheme; preference: ThemePreference };
  "plugin:activated": { id: string; version: string };
  "plugin:deactivated": { id: string };
  "plugin:error": { id: string; message: string };
  "selection:changed": { geometry: Geometry | null };
  "inspect:result": { coordinate: Coordinate; results: InspectorResult[] };
  "notification": { level: "info" | "success" | "warning" | "error"; message: string };
}

export type CoreEventName = keyof CoreEventMap;

export interface EventApi {
  on<K extends CoreEventName>(event: K, handler: (payload: CoreEventMap[K]) => void): () => void;
  once<K extends CoreEventName>(event: K, handler: (payload: CoreEventMap[K]) => void): () => void;
}

/* -------------------------------------------------------------------------- */
/* Storage & i18n                                                             */
/* -------------------------------------------------------------------------- */

export interface StorageApi {
  get<T extends JsonValue>(key: string, fallback: T): T;
  set(key: string, value: JsonValue): void;
  remove(key: string): void;
  clear(): void;
}

export interface I18nApi {
  readonly locale: Locale;
  /** Register translations; keys are namespaced with the plugin id. */
  register(messages: Partial<Record<Locale, Record<string, string>>>): void;
  t(key: string, fallback?: string): string;
  onChange(handler: (locale: Locale) => void): () => void;
}

/* -------------------------------------------------------------------------- */
/* Plugin                                                                     */
/* -------------------------------------------------------------------------- */

export interface PluginLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface PluginApi {
  readonly manifest: PluginManifest;
  readonly coreApiVersion: string;
  readonly map: MapApi;
  readonly layers: LayerApi;
  readonly ui: UiApi;
  readonly coordinates: CoordinateApi;
  readonly time: TimeApi;
  readonly data: DataApi;
  readonly analysis: AnalysisApi;
  readonly inspector: InspectorApi;
  readonly events: EventApi;
  readonly storage: StorageApi;
  readonly settings: SettingsApi;
  readonly i18n: I18nApi;
  readonly logger: PluginLogger;
}

export interface PluginDefinition {
  manifest: PluginManifest;
  activate(api: PluginApi): MaybePromise<void>;
  deactivate?(): MaybePromise<void>;
}

/** Manifest fields that do not identify a source; used by the loader. */
export const CORE_API_VERSION = "0.1.0";

/** Required capabilities that imply network access must be declared. */
export const NETWORK_CAPABILITY: Capability = "network";

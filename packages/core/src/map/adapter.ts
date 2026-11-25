import type {
  BoundingBox,
  Coordinate,
  FeatureCollection,
  Geometry,
  LayerInfo,
  MapViewState,
  ResolvedTheme,
  VectorStyle,
} from "@terrascope/plugin-api";

export interface AdapterPoint {
  coordinate: Coordinate;
  point: { x: number; y: number };
}

export interface AdapterEvents {
  click: AdapterPoint;
  mousemove: AdapterPoint;
  moveend: { view: MapViewState };
  load: { view: MapViewState };
}

/**
 * The single interface through which the core talks to a renderer. Deliberately
 * small: enough for the current MapLibre adapter, nothing speculative beyond a
 * later 3D renderer.
 */
export interface MapAdapter {
  init(options: { view: MapViewState; theme: ResolvedTheme }): Promise<void>;
  getView(): MapViewState;
  setView(view: Partial<MapViewState>): void;
  fitBounds(bounds: BoundingBox, options?: { padding?: number; maxZoom?: number }): void;
  project(coordinate: Coordinate): { x: number; y: number } | null;
  unproject(point: { x: number; y: number }): Coordinate | null;
  /** Declarative reconciliation of the managed layers, bottom to top. */
  sync(layers: LayerInfo[], time: string): void;
  addOverlay(id: string, geometry: Geometry | FeatureCollection, style?: VectorStyle): void;
  removeOverlay(id: string): void;
  setTheme(theme: ResolvedTheme): void;
  resize(): void;
  on<K extends keyof AdapterEvents>(event: K, handler: (payload: AdapterEvents[K]) => void): () => void;
  destroy(): void;
}

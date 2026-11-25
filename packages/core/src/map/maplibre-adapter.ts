import * as maplibregl from "maplibre-gl";
import type {
  BoundingBox,
  Coordinate,
  Feature,
  FeatureCollection,
  Geometry,
  LayerInfo,
  MapViewState,
  ResolvedTheme,
  VectorStyle,
} from "@terrascope/plugin-api";
import type { AdapterEvents, MapAdapter } from "./adapter.js";

const BACKGROUND_ID = "ts-background";
const BACKGROUND: Record<ResolvedTheme, string> = {
  light: "#e8ecef",
  dark: "#0b1116",
};

function accentColor(): string {
  if (typeof document === "undefined") return "#c9922e";
  const value = getComputedStyle(document.documentElement).getPropertyValue("--ts-accent").trim();
  return value || "#c9922e";
}

function geometryList(data: FeatureCollection | Feature | Geometry): Geometry[] {
  if (data.type === "FeatureCollection") return data.features.map((feature) => feature.geometry);
  if (data.type === "Feature") return [data.geometry];
  return [data];
}

function timeToken(time: string, layer: LayerInfo): string {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return time.slice(0, 10);
  const iso = date.toISOString();
  const unit = layer.temporal?.resolution.unit;
  if (unit === "year") return iso.slice(0, 4);
  if (unit === "month") return iso.slice(0, 7);
  if (unit === "hour") return iso.slice(0, 13);
  return iso.slice(0, 10);
}

function resolveTiles(tiles: string[], layer: LayerInfo, time: string): string[] {
  if (!layer.kind || layer.kind !== "raster" || !layer.timeTemplate) return tiles;
  const token = timeToken(time, layer);
  return tiles.map((tile) => tile.replaceAll("{time}", token));
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface ManagedLayer {
  sublayers: Array<{ id: string; type: "raster" | "fill" | "line" | "circle" | "hillshade" }>;
  sourceId: string;
  tileKey: string;
  style: VectorStyle;
}

/**
 * MapLibre GL JS adapter. Uses the globe projection from v5+ and renders only
 * what the layer registry describes — no data sources live here.
 */
export class MapLibreAdapter implements MapAdapter {
  private map: maplibregl.Map | null = null;
  private listeners = new Map<string, Set<(payload: unknown) => void>>();
  private managed = new Map<string, ManagedLayer>();
  private overlays = new Map<string, string[]>();
  private resizeObserver: ResizeObserver | null = null;

  constructor(private container: HTMLElement) {}

  async init(options: { view: MapViewState; theme: ResolvedTheme }): Promise<void> {
    const style: maplibregl.StyleSpecification = {
      version: 8,
      sources: {},
      layers: [
        {
          id: BACKGROUND_ID,
          type: "background",
          paint: { "background-color": BACKGROUND[options.theme] },
        },
      ],
    };

    const map = new maplibregl.Map({
      container: this.container,
      style,
      center: options.view.center,
      zoom: options.view.zoom,
      bearing: options.view.bearing,
      pitch: options.view.pitch,
      attributionControl: false,
    });
    this.map = map;

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => map.resize());
      this.resizeObserver.observe(this.container);
    }

    map.on("style.load", () => {
      map.setProjection({ type: options.view.projection });
    });

    this.bindEvents(map);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("The map did not load within 15 seconds.")), 15_000);
      map.once("load", () => {
        clearTimeout(timer);
        resolve();
      });
    });

    map.once("idle", () => this.emit("load", { view: this.getView() }));
  }

  getView(): MapViewState {
    const map = this.map;
    if (!map) {
      return { center: [0, 0], zoom: 2, bearing: 0, pitch: 0, projection: "globe" };
    }
    const center = map.getCenter();
    return {
      center: [center.lng, center.lat],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      projection: map.getProjection().type === "globe" ? "globe" : "mercator",
    };
  }

  setView(view: Partial<MapViewState>): void {
    const map = this.map;
    if (!map) return;
    if (view.projection) map.setProjection({ type: view.projection });
    map.jumpTo({
      ...(view.center ? { center: view.center } : {}),
      ...(view.zoom === undefined ? {} : { zoom: view.zoom }),
      ...(view.bearing === undefined ? {} : { bearing: view.bearing }),
      ...(view.pitch === undefined ? {} : { pitch: view.pitch }),
    });
  }

  flyTo(view: Partial<MapViewState>): void {
    const map = this.map;
    if (!map) return;
    if (view.projection) map.setProjection({ type: view.projection });
    map.flyTo({
      ...(view.center ? { center: view.center } : {}),
      ...(view.zoom === undefined ? {} : { zoom: view.zoom }),
      ...(view.bearing === undefined ? {} : { bearing: view.bearing }),
      ...(view.pitch === undefined ? {} : { pitch: view.pitch }),
    });
  }

  fitBounds(bounds: BoundingBox, options?: { padding?: number; maxZoom?: number }): void {
    this.map?.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      { padding: options?.padding ?? 48, ...(options?.maxZoom ? { maxZoom: options.maxZoom } : {}) },
    );
  }

  project(coordinate: Coordinate): { x: number; y: number } | null {
    if (!this.map) return null;
    const point = this.map.project([coordinate.lon, coordinate.lat]);
    return { x: point.x, y: point.y };
  }

  unproject(point: { x: number; y: number }): Coordinate | null {
    if (!this.map) return null;
    const lngLat = this.map.unproject([point.x, point.y]);
    return { lon: lngLat.lng, lat: lngLat.lat };
  }

  sync(layers: LayerInfo[], time: string): void {
    const map = this.map;
    if (!map) return;

    const alive = new Set<string>();
    for (const layer of layers) {
      alive.add(layer.uid);
      const existing = this.managed.get(layer.uid);
      if (!existing) {
        this.addLayer(layer, time);
      } else {
        this.updateLayer(layer, existing, time);
      }
    }

    for (const uid of [...this.managed.keys()]) {
      if (!alive.has(uid)) this.removeLayer(uid);
    }

    const order = layers.flatMap((layer) =>
      (this.managed.get(layer.uid)?.sublayers ?? []).map((sublayer) => sublayer.id),
    );
    for (const id of order) {
      if (map.getLayer(id)) map.moveLayer(id);
    }
  }

  addOverlay(id: string, geometry: Geometry | FeatureCollection, style?: VectorStyle): void {
    const map = this.map;
    if (!map) return;
    this.removeOverlay(id);
    const sourceId = `ts-overlay-src:${id}`;
    const color = style?.color ?? accentColor();
    const data: FeatureCollection =
      geometry.type === "FeatureCollection"
        ? geometry
        : {
            type: "FeatureCollection",
            features: [{ type: "Feature", geometry, properties: {} }],
          };
    // Our GeoJSON subset is structurally compatible with the renderer's type.
    map.addSource(sourceId, { type: "geojson", data: data as never });
    const ids = [
      `ts-overlay-fill:${id}`,
      `ts-overlay-line:${id}`,
      `ts-overlay-point:${id}`,
    ];
    map.addLayer({
      id: ids[0] as string,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": style?.fillColor ?? color,
        "fill-opacity": style?.fillOpacity ?? 0.16,
      },
    });
    map.addLayer({
      id: ids[1] as string,
      type: "line",
      source: sourceId,
      paint: { "line-color": color, "line-width": style?.lineWidth ?? 2, "line-dasharray": [2, 1] },
    });
    map.addLayer({
      id: ids[2] as string,
      type: "circle",
      source: sourceId,
      paint: {
        "circle-color": color,
        "circle-radius": style?.pointRadius ?? 5,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
      },
    });
    this.overlays.set(id, [sourceId, ...ids]);
  }

  removeOverlay(id: string): void {
    const map = this.map;
    const ids = this.overlays.get(id);
    if (!map || !ids) return;
    for (const layerId of ids.slice(1)) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    }
    const sourceId = ids[0];
    if (sourceId && map.getSource(sourceId)) map.removeSource(sourceId);
    this.overlays.delete(id);
  }

  setTheme(theme: ResolvedTheme): void {
    const map = this.map;
    if (!map || !map.getLayer(BACKGROUND_ID)) return;
    map.setPaintProperty(BACKGROUND_ID, "background-color", BACKGROUND[theme]);
  }

  resize(): void {
    this.map?.resize();
  }

  on<K extends keyof AdapterEvents>(event: K, handler: (payload: AdapterEvents[K]) => void): () => void {
    const fn = handler as (payload: unknown) => void;
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.map?.remove();
    this.map = null;
    this.managed.clear();
    this.overlays.clear();
    this.listeners.clear();
  }

  private addLayer(layer: LayerInfo, time: string): void {
    const map = this.map;
    if (!map) return;
    const sourceId = `ts-src:${layer.uid}`;
    const base = `ts-layer:${layer.uid}`;
    const style: VectorStyle = {};
    let sublayers: ManagedLayer["sublayers"] = [];
    let tileKey = "";

    if (layer.kind === "raster") {
      const tiles = resolveTiles(layer.tiles, layer, time);
      tileKey = tiles.join(" ");
      map.addSource(sourceId, {
        type: "raster",
        tiles,
        tileSize: layer.tileSize ?? 256,
        ...(layer.minZoom === undefined ? {} : { minzoom: layer.minZoom }),
        ...(layer.maxZoom === undefined ? {} : { maxzoom: layer.maxZoom }),
        attribution: layer.source.attribution,
      });
      map.addLayer({
        id: base,
        type: "raster",
        source: sourceId,
        paint: { "raster-opacity": layer.opacity, "raster-fade-duration": 180 },
      });
      sublayers = [{ id: base, type: "raster" }];
    } else if (layer.kind === "hillshade") {
      map.addSource(sourceId, {
        type: "raster-dem",
        tiles: layer.demTiles,
        tileSize: layer.tileSize ?? 256,
        encoding: layer.encoding ?? "terrarium",
        maxzoom: 15,
        attribution: layer.source.attribution,
      });
      map.addLayer({
        id: base,
        type: "hillshade",
        source: sourceId,
        paint: {
          "hillshade-exaggeration": layer.exaggeration ?? 0.6,
          "hillshade-shadow-color": withAlpha("#0b1c26", layer.opacity),
          "hillshade-highlight-color": withAlpha("#e9f1f7", layer.opacity),
          "hillshade-accent-color": withAlpha("#59707e", layer.opacity),
          "hillshade-illumination-direction": 315,
        },
      });
      sublayers = [{ id: base, type: "hillshade" }];
    } else {
      const geometries = geometryList(layer.data);
      const types = new Set(geometries.map((geometry) => geometry.type));
      const sources: FeatureCollection = {
        type: "FeatureCollection",
        features: geometries.map((geometry) => ({ type: "Feature", geometry, properties: {} })),
      };
      map.addSource(sourceId, { type: "geojson", data: sources as never });
      const color = layer.style?.color ?? accentColor();
      if (types.has("Polygon")) {
        map.addLayer({
          id: `${base}-fill`,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": layer.style?.fillColor ?? color,
            "fill-opacity": layer.style?.fillOpacity ?? 0.35,
            ...(layer.style?.outlineColor ? { "fill-outline-color": layer.style.outlineColor } : {}),
          },
        });
        sublayers.push({ id: `${base}-fill`, type: "fill" });
      }
      if (types.has("LineString") || types.has("Polygon")) {
        map.addLayer({
          id: `${base}-line`,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": color,
            "line-width": layer.style?.lineWidth ?? 2,
            ...(types.has("Polygon") ? { "line-opacity": 0.6 } : {}),
          },
        });
        sublayers.push({ id: `${base}-line`, type: "line" });
      }
      if (types.has("Point")) {
        map.addLayer({
          id: `${base}-point`,
          type: "circle",
          source: sourceId,
          paint: {
            "circle-color": layer.style?.fillColor ?? color,
            "circle-radius": layer.style?.pointRadius ?? 4,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1,
          },
        });
        sublayers.push({ id: `${base}-point`, type: "circle" });
      }
    }

    this.managed.set(layer.uid, { sublayers, sourceId, tileKey, style });
    this.applyVisibility(layer);
  }

  private updateLayer(layer: LayerInfo, managed: ManagedLayer, time: string): void {
    const map = this.map;
    if (!map) return;

    if (layer.kind === "raster") {
      const tiles = resolveTiles(layer.tiles, layer, time);
      const key = tiles.join(" ");
      if (key !== managed.tileKey) {
        managed.tileKey = key;
        const source = map.getSource(managed.sourceId) as { setTiles?: (tiles: string[]) => void } | undefined;
        source?.setTiles?.(tiles);
      }
      for (const sublayer of managed.sublayers) {
        if (map.getLayer(sublayer.id)) map.setPaintProperty(sublayer.id, "raster-opacity", layer.opacity);
      }
    } else if (layer.kind === "hillshade") {
      for (const sublayer of managed.sublayers) {
        if (!map.getLayer(sublayer.id)) continue;
        map.setPaintProperty(sublayer.id, "hillshade-shadow-color", withAlpha("#0b1c26", layer.opacity));
        map.setPaintProperty(sublayer.id, "hillshade-highlight-color", withAlpha("#e9f1f7", layer.opacity));
        map.setPaintProperty(sublayer.id, "hillshade-accent-color", withAlpha("#59707e", layer.opacity));
      }
    } else {
      for (const sublayer of managed.sublayers) {
        if (!map.getLayer(sublayer.id)) continue;
        if (sublayer.type === "fill") {
          map.setPaintProperty(sublayer.id, "fill-opacity", layer.opacity * (managed.style.fillOpacity ?? 0.35));
        }
        if (sublayer.type === "line") map.setPaintProperty(sublayer.id, "line-opacity", layer.opacity);
        if (sublayer.type === "circle") map.setPaintProperty(sublayer.id, "circle-opacity", layer.opacity);
      }
    }

    this.applyVisibility(layer);
  }

  private applyVisibility(layer: LayerInfo): void {
    const map = this.map;
    const managed = this.managed.get(layer.uid);
    if (!map || !managed) return;
    for (const sublayer of managed.sublayers) {
      if (map.getLayer(sublayer.id)) {
        map.setLayoutProperty(sublayer.id, "visibility", layer.visible ? "visible" : "none");
      }
    }
  }

  private removeLayer(uid: string): void {
    const map = this.map;
    const managed = this.managed.get(uid);
    if (!map || !managed) return;
    for (const sublayer of managed.sublayers) {
      if (map.getLayer(sublayer.id)) map.removeLayer(sublayer.id);
    }
    if (map.getSource(managed.sourceId)) map.removeSource(managed.sourceId);
    this.managed.delete(uid);
  }

  private bindEvents(map: maplibregl.Map): void {
    map.on("click", (event) => {
      this.emit("click", {
        coordinate: { lon: event.lngLat.lng, lat: event.lngLat.lat },
        point: { x: event.point.x, y: event.point.y },
      });
    });
    map.on("mousemove", (event) => {
      this.emit("mousemove", {
        coordinate: { lon: event.lngLat.lng, lat: event.lngLat.lat },
        point: { x: event.point.x, y: event.point.y },
      });
    });
    map.on("moveend", () => this.emit("moveend", { view: this.getView() }));
  }

  private emit(event: string, payload: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[core] map listener for "${event}" failed`, error);
      }
    }
  }
}

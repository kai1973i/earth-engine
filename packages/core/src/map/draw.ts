import type { Coordinate, Geometry, PolygonGeometry } from "@terrascope/plugin-api";
import type { CoordinateService } from "../coordinates.js";

export type DrawMode = "none" | "point" | "line" | "polygon" | "rectangle";

export interface DrawState {
  mode: DrawMode;
  points: Coordinate[];
  preview: Geometry | null;
}

function rectangleRing(a: Coordinate, b: Coordinate): PolygonGeometry {
  const west = Math.min(a.lon, b.lon);
  const east = Math.max(a.lon, b.lon);
  const south = Math.min(a.lat, b.lat);
  const north = Math.max(a.lat, b.lat);
  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

/**
 * Point, line, polygon and rectangle tools. Geometries are delivered to plugins
 * via the `selection:changed` event; the core only draws the preview.
 */
export class DrawController {
  private mode: DrawMode = "none";
  private points: Coordinate[] = [];
  private listeners = new Set<(state: DrawState, completed: Geometry | null) => void>();

  constructor(private coordinates: CoordinateService) {}

  getMode(): DrawMode {
    return this.mode;
  }

  setMode(mode: DrawMode): void {
    this.mode = mode;
    this.points = [];
    this.emit(null);
  }

  getState(): DrawState {
    return { mode: this.mode, points: [...this.points], preview: this.buildGeometry(false) };
  }

  addPoint(coordinate: Coordinate): Geometry | null {
    if (this.mode === "none") return null;
    this.points.push(this.coordinates.normalize(coordinate));
    const completed = this.buildGeometry(true);
    if (this.mode === "point" || (this.mode === "rectangle" && this.points.length === 2)) {
      this.points = [];
      this.mode = "none";
      this.emit(completed);
      return completed;
    }
    this.emit(null);
    return null;
  }

  finish(): Geometry | null {
    const geometry = this.buildGeometry(true);
    this.points = [];
    this.mode = "none";
    this.emit(geometry);
    return geometry;
  }

  cancel(): void {
    this.points = [];
    this.mode = "none";
    this.emit(null);
  }

  onChange(handler: (state: DrawState, completed: Geometry | null) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  private buildGeometry(complete: boolean): Geometry | null {
    const points = this.points;
    if (points.length === 0) return null;
    if (this.mode === "point") {
      const first = points[0];
      return first ? { type: "Point", coordinates: [first.lon, first.lat] } : null;
    }
    if (this.mode === "rectangle") {
      const [first, second] = points;
      return first && second ? rectangleRing(first, second) : null;
    }
    if (this.mode === "line") {
      if (points.length < 2) return null;
      return { type: "LineString", coordinates: points.map((point) => [point.lon, point.lat]) };
    }
    if (this.mode === "polygon") {
      if (points.length < (complete ? 3 : 2)) return null;
      const ring = points.map((point) => [point.lon, point.lat] as [number, number]);
      const first = ring[0];
      if (complete && first) ring.push([first[0], first[1]]);
      return { type: "Polygon", coordinates: [ring] };
    }
    return null;
  }

  private emit(completed: Geometry | null): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state, completed);
      } catch (error) {
        console.error("[core] draw listener failed", error);
      }
    }
  }
}

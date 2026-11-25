import proj4 from "proj4";
import type {
  BoundingBox,
  Coordinate,
  CoordinateApi,
  CrsInfo,
} from "@terrascope/plugin-api";

export const WGS84 = "EPSG:4326";
export const WEB_MERCATOR = "EPSG:3857";

const EARTH_RADIUS = 6371008.8;

proj4.defs(
  WGS84,
  "+proj=longlat +datum=WGS84 +no_defs +type=crs",
);
proj4.defs(
  WEB_MERCATOR,
  "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs",
);

const toRad = (degrees: number): number => (degrees * Math.PI) / 180;
const toDeg = (radians: number): number => (radians * 180) / Math.PI;

function clampLatitude(lat: number): number {
  return Math.max(-89.9999, Math.min(89.9999, lat));
}

function dms(value: number, positive: string, negative: string): string {
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  const hemisphere = value >= 0 ? positive : negative;
  return `${degrees}° ${String(minutes).padStart(2, "0")}′ ${seconds.toFixed(1).padStart(4, "0")}″ ${hemisphere}`;
}

/**
 * Single entry point for coordinate reference systems, transformations and
 * geodesic helpers. WGS84 and Web Mercator are always available; any other
 * proj4 definition can be added at runtime by a plugin.
 */
export class CoordinateService implements CoordinateApi {
  private crs = new Map<string, CrsInfo>();
  private displayCrs = WGS84;
  private displayFormat: "decimal" | "dms" = "decimal";

  constructor() {
    this.crs.set(WGS84, { code: WGS84, name: "WGS 84", unit: "°" });
    this.crs.set(WEB_MERCATOR, { code: WEB_MERCATOR, name: "Web Mercator", unit: "m" });
  }

  get crsList(): CrsInfo[] {
    return [...this.crs.values()];
  }

  registerCrs(code: string, definition: string, info?: Omit<CrsInfo, "code">): void {
    proj4.defs(code, definition);
    this.crs.set(code, {
      code,
      name: info?.name ?? code,
      unit: info?.unit ?? "",
    });
  }

  transform(coordinate: Coordinate, from: string, to: string): Coordinate {
    const source = from || WGS84;
    const target = to || WGS84;
    const input: [number, number] = [coordinate.lon, coordinate.lat];
    const output = source === target ? input : (proj4(source, target, input) as [number, number]);
    return {
      lon: output[0],
      lat: output[1],
      ...(coordinate.height === undefined ? {} : { height: coordinate.height }),
      crs: target,
    };
  }

  toWgs84(coordinate: Coordinate): Coordinate {
    return this.transform(coordinate, coordinate.crs ?? WGS84, WGS84);
  }

  fromWgs84(coordinate: Coordinate, to: string): Coordinate {
    return this.transform(coordinate, WGS84, to);
  }

  setDisplayCrs(code: string): void {
    if (!this.crs.has(code)) return;
    this.displayCrs = code;
  }

  currentCrs(): string {
    return this.displayCrs;
  }

  setFormat(format: "decimal" | "dms"): void {
    this.displayFormat = format;
  }

  format(
    coordinate: Coordinate,
    options?: { crs?: string; format?: "decimal" | "dms" },
  ): string {
    const crs = options?.crs ?? this.displayCrs;
    const format = options?.format ?? this.displayFormat;
    const info = this.crs.get(crs);

    if (crs === WGS84) {
      if (format === "dms") {
        return `${dms(coordinate.lat, "N", "S")}, ${dms(coordinate.lon, "E", "W")}`;
      }
      const lat = `${Math.abs(coordinate.lat).toFixed(4)}° ${coordinate.lat >= 0 ? "N" : "S"}`;
      const lon = `${Math.abs(coordinate.lon).toFixed(4)}° ${coordinate.lon >= 0 ? "E" : "W"}`;
      return `${lat}, ${lon}`;
    }

    const projected = this.transform(coordinate, WGS84, crs);
    return `${projected.lon.toFixed(2)} ${info?.unit ?? ""}, ${projected.lat.toFixed(2)} ${info?.unit ?? ""}`.trim();
  }

  parse(text: string, crs: string = WGS84): Coordinate | null {
    const parts = text
      .trim()
      .split(/[,;]+/)
      .map((part) => Number(part.trim().replace(/[^\d.+-]/g, "")))
      .filter((value) => Number.isFinite(value));
    const lat = parts[0];
    const lon = parts[1];
    if (lat === undefined || lon === undefined) return null;
    const candidate: Coordinate = { lon, lat, crs };
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return this.toWgs84(candidate);
  }

  distance(a: Coordinate, b: Coordinate): number {
    const from = this.toWgs84(a);
    const to = this.toWgs84(b);
    const dLat = toRad(to.lat - from.lat);
    const dLon = toRad(to.lon - from.lon);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  area(ring: Coordinate[]): number {
    if (ring.length < 3) return 0;
    const points = ring.map((point) => this.toWgs84(point));
    let sum = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      if (!current || !next) continue;
      sum +=
        toRad(next.lon - current.lon) *
        (2 + Math.sin(toRad(current.lat)) + Math.sin(toRad(next.lat)));
    }
    return Math.abs((sum * EARTH_RADIUS * EARTH_RADIUS) / 2);
  }

  bounds(coordinates: Coordinate[]): BoundingBox {
    const points = coordinates.map((coordinate) => this.toWgs84(coordinate));
    const lons = points.map((point) => point.lon);
    const lats = points.map((point) => point.lat);
    return {
      west: Math.min(...lons),
      south: Math.min(...lats),
      east: Math.max(...lons),
      north: Math.max(...lats),
    };
  }

  /** Normalizes a coordinate to WGS84 and clamps it to the valid range. */
  normalize(coordinate: Coordinate): Coordinate {
    const wgs84 = this.toWgs84(coordinate);
    return {
      lon: Math.max(-180, Math.min(180, wgs84.lon)),
      lat: clampLatitude(wgs84.lat),
      ...(wgs84.height === undefined ? {} : { height: wgs84.height }),
      crs: WGS84,
    };
  }
}

export { toDeg, toRad };

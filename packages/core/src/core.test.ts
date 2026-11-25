import { describe, expect, it } from "vitest";
import type { LayerDescriptor } from "@terrascope/plugin-api";
import { CoordinateService } from "./coordinates.js";
import { EventBus } from "./events.js";
import { LayerRegistry } from "./layers.js";
import { validateManifest } from "./manifest.js";
import { decodeState, encodeState, STATE_VERSION, type AppState } from "./state.js";
import { floorToResolution, TimeService } from "./time.js";
import { compareVersions, parseVersion, satisfies } from "./version.js";
import { executeGraph, validateGraph } from "./analysis/execute.js";
import type { AnalysisGraph } from "@terrascope/plugin-api";

const layer: LayerDescriptor = {
  id: "test",
  name: "Test layer",
  kind: "raster",
  unit: "m",
  tiles: ["https://example.org/{z}/{x}/{y}.png"],
  source: {
    name: "Test",
    url: "https://example.org",
    license: "CC0-1.0",
    attribution: "© Test",
  },
};

describe("version ranges", () => {
  it("parses SemVer", () => {
    expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseVersion("1.2")).toBeNull();
  });

  it("compares versions", () => {
    const a = parseVersion("1.2.3");
    const b = parseVersion("1.3.0");
    expect(a && b && compareVersions(a, b)).toBeLessThan(0);
  });

  it("matches caret ranges including 0.x", () => {
    expect(satisfies("0.1.4", "^0.1.0")).toBe(true);
    expect(satisfies("0.2.0", "^0.1.0")).toBe(false);
    expect(satisfies("1.9.0", "^1.2.0")).toBe(true);
    expect(satisfies("2.0.0", "^1.2.0")).toBe(false);
    expect(satisfies("0.0.2", "^0.0.1")).toBe(false);
  });

  it("handles comparators", () => {
    expect(satisfies("1.5.0", ">=1.0.0 <2.0.0")).toBe(true);
    expect(satisfies("2.0.0", ">=1.0.0 <2.0.0")).toBe(false);
    expect(satisfies("1.2.0", "~1.2.0")).toBe(true);
    expect(satisfies("1.3.0", "~1.2.0")).toBe(false);
  });
});

describe("coordinate service", () => {
  const coordinates = new CoordinateService();

  it("projects WGS84 to Web Mercator and back", () => {
    const berlin = { lon: 13.405, lat: 52.52 };
    const mercator = coordinates.transform(berlin, "EPSG:4326", "EPSG:3857");
    expect(mercator.lon).toBeGreaterThan(1_490_000);
    expect(mercator.lon).toBeLessThan(1_500_000);
    expect(mercator.lat).toBeGreaterThan(6_850_000);
    expect(mercator.lat).toBeLessThan(6_950_000);

    const roundTrip = coordinates.toWgs84(mercator);
    expect(roundTrip.lon).toBeCloseTo(berlin.lon, 6);
    expect(roundTrip.lat).toBeCloseTo(berlin.lat, 6);
  });

  it("measures geodesic distances", () => {
    const distance = coordinates.distance(
      { lon: 13.405, lat: 52.52 },
      { lon: 9.9937, lat: 53.5511 },
    );
    expect(distance).toBeGreaterThan(250_000);
    expect(distance).toBeLessThan(260_000);
  });

  it("computes spherical polygon areas", () => {
    const area = coordinates.area([
      { lon: 0, lat: 0 },
      { lon: 1, lat: 0 },
      { lon: 1, lat: 1 },
      { lon: 0, lat: 1 },
    ]);
    expect(area).toBeGreaterThan(1.2e10);
    expect(area).toBeLessThan(1.25e10);
  });

  it("formats and parses coordinates", () => {
    expect(coordinates.format({ lon: 13.405, lat: 52.52 })).toContain("52.5200° N");
    expect(coordinates.parse("52.52, 13.405")?.lon).toBeCloseTo(13.405, 6);
    expect(coordinates.parse("not a coordinate")).toBeNull();
  });
});

describe("layer registry", () => {
  it("registers layers and namespaces ids", () => {
    const registry = new LayerRegistry(new EventBus());
    const info = registry.add("org.example", layer);
    expect(info.uid).toBe("org.example:test");
    expect(registry.list()).toHaveLength(1);
    expect(registry.get("test", "org.example")?.name).toBe("Test layer");
  });

  it("rejects descriptors without attribution", () => {
    const registry = new LayerRegistry(new EventBus());
    expect(() =>
      registry.add("org.example", {
        ...layer,
        source: { ...layer.source, attribution: "" },
      } as LayerDescriptor),
    ).toThrow(/attribution/);
  });

  it("orders layers by z-index and toggles visibility", () => {
    const registry = new LayerRegistry(new EventBus());
    registry.add("p", { ...layer, id: "top", zIndex: 10 } as LayerDescriptor);
    registry.add("p", { ...layer, id: "bottom", zIndex: -10 } as LayerDescriptor);
    expect(registry.list().map((entry) => entry.id)).toEqual(["bottom", "top"]);
    registry.setVisibility("p:top", false);
    expect(registry.get("top", "p")?.visible).toBe(false);
  });

  it("cleans up all layers of a plugin", () => {
    const registry = new LayerRegistry(new EventBus());
    registry.add("a", layer);
    registry.add("b", { ...layer, id: "other" } as LayerDescriptor);
    registry.removeAll("a");
    expect(registry.list().map((entry) => entry.uid)).toEqual(["b:other"]);
  });
});

describe("time service", () => {
  it("floors instants to the layer resolution", () => {
    const instant = "2024-06-15T13:37:00.000Z";
    expect(floorToResolution(instant, { unit: "day", step: 1 })).toBe("2024-06-15T00:00:00.000Z");
    expect(floorToResolution(instant, { unit: "month", step: 1 })).toBe("2024-06-01T00:00:00.000Z");
    expect(floorToResolution(instant, { unit: "year", step: 1 })).toBe("2024-01-01T00:00:00.000Z");
    expect(floorToResolution(instant, { unit: "hour", step: 6 })).toBe("2024-06-15T12:00:00.000Z");
  });

  it("clamps instants to the range and resolves temporal support", () => {
    const time = new TimeService(new EventBus());
    time.setRange("2024-01-01T00:00:00.000Z", "2024-12-31T00:00:00.000Z");
    time.setInstant("2023-05-01T00:00:00.000Z");
    expect(time.get().instant).toBe("2024-01-01T00:00:00.000Z");
    expect(
      time.resolveFor({
        resolution: { unit: "day", step: 1 },
        start: "2024-01-01T00:00:00.000Z",
        end: "2024-06-30T00:00:00.000Z",
        availability: "discrete",
      }),
    ).toBe("2024-01-01T00:00:00.000Z");
  });
});

describe("application state", () => {
  const state: AppState = {
    version: STATE_VERSION,
    view: { center: [13.4, 52.5], zoom: 6, bearing: 0, pitch: 0, projection: "globe" },
    time: {
      instant: "2024-06-01T00:00:00.000Z",
      range: { start: "2024-01-01T00:00:00.000Z", end: "2024-12-31T00:00:00.000Z" },
      resolution: { unit: "day", step: 1 },
    },
    theme: "dark",
    locale: "de",
    layers: [{ uid: "org.example:test", visible: true, opacity: 0.8 }],
    plugins: [{ id: "org.example.demo", version: "0.1.0", enabled: true }],
    settings: { "org.example.demo": { max: 5 } },
  };

  it("round-trips through a URL-safe string", () => {
    const encoded = encodeState(state);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeState(encoded)).toEqual(state);
  });

  it("rejects malformed state", () => {
    expect(decodeState("not-base64")).toBeNull();
    expect(decodeState(encodeState({ ...state, version: 99 }))).toBeNull();
  });
});

describe("analysis graphs", () => {
  const graph: AnalysisGraph = {
    schemaVersion: 1,
    nodes: [
      {
        id: "table",
        op: "table.fromSeries",
        inputs: {
          times: ["2024-01-01", "2024-01-02", "2024-01-03"],
          values: [1, 2, 6],
        },
        params: { valueKey: "value", valueLabel: "Value", unit: "°C" },
      },
      { id: "mean", op: "value.mean", inputs: { values: [1, 2, 6] } },
      {
        id: "chart",
        op: "chart.fromTable",
        inputs: { table: { $node: "table" } },
        params: { chartType: "line", xKey: "time", unit: "°C" },
      },
    ],
    outputs: ["mean", "chart"],
  };

  it("executes a declarative graph", () => {
    const { results } = executeGraph(graph);
    expect(results["mean"]).toEqual({ kind: "value", value: 3, label: "mean" });
    const chart = results["chart"];
    expect(chart?.kind).toBe("chart");
    if (chart?.kind === "chart") {
      expect(chart.rows).toHaveLength(3);
      expect(chart.unit).toBe("°C");
    }
  });

  it("validates operations and node order", () => {
    const broken: AnalysisGraph = {
      schemaVersion: 1,
      nodes: [
        { id: "a", op: "math.add", inputs: { a: { $node: "b" }, b: 1 } },
        { id: "b", op: "nope" },
      ],
      outputs: ["missing"],
    };
    const errors = validateGraph(broken);
    expect(errors.join(" ")).toMatch(/Unknown operation/);
    expect(errors.join(" ")).toMatch(/earlier node/);
    expect(errors.join(" ")).toMatch(/does not exist/);
  });
});

describe("manifest validation", () => {
  it("accepts a complete manifest", () => {
    expect(
      validateManifest({
        id: "org.example.demo",
        name: "Demo",
        version: "0.1.0",
        author: "Example",
        license: "Apache-2.0",
        coreApi: "^0.1.0",
        capabilities: ["layers"],
      }),
    ).toEqual([]);
  });

  it("reports missing and invalid fields", () => {
    const errors = validateManifest({ id: "Demo", capabilities: ["bogus"] });
    expect(errors.join(" ")).toMatch(/reverse-DNS/);
    expect(errors.join(" ")).toMatch(/version/);
    expect(errors.join(" ")).toMatch(/capability/);
  });
});

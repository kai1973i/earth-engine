import type {
  AnalysisGraph,
  ChartResult,
  Coordinate,
  Geometry,
  JsonValue,
  PluginApi,
  PluginDefinition,
  PluginManifest,
  TimeSeriesResult,
} from "@terrascope/plugin-api";
import manifestJson from "../plugin.json";
import { renderSeriesChart } from "./chart.js";

const manifest = manifestJson as unknown as PluginManifest;
const pluginId = manifest.id;

const GIBS_TILES = [
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
];

const DAY_MS = 86_400_000;
const MEAN_OP = `${pluginId}.series.mean`;

function isoDay(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

function pointOf(geometry: Geometry | null): Coordinate | null {
  if (!geometry) return null;
  if (geometry.type === "Point") {
    const [lon, lat] = geometry.coordinates;
    return { lon, lat };
  }
  const rings =
    geometry.type === "Polygon"
      ? geometry.coordinates[0] ?? []
      : geometry.type === "LineString"
        ? geometry.coordinates
        : [];
  if (rings.length === 0) return null;
  let lon = 0;
  let lat = 0;
  for (const position of rings) {
    lon += position[0];
    lat += position[1];
  }
  return { lon: lon / rings.length, lat: lat / rings.length };
}

interface WebMeteoDaily {
  time?: string[];
  temperature_2m_max?: Array<number | null>;
}

interface SeriesState {
  point: Coordinate | null;
  series: TimeSeriesResult | null;
  chart: ChartResult | null;
  minimums: number | null;
  maximums: number | null;
  mean: number | null;
  duration: number | null;
  pending: boolean;
  error: string | null;
}

/**
 * Time series demo. A time-aware GIBS raster layer is synchronized by the core
 * time slider; a point selection is turned into a declarative analysis graph
 * that runs in the analysis worker.
 */
const definition: PluginDefinition = {
  manifest,

  activate(api) {
    const state: SeriesState = {
      point: null,
      series: null,
      chart: null,
      minimums: null,
      maximums: null,
      mean: null,
      duration: null,
      pending: false,
      error: null,
    };
    const listeners = new Set<() => void>();
    let lastRangeKey = "";
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const notify = (): void => {
      for (const listener of listeners) {
        try {
          listener();
        } catch (error) {
          api.logger.warn("time series panel listener failed", error);
        }
      }
    };

    api.i18n.register({
      en: {
        "org.terrascope.timeseries-demo.section": "Temperature series",
        "org.terrascope.timeseries-demo.description":
          "Draw a point on the map (or sample the map centre) to fetch a daily maximum temperature series for the global time range. The series is aggregated by a declarative analysis graph in a worker.",
        "org.terrascope.timeseries-demo.sampleCentre": "Sample map centre",
        "org.terrascope.timeseries-demo.clear": "Clear",
        "org.terrascope.timeseries-demo.detailTitle": "Temperature at point",
        "org.terrascope.timeseries-demo.hint":
          "No point selected. Use the point tool or sample the map centre.",
        "org.terrascope.timeseries-demo.loading": "Fetching time series…",
        "org.terrascope.timeseries-demo.source": "Daily maximum temperature, Open-Meteo ERA5 archive.",
        "org.terrascope.timeseries-demo.mean": "Mean",
        "org.terrascope.timeseries-demo.min": "Min",
        "org.terrascope.timeseries-demo.max": "Max",
        "org.terrascope.timeseries-demo.worker": "Analysed in {ms} ms in the worker",
        "org.terrascope.timeseries-demo.failed": "Could not load the series: {message}",
        "org.terrascope.timeseries-demo.layer": "MODIS Terra true colour",
        "org.terrascope.timeseries-demo.layerNote": "NASA GIBS, daily composite, 250 m.",
      },
      de: {
        "org.terrascope.timeseries-demo.section": "Temperaturreihe",
        "org.terrascope.timeseries-demo.description":
          "Zeichne einen Punkt auf der Karte (oder nutze die Kartenmitte), um eine tägliche Maximum-Temperaturreihe für den globalen Zeitraum zu laden. Die Auswertung läuft als deklarativer Analysegraph im Worker.",
        "org.terrascope.timeseries-demo.sampleCentre": "Kartenmitte messen",
        "org.terrascope.timeseries-demo.clear": "Zurücksetzen",
        "org.terrascope.timeseries-demo.detailTitle": "Temperatur am Punkt",
        "org.terrascope.timeseries-demo.hint":
          "Kein Punkt gewählt. Nutze das Punkt-Werkzeug oder die Kartenmitte.",
        "org.terrascope.timeseries-demo.loading": "Zeitreihe wird geladen…",
        "org.terrascope.timeseries-demo.source": "Tägliche Maximumtemperatur, Open-Meteo-ERA5-Archiv.",
        "org.terrascope.timeseries-demo.mean": "Mittel",
        "org.terrascope.timeseries-demo.min": "Min",
        "org.terrascope.timeseries-demo.max": "Max",
        "org.terrascope.timeseries-demo.worker": "In {ms} ms im Worker analysiert",
        "org.terrascope.timeseries-demo.failed": "Zeitreihe konnte nicht geladen werden: {message}",
        "org.terrascope.timeseries-demo.layer": "MODIS Terra Echtfarbe",
        "org.terrascope.timeseries-demo.layerNote": "NASA GIBS, tägliches Komposit, 250 m.",
      },
    });

    api.analysis.registerOperation({
      id: MEAN_OP,
      title: "Mean of a series",
      description: "Alias of the worker-safe mean primitive, contributed by the time series plugin.",
      implements: { op: "value.mean" },
    });

    api.data.registerTimeSeriesProvider({
      id: "open-meteo",
      title: "Open-Meteo ERA5 archive",
      async getSeries(request) {
        const url = new URL("https://archive-api.open-meteo.com/v1/archive");
        url.searchParams.set("latitude", request.coordinate.lat.toFixed(4));
        url.searchParams.set("longitude", request.coordinate.lon.toFixed(4));
        url.searchParams.set("start_date", request.start.slice(0, 10));
        url.searchParams.set("end_date", request.end.slice(0, 10));
        url.searchParams.set("daily", "temperature_2m_max");
        url.searchParams.set("timezone", "UTC");

        const payload = await api.data.fetchJson<{ daily?: WebMeteoDaily }>(
          url.toString(),
          request.signal ? { signal: request.signal } : undefined,
        );
        const times = payload.daily?.time ?? [];
        const values = payload.daily?.temperature_2m_max ?? [];
        if (times.length === 0) throw new Error("No data available for this location and range.");
        return {
          unit: "°C",
          points: times.map((time, index) => ({
            time: new Date(`${time}T00:00:00.000Z`).toISOString(),
            value: typeof values[index] === "number" ? (values[index] as number) : null,
          })),
          source: {
            name: "Open-Meteo ERA5 archive",
            url: "https://open-meteo.com/en/docs/historical-weather-api",
            license: "CC-BY 4.0 (Open-Meteo), ERA5 © ECMWF",
            licenseUrl: "https://open-meteo.com/en/license",
            attribution: "Weather data © Open-Meteo.com (CC-BY 4.0)",
          },
        };
      },
    });

    api.layers.add({
      id: "gibs-modis",
      kind: "raster",
      name: api.i18n.t("org.terrascope.timeseries-demo.layer"),
      description: api.i18n.t("org.terrascope.timeseries-demo.layerNote"),
      unit: "reflectance",
      zIndex: 5,
      tileSize: 256,
      maxZoom: 9,
      opacity: 0.9,
      timeTemplate: true,
      tiles: GIBS_TILES,
      temporal: {
        resolution: { unit: "day", step: 1 },
        start: "2000-02-24T00:00:00.000Z",
        end: `${isoDay(-2)}T00:00:00.000Z`,
        availability: "discrete",
      },
      source: {
        name: "NASA GIBS – MODIS Terra Corrected Reflectance",
        url: "https://www.earthdata.nasa.gov/gibs",
        license: "NASA EOSDIS, public domain",
        licenseUrl: "https://www.earthdata.nasa.gov/about/esdis/eosdis",
        attribution: "Imagery © NASA GIBS / MODIS Terra",
      },
      legend: {
        type: "categorical",
        items: [{ value: "truecolor", label: "True colour composite" }],
      },
    });

    const load = async (point: Coordinate): Promise<void> => {
      state.point = point;
      state.pending = true;
      state.error = null;
      notify();

      try {
        const provider = api.data.getTimeSeriesProvider("open-meteo");
        if (!provider) throw new Error("The Open-Meteo provider is not registered.");
        const range = api.time.get().range;
        const series = await provider.getSeries({
          coordinate: point,
          start: range.start,
          end: range.end,
        });
        state.series = series;

        const times: JsonValue[] = series.points.map((entry) => entry.time);
        const values: JsonValue[] = series.points.map((entry) => entry.value);

        const graph: AnalysisGraph = {
          schemaVersion: 1,
          nodes: [
            {
              id: "table",
              op: "table.fromSeries",
              inputs: { times, values },
              params: {
                valueKey: "temperature",
                valueLabel: "Temperature",
                unit: series.unit,
              },
            },
            { id: "mean", op: MEAN_OP, inputs: { values } },
            { id: "min", op: "value.min", inputs: { values } },
            { id: "max", op: "value.max", inputs: { values } },
            {
              id: "chart",
              op: "chart.fromTable",
              inputs: { table: { $node: "table" } },
              params: {
                chartType: "line",
                xKey: "time",
                series: [{ key: "temperature", label: "Temperature" }],
                unit: series.unit,
                title: "Temperature at point",
              },
            },
          ],
          outputs: ["mean", "min", "max", "chart"],
        };

        const run = await api.analysis.run(graph);
        state.duration = run.durationMs;
        const mean = run.results["mean"];
        const min = run.results["min"];
        const max = run.results["max"];
        const chart = run.results["chart"];
        state.mean = mean?.kind === "value" ? Number(mean.value) : null;
        state.minimums = min?.kind === "value" ? Number(min.value) : null;
        state.maximums = max?.kind === "value" ? Number(max.value) : null;
        state.chart = chart?.kind === "chart" ? chart : null;
        state.pending = false;
        notify();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        state.pending = false;
        state.error = error instanceof Error ? error.message : String(error);
        api.logger.warn("time series failed", error);
        notify();
      }
    };

    const offSelection = api.events.on("selection:changed", ({ geometry }) => {
      const point = pointOf(geometry);
      if (point) void load(point);
    });
    void offSelection;

    const offTime = api.time.onChange((time) => {
      const key = `${time.range.start}/${time.range.end}`;
      if (key === lastRangeKey) return;
      lastRangeKey = key;
      if (!state.point) return;
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        if (state.point) void load(state.point);
      }, 400);
    });
    void offTime;

    api.ui.registerSlot({
      id: "timeseries-actions",
      slot: "sidebar",
      title: api.i18n.t("org.terrascope.timeseries-demo.section"),
      icon: "chart-line",
      order: 40,
      mount(container, context) {
        const section = document.createElement("section");
        section.style.padding = "var(--ts-space-4)";
        section.style.borderTop = "1px solid var(--ts-border-soft)";

        const heading = document.createElement("h3");
        heading.textContent = context.t("org.terrascope.timeseries-demo.section", "Temperature series");
        heading.style.margin = "0 0 var(--ts-space-2)";
        heading.style.fontSize = "var(--ts-text-xs)";
        heading.style.textTransform = "uppercase";
        heading.style.letterSpacing = "0.05em";
        heading.style.color = "var(--ts-text-faint)";

        const description = document.createElement("p");
        description.textContent = context.t(
          "org.terrascope.timeseries-demo.description",
          "Draw a point to load a temperature series.",
        );
        description.style.margin = "0 0 var(--ts-space-3)";
        description.style.fontSize = "var(--ts-text-xs)";
        description.style.color = "var(--ts-text-muted)";

        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "var(--ts-space-2)";

        const sample = document.createElement("button");
        sample.type = "button";
        sample.className = "ts-btn";
        sample.dataset["size"] = "sm";
        sample.textContent = context.t(
          "org.terrascope.timeseries-demo.sampleCentre",
          "Sample map centre",
        );
        sample.addEventListener("click", () => {
          const [lon, lat] = api.map.getView().center;
          void load({ lon, lat });
          api.map.setView({ center: [lon, lat] });
        });

        const clear = document.createElement("button");
        clear.type = "button";
        clear.className = "ts-btn";
        clear.dataset["variant"] = "ghost";
        clear.dataset["size"] = "sm";
        clear.textContent = context.t("org.terrascope.timeseries-demo.clear", "Clear");
        clear.addEventListener("click", () => {
          state.point = null;
          state.series = null;
          state.chart = null;
          state.mean = null;
          state.minimums = null;
          state.maximums = null;
          state.error = null;
          notify();
        });

        actions.append(sample, clear);
        section.append(heading, description, actions);
        container.append(section);
      },
    });

    api.ui.registerSlot({
      id: "timeseries-detail",
      slot: "detail",
      title: api.i18n.t("org.terrascope.timeseries-demo.detailTitle"),
      icon: "chart-line",
      order: 50,
      mount(container, context) {
        const section = document.createElement("section");
        section.style.padding = "var(--ts-space-4)";
        section.style.display = "flex";
        section.style.flexDirection = "column";
        section.style.gap = "var(--ts-space-3)";

        const heading = document.createElement("h3");
        heading.textContent = context.t(
          "org.terrascope.timeseries-demo.detailTitle",
          "Temperature at point",
        );
        heading.style.margin = "0";
        heading.style.fontSize = "var(--ts-text-sm)";

        const subtitle = document.createElement("div");
        subtitle.style.fontSize = "var(--ts-text-xs)";
        subtitle.style.color = "var(--ts-text-muted)";
        subtitle.style.fontFamily = "var(--ts-font-mono)";

        const status = document.createElement("div");
        status.style.fontSize = "var(--ts-text-xs)";
        status.style.color = "var(--ts-text-muted)";

        const chartHost = document.createElement("div");

        const stats = document.createElement("div");
        stats.style.display = "grid";
        stats.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
        stats.style.gap = "var(--ts-space-2)";

        const footer = document.createElement("div");
        footer.style.fontSize = "var(--ts-text-2xs)";
        footer.style.color = "var(--ts-text-faint)";
        footer.style.lineHeight = "1.5";

        section.append(heading, subtitle, status, chartHost, stats, footer);
        container.append(section);

        const render = (): void => {
          subtitle.textContent = state.point
            ? `${state.point.lat.toFixed(3)}°, ${state.point.lon.toFixed(3)}°`
            : "";

          if (state.pending) {
            status.textContent = context.t(
              "org.terrascope.timeseries-demo.loading",
              "Fetching time series…",
            );
          } else if (state.error) {
            status.textContent = context
              .t("org.terrascope.timeseries-demo.failed", "Could not load the series: {message}")
              .replace("{message}", state.error);
            status.style.color = "var(--ts-danger)";
          } else {
            status.textContent = "";
          }

          stats.replaceChildren();
          const showStat = (label: string, value: number | null): void => {
            if (value === null) return;
            const box = document.createElement("div");
            box.style.border = "1px solid var(--ts-border-soft)";
            box.style.borderRadius = "var(--ts-radius-sm)";
            box.style.padding = "var(--ts-space-2) var(--ts-space-3)";
            const labelNode = document.createElement("div");
            labelNode.textContent = label;
            labelNode.style.fontSize = "var(--ts-text-2xs)";
            labelNode.style.textTransform = "uppercase";
            labelNode.style.letterSpacing = "0.05em";
            labelNode.style.color = "var(--ts-text-faint)";
            const valueNode = document.createElement("div");
            valueNode.textContent = `${value.toFixed(1)} °C`;
            valueNode.style.fontFamily = "var(--ts-font-mono)";
            valueNode.style.fontSize = "var(--ts-text-md)";
            box.append(labelNode, valueNode);
            stats.append(box);
          };

          if (state.chart) {
            renderSeriesChart(
              chartHost,
              state.chart,
              context.t("org.terrascope.timeseries-demo.hint", "No point selected."),
            );
            showStat(context.t("org.terrascope.timeseries-demo.mean", "Mean"), state.mean);
            showStat(context.t("org.terrascope.timeseries-demo.min", "Min"), state.minimums);
            showStat(context.t("org.terrascope.timeseries-demo.max", "Max"), state.maximums);
            footer.textContent = [
              context.t(
                "org.terrascope.timeseries-demo.source",
                "Daily maximum temperature, Open-Meteo ERA5 archive.",
              ),
              state.duration === null
                ? ""
                : context
                    .t(
                      "org.terrascope.timeseries-demo.worker",
                      "Analysed in {ms} ms in the worker",
                    )
                    .replace("{ms}", String(state.duration)),
            ]
              .filter(Boolean)
              .join(" ");
          } else {
            chartHost.textContent = context.t(
              "org.terrascope.timeseries-demo.hint",
              "No point selected. Use the point tool.",
            );
            chartHost.style.fontSize = "var(--ts-text-xs)";
            chartHost.style.color = "var(--ts-text-muted)";
            footer.textContent = "";
          }
        };

        render();
        listeners.add(render);
        return () => {
          listeners.delete(render);
        };
      },
    });

    lastRangeKey = `${api.time.get().range.start}/${api.time.get().range.end}`;
    api.logger.info("time series plugin activated");
  },
};

export default definition;

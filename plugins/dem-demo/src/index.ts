import type {
  Coordinate,
  InspectorResult,
  PluginApi,
  PluginDefinition,
  PluginManifest,
} from "@terrascope/plugin-api";
import manifestJson from "../plugin.json";

const manifest = manifestJson as unknown as PluginManifest;

const TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const PROVIDER_ID = "terrarium";
const SAMPLE_ZOOM = 12;
const TILE_SIZE = 256;

interface Sample {
  elevation: number;
  tile: { z: number; x: number; y: number; px: number; py: number };
}

function tilePixel(coordinate: Coordinate, zoom: number): { x: number; y: number; px: number; py: number } {
  const scale = 2 ** zoom;
  const lat = Math.max(-85.05112878, Math.min(85.05112878, coordinate.lat));
  const worldX = ((coordinate.lon + 180) / 360) * scale * TILE_SIZE;
  const latRad = (lat * Math.PI) / 180;
  const worldY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale * TILE_SIZE;
  return {
    x: Math.floor(worldX / TILE_SIZE),
    y: Math.floor(worldY / TILE_SIZE),
    px: Math.floor(worldX % TILE_SIZE),
    py: Math.floor(worldY % TILE_SIZE),
  };
}

async function decodeElevation(buffer: ArrayBuffer, px: number, py: number): Promise<number> {
  const bitmap = await createImageBitmap(new Blob([buffer], { type: "image/png" }));
  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(TILE_SIZE, TILE_SIZE)
      : Object.assign(document.createElement("canvas"), {
          width: TILE_SIZE,
          height: TILE_SIZE,
        });
  const context = canvas.getContext("2d") as unknown as CanvasRenderingContext2D | null;
  if (!context) throw new Error("A 2D canvas context is required to decode DEM tiles.");
  context.drawImage(bitmap, 0, 0);
  const data = context.getImageData(Math.min(TILE_SIZE - 1, px), Math.min(TILE_SIZE - 1, py), 1, 1).data;
  bitmap.close();
  const red = data[0] ?? 0;
  const green = data[1] ?? 0;
  const blue = data[2] ?? 0;
  return red * 256 + green + blue / 256 - 32768;
}

let cachedTile: { key: string; buffer: ArrayBuffer } | null = null;

async function sampleElevation(api: PluginApi, coordinate: Coordinate, signal?: AbortSignal): Promise<Sample> {
  const tile = tilePixel(coordinate, SAMPLE_ZOOM);
  const key = `${SAMPLE_ZOOM}/${tile.x}/${tile.y}`;
  let buffer: ArrayBuffer;
  if (cachedTile?.key === key) {
    buffer = cachedTile.buffer;
  } else {
    buffer = await api.data.fetchArrayBuffer(
      `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${key}.png`,
      signal ? { signal } : undefined,
    );
    cachedTile = { key, buffer };
  }
  const elevation = await decodeElevation(buffer, tile.px, tile.py);
  return { elevation, tile: { ...tile, z: SAMPLE_ZOOM } };
}

/**
 * Elevation demo: hillshade rendering plus a pixel inspector. The inspector
 * decodes Terrarium tiles itself, so the core needs no raster codec.
 */
const definition: PluginDefinition = {
  manifest,

  activate(api) {
    api.i18n.register({
      en: {
        "org.terrascope.dem-demo.section": "Elevation",
        "org.terrascope.dem-demo.description":
          "Hillshade from Terrarium terrain tiles (AWS Open Data, Mapzen). Click the map to sample the elevation.",
        "org.terrascope.dem-demo.lastSample": "Last sample",
        "org.terrascope.dem-demo.none": "No sample yet",
        "org.terrascope.dem-demo.inspector": "Elevation",
        "org.terrascope.dem-demo.elevation": "Elevation",
        "org.terrascope.dem-demo.tile": "Tile",
        "org.terrascope.dem-demo.note": "Terrarium DEM, ~30 m at this latitude.",
      },
      de: {
        "org.terrascope.dem-demo.section": "Höhenmodell",
        "org.terrascope.dem-demo.description":
          "Hillshade aus Terrarium-Terrain-Kacheln (AWS Open Data, Mapzen). Klicke in die Karte, um die Höhe zu messen.",
        "org.terrascope.dem-demo.lastSample": "Letzte Messung",
        "org.terrascope.dem-demo.none": "Noch keine Messung",
        "org.terrascope.dem-demo.inspector": "Höhe",
        "org.terrascope.dem-demo.elevation": "Höhe",
        "org.terrascope.dem-demo.tile": "Kachel",
        "org.terrascope.dem-demo.note": "Terrarium-DEM, in dieser Breite ca. 30 m Auflösung.",
      },
    });

    api.data.registerRasterProvider({
      id: PROVIDER_ID,
      title: "Terrarium terrain tiles",
      async getTile(request) {
        const data = await api.data.fetchArrayBuffer(
          `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${request.z}/${request.x}/${request.y}.png`,
          request.signal ? { signal: request.signal } : undefined,
        );
        return { data, contentType: "image/png" };
      },
    });

    api.layers.add({
      id: "hillshade",
      kind: "hillshade",
      name: "Hillshade (Terrarium)",
      description: "Terrain relief shading derived from the Terrarium DEM.",
      unit: "m",
      zIndex: -10,
      demTiles: [TILE_URL],
      encoding: "terrarium",
      tileSize: 256,
      exaggeration: 0.65,
      opacity: 0.9,
      source: {
        name: "AWS Terrain Tiles (Mapzen Terrarium)",
        url: "https://registry.opendata.aws/terrain-tiles/",
        license: "CC-BY 4.0 / public domain sources",
        licenseUrl: "https://github.com/tilezen/joerd/blob/master/docs/attribution.md",
        attribution: "Terrain tiles © Mapzen / AWS Open Data",
      },
      legend: {
        type: "gradient",
        stops: [
          { value: 0, color: "#0b1c26" },
          { value: 1, color: "#e9f1f7" },
        ],
      },
    });

    api.ui.registerSlot({
      id: "dem-panel",
      slot: "sidebar",
      title: api.i18n.t("org.terrascope.dem-demo.section"),
      icon: "mountain",
      order: 30,
      mount(container, context) {
        const section = document.createElement("section");
        section.style.padding = "var(--ts-space-4)";
        section.style.borderTop = "1px solid var(--ts-border-soft)";

        const heading = document.createElement("h3");
        heading.textContent = context.t("org.terrascope.dem-demo.section", "Elevation");
        heading.style.margin = "0 0 var(--ts-space-2)";
        heading.style.fontSize = "var(--ts-text-xs)";
        heading.style.textTransform = "uppercase";
        heading.style.letterSpacing = "0.05em";
        heading.style.color = "var(--ts-text-faint)";

        const description = document.createElement("p");
        description.textContent = context.t(
          "org.terrascope.dem-demo.description",
          "Hillshade from Terrarium terrain tiles.",
        );
        description.style.margin = "0 0 var(--ts-space-3)";
        description.style.fontSize = "var(--ts-text-xs)";
        description.style.color = "var(--ts-text-muted)";

        const sampleLabel = document.createElement("div");
        sampleLabel.textContent = context.t("org.terrascope.dem-demo.lastSample", "Last sample");
        sampleLabel.style.fontSize = "var(--ts-text-2xs)";
        sampleLabel.style.textTransform = "uppercase";
        sampleLabel.style.letterSpacing = "0.05em";
        sampleLabel.style.color = "var(--ts-text-faint)";

        const sampleValue = document.createElement("div");
        sampleValue.style.fontFamily = "var(--ts-font-mono)";
        sampleValue.style.fontSize = "var(--ts-text-lg)";
        sampleValue.style.marginTop = "2px";
        sampleValue.textContent = context.t("org.terrascope.dem-demo.none", "No sample yet");

        section.append(heading, description, sampleLabel, sampleValue);
        container.append(section);

        const off = api.events.on("inspect:result", ({ results }) => {
          const own = results.find((result) => result.id === "dem-elevation");
          const elevation = own?.rows.find((row) => row.label === "Elevation");
          if (elevation) {
            sampleValue.textContent = `${Number(elevation.value).toFixed(0)} m`;
          }
        });
        return off;
      },
    });

    api.inspector.register({
      id: "dem-elevation",
      title: api.i18n.t("org.terrascope.dem-demo.inspector"),
      priority: 90,
      supports: () => api.layers.get("hillshade")?.visible === true,
      async inspect(coordinate, context): Promise<InspectorResult | null> {
        try {
          const sample = await sampleElevation(api, coordinate, context.signal);
          return {
            id: "dem-elevation",
            title: api.i18n.t("org.terrascope.dem-demo.inspector"),
            rows: [
              {
                label: "Elevation",
                value: Number(sample.elevation.toFixed(1)),
                unit: "m",
              },
              {
                label: "Tile",
                value: `${sample.tile.z}/${sample.tile.x}/${sample.tile.y}`,
              },
            ],
            note: api.i18n.t("org.terrascope.dem-demo.note"),
          };
        } catch (error) {
          if (context.signal.aborted) return null;
          api.logger.warn("elevation sampling failed", error);
          return null;
        }
      },
    });
  },
};

export default definition;

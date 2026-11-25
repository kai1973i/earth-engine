# TerraScope

**TerraScope** is an open-source geodata workspace in the spirit of Google Earth
Engine: explore, visualise and analyse satellite imagery, climate data, terrain
and vector data on an interactive map or globe.

The defining idea is architectural, not visual:

> **The core contains no data sources.** It provides the map, the coordinate
> service, the layer system, the time dimension, the plugin runtime, the UI
> slots and the analysis runtime — and nothing else. Every layer, every data
> source, every analysis catalogue entry and every panel is a plugin.

If something can be a plugin, it does not belong in the core. The core never
depends on a plugin, and a lint rule enforces it.

## Status

This repository contains the MVP described in `earth-engine-clone-prompt.md`:

| Area | State |
| --- | --- |
| Monorepo, strict TypeScript, CI | implemented |
| Map view (pan/zoom/rotate/pitch, globe projection) | implemented |
| Coordinate service (WGS84, Web Mercator, proj4, geometry helpers) | implemented |
| Layer registry (order, visibility, opacity, descriptor contract, attribution) | implemented |
| Time dimension (global slider, per-layer resolution) | implemented |
| Plugin API, manifest validation, lifecycle, error isolation | implemented |
| UI slots, design system, light/dark themes, style guide | implemented |
| Declarative analysis graphs in a web worker | implemented |
| Serializable state in the URL | implemented |
| Three reference plugins | implemented |
| Documentation, ADRs, plugin guide, API reference | implemented |
| Trust level B (sandboxed untrusted plugins) | designed, not implemented (see ADR 0005) |
| Backend (optional Fastify proxy) | not part of the MVP |
| Script/code editor | not part of the MVP; architecture prepared (ADR 0006) |

Known limitations and deliberate deviations are listed in
[`docs/architecture.md`](docs/architecture.md#limitations).

## Quick start

Requirements: Node.js ≥ 22 and pnpm 10 (Corepack works).

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

The development server starts with the three reference plugins:

1. **OpenStreetMap base map** — raster tiles, attribution and tile policy panel.
2. **Elevation (Terrarium DEM)** — hillshade plus an elevation pixel inspector.
3. **MODIS time series** — NASA GIBS imagery driven by the time slider, plus a
   temperature series fetched from Open-Meteo and aggregated by an analysis
   graph in a worker.

Start the bare core — no plugin, no data — with
`http://localhost:3000/?plugins=none`. That is the state the empty-map test
asserts.

```bash
pnpm typecheck      # strict TypeScript across all packages
pnpm test           # Vitest unit tests (core)
pnpm lint:deps      # the core must not import a plugin
pnpm build          # production build of the web app
pnpm docs:api       # regenerate docs/reference/plugin-api.md from the types
pnpm test:e2e       # Playwright (requires `pnpm exec playwright install chromium`)
pnpm check          # lint + typecheck + tests + build + bundle budget
```

## Repository layout

```
apps/web                     Core UI shell: layout, panels, worker entry, plugin composition
packages/plugin-api          The public contract — types only, no runtime, no dependencies
packages/core                Runtime: events, coordinates, layers, time, map adapter,
                             plugin loader, UI slots, inspector, analysis, state
packages/ui-kit              Design tokens, light/dark themes, icons, React components,
                             colormaps, slot host, chart
plugins/basemap-osm          Reference plugin: OpenStreetMap base map
plugins/dem-demo             Reference plugin: Terrarium hillshade + inspector
plugins/timeseries-demo      Reference plugin: GIBS time layer + Open-Meteo series
docs/                        Architecture, ADRs, plugin guide, plugin policy, generated API
```

`apps/web` is a small deviation from the package list in the specification: the
runtime is a library (`packages/core`), the deployable single-page application
lives next to it. See [ADR 0001](docs/adr/0001-monorepo-layout.md).

## How a plugin works

```ts
import type { PluginDefinition } from "@terrascope/plugin-api";
import manifest from "../plugin.json";

export default {
  manifest,
  activate(api) {
    api.layers.add({
      id: "osm",
      kind: "raster",
      name: "OpenStreetMap",
      unit: "1",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      source: {
        name: "OpenStreetMap",
        url: "https://www.openstreetmap.org",
        license: "ODbL 1.0",
        attribution: "© OpenStreetMap contributors",
      },
    });

    api.inspector.register({ id: "osm-pixel", title: "Pixel", async inspect(coordinate) { /* … */ } });

    api.ui.registerSlot({
      id: "about",
      slot: "sidebar",
      title: "About",
      mount(container, context) {
        const heading = document.createElement("h3");
        heading.textContent = context.t("org.example.about");
        container.append(heading);
        return () => heading.remove();
      },
    });
  },
} satisfies PluginDefinition;
```

Plugin UI is plain DOM (`mount(container, context) => unmount`), so plugin
authors are not tied to React. The `ui-kit` ships a `mountReact` helper for
those who prefer React.

Read [docs/plugin-guide.md](docs/plugin-guide.md) for the 15-minute tutorial.

## Data sources and attribution

All reference data is free and attributed in the UI:

| Source | Used for | License / terms |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org) tiles | base map | ODbL 1.0; public tile service is for development and low traffic |
| [AWS Terrain Tiles / Mapzen Terrarium](https://registry.opendata.aws/terrain-tiles/) | hillshade, elevation | CC-BY 4.0 and public-domain sources |
| [NASA GIBS](https://www.earthdata.nasa.gov/gibs) MODIS Terra | time-aware imagery | NASA EOSDIS, public domain |
| [Open-Meteo](https://open-meteo.com) ERA5 archive | temperature series | CC-BY 4.0, ERA5 © ECMWF |

CORS behaviour was verified for all four services before they were wired in
(see [ADR 0009](docs/adr/0009-reference-data-sources.md)).

## Documentation

- [Architecture overview](docs/architecture.md) (prose + Mermaid)
- [Your first plugin in 15 minutes](docs/plugin-guide.md)
- [Plugin policy](docs/plugin-guidelines.md)
- [Generated plugin API reference](docs/reference/plugin-api.md)
- [Architecture decision records](docs/adr/)
- [Contributing](CONTRIBUTING.md)

## License

Apache-2.0. See [LICENSE](LICENSE) and [ADR 0002](docs/adr/0002-license.md).
Plugin authors keep the copyright of their plugins; the manifest requires a
license identifier and the core displays it.

# Your first plugin in 15 minutes

This walkthrough builds a plugin that adds a coloured GeoJSON layer, a pixel
inspector and a sidebar panel. It uses only the public plugin API — no core
changes.

## 1. Create the package

```bash
mkdir -p plugins/hello-world/src
```

`plugins/hello-world/package.json`:

```json
{
  "name": "@terrascope/plugin-hello-world",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": { "@terrascope/plugin-api": "workspace:*" }
}
```

Add the directory to the workspace automatically (the glob `plugins/*` already
covers it) and run `pnpm install`.

## 2. Write the manifest

`plugins/hello-world/plugin.json`:

```json
{
  "id": "org.example.hello-world",
  "name": "Hello world",
  "version": "0.1.0",
  "author": "Your name",
  "license": "Apache-2.0",
  "coreApi": "^0.1.0",
  "description": "A tiny example plugin.",
  "capabilities": ["layers", "ui"],
  "icon": "globe",
  "entry": "src/index.ts"
}
```

The id must be reverse-DNS. The core API uses Semantic Versioning; this plugin
declares that it works with any `0.1.x` core. `capabilities` is required:
`layers`, `tools`, `ui`, `analysis`, `network`. If you declare `network`, you
must also list the exact hostnames in `network`.

## 3. Implement the plugin

`plugins/hello-world/src/index.ts`:

```ts
import type { PluginDefinition, PluginManifest } from "@terrascope/plugin-api";
import manifest from "../plugin.json";

const definition: PluginDefinition = {
  manifest: manifest as unknown as PluginManifest,

  activate(api) {
    api.layers.add({
      id: "cities",
      kind: "vector",
      name: "Example cities",
      unit: "1",
      zIndex: 20,
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [13.405, 52.52] },
            properties: { name: "Berlin" },
          },
        ],
      },
      style: { color: "#9c620f", pointRadius: 6 },
      source: {
        name: "Example data",
        url: "https://example.org",
        license: "CC0-1.0",
        attribution: "Example data",
      },
    });

    api.inspector.register({
      id: "cities",
      title: "City",
      supports: (coordinate) =>
        Math.abs(coordinate.lon - 13.405) < 0.1 && Math.abs(coordinate.lat - 52.52) < 0.1,
      async inspect() {
        return {
          id: "cities",
          title: "City",
          rows: [{ label: "Name", value: "Berlin" }],
        };
      },
    });

    api.ui.registerSlot({
      id: "hello",
      slot: "sidebar",
      title: "Hello world",
      icon: "globe",
      mount(container, context) {
        const panel = document.createElement("section");
        panel.style.padding = "var(--ts-space-4)";

        const heading = document.createElement("h3");
        heading.textContent = "Hello world";
        heading.style.fontSize = "var(--ts-text-sm)";

        const text = document.createElement("p");
        text.textContent = `Theme: ${context.theme}`;
        text.style.fontSize = "var(--ts-text-xs)";
        text.style.color = "var(--ts-text-muted)";

        panel.append(heading, text);
        container.append(panel);

        return () => panel.remove();
      },
    });
  },
};

export default definition;
```

Three things to notice:

1. `activate` receives the API; everything registered there is disposed
   automatically when the plugin is deactivated.
2. The layer descriptor requires unit, source, license and attribution. The
   core renders the attribution — you cannot forget it.
3. Slot UI is plain DOM. `mount` returns an unmount function. If you prefer
   React, the UI kit exports `mountReact(node, container)`.

## 4. Register the plugin

For the bundled build, add it to `apps/web/src/plugins.ts`:

```ts
import helloWorld from "@terrascope/plugin-hello-world";
export const plugins = [basemapOsm, demDemo, timeseriesDemo, helloWorld];
```

Then reload the app. The plugin appears in the plugin manager with its
capabilities and version; its layer is in the layer list, and its panel is at the
bottom of the sidebar.

For a local plugin served over HTTP, use **Plugins → Load plugin from URL** and
enter the URL of the `plugin.json`. The plugin runs at trust level A (trusted),
so only load plugins you trust.

## 5. Use the events and the time dimension

```ts
api.events.on("time:changed", (state) => {
  api.logger.info(`time is now ${state.instant}`);
});

api.events.on("selection:changed", ({ geometry }) => {
  if (geometry?.type === "Polygon") {
    const ring = geometry.coordinates[0]?.map(([lon, lat]) => ({ lon, lat })) ?? [];
    api.logger.info(`area: ${api.coordinates.area(ring)} m²`);
  }
});

api.layers.add({
  id: "daily",
  kind: "raster",
  name: "Daily imagery",
  unit: "reflectance",
  timeTemplate: true,
  temporal: {
    resolution: { unit: "day", step: 1 },
    start: "2024-01-01T00:00:00.000Z",
    end: "2024-12-31T00:00:00.000Z",
    availability: "discrete",
  },
  tiles: ["https://example.org/tiles/{time}/{z}/{x}/{y}.png"],
  source: {
    name: "Example",
    url: "https://example.org",
    license: "CC-BY-4.0",
    attribution: "© Example",
  },
});
```

`{time}` is replaced with the layer's resolution (day, month, year or hour) from
the global time state.

## 6. Contribute an analysis operation

Operations must stay serializable, so a plugin registers an alias of a
worker-safe core primitive, optionally with preset parameters:

```ts
api.analysis.registerOperation({
  id: "org.example.hello-world.mean",
  title: "Mean of a series",
  implements: { op: "value.mean" },
});
```

Then compose a graph and run it — the core executes it off the UI thread:

```ts
const run = await api.analysis.run({
  schemaVersion: 1,
  nodes: [
    { id: "table", op: "table.fromSeries", inputs: { times, values }, params: { unit: "°C" } },
    { id: "mean", op: "org.example.hello-world.mean", inputs: { values } },
  ],
  outputs: ["mean", "table"],
});
api.logger.info(JSON.stringify(run.results));
```

Available primitives: `value.mean`, `value.min`, `value.max`, `value.sum`,
`math.add`, `math.subtract`, `math.multiply`, `math.divide`,
`table.fromSeries`, `chart.fromTable`. See
[the analysis ADR](adr/0006-analysis-graphs.md) for the extension plan.

## 7. Debugging

- A thrown error during activation marks the plugin as `error`, shows a toast and
  disposes its partial registrations. The app keeps running.
- Use `api.logger` (prefixed with your plugin id) rather than `console`.
- Check the **Plugins** tab for the manifest validation error; it is rendered
  verbatim.
- `api.storage` and `api.settings` are persisted in `localStorage`, namespaced
  by plugin id, and settings are included in shared links.

import type { PluginDefinition, PluginManifest } from "@terrascope/plugin-api";
import manifestJson from "../plugin.json";

const manifest = manifestJson as unknown as PluginManifest;

const TILES = ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"];

/**
 * Base maps are plugins. This one adds OpenStreetMap raster tiles and makes its
 * attribution and tile usage policy visible in the UI.
 */
const definition: PluginDefinition = {
  manifest,

  activate(api) {
    api.i18n.register({
      en: {
        "org.terrascope.basemap-osm.section": "Base map",
        "org.terrascope.basemap-osm.description":
          "Raster tiles from OpenStreetMap. The base map sits below every data layer.",
        "org.terrascope.basemap-osm.policy":
          "The public OSM tile service is intended for development and low traffic. For production, operate your own tile server or use a commercial provider.",
        "org.terrascope.basemap-osm.openPolicy": "Tile usage policy",
        "org.terrascope.basemap-osm.license": "Data © OpenStreetMap contributors, ODbL 1.0",
      },
      de: {
        "org.terrascope.basemap-osm.section": "Basiskarte",
        "org.terrascope.basemap-osm.description":
          "Rasterkacheln von OpenStreetMap. Die Basiskarte liegt unter allen Datenlayern.",
        "org.terrascope.basemap-osm.policy":
          "Der öffentliche OSM-Kacheldienst ist für Entwicklung und geringe Last gedacht. Für den Produktivbetrieb eigenen Kachelserver oder kommerziellen Anbieter nutzen.",
        "org.terrascope.basemap-osm.openPolicy": "Nutzungsbedingungen",
        "org.terrascope.basemap-osm.license": "Daten © OpenStreetMap-Mitwirkende, ODbL 1.0",
      },
    });

    api.layers.add({
      id: "osm-standard",
      kind: "raster",
      name: "OpenStreetMap Standard",
      description: "General purpose raster base map with place labels.",
      unit: "1",
      zIndex: -100,
      tileSize: 256,
      maxZoom: 19,
      opacity: 1,
      tiles: TILES,
      source: {
        name: "OpenStreetMap",
        url: "https://www.openstreetmap.org",
        license: "ODbL 1.0",
        licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
        attribution: "© OpenStreetMap contributors",
      },
      legend: {
        type: "categorical",
        items: [{ value: "raster", label: "Raster base map" }],
      },
    });

    api.ui.registerSlot({
      id: "basemap-about",
      slot: "sidebar",
      title: api.i18n.t("org.terrascope.basemap-osm.section"),
      icon: "map",
      order: 20,
      mount(container, context) {
        const section = document.createElement("section");
        section.className = "ts-plugin-panel";
        section.style.padding = "var(--ts-space-4)";
        section.style.borderTop = "1px solid var(--ts-border-soft)";

        const heading = document.createElement("h3");
        heading.textContent = context.t("org.terrascope.basemap-osm.section", "Base map");
        heading.style.margin = "0 0 var(--ts-space-2)";
        heading.style.fontSize = "var(--ts-text-xs)";
        heading.style.textTransform = "uppercase";
        heading.style.letterSpacing = "0.05em";
        heading.style.color = "var(--ts-text-faint)";

        const description = document.createElement("p");
        description.textContent = context.t(
          "org.terrascope.basemap-osm.description",
          "Raster tiles from OpenStreetMap.",
        );
        description.style.margin = "0 0 var(--ts-space-2)";
        description.style.fontSize = "var(--ts-text-xs)";
        description.style.color = "var(--ts-text-muted)";

        const policy = document.createElement("p");
        policy.textContent = context.t("org.terrascope.basemap-osm.policy", "Tile usage policy applies.");
        policy.style.margin = "0 0 var(--ts-space-3)";
        policy.style.fontSize = "var(--ts-text-xs)";
        policy.style.color = "var(--ts-text-faint)";

        const link = document.createElement("button");
        link.type = "button";
        link.className = "ts-btn";
        link.dataset["variant"] = "ghost";
        link.dataset["size"] = "sm";
        link.textContent = context.t("org.terrascope.basemap-osm.openPolicy", "Tile usage policy");
        link.style.fontSize = "var(--ts-text-xs)";
        link.addEventListener("click", () => {
          context.openExternal("https://operations.osmfoundation.org/policies/tiles/");
        });

        const license = document.createElement("p");
        license.textContent = context.t(
          "org.terrascope.basemap-osm.license",
          "Data © OpenStreetMap contributors, ODbL 1.0",
        );
        license.style.margin = "var(--ts-space-3) 0 0";
        license.style.fontSize = "var(--ts-text-2xs)";
        license.style.color = "var(--ts-text-faint)";

        section.append(heading, description, policy, link, license);
        container.append(section);
      },
    });
  },
};

export default definition;

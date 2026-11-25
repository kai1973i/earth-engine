import basemapOsm from "@terrascope/plugin-basemap-osm";
import demDemo from "@terrascope/plugin-dem-demo";
import timeseriesDemo from "@terrascope/plugin-timeseries-demo";
import type { PluginDefinition } from "@terrascope/plugin-api";

/**
 * Statically bundled reference plugins. A deployment can add or remove entries
 * here without touching the core; local plugins are loaded at runtime through
 * the plugin manager.
 */
export const plugins: PluginDefinition[] = [basemapOsm, demDemo, timeseriesDemo];

# 0003 — MapLibre GL JS behind a thin MapAdapter

- Status: accepted
- Date: 2026-11-25

## Context

The specification prescribes MapLibre GL JS and a `MapAdapter` that keeps a
later renderer swap possible, while explicitly forbidding a large
multi-renderer abstraction. Globe projection was required if stable.

## Decision

Use **MapLibre GL JS 6.19.0** (BSD-3-Clause) with the globe projection
(`map.setProjection({ type: "globe" })`, stable since v5.0, January 2025).
Wrap it in a small `MapAdapter` interface with exactly the operations the core
needs: init, view, fit bounds, project/unproject, declarative layer sync,
overlays, theme, resize, events, destroy.

The adapter owns MapLibre types; nothing above it does. The layer model is
renderer-neutral (raster tiles, hillshade/DEM, GeoJSON) and the adapter maps it
to MapLibre sources and layers. A Cesium adapter could later implement the same
interface for 3D terrain.

## Alternatives

- **Mapbox GL JS.** Proprietary license and token requirement; contradictorily
  the project forbids proprietary services and API keys in the core.
- **OpenLayers.** Strong 2D/GIS feature set, but no globe view with the same
  maturity, and the specification names MapLibre.
- **CesiumJS.** 3D-first and heavy; explicitly out of MVP scope.
- **No adapter, direct MapLibre calls everywhere.** Fastest initially, but it
  would spread renderer types through the runtime and the plugin API.

## Consequences

- The adapter is the only file that changes when MapLibre upgrades.
- Blend modes cannot be mapped to MapLibre paint properties; see ADR 0010.
- A 3D renderer remains possible without touching plugins.

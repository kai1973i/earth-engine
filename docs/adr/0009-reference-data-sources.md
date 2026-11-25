# 0009 — Reference data sources

- Status: accepted
- Date: 2026-11-25

## Context

The three reference plugins must use free data without API keys. Before wiring
them in, availability, CORS behaviour, terms and attribution were checked.

## Decision

| Plugin | Service | Verified | Attribution / terms |
| --- | --- | --- | --- |
| Base map | `tile.openstreetmap.org` raster tiles | HTTP 200, `Access-Control-Allow-Origin: *` | © OpenStreetMap contributors, ODbL 1.0; public tile service for dev/low traffic only, link to the tile usage policy in the UI |
| Elevation | `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | HTTP 200, `ACAO: *` | Mapzen/AWS Terrain Tiles, CC-BY 4.0 and public-domain sources |
| Time layer | NASA GIBS WMTS `MODIS_Terra_CorrectedReflectance_TrueColor`, EPSG:3857 `GoogleMapsCompatible_Level9` | HTTP 200, `ACAO: *` | NASA EOSDIS, public domain; GIBS is designed for public web use |
| Time series | `archive-api.open-meteo.com/v1/archive` | HTTP 200, `ACAO: *` | Open-Meteo CC-BY 4.0, ERA5 © ECMWF |

The DEM plugin decodes Terrarium PNGs itself with `createImageBitmap` and a 2D
canvas, so no raster codec enters the core. The time series plugin registers a
provider and turns the result into a declarative analysis graph; the worker
computes min/mean/max and the chart.

## Alternatives

- **MapTiler / Mapbox base maps.** Require keys and proprietary terms; excluded
  by the specification.
- **NASA GIBS alternative (Sentinel Hub, Planetary Computer).** Either requires
  accounts for the full resolution or is heavier to integrate. GIBS remains the
  simplest keyless option for a time-aware layer.
- **Open-Meteo forecast instead of archive.** The archive matches the historical
  time slider; forecast data would not.
- **Bundling a DEM codec library.** Extra dependency for one formula; the
  Terrarium encoding is two lines of arithmetic.

## Consequences

- Reference plugins demonstrate the API without secrets.
- Public OSM tiles are not a production service; the plugin says so in its panel
  and the README points to self-hosting.
- Providers can be replaced by other plugins without core changes.

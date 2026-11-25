# 0010 — Layer model is renderer-neutral; blend modes are stored but not applied

- Status: accepted
- Date: 2026-11-25

## Context

The layer system requires name, type, unit, value range, NoData, scale/offset,
temporal resolution, source, license and attribution — plus order, visibility,
opacity and blend modes. MapLibre GL JS has no per-layer blend mode paint
property.

## Decision

Keep the full descriptor in the core, including `blendMode`, because it is part
of the portable layer model, state and future renderers. The MapLibre adapter
maps what it can (`raster-opacity`, layout visibility, hillshade colors with
alpha) and deliberately ignores `blendMode`. This is documented in the adapter,
in the architecture limitations and here, instead of removing the field or
faking blending with custom WebGL layers.

Hillshade has no opacity paint property either. The adapter encodes opacity in
the alpha channel of the shadow/highlight/accent colors, which behaves as a
layer-level fade over the background.

## Alternatives

- **Custom WebGL layer for blend modes.** Significant renderer work for an MVP,
  and it would bypass MapLibre styling and hit-testing.
- **Remove blend modes from the model.** Breaks the specified contract and the
  serializable state.
- **Emulate with `globalCompositeOperation` on a canvas overlay.** Rewrites the
  renderer and loses vector fidelity.

## Consequences

- The layer panel does not expose blend modes yet; the model and state support
  them so a future renderer can.
- Opacity works for raster, vector and hillshade layers.
- When a renderer with blend support is added, only the adapter changes.

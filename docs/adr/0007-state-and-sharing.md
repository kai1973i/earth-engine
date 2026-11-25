# 0007 — Shareable state in the URL

- Status: accepted
- Date: 2026-11-25

## Context

Views must be reproducible and shareable: map position, layers, time, theme,
locale, plugin settings and **plugin ids and versions**. The app is static, so
there is no server to store a view.

## Decision

Serialize `AppState` as JSON, compress it with base64url and store it in the
`state` query parameter. The runtime updates the URL with
`history.replaceState` (debounced 300 ms); no history entries are created. A
share button copies the link.

Stored fields:

- `view` (center, zoom, bearing, pitch, projection)
- `time` (instant, range, resolution)
- `theme`, `locale`
- `layers` (uid, visibility, opacity)
- `plugins` (id, version, enabled)
- `settings` (per plugin id)

Restoration happens after plugin installation and activation, so plugin layers
exist before their state is applied. Unknown layers are ignored; the state
version gates incompatible formats.

## Alternatives

- **localStorage only.** Not shareable, not reproducible.
- **Backend short links.** Requires infrastructure and privacy decisions the MVP
  does not need.
- **Compress with a library (e.g. lz-string).** Extra dependency; state is small
  (a few KB) and the URL limit is not reached for normal views. Can be added
  later behind the same encoder.

## Consequences

- Long URLs for many layers/plugins; acceptable for the MVP.
- Plugin settings are visible in the link. Plugins must not store secrets in
  settings.
- The state version must be bumped for breaking changes, with a migration path.

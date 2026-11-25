# Plugin guidelines

These rules exist so that a plugin installation cannot break the application,
hide attribution or surprise users.

## Required

1. **Manifest completeness.** `id`, `name`, `version`, `author`, `license`,
   `coreApi`, `capabilities`. The id is reverse-DNS and immutable.
2. **Honest capabilities.** Only declare what you use. `network` requires an
   explicit hostname allowlist; the core refuses to activate a plugin that
   declares network access without hosts.
3. **Data provenance.** Every layer descriptor needs `source.name`,
   `source.url`, `source.license` and `source.attribution`. The core renders
   them; layers without them are rejected.
4. **Units and ranges.** Provide `unit`, and `valueRange`, `noData`, `scale` and
   `offset` where they apply. Values are shown next to their unit.
5. **Cleanup.** Register through the API and return unmount functions from slot
   mounts. Do not add global listeners or timers you do not remove.
6. **No credentials.** No API keys, tokens or proprietary access in a
   repository plugin. Use free services or document a self-hosted proxy.
7. **No telemetry.** No analytics, no trackers, no third-party fonts at runtime.
8. **Tokens, not hard-coded colors.** Use the CSS custom properties for colors,
   spacing and type. Both themes must stay readable.
9. **Accessibility.** Every icon-only control needs an `aria-label`; keyboard
   focus must be visible; do not remove focus rings.
10. **Attribution is not optional.** If a data license requires a link, add it
    to `source.licenseUrl` and keep the attribution text short but complete.

## Strongly recommended

- Prefer declarative analysis graphs over custom computation; if you need a new
  primitive, propose it in the core with a serializable contract.
- Keep network requests cancellable (`AbortSignal` is passed to providers and
  inspectors).
- Cache tiles and series; respect provider rate limits and terms.
- Localize at least German and English; register keys namespaced with your
  plugin id (`org.example.my-plugin.title`).
- Declare plugin dependencies in the manifest instead of assuming activation
  order.
- Keep the first paint cheap; do not fetch data at module scope.

## Review checklist for a new plugin

- [ ] Manifest validates and the `coreApi` range is accurate.
- [ ] Layer descriptors have source, license and attribution.
- [ ] Deactivation removes every layer, slot, listener and provider.
- [ ] A thrown error leaves the core usable.
- [ ] Both themes pass a visual check and contrast is AA.
- [ ] Network hosts are listed and justified.
- [ ] No secrets, no telemetry, no proprietary services.
- [ ] README states the data sources and their licenses.

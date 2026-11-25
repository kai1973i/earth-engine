# 0008 — Static composition plus trusted local loading

- Status: accepted
- Date: 2026-11-25

## Context

The MVP must support loading plugins **statically** (shipped with the app) and
**locally** (from a URL the user provides). There is no registry or marketplace
yet.

## Decision

- **Static plugins** are workspace packages composed in
  `apps/web/src/plugins.ts`. The app imports their definitions and passes them
  to `CoreRuntime`; activation follows the saved state (all active by default).
- **Local plugins** are loaded at runtime: the user enters a `plugin.json` URL,
  the core fetches and validates the manifest, resolves `entry` relative to the
  manifest, dynamically imports the ESM module and expects a default export (or
  `plugin` / `definition`) that matches `PluginDefinition`. Installation goes
  through the same manifest validation and lifecycle as static plugins.
- Local plugins run at **trust level A** (see ADR 0005). The plugin manager
  states this before loading.
- The plugin manager shows id, version, core API range, capabilities, network
  hosts, dependencies and errors for every plugin.

Version compatibility uses a small built-in SemVer matcher (`^`, `~`, `>=`,
`<=`, `>`, `<`, `=`, `*`, `x`) so the loader has no runtime dependency.

## Alternatives

- **Import maps / module federation.** More flexible, but adds build complexity
  and a second loading model for the MVP.
- **Only static plugins.** Would not satisfy the local loading requirement or
  the plugin manager workflow.
- **Registry with signatures.** Planned for level B; requires a trust root,
  signing and a review process.

## Consequences

- Bundled plugins share the app bundle; code splitting per plugin is a follow-up
  (bundle budget in CI).
- Dynamically loaded plugins cannot contribute worker-executable operations
  until the worker module contract exists (ADR 0006).
- A plugin can be installed twice only if the version changes; the loader
  rejects silent replacement.

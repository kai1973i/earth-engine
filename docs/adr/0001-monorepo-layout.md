# 0001 — Monorepo layout with a separate deployable app

- Status: accepted
- Date: 2026-11-25

## Context

The specification asks for pnpm workspaces with `core`, `plugin-api`, `ui-kit`,
`plugins/*` and `docs`. It also requires the core to run as a static SPA. A
library package cannot own `index.html`, the Vite config and the plugin
composition without mixing runtime and deployment concerns.

## Decision

Use pnpm workspaces with:

- `packages/plugin-api` — types only, zero dependencies;
- `packages/core` — runtime, renderer adapter, plugin loader, analysis worker;
- `packages/ui-kit` — tokens and React components;
- `apps/web` — the deployable Vite app that composes core, UI and plugins;
- `plugins/*` — reference plugins;
- `docs/` — architecture, ADRs, guides.

The dependency rule is one-way: plugins → plugin-api, core → plugin-api, app →
everything. The core never imports a plugin (`pnpm lint:deps`).

## Alternatives

- **Put the Vite app inside `packages/core`.** Fewer packages, but the core could
  not be reused by a future desktop or server host without dragging app files
  along, and plugin composition would live in the runtime.
- **Nx/Turborepo.** More machinery than an eight-package workspace needs.
- **Single package with folders.** Impossible to enforce the no-plugin-dependency
  rule with the package manager or a lint boundary.

## Consequences

- One extra package to document; the layout is trivial to understand.
- CI can typecheck and test each boundary independently.
- A second host (e.g. an embeddable viewer) can depend on `core` + `ui-kit`
  without the app shell.

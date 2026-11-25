# Contributing

Thanks for helping with TerraScope. The project is deliberately strict about a
few things; this page tells you how to work within them.

## Prerequisites

- Node.js ≥ 22, pnpm 10 (`corepack enable` is enough).
- No API keys are required for development. All reference data is free.

## Setup

```bash
pnpm install
pnpm dev
```

## Checks before a pull request

```bash
pnpm lint:deps    # core must not import a plugin
pnpm typecheck    # strict TypeScript in every package
pnpm test         # Vitest
pnpm build        # Vite production build
node scripts/check-bundle.mjs
```

`pnpm check` runs all of them.

## Architecture rules

1. **No data sources in the core.** Layers, providers, analyses, panels: all
   plugins. The core may grow infrastructure, never a source.
2. **The core never imports a plugin.** `lint:deps` enforces this.
3. **The plugin API is the product.** Treat changes to
   `packages/plugin-api` as public API: additive changes in a minor release,
   breaking changes only with a major version and a deprecation note.
4. **Every decision of consequence gets an ADR** in `docs/adr/`, numbered
   sequentially, with context, decision, alternatives and consequences.
5. **Attribution is part of the data model.** A layer without source, license
   and attribution must not be mergeable.
6. **No telemetry, no trackers, no proprietary services in the core.**

## Code style

- TypeScript strict mode; no `any` unless it is isolated and explained.
- Comments and identifiers in English; user-facing strings bilingual (German
  and English) through the i18n service.
- Small, topic-focused commits with meaningful messages.
- Prefer editing existing modules over adding new abstractions.
- UI work uses the design tokens in `packages/ui-kit/src/styles.css`; screenshots
  in both themes are expected for visual changes.

## Commit messages

```
feat(plugin-api): add chart result type

Why the change was needed, in one or two sentences.
```

Common scopes: `core`, `plugin-api`, `ui-kit`, `web`, `plugins`, `docs`, `ci`.

## Adding a plugin

Put it in `plugins/<name>`, keep its dependencies to `@terrascope/plugin-api`
(and optionally `@terrascope/ui-kit` for the React helper), add the manifest and
follow [the plugin guidelines](docs/plugin-guidelines.md). Demonstrate it by
adding it to `apps/web/src/plugins.ts` and the plugin manager tests.

## Reporting security issues

Do not open a public issue for a vulnerability. Contact the maintainers
privately. The trust model and known limitations are described in
[ADR 0005](docs/adr/0005-plugin-trust-model.md).

# 0002 — Apache-2.0

- Status: accepted
- Date: 2026-11-25

## Context

The specification asks to propose Apache-2.0 or MIT and to check dependency
licenses. Plugins may be contributed by third parties; the core is an
infrastructure project that large organisations may embed.

## Decision

License the project under **Apache-2.0**. Dependency licenses were checked:

| Dependency | License |
| --- | --- |
| MapLibre GL JS | BSD-3-Clause |
| React / React DOM | MIT |
| proj4 | MIT |
| Lucide icons | ISC |
| Vite, Vitest, TypeScript, ESLint | MIT / Apache-2.0 |

All are compatible with Apache-2.0 distribution.

## Alternatives

- **MIT.** Simpler, but lacks an explicit patent grant and a trademark clause.
  For a geospatial infrastructure project those are useful.
- **AGPL.** Stronger copyleft, but would deter embedding in commercial products
  and plugin ecosystems.

## Consequences

- Contributors grant a patent license; the NOTICE file convention applies.
- Plugins may use any compatible license; the manifest requires a license id and
  the core displays it.

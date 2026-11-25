# 0011 — One-pass MVP delivery and working title "TerraScope"

- Status: accepted; open point for the product owner
- Date: 2026-11-25

## Context

The specification asks for five gated phases, stopping after each phase for
approval, and to agree on the project name before phase 1. The implementation
request asked to build the project as described in one go and to record the plan
in GitHub.

## Decision

- Deliver the MVP (phases 1–5) in one pass, because the user explicitly asked
  for the implementation, not for a phase-1 architecture only. The phase plan is
  recorded as GitHub issues with their definition of done; items that are
  deliberately out of scope stay open as follow-ups.
- Use **TerraScope** as the working title. Package scope is `@terrascope/*`;
  renaming is mechanical because the id appears only in package names, imports
  and documentation.
- Record assumptions here instead of stopping the delivery:
  - name: TerraScope (working title);
  - interface language: German and English, detected from the browser, stored in
    the state;
  - default view: Europe/world at zoom 2.2 with globe projection;
  - reference data: OpenStreetMap, AWS Terrarium, NASA GIBS, Open-Meteo (all
    keyless, ADR 0009);
  - no backend, no auth, no telemetry, no marketplace in the MVP;
  - trust level B designed but not implemented.

## Alternatives

- **Stop after phase 1 and wait.** Would honour the phased rule but contradict
  the explicit request to implement and to create the plan in GitHub.
- **Ask for a name first.** The name is a reversible label; asking would have
  blocked the whole delivery. It is flagged for confirmation.

## Consequences

- The project owner should confirm or change the name; a rename touches package
  names, imports, README, ADRs and the GitHub repository name.
- Follow-ups (sandboxed plugins, plugin op modules, code splitting, E2E browser
  runs, optional backend, script editor) are tracked as issues rather than
  silently omitted.

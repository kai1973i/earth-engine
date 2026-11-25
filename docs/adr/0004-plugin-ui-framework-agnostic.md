# 0004 — Framework-agnostic plugin UI

- Status: accepted
- Date: 2026-11-25

## Context

The core UI is React. The specification requires plugin UI **not** to be bound
to React: a slot entry returns `mount(container, context) => unmount`.

## Decision

Slots carry plain DOM mount functions. The core renders a `<SlotHost>` that
creates a container `div` and calls `mount`, then the returned cleanup on
unmount. `SlotContext` provides theme, locale, translation and a checked
`openExternal`.

React is only an implementation detail of the core UI. For plugin authors who
prefer React, `ui-kit` exports `mountReact(node, container)`, which creates a
root, renders and returns an unmount function. No other React helper is exposed,
so plugins are not pushed toward a framework.

## Alternatives

- **React components in the slot contract.** Simple for the core, but it forces
  every plugin to ship React and couples plugin authors to a framework version.
- **Web Components only.** Framework-neutral, but heavier for simple panels and
  requires a shadow-DOM styling strategy across themes.
- **Iframe-per-panel.** Good isolation (see ADR 0005 level B), but expensive for
  every small UI contribution and awkward for map overlays.

## Consequences

- Plugins use design tokens, not UI-kit React components. The tokens are stable
  CSS custom properties; the style guide documents them.
- The core can adopt another UI framework without breaking plugins.
- Slot UI must clean up its own listeners; the host removes the container and
  calls the cleanup function.

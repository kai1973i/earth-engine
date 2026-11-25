# 0005 — Two plugin trust levels

- Status: accepted (level A implemented, level B designed)
- Date: 2026-11-25

## Context

Plugins execute code and can reach the network. The specification requires two
trust levels: trusted plugins with full API access, and untrusted plugins that
must not be able to compromise the app or the user's data.

Threats: reading or exfiltrating data from other origins, reading the DOM or
local storage, spamming network requests, blocking the UI thread, injecting
markup that breaks the shell, or silently persisting data.

## Decision

**Level A — trusted.** Bundled or locally installed plugins run in the page.
The manifest declares capabilities and, for network access, an exact hostname
allowlist. The loader validates the manifest, verifies the `coreApi` SemVer
range, refuses network capability without hosts, and shows capabilities in the
plugin manager. All registrations are scoped and disposed on deactivation;
exceptions are caught and the plugin is marked `error`.

**Level B — untrusted (planned).** Run the plugin in a sandboxed iframe with
`sandbox="allow-scripts"` (no same-origin), a strict CSP, and a postMessage RPC
bridge that exposes a capability-filtered subset of the API. Network requests
go through the core with hostname allowlisting and quotas. UI contributions are
rendered inside the iframe (or via a declarative description), never as raw DOM
in the host. No access to `localStorage`; storage is proxied and namespaced.

**Spike plan for level B**

1. Iframe shell + origin isolation + CSP; prove no host DOM/storage access.
2. Typed RPC with request ids, timeouts and structured-clone payloads.
3. Capability enforcement on layers, inspector and analysis operations.
4. Network proxy with allowlist, method/body limits and cancellation.
5. Sandboxed UI slot (iframe panel) and overlay policy.
6. Escape/error isolation tests and a malicious-plugin fixture suite.
7. Performance measurement of cross-frame updates (hover, time changes).

## Alternatives

- **Trust everything.** Unacceptable for a plugin marketplace.
- **Run every plugin in a worker.** No DOM for UI and no synchronous map access;
  would force a second UI model for all plugins.
- **Server-side execution.** Not compatible with a static SPA and offline use.

## Consequences

- Level A plugins are powerful; the UI states that only trusted plugins should
  be installed. This is documented in the plugin manager.
- Level B requires a bridge design and a declarative UI path before a marketplace
  is possible; the MVP only documents and plans it.

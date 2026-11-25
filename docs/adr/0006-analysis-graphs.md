# 0006 — Declarative analysis graphs executed in a worker

- Status: accepted
- Date: 2026-11-25

## Context

The specification requires analyses to be **declarative and serializable** so
the same computation can run in a browser worker now and on a server later, be
reproduced, and never block the UI thread. It also asks to prepare for a future
script/code editor.

## Decision

An analysis is a JSON graph:

```json
{
  "schemaVersion": 1,
  "nodes": [
    { "id": "t", "op": "table.fromSeries", "inputs": { "times": [], "values": [] } },
    { "id": "m", "op": "value.mean", "inputs": { "values": [] } }
  ],
  "outputs": ["m", "t"]
}
```

- Nodes reference operations by id; inputs are JSON literals or
  `{ "$node": "id" }`. No functions cross the boundary.
- Operations are pure, synchronous and dependency-free; the core ships a small
  catalogue (`value.*`, `math.*`, `table.fromSeries`, `chart.fromTable`).
- The service validates the graph (known ops, unique ids, acyclic order,
  existing outputs) and posts it to a dedicated worker.
- Results are one of `table`, `chart`, `value`; each is plain JSON.
- Plugins contribute operations as **serializable aliases** of worker-safe
  primitives with preset params, so the worker never needs plugin code.
- A server executor only has to implement the same op catalogue; the graph and
  results do not change.

## Alternatives

- **Direct function calls.** Not serializable, not reproducible, and encourages
  blocking computation in the UI thread.
- **Execute plugin functions by serializing source.** Reintroduces code
  execution without a security model; rejected.
- **Server-only analyses.** Contradicts the static SPA requirement.
- **Arbitrary plugin code in the worker.** Needs a worker module contract and a
  bundling story; deferred.

## Consequences

- Plugin analyses are limited to the core op catalogue for now. A plugin needing
  a new primitive must propose it to the core (with a worker-safe contract) —
  this keeps reproducibility.
- Adding an operation is additive and versioned with the plugin API.
- The same graph can be stored in the app state or sent to a future backend.
- The script/code editor, when it comes, must compile to this graph or execute
  in a worker with the same result types; it must not get privileged access.

import type { AnalysisGraph, AnalysisNode, AnalysisResult, JsonObject, JsonValue } from "@terrascope/plugin-api";
import { coreOperationIds, coreOperations, type WorkerOperation } from "./ops.js";

export interface GraphExecution {
  results: Record<string, AnalysisResult>;
  durationMs: number;
}

function isNodeRef(value: JsonValue): value is { $node: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, JsonValue>)["$node"] === "string"
  );
}

export function validateGraph(graph: AnalysisGraph, available: ReadonlySet<string> = coreOperationIds): string[] {
  const errors: string[] = [];
  if (graph.schemaVersion !== 1) errors.push("Unsupported analysis graph schema version.");
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    errors.push("The analysis graph has no nodes.");
  }
  const seen = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.id) {
      errors.push("A node is missing an id.");
      continue;
    }
    if (seen.has(node.id)) errors.push(`Duplicate node id "${node.id}".`);
    if (!available.has(node.op)) errors.push(`Unknown operation "${node.op}" in node "${node.id}".`);
    for (const value of Object.values(node.inputs ?? {})) {
      if (!isNodeRef(value)) continue;
      if (!seen.has(value.$node)) {
        errors.push(`Node "${node.id}" references "${value.$node}", which is not an earlier node.`);
      }
    }
    seen.add(node.id);
  }
  if (!Array.isArray(graph.outputs) || graph.outputs.length === 0) {
    errors.push("The analysis graph has no outputs.");
  }
  for (const output of graph.outputs ?? []) {
    if (!seen.has(output)) errors.push(`Output "${output}" does not exist in the graph.`);
  }
  return errors;
}

function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (typeof value !== "object" || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === "table" || kind === "chart" || kind === "value";
}

function asResult(value: JsonValue | undefined, fallbackLabel?: string): AnalysisResult {
  if (isAnalysisResult(value)) return value;
  return {
    kind: "value",
    value: value ?? null,
    ...(fallbackLabel ? { label: fallbackLabel } : {}),
  };
}

/**
 * Executes a validated graph. Pure and synchronous so it can run unchanged in a
 * worker, in a node test, or on a server.
 */
export function executeGraph(
  graph: AnalysisGraph,
  operations: WorkerOperation[] = coreOperations,
): GraphExecution {
  const started = Date.now();
  const errors = validateGraph(graph, new Set(operations.map((operation) => operation.id)));
  if (errors.length > 0) throw new Error(errors.join(" "));

  const registry = new Map(operations.map((operation) => [operation.id, operation]));
  const values = new Map<string, JsonValue>();

  for (const node of graph.nodes) {
    const operation = registry.get(node.op);
    if (!operation) throw new Error(`Unknown operation "${node.op}".`);
    const inputs: JsonObject = {};
    for (const [key, raw] of Object.entries(node.inputs ?? {})) {
      if (isNodeRef(raw)) {
        const referenced = values.get(raw.$node);
        if (referenced === undefined) {
          throw new Error(`Node "${node.id}" references "${raw.$node}" before it was computed.`);
        }
        inputs[key] = referenced;
      } else {
        inputs[key] = raw;
      }
    }
    values.set(node.id, operation.run(inputs, node.params ?? {}));
  }

  const results: Record<string, AnalysisResult> = {};
  for (const output of graph.outputs) {
    results[output] = asResult(values.get(output), output);
  }

  return { results, durationMs: Date.now() - started };
}

export function nodeIds(graph: AnalysisGraph): string[] {
  return graph.nodes.map((node: AnalysisNode) => node.id);
}

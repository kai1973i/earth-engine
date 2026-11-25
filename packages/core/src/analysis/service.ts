import type {
  AnalysisApi,
  AnalysisGraph,
  AnalysisOperation,
  AnalysisRunResult,
  AnalysisValidation,
  AnalysisNode,
  JsonObject,
} from "@terrascope/plugin-api";
import { coreOperationIds, coreOperations } from "./ops.js";
import { validateGraph } from "./execute.js";
import type { AnalysisRequest, AnalysisResponse } from "./worker.js";

interface Pending {
  resolve: (value: AnalysisRunResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  started: number;
}

export interface AnalysisServiceOptions {
  workerFactory?: () => Worker;
  timeoutMs?: number;
}

/**
 * Executes declarative analysis graphs off the UI thread. Plugin operations are
 * serializable aliases of worker-safe core operations, so the same graph runs
 * locally today and on a server later.
 */
export class AnalysisService implements AnalysisApi {
  private operations = new Map<string, AnalysisOperation>();
  private worker: Worker | null = null;
  private pending = new Map<string, Pending>();
  private sequence = 0;
  private timeoutMs: number;

  constructor(private options: AnalysisServiceOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  registerOperation(operation: AnalysisOperation): () => void {
    if (!coreOperationIds.has(operation.implements.op)) {
      throw new Error(
        `Analysis operation "${operation.id}" implements unknown core operation "${operation.implements.op}".`,
      );
    }
    this.operations.set(operation.id, operation);
    return () => {
      if (this.operations.get(operation.id) === operation) this.operations.delete(operation.id);
    };
  }

  listOperations(): AnalysisOperation[] {
    const builtIns: AnalysisOperation[] = coreOperations.map((operation) => ({
      id: operation.id,
      title: operation.title,
      implements: { op: operation.id },
    }));
    return [...builtIns, ...this.operations.values()];
  }

  validate(graph: AnalysisGraph): AnalysisValidation {
    const resolved = this.resolveAliases(graph);
    const errors = validateGraph(resolved);
    return { valid: errors.length === 0, errors };
  }

  async run(graph: AnalysisGraph, options?: { signal?: AbortSignal }): Promise<AnalysisRunResult> {
    const resolved = this.resolveAliases(graph);
    const errors = validateGraph(resolved);
    if (errors.length > 0) throw new Error(`Invalid analysis graph: ${errors.join(" ")}`);
    if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const worker = this.ensureWorker();
    const id = `run-${++this.sequence}`;
    const started = Date.now();

    return new Promise<AnalysisRunResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.resetWorker();
        reject(new Error(`Analysis timed out after ${this.timeoutMs} ms.`));
      }, this.timeoutMs);

      const onAbort = (): void => {
        clearTimeout(timer);
        this.pending.delete(id);
        worker.terminate();
        this.worker = null;
        reject(new DOMException("Aborted", "AbortError"));
      };

      options?.signal?.addEventListener("abort", onAbort, { once: true });

      this.pending.set(id, {
        resolve: (result) => {
          options?.signal?.removeEventListener("abort", onAbort);
          resolve(result);
        },
        reject: (error) => {
          options?.signal?.removeEventListener("abort", onAbort);
          reject(error);
        },
        timer,
        started,
      });

      const request: AnalysisRequest = { id, graph: resolved };
      worker.postMessage(request);
    });
  }

  removeAll(pluginId: string): void {
    for (const [id, operation] of [...this.operations]) {
      if (id.startsWith(`${pluginId}.`)) this.operations.delete(id);
    }
  }

  dispose(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Analysis service disposed."));
      this.pending.delete(id);
    }
    this.worker?.terminate();
    this.worker = null;
  }

  private resolveAliases(graph: AnalysisGraph): AnalysisGraph {
    if (this.operations.size === 0) return graph;
    const nodes: AnalysisNode[] = graph.nodes.map((node) => {
      const alias = this.operations.get(node.op);
      if (!alias) return node;
      return {
        ...node,
        op: alias.implements.op,
        params: { ...(alias.implements.params ?? {}), ...(node.params ?? {}) } as JsonObject,
      };
    });
    return { ...graph, nodes };
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    if (!this.options.workerFactory) {
      throw new Error("No analysis worker is configured; analysis cannot run on the UI thread.");
    }
    const worker = this.options.workerFactory();
    worker.addEventListener("message", (event: MessageEvent<AnalysisResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(response.id);
      if (response.ok) {
        pending.resolve({
          results: response.results,
          durationMs: response.durationMs,
          executedOn: "worker",
        });
      } else {
        pending.reject(new Error(response.error));
      }
    });
    worker.addEventListener("error", (event) => {
      const message = event.message || "Analysis worker crashed.";
      for (const [id, pending] of [...this.pending]) {
        clearTimeout(pending.timer);
        pending.reject(new Error(message));
        this.pending.delete(id);
      }
      this.worker = null;
    });
    this.worker = worker;
    return worker;
  }

  private resetWorker(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}

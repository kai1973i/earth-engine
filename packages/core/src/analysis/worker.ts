import type { AnalysisGraph, AnalysisResult } from "@terrascope/plugin-api";
import { executeGraph } from "./execute.js";

export interface AnalysisRequest {
  id: string;
  graph: AnalysisGraph;
}

export type AnalysisResponse =
  | { id: string; ok: true; results: Record<string, AnalysisResult>; durationMs: number }
  | { id: string; ok: false; error: string };

/**
 * Worker entry shared by the application's worker module. The graph runtime is
 * dependency-free, so this stays a few lines.
 */
export function startAnalysisWorker(scope: DedicatedWorkerGlobalScope): void {
  scope.addEventListener("message", (event: MessageEvent<AnalysisRequest>) => {
    const { id, graph } = event.data;
    try {
      const { results, durationMs } = executeGraph(graph);
      const response: AnalysisResponse = { id, ok: true, results, durationMs };
      scope.postMessage(response);
    } catch (error) {
      const response: AnalysisResponse = {
        id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
      scope.postMessage(response);
    }
  });
}

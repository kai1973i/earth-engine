import { startAnalysisWorker } from "@terrascope/core/worker";

startAnalysisWorker(self as unknown as DedicatedWorkerGlobalScope);

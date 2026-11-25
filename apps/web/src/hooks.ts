import { useSyncExternalStore } from "react";
import type { CoreRuntime, CoreSnapshot } from "@terrascope/core";

export function useSnapshot(runtime: CoreRuntime): CoreSnapshot {
  return useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
}

export function translate(runtime: CoreRuntime, key: string, fallback?: string): string {
  return runtime.t(key, fallback);
}

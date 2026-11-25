import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { SlotContext, SlotEntry, SlotName } from "@terrascope/plugin-api";

export interface RegisteredSlotLike extends SlotEntry {
  pluginId: string;
}

function SlotMount({
  entry,
  context,
  className,
}: {
  entry: RegisteredSlotLike;
  context: SlotContext;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    let cleanup: (() => void) | undefined;
    try {
      const result = entry.mount(container, context);
      if (typeof result === "function") cleanup = result;
    } catch (error) {
      console.error(`[ui] slot "${entry.pluginId}.${entry.id}" failed to mount`, error);
      container.textContent = "Plugin UI failed to load.";
      container.classList.add("ts-empty");
    }
    return () => {
      try {
        cleanup?.();
      } catch (error) {
        console.error(`[ui] slot "${entry.pluginId}.${entry.id}" failed to unmount`, error);
      }
      container.replaceChildren();
    };
    // The context object is intentionally not a dependency: remounting plugin UI
    // on every theme change would discard plugin state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.pluginId, entry.id, entry.mount]);

  return <div ref={ref} className={["ts-slot", className].filter(Boolean).join(" ")} />;
}

export interface SlotHostProps {
  entries: RegisteredSlotLike[];
  slot: SlotName;
  context: SlotContext;
  className?: string;
}

/** Mounts every plugin contribution registered for a slot. */
export function SlotHost({ entries, slot, context, className }: SlotHostProps) {
  const matching = entries.filter((entry) => entry.slot === slot);
  if (matching.length === 0) return null;
  return (
    <>
      {matching.map((entry) => (
        <SlotMount key={`${entry.pluginId}.${entry.id}`} entry={entry} context={context} className={className} />
      ))}
    </>
  );
}

/** React helper for plugin authors who choose React; the core never requires it. */
export function mountReact(node: ReactNode, container: HTMLElement): () => void {
  const root = createRoot(container);
  root.render(node);
  return () => {
    root.unmount();
  };
}

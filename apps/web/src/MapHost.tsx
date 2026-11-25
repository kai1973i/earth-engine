import { useEffect, useRef } from "react";

/**
 * Hosts the imperative map container. The element is created before the runtime
 * so the adapter always has a sized container when it initialises.
 */
export function MapHost({ container }: { container: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.append(container);
    return () => {
      container.remove();
    };
  }, [container]);

  return <div ref={ref} className="map-host" />;
}

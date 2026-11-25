import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { CoreRuntime, type CoreSnapshot } from "@terrascope/core";
import type { DrawMode } from "@terrascope/core";
import type { SlotContext } from "@terrascope/plugin-api";
import { Button, Icon, IconButton, SlotHost } from "@terrascope/ui-kit";
import { plugins } from "./plugins.js";
import { useSnapshot } from "./hooks.js";
import { MapHost } from "./MapHost.js";
import {
  AttributionPanel,
  InspectorPanel,
  LayersPanel,
  LegendPanel,
  PluginManager,
  SettingsDialog,
} from "./panels.js";
import { StyleGuide } from "./StyleGuide.js";

const DAY_MS = 86_400_000;

function slotContext(runtime: CoreRuntime): SlotContext {
  const snapshot = runtime.getSnapshot();
  return {
    theme: snapshot.theme,
    locale: snapshot.locale,
    t: (key, fallback) => runtime.t(key, fallback),
    openExternal: (url) => window.open(url, "_blank", "noopener,noreferrer"),
  };
}

export function App() {
  const [container] = useState(() => {
    const element = document.createElement("div");
    element.className = "map-canvas";
    return element;
  });
  const [runtime, setRuntime] = useState<CoreRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // `?plugins=none` starts the bare core, which is what the empty-map test uses.
    const bundled = new URLSearchParams(window.location.search).get("plugins") === "none" ? [] : plugins;
    const instance = new CoreRuntime({
      container,
      plugins: bundled,
      workerFactory: () =>
        new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" }),
    });
    setRuntime(instance);
    void instance.init().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => {
      instance.destroy();
    };
  }, [container]);

  return (
    <div className="app">
      {runtime ? (
        <Workspace runtime={runtime} mapContainer={container} />
      ) : (
        <Splash mapContainer={container} />
      )}
      {error ? (
        <div className="boot-error" role="alert">
          <Icon name="alert" size={18} />
          {error}
        </div>
      ) : null}
    </div>
  );
}

function Splash({ mapContainer }: { mapContainer: HTMLElement }) {
  return (
    <>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="globe" size={18} />
          </span>
          <div className="brand-text">
            <span className="brand-name">TerraScope</span>
            <span className="brand-tagline">Open geodata workspace</span>
          </div>
        </div>
      </header>
      <div className="splash-body">
        <main className="map-area">
          <MapHost container={mapContainer} />
          <div className="map-empty">
            <div className="empty-card">
              <span className="ts-spinner" aria-hidden="true" />
              <p className="ts-small ts-muted">Starting the map…</p>
            </div>
          </div>
        </main>
      </div>
      <footer className="statusbar">
        <span className="ts-mono">—</span>
      </footer>
    </>
  );
}

function Workspace({
  runtime,
  mapContainer,
}: {
  runtime: CoreRuntime;
  mapContainer: HTMLElement;
}) {
  const snapshot = useSnapshot(runtime);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(true);
  const [tab, setTab] = useState<"layers" | "plugins">("layers");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [styleGuideOpen, setStyleGuideOpen] = useState(
    () => window.location.hash === "#style-guide",
  );

  const t = (key: string, fallback?: string): string => runtime.t(key, fallback);
  const context = slotContext(runtime);

  useEffect(() => {
    const onHash = (): void => setStyleGuideOpen(window.location.hash === "#style-guide");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.documentElement.lang = snapshot.locale;
  }, [snapshot.locale]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "select" || tag === "textarea" || target.isContentEditable) {
          return;
        }
      }
      const current = runtime.getSnapshot();
      if (event.key === "Escape") runtime.cancelDrawing();
      if (event.key === "Enter" && current.drawMode !== "none") runtime.finishDrawing();
      if (event.key === "v" && !event.metaKey && !event.ctrlKey) runtime.setDrawMode("none");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runtime]);

  const activePlugins = snapshot.plugins.filter((record) => record.status === "active").length;
  const visibleLayers = snapshot.layers.filter((layer) => layer.visible);
  const layoutStyle = {
    "--sidebar-width": sidebarOpen ? "304px" : "0px",
    "--detail-width": detailOpen ? "336px" : "0px",
  } as CSSProperties;

  const openStyleGuide = (): void => {
    window.location.hash = "#style-guide";
    setStyleGuideOpen(true);
  };

  const closeStyleGuide = (): void => {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setStyleGuideOpen(false);
  };

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="globe" size={18} />
          </span>
          <div className="brand-text">
            <span className="brand-name">{t("core.title", "TerraScope")}</span>
            <span className="brand-tagline">{t("core.tagline", "Open geodata workspace")}</span>
          </div>
        </div>
        <div className="header-actions">
          <IconButton
            icon={sidebarOpen ? "panel-close" : "panel-open"}
            label={sidebarOpen ? t("panel.collapse", "Collapse sidebar") : t("panel.expand", "Expand sidebar")}
            onClick={() => setSidebarOpen((value) => !value)}
          />
          <IconButton
            icon="share"
            label={t("share.copy", "Copy share link")}
            onClick={() => void runtime.copyShareLink()}
          />
          <IconButton
            icon="reset"
            label={t("share.reset", "Reset view")}
            onClick={() => runtime.resetView()}
          />
          <IconButton
            icon="chart-line"
            label={t("inspector.title", "Inspector")}
            active={detailOpen}
            onClick={() => setDetailOpen((value) => !value)}
          />
          <IconButton
            icon="info"
            label={t("styleGuide.title", "Style guide")}
            onClick={openStyleGuide}
          />
          <IconButton
            icon="settings"
            label={t("settings.title", "Settings")}
            onClick={() => setSettingsOpen(true)}
          />
        </div>
      </header>

      <div className="app-body" style={layoutStyle}>
        <aside className={`sidebar${sidebarOpen ? "" : " is-collapsed"}`}>
          {sidebarOpen ? (
            <>
              <div className="sidebar-tabs" role="tablist" aria-label={t("sidebar.layers", "Layers")}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "layers"}
                  className="sidebar-tab"
                  onClick={() => setTab("layers")}
                >
                  <Icon name="layers" size={14} />
                  {t("sidebar.layers", "Layers")}
                  <span className="sidebar-count">{snapshot.layers.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "plugins"}
                  className="sidebar-tab"
                  onClick={() => setTab("plugins")}
                >
                  <Icon name="plug" size={14} />
                  {t("sidebar.plugins", "Plugins")}
                  <span className="sidebar-count">{snapshot.plugins.length}</span>
                </button>
              </div>
              <div className="sidebar-scroll">
                {tab === "layers" ? (
                  <LayersPanel runtime={runtime} snapshot={snapshot} />
                ) : (
                  <PluginManager runtime={runtime} snapshot={snapshot} />
                )}
                <SlotHost entries={snapshot.slots} slot="sidebar" context={context} />
              </div>
            </>
          ) : null}
        </aside>

        <main className="map-area">
          <MapHost container={mapContainer} />
          <div className="map-overlay-layer">
            <div className="map-toolbar">
              <MapToolbar runtime={runtime} snapshot={snapshot} />
            </div>
            <div className="map-slot-overlay">
              <SlotHost entries={snapshot.slots} slot="map-overlay" context={context} />
            </div>

            {snapshot.ready && visibleLayers.length === 0 && !snapshot.bootError ? (
              <div className="map-empty">
                <div className="empty-card">
                  <span className="empty-icon">
                    <Icon name="globe" size={26} />
                  </span>
                  <h2>{t("core.empty.title", "Empty map")}</h2>
                  <p className="ts-small ts-muted">{t("core.empty.hint")}</p>
                  <Button
                    variant="primary"
                    icon="plug"
                    onClick={() => {
                      setSidebarOpen(true);
                      setTab("plugins");
                    }}
                  >
                    {t("core.empty.action", "Open plugins")}
                  </Button>
                </div>
              </div>
            ) : null}

            {snapshot.bootError ? (
              <div className="map-empty" role="alert">
                <div className="empty-card">
                  <span className="empty-icon">
                    <Icon name="alert" size={24} />
                  </span>
                  <p className="ts-small">{snapshot.bootError}</p>
                </div>
              </div>
            ) : null}

            <div className="map-legend">
              <LegendPanel snapshot={snapshot} />
              <SlotHost entries={snapshot.slots} slot="legend" context={context} />
            </div>

            <div className="map-attribution">
              <AttributionPanel snapshot={snapshot} />
            </div>

            <div className="map-toasts" aria-live="polite" aria-atomic="false">
              {snapshot.toasts.map((toast) => (
                <div key={toast.id} className="ts-toast" data-level={toast.level}>
                  <span className="ts-grow">{toast.message}</span>
                  <button
                    type="button"
                    className="ts-icon-btn"
                    aria-label={t("panel.close", "Close")}
                    onClick={() => runtime.dismissToast(toast.id)}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </main>

        <aside className={`detail-panel${detailOpen ? "" : " is-collapsed"}`} aria-hidden={!detailOpen}>
          {detailOpen ? (
            <>
              <div className="detail-header">
                <span>{t("inspector.title", "Inspector")}</span>
                <IconButton
                  icon="x"
                  label={t("panel.close", "Close panel")}
                  onClick={() => setDetailOpen(false)}
                />
              </div>
              <div className="detail-scroll">
                <InspectorPanel runtime={runtime} snapshot={snapshot} />
                <SlotHost entries={snapshot.slots} slot="detail" context={context} />
              </div>
            </>
          ) : null}
        </aside>
      </div>

      <TimeBar runtime={runtime} snapshot={snapshot} />
      <StatusBar runtime={runtime} snapshot={snapshot} context={context} activePlugins={activePlugins} />

      {settingsOpen ? (
        <SettingsDialog
          runtime={runtime}
          snapshot={snapshot}
          context={context}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {styleGuideOpen ? <StyleGuide runtime={runtime} onClose={closeStyleGuide} /> : null}
    </>
  );
}

function MapToolbar({ runtime, snapshot }: { runtime: CoreRuntime; snapshot: CoreSnapshot }) {
  const t = (key: string, fallback?: string): string => runtime.t(key, fallback);
  const tools: Array<{ mode: Exclude<DrawMode, "none">; icon: string; label: string }> = [
    { mode: "point", icon: "map-pin", label: t("tools.point", "Point") },
    { mode: "line", icon: "ruler", label: t("tools.line", "Line") },
    { mode: "polygon", icon: "pen-tool", label: t("tools.polygon", "Polygon") },
    { mode: "rectangle", icon: "square", label: t("tools.rectangle", "Rectangle") },
  ];

  return (
    <div className="ts-toolbar" role="toolbar" aria-label={t("tools.title", "Tools")}>
      {tools.map((tool) => (
        <IconButton
          key={tool.mode}
          icon={tool.icon}
          label={tool.label}
          active={snapshot.drawMode === tool.mode}
          onClick={() => runtime.setDrawMode(snapshot.drawMode === tool.mode ? "none" : tool.mode)}
        />
      ))}
      {snapshot.drawMode !== "none" ? (
        <>
          <span className="ts-toolbar-divider" />
          <IconButton
            icon="check"
            label={t("tools.finish", "Finish drawing")}
            shortcut="Enter"
            onClick={() => runtime.finishDrawing()}
          />
          <IconButton
            icon="x"
            label={t("tools.cancel", "Cancel drawing")}
            shortcut="Esc"
            onClick={() => runtime.cancelDrawing()}
          />
        </>
      ) : null}
      <span className="ts-toolbar-divider" />
      <IconButton
        icon="globe"
        label="Globe"
        active={snapshot.view.projection === "globe"}
        onClick={() =>
          runtime.map.setView({
            projection: snapshot.view.projection === "globe" ? "mercator" : "globe",
          })
        }
      />
      <span className="ts-toolbar-divider" />
      <IconButton
        icon="plus"
        label="Zoom in"
        shortcut="+"
        onClick={() => runtime.map.setView({ zoom: Math.min(20, snapshot.view.zoom + 1) })}
      />
      <IconButton
        icon="minus"
        label="Zoom out"
        shortcut="−"
        onClick={() => runtime.map.setView({ zoom: Math.max(0, snapshot.view.zoom - 1) })}
      />
    </div>
  );
}

function TimeBar({ runtime, snapshot }: { runtime: CoreRuntime; snapshot: CoreSnapshot }) {
  const t = (key: string, fallback?: string): string => runtime.t(key, fallback);
  const start = Date.parse(snapshot.timeBounds.start);
  const end = Date.parse(snapshot.timeBounds.end);
  const instant = Date.parse(snapshot.time.instant);
  const days = Math.max(1, Math.round((end - start) / DAY_MS));
  const index = Math.min(days, Math.max(0, Math.round((instant - start) / DAY_MS)));
  const dateValue = snapshot.time.instant.slice(0, 10);
  const monthFormat = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <div className="timebar">
      <div className="timebar-label">
        <Icon name="clock" size={14} />
        {t("time.title", "Time")}
      </div>
      <IconButton
        icon="chevron-left"
        label={t("time.previous", "Previous step")}
        onClick={() => runtime.stepTime(-1)}
      />
      <input
        className="timebar-range"
        type="range"
        min={0}
        max={days}
        step={1}
        value={index}
        aria-label={t("time.range", "Time range")}
        onChange={(event) =>
          runtime.setTimeInstant(new Date(start + Number(event.target.value) * DAY_MS).toISOString())
        }
      />
      <IconButton
        icon="chevron-right"
        label={t("time.next", "Next step")}
        onClick={() => runtime.stepTime(1)}
      />
      <input
        className="timebar-date"
        type="date"
        value={dateValue}
        min={snapshot.timeBounds.start.slice(0, 10)}
        max={snapshot.timeBounds.end.slice(0, 10)}
        aria-label={t("time.title", "Time")}
        onChange={(event) => {
          if (event.target.value) runtime.setTimeInstant(`${event.target.value}T00:00:00.000Z`);
        }}
      />
      <Button size="sm" variant="ghost" onClick={() => runtime.setTimeInstant(snapshot.timeBounds.end)}>
        {t("time.latest", "Latest")}
      </Button>
      <span className="timebar-range-label ts-mono">
        {monthFormat.format(new Date(start))} – {monthFormat.format(new Date(end))}
      </span>
    </div>
  );
}

function StatusBar({
  runtime,
  snapshot,
  context,
  activePlugins,
}: {
  runtime: CoreRuntime;
  snapshot: CoreSnapshot;
  context: SlotContext;
  activePlugins: number;
}) {
  const t = (key: string, fallback?: string): string => runtime.t(key, fallback);
  const coordinate = snapshot.cursor
    ? runtime.coordinates.format(snapshot.cursor, {
        crs: snapshot.displayCrs,
        format: snapshot.coordinateFormat,
      })
    : "—";

  return (
    <footer className="statusbar">
      <span className="ts-mono status-coord" title={coordinate}>
        {coordinate}
      </span>
      <span className="status-divider" aria-hidden="true" />
      <span className="status-selection">{selectionSummary(runtime, snapshot)}</span>
      <span className="status-spacer" />
      <span className="ts-mono">{t("status.zoom", "Zoom")} {snapshot.view.zoom.toFixed(1)}</span>
      <span className="status-divider" aria-hidden="true" />
      <span className="ts-mono">{snapshot.displayCrs}</span>
      <span className="status-divider" aria-hidden="true" />
      <span className="ts-mono">
        {activePlugins}/{snapshot.plugins.length} {t("status.plugins", "plugins")}
      </span>
      <SlotHost entries={snapshot.slots} slot="statusbar" context={context} />
    </footer>
  );
}

function selectionSummary(runtime: CoreRuntime, snapshot: CoreSnapshot): string {
  const geometry = snapshot.selection;
  if (!geometry) return "";
  if (geometry.type === "Point") {
    const [lon, lat] = geometry.coordinates;
    return runtime.coordinates.format({ lon, lat }, { format: "decimal" });
  }
  if (geometry.type === "LineString") {
    let meters = 0;
    const positions = geometry.coordinates;
    for (let index = 0; index < positions.length - 1; index += 1) {
      const from = positions[index];
      const to = positions[index + 1];
      if (!from || !to) continue;
      meters += runtime.coordinates.distance(
        { lon: from[0], lat: from[1] },
        { lon: to[0], lat: to[1] },
      );
    }
    return `${(meters / 1000).toFixed(2)} km`;
  }
  const ring = (geometry.coordinates[0] ?? []).map(([lon, lat]) => ({ lon, lat }));
  const area = runtime.coordinates.area(ring);
  return `${(area / 1_000_000).toFixed(2)} km²`;
}

import { useEffect, useState } from "react";
import type { CoreRuntime, CoreSnapshot, PluginRecord } from "@terrascope/core";
import type { JsonObject, JsonValue, SlotContext } from "@terrascope/plugin-api";
import {
  Badge,
  Button,
  Icon,
  IconButton,
  SlotHost,
  Switch,
  colormapGradient,
  getColormap,
} from "@terrascope/ui-kit";

type Translate = (key: string, fallback?: string) => string;

function translator(runtime: CoreRuntime): Translate {
  return (key, fallback) => runtime.t(key, fallback);
}

function statusTone(status: PluginRecord["status"]): "success" | "danger" | "neutral" {
  if (status === "active") return "success";
  if (status === "error") return "danger";
  return "neutral";
}

export function LayersPanel({ runtime, snapshot }: { runtime: CoreRuntime; snapshot: CoreSnapshot }) {
  const t = translator(runtime);

  if (snapshot.layers.length === 0) {
    return (
      <div className="sidebar-section">
        <div className="ts-empty">
          <span className="ts-empty-title">
            <Icon name="layers" size={15} />
            {t("sidebar.layers.empty", "No layer active")}
          </span>
          <span className="ts-small">{t("sidebar.layers.emptyHint")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-title">
        <Icon name="layers" size={13} />
        {t("sidebar.layers", "Layers")}
      </div>
      <ul className="layer-list">
        {snapshot.layers.map((layer) => (
          <li className="layer-row" key={layer.uid}>
            <div className="layer-row-head">
              <IconButton
                icon={layer.visible ? "eye" : "eye-off"}
                label={`${t("layer.visibility", "Toggle visibility")}: ${layer.name}`}
                active={layer.visible}
                onClick={() => runtime.setLayerVisibility(layer.uid, !layer.visible)}
              />
              <div className="layer-main">
                <span className="layer-name">{layer.name}</span>
                <span className="layer-meta">
                  <span className="ts-mono">{layer.unit}</span>
                  {layer.valueRange
                    ? ` · ${layer.valueRange[0]} … ${layer.valueRange[1]} ${layer.unit}`
                    : ""}
                  {layer.temporal ? ` · ${layer.temporal.resolution.step} ${layer.temporal.resolution.unit}` : ""}
                </span>
              </div>
            </div>
            <div className="layer-opacity">
              <span className="ts-field-label">{t("layer.opacity", "Opacity")}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={layer.opacity}
                aria-label={`${t("layer.opacity", "Opacity")}: ${layer.name}`}
                onChange={(event) => runtime.setLayerOpacity(layer.uid, Number(event.target.value))}
              />
              <span className="ts-mono ts-small ts-muted">{Math.round(layer.opacity * 100)}%</span>
            </div>
            <div className="layer-source" title={layer.source.attribution}>
              {layer.source.attribution}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PluginManager({ runtime, snapshot }: { runtime: CoreRuntime; snapshot: CoreSnapshot }) {
  const t = translator(runtime);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<void>): Promise<void> => {
    setBusy(id);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-title">
        <Icon name="plug" size={13} />
        {t("sidebar.plugins", "Plugins")}
      </div>

      {snapshot.plugins.length === 0 ? (
        <p className="ts-small ts-muted">{t("plugins.none", "No plugins installed.")}</p>
      ) : null}

      <ul className="plugin-list">
        {snapshot.plugins.map((record) => {
          const busyHere = busy === record.id;
          return (
            <li className="plugin-card" key={record.id}>
              <div className="plugin-head">
                <span className="plugin-icon">
                  <Icon name={record.manifest.icon ?? "plug"} size={15} />
                </span>
                <div className="ts-grow">
                  <div className="plugin-name">{record.manifest.name}</div>
                  <div className="plugin-id ts-mono">
                    {record.id} · v{record.manifest.version}
                  </div>
                </div>
                <Badge tone={statusTone(record.status)}>
                  {record.status === "active"
                    ? t("plugins.active", "Active")
                    : record.status === "error"
                      ? t("plugins.error", "Error")
                      : t("plugins.installed", "Installed")}
                </Badge>
              </div>

              {record.manifest.description ? (
                <p className="plugin-description">{record.manifest.description}</p>
              ) : null}

              {record.error ? <p className="plugin-error">{record.error}</p> : null}

              <div className="plugin-meta">
                <span>
                  {t("plugins.coreApi", "Core API")} <span className="ts-mono">{record.manifest.coreApi}</span>
                </span>
                <span>
                  {t("plugins.capabilities", "Capabilities")}:{" "}
                  <span className="ts-mono">{record.manifest.capabilities.join(", ")}</span>
                </span>
                {record.manifest.dependencies ? (
                  <span>
                    {t("plugins.dependencies", "Depends on")}:{" "}
                    <span className="ts-mono">{Object.keys(record.manifest.dependencies).join(", ")}</span>
                  </span>
                ) : null}
              </div>

              <div className="plugin-actions">
                {record.status === "active" ? (
                  <Button
                    size="sm"
                    icon="pause"
                    disabled={busyHere}
                    onClick={() => void run(record.id, () => runtime.deactivatePlugin(record.id))}
                  >
                    {t("plugins.deactivate", "Deactivate")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    icon="play"
                    disabled={busyHere}
                    onClick={() => void run(record.id, () => runtime.activatePlugin(record.id))}
                  >
                    {t("plugins.activate", "Activate")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="danger"
                  icon="trash"
                  disabled={busyHere}
                  onClick={() => void run(record.id, () => runtime.uninstallPlugin(record.id))}
                >
                  {t("plugins.uninstall", "Uninstall")}
                </Button>
              </div>

              <PluginSettings runtime={runtime} plugin={record} />
            </li>
          );
        })}
      </ul>

      <div className="plugin-load">
        <div className="ts-field-label">{t("plugins.loadLocal", "Load plugin from URL")}</div>
        <p className="ts-small ts-faint">{t("plugins.loadLocalHint")}</p>
        <form
          className="plugin-load-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!url.trim()) return;
            setLoadError(null);
            setBusy("__load");
            runtime
              .loadPluginFromUrl(url.trim())
              .then(() => setUrl(""))
              .catch((error: unknown) =>
                setLoadError(error instanceof Error ? error.message : String(error)),
              )
              .finally(() => setBusy(null));
          }}
        >
          <input
            className="ts-input"
            type="url"
            placeholder="https://example.org/plugin.json"
            value={url}
            aria-label={t("plugins.loadLocal", "Load plugin from URL")}
            onChange={(event) => setUrl(event.target.value)}
          />
          <Button type="submit" size="sm" icon="download" disabled={busy === "__load"}>
            {t("plugins.load", "Load")}
          </Button>
        </form>
        {loadError ? <p className="plugin-error">{loadError}</p> : null}
      </div>
    </div>
  );
}

interface SchemaProperty {
  type?: string;
  title?: string;
  description?: string;
  enum?: JsonValue[];
  default?: JsonValue;
}

function PluginSettings({ runtime, plugin }: { runtime: CoreRuntime; plugin: PluginRecord }) {
  const schema = plugin.manifest.settingsSchema as
    | { properties?: Record<string, SchemaProperty> }
    | undefined;
  const properties = schema?.properties;
  if (!properties || Object.keys(properties).length === 0) return null;

  const settings = runtime.pluginSettingsFor(plugin.id);

  return (
    <div className="plugin-settings">
      {Object.entries(properties).map(([key, property]) => {
        const value = settings[key] ?? property.default;
        const label = property.title ?? key;

        if (property.enum) {
          return (
            <div className="ts-field" key={key}>
              <label className="ts-field-label" htmlFor={`${plugin.id}-${key}`}>
                {label}
              </label>
              <select
                id={`${plugin.id}-${key}`}
                className="ts-select"
                value={String(value ?? "")}
                onChange={(event) => runtime.updatePluginSetting(plugin.id, { [key]: event.target.value })}
              >
                {property.enum.map((option) => (
                  <option key={String(option)} value={String(option)}>
                    {String(option)}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (property.type === "boolean") {
          return (
            <div className="ts-row-between" key={key}>
              <span className="ts-field-label">{label}</span>
              <Switch
                checked={Boolean(value)}
                label={label}
                onChange={(checked) => runtime.updatePluginSetting(plugin.id, { [key]: checked })}
              />
            </div>
          );
        }

        if (property.type === "number") {
          return (
            <div className="ts-field" key={key}>
              <label className="ts-field-label" htmlFor={`${plugin.id}-${key}`}>
                {label}
              </label>
              <input
                id={`${plugin.id}-${key}`}
                className="ts-input"
                type="number"
                value={typeof value === "number" ? value : 0}
                onChange={(event) =>
                  runtime.updatePluginSetting(plugin.id, { [key]: Number(event.target.value) })
                }
              />
            </div>
          );
        }

        return (
          <div className="ts-field" key={key}>
            <label className="ts-field-label" htmlFor={`${plugin.id}-${key}`}>
              {label}
            </label>
            <input
              id={`${plugin.id}-${key}`}
              className="ts-input"
              type="text"
              value={typeof value === "string" ? value : ""}
              onChange={(event) =>
                runtime.updatePluginSetting(plugin.id, { [key]: event.target.value } as JsonObject)
              }
            />
          </div>
        );
      })}
    </div>
  );
}

export function InspectorPanel({ runtime, snapshot }: { runtime: CoreRuntime; snapshot: CoreSnapshot }) {
  const t = translator(runtime);
  const inspection = snapshot.inspection;

  if (!inspection) {
    return (
      <div className="inspector-empty">
        <Icon name="mouse-pointer" size={18} />
        <p>{t("inspector.empty", "Click the map to query values at a location.")}</p>
      </div>
    );
  }

  return (
    <div className="inspector">
      <div className="inspector-coordinate">
        <Icon name="crosshair" size={13} />
        <span className="ts-mono">
          {runtime.coordinates.format(inspection.coordinate, {
            format: snapshot.coordinateFormat,
          })}
        </span>
        <span className="ts-faint ts-mono">{snapshot.time.instant.slice(0, 10)}</span>
      </div>

      {inspection.pending ? (
        <div className="inspector-pending">
          <span className="ts-spinner" aria-hidden="true" />
          <span>{t("inspector.loading", "Querying values…")}</span>
        </div>
      ) : inspection.results.length === 0 ? (
        <p className="ts-small ts-muted">{t("inspector.none", "No plugin returned a value here.")}</p>
      ) : (
        inspection.results.map((result) => (
          <section className="inspector-result" key={`${result.id}-${result.title}`}>
            <h3>{result.title}</h3>
            <table className="ts-table">
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td className="ts-num">
                      {row.value}
                      {row.unit ? <span className="ts-faint"> {row.unit}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.note ? <p className="inspector-note">{result.note}</p> : null}
          </section>
        ))
      )}
    </div>
  );
}

export function LegendPanel({ snapshot }: { snapshot: CoreSnapshot }) {
  const layers = snapshot.layers.filter((layer) => layer.visible && layer.legend);
  if (layers.length === 0) return null;

  return (
    <div className="legend">
      {layers.map((layer) => (
        <div className="legend-block" key={layer.uid}>
          <div className="legend-title">{layer.name}</div>
          {layer.legend?.type === "continuous" ? (
            <>
              <div
                className="ts-colormap-bar"
                style={{
                  background: colormapGradient(
                    layer.legend.colormap || layer.colormap || "viridis",
                    "to right",
                  ),
                }}
              />
              <div className="legend-ticks ts-mono">
                <span>{layer.legend.min}</span>
                <span>{layer.legend.max}</span>
              </div>
            </>
          ) : null}
          {layer.legend?.type === "gradient" ? (
            <>
              <div
                className="ts-colormap-bar"
                style={{
                  background: `linear-gradient(to right, ${layer.legend.stops
                    .map((stop) => stop.color)
                    .join(", ")})`,
                }}
              />
              <div className="legend-ticks ts-mono">
                <span>{layer.legend.stops[0]?.value}</span>
                <span>{layer.legend.stops[layer.legend.stops.length - 1]?.value}</span>
              </div>
            </>
          ) : null}
          {layer.legend?.type === "categorical" ? (
            <ul className="legend-items">
              {layer.legend.items.map((item) => (
                <li key={item.value}>
                  <span
                    className="legend-swatch"
                    style={{ background: item.color ?? getColormap("viridis")?.stops[5] }}
                  />
                  {item.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function AttributionPanel({ snapshot }: { snapshot: CoreSnapshot }) {
  const sources = new Map<string, { name: string; url: string; license: string; licenseUrl?: string; attribution: string }>();
  for (const layer of snapshot.layers) {
    if (!layer.visible) continue;
    sources.set(`${layer.source.name}|${layer.source.url}`, layer.source);
  }
  if (sources.size === 0) return null;

  return (
    <details className="attribution">
      <summary>
        <Icon name="database" size={12} />
        Sources &amp; attribution
        <span className="attribution-count">{sources.size}</span>
      </summary>
      <ul>
        {[...sources.values()].map((source) => (
          <li key={`${source.name}-${source.url}`}>
            <a href={source.url} target="_blank" rel="noreferrer noopener">
              {source.name}
            </a>
            <span className="attribution-license">
              {source.license}
              {source.licenseUrl ? (
                <>
                  {" · "}
                  <a href={source.licenseUrl} target="_blank" rel="noreferrer noopener">
                    License
                  </a>
                </>
              ) : null}
            </span>
            <span className="attribution-text">{source.attribution}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function SettingsDialog({
  runtime,
  snapshot,
  context,
  onClose,
}: {
  runtime: CoreRuntime;
  snapshot: CoreSnapshot;
  context: SlotContext;
  onClose: () => void;
}) {
  const t = translator(runtime);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const themes: Array<{ value: "light" | "dark" | "system"; icon: string; key: string }> = [
    { value: "light", icon: "sun", key: "settings.theme.light" },
    { value: "dark", icon: "moon", key: "settings.theme.dark" },
    { value: "system", icon: "monitor", key: "settings.theme.system" },
  ];

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal-header">
          <h2 id="settings-title">{t("settings.title", "Settings")}</h2>
          <IconButton icon="x" label={t("settings.close", "Close")} onClick={onClose} />
        </div>
        <div className="modal-body">
          <section className="settings-section">
            <h3>{t("settings.appearance", "Appearance")}</h3>
            <div className="segmented" role="group" aria-label={t("settings.theme", "Theme")}>
              {themes.map((theme) => (
                <button
                  key={theme.value}
                  type="button"
                  aria-pressed={snapshot.themePreference === theme.value}
                  onClick={() => runtime.setTheme(theme.value)}
                >
                  <Icon name={theme.icon} size={14} />
                  {t(theme.key)}
                </button>
              ))}
            </div>

            <div className="ts-field">
              <label className="ts-field-label" htmlFor="settings-language">
                {t("settings.language", "Language")}
              </label>
              <select
                id="settings-language"
                className="ts-select"
                value={snapshot.locale}
                onChange={(event) => runtime.setLocale(event.target.value as "de" | "en")}
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>

            <div className="ts-field">
              <label className="ts-field-label" htmlFor="settings-crs">
                {t("settings.crs", "Coordinate system")}
              </label>
              <select
                id="settings-crs"
                className="ts-select"
                value={snapshot.displayCrs}
                onChange={(event) => runtime.setDisplayCrs(event.target.value)}
              >
                {runtime.coordinates.crsList.map((crs) => (
                  <option key={crs.code} value={crs.code}>
                    {crs.code} — {crs.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="ts-field">
              <label className="ts-field-label" htmlFor="settings-format">
                {t("settings.coordinateFormat", "Coordinate format")}
              </label>
              <select
                id="settings-format"
                className="ts-select"
                value={snapshot.coordinateFormat}
                onChange={(event) =>
                  runtime.setCoordinateFormat(event.target.value as "decimal" | "dms")
                }
              >
                <option value="decimal">{t("settings.decimal", "Decimal degrees")}</option>
                <option value="dms">{t("settings.dms", "Degrees, minutes, seconds")}</option>
              </select>
            </div>
          </section>

          <section className="settings-section">
            <h3>{t("settings.about", "About")}</h3>
            <p className="ts-small ts-muted">{t("settings.aboutText")}</p>
          </section>

          <SlotHost entries={snapshot.slots} slot="settings" context={context} />
        </div>
      </div>
    </div>
  );
}

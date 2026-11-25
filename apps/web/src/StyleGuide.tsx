import { useState } from "react";
import type { CoreRuntime } from "@terrascope/core";
import type { ChartResult } from "@terrascope/plugin-api";
import {
  Badge,
  Button,
  Chart,
  Icon,
  IconButton,
  Select,
  Slider,
  Spinner,
  Switch,
  colormapGradient,
  listColormaps,
} from "@terrascope/ui-kit";
import { useSnapshot } from "./hooks.js";

const SAMPLE_CHART: ChartResult = {
  kind: "chart",
  chartType: "line",
  xKey: "time",
  series: [{ key: "temperature", label: "Temperature" }],
  unit: "°C",
  title: "Sample series",
  rows: [
    { time: "2024-01-01", temperature: -1.2 },
    { time: "2024-02-01", temperature: 1.4 },
    { time: "2024-03-01", temperature: 6.1 },
    { time: "2024-04-01", temperature: 11.8 },
    { time: "2024-05-01", temperature: 16.2 },
    { time: "2024-06-01", temperature: 20.4 },
  ],
};

const TOKENS: Array<{ token: string; label: string }> = [
  { token: "--ts-bg", label: "Background" },
  { token: "--ts-surface", label: "Surface" },
  { token: "--ts-surface-sunken", label: "Sunken" },
  { token: "--ts-border", label: "Border" },
  { token: "--ts-text", label: "Text" },
  { token: "--ts-text-muted", label: "Muted text" },
  { token: "--ts-accent", label: "Accent" },
  { token: "--ts-success", label: "Success" },
  { token: "--ts-warning", label: "Warning" },
  { token: "--ts-danger", label: "Danger" },
];

const ICONS = [
  "map",
  "layers",
  "globe",
  "mountain",
  "chart-line",
  "plug",
  "settings",
  "share",
  "eye",
  "eye-off",
  "pen-tool",
  "ruler",
  "calendar",
  "clock",
  "crosshair",
  "database",
  "alert",
  "info",
  "check",
  "x",
];

export function StyleGuide({ runtime, onClose }: { runtime: CoreRuntime; onClose: () => void }) {
  const snapshot = useSnapshot(runtime);
  const [switchOn, setSwitchOn] = useState(true);
  const [slider, setSlider] = useState(0.62);
  const [select, setSelect] = useState("viridis");
  const t = (key: string, fallback?: string): string => runtime.t(key, fallback);

  return (
    <div className="styleguide" role="dialog" aria-modal="true" aria-label={t("styleGuide.title")}>
      <header className="styleguide-header">
        <div>
          <h1>{t("styleGuide.title", "Style guide")}</h1>
          <p className="ts-small ts-faint">{t("styleGuide.subtitle")}</p>
        </div>
        <div className="ts-row">
          <div className="segmented" role="group" aria-label={t("settings.theme", "Theme")}>
            <button
              type="button"
              aria-pressed={snapshot.theme === "light"}
              onClick={() => runtime.setTheme("light")}
            >
              <Icon name="sun" size={14} />
              {t("settings.theme.light")}
            </button>
            <button
              type="button"
              aria-pressed={snapshot.theme === "dark"}
              onClick={() => runtime.setTheme("dark")}
            >
              <Icon name="moon" size={14} />
              {t("settings.theme.dark")}
            </button>
          </div>
          <Button icon="x" onClick={onClose}>
            {t("settings.close", "Close")}
          </Button>
        </div>
      </header>

      <div className="styleguide-body">
        <section className="sg-section">
          <h2>{t("styleGuide.colors", "Colors")}</h2>
          <div className="sg-swatches">
            {TOKENS.map((entry) => (
              <div className="sg-swatch" key={entry.token}>
                <span className="sg-swatch-color" style={{ background: `var(${entry.token})` }} />
                <span className="sg-swatch-label">{entry.label}</span>
                <span className="sg-swatch-token ts-mono">{entry.token}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="sg-section">
          <h2>{t("styleGuide.typography", "Typography")}</h2>
          <div className="sg-type">
            <p className="sg-type-xl">TerraScope — 19 px</p>
            <p className="sg-type-lg">Analysis workspace — 15 px</p>
            <p>Body text — 13 px, used for panels and tables.</p>
            <p className="ts-small ts-muted">Secondary text — 12 px, muted.</p>
            <p className="ts-mono">52.5200° N, 13.4050° E · 1 234 m · 2024-06-01</p>
          </div>
        </section>

        <section className="sg-section">
          <h2>{t("styleGuide.controls", "Controls")}</h2>
          <div className="sg-grid">
            <div className="ts-stack">
              <div className="ts-row">
                <Button variant="primary" icon="play">
                  Primary
                </Button>
                <Button icon="layers">Default</Button>
                <Button variant="ghost" icon="share">
                  Ghost
                </Button>
                <Button variant="danger" icon="trash">
                  Danger
                </Button>
                <Button disabled icon="loader">
                  Disabled
                </Button>
              </div>
              <div className="ts-row">
                <IconButton icon="plus" label="Zoom in" shortcut="+" />
                <IconButton icon="minus" label="Zoom out" />
                <IconButton icon="pen-tool" label="Draw polygon" active />
                <IconButton icon="eye-off" label="Hidden layer" />
                <IconButton icon="trash" label="Delete" disabled />
              </div>
              <div className="ts-row">
                <Badge>Neutral</Badge>
                <Badge tone="success">Active</Badge>
                <Badge tone="warning">Warning</Badge>
                <Badge tone="danger">Error</Badge>
                <Spinner />
              </div>
            </div>

            <div className="ts-stack">
              <div className="ts-row-between">
                <span className="ts-field-label">Layer visible</span>
                <Switch checked={switchOn} onChange={setSwitchOn} label="Layer visible" />
              </div>
              <Slider
                label="Opacity"
                value={slider}
                min={0}
                max={1}
                step={0.01}
                onChange={setSlider}
                format={(value) => `${Math.round(value * 100)}%`}
              />
              <Select
                label="Colormap"
                value={select}
                options={listColormaps().map((colormap) => ({
                  value: colormap.id,
                  label: colormap.name,
                }))}
                onChange={setSelect}
              />
            </div>
          </div>
        </section>

        <section className="sg-section">
          <h2>{t("styleGuide.feedback", "Feedback")}</h2>
          <div className="sg-grid">
            <div className="ts-empty">
              <span className="ts-empty-title">
                <Icon name="layers" size={15} />
                No layer active
              </span>
              <span className="ts-small">Layers are contributed by plugins.</span>
              <Button size="sm" icon="plug">
                Open plugins
              </Button>
            </div>
            <div className="ts-stack">
              <div className="ts-toast" data-level="success">
                Plugin activated.
              </div>
              <div className="ts-toast" data-level="warning">
                Network capability declared without hosts.
              </div>
              <div className="ts-toast" data-level="error">
                Plugin failed: invalid manifest.
              </div>
            </div>
          </div>
        </section>

        <section className="sg-section">
          <h2>{t("styleGuide.colormaps", "Colormaps")}</h2>
          <div className="sg-colormaps">
            {listColormaps().map((colormap) => (
              <div className="sg-colormap" key={colormap.id}>
                <div className="ts-row-between">
                  <span>{colormap.name}</span>
                  <Badge tone={colormap.colorblindSafe ? "success" : "warning"}>
                    {colormap.colorblindSafe ? "CVD safe" : "Not CVD safe"}
                  </Badge>
                </div>
                <div
                  className="ts-colormap-bar"
                  style={{ background: colormapGradient(colormap.id) }}
                />
                <p className="ts-small ts-faint">{colormap.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="sg-section">
          <h2>Chart &amp; table</h2>
          <div className="sg-grid">
            <Chart result={SAMPLE_CHART} />
            <table className="ts-table">
              <thead>
                <tr>
                  <th scope="col">Variable</th>
                  <th scope="col" className="ts-num">
                    Value
                  </th>
                  <th scope="col">Unit</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Elevation</td>
                  <td className="ts-num">348</td>
                  <td>m</td>
                </tr>
                <tr>
                  <td>Temperature</td>
                  <td className="ts-num">18.4</td>
                  <td>°C</td>
                </tr>
                <tr>
                  <td>Area</td>
                  <td className="ts-num">12.31</td>
                  <td>km²</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="sg-section">
          <h2>Icon set</h2>
          <div className="sg-icons">
            {ICONS.map((icon) => (
              <div className="sg-icon" key={icon}>
                <Icon name={icon} size={18} />
                <span className="ts-mono">{icon}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="sg-section">
          <h2>{t("styleGuide.slots", "Slots")}</h2>
          <p className="ts-small ts-muted">
            Plugin UI contributions currently mounted:{" "}
            <span className="ts-mono">{snapshot.slots.length}</span>. Slots: sidebar, toolbar,
            map-overlay, legend, detail, settings, context-menu, statusbar.
          </p>
        </section>
      </div>
    </div>
  );
}

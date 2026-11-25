import type { ChartResult } from "@terrascope/plugin-api";

const SVG_NS = "http://www.w3.org/2000/svg";

function element<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name) as SVGElementTagNameMap[K];
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

/**
 * Framework-agnostic SVG chart. Uses design tokens only, so it follows the core
 * theme without importing any UI framework.
 */
export function renderSeriesChart(
  container: HTMLElement,
  chart: ChartResult,
  emptyLabel: string,
): void {
  container.replaceChildren();
  const series = chart.series[0];
  if (!series || chart.rows.length === 0) {
    container.textContent = emptyLabel;
    container.style.color = "var(--ts-text-muted)";
    container.style.fontSize = "var(--ts-text-xs)";
    return;
  }

  const values = chart.rows.map((row) => {
    const value = row[series.key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  });
  const numeric = values.filter((value): value is number => value !== null);
  if (numeric.length === 0) {
    container.textContent = emptyLabel;
    return;
  }

  const width = 320;
  const height = 150;
  const padding = { top: 10, right: 8, bottom: 22, left: 38 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const minimum = Math.min(...numeric);
  const maximum = Math.max(...numeric);
  const span = maximum - minimum || 1;

  const x = (index: number): number =>
    padding.left + (values.length <= 1 ? plotWidth / 2 : (index / (values.length - 1)) * plotWidth);
  const y = (value: number): number =>
    padding.top + plotHeight - ((value - minimum) / span) * plotHeight;

  const svg = element("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": chart.title ?? "Time series",
    preserveAspectRatio: "none",
  });
  svg.style.width = "100%";
  svg.style.height = "auto";
  svg.style.display = "block";
  svg.style.overflow = "visible";

  for (const fraction of [0, 0.5, 1]) {
    const value = minimum + span * fraction;
    const line = element("line", {
      x1: padding.left,
      x2: width - padding.right,
      y1: y(value),
      y2: y(value),
      "stroke-width": 1,
    });
    line.style.stroke = "var(--ts-grid-line)";
    svg.append(line);

    const label = element("text", {
      x: padding.left - 5,
      y: y(value) + 3,
      "text-anchor": "end",
      "font-size": 9,
      "font-family": "var(--ts-font-mono)",
    });
    label.style.fill = "var(--ts-text-faint)";
    label.textContent = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
    svg.append(label);
  }

  const segments: string[] = [];
  let current = "";
  values.forEach((value, index) => {
    if (value === null) {
      if (current) segments.push(current);
      current = "";
      return;
    }
    current += `${current ? " L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`;
  });
  if (current) segments.push(current);

  for (const segment of segments) {
    const path = element("path", { d: segment, "stroke-width": 1.75, fill: "none" });
    path.style.stroke = "var(--ts-accent)";
    path.style.strokeLinejoin = "round";
    path.style.strokeLinecap = "round";
    svg.append(path);
  }

  const first = chart.rows[0];
  const last = chart.rows[chart.rows.length - 1];
  for (const [row, anchor] of [
    [first, "start"],
    [last, "end"],
  ] as const) {
    if (!row) continue;
    const label = element("text", {
      x: anchor === "start" ? padding.left : width - padding.right,
      y: height - 5,
      "text-anchor": anchor,
      "font-size": 9,
      "font-family": "var(--ts-font-mono)",
    });
    label.style.fill = "var(--ts-text-faint)";
    label.textContent = String(row[chart.xKey] ?? "").slice(0, 10);
    svg.append(label);
  }

  const unit = element("text", {
    x: padding.left,
    y: 9,
    "font-size": 9,
    "font-family": "var(--ts-font-mono)",
  });
  unit.style.fill = "var(--ts-text-muted)";
  unit.textContent = chart.unit ?? series.label;
  svg.append(unit);

  container.append(svg);
}

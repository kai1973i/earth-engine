import type { ChartResult } from "@terrascope/plugin-api";
import { colormapColor } from "./colormaps.js";

interface Point {
  x: number;
  y: number;
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export interface ChartProps {
  result: ChartResult;
  height?: number;
}

/** Line, area and bar rendering for declarative chart results. */
export function Chart({ result, height = 150 }: ChartProps) {
  const width = 320;
  const padding = { top: 8, right: 8, bottom: 18, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const series = result.series.map((entry, index) => ({
    ...entry,
    color: entry.color ?? colormapColor("viridis", result.series.length <= 1 ? 0.35 : index / Math.max(1, result.series.length - 1)),
  }));

  const allValues = result.rows.flatMap((row) =>
    series.map((entry) => numeric(row[entry.key])).filter((value): value is number => value !== null),
  );
  const minimum = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maximum = allValues.length > 0 ? Math.max(...allValues) : 1;
  const span = maximum - minimum || 1;

  const x = (index: number): number =>
    padding.left + (result.rows.length <= 1 ? plotWidth / 2 : (index / (result.rows.length - 1)) * plotWidth);
  const y = (value: number): number => padding.top + plotHeight - ((value - minimum) / span) * plotHeight;

  const gridValues = [minimum, minimum + span / 2, maximum];
  const isBar = result.chartType === "bar";
  const barWidth = Math.max(1, (plotWidth / Math.max(1, result.rows.length)) * 0.6);

  const title = result.title ?? "Analysis chart";

  return (
    <figure style={{ margin: 0 }}>
      <svg
        className="ts-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title}: ${series.map((entry) => entry.label).join(", ")}`}
      >
        {gridValues.map((value) => (
          <g key={value}>
            <line
              className="ts-chart-grid"
              x1={padding.left}
              x2={width - padding.right}
              y1={y(value)}
              y2={y(value)}
            />
            <text className="ts-chart-axis" x={padding.left - 5} y={y(value) + 3} textAnchor="end">
              {Number.isInteger(value) ? value : value.toFixed(1)}
            </text>
          </g>
        ))}

        {result.rows.length > 1 ? (
          <>
            <text className="ts-chart-axis" x={padding.left} y={height - 4}>
              {String(result.rows[0]?.[result.xKey] ?? "").slice(0, 10)}
            </text>
            <text className="ts-chart-axis" x={width - padding.right} y={height - 4} textAnchor="end">
              {String(result.rows[result.rows.length - 1]?.[result.xKey] ?? "").slice(0, 10)}
            </text>
          </>
        ) : null}

        {series.map((entry) => {
          const points: Point[] = result.rows.flatMap((row, index) => {
            const value = numeric(row[entry.key]);
            return value === null ? [] : [{ x: x(index), y: y(value) }];
          });
          if (points.length === 0) return null;

          if (isBar) {
            return (
              <g key={entry.key}>
                {points.map((point, index) => (
                  <rect
                    key={index}
                    x={point.x - barWidth / 2}
                    y={point.y}
                    width={barWidth}
                    height={Math.max(0, padding.top + plotHeight - point.y)}
                    fill={entry.color}
                    opacity={0.85}
                  />
                ))}
              </g>
            );
          }

          const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
          const first = points[0];
          const last = points[points.length - 1];
          const area =
            first && last
              ? `${path} L${last.x},${padding.top + plotHeight} L${first.x},${padding.top + plotHeight} Z`
              : "";
          return (
            <g key={entry.key}>
              {result.chartType === "area" && area ? (
                <path d={area} fill={entry.color} opacity={0.16} />
              ) : null}
              <path className="ts-chart-line" d={path} stroke={entry.color} />
            </g>
          );
        })}
      </svg>
      <figcaption className="ts-chart-legend">
        {series.map((entry) => (
          <span className="ts-chart-legend-item" key={entry.key}>
            <span className="ts-chart-swatch" style={{ background: entry.color }} />
            {entry.label}
            {result.unit ? <span className="ts-faint">({result.unit})</span> : null}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

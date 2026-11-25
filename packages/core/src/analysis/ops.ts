import type { ChartResult, JsonObject, JsonValue, TableResult } from "@terrascope/plugin-api";

/** A pure, synchronous operation that can run inside a worker or on a server. */
export interface WorkerOperation {
  id: string;
  title: string;
  run(inputs: JsonObject, params: JsonObject): JsonValue;
}

function numbers(value: JsonValue | undefined): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item))
    : [];
}

function num(value: JsonValue | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: JsonValue | undefined, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toValue(value: AppValue): JsonValue {
  return value as unknown as JsonValue;
}

type AppValue = TableResult | ChartResult | string | number | boolean | null;

const mean: WorkerOperation = {
  id: "value.mean",
  title: "Arithmetic mean",
  run(inputs) {
    const values = numbers(inputs["values"]);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  },
};

const min: WorkerOperation = {
  id: "value.min",
  title: "Minimum",
  run(inputs) {
    const values = numbers(inputs["values"]);
    return values.length > 0 ? Math.min(...values) : null;
  },
};

const max: WorkerOperation = {
  id: "value.max",
  title: "Maximum",
  run(inputs) {
    const values = numbers(inputs["values"]);
    return values.length > 0 ? Math.max(...values) : null;
  },
};

const sum: WorkerOperation = {
  id: "value.sum",
  title: "Sum",
  run(inputs) {
    const values = numbers(inputs["values"]);
    return values.length > 0 ? values.reduce((total, value) => total + value, 0) : null;
  },
};

const mathAdd: WorkerOperation = {
  id: "math.add",
  title: "Add",
  run(inputs) {
    return num(inputs["a"]) + num(inputs["b"]);
  },
};

const mathSubtract: WorkerOperation = {
  id: "math.subtract",
  title: "Subtract",
  run(inputs) {
    return num(inputs["a"]) - num(inputs["b"]);
  },
};

const mathMultiply: WorkerOperation = {
  id: "math.multiply",
  title: "Multiply",
  run(inputs) {
    return num(inputs["a"]) * num(inputs["b"]);
  },
};

const mathDivide: WorkerOperation = {
  id: "math.divide",
  title: "Divide",
  run(inputs) {
    const divisor = num(inputs["b"]);
    if (divisor === 0) throw new Error("Division by zero.");
    return num(inputs["a"]) / divisor;
  },
};

const tableFromSeries: WorkerOperation = {
  id: "table.fromSeries",
  title: "Build a time/value table",
  run(inputs, params) {
    const times = Array.isArray(inputs["times"]) ? inputs["times"] : [];
    const values = Array.isArray(inputs["values"]) ? inputs["values"] : [];
    const valueKey = str(params["valueKey"], "value");
    const table: TableResult = {
      kind: "table",
      columns: [
        { key: "time", label: "Time" },
        {
          key: valueKey,
          label: str(params["valueLabel"], valueKey),
          ...(typeof params["unit"] === "string" ? { unit: params["unit"] } : {}),
        },
      ],
      rows: times.map((time, index) => ({
        time: typeof time === "string" ? time : String(time),
        [valueKey]: (values[index] ?? null) as JsonValue,
      })),
    };
    return toValue(table);
  },
};

const chartFromTable: WorkerOperation = {
  id: "chart.fromTable",
  title: "Chart a table",
  run(inputs, params) {
    const table = inputs["table"] as unknown as TableResult | undefined;
    if (!table || typeof table !== "object" || table.kind !== "table") {
      throw new Error('chart.fromTable expects a "table" input.');
    }
    const defaultKey = table.columns.find((column) => column.key !== "time")?.key ?? "value";
    const rawSeries = Array.isArray(params["series"]) ? params["series"] : [];
    const series = rawSeries.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
      const record = entry as Record<string, JsonValue>;
      const key = str(record["key"], defaultKey);
      return [{ key, label: str(record["label"], key) }];
    });
    const chartType = params["chartType"];
    const result: ChartResult = {
      kind: "chart",
      chartType: chartType === "bar" || chartType === "area" ? chartType : "line",
      xKey: str(params["xKey"], "time"),
      series: series.length > 0 ? series : [{ key: defaultKey, label: defaultKey }],
      rows: table.rows,
      ...(typeof params["title"] === "string" ? { title: params["title"] } : {}),
      ...(typeof params["unit"] === "string" ? { unit: params["unit"] } : {}),
    };
    return toValue(result);
  },
};

/** Operations built into the core. Plugins compose them declaratively. */
export const coreOperations: WorkerOperation[] = [
  mean,
  min,
  max,
  sum,
  mathAdd,
  mathSubtract,
  mathMultiply,
  mathDivide,
  tableFromSeries,
  chartFromTable,
];

export const coreOperationIds: ReadonlySet<string> = new Set(coreOperations.map((operation) => operation.id));

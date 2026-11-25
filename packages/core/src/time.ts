import type { TemporalResolution, TemporalSupport, TimeApi, TimeState } from "@terrascope/plugin-api";
import type { EventBus } from "./events.js";

const DAY_MS = 86_400_000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function floorToResolution(instant: string, resolution: TemporalResolution): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return instant;
  switch (resolution.unit) {
    case "hour": {
      const hours = Math.max(1, resolution.step);
      date.setUTCMinutes(0, 0, 0);
      date.setUTCHours(Math.floor(date.getUTCHours() / hours) * hours);
      return date.toISOString();
    }
    case "month":
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
    case "year":
      return new Date(Date.UTC(date.getUTCFullYear(), 0, 1)).toISOString();
    case "day":
    default: {
      const days = Math.max(1, resolution.step);
      const floored = startOfUtcDay(date);
      const epochDays = Math.floor(floored.getTime() / DAY_MS);
      return new Date((epochDays - (epochDays % days)) * DAY_MS).toISOString();
    }
  }
}

export function shiftInstant(instant: string, resolution: TemporalResolution, direction: number): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return instant;
  const steps = resolution.step * direction;
  switch (resolution.unit) {
    case "hour":
      date.setUTCHours(date.getUTCHours() + steps);
      break;
    case "month":
      date.setUTCMonth(date.getUTCMonth() + steps);
      break;
    case "year":
      date.setUTCFullYear(date.getUTCFullYear() + steps);
      break;
    case "day":
    default:
      date.setUTCDate(date.getUTCDate() + steps);
      break;
  }
  return date.toISOString();
}

function defaultRange(): { start: string; end: string } {
  const end = startOfUtcDay(new Date(Date.now() - 2 * DAY_MS));
  const start = new Date(end.getTime() - 120 * DAY_MS);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Global time dimension. Every time-aware layer is synchronized through this
 * single state; resolutions are handled by flooring to the layer's unit.
 */
export class TimeService implements TimeApi {
  private state: TimeState;
  private listeners = new Set<(state: TimeState) => void>();

  constructor(private events: EventBus) {
    const range = defaultRange();
    this.state = {
      instant: range.end,
      range,
      resolution: { unit: "day", step: 1 },
    };
  }

  get(): TimeState {
    return { ...this.state, range: { ...this.state.range }, resolution: { ...this.state.resolution } };
  }

  setInstant(instant: string): void {
    const date = new Date(instant);
    if (Number.isNaN(date.getTime())) return;
    const clamped = this.clamp(date.toISOString());
    this.update({ ...this.state, instant: clamped });
  }

  setRange(start: string, end: string): void {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;
    if (startDate >= endDate) return;
    const range = { start: startDate.toISOString(), end: endDate.toISOString() };
    const instant = this.state.instant < range.start || this.state.instant > range.end ? range.end : this.state.instant;
    this.update({ ...this.state, range, instant });
  }

  setResolution(resolution: TemporalResolution): void {
    this.update({ ...this.state, resolution: { ...resolution } });
  }

  resolveFor(support: TemporalSupport): string {
    const start = Date.parse(support.start);
    const end = Date.parse(support.end);
    const instant = Date.parse(this.state.instant);
    const clamped = Number.isFinite(instant) ? Math.min(Math.max(instant, start), end) : end;
    return floorToResolution(new Date(clamped).toISOString(), support.resolution);
  }

  format(instant: string, options?: { dateStyle?: "short" | "medium" | "long"; timeStyle?: "short" | "medium" }): string {
    const date = new Date(instant);
    if (Number.isNaN(date.getTime())) return instant;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: options?.dateStyle ?? "medium",
      ...(options?.timeStyle ? { timeStyle: options.timeStyle } : {}),
      timeZone: "UTC",
    }).format(date);
  }

  onChange(handler: (state: TimeState) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  private clamp(instant: string): string {
    const start = Date.parse(this.state.range.start);
    const end = Date.parse(this.state.range.end);
    const value = Date.parse(instant);
    if (!Number.isFinite(value)) return this.state.instant;
    return new Date(Math.min(Math.max(value, start), end)).toISOString();
  }

  private update(next: TimeState): void {
    this.state = next;
    for (const listener of this.listeners) {
      try {
        listener(this.get());
      } catch (error) {
        console.error("[core] time listener failed", error);
      }
    }
    this.events.emit("time:changed", this.get());
  }
}

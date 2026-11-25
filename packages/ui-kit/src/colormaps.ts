export interface Colormap {
  id: string;
  name: string;
  description: string;
  /** Perceptually uniform stops, dark/light independent by design. */
  stops: string[];
  colorblindSafe: boolean;
}

const REGISTRY = new Map<string, Colormap>();

const DEFAULTS: Colormap[] = [
  {
    id: "viridis",
    name: "Viridis",
    description: "Perceptually uniform, colorblind safe. Default for continuous data.",
    stops: [
      "#440154",
      "#482878",
      "#3e4989",
      "#31688e",
      "#26828e",
      "#1f9e89",
      "#35b779",
      "#6ece58",
      "#b5de2b",
      "#fde725",
    ],
    colorblindSafe: true,
  },
  {
    id: "cividis",
    name: "Cividis",
    description: "Optimised for all forms of color vision deficiency.",
    stops: [
      "#00204d",
      "#00306f",
      "#39486b",
      "#575d6d",
      "#707173",
      "#8a8779",
      "#a69d75",
      "#c4b56c",
      "#e4cf5f",
      "#ffea46",
    ],
    colorblindSafe: true,
  },
  {
    id: "blues",
    name: "Blues",
    description: "ColorBrewer sequential, 9 classes. Precipitation, humidity, depth.",
    stops: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b"],
    colorblindSafe: true,
  },
  {
    id: "ylorrd",
    name: "YlOrRd",
    description: "ColorBrewer sequential, 9 classes. Temperature, fire, intensity.",
    stops: ["#ffffcc", "#ffeda0", "#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#bd0026", "#800026"],
    colorblindSafe: false,
  },
  {
    id: "greys",
    name: "Greys",
    description: "Neutral sequential ramp for mask, density and background layers.",
    stops: ["#ffffff", "#f0f0f0", "#d9d9d9", "#bdbdbd", "#969696", "#737373", "#525252", "#252525", "#000000"],
    colorblindSafe: true,
  },
  {
    id: "brbg",
    name: "BrBG",
    description: "ColorBrewer diverging, 11 classes. Anomalies around a reference value.",
    stops: [
      "#8c510a",
      "#bf812d",
      "#dfc27d",
      "#f6e8c3",
      "#f5f5f5",
      "#c7eae5",
      "#80cdc1",
      "#35978f",
      "#01665e",
    ],
    colorblindSafe: true,
  },
];

for (const colormap of DEFAULTS) REGISTRY.set(colormap.id, colormap);

export function registerColormap(colormap: Colormap): void {
  REGISTRY.set(colormap.id, colormap);
}

export function listColormaps(): Colormap[] {
  return [...REGISTRY.values()];
}

export function getColormap(id: string): Colormap | undefined {
  return REGISTRY.get(id);
}

/** CSS gradient for legends and swatches. */
export function colormapGradient(id: string, direction = "to right"): string {
  const colormap = REGISTRY.get(id) ?? REGISTRY.get("viridis");
  if (!colormap) return "transparent";
  return `linear-gradient(${direction}, ${colormap.stops.join(", ")})`;
}

export function colormapColor(id: string, fraction: number): string {
  const colormap = REGISTRY.get(id) ?? REGISTRY.get("viridis");
  if (!colormap) return "currentColor";
  const clamped = Math.min(1, Math.max(0, fraction));
  const index = Math.round(clamped * (colormap.stops.length - 1));
  return colormap.stops[index] ?? colormap.stops[colormap.stops.length - 1] ?? "currentColor";
}

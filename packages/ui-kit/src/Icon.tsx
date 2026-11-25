import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Calendar,
  ChartLine,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Crosshair,
  Database,
  Download,
  Eye,
  EyeOff,
  Globe,
  Info,
  Layers,
  Loader2,
  Map,
  MapPin,
  Maximize2,
  Minus,
  Monitor,
  Moon,
  Mountain,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  PenTool,
  Play,
  Plug,
  Plus,
  RotateCcw,
  Ruler,
  Settings,
  Share2,
  Square,
  Sun,
  Thermometer,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const REGISTRY: Record<string, LucideIcon> = {
  alert: AlertTriangle,
  "alert-triangle": AlertTriangle,
  calendar: Calendar,
  chart: ChartLine,
  "chart-line": ChartLine,
  check: CheckCircle2,
  "check-circle": CheckCircle2,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  circle: Circle,
  clock: Clock,
  crosshair: Crosshair,
  database: Database,
  download: Download,
  eye: Eye,
  "eye-off": EyeOff,
  globe: Globe,
  info: Info,
  layers: Layers,
  loader: Loader2,
  map: Map,
  "map-pin": MapPin,
  maximize: Maximize2,
  minus: Minus,
  monitor: Monitor,
  moon: Moon,
  mountain: Mountain,
  "mouse-pointer": MousePointer2,
  "panel-close": PanelLeftClose,
  "panel-open": PanelLeftOpen,
  pause: Pause,
  "pen-tool": PenTool,
  play: Play,
  plug: Plug,
  plus: Plus,
  reset: RotateCcw,
  ruler: Ruler,
  settings: Settings,
  share: Share2,
  square: Square,
  sun: Sun,
  thermometer: Thermometer,
  trash: Trash2,
  upload: Upload,
  x: X,
};

export interface IconProps {
  name?: string | undefined;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
}

/** The only icon entry point in the UI kit — swap the set here, not per call. */
export function Icon({ name, size = 16, strokeWidth = 1.75, className, label }: IconProps) {
  const Component = (name ? REGISTRY[name] : undefined) ?? Circle;
  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={label ? undefined : true}
      {...(label ? { "aria-label": label, role: "img" as const } : {})}
    />
  );
}

export function hasIcon(name: string): boolean {
  return name in REGISTRY;
}

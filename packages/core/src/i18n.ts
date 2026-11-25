import type { I18nApi, Locale } from "@terrascope/plugin-api";

const CORE_MESSAGES: Record<Locale, Record<string, string>> = {
  en: {
    "core.title": "TerraScope",
    "core.tagline": "Open geodata workspace",
    "core.empty.title": "Empty map",
    "core.empty.hint": "Activate a plugin to add a base map, elevation or time series data.",
    "core.empty.action": "Open plugins",
    "sidebar.layers": "Layers",
    "sidebar.layers.empty": "No layer active",
    "sidebar.layers.emptyHint": "Layers are contributed by plugins.",
    "sidebar.plugins": "Plugins",
    "sidebar.settings": "Settings",
    "layer.visibility": "Toggle visibility",
    "layer.opacity": "Opacity",
    "layer.remove": "Remove layer",
    "layer.attribution": "Source",
    "layer.noTemporal": "No time dimension",
    "plugins.active": "Active",
    "plugins.installed": "Installed",
    "plugins.error": "Error",
    "plugins.activate": "Activate",
    "plugins.deactivate": "Deactivate",
    "plugins.uninstall": "Uninstall",
    "plugins.capabilities": "Capabilities",
    "plugins.coreApi": "Core API",
    "plugins.dependencies": "Depends on",
    "plugins.loadLocal": "Load plugin from URL",
    "plugins.loadLocalHint": "Enter the URL of a plugin.json (trusted local plugins only).",
    "plugins.load": "Load",
    "plugins.none": "No plugins installed.",
    "plugins.settings": "Settings",
    "time.title": "Time",
    "time.previous": "Previous step",
    "time.next": "Next step",
    "time.latest": "Latest",
    "time.range": "Time range",
    "tools.title": "Tools",
    "tools.point": "Point",
    "tools.line": "Line",
    "tools.polygon": "Polygon",
    "tools.rectangle": "Rectangle",
    "tools.finish": "Finish drawing",
    "tools.cancel": "Cancel drawing",
    "tools.hint": "Click the map to place vertices. Finish with Enter.",
    "inspector.title": "Inspector",
    "inspector.empty": "Click the map to query values at a location.",
    "inspector.loading": "Querying values…",
    "inspector.none": "No plugin returned a value here.",
    "legend.title": "Legend",
    "legend.empty": "No legend contributions.",
    "attribution.title": "Sources & attribution",
    "attribution.empty": "No data sources active.",
    "attribution.license": "License",
    "settings.title": "Settings",
    "settings.appearance": "Appearance",
    "settings.theme": "Theme",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.theme.system": "System",
    "settings.language": "Language",
    "settings.crs": "Coordinate system",
    "settings.coordinateFormat": "Coordinate format",
    "settings.decimal": "Decimal degrees",
    "settings.dms": "Degrees, minutes, seconds",
    "settings.close": "Close",
    "settings.about": "About",
    "settings.aboutText": "Core without data sources. Every layer comes from a plugin.",
    "share.copy": "Copy share link",
    "share.copied": "Share link copied.",
    "share.reset": "Reset view",
    "status.zoom": "Zoom",
    "status.crs": "CRS",
    "status.plugins": "plugins",
    "styleGuide.title": "Style guide",
    "styleGuide.subtitle": "Design tokens and UI kit components",
    "styleGuide.colors": "Colors",
    "styleGuide.typography": "Typography",
    "styleGuide.controls": "Controls",
    "styleGuide.feedback": "Feedback",
    "styleGuide.colormaps": "Colormaps",
    "styleGuide.slots": "Slots",
    "analysis.title": "Analysis",
    "analysis.running": "Running in worker…",
    "analysis.failed": "Analysis failed",
    "analysis.empty": "No analysis has run yet.",
    "analysis.worker": "Executed in {ms} ms in a worker",
    "toast.pluginActivated": "Plugin {id} activated.",
    "toast.pluginDeactivated": "Plugin {id} deactivated.",
    "toast.pluginError": "Plugin {id} failed: {message}",
    "toast.pluginInstalled": "Plugin {id} installed.",
    "toast.analysisFailed": "Analysis failed: {message}",
    "error.map": "The map could not be initialised: {message}",
    "panel.close": "Close panel",
    "panel.collapse": "Collapse sidebar",
    "panel.expand": "Expand sidebar",
    "common.loading": "Loading…",
  },
  de: {
    "core.title": "TerraScope",
    "core.tagline": "Offene Geodaten-Werkbank",
    "core.empty.title": "Leere Karte",
    "core.empty.hint": "Aktiviere ein Plugin für Basiskarte, Höhenmodell oder Zeitreihen.",
    "core.empty.action": "Plugins öffnen",
    "sidebar.layers": "Layer",
    "sidebar.layers.empty": "Kein Layer aktiv",
    "sidebar.layers.emptyHint": "Layer werden von Plugins beigesteuert.",
    "sidebar.plugins": "Plugins",
    "sidebar.settings": "Einstellungen",
    "layer.visibility": "Sichtbarkeit umschalten",
    "layer.opacity": "Deckkraft",
    "layer.remove": "Layer entfernen",
    "layer.attribution": "Quelle",
    "layer.noTemporal": "Keine Zeitdimension",
    "plugins.active": "Aktiv",
    "plugins.installed": "Installiert",
    "plugins.error": "Fehler",
    "plugins.activate": "Aktivieren",
    "plugins.deactivate": "Deaktivieren",
    "plugins.uninstall": "Deinstallieren",
    "plugins.capabilities": "Fähigkeiten",
    "plugins.coreApi": "Core-API",
    "plugins.dependencies": "Abhängig von",
    "plugins.loadLocal": "Plugin per URL laden",
    "plugins.loadLocalHint": "URL einer plugin.json eingeben (nur vertrauenswürdige lokale Plugins).",
    "plugins.load": "Laden",
    "plugins.none": "Keine Plugins installiert.",
    "plugins.settings": "Einstellungen",
    "time.title": "Zeit",
    "time.previous": "Schritt zurück",
    "time.next": "Schritt vor",
    "time.latest": "Aktuellster Wert",
    "time.range": "Zeitraum",
    "tools.title": "Werkzeuge",
    "tools.point": "Punkt",
    "tools.line": "Linie",
    "tools.polygon": "Polygon",
    "tools.rectangle": "Rechteck",
    "tools.finish": "Zeichnen abschließen",
    "tools.cancel": "Zeichnen abbrechen",
    "tools.hint": "Klicke in die Karte, um Stützpunkte zu setzen. Enter schließt ab.",
    "inspector.title": "Inspector",
    "inspector.empty": "Klicke in die Karte, um Werte an einem Ort abzufragen.",
    "inspector.loading": "Werte werden abgefragt…",
    "inspector.none": "Kein Plugin liefert hier einen Wert.",
    "legend.title": "Legende",
    "legend.empty": "Keine Legendenbeiträge.",
    "attribution.title": "Quellen & Attribution",
    "attribution.empty": "Keine Datenquellen aktiv.",
    "attribution.license": "Lizenz",
    "settings.title": "Einstellungen",
    "settings.appearance": "Darstellung",
    "settings.theme": "Theme",
    "settings.theme.light": "Hell",
    "settings.theme.dark": "Dunkel",
    "settings.theme.system": "System",
    "settings.language": "Sprache",
    "settings.crs": "Koordinatensystem",
    "settings.coordinateFormat": "Koordinatenformat",
    "settings.decimal": "Dezimalgrad",
    "settings.dms": "Grad, Minuten, Sekunden",
    "settings.close": "Schließen",
    "settings.about": "Über",
    "settings.aboutText": "Core ohne Datenquellen. Jeder Layer stammt aus einem Plugin.",
    "share.copy": "Link kopieren",
    "share.copied": "Link kopiert.",
    "share.reset": "Ansicht zurücksetzen",
    "status.zoom": "Zoom",
    "status.crs": "CRS",
    "status.plugins": "Plugins",
    "styleGuide.title": "Style Guide",
    "styleGuide.subtitle": "Design-Tokens und UI-Kit-Komponenten",
    "styleGuide.colors": "Farben",
    "styleGuide.typography": "Typografie",
    "styleGuide.controls": "Bedienelemente",
    "styleGuide.feedback": "Rückmeldungen",
    "styleGuide.colormaps": "Farbskalen",
    "styleGuide.slots": "Slots",
    "analysis.title": "Analyse",
    "analysis.running": "Läuft im Worker…",
    "analysis.failed": "Analyse fehlgeschlagen",
    "analysis.empty": "Noch keine Analyse ausgeführt.",
    "analysis.worker": "In {ms} ms im Worker ausgeführt",
    "toast.pluginActivated": "Plugin {id} aktiviert.",
    "toast.pluginDeactivated": "Plugin {id} deaktiviert.",
    "toast.pluginError": "Plugin {id} fehlgeschlagen: {message}",
    "toast.pluginInstalled": "Plugin {id} installiert.",
    "toast.analysisFailed": "Analyse fehlgeschlagen: {message}",
    "error.map": "Die Karte konnte nicht initialisiert werden: {message}",
    "panel.close": "Panel schließen",
    "panel.collapse": "Seitenleiste einklappen",
    "panel.expand": "Seitenleiste ausklappen",
    "common.loading": "Lädt…",
  },
};

function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

export class I18nService implements I18nApi {
  private current: Locale = detectLocale();
  private extras: Array<{ locale: Locale; messages: Record<string, string>; pluginId: string }> = [];
  private listeners = new Set<(locale: Locale) => void>();

  get locale(): Locale {
    return this.current;
  }

  register(
    messages: Partial<Record<Locale, Record<string, string>>>,
    pluginId = "plugin",
  ): void {
    for (const locale of ["de", "en"] as const) {
      const set = messages[locale];
      if (set) this.extras.push({ locale, messages: set, pluginId });
    }
  }

  t(key: string, fallback?: string): string {
    for (let index = this.extras.length - 1; index >= 0; index -= 1) {
      const entry = this.extras[index];
      if (entry && entry.locale === this.current && entry.messages[key] !== undefined) {
        return entry.messages[key] as string;
      }
    }
    return CORE_MESSAGES[this.current][key] ?? CORE_MESSAGES.en[key] ?? fallback ?? key;
  }

  setLocale(locale: Locale): void {
    if (locale === this.current) return;
    this.current = locale;
    for (const listener of this.listeners) listener(locale);
  }

  onChange(handler: (locale: Locale) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  removeAll(pluginId: string): void {
    this.extras = this.extras.filter((entry) => entry.pluginId !== pluginId);
  }
}

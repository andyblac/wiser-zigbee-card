import enUS from "./languages/en-US.json";
import enGB from "./languages/en-GB.json";
import de from "./languages/de.json";
import fr from "./languages/fr.json";

export interface TranslationContext {
  language?: string;
  locale?: { language?: string };
  localize?: (key: string, ...args: any[]) => string | undefined;
}
export type SupportedLanguage = "en-US" | "en-GB" | "de" | "fr";
const languages: Record<SupportedLanguage, Record<string, string>> = {
  "en-US": enUS,
  "en-GB": enGB,
  de,
  fr,
};
// Core and Lovelace labels are owned by HA; no local copies.
const nativeKeys: Record<string, string> = {
  "panel.cancel": "ui.common.cancel",
  "panel.retry": "ui.common.retry",
  "common.copy": "ui.common.copy",
  "common.copied": "ui.common.copied",
  "common.saved": "ui.common.successfully_saved",
  "editor.icons": "ui.panel.lovelace.editor.features.types.climate-preset-modes.style_list.icons",
  "editor.pie": "ui.panel.lovelace.editor.card.energy-devices-graph.mode_options.pie",
  "common.invalid_configuration": "ui.panel.lovelace.editor.condition-editor.visibility_status.invalid.headline",
  "editor.none": "ui.common.none",
  "editor.area": "ui.panel.lovelace.editor.card.area.name",
  "common.refresh": "ui.common.refresh",
  "common.close": "ui.common.close",
  "common.save": "ui.common.save",
  "common.title": "ui.panel.lovelace.editor.card.generic.title",
  "common.loading": "ui.init.loading",
  "editor.horizontal":
    "ui.panel.lovelace.editor.card.tile.content_layout_options.horizontal",
  "editor.vertical":
    "ui.panel.lovelace.editor.card.tile.content_layout_options.vertical",
  "signal.unknown": "state.default.unknown",
};
// These settings-panel translations may not be loaded on a dashboard.
// Keep local text only for these known gaps and card-specific wording.
const optionalNativeKeys: Record<string, string> = {
  "zigbee.type": "ui.panel.config.zha.visualization.device_type",
  "card.unassigned_area": "ui.panel.config.automation.editor.unassigned",
  "signal.medium": "ui.panel.config.matter.visualization.strength.medium",
  "common.version": "ui.panel.config.zwave_js.visualization.version",
  "card.empty": "ui.panel.config.zha.groups.no_devices_found",
  "card.unknown_device":
    "ui.panel.config.integrations.config_entry.unknown_via_device",
  "signal.connected": "ui.panel.config.serial.connected",
  "signal.online": "ui.panel.config.zha.configuration_page.status_online",
  "signal.offline": "ui.panel.config.zha.configuration_page.status_offline",
};
export function languageFor(hass?: TranslationContext): SupportedLanguage {
  const language = (
    hass?.locale?.language ||
    hass?.language ||
    (typeof document !== "undefined" ? document.documentElement.lang : "") ||
    "en-US"
  )
    .replace(/_/g, "-")
    .toLowerCase();
  if (language === "en-gb") return "en-GB";
  if (language === "de" || language.startsWith("de-")) return "de";
  if (language === "fr" || language.startsWith("fr-")) return "fr";
  return "en-US";
}
export function localize(
  key: string,
  hass?: TranslationContext,
  values: Record<string, string | number> = {},
): string {
  const language = languageFor(hass);
  let translated: string | undefined;
  const nativeKey = nativeKeys[key] || optionalNativeKeys[key];
  if (nativeKey) {
    const result = hass?.localize?.(nativeKey);
    if (result && result !== nativeKey) translated = result;
    if (nativeKeys[key]) return translated ?? "";
  }
  translated ||=
    languages[language][key] || enUS[key as keyof typeof enUS] || key;
  return translated.replace(/\{(\w+)\}/g, (token, name) =>
    String(values[name] ?? token),
  );
}
export function localizeCount(
  kind: "devices" | "connections",
  count: number,
  hass?: TranslationContext,
): string {
  const language = languageFor(hass);
  const plural =
    new Intl.PluralRules(language).select(count) === "one" ? "one" : "other";
  return localize(`card.${kind}_${plural}`, hass, {
    count: new Intl.NumberFormat(language).format(count),
  });
}
// Preserve the reported Wiser category; native translations only replace its wording,
// never reclassify quality (for example Poor must not become Offline).
export function localizeSignal(
  label: string,
  hass?: TranslationContext,
): string {
  if (!label) return localize("signal.connected", hass);
  const match = label.match(/^([a-z\s_-]+?)(\s*\([\d.,]+%\))?$/i);
  if (!match) return label;
  const key = (
    {
      connected: "connected",
      online: "online",
      offline: "offline",
      nosignal: "no_signal",
      verygood: "very_good",
      good: "good",
      poor: "poor",
      medium: "medium",
      unknown: "unknown",
    } as Record<string, string>
  )[match[1].replace(/[\s_-]/g, "").toLowerCase()];
  return key ? localize(`signal.${key}`, hass) + (match[2] || "") : label;
}

export function compactSignal(
  label: string,
  hass?: TranslationContext,
): string {
  const percent = label.match(/\(([\d.,]+)%\)\s*$/);
  if (!percent) return localizeSignal(label, hass);
  const value = Number(percent[1].replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 100)
    return localizeSignal(label, hass);
  return new Intl.NumberFormat(languageFor(hass), {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value / 100);
}

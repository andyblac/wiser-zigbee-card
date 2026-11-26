import type { HomeAssistant } from "custom-card-helpers";
import type { node } from "./types";

export function deviceBatteryLevel(
  device: node,
  hass?: HomeAssistant,
): number | undefined {
  const state = device.battery_entity_id
    ? hass?.states[device.battery_entity_id]
    : undefined;
  if (
    !state ||
    state.attributes.device_class !== "battery" ||
    state.attributes.unit_of_measurement !== "%" ||
    !state.state.trim()
  )
    return;
  const value = Number(state.state);
  return Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : undefined;
}

export function batteryIcon(level: number): string {
  if (level >= 95) return "mdi:battery";
  if (level < 10) return "mdi:battery-outline";
  return `mdi:battery-${Math.min(90, Math.round(level / 10) * 10)}`;
}

// Match Home Assistant's battery state colour thresholds and theme variables.
export function batteryColor(level: number): string {
  const band = level >= 70 ? "high" : level >= 30 ? "medium" : "low";
  return `var(--state-sensor-battery-${band}-color)`;
}

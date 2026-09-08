import type { HomeAssistant } from "custom-card-helpers";
import type { node as ZigbeeNode } from "./types";

interface RegistryEntity {
  entity_id: string;
  platform: string;
  device_id: string | null;
}
interface RegistryDevice {
  id: string;
  identifiers: [string, string][];
  via_device_id?: string | null;
}

// Node IDs belong to a hub, not the whole HA installation. Resolve against
// Wiser registry identifiers before opening an entity; never guess by name.
export async function deviceInfoEntity(
  hass: HomeAssistant,
  node: ZigbeeNode,
  configuredHub?: string,
): Promise<string | undefined> {
  const hub =
    configuredHub || (await hass.callWS<string[]>({ type: "wiser/hubs" }))[0];
  if (!hub) return undefined;
  const [entities, devices] = await Promise.all([
    hass.callWS<RegistryEntity[]>({ type: "config/entity_registry/list" }),
    hass.callWS<RegistryDevice[]>({ type: "config/device_registry/list" }),
  ]);
  const hubIds = new Set(
    devices
      .filter((device) =>
        device.identifiers.some(
          ([domain, identifier]) => domain === "wiser" && identifier === hub,
        ),
      )
      .map((device) => device.id),
  );
  const matches = entities.filter((entity) => {
    if (entity.platform !== "wiser" || !entity.entity_id.startsWith("sensor."))
      return false;
    const state = hass.states[entity.entity_id];
    const attrs = state?.attributes;
    if (
      !attrs ||
      attrs.node_id == null ||
      Number(attrs.node_id) !== node.id ||
      attrs.displayed_signal_strength === undefined
    )
      return false;
    if (node.group !== "Controller" && attrs.product_type !== node.group)
      return false;
    const device = devices.find((item) => item.id === entity.device_id);
    if (!device) return false;
    return (
      hubIds.has(device.id) ||
      (device.via_device_id != null && hubIds.has(device.via_device_id)) ||
      device.identifiers.some(
        ([domain, identifier]) =>
          domain === "wiser" && identifier.startsWith(`${hub} Wiser `),
      )
    );
  });
  return matches.length === 1 ? matches[0].entity_id : undefined;
}

// aioWiserHeatAPI defaults both fields to zero when a reception block is absent.
// Preserve an LQI of zero when accompanied by an actual RSSI reading.
export function receptionMetrics(
  rssi: unknown,
  lqi: unknown,
): { rssi?: number; lqi?: number } {
  const valid = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);
  if (rssi === 0 && lqi === 0) return {};
  return {
    rssi: valid(rssi) ? rssi : undefined,
    lqi: valid(lqi) ? lqi : undefined,
  };
}

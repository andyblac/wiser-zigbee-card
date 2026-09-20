import type { HomeAssistant } from "custom-card-helpers";
import type { zigbeeData } from "./types";

interface RegistryEntity {
  entity_id: string;
  platform: string;
  device_id: string | null;
  area_id?: string | null;
}

interface RegistryDevice {
  id: string;
  identifiers: [string, string][];
  via_device_id?: string | null;
  area_id?: string | null;
  name?: string;
  name_by_user?: string | null;
}

interface RegistryArea {
  area_id: string;
  name: string;
  icon?: string;
}

interface RegistryData {
  entities: RegistryEntity[];
  devices: RegistryDevice[];
  areas: RegistryArea[];
}

const REGISTRY_CACHE_MS = 60_000;
const registryCache = new WeakMap<
  object,
  {
    expires: number;
    value: Promise<RegistryData>;
  }
>();

function registries(hass: HomeAssistant): Promise<RegistryData> {
  const key = (hass.connection ?? hass) as object;
  const now = Date.now();
  const cached = registryCache.get(key);
  if (cached && cached.expires > now) return cached.value;
  const value = Promise.all([
    hass.callWS<RegistryEntity[]>({ type: "config/entity_registry/list" }),
    hass.callWS<RegistryDevice[]>({ type: "config/device_registry/list" }),
    hass.callWS<RegistryArea[]>({ type: "config/area_registry/list" }),
  ]).then(([entities, devices, areas]) => ({ entities, devices, areas }));
  registryCache.set(key, { expires: now + REGISTRY_CACHE_MS, value });
  value.catch(() => {
    if (registryCache.get(key)?.value === value) registryCache.delete(key);
  });
  return value;
}

export async function withDeviceAreas(
  hass: HomeAssistant,
  data: zigbeeData,
  hub?: string,
): Promise<zigbeeData> {
  const [{ entities, devices, areas }, hubs] = await Promise.all([
    registries(hass),
    hub
      ? Promise.resolve([hub])
      : hass.callWS<string[]>({ type: "wiser/hubs" }),
  ]);
  const selectedHub = hubs[0];
  const devicesById = new Map(devices.map((device) => [device.id, device]));
  const areasById = new Map(areas.map((area) => [area.area_id, area]));
  const hubIds = new Set(
    devices
      .filter((device) =>
        device.identifiers.some(
          ([domain, identifier]) =>
            domain === "wiser" && identifier === selectedHub,
        ),
      )
      .map((device) => device.id),
  );
  const nodesById = new Map(data.nodes.map((node) => [node.id, node]));
  const matches = new Map<number, RegistryEntity[]>();
  for (const entity of entities) {
    if (entity.platform !== "wiser" || !entity.entity_id.startsWith("sensor."))
      continue;
    const attrs = hass.states[entity.entity_id]?.attributes;
    const node =
      attrs?.node_id == null ? undefined : nodesById.get(Number(attrs.node_id));
    if (
      !node ||
      attrs.displayed_signal_strength === undefined ||
      (node.group !== "Controller" && attrs.product_type !== node.group)
    )
      continue;
    const device = entity.device_id
      ? devicesById.get(entity.device_id)
      : undefined;
    if (
      !device ||
      !(
        hubIds.has(device.id) ||
        (device.via_device_id != null && hubIds.has(device.via_device_id)) ||
        device.identifiers.some(
          ([domain, identifier]) =>
            domain === "wiser" &&
            identifier.startsWith(`${selectedHub} Wiser `),
        )
      )
    )
      continue;
    matches.set(node.id, [...(matches.get(node.id) ?? []), entity]);
  }
  return {
    ...data,
    nodes: data.nodes.map((node) => {
      const candidates = matches.get(node.id) ?? [];
      const entity = candidates.length === 1 ? candidates[0] : undefined;
      const device = entity?.device_id
        ? devicesById.get(entity.device_id)
        : undefined;
      const area = areasById.get(device?.area_id || entity?.area_id || "");
      return {
        ...node,
        area_id: area?.area_id,
        area_name: area?.name,
        area_icon: area?.icon,
        device_name: device?.name_by_user || device?.name,
      };
    }),
  };
}

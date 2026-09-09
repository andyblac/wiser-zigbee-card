import type { HomeAssistant } from "custom-card-helpers";
import type { zigbeeData } from "./types";
import { deviceInfoEntity } from "./device-info";

export async function withDeviceAreas(
  hass: HomeAssistant,
  data: zigbeeData,
  hub?: string,
): Promise<zigbeeData> {
  const [entities, devices, areas, hubs] = await Promise.all([
    hass.callWS<any[]>({ type: "config/entity_registry/list" }),
    hass.callWS<any[]>({ type: "config/device_registry/list" }),
    hass.callWS<any[]>({ type: "config/area_registry/list" }),
    hub
      ? Promise.resolve([hub])
      : hass.callWS<string[]>({ type: "wiser/hubs" }),
  ]);
  const registry: Record<string, unknown> = {
    "config/entity_registry/list": entities,
    "config/device_registry/list": devices,
    "wiser/hubs": hubs,
  };
  const cached = {
    ...hass,
    callWS: async (msg: { type: string }) => registry[msg.type],
  } as HomeAssistant;
  return {
    ...data,
    nodes: await Promise.all(
      data.nodes.map(async (node) => {
        const entityId = await deviceInfoEntity(cached, node, hubs[0]);
        const entity = entities.find((item) => item.entity_id === entityId);
        const device = devices.find((item) => item.id === entity?.device_id);
        const area = areas.find(
          (item) => item.area_id === (device?.area_id || entity?.area_id),
        );
        return {
          ...node,
          area_id: area?.area_id,
          area_name: area?.name,
          area_icon: area?.icon,
        };
      }),
    ),
  };
}

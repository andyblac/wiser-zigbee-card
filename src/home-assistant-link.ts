import type { zigbeeData } from "./types";

export const HOME_ASSISTANT_NODE_ID = Number.MIN_SAFE_INTEGER;

export const HOME_ASSISTANT_NODE_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 120 120"><g transform="matrix(.938408 0 0 .93841 -5.688557 -13.572944)"><path fill="#18bcf2" d="M73.5367 13.0937 106.463 46.0524v.0033C108.41 48.0043 110 51.848 110 54.6007v30.0292c0 2.7527-2.25 5.0049-5 5.0049l-70-.0034c-2.75 0-5-2.2522-5-5.0048V54.5974c0-2.7527 1.5933-6.5998 3.5367-8.545l32.93-32.9587c1.9433-1.9452 5.1266-1.9452 7.07 0Z" transform="matrix(1.598452 0 0 1.598452 -41.89164 -.937304)"/><g transform="matrix(1.598452 0 0 1.598452 -41.89164 -.937311)"><path d="m70 89.6348-20-20M70 89.6348v-52M90 58.1348l-20 20" fill="none" stroke="#f2f4f9" stroke-linecap="round" stroke-width="6"/><circle r="7" fill="#f2f4f9" transform="translate(50 69.634804)"/><circle r="7" fill="#f2f4f9" transform="translate(90 58.634798)"/><circle r="7" fill="#f2f4f9" transform="translate(70 37.6348)"/></g></g></svg>',
  );

export function withHomeAssistantLink(
  data: zigbeeData,
  label: string,
): zigbeeData {
  const controller = data.nodes.find((node) => node.group === "Controller");
  if (!controller || data.nodes.some((node) => node.group === "HomeAssistant"))
    return data;
  let id = HOME_ASSISTANT_NODE_ID;
  const used = new Set(data.nodes.map((node) => node.id));
  while (used.has(id)) id++;
  return {
    nodes: [
      ...data.nodes,
      {
        id,
        label,
        group: "HomeAssistant",
        entity_id: controller.entity_id,
        connection_label: controller.connection_label,
        x: 0,
        y: 0,
      },
    ],
    edges: [
      ...data.edges,
      {
        id: `home-assistant-${controller.id}`,
        from: controller.id,
        to: id,
        label: controller.connection_label || "Connected",
      },
    ],
  };
}

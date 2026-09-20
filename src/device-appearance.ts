import type { node, zigbeeData } from "./types";

export function disconnectedDevice(device: node, data: zigbeeData): boolean {
  if (device.group === "Controller" || device.group === "Area") return false;
  const links = data.edges.filter((edge) => edge.from === device.id);
  if (!links.length) return true;
  return links.every((edge) => {
    const status = edge.label
      .split("(")[0]
      .replace(/[\s_-]/g, "")
      .toLowerCase();
    return (
      ["nosignal", "offline", "disconnected", "noconnection"].includes(
        status,
      ) || !data.nodes.some((node) => node.id === edge.to)
    );
  });
}

const appearances = new Map<string, string>();
const escapeAttribute = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
// Colour only the product pixels, retaining shading and transparent backgrounds.
export function statusImage(
  source: string,
  color?: string,
  offline = false,
): string {
  if (!color && !offline) return source;
  const key = JSON.stringify([source, color, offline]);
  let image = appearances.get(key);
  if (!image) {
    const filter = color
      ? `<defs><filter id="status" color-interpolation-filters="sRGB"><feFlood flood-color="${escapeAttribute(color)}"/><feComposite in2="SourceGraphic" operator="in"/><feBlend in2="SourceGraphic" mode="multiply"/></filter></defs>`
      : "";
    image =
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">${filter}<image href="${escapeAttribute(source)}" width="160" height="160"${color ? ' filter="url(#status)"' : ""} opacity="${offline ? 0.3 : 1}"/></svg>`,
      );
    appearances.set(key, image);
  }
  return image;
}
export function ghostImage(source: string): string {
  return statusImage(source, undefined, true);
}

// The integration sends "device name\n(room name)"; "No Room" is a
// protocol placeholder, not a user-visible room or an HA area assignment.
// Passing an area name means the map already displays the room as a group, so
// use the device name and remove a redundant area prefix/suffix from it.
function labelParts(label: string): { name: string; room?: string } {
  const match = label.match(/^([\s\S]*?)\n\s*\(([\s\S]*)\)\s*$/);
  const name = (match ? match[1] : label.replace(/\n/g, " ")).trim();
  const room = match?.[2].trim();
  return { name, ...(!room || /^no room$/i.test(room) ? {} : { room }) };
}

function withoutAreaName(name: string, areaName: string): string {
  const area = areaName.trim();
  if (!area) return name;
  const escaped = area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const separators = "[\\s\\-_:|/()[\\]{}–—]";
  const withoutArea = name
    .replace(
      new RegExp(`(^|${separators})${escaped}(?=$|${separators})`, "gi"),
      "$1",
    )
    .replace(new RegExp(`^${separators}+|${separators}+$`, "g"), "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return withoutArea || name;
}

function deviceAreaName(device: node): string | undefined {
  return device.area_name?.trim() || labelParts(device.label).room;
}

function deviceDisplayName(device: node): string {
  const registryName = device.device_name?.trim();
  return registryName
    ? registryName.replace(/^wiser\s+/i, "").trim() || registryName
    : labelParts(device.label).name;
}

export function sharedAreaDeviceIds(nodes: node[]): Set<number> {
  const areas = new Map<number, string>();
  const counts = new Map<string, number>();
  for (const device of nodes) {
    if (device.group === "Controller" || device.group === "Area") continue;
    const area = device.area_id
      ? `id:${device.area_id}`
      : deviceAreaName(device)?.toLowerCase();
    if (!area) continue;
    areas.set(device.id, area);
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return new Set(
    [...areas]
      .filter(([, area]) => (counts.get(area) ?? 0) > 1)
      .map(([id]) => id),
  );
}

export function deviceMapLabel(
  label: string,
  areaName?: string,
  showDeviceAndRoom = false,
): string {
  const { name, room } = labelParts(label);
  if (areaName !== undefined) {
    return withoutAreaName(name, areaName);
  }
  if (showDeviceAndRoom && room)
    return `${withoutAreaName(name, room)}\n${room}`;
  return room ?? name;
}

export function areaDeviceMapLabel(device: node): string {
  const name = withoutAreaName(
    deviceDisplayName(device),
    deviceAreaName(device) ?? "",
  );
  return name.replace(/^wiser\s+/i, "").trim() || name;
}

export function deviceDetailsLabel(device: node): string {
  const name = areaDeviceMapLabel(device);
  const area = deviceAreaName(device);
  return area ? `${name} (${area})` : name;
}

export function ungroupedDeviceMapLabel(
  device: node,
  sharedArea: boolean,
): string {
  const area = deviceAreaName(device);
  if (!area) return deviceDisplayName(device);
  if (!sharedArea) return area;
  return `${withoutAreaName(deviceDisplayName(device), area)}\n${area}`;
}

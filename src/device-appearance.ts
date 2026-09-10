import type { node, zigbeeData } from "./types";

export function disconnectedDevice(device: node, data: zigbeeData): boolean {
  if (device.group === "Controller" || device.group === "Area") return false;
  const links = data.edges.filter((edge) => edge.from === device.id);
  if (!links.length) return true;
  return links.every((edge) => {
    const status = edge.label.split("(")[0].replace(/[\s_-]/g, "").toLowerCase();
    return ["nosignal", "offline", "disconnected", "noconnection"].includes(status) ||
      !data.nodes.some((node) => node.id === edge.to);
  });
}

const appearances = new Map<string, string>();
const escapeAttribute = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
// Colour only the product pixels, retaining shading and transparent backgrounds.
export function statusImage(source: string, color?: string, offline = false): string {
  if (!color && !offline) return source;
  const key = JSON.stringify([source, color, offline]);
  let image = appearances.get(key);
  if (!image) {
    const filter = color ? `<defs><filter id="status" color-interpolation-filters="sRGB"><feFlood flood-color="${escapeAttribute(color)}"/><feComposite in2="SourceGraphic" operator="in"/><feBlend in2="SourceGraphic" mode="multiply"/></filter></defs>` : "";
    image = "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">${filter}<image href="${escapeAttribute(source)}" width="160" height="160"${color ? ' filter="url(#status)"' : ""} opacity="${offline ? 0.3 : 1}"/></svg>`,
    );
    appearances.set(key, image);
  }
  return image;
}
export function ghostImage(source: string): string { return statusImage(source, undefined, true); }

// The integration sends "device name\n(room name)"; "No Room" is a
// protocol placeholder, not a user-visible room or an HA area assignment.
export function deviceMapLabel(label: string): string {
  const match = label.match(/^([\s\S]*?)\n\s*\(([\s\S]*)\)\s*$/);
  if (!match) return label.replace(/\n/g, " ").trim();
  const name = match[1].trim();
  const room = match[2].trim();
  return !room || /^no room$/i.test(room) ? name : room;
}

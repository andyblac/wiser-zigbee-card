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

const ghosts = new Map<string, string>();
// Fade only artwork: vis node opacity also fades its device label.
export function ghostImage(source: string): string {
  let image = ghosts.get(source);
  if (!image) {
    const safe = source.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    image = "data:image/svg+xml," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><image href="${safe}" width="160" height="160" opacity="0.3"/></svg>`,
    );
    ghosts.set(source, image);
  }
  return image;
}

// The integration sends "device name\n(room name)"; "No Room" is a
// protocol placeholder, not a user-visible room or an HA area assignment.
export function deviceMapLabel(label: string): string {
  const match = label.match(/^([\s\S]*?)\n\s*\(([\s\S]*)\)\s*$/);
  if (!match) return label.replace(/\n/g, " ").trim();
  const name = match[1].trim();
  const room = match[2].trim();
  return !room || /^no room$/i.test(room) ? name : room;
}

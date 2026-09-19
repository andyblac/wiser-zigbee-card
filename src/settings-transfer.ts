import { dump, load, JSON_SCHEMA } from "js-yaml";
type Settings = Record<string, any>;
const MAX_PASTE_LENGTH = 1024 * 1024;
const choices: Record<string, string[]> = {
  orientation: ["vertical", "horizontal", "pie"],
  group_by: ["none", "area"],
  link_status: ["links", "icons", "both", "none"],
};
const object = (value: any): value is Settings =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function validateSettings(value: unknown): Settings {
  if (!object(value)) throw new Error("Invalid layout");
  const result: Settings = {};
  for (const key of [
    "auto_update",
    "map_only",
    "show_device_list",
    "show_labels",
    "magnifier",
  ]) {
    if (!(key in value)) continue;
    if (typeof value[key] !== "boolean") throw new Error(`Invalid ${key}`);
    result[key] = value[key];
  }
  if ("name" in value) {
    if (typeof value.name !== "string") throw new Error("Invalid name");
    result.name = value.name;
  }
  if ("map_height" in value) {
    if (
      value.map_height !== null &&
      !(
        Number.isFinite(value.map_height) &&
        value.map_height >= 100 &&
        value.map_height <= 2000
      )
    )
      throw new Error("Invalid map height");
    result.map_height = value.map_height;
  }
  for (const [key, allowed] of Object.entries(choices)) {
    if (!(key in value)) continue;
    if (!allowed.includes(value[key])) throw new Error(`Invalid ${key}`);
    result[key] = value[key];
  }
  if (!object(value.layout_data)) throw new Error("Missing layout");
  result.layout_data = {};
  for (const [id, position] of Object.entries(value.layout_data)) {
    if (
      !/^-?\d+$/.test(id) ||
      !object(position) ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    )
      throw new Error("Invalid position");
    result.layout_data[id] = { x: position.x, y: position.y };
  }
  return result;
}

export function copySettings(config: Settings): string {
  return dump(validateSettings(config), {
    schema: JSON_SCHEMA,
    noRefs: true,
    lineWidth: -1,
    quotingType: '"',
  });
}

export function pasteSettings(text: string): Settings {
  if (text.length > MAX_PASTE_LENGTH) throw new Error("Text too large");
  const data = load(text, { schema: JSON_SCHEMA });
  // Hub identity and dashboard placement belong to the destination card.
  return validateSettings(data);
}

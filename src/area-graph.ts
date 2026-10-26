import type { zigbeeData } from "./types";

// Area markers label visual groups; every edge remains a real Zigbee link.
export function areaGraph(data: zigbeeData, unassigned: string): zigbeeData {
  const nodes = data.nodes.map((node) => ({ ...node }));
  const used = new Set(nodes.map((node) => node.id));
  const keys = [
    ...new Set(
      nodes
        .filter(
          (node) =>
            node.group !== "Controller" && node.group !== "HomeAssistant",
        )
        .map((node) => node.area_id ?? ""),
    ),
  ].sort();
  const edges = data.edges.map((edge) => ({ ...edge }));
  for (const key of keys) {
    const members = data.nodes.filter(
      (node) =>
        node.group !== "Controller" &&
        node.group !== "HomeAssistant" &&
        (node.area_id ?? "") === key,
    );
    let hash = 2166136261;
    for (const char of key || "__unassigned__")
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    let id = -(hash >>> 0) - 1;
    while (used.has(id)) id--;
    used.add(id);
    nodes.push({
      id,
      group: "Area",
      area_id: key,
      area_icon: members[0].area_icon || "mdi:floor-plan",
      label: members[0].area_name || unassigned,
      x: 0,
      y: 0,
    });
  }
  return { nodes, edges };
}

export function visibleAreaGraph(
  data: zigbeeData,
  collapsed: Set<string>,
): zigbeeData {
  const nodes = data.nodes.filter(
    (node) =>
      node.group === "Controller" ||
      node.group === "HomeAssistant" ||
      node.group === "Area" ||
      !collapsed.has(node.area_id ?? ""),
  );
  const ids = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    edges: data.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)),
  };
}

// The canvas retains the node hit target; HA renders its actual icon above it.
export const AREA_NODE_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"></svg>',
  );

// Numeric IDs remain for older layouts/readers. Name aliases survive a move to
// another HA installation, where the same area's registry ID may be different.
export function areaPositionKey(node: zigbeeData["nodes"][number]): string {
  return node.area_id
    ? `area:name:${encodeURIComponent(node.label)}`
    : "area:unassigned";
}

export function portablePositions(
  data: zigbeeData | undefined,
  positions: Record<string, { x: number; y: number }>,
): Record<string, { x: number; y: number }> {
  const result = { ...positions };
  const headers = data?.nodes.filter((node) => node.group === "Area") ?? [];
  for (const node of headers) {
    const key = areaPositionKey(node);
    // Do not guess if multiple areas share a name.
    if (
      headers.filter((other) => areaPositionKey(other) === key).length === 1 &&
      positions[node.id]
    )
      result[key] = { ...positions[node.id] };
  }
  return result;
}

export function restoredPosition(
  data: zigbeeData,
  node: zigbeeData["nodes"][number],
  saved: Record<string, { x: number; y: number }>,
): { x: number; y: number } | undefined {
  const valid = (p: any): p is { x: number; y: number } =>
    p && Number.isFinite(p.x) && Number.isFinite(p.y);
  if (node.group === "Area") {
    const key = areaPositionKey(node);
    const unique =
      data.nodes.filter(
        (other) => other.group === "Area" && areaPositionKey(other) === key,
      ).length === 1;
    if (unique && valid(saved[key])) return saved[key];
  }
  return valid(saved[node.id]) ? saved[node.id] : undefined;
}

import { arrangePie } from "./pie-layout";
import type { zigbeeData, NetworkOrientation } from "./types";

// Place each hop in its own column; disconnected devices remain visible.
export function arrangeNetwork(
  data: zigbeeData,
  orientation: NetworkOrientation = "horizontal",
  positions?: Record<string, { x: number; y: number }>,
  groupBy: "none" | "area" = "none",
): zigbeeData {
  const levels = new Map<number, number>();
  const roots = data.nodes.filter((node) => node.group === "Controller");
  const queue = (roots.length ? roots : data.nodes.slice(0, 1)).map(
    (node) => node.id,
  );
  queue.forEach((id) => levels.set(id, 0));
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    for (const edge of data.edges) {
      // Wiser edges point from the child device to its parent/repeater.
      const neighbour = edge.to === id ? edge.from : undefined;
      if (neighbour !== undefined && !levels.has(neighbour)) {
        levels.set(neighbour, levels.get(id)! + 1);
        queue.push(neighbour);
      }
    }
  }
  if (orientation === "pie") return arrangePie(data, groupBy === "area", levels, positions);
  const columns = new Map<number, typeof data.nodes>();
  const lastLevel = Math.max(0, ...levels.values()) + 1;
  for (const node of data.nodes) {
    if (node.group === "Area") continue;
    const level = levels.get(node.id) ?? lastLevel;
    columns.set(level, [...(columns.get(level) ?? []), node]);
  }
  const nodes: typeof data.nodes = [];
  for (const [level, column] of [...columns].sort(([a], [b]) => a - b)) {
    const axis = orientation === "vertical" ? "x" : "y";
    column.sort((a, b) => {
      const parentPosition = (id: number) => {
        const parent = data.edges.find((edge) => edge.from === id)?.to;
        return nodes.find((node) => node.id === parent)?.[axis] ?? 0;
      };
      const branch = parentPosition(a.id) - parentPosition(b.id);
      if (branch) return branch;
      const first = positions?.[a.id]?.[axis];
      const second = positions?.[b.id]?.[axis];
      if (Number.isFinite(first) && Number.isFinite(second) && first !== second)
        return first! - second!;
      return a.label.localeCompare(b.label);
    });
    column.forEach((node, index) => {
      let slot = index - (column.length - 1) / 2;
      nodes.push({
        ...node,
        x: orientation === "vertical" ? slot * (groupBy === "area" ? 230 : 170) : level * (groupBy === "area" ? 300 : 270),
        y: orientation === "vertical" ? level * (groupBy === "area" ? 300 : 150) : slot * (groupBy === "area" ? 260 : 110),
      });
    });
  }
  for (const header of data.nodes.filter((node) => node.group === "Area")) {
    const members = nodes.filter(
      (node) =>
        node.group !== "Controller" &&
        (node.area_id ?? "") === (header.area_id ?? ""),
    );
    nodes.push({
      ...header,
      x: members.length ? (Math.min(...members.map((node) => node.x)) + Math.max(...members.map((node) => node.x))) / 2 : 0,
      y: members.length ? Math.min(...members.map((node) => node.y)) - 110 : 0,
    });
  }
  return { nodes, edges: data.edges.map((edge) => ({ ...edge })) };
}

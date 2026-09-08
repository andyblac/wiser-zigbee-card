import type { zigbeeData, NetworkOrientation } from "./types";

// Place each hop in its own column; disconnected devices remain visible.
export function arrangeNetwork(
  data: zigbeeData,
  orientation: NetworkOrientation = "horizontal",
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
      const neighbour =
        edge.from === id ? edge.to : edge.to === id ? edge.from : undefined;
      if (neighbour !== undefined && !levels.has(neighbour)) {
        levels.set(neighbour, levels.get(id)! + 1);
        queue.push(neighbour);
      }
    }
  }
  const columns = new Map<number, typeof data.nodes>();
  const lastLevel = Math.max(0, ...levels.values()) + 1;
  for (const node of data.nodes) {
    const level = levels.get(node.id) ?? lastLevel;
    columns.set(level, [...(columns.get(level) ?? []), node]);
  }
  const nodes: typeof data.nodes = [];
  for (const [level, column] of columns) {
    column.sort((a, b) => a.label.localeCompare(b.label));
    column.forEach((node, index) =>
      nodes.push({
        ...node,
        x:
          orientation === "vertical"
            ? (index - (column.length - 1) / 2) * 170
            : level * 270,
        y:
          orientation === "vertical"
            ? level * 150
            : (index - (column.length - 1) / 2) * 110,
      }),
    );
  }
  return { nodes, edges: data.edges.map((edge) => ({ ...edge })) };
}

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
  const areaKeys = [
    ...new Set(
      data.nodes
        .filter((n) => n.group !== "Controller")
        .map((n) => n.area_id ?? ""),
    ),
  ].sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return (
      data.nodes.find((n) => n.area_id === a)?.area_name ?? a
    ).localeCompare(data.nodes.find((n) => n.area_id === b)?.area_name ?? b);
  });
  const areaOffsets = new Map<string, number>();
  let areaSpan = 0;
  for (const area of areaKeys) {
    const count = Math.max(
      1,
      ...[...columns.values()].map(
        (column) =>
          column.filter(
            (n) => n.group !== "Controller" && (n.area_id ?? "") === area,
          ).length,
      ),
    );
    areaOffsets.set(area, areaSpan);
    areaSpan += count + 1;
  }
  const nodes: typeof data.nodes = [];
  for (const [level, column] of columns) {
    const axis = orientation === "vertical" ? "x" : "y";
    column.sort((a, b) => {
      const first = positions?.[a.id]?.[axis];
      const second = positions?.[b.id]?.[axis];
      if (Number.isFinite(first) && Number.isFinite(second) && first !== second)
        return first! - second!;
      return a.label.localeCompare(b.label);
    });
    const areaIndices = new Map<string, number>();
    column.forEach((node, index) => {
      let slot = index - (column.length - 1) / 2;
      if (groupBy === "area") {
        const area = node.area_id ?? "";
        const indexInArea = areaIndices.get(area) ?? 0;
        slot =
          node.group === "Controller"
            ? 0
            : (areaOffsets.get(area) ?? 0) +
              indexInArea -
              Math.max(0, areaSpan - 2) / 2;
        if (node.group !== "Controller") areaIndices.set(area, indexInArea + 1);
      }
      nodes.push({
        ...node,
        x: orientation === "vertical" ? slot * 170 : level * 270,
        y: orientation === "vertical" ? level * 150 : slot * 110,
      });
    });
  }
  return { nodes, edges: data.edges.map((edge) => ({ ...edge })) };
}

import type { zigbeeData } from "./types";

// Recursively pack each repeater's children around that repeater. Areas are
// annotations only; they do not introduce parents or change the real routes.
export function arrangePie(data: zigbeeData, grouped: boolean,
  levels: Map<number, number>,
  positions?: Record<string, { x: number; y: number }>): zigbeeData {
  const devices = data.nodes.filter((node) => node.group !== "Area");
  const byId = new Map(devices.map((node) => [node.id, node]));
  const children = new Map<number, number[]>();
  const parents = new Map<number, number>();
  for (const node of devices) {
    const edge = data.edges.find((edge) => edge.from === node.id &&
      byId.has(edge.to) && levels.has(edge.to) && levels.has(node.id) &&
      levels.get(edge.to)! < levels.get(node.id)!);
    if (!edge) continue;
    parents.set(node.id, edge.to);
    children.set(edge.to, [...(children.get(edge.to) ?? []), node.id]);
  }
  const gap = grouped ? 40 : 30;
  const sizes = new Map<number, { radius: number; orbit: number }>();
  const measure = (id: number): { radius: number; orbit: number } => {
    const cached = sizes.get(id);
    if (cached) return cached;
    const descendants = children.get(id) ?? [];
    const own = Math.max(grouped ? 115 : 65,
      (byId.get(id)!.label.match(/\(([^)]+)\)/)?.[1] ?? byId.get(id)!.label).length * 4 + 30);
    const childRadius = Math.max(0, ...descendants.map((child) => measure(child).radius));
    const orbit = descendants.length ? Math.max(own + childRadius + gap,
      descendants.length > 1 ? (childRadius + gap / 2) / Math.sin(Math.PI / descendants.length) : 0) : 0;
    const size = { radius: orbit + (descendants.length ? childRadius : own), orbit };
    sizes.set(id, size);
    return size;
  };
  const nodes: typeof data.nodes = [];
  const place = (id: number, x: number, y: number, outward: number) => {
    nodes.push({ ...byId.get(id)!, x, y });
    const ordered = [...(children.get(id) ?? [])];
    const origin = positions?.[id];
    const angleOrder = (child: number) => {
      const p = positions?.[child];
      if (!p || !origin) return undefined;
      return ((Math.atan2(p.y - origin.y, p.x - origin.x) - outward) %
        (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    };
    ordered.sort((a, b) => {
      const repeaterFirst = Number(children.has(b)) - Number(children.has(a));
      if (repeaterFirst) return repeaterFirst;
      const first = angleOrder(a), second = angleOrder(b);
      return first !== undefined && second !== undefined && Math.abs(first - second) > 1e-6
        ? first - second : byId.get(a)!.label.localeCompare(byId.get(b)!.label);
    });
    ordered.forEach((child, index) => {
      const angle = outward + index * 2 * Math.PI / ordered.length;
      const distance = measure(id).orbit;
      place(child, x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, angle);
    });
  };
  const roots = devices.filter((node) => !parents.has(node.id)).sort((a, b) =>
    Number(b.group === "Controller") - Number(a.group === "Controller") || a.label.localeCompare(b.label));
  let right = 0;
  roots.forEach((root, index) => {
    const radius = measure(root.id).radius;
    const x = index ? right + radius + gap : 0;
    place(root.id, x, 0, 0);
    right = x + radius;
  });
  for (const header of data.nodes.filter((node) => node.group === "Area")) {
    const members = nodes.filter((node) => node.group !== "Controller" && (node.area_id ?? "") === (header.area_id ?? ""));
    nodes.push({ ...header,
      x: members.length ? (Math.min(...members.map((node) => node.x)) + Math.max(...members.map((node) => node.x))) / 2 : 0,
      y: members.length ? Math.min(...members.map((node) => node.y)) - 110 : 0 });
  }
  return { nodes, edges: data.edges.map((edge) => ({ ...edge })) };
}

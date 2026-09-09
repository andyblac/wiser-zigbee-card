import { deviceMapLabel } from "./device-appearance";
import { separateAreas } from "./area-spacing";
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
      deviceMapLabel(byId.get(id)!.label).length * 4 + 30);
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
  if (grouped) {
    // A same-area leaf directly linked to the hub belongs visually beside its
    // repeater sibling, not on the opposite side of their shared parent.
    for (const [parentId, siblings] of children) {
      const parent = nodes.find((node) => node.id === parentId)!;
      const bounds = (node: typeof nodes[number], x = node.x, y = node.y) => {
        const label = deviceMapLabel(node.label);
        const half = Math.max(40, label.length * 4.5 + 12);
        return { left: x - half, right: x + half, top: y - 42, bottom: y + 72 };
      };
      const overlaps = (a: ReturnType<typeof bounds>, b: ReturnType<typeof bounds>) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      for (const leafId of siblings.filter((id) => !children.has(id))) {
        const leaf = nodes.find((node) => node.id === leafId)!;
        // Unassigned devices are not assumed to share a physical room.
        if (!leaf.area_id) continue;
        const anchors = siblings.filter((id) => children.has(id) &&
          byId.get(id)!.area_id === leaf.area_id)
          .map((id) => nodes.find((node) => node.id === id)!)
          .sort((a, b) => Math.hypot(a.x - leaf.x, a.y - leaf.y) -
            Math.hypot(b.x - leaf.x, b.y - leaf.y));
        let placed = false;
        for (const anchor of anchors) {
          const angle = Math.atan2(anchor.y - parent.y, anchor.x - parent.x);
          const inwardStep = Math.max(150,
            (bounds(anchor).right - bounds(anchor).left + bounds(leaf).right - bounds(leaf).left) / 2 + 20);
          // Prefer close beside the repeater; outer area groups can be spaced
          // afterward rather than forcing this sensor far down the map.
          const offsets = [0, 1, 2, 3].map((column) => ({ inward: inwardStep + column * 90, side: 65 }));
          for (let row = 1; row < 5; row++)
            for (const column of [1, 0, 2]) offsets.push({ inward: inwardStep + column * 90, side: 65 + row * 130 });
          for (const offset of offsets) {
            if (placed) break;
            for (const side of [1, -1]) {
              const inward = offset.inward;
              const sideways = side * offset.side;
              const x = anchor.x - Math.cos(angle) * inward - Math.sin(angle) * sideways;
              const y = anchor.y - Math.sin(angle) * inward + Math.cos(angle) * sideways;
              const candidate = bounds(leaf, x, y);
              if (nodes.some((node) => node.id !== leaf.id &&
                (node.group === "Controller" || children.has(node.id) || node.area_id === leaf.area_id) &&
                overlaps(candidate, bounds(node)))) continue;
              // Do not stretch the shared area back across the parent/hub.
              const anchorBox = bounds(anchor);
              const area = { left: Math.min(candidate.left, anchorBox.left) - 18,
                right: Math.max(candidate.right, anchorBox.right) + 18,
                top: Math.min(candidate.top, anchorBox.top) - 110,
                bottom: Math.max(candidate.bottom, anchorBox.bottom) + 18 };
              if (overlaps(area, bounds(parent))) continue;
              leaf.x = x;
              leaf.y = y;
              placed = true;
              break;
            }
          }
          if (placed) break;
        }
      }
    }
  }
  for (const header of data.nodes.filter((node) => node.group === "Area")) {
    const members = nodes.filter((node) => node.group !== "Controller" && (node.area_id ?? "") === (header.area_id ?? ""));
    nodes.push({ ...header,
      x: members.length ? (Math.min(...members.map((node) => node.x)) + Math.max(...members.map((node) => node.x))) / 2 : 0,
      y: members.length ? Math.min(...members.map((node) => node.y)) - 110 : 0 });
  }
  if (grouped) separateAreas(nodes, new Set(children.keys()));
  return { nodes, edges: data.edges.map((edge) => ({ ...edge })) };
}

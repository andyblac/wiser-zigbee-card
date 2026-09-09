import type { node as MapNode } from "./types";

// A bounded tidy pass: move peripheral areas, keeping hubs/repeaters anchored.
type Box = { left: number; right: number; top: number; bottom: number };
export function separateAreas(nodes: MapNode[], repeaterIds: Set<number>,
  measuredBounds?: (members: MapNode[]) => Box,
): void {
  const groups = new Map<string, MapNode[]>();
  for (const node of nodes.filter((node) => node.group !== "Controller")) {
    const key = node.area_id ?? "";
    groups.set(key, [...(groups.get(key) ?? []), node]);
  }
  const boxes = (members: MapNode[]) => measuredBounds?.(members) ?? ({
    left: Math.min(...members.map((n) => n.x - Math.max(40, n.label.length * 4.5))) - 18,
    right: Math.max(...members.map((n) => n.x + Math.max(40, n.label.length * 4.5))) + 18,
    top: Math.min(...members.map((n) => n.y - 32)) - 18,
    bottom: Math.max(...members.map((n) => n.y + 60)) + 18,
  });
  const overlap = (a: ReturnType<typeof boxes>, b: ReturnType<typeof boxes>) =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const origins = new Map(nodes.map((node) => [node.id, { x: node.x, y: node.y }]));
  const entries = [...groups.values()];
  if (!nodes.length) return;
  const allBoxes = entries.map(boxes);
  if (!allBoxes.length) return;
  const needsPacking = allBoxes.some((box, i) => allBoxes.slice(i + 1).some((other) => overlap(box, other) > 0));
  const extent = { left: Math.min(...allBoxes.map((b) => b.left)),
    right: Math.max(...allBoxes.map((b) => b.right)),
    top: Math.min(...allBoxes.map((b) => b.top)),
    bottom: Math.max(...allBoxes.map((b) => b.bottom)) };
  const movementLimit = Math.max(480, Math.min(1200,
    Math.hypot(extent.right - extent.left, extent.bottom - extent.top)));
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (const members of entries) {
      if (members.some((node) => repeaterIds.has(node.id))) continue;
      const others = entries.filter((other) => other !== members).map(boxes);
      const box = boxes(members);
      const score = (candidate: typeof box) => others.reduce((sum, other) => sum + overlap(candidate, other), 0);
      const compactness = (candidate: Box) => {
        const combined = [...others, candidate];
        return (Math.max(...combined.map((b) => b.right)) - Math.min(...combined.map((b) => b.left))) *
          (Math.max(...combined.map((b) => b.bottom)) - Math.min(...combined.map((b) => b.top)));
      };
      let best = score(box);
      let bestCompactness = compactness(box);
      let move = { x: 0, y: 0 };
      for (const other of others.filter((other) => needsPacking || overlap(box, other) > 0)) {
        const candidates = [
          { x: other.left - box.right - 16, y: 0 },
          { x: other.right - box.left + 16, y: 0 },
          { x: 0, y: other.top - box.bottom - 16 },
          { x: 0, y: other.bottom - box.top + 16 },
          { x: other.right - box.left + 16, y: other.top - box.bottom - 16 },
          { x: other.left - box.right - 16, y: other.top - box.bottom - 16 },
          { x: other.right - box.left + 16, y: other.bottom - box.top + 16 },
          { x: other.left - box.right - 16, y: other.bottom - box.top + 16 },
        ].sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
        for (const candidate of candidates) {
          if (members.some((node) => Math.hypot(node.x + candidate.x - origins.get(node.id)!.x,
            node.y + candidate.y - origins.get(node.id)!.y) > movementLimit)) continue;
          const shifted = { left: box.left + candidate.x, right: box.right + candidate.x,
            top: box.top + candidate.y, bottom: box.bottom + candidate.y };
          if (nodes.some((node) => node.group === "Controller" && overlap(shifted, boxes([node])) > 0)) continue;
          const next = score(shifted);
          const compact = compactness(shifted);
          // Resolve overlaps first. Also allow a clear neighbour to move closer
          // when it reduces the overall footprint and frees a useful gap.
          if (next < best || (needsPacking && Math.abs(next - best) < 0.01 && compact < bestCompactness - 1)) {
            best = next;
            bestCompactness = compact;
            move = candidate;
          }
        }
      }
      if (move.x || move.y) {
        for (const node of members) { node.x += move.x; node.y += move.y; }
        changed = true;
      }
    }
    if (!changed) break;
  }
}

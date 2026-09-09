const assert = require("node:assert/strict");
const { separateAreas } = require("./load-ts.cjs")("src/area-spacing.ts");
const nodes = [
  { id: 0, group: "Controller", label: "Hub", x: -300, y: 0 },
  { id: 1, group: "SmartPlug", label: "Plug", area_id: "a", x: 0, y: 0 },
  { id: -1, group: "Area", label: "Area A", area_id: "a", x: 0, y: -110 },
  { id: 2, group: "RoomStat", label: "Stat", area_id: "b", x: 70, y: 0 },
  { id: -2, group: "Area", label: "Area B", area_id: "b", x: 70, y: -110 },
];
const original = structuredClone(nodes);
separateAreas(nodes, new Set([0, 1]));
assert.deepEqual(nodes.slice(0, 3), original.slice(0, 3), "Hub and repeater area stay anchored");
assert.ok(nodes[3].x >= 132, "Overlapping leaf area moves clear with a gap");
assert.equal(nodes[3].x - nodes[4].x, 0);
assert.equal(nodes[3].y - nodes[4].y, 110, "Area header and device move together");
assert.ok(Math.hypot(nodes[3].x - original[3].x, nodes[3].y - original[3].y) <= 240);
const settled = structuredClone(nodes);
separateAreas(nodes, new Set([0, 1]));
assert.deepEqual(nodes, settled, "Separated areas do not drift on another pass");
const locked = structuredClone(original);
separateAreas(locked, new Set([0, 1, 2]));
assert.deepEqual(locked, original, "Unavoidable repeater-area overlap is allowed");
console.log("Area spacing reduces overlap with bounded movement and stable anchors.");

const measuredNodes = [
  { id: 1, group: "SmartPlug", area_id: "a", label: "A", x: 0, y: 0 },
  { id: 2, group: "RoomStat", area_id: "b", label: "B", x: 200, y: 0 },
];
separateAreas(measuredNodes, new Set([1]), (members) => {
  const node = members[0];
  return { left: node.x - 140, right: node.x + 140, top: node.y - 60, bottom: node.y + 60 };
});
assert.ok(measuredNodes[1].x >= 296 || Math.abs(measuredNodes[1].y) >= 136,
  "Final measured boxes separate even when the estimates did not overlap");

const crowded = structuredClone(original);
crowded.push({ id: 3, group: "RoomStat", label: "Distant neighbour", area_id: "c", x: 600, y: 0 });
separateAreas(crowded, new Set([0, 1]));
assert.ok(crowded[5].x < 600,
  "A clear neighbouring area can move closer when packing a crowded map");
assert.deepEqual(crowded.slice(0, 3), original.slice(0, 3));

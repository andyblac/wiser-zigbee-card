const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");
const { areaGraph, visibleAreaGraph } = load("src/area-graph.ts");
const source = {
  nodes: [
    { id: 0, group: "Controller", label: "Hub" },
    {
      id: 1,
      group: "SmartPlug",
      label: "Plug",
      area_id: "k",
      area_name: "Kitchen",
      area_icon: "mdi:silverware-fork-knife",
    },
    {
      id: 2,
      group: "RoomStat",
      label: "Stat",
      area_id: "k",
      area_name: "Kitchen",
      area_icon: "mdi:silverware-fork-knife",
    },
    {
      id: 3,
      group: "RoomStat",
      label: "Office",
      area_id: "o",
      area_name: "Office",
    },
    { id: 4, group: "RoomStat", label: "Other" },
  ],
  edges: [
    { from: 1, to: 0, label: "Online" },
    { from: 2, to: 1, label: "90%" },
    { from: 3, to: 1, label: "80%" },
    { from: 4, to: 0, label: "75%" },
  ],
};
const original = structuredClone(source);
const full = areaGraph(source, "Unassigned");
const kitchen = full.nodes.find((n) => n.group === "Area" && n.area_id === "k");
assert.ok(kitchen && kitchen.id < 0);
assert.equal(kitchen.area_icon, "mdi:silverware-fork-knife");
assert.equal(
  full.nodes.find((n) => n.group === "Area" && !n.area_id).area_icon,
  "mdi:floor-plan",
);
assert.equal(full.nodes.filter((n) => n.group === "Area").length, 3);
assert.equal(full.edges.find((e) => e.from === 2).to, kitchen.id);
assert.equal(full.edges.find((e) => e.from === kitchen.id).to, 0);
const collapsed = visibleAreaGraph(full, new Set(["k"]));
assert.equal(
  collapsed.nodes.some((n) => n.id === 1 || n.id === 2),
  false,
);
assert.ok(collapsed.nodes.some((n) => n.id === kitchen.id));
assert.ok(collapsed.nodes.some((n) => n.id === 3));
assert.ok(
  collapsed.edges.every(
    (e) =>
      collapsed.nodes.some((n) => n.id === e.from) &&
      collapsed.nodes.some((n) => n.id === e.to),
  ),
);
assert.deepEqual(visibleAreaGraph(full, new Set()), full);
assert.deepEqual(
  source,
  original,
  "Source Zigbee routes remain intact for device info",
);
const changed = areaGraph(
  {
    ...source,
    nodes: [
      ...source.nodes,
      {
        id: 8,
        group: "RoomStat",
        label: "New",
        area_id: "a",
        area_name: "Added",
      },
    ],
  },
  "Unassigned",
);
assert.equal(
  changed.nodes.find((n) => n.group === "Area" && n.area_id === "k").id,
  kitchen.id,
  "Area IDs remain stable when another area appears",
);
console.log(
  "Area branches, collapse/expand, stable IDs and original routes passed.",
);

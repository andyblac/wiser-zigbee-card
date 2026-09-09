const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
const compiled = ts.transpileModule(readFileSync("src/layout.ts", "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2017,
  },
}).outputText;
const result = { exports: {} };
new Function("module", "exports", "require", compiled)(result, result.exports, () => require("./load-ts.cjs")("src/pie-layout.ts", { "./area-spacing": require("./load-ts.cjs")("src/area-spacing.ts") }));
const { arrangeNetwork } = result.exports;
const nodes = [0, 1, 2, 3, 4].map((id) => ({
  id,
  label: `Device ${id}`,
  group: id === 0 ? "Controller" : "RoomStat",
  x: 0,
  y: 0,
}));
const input = {
  nodes,
  edges: [
    { from: 1, to: 0 },
    { from: 2, to: 1 },
    { from: 3, to: 1 },
    { from: 2, to: 3 },
  ],
};
const output = arrangeNetwork(input);
assert.equal(
  new Set(output.nodes.map((n) => `${n.x},${n.y}`)).size,
  nodes.length,
);
assert.equal(output.nodes.find((n) => n.id === 0).x, 0);
assert.equal(output.nodes.find((n) => n.id === 2).x, 540);
assert.ok(
  output.nodes.find((n) => n.id === 4).x > 540,
  "Disconnected device stays visible",
);
assert.ok(
  input.nodes.every((n) => n.x === 0 && n.y === 0),
  "Does not mutate API data",
);
assert.deepEqual(arrangeNetwork({ nodes: [], edges: [] }), {
  nodes: [],
  edges: [],
});
assert.equal(
  arrangeNetwork({ nodes: nodes.slice(1), edges: input.edges }).nodes.length,
  4,
);
console.log(
  "Layout checks passed: hops, cycles, disconnected devices, unique positions, empty data and immutability.",
);
const vertical = arrangeNetwork(input, "vertical");
assert.deepEqual(
  arrangeNetwork(input, "horizontal"),
  output,
  "Horizontal remains the existing default",
);
assert.equal(
  vertical.nodes.find((n) => n.id === 2).y,
  300,
  "Vertical layout flows down through hops",
);
assert.equal(
  vertical.nodes.find((n) => n.id === 2).y,
  vertical.nodes.find((n) => n.id === 3).y,
  "Peers share a horizontal row",
);
assert.notEqual(
  vertical.nodes.find((n) => n.id === 2).x,
  vertical.nodes.find((n) => n.id === 3).x,
  "Peer icons do not overlap",
);
assert.equal(
  new Set(vertical.nodes.map((n) => `${n.x},${n.y}`)).size,
  nodes.length,
);
assert.deepEqual(
  vertical.edges,
  output.edges,
  "Changing views preserves connections",
);
console.log("Vertical and horizontal layouts passed.");

for (const orientation of ["horizontal", "vertical"]) {
  const axis = orientation === "vertical" ? "x" : "y";
  const dragged = {
    2: { x: 210, y: 180 },
    3: { x: -160, y: -150 },
  };
  const tidy = arrangeNetwork(input, orientation, dragged);
  const first = tidy.nodes.find((node) => node.id === 3);
  const second = tidy.nodes.find((node) => node.id === 2);
  assert.ok(first[axis] < second[axis], "Tidy retains dragged peer order");
  assert.equal(
    second[axis] - first[axis],
    orientation === "vertical" ? 170 : 110,
  );
  const again = arrangeNetwork(
    tidy,
    orientation,
    Object.fromEntries(
      tidy.nodes.map((node) => [node.id, { x: node.x, y: node.y }]),
    ),
  );
  assert.deepEqual(
    again,
    tidy,
    "Repeated tidy keeps the same order and spacing",
  );
}
console.log("Tidy preserves dragged order in both orientations.");

const groupedInput = {
  nodes: [
    { id: 0, group: "Controller", label: "Hub" },
    {
      id: 1,
      group: "SmartPlug",
      label: "Plug",
      area_id: "a",
      area_name: "Kitchen",
    },
    {
      id: 2,
      group: "RoomStat",
      label: "Z",
      area_id: "a",
      area_name: "Kitchen",
    },
    { id: 3, group: "RoomStat", label: "A", area_id: "b", area_name: "Office" },
    {
      id: 4,
      group: "RoomStat",
      label: "B",
      area_id: "a",
      area_name: "Kitchen",
    },
    { id: 5, group: "RoomStat", label: "Unassigned" },
  ],
  edges: [1, 2, 3, 4, 5].map((id) => ({ from: id, to: id === 1 ? 0 : 1 })),
};
for (const orientation of ["horizontal", "vertical"]) {
  const grouped = arrangeNetwork(groupedInput, orientation, undefined, "area");
  const axis = orientation === "vertical" ? "x" : "y";
  const pos = (id) => grouped.nodes.find((n) => n.id === id)[axis];
  const depth = orientation === "vertical" ? "y" : "x";
  const along = (id) => grouped.nodes.find((n) => n.id === id)[depth];
  assert.ok(along(0) < along(1) && along(1) < along(2), "Parent chain determines depth even within one area");
  assert.equal(along(2), along(3), "Same-hop devices share a level regardless of area");
  assert.deepEqual(
    grouped.edges,
    groupedInput.edges,
    "Grouping preserves real connections",
  );
}

for (const grouped of ["none", "area"]) {
  const pie = arrangeNetwork(groupedInput, "pie", undefined, grouped);
  assert.equal(pie.nodes.find((node) => node.id === 0).x, 0);
  assert.equal(pie.nodes.find((node) => node.id === 0).y, 0);
  assert.deepEqual(pie.edges, groupedInput.edges);
  assert.equal(new Set(pie.nodes.map((node) => `${node.x},${node.y}`)).size, pie.nodes.length);
  assert.deepEqual(arrangeNetwork(pie, "pie", Object.fromEntries(pie.nodes.map((node) => [node.id, node])), grouped), pie);
}
console.log("Pie layout keeps hub central, routes intact and repeated tidy stable.");

const withHeaders = { ...groupedInput, nodes: [...groupedInput.nodes,
  { id: -1, group: "Area", area_id: "a", label: "Kitchen" },
  { id: -2, group: "Area", area_id: "b", label: "Office" },
] };

const chain = { nodes: [
  { id: 0, group: "Controller", label: "Hub" },
  { id: 1, group: "SmartPlug", label: "Repeater 1", area_id: "a" },
  { id: 2, group: "SmartPlug", label: "Repeater 2", area_id: "a" },
  { id: 3, group: "RoomStat", label: "End device", area_id: "b" },
  { id: -1, group: "Area", label: "Area A", area_id: "a" },
  { id: -2, group: "Area", label: "Area B", area_id: "b" },
], edges: [{ from: 1, to: 0 }, { from: 2, to: 1 }, { from: 3, to: 2 }] };
for (const orientation of ["vertical", "horizontal", "pie"]) {
  for (const grouping of ["none", "area"]) {
    const result = arrangeNetwork(chain, orientation, undefined, grouping);
    const depth = (id) => {
      const node = result.nodes.find((node) => node.id === id);
      return orientation === "pie" ? Math.hypot(node.x, node.y) : node[orientation === "vertical" ? "y" : "x"];
    };
    assert.ok(depth(0) < depth(1) && depth(1) < depth(2) && depth(2) < depth(3),
      "Every repeater hop advances, including devices sharing an area");
    assert.deepEqual(result.edges, chain.edges, "Area grouping adds no artificial links");
  }
}
console.log("Multi-repeater chains preserved across every layout and grouping mode.");

const repeaterFan = {
  nodes: [0, 1, 2, 3, 4, 5].map((id) => ({ id, label: `Device ${id}`,
    group: id === 0 ? "Controller" : id === 1 ? "SmartPlug" : "RoomStat" })),
  edges: [1, 2, 3, 4, 5].map((id) => ({ from: id, to: id === 1 ? 0 : 1 })),
};
const fan = arrangeNetwork(repeaterFan, "pie");
const repeater = fan.nodes.find((node) => node.id === 1);
const fanChildren = fan.nodes.filter((node) => node.id > 1);
const radii = fanChildren.map((node) => Math.hypot(node.x - repeater.x, node.y - repeater.y));
assert.ok(radii.every((radius) => Math.abs(radius - radii[0]) < 1e-6));
assert.ok(Math.abs(fanChildren.reduce((sum, node) => sum + node.x, 0) / 4 - repeater.x) < 1e-6);
assert.ok(Math.abs(fanChildren.reduce((sum, node) => sum + node.y, 0) / 4 - repeater.y) < 1e-6);
assert.deepEqual(fan.edges, repeaterFan.edges);
console.log("Repeater is the centre of its own child circle.");

const rightStart = arrangeNetwork({ ...repeaterFan,
  nodes: [...repeaterFan.nodes, { id: 6, group: "RoomStat", label: "A direct sensor" }],
  edges: [...repeaterFan.edges, { from: 6, to: 0 }],
}, "pie");
const firstRepeater = rightStart.nodes.find((node) => node.id === 1);
assert.ok(firstRepeater.x > 0);
assert.equal(firstRepeater.y, 0, "First repeater starts directly right of the hub");

const kitchen = { nodes: [
  { id: 0, group: "Controller", label: "Hub" },
  { id: 1, group: "SmartPlug", label: "Kitchen plug", area_id: "k" },
  { id: 2, group: "RoomStat", label: "Kitchen sensor", area_id: "k" },
  { id: 3, group: "RoomStat", label: "Bedroom", area_id: "b" },
  { id: -1, group: "Area", label: "Kitchen", area_id: "k" },
], edges: [{ from: 1, to: 0 }, { from: 2, to: 0 }, { from: 3, to: 1 }] };
const kitchenPie = arrangeNetwork(kitchen, "pie", undefined, "area");
const kitchenNodes = kitchenPie.nodes.filter((node) => node.area_id === "k");
assert.ok(Math.min(...kitchenNodes.map((node) => node.x)) > 50,
  "Kitchen sensor joins the plug to the right, leaving the central hub outside their box");
assert.deepEqual(kitchenPie.edges, kitchen.edges, "Sensor still connects directly to hub");

const plugPosition = kitchenPie.nodes.find((node) => node.id === 1);
const sensorPosition = kitchenPie.nodes.find((node) => node.id === 2);
assert.ok(Math.hypot(plugPosition.x - sensorPosition.x, plugPosition.y - sensorPosition.y) < 180,
  "Same-area direct sensor stays close beside the repeater sibling");
assert.ok(sensorPosition.y > plugPosition.y, "First companion sits slightly below the repeater");

// Several repeaters, multiple direct sensors per area, a nested repeater,
// unassigned devices, and long room names: no household-specific identifiers.
const varied = { nodes: [{ id: 0, group: "Controller", label: "Hub" }], edges: [] };
let nextId = 1;
for (const area of ["east", "west", "upper"]) {
  const router = nextId++;
  varied.nodes.push({ id: router, group: "SmartPlug", label: `Router ${area}`, area_id: area });
  varied.edges.push({ from: router, to: 0 });
  for (let i = 0; i < 6; i++) {
    const id = nextId++;
    varied.nodes.push({ id, group: "RoomStat", label: i === 5 ? "Long name for a temperature sensor" : `Sensor ${area} ${i}`, area_id: area });
    varied.edges.push({ from: id, to: i < 3 ? 0 : router });
  }
}
varied.nodes.push({ id: nextId, group: "SmartPlug", label: "Nested repeater", area_id: "other" });
varied.edges.push({ from: nextId, to: 1 });
varied.nodes.push({ id: nextId + 1, group: "RoomStat", label: "Nested child", area_id: "other" });
varied.edges.push({ from: nextId + 1, to: nextId });
varied.nodes.push({ id: nextId + 2, group: "RoomStat", label: "Unassigned" });
varied.edges.push({ from: nextId + 2, to: 0 });
const variedOriginal = structuredClone(varied);
const variedPie = arrangeNetwork(varied, "pie", undefined, "area");
assert.deepEqual(varied, variedOriginal);
assert.deepEqual(variedPie.edges, varied.edges);
assert.ok(variedPie.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)));
for (let i = 0; i < variedPie.nodes.length; i++) {
  for (const other of variedPie.nodes.slice(i + 1)) {
    const node = variedPie.nodes[i];
    const halfWidth = (label) => Math.max(40, label.length * 4.5 + 12);
    assert.ok(Math.abs(node.x - other.x) >= halfWidth(node.label) + halfWidth(other.label) ||
      Math.abs(node.y - other.y) >= 114, `Devices ${node.id} and ${other.id} retain room for labels`);
  }
}
console.log("Varied multi-repeater network keeps labels separated and real links unchanged.");

assert.ok(Math.abs(sensorPosition.y - plugPosition.y) <= 65,
  "Companion sensor stays beside the repeater instead of stretching the area downward");

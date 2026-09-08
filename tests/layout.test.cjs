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
new Function("module", "exports", compiled)(result, result.exports);
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

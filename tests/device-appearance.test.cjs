const assert = require("node:assert/strict");
const { disconnectedDevice, ghostImage } = require("./load-ts.cjs")("src/device-appearance.ts");
const device = { id: 1, group: "RoomStat" };
const data = { nodes: [{ id: 0, group: "Controller" }, device], edges: [] };
assert.equal(disconnectedDevice(device, data), true);
for (const label of ["NoSignal", "NoSignal (0%)", "Offline", "No connection"]) {
  data.edges = [{ from: 1, to: 0, label }];
  assert.equal(disconnectedDevice(device, data), true);
}
for (const label of ["Online", "Poor (0%)", "Medium (40%)", "VeryGood (100%)", "Unknown"]) {
  data.edges = [{ from: 1, to: 0, label }];
  assert.equal(disconnectedDevice(device, data), false);
}
assert.equal(disconnectedDevice(data.nodes[0], data), false);
assert.equal(disconnectedDevice({ id: -1, group: "Area" }, data), false);
data.edges = [{ from: 1, to: 99, label: "Unknown" }];
assert.equal(disconnectedDevice(device, data), true);
const original = "data:image/png;base64,abc";
assert.ok(decodeURIComponent(ghostImage(original)).includes('opacity="0.3"'));
assert.equal(ghostImage(original), ghostImage(original));
console.log("Offline artwork detection distinguishes no connection from weak/unknown signals.");

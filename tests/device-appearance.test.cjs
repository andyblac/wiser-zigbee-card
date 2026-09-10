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

const { deviceMapLabel } = require("./load-ts.cjs")("src/device-appearance.ts");
assert.equal(deviceMapLabel("RoomStat-16\n(No Room)"), "RoomStat-16");
assert.equal(deviceMapLabel("Smart Plug\n( Kitchen )"), "Kitchen");
assert.equal(deviceMapLabel("Sensor\n()"), "Sensor");
assert.equal(deviceMapLabel("Temperature sensor (outside)"), "Temperature sensor (outside)");
assert.equal(deviceMapLabel("Thermostat (v2)\n(No Room)"), "Thermostat (v2)");

const { statusImage } = require("./load-ts.cjs")("src/device-appearance.ts");
assert.equal(statusImage(original), original);
const tinted = decodeURIComponent(statusImage(original, "#ff9800"));
assert.ok(tinted.includes('flood-color="#ff9800"'));
assert.ok(tinted.includes('mode="multiply"'));
assert.ok(tinted.includes('opacity="1"'));
assert.ok(decodeURIComponent(statusImage(original, "#db4437", true)).includes('opacity="0.3"'));

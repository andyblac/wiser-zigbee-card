const assert = require("node:assert/strict");
const { disconnectedDevice, ghostImage } = require("./load-ts.cjs")(
  "src/device-appearance.ts",
);
const device = { id: 1, group: "RoomStat" };
const data = { nodes: [{ id: 0, group: "Controller" }, device], edges: [] };
assert.equal(disconnectedDevice(device, data), true);
for (const label of ["NoSignal", "NoSignal (0%)", "Offline", "No connection"]) {
  data.edges = [{ from: 1, to: 0, label }];
  assert.equal(disconnectedDevice(device, data), true);
}
for (const label of [
  "Online",
  "Poor (0%)",
  "Medium (40%)",
  "VeryGood (100%)",
  "Unknown",
]) {
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
console.log(
  "Offline artwork detection distinguishes no connection from weak/unknown signals.",
);

const {
  areaDeviceMapLabel,
  deviceDetailsLabel,
  deviceMapLabel,
  sharedAreaDeviceIds,
  ungroupedDeviceMapLabel,
} = require("./load-ts.cjs")("src/device-appearance.ts");
assert.equal(deviceMapLabel("RoomStat-16\n(No Room)"), "RoomStat-16");
assert.equal(deviceMapLabel("Smart Plug\n( Kitchen )"), "Kitchen");
assert.equal(deviceMapLabel("Sensor\n()"), "Sensor");
assert.equal(
  deviceMapLabel("Temperature sensor (outside)"),
  "Temperature sensor (outside)",
);
assert.equal(deviceMapLabel("Thermostat (v2)\n(No Room)"), "Thermostat (v2)");
assert.equal(
  deviceMapLabel("Kitchen Thermostat\n(Kitchen)", "Kitchen"),
  "Thermostat",
);
assert.equal(
  deviceMapLabel("Smart Plug - Kitchen\n(Kitchen)", "kitchen"),
  "Smart Plug",
);
assert.equal(
  deviceMapLabel("Kitchenette Sensor\n(Kitchen)", "Kitchen"),
  "Kitchenette Sensor",
);
assert.equal(deviceMapLabel("Hall Sensor\n(Hall)", ""), "Hall Sensor");
assert.equal(
  deviceMapLabel("Kitchen Thermostat\n(Kitchen)", undefined, true),
  "Thermostat\nKitchen",
);
assert.equal(
  deviceMapLabel("Smart Plug\n(Kitchen)", undefined, true),
  "Smart Plug\nKitchen",
);
assert.equal(
  areaDeviceMapLabel({
    label: "RoomStat-16\n(Media Room)",
    device_name: "Wiser Thermostat",
    area_name: "Media Room",
  }),
  "Thermostat",
);
assert.equal(
  deviceDetailsLabel({
    label: "RoomStat-16\n(Office)",
    device_name: "Office Wiser Thermostat",
    area_name: "Office",
  }),
  "Thermostat (Office)",
);
assert.equal(
  areaDeviceMapLabel({
    label: "RoomStat-16\n(Office)",
    device_name: "Office Wiser Thermostat",
    area_name: "Office",
  }),
  "Thermostat",
);
assert.deepEqual(
  [
    ...sharedAreaDeviceIds([
      { id: 1, group: "RoomStat", label: "Kitchen Thermostat\n(Kitchen)" },
      { id: 2, group: "SmartPlug", label: "Smart Plug\n(kitchen)" },
      { id: 3, group: "RoomStat", label: "Hall Sensor\n(Hall)" },
    ]),
  ],
  [1, 2],
);
const ungrouped = [
  {
    id: 1,
    group: "RoomStat",
    label: "RoomStat-16\n(Media Room)",
    device_name: "Wiser Thermostat",
    area_id: "media_room",
    area_name: "Media Room",
  },
  {
    id: 2,
    group: "SmartPlug",
    label: "Smart Plug\n(Kitchen)",
    device_name: "Wiser Smart Plug",
    area_id: "kitchen",
    area_name: "Kitchen",
  },
  {
    id: 3,
    group: "TemperatureHumiditySensor",
    label: "Temperature Sensor\n(Kitchen)",
    device_name: "Wiser Temperature/Humidity Sensor",
    area_id: "kitchen",
    area_name: "Kitchen",
  },
];
const sharedAreas = sharedAreaDeviceIds(ungrouped);
assert.equal(
  ungroupedDeviceMapLabel(ungrouped[0], sharedAreas.has(1)),
  "Media Room",
);
assert.equal(
  ungroupedDeviceMapLabel(ungrouped[1], sharedAreas.has(2)),
  "Smart Plug\nKitchen",
);
assert.equal(
  ungroupedDeviceMapLabel(ungrouped[2], sharedAreas.has(3)),
  "Temperature/Humidity Sensor\nKitchen",
);

const { statusImage } = require("./load-ts.cjs")("src/device-appearance.ts");
assert.equal(statusImage(original), original);
const tinted = decodeURIComponent(statusImage(original, "#ff9800"));
assert.ok(tinted.includes('flood-color="#ff9800"'));
assert.ok(tinted.includes('mode="multiply"'));
assert.ok(tinted.includes('opacity="1"'));
assert.ok(
  decodeURIComponent(statusImage(original, "#db4437", true)).includes(
    'opacity="0.3"',
  ),
);

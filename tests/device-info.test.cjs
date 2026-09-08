const assert = require("node:assert/strict");
const { deviceInfoEntity } = require("./load-ts.cjs")("src/device-info.ts");
const node = { id: 12, group: "RoomStat" };
const attrs = {
  node_id: 12,
  product_type: "RoomStat",
  displayed_signal_strength: "Good",
  firmware: "1",
};
const entities = ["a", "b"].map((id) => ({
  entity_id: `sensor.${id}`,
  platform: "wiser",
  device_id: id,
}));
const devices = [
  { id: "hub-a", identifiers: [["wiser", "A"]] },
  { id: "a", identifiers: [], via_device_id: "hub-a" },
  { id: "b", identifiers: [["wiser", "B Wiser RoomStat Office"]] },
];
const hass = {
  states: {
    "sensor.a": { attributes: attrs },
    "sensor.b": { attributes: attrs },
  },
  callWS: async ({ type }) =>
    type === "wiser/hubs"
      ? ["A", "B"]
      : type === "config/entity_registry/list"
        ? entities
        : devices,
};
(async () => {
  assert.equal(await deviceInfoEntity(hass, node, "A"), "sensor.a");
  assert.equal(await deviceInfoEntity(hass, node, "B"), "sensor.b");
  assert.equal(await deviceInfoEntity(hass, node), "sensor.a");
  assert.equal(
    await deviceInfoEntity(hass, { ...node, id: 99 }, "A"),
    undefined,
  );
  assert.equal(
    await deviceInfoEntity(hass, { ...node, group: "SmartPlug" }, "A"),
    undefined,
  );
  assert.equal(
    await deviceInfoEntity({ ...hass, states: {} }, node, "A"),
    undefined,
  );
  entities.push({ ...entities[0], entity_id: "sensor.duplicate" });
  hass.states["sensor.duplicate"] = { attributes: attrs };
  assert.equal(await deviceInfoEntity(hass, node, "A"), undefined);
  console.log(
    "Device info resolves hub-specific sensors, legacy identifiers and missing/ambiguous matches safely.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const { receptionMetrics } = require("./load-ts.cjs")("src/device-info.ts");
assert.deepEqual(receptionMetrics(0, 0), {});
assert.deepEqual(receptionMetrics(-65, 0), { rssi: -65, lqi: 0 });
assert.deepEqual(receptionMetrics(-70, 180), { rssi: -70, lqi: 180 });
assert.deepEqual(receptionMetrics(null, undefined), {
  rssi: undefined,
  lqi: undefined,
});

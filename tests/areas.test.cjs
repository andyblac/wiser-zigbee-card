const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");
const { withDeviceAreas } = load("src/areas.ts", {
  "./device-info": load("src/device-info.ts"),
});
const entities = ["a", "b"].map((id) => ({
  entity_id: "sensor." + id,
  device_id: id,
  platform: "wiser",
}));
const devices = [
  { id: "hub-a", identifiers: [["wiser", "A"]] },
  { id: "hub-b", identifiers: [["wiser", "B"]] },
  { id: "a", via_device_id: "hub-a", identifiers: [], area_id: "kitchen" },
  { id: "b", via_device_id: "hub-b", identifiers: [], area_id: "office" },
];
let calls = 0;
const hass = {
  states: Object.fromEntries(
    ["a", "b"].map((id) => [
      "sensor." + id,
      {
        attributes: {
          node_id: 12,
          product_type: "RoomStat",
          displayed_signal_strength: "Good",
        },
      },
    ]),
  ),
  callWS: async ({ type }) => {
    calls++;
    return {
      "config/entity_registry/list": entities,
      "config/device_registry/list": devices,
      "config/area_registry/list": [
        {
          area_id: "kitchen",
          name: "Kitchen",
          icon: "mdi:silverware-fork-knife",
        },
        { area_id: "office", name: "Office" },
      ],
      "wiser/hubs": ["A", "B"],
    }[type];
  },
};
(async () => {
  const data = {
    nodes: [
      { id: 12, label: "Room", group: "RoomStat" },
      { id: 99, label: "Unknown", group: "RoomStat" },
    ],
    edges: [],
  };
  const a = await withDeviceAreas(hass, data, "A");
  assert.equal(a.nodes[0].area_id, "kitchen");
  assert.equal(a.nodes[0].area_icon, "mdi:silverware-fork-knife");
  assert.equal(a.nodes[1].area_id, undefined);
  assert.equal(data.nodes[0].area_id, undefined);
  assert.equal(calls, 3, "Registries fetched once, not per node");
  const b = await withDeviceAreas(hass, data, "B");
  assert.equal(
    b.nodes[0].area_id,
    "office",
    "Duplicate node IDs are scoped to their hub",
  );
  console.log("HA area assignment and hub isolation passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const test = require("node:test");
const assert = require("node:assert/strict");
const { HOME_ASSISTANT_NODE_ID, withHomeAssistantLink } =
  require("./load-ts.cjs")("src/home-assistant-link.ts");

test("optional Home Assistant node uses the hub Wi-Fi quality", () => {
  const source = {
    nodes: [
      {
        id: 0,
        group: "Controller",
        label: "Wiser Hub",
        entity_id: "sensor.wiser_hub_signal",
        connection_label: "VeryGood (92%)",
      },
      { id: 1, group: "RoomStat", label: "Thermostat" },
    ],
    edges: [{ id: "1-0", from: 1, to: 0, label: "Good (80%)" }],
  };
  const result = withHomeAssistantLink(source, "Home Assistant");
  const homeAssistant = result.nodes.find(
    (node) => node.group === "HomeAssistant",
  );
  assert.equal(homeAssistant.id, HOME_ASSISTANT_NODE_ID);
  assert.equal(homeAssistant.label, "Home Assistant");
  assert.equal(homeAssistant.entity_id, "sensor.wiser_hub_signal");
  assert.deepEqual(result.edges.at(-1), {
    id: "home-assistant-0",
    from: 0,
    to: HOME_ASSISTANT_NODE_ID,
    label: "VeryGood (92%)",
  });
  assert.equal(source.nodes.length, 2, "API data is not mutated");
  assert.equal(
    withHomeAssistantLink(result, "Home Assistant"),
    result,
    "The synthetic connection is not duplicated",
  );
});

test("missing Wi-Fi data produces a neutral connected link", () => {
  const result = withHomeAssistantLink(
    { nodes: [{ id: 0, group: "Controller", label: "Hub" }], edges: [] },
    "Home Assistant",
  );
  assert.equal(result.edges[0].label, "Connected");
});

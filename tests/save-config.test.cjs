const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");
const { saveCardConfig } = load("src/save-config.ts", {
  "./sanitize-config": load("src/sanitize-config.ts"),
  "./preserve-scroll": load("src/preserve-scroll.ts"),
});
(async () => {
  const card = { type: "custom:wiser-zigbee-card", show_labels: false, map_only: false };
  const duplicate = { ...card };
  const raw = { views: [{ sections: [{ cards: [{ type: "vertical-stack", cards: [card, duplicate] }] }] }] };
  let saved;
  const dashboard = { mode: "storage", rawConfig: raw, saveConfig: async (next) => { saved = next; } };
  const host = { getRootNode: () => ({ host: { lovelace: dashboard } }) };
  const result = await saveCardConfig(host, card, { show_labels: true, map_only: true });
  const cards = saved.views[0].sections[0].cards[0].cards;
  assert.equal(cards[0].show_labels, true);
  assert.equal(cards[0].map_only, true);
  assert.deepEqual(cards[1], duplicate);
  assert.equal(card.show_labels, false, "Do not mutate HA's live config before saving");
  assert.equal(result.map_only, true);
  await assert.rejects(saveCardConfig(host, { ...card }, { show_labels: true }), /uniquely/);
  dashboard.rawConfig = { views: [{ cards: [card] }] };
  await saveCardConfig(host, { ...card }, { show_labels: true });
  assert.equal(saved.views[0].cards[0].show_labels, true, "Unique copied configurations work");
  dashboard.mode = "yaml";
  await assert.rejects(saveCardConfig(host, card, {}), /not editable/);
  dashboard.mode = "storage";
  dashboard.saveConfig = async () => { throw new Error("Save failed"); };
  await assert.rejects(saveCardConfig(host, card, {}), /Save failed/);
  console.log("Dashboard save targets one card, including nested Sections, and preserves other cards.");
})().catch((error) => { console.error(error); process.exitCode = 1; });

(async () => {
  let received;
  const panel = { localName: "wiser-zigbee-panel", saveZigbeeCardConfig: async (card, config) => {
    received = { card, config };
    return config;
  } };
  const host = { getRootNode: () => ({ host: panel }) };
  const result = await saveCardConfig(host, { type: "custom:wiser-zigbee-card", hub: "first" }, { show_labels: true });
  assert.equal(received.card, host);
  assert.equal(result.show_labels, true);
  assert.equal(result.hub, "first");
})().catch((error) => { console.error(error); process.exitCode = 1; });

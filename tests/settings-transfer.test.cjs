const { test } = require("node:test");
const assert = require("node:assert/strict");
const { copySettings, pasteSettings } = require("./load-ts.cjs")(
  "src/settings-transfer.ts",
);
const layout = {
  name: "My map",
  auto_update: true,
  map_only: true,
  show_device_list: false,
  show_labels: true,
  magnifier: false,
  map_height: 500,
  link_status: "both",
  orientation: "pie",
  group_by: "area",
  layout_data: {
    1: { x: 12.5, y: -90 },
    "-123": { x: 40, y: 20 },
  },
};

test("clipboard YAML round-trips display settings and positions without hub identity", () => {
  const text = copySettings({
    ...layout,
    hub: "source",
    layout_id: "source",
    grid_options: { rows: 4 },
  });
  assert.deepEqual(pasteSettings(text), layout);
  const copied = { ...layout };
  copied.hub = "other-hub";
  copied.type = "other-card";
  copied.layout_id = "other";
  assert.deepEqual(pasteSettings(JSON.stringify(copied)), layout);
});

test("invalid clipboard text is rejected before applying any layout", () => {
  for (const text of [
    "not JSON",
    "null",
    "[]",
    "{}",
    "x".repeat(1024 * 1024 + 1),
  ])
    assert.throws(() => pasteSettings(text));
  for (const change of [
    { orientation: "diagonal" },
    { group_by: "floor" },
    { layout_data: [] },
    { map_height: "500" },
    { auto_update: "true" },
    { link_status: "bad" },
    { name: {} },
    { layout_data: { 1: { x: "10", y: 20 } } },
    { layout_data: { 1: { x: null, y: 20 } } },
    { layout_data: JSON.parse('{"__proto__":{"x":0,"y":0}}') },
  ])
    assert.throws(() =>
      pasteSettings(JSON.stringify({ ...layout, ...change })),
    );
  assert.throws(() =>
    copySettings({ ...layout, layout_data: { 1: { x: Infinity, y: 0 } } }),
  );
});

test("existing Copy YAML remains pasteable", () => {
  const text =
    'magnifier: false\nshow_labels: true\nmap_only: true\norientation: vertical\ngroup_by: none\nlayout_data:\n  "1":\n    x: 10\n    y: -20\n';
  const result = pasteSettings(text);
  assert.deepEqual(result.layout_data, { 1: { x: 10, y: -20 } });
  assert.equal(result.show_labels, true);
  assert.equal("name" in result, false);
});

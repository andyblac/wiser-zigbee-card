const { test } = require("node:test");
const assert = require("node:assert/strict");
const { copySettings, pasteSettings } = require("./load-ts.cjs")(
  "src/settings-transfer.ts",
);
const layout = {
  name: "My map",
  theme_mode: "dark",
  auto_update: true,
  map_only: true,
  show_device_list: false,
  show_home_assistant: true,
  show_labels: true,
  map_height: 500,
  link_status: "both",
  orientation: "pie",
  group_by: "area",
  layout_data: {
    1: { x: 12.5, y: -90 },
    "-123": { x: 40, y: 20 },
  },
  layout_view: { position: { x: -120, y: 45 }, scale: 0.42 },
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
    { theme_mode: "invalid" },
    { group_by: "floor" },
    { layout_data: [] },
    { map_height: "500" },
    { auto_update: "true" },
    { link_status: "bad" },
    { name: {} },
    { layout_data: { 1: { x: "10", y: 20 } } },
    { layout_data: { 1: { x: null, y: 20 } } },
    { layout_data: JSON.parse('{"__proto__":{"x":0,"y":0}}') },
    { layout_view: [] },
    { layout_view: { position: { x: "0", y: 0 }, scale: 1 } },
    { layout_view: { position: { x: 0, y: 0 }, scale: 0 } },
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
  assert.equal("magnifier" in result, false);
  assert.equal("name" in result, false);
});

test("JSON file export preserves complete transferable settings and precise positions", () => {
  const { exportSettings, importSettings } = require("./load-ts.cjs")(
    "src/settings-transfer.ts",
  );
  const original = {
    ...layout,
    layout_data: {
      ...layout.layout_data,
      "area:name:Kitchen": { x: -123.456789, y: 987.654321 },
    },
  };
  const text = exportSettings(original);
  assert.deepEqual(JSON.parse(text), original);
  const restored = importSettings(text);
  assert.deepEqual(restored, original);
  assert.equal(
    exportSettings(restored),
    text,
    "Immediate re-export is identical",
  );
  assert.throws(
    () => importSettings(text.slice(0, -5)),
    "Truncated JSON rejected",
  );
  assert.throws(
    () => importSettings("layout_data: {}"),
    "Files must contain JSON",
  );
});

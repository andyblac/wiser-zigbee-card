const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const events = [];
const registered = new Map();
global.customElements = {
  get: (name) => name === "ha-form" ? class {} : registered.get(name),
  define: (name, constructor) => {
    assert.ok(!registered.has(name), "Duplicate registration must be skipped");
    registered.set(name, constructor);
  },
};
const source = ts.transpileModule(fs.readFileSync("src/editor.ts", "utf8"), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2017,
    module: ts.ModuleKind.CommonJS,
    experimentalDecorators: true,
  },
}).outputText;
const output = { exports: {} };
const decorator = () => () => {};
const requireMock = (id) => {
  if (id === "./sanitize-config") return require("./load-ts.cjs")("src/sanitize-config.ts");
  if (id === "lit")
    return {
      LitElement: class {},
      html: (strings, ...values) => ({ strings, values }),
      css: () => {},
    };
  if (id === "lit/decorators.js")
    return { customElement: decorator, property: decorator, state: decorator };
  if (id === "custom-card-helpers")
    return {
      fireEvent: (target, type, detail) => events.push({ type, detail }),
    };
  if (id === "./const") return { CARD_VERSION: "test" };
  if (id === "./data/websockets") return { fetchHubs: async () => [] };
  if (id === "./native-ui") return { watchNativeElements: () => {} };
  if (id === "./localize/localize")
    return require("./load-ts.cjs")("src/localize/localize.ts");
  throw Error(id);
};
new Function("require", "exports", "module", source)(
  requireMock,
  output.exports,
  output,
);
const editor = new output.exports.WiserZigbeeCardEditor();
const layout = { 0: { x: 12, y: 34 } };
editor.setConfig({
  type: "custom:wiser-zigbee-card",
  hub: "one",
  layout_data: layout,
  layout_orientation: "horizontal",
  orientation: "horizontal",
});
editor.hass = {};
let template = editor.render();
function switchFields(template) {
  return template.values
    .filter(Array.isArray)
    .flat()
    .flatMap((row) => row?.values ?? [])
    .filter(Array.isArray)
    .flat()
    .filter((field) => field?.selector?.boolean);
}
const switches = switchFields(template);
assert.equal(switches.length, 5);
assert.ok(
  switches.every((field) => field.selector && "boolean" in field.selector),
  "All switches use native boolean selectors",
);
function change(value) {
  editor.valueChanged({ stopPropagation() {}, detail: { value } });
  return events.at(-1).detail.config;
}
assert.ok(template.values.some((value) => value?.show_detailed_view === true));
assert.equal(
  editor.computeLabel({ name: "show_detailed_view" }),
  "Show detailed view",
);
const mapOnly = change({ show_detailed_view: false });
assert.equal(mapOnly.map_only, true);
assert.equal("show_detailed_view" in mapOnly, false);
template = editor.render();
const disabled = switchFields(template);
assert.ok(
  disabled
    .filter((field) =>
      ["show_device_list"].includes(field.name),
    )
    .every((field) => field.disabled),
);
assert.equal(change({ show_device_list: false }).show_device_list, false);
assert.deepEqual(events.at(-1).detail.config.layout_data, layout);
editor.setOrientation("horizontal");
editor.setOrientation("vertical");
assert.equal(events.at(-1).detail.config.orientation, "vertical");
assert.deepEqual(events.at(-1).detail.config.layout_data, layout);
assert.equal(change({ hub: "two" }).layout_data, undefined);
assert.equal(change({ name: "" }).name, "");
assert.equal(
  editor.render().values.find((value) => value && value.name === "").name,
  "",
);
editor.setConfig({ type: "custom:wiser-zigbee-card" });
assert.ok(editor.render().values.some((value) => value?.orientation === "vertical"), "Default is vertical rows");
editor.hass = { language: "de" };
assert.ok(
  editor.render().values.some((value) => value?.name === "Zigbee-Netzwerk"),
);
assert.equal(change({ name: "Zigbee-Netzwerk", hub: "two" }).name, undefined);
editor.hass = { language: "fr" };
assert.ok(
  editor.render().values.some((value) => value?.name === "Réseau Zigbee"),
);
assert.equal(change({ name: "My network" }).name, "My network");
assert.equal(change({ name: "" }).name, "");
console.log("Native selector schema and configuration events passed.");

editor.setConfig({ type: "custom:wiser-zigbee-card" });
assert.ok(editor.render().values.some((value) => value?.map_height === null));
assert.equal(change({ map_height: 500 }).map_height, 500);

assert.equal(change({ show_detailed_view: true }).map_only, false);
assert.ok(
  editor.render().values.some((value) => value?.show_detailed_view === true),
);
editor.setConfig({ type: "custom:wiser-zigbee-card", map_only: true });
assert.ok(
  editor.render().values.some((value) => value?.show_detailed_view === false),
);
assert.equal(change({ map_height: 400 }).map_only, true);
assert.equal("show_detailed_view" in events.at(-1).detail.config, false);

const orientationSchema = editor
  .render()
  .values.filter(Array.isArray)
  .flat()
  .find((field) => field?.name === "orientation");
assert.deepEqual(
  orientationSchema.selector.button_toggle.options.map(
    (option) => option.value,
  ),
  ["horizontal", "vertical", "pie"],
  "Use HA's lazy-loaded button_toggle selector, never a dropdown",
);
assert.equal(change({ orientation: "vertical" }).orientation, "vertical");
assert.equal(change({ orientation: "horizontal" }).orientation, "horizontal");
assert.equal(change({ orientation: "pie" }).orientation, "pie");

// Clearing the native number selector must survive config serialization/reopening.
assert.equal(change({ map_height: undefined }).map_height, null);
editor.setConfig(JSON.parse(JSON.stringify(events.at(-1).detail.config)));
assert.ok(editor.render().values.some((value) => value?.map_height === null));
assert.equal(change({ show_detailed_view: false }).map_height, null);
assert.equal(change({ map_height: 340 }).map_height, 340);

function hubField() {
  return editor
    .render()
    .values.filter(Array.isArray)
    .flat()
    .find((field) => field?.name === "hub");
}
editor.setConfig({
  type: "custom:wiser-zigbee-card",
  layout_data: layout,
  layout_orientation: "horizontal",
  orientation: "horizontal",
});
editor._hubs = ["Hub A"];
assert.deepEqual(hubField().selector.select.options, ["Hub A"]);
assert.equal(hubField().required, true);
assert.equal(hubField().disabled, false);
assert.ok(editor.render().values.some((value) => value?.hub === "Hub A"));
assert.deepEqual(
  change({ hub: "Hub A", name: "Network" }).layout_data,
  layout,
  "Persisting the implicit first hub keeps its existing layout",
);
editor._hubs = ["Hub A", "Hub B"];
assert.deepEqual(hubField().selector.select.options, ["Hub A", "Hub B"]);
assert.equal(change({ hub: "Hub B" }).layout_data, undefined);
assert.equal(events.at(-1).detail.config.layout_orientation, undefined);
editor._hubs = [];
assert.deepEqual(
  hubField().selector.select.options,
  ["Hub B"],
  "Retain the configured hub when discovery is temporarily unavailable",
);
editor.setConfig({ type: "custom:wiser-zigbee-card" });
assert.equal(hubField().disabled, true);
console.log(
  "Native hub picker covers single/multiple hubs and preserves layout isolation.",
);

editor.setConfig({ type: "custom:wiser-zigbee-card", layout_data: layout });
const groupField = editor
  .render()
  .values.filter(Array.isArray)
  .flat()
  .find((field) => field?.name === "group_by");
assert.deepEqual(
  groupField.selector.button_toggle.options.map((option) => option.value),
  ["none", "area"],
);
assert.equal(change({ group_by: "area" }).layout_data, undefined);
assert.equal(change({ group_by: "none" }).group_by, "none");

const initialEditor = registered.get("wiser-zigbee-card-editor");
const reloaded = { exports: {} };
new Function("require", "exports", "module", source)(requireMock, reloaded.exports, reloaded);
assert.equal(registered.get("wiser-zigbee-card-editor"), initialEditor);
console.log("Loading the editor twice preserves its existing registration.");

editor.setConfig({ type: "custom:wiser-zigbee-card", orientation: "vertical", layout_data: layout });
editor.save_layout({ detail: { orientation: "vertical", show_labels: true, map_only: true, preferences_only: true } });
assert.equal(events.at(-1).detail.config.show_labels, true);
assert.equal(events.at(-1).detail.config.map_only, true);
assert.deepEqual(events.at(-1).detail.config.layout_data, layout);
editor.save_layout({ detail: { orientation: "vertical", show_labels: false, map_only: false, preferences_only: true } });
assert.equal(events.at(-1).detail.config.show_labels, false);
assert.equal(events.at(-1).detail.config.map_only, false);

editor.setConfig({ type: "custom:wiser-zigbee-card" });
const statusField = editor.render().values.filter(Array.isArray).flat()
  .find((field) => field?.name === "link_status");
assert.deepEqual(statusField.selector.button_toggle.options.map((option) => option.value),
  ["links", "icons", "both", "none"]);
assert.ok(editor.render().values.some((value) => value?.link_status === "links"));
for (const mode of ["links", "icons", "both", "none"]) {
  assert.equal(change({ link_status: mode }).link_status, mode);
}
editor.setConfig({
  type: "custom:wiser-zigbee-card", orientation: "vertical",
  layout_orientation: "vertical", group_by: "area", layout_group_by: "area", layout_data: layout,
});
const cleaned = change({ show_labels: true });
assert.equal("layout_orientation" in cleaned, false);
assert.equal("layout_group_by" in cleaned, false);
assert.deepEqual(cleaned.layout_data, layout);
assert.equal(change({ orientation: "pie" }).layout_data, undefined);
editor.setConfig({ type: "custom:wiser-zigbee-card" });
assert.equal(change({ magnifier: true }).magnifier, true);
editor.save_layout({ detail: { orientation: "vertical", magnifier: false, preferences_only: true } });
assert.equal(events.at(-1).detail.config.magnifier, false);

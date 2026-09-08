const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const events = [];
global.customElements = { get: () => class {} };
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
});
editor.hass = {};
let template = editor.render();
const switches = template.values.find(
  (value) => Array.isArray(value) && value[0]?.name === "auto_update",
);
assert.equal(switches.length, 4);
assert.ok(
  switches.every((field) => field.selector && "boolean" in field.selector),
  "All switches use native boolean selectors",
);
function change(value) {
  editor.valueChanged({ stopPropagation() {}, detail: { value } });
  return events.at(-1).detail.config;
}
assert.equal(change({ map_only: true }).map_only, true);
template = editor.render();
const disabled = template.values.find(
  (value) => Array.isArray(value) && value[0]?.name === "auto_update",
);
assert.ok(
  disabled
    .filter((field) => field.name.startsWith("show_"))
    .every((field) => field.disabled),
);
assert.equal(change({ show_device_list: false }).show_device_list, false);
assert.deepEqual(events.at(-1).detail.config.layout_data, layout);
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
assert.ok(editor.render().values.some((value) => value?.map_height === 340));
assert.equal(change({ map_height: 500 }).map_height, 500);

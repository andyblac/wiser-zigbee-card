const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");
const { ensureNativeTextarea } = load("src/native-ui.ts", {
  lit: { html() {} }, "lit/directives/if-defined.js": {},
});
(async () => {
  let registered = false, resolve, loads = 0, removed = 0;
  global.customElements = {
    get: () => registered,
    whenDefined: () => new Promise((done) => { resolve = done; }),
  };
  const editor = { setConfig(config) { assert.equal(config.type, "button"); }, remove() { removed++; } };
  global.window = { loadCardHelpers: async () => {
    loads++;
    return { createCardElement: () => ({ constructor: { getConfigElement: async () => editor } }) };
  } };
  const host = { shadowRoot: { appendChild(node) {
    assert.equal(node, editor);
    assert.equal(node.hidden,true);
    assert.deepEqual(node.hass, { language: "en" });
    queueMicrotask(() => { registered = true; resolve(); });
  } } };
  await ensureNativeTextarea(host, { language: "en" });
  assert.equal(loads,1);
  assert.equal(removed,1);
  await ensureNativeTextarea(host, {});
  assert.equal(loads,1,"Already-loaded HA control needs no bootstrap");
  registered = false;
  editor.setConfig = () => { throw Error("Load failed"); };
  await assert.rejects(ensureNativeTextarea(host, {}), /Load failed/);
  assert.equal(removed,2,"Temporary editor is removed on failure");
  console.log("Native YAML output loads on a fresh dashboard and cleans up its temporary editor.");
})().catch((error) => { console.error(error); process.exitCode = 1; });

const assert = require("node:assert/strict");
const { copyText } = require("./load-ts.cjs")("src/copy-text.ts");
(async () => {
  let copied, removed = 0, restored = 0;
  Object.defineProperty(global, "navigator", { configurable: true, value: {
    clipboard: { writeText: async (text) => { copied = text; } },
  } });
  await copyText("layout_data:\n  1: {}");
  assert.equal(copied, "layout_data:\n  1: {}");
  const field = { style: {}, focus() {}, select() {}, remove() { removed++; } };
  global.document = {
    createElement: () => field,
    body: { appendChild() {} },
    activeElement: { focus(options) { assert.equal(options.preventScroll,true); restored++; } },
    execCommand(command) { assert.equal(command,"copy"); return true; },
  };
  navigator.clipboard = undefined;
  await copyText("fallback YAML");
  assert.equal(field.value,"fallback YAML");
  assert.equal(removed,1);
  assert.equal(restored,1);
  document.execCommand = () => false;
  await assert.rejects(copyText("failed"), /Clipboard copy failed/);
  assert.equal(removed,2);
  assert.equal(restored,2);
  console.log("Clipboard copy supports async API and local HTTP fallback, with failure reporting and focus restoration.");
})().catch((error) => { console.error(error); process.exitCode = 1; });

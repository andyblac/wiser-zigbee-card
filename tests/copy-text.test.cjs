const assert = require("node:assert/strict");
const { copyText, readCopiedText } = require("./load-ts.cjs")("src/copy-text.ts");
(async () => {
  const storage = new Map();
  global.sessionStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  };
  let copied, removed = 0, restored = 0;
  Object.defineProperty(global, "navigator", { configurable: true, value: {
    clipboard: { writeText: async (text) => { copied = text; } },
  } });
  await copyText("layout_data:\n  1: {}");
  assert.equal(copied, "layout_data:\n  1: {}");
  navigator.clipboard.readText = async () => { throw Error("Read denied"); };
  assert.equal(await readCopiedText(), copied, "Copy remains pasteable when browser denies clipboard reads");
  const panelClipboard = require("./load-ts.cjs")("src/copy-text.ts");
  assert.equal(await panelClipboard.readCopiedText(), copied, "A separately loaded panel shares the tab's copied settings");
  navigator.clipboard.readText = async () => "new external clipboard";
  assert.equal(await readCopiedText(), "new external clipboard", "Accessible system clipboard takes priority");
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
  assert.equal(await readCopiedText(), "fallback YAML", "HTTP fallback copy is shared with Paste");
  await panelClipboard.copyText("panel copy");
  document.execCommand = () => false;
  await assert.rejects(copyText("failed"), /Clipboard copy failed/);
  assert.equal(removed,3);
  assert.equal(restored,3);
  await assert.rejects(readCopiedText(), "Failed copy must not leave stale settings for Paste");
  await assert.rejects(panelClipboard.readCopiedText(), "Failed copy also clears the shared stored copy");
  document.execCommand = () => true;
  sessionStorage.setItem = () => { throw Error("Storage blocked"); };
  sessionStorage.getItem = () => { throw Error("Storage blocked"); };
  sessionStorage.removeItem = () => { throw Error("Storage blocked"); };
  await copyText("memory-only copy");
  assert.equal(await readCopiedText(), "memory-only copy", "Blocked storage retains same-page transfers");
  console.log("Clipboard copy supports async API and local HTTP fallback, with failure reporting and focus restoration.");
})().catch((error) => { console.error(error); process.exitCode = 1; });

const assert = require("node:assert/strict");
const { signalColor } = require("./load-ts.cjs")("src/signal-color.ts");
const theme = { getPropertyValue: (name) => name };
for (const [label, token] of Object.entries({
  "VeryGood (86%)": "success",
  Good: "success",
  Medium: "yellow",
  Poor: "orange",
  NoSignal: "error",
  Online: "yellow",
  "Unknown (100%)": "error",
  Offline: "error",
  "Very low": "orange",
  "Low quality": "orange",
})) {
  assert.equal(signalColor(label, true, theme), `--${token}-color`);
  assert.equal(signalColor(label, false, theme), "--secondary-text-color");
}
console.log("Signal category colours passed");

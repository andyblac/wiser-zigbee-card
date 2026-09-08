const assert = require("node:assert/strict");
const { containedView } = require("./load-ts.cjs")("src/fit.ts");
for (const [width, height, bounds] of [
  [400, 600, { left: -500, right: 500, top: -100, bottom: 100 }],
  [600, 340, { left: -100, right: 100, top: -500, bottom: 500 }],
  [300, 300, { left: 20, right: 220, top: 100, bottom: 300 }],
]) {
  const view = containedView([bounds], width, height);
  assert.ok((bounds.right - bounds.left) * view.scale <= width - 16 + 1e-9);
  assert.ok((bounds.bottom - bounds.top) * view.scale <= height - 16 + 1e-9);
  assert.ok(
    Math.abs((bounds.right - bounds.left) * view.scale - (width - 16)) < 1e-9 ||
      Math.abs((bounds.bottom - bounds.top) * view.scale - (height - 16)) <
        1e-9,
    "Use all available space in the limiting dimension",
  );
  assert.deepEqual(view.position, {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  });
}
assert.equal(containedView([], 400, 340), undefined);
assert.equal(
  containedView([{ left: 0, right: 100, top: 0, bottom: 100 }], 0, 340),
  undefined,
);
console.log(
  "Wide, tall and square networks fit within both dimensions with padding.",
);

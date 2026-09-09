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

const offCentre = { left: -700, right: 350, top: -900, bottom: 450 };
const radial = containedView([offCentre], 600, 900);
assert.deepEqual(radial.position, { x: -175, y: -225 },
  "Asymmetric Pie map is centred by all its bounds, not the hub");
for (const x of [offCentre.left, offCentre.right]) assert.ok(Math.abs(x - radial.position.x) * radial.scale <= 292);
for (const y of [offCentre.top, offCentre.bottom]) assert.ok(Math.abs(y - radial.position.y) * radial.scale <= 442);

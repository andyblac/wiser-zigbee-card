const assert = require("node:assert/strict");
const { placeLinkLabels, overlaps } =
  require("./load-ts.cjs")("src/link-labels.ts");
const labels = [70, 210, 350, 490, 630].map((x, i) => ({
  id: String(i),
  text: "92%",
  width: 28,
  from: { x, y: 350 },
  to: { x: 350, y: 90 },
}));
const obstacles = [
  { left: 320, right: 380, top: 60, bottom: 125 },
  ...labels.map((l) => ({
    left: l.from.x - 30,
    right: l.from.x + 30,
    top: 320,
    bottom: 385,
  })),
];
for (const vertical of [true, false]) {
  const placed = placeLinkLabels(labels, obstacles, 700, 400, vertical);
  assert.equal(placed.length, 5);
  for (const [i, label] of placed.entries()) {
    assert.ok(
      label.left >= 4 &&
        label.right <= 696 &&
        label.top >= 4 &&
        label.bottom <= 396,
    );
    for (const other of [...obstacles, ...placed.slice(i + 1)])
      assert.equal(overlaps(label, other), false);
  }
}
assert.deepEqual(
  placeLinkLabels(
    labels,
    [{ left: 0, right: 700, top: 0, bottom: 400 }],
    700,
    400,
    true,
  ),
  [],
);
const { compactSignal, localizeSignal } = require("./load-ts.cjs")(
  "src/localize/localize.ts",
);
assert.equal(compactSignal("Very Good (92%)", { language: "en-GB" }), "92%");
assert.equal(
  localizeSignal("Very Good (92%)", { language: "en-GB" }),
  "Very good (92%)",
);
console.log(
  "Five crowded links avoid each other and device bounds; blocked space never draws overlapping labels.",
);
for (const vertical of [true, false]) {
  const [label] = placeLinkLabels([{
    id: "middle", text: "92%", width: 30,
    from: { x: 100, y: 100 }, to: { x: 500, y: 300 },
  }], [], 700, 400, vertical);
  assert.deepEqual(label.center, { x: 300, y: 200 });
  assert.deepEqual(label.anchor, label.center);
}

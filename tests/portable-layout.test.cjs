const { test } = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");
const { areaGraph, portablePositions, restoredPosition, areaPositionKey } =
  load("src/area-graph.ts");
const { copySettings, pasteSettings } = load("src/settings-transfer.ts");
const graph = (area) =>
  areaGraph(
    {
      nodes: [
        { id: 1, group: "Controller", label: "Hub", x: 0, y: 0 },
        {
          id: 2,
          group: "Sensor",
          label: "Kitchen",
          area_id: area,
          area_name: "Kitchen / Dining",
          x: 0,
          y: 0,
        },
      ],
      edges: [{ id: "link", from: 2, to: 1, label: "100%" }],
    },
    "Unassigned",
  );

test("grouped copy/paste restores devices and area header across HA area IDs", () => {
  const production = graph("prod-kitchen");
  const development = graph("dev-kitchen");
  const header = production.nodes.find((n) => n.group === "Area");
  const destination = development.nodes.find((n) => n.group === "Area");
  assert.notEqual(header.id, destination.id);
  const positions = {
    1: { x: 3, y: 9 },
    2: { x: 55, y: 130 },
    [header.id]: { x: 17, y: -40 },
  };
  const saved = portablePositions(production, positions);
  const imported = pasteSettings(
    copySettings({
      layout_data: saved,
      orientation: "vertical",
      group_by: "area",
    }),
  ).layout_data;
  assert.deepEqual(
    restoredPosition(development, destination, imported),
    positions[header.id],
  );
  for (const node of development.nodes.filter((n) => n.group !== "Area"))
    assert.deepEqual(
      restoredPosition(development, node, imported),
      positions[node.id],
    );
  assert.deepEqual(
    imported[header.id],
    positions[header.id],
    "retain legacy numeric coordinates",
  );
});

test("legacy numeric layouts and invalid portable coordinates fall back safely", () => {
  const data = graph("same");
  const header = data.nodes.find((n) => n.group === "Area");
  const saved = { [header.id]: { x: 7, y: 11 } };
  assert.deepEqual(restoredPosition(data, header, saved), saved[header.id]);
  saved[areaPositionKey(header)] = { x: NaN, y: 3 };
  assert.deepEqual(restoredPosition(data, header, saved), saved[header.id]);
});

test("unassigned identity does not depend on translated label", () => {
  const a = graph("");
  const b = graph("");
  const header = a.nodes.find((n) => n.group === "Area");
  const target = b.nodes.find((n) => n.group === "Area");
  target.label = "Nicht zugewiesen";
  const saved = portablePositions(a, { [header.id]: { x: 8, y: -4 } });
  assert.deepEqual(restoredPosition(b, target, saved), { x: 8, y: -4 });
});

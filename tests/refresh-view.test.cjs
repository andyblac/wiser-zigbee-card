const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");
global.window = { matchMedia: () => ({ matches: true }) };
global.location = { pathname: "/test" };
global.localStorage = { getItem: () => null };
global.getComputedStyle = () => ({ getPropertyValue: () => "#ffffff" });
let resolveFetch;
const infoEvents = [];
const decorator = () => () => {};
const { WiserZigbeeCard } = load("src/wiser-zigbee-card.ts", {
  lit: {
    LitElement: class {
      updated() {}
      isConnected = true;
      updateComplete = Promise.resolve();
    },
    html: () => {},
    css: () => {},
  },
  "lit/directives/if-defined.js": { ifDefined: (value) => value },
  "lit/decorators.js": { customElement: decorator, state: decorator },
  "custom-card-helpers": {
    fireEvent: (_, type, detail) => infoEvents.push({ type, detail }),
  },
  "vis-network": {},
  "./is-preview": {},
  "./device-images": { DEVICE_IMAGES: {}, FALLBACK_DEVICE_IMAGE: "" },
  "./const": { OPTIONS: {} },
  "./layout": { arrangeNetwork: (data) => data },
  "./data/websockets": {
    fetchZigbeeData: () =>
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
  },
  "./components/subscribe-mixin": { SubscribeMixin: (Base) => Base },
  "./localize/localize": load("src/localize/localize.ts"),
  "./native-ui": {},
  "./editor": {},
  "./fit": load("src/fit.ts"),
  "./device-info": { deviceInfoEntity: async () => "sensor.office_signal" },
});
(async () => {
  const card = new WiserZigbeeCard();
  card.hass = { language: "en-GB" };
  card.config = { hub: "test" };
  let view = { position: { x: 50, y: -20 }, scale: 2 };
  let graphData;
  let labelOptions;
  const overview = { position: { x: 0, y: 0 }, scale: 0.5 };
  card.zoomReturnView = overview;
  card.network = {
    getViewPosition: () => ({ ...view.position }),
    getScale: () => view.scale,
    getPositions: () => ({ 1: { x: 123, y: 456 } }),
    // Reproduce vis-network's automatic fit when replacing data.
    setData: (data) => {
      graphData = data;
      view = overview;
    },
    moveTo: (next) => {
      view = { position: next.position, scale: next.scale };
    },
    selectNodes: () => {},
    setOptions: (options) => {
      labelOptions = options;
    },
  };
  const pending = card.loadData();
  view = { position: { x: 90, y: 120 }, scale: 3 };
  resolveFetch({
    nodes: [{ id: 1, label: "Office", group: "RoomStat" }],
    edges: [{ id: "link", from: 1, to: 0, label: "Very Good (92%)" }],
  });
  await pending;
  assert.deepEqual(view, { position: { x: 90, y: 120 }, scale: 3 });
  assert.equal(graphData.nodes[0].x, 123);
  assert.equal(graphData.nodes[0].y, 456);
  assert.deepEqual(card.zoomReturnView, overview);
  card.toggleDeviceZoom(1);
  assert.deepEqual(
    view,
    overview,
    "Double-click still restores the original overview",
  );
  assert.equal(card.zoomReturnView, undefined);
  card.toggleDeviceZoom(undefined, { x: -230, y: 80 });
  assert.deepEqual(
    view,
    { position: { x: -230, y: 80 }, scale: 1.25 },
    "Empty-area double-click centers and zooms on that area",
  );
  assert.deepEqual(card.zoomReturnView, overview);
  let prevented = false;
  const wheel = {
    deltaX: 25,
    deltaY: 50,
    deltaMode: 0,
    preventDefault: () => {
      prevented = true;
    },
  };
  card.panZoomedView(wheel);
  assert.equal(prevented, true);
  assert.deepEqual(
    view,
    { position: { x: -210, y: 120 }, scale: 1.25 },
    "Trackpad scroll pans both axes without changing zoom",
  );
  card.panZoomedView({ ...wheel, deltaX: 0, deltaY: 25, shiftKey: true });
  assert.deepEqual(
    view.position,
    { x: -190, y: 120 },
    "Shift-wheel pans horizontally",
  );
  card.toggleDeviceZoom(undefined, { x: 500, y: 300 });
  assert.deepEqual(
    view,
    overview,
    "Second double-click restores the previous view",
  );
  assert.equal(card.zoomReturnView, undefined);
  prevented = false;
  card.panZoomedView(wheel);
  assert.equal(prevented, false, "Overview leaves page scrolling available");
  card.deviceClick(1);
  await Promise.resolve();
  assert.equal(
    infoEvents.length,
    0,
    "Tap shows inline details without a dialog",
  );
  assert.equal(
    card.selectedEntity,
    "sensor.office_signal",
    "Tap resolves live Zigbee attributes",
  );
  card.deviceHold(undefined);
  await Promise.resolve();
  assert.equal(infoEvents.length, 0, "Holding empty canvas does not open info");
  card.deviceHold(1);
  card.cancelDeviceInfo();
  await Promise.resolve();
  assert.equal(infoEvents.length, 0, "Cancelled holds do not open stale info");
  card.deviceHold(1);
  await Promise.resolve();
  assert.deepEqual(infoEvents, [
    { type: "hass-more-info", detail: { entityId: "sensor.office_signal" } },
  ]);
  const beforeLabels = { ...view };
  card.toggleLabels();
  assert.equal(graphData.edges[0].label, "Very good (92%)");
  assert.deepEqual(view, beforeLabels);
  assert.equal(labelOptions.edges.scaling.label.drawThreshold, 0);
  assert.ok(labelOptions.edges.font.size * view.scale >= 11);
  card.toggleLabels();
  assert.equal(graphData.edges[0].label, "");
  for (const scale of [0.25, 0.5, 1, 2, 4]) {
    card.updateLinkLabelStyle(scale);
    assert.equal(
      labelOptions.edges.font.size * scale,
      11,
      "Labels stay 11 screen pixels at every zoom",
    );
    assert.equal(labelOptions.edges.font.strokeWidth, 0);
  }
  let focused;
  card.network.focus = (id, options) => {
    focused = { id, options };
  };
  card.config.map_only = true;
  card.selected = 1;
  card.shadowRoot = {
    getElementById: () => ({
      getBoundingClientRect: () => ({ top: 20, bottom: 420, height: 400 }),
    }),
    querySelector: () => ({
      hidden: false,
      getBoundingClientRect: () => ({ top: 232 }),
    }),
  };
  card.focusAboveInfo();
  assert.equal(focused.id, 1);
  assert.deepEqual(focused.options.offset, { x: 0, y: -100 });
  assert.equal(
    focused.options.scale,
    view.scale,
    "Info panel focus preserves current zoom",
  );
  assert.equal(focused.options.locked, false, "Map remains pannable");
  focused = undefined;
  card.config.map_only = false;
  card.focusAboveInfo();
  assert.equal(focused, undefined, "Normal card selection does not recenter");
  const originalNetwork = card.network;
  const originalView = { ...view };
  card.toggleViewMode();
  assert.equal(card.config.map_only, true);
  card.toggleViewMode();
  assert.equal(card.config.map_only, false);
  assert.equal(
    card.network,
    originalNetwork,
    "Mode toggle preserves the existing graph",
  );
  assert.deepEqual(view, originalView);
  assert.equal(card.mapHeight, 340);
  card.config.map_height = 500;
  assert.equal(card.mapHeight, 500);
  card.config.map_height = null;
  assert.equal(card.mapHeight, 340);
  card.config.map_height = -100;
  assert.equal(card.mapHeight, 100);
  const resizeCalls = [];
  card.config.auto_update = true;
  card.pendingLoad = false;
  card.network.setSize = (width, height) => resizeCalls.push([width, height]);
  card.shadowRoot.getElementById = () => ({
    clientWidth: 400,
    clientHeight: 600,
  });
  card.network.redraw = () => resizeCalls.push("fit");
  card.network.getBoundingBox = () => ({
    left: -100,
    right: 100,
    top: -100,
    bottom: 100,
  });
  card.setConfig({ ...card.config, map_height: 600 });
  assert.equal(
    card.network,
    originalNetwork,
    "Height change retains dragged node positions",
  );
  assert.equal(
    resizeCalls.length,
    0,
    "Wait for rendered height before fitting",
  );
  card.updated(new Map([["config", {}]]));
  assert.deepEqual(resizeCalls, [["100%", "100%"], "fit"]);
  assert.equal(card.fitAfterHeightChange, false);
  card.updated(new Map());
  assert.equal(resizeCalls.length, 2, "Ordinary updates must not refit");
  console.log(
    "Refresh preserves latest zoom, pan, dragged positions and double-click return view.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

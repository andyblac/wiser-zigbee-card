const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");
global.customElements = { get: () => class {} };
global.window = { matchMedia: () => ({ matches: true }) };
global.location = { pathname: "/test" };
global.localStorage = { getItem: () => null };
global.getComputedStyle = () => ({ getPropertyValue: () => "#ffffff" });
let resolveFetch;
let preview = true;
let savedChanges;
const infoEvents = [];
const decorator = () => () => {};
const { WiserZigbeeCard } = load("src/wiser-zigbee-card.ts", {
  lit: {
    LitElement: class {
      updated() {}
      isConnected = true;
      updateComplete = Promise.resolve();
    },
    html: (strings, ...values) => ({ strings, values }),
    css: () => {},
  },
  "lit/directives/if-defined.js": { ifDefined: (value) => value },
  "lit/decorators.js": {
    customElement: decorator,
    state: decorator,
    eventOptions: decorator,
  },
  "custom-card-helpers": {
    fireEvent: (_, type, detail) => infoEvents.push({ type, detail }),
  },
  "vis-network": {},
  "./is-preview": { is_preview: () => preview },
  "./map-magnifier": load("src/map-magnifier.ts"),
  "./save-config": { saveCardConfig: async (_, original, changes) => {
    savedChanges = changes;
    return { ...original, ...changes };
  } },
  "./device-images": { DEVICE_IMAGES: {}, FALLBACK_DEVICE_IMAGE: "" },
  "./const": { OPTIONS: {} },
  "./area-spacing": load("src/area-spacing.ts"),
  "./device-appearance": load("src/device-appearance.ts"),
  "./signal-color": load("src/signal-color.ts"),
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
  "./area-graph": load("src/area-graph.ts"),
  "./areas": { withDeviceAreas: async (_, data) => data },
  "./fit": load("src/fit.ts"),
  "./link-labels": load("src/link-labels.ts"),
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
    unselectAll: () => {},
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
    stopPropagation() {},
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
  card.deviceClick();
  await Promise.resolve();
  assert.equal(card.selected, undefined, "Empty-area tap closes details");
  assert.equal(card.selectedEntity, undefined);
  card.deviceClick(1);
  assert.equal(
    card.selected,
    undefined,
    "Tap waits for double-click recognition",
  );
  await new Promise((resolve) => setTimeout(resolve, 320));
  assert.equal(card.selected, 1, "Tap opens Zigbee details");
  assert.equal(card.selectedEntity, "sensor.office_signal");
  card.closeDeviceInfo();
  card.deviceClick(1);
  card.cancelDeviceInfo();
  await new Promise((resolve) => setTimeout(resolve, 320));
  assert.equal(
    card.selected,
    undefined,
    "Double-click cancels pending tap details",
  );
  card.deviceClick(1);
  card.closeDeviceInfo(false);
  await new Promise((resolve) => setTimeout(resolve, 320));
  assert.equal(
    card.selected,
    undefined,
    "Dragging cancels pending tap details",
  );
  card.showDeviceDetails(undefined);
  await Promise.resolve();
  assert.equal(card.selected, undefined);
  card.showDeviceDetails(1);
  card.deviceClick();
  await Promise.resolve();
  assert.equal(
    card.selectedEntity,
    undefined,
    "Dragging cancels pending details",
  );
  card.showDeviceDetails(1);
  await Promise.resolve();
  assert.equal(card.selected, 1);
  assert.equal(
    card.selectedEntity,
    "sensor.office_signal",
    "Tap resolves inline Zigbee details",
  );
  assert.deepEqual(infoEvents, [], "Normal taps do not open HA More info");
  const beforeInfo = card.infoReturnView;
  view = { position: { x: 700, y: 900 }, scale: 2 };
  card.showDeviceDetails(1);
  await Promise.resolve();
  assert.equal(
    card.infoReturnView,
    beforeInfo,
    "Switching devices preserves original return view",
  );
  card.closeDeviceInfo();
  assert.deepEqual(view, {
    position: beforeInfo.position,
    scale: beforeInfo.scale,
  });
  assert.equal(card.selected, undefined);
  assert.equal(card.infoReturnView, undefined);
  card.showDeviceDetails(1);
  view = { position: { x: 800, y: 600 }, scale: 2 };
  card.closeDeviceInfo(false);
  assert.deepEqual(
    view,
    { position: { x: 800, y: 600 }, scale: 2 },
    "Dragging dismisses without moving the canvas beneath the pointer",
  );
  const beforeLabels = { ...view };
  card.toggleLabels();
  assert.equal(card.showLabels, true);
  assert.equal(
    graphData.edges[0].label,
    "",
    "Native midpoint labels disabled in favour of collision-aware drawing",
  );
  assert.deepEqual(view, beforeLabels);
  card.toggleLabels();
  assert.equal(card.showLabels, false);
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
  assert.equal(card.mapHeight, null);
  card.config.map_height = 500;
  assert.equal(card.mapHeight, 500);
  card.config.map_height = null;
  assert.equal(card.mapHeight, null);
  assert.ok(card.getGridOptions().rows > 0);
  card.config.map_height = "";
  assert.equal(card.mapHeight, null);
  card.config.map_height = 340;
  assert.equal(card.getGridOptions().rows, undefined);
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
  card.zoomReturnView = undefined;
  card.touchZoomStart({ touches: [{}] });
  assert.equal(
    card.zoomReturnView,
    undefined,
    "One finger does not start pinch",
  );
  const beforePinch = structuredClone(view);
  card.touchZoomStart({ touches: [{}, {}] });
  assert.deepEqual(card.zoomReturnView, beforePinch);
  view = { position: { x: 33, y: 22 }, scale: 3 };
  card.touchZoomStart({ touches: [{}, {}] });
  assert.deepEqual(
    card.zoomReturnView,
    beforePinch,
    "Repeated pinch retains return view",
  );
  card.toggleDeviceZoom();
  assert.deepEqual(
    view,
    beforePinch,
    "Double-click restores the pre-pinch view",
  );
  let wheelStopped = false;
  card.panZoomedView({
    ...wheel,
    ctrlKey: true,
    stopPropagation() {
      wheelStopped = true;
    },
  });
  assert.equal(
    wheelStopped,
    false,
    "Trackpad pinch reaches native zoom handler",
  );
  assert.deepEqual(card.zoomReturnView, beforePinch);
  card.zoomReturnView = undefined;
  const beforeButtons = structuredClone(view);
  card.zoomStep(1.25);
  assert.equal(view.scale, beforeButtons.scale * 1.25);
  assert.deepEqual(view.position, beforeButtons.position);
  card.zoomStep(0.8);
  assert.ok(Math.abs(view.scale - beforeButtons.scale) < 1e-9);
  assert.deepEqual(card.zoomReturnView, beforeButtons);
  view.scale = 10;
  card.zoomStep(1.25);
  assert.equal(view.scale, 10, "Zoom in is bounded");
  view.scale = 0.01;
  card.zoomStep(0.8);
  assert.equal(view.scale, 0.01, "Zoom out is bounded");
  card.closeDeviceInfo();
  await card.deviceHold(1);
  assert.deepEqual(
    infoEvents.at(-1),
    {
      type: "hass-more-info",
      detail: { entityId: "sensor.office_signal" },
    },
    "Long-press opens native HA More info",
  );
  assert.equal(
    card.selected,
    undefined,
    "Long-press does not open inline details",
  );
  const eventCount = infoEvents.length;
  const pendingHold = card.deviceHold(1);
  card.closeDeviceInfo(false);
  await pendingHold;
  assert.equal(
    infoEvents.length,
    eventCount,
    "Dragging cancels pending More info",
  );
  await card.deviceHold(undefined);
  assert.equal(
    infoEvents.length,
    eventCount,
    "Empty-space hold never opens More info",
  );
  const beforeTidy = { position: { x: 180, y: -90 }, scale: 2.5 };
  view = structuredClone(beforeTidy);
  card.zoomReturnView = overview;
  const beforeTidyFits = resizeCalls.length;
  card.tidyLayout();
  assert.notDeepEqual(view, beforeTidy, "Tidy fits the arranged map");
  assert.equal(card.zoomReturnView, undefined, "Tidy resets the old zoom destination");
  assert.ok(resizeCalls.length > beforeTidyFits, "Tidy triggers Fit view");
  card.config.group_by = "area";
  card.zigbeeData = {
    nodes: [
      { id: 0, group: "Controller", label: "Hub", x: 0, y: 0 },
      {
        id: 1,
        group: "RoomStat",
        label: "Office",
        area_id: "office",
        area_name: "Office",
        x: 123,
        y: 456,
      },
    ],
    edges: [{ id: "1-0", from: 1, to: 0, label: "90%" }],
  };
  card.mapData = load("src/area-graph.ts").areaGraph(
    card.zigbeeData,
    "Unassigned",
  );
  card.areaPositions = {};
  card.collapsedAreas.clear();
  card.drawNetwork();
  card.network.getPositions = () =>
    Object.fromEntries(graphData.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  const areaNode = graphData.nodes.find((n) => n.group === "Area");
  const areaView = structuredClone(view);
  card.deviceClick(areaNode.id);
  await new Promise((resolve) => setTimeout(resolve, 320));
  assert.equal(
    graphData.nodes.some((n) => n.id === 1),
    false,
    "Tap collapses area's devices",
  );
  assert.deepEqual(
    card.currentPositions()[1],
    { x: 123, y: 456 },
    "Save includes hidden positions",
  );
  assert.deepEqual(view, areaView, "Area collapse preserves zoom and pan");
  card.deviceClick(areaNode.id);
  await new Promise((resolve) => setTimeout(resolve, 320));
  assert.deepEqual(graphData.nodes.find((n) => n.id === 1).x, 123);
  assert.deepEqual(graphData.nodes.find((n) => n.id === 1).y, 456);
  assert.equal(card.zigbeeData.edges[0].to, 0, "Device info keeps real parent");
  const beforeRouteRefresh = structuredClone(view);
  const updatedRoute = {
    nodes: [
      ...card.zigbeeData.nodes,
      {
        id: 2,
        group: "SmartPlug",
        label: "Kitchen",
        area_id: "kitchen",
        area_name: "Kitchen",
        x: 450,
        y: 10,
      },
    ],
    edges: [
      { id: "1-2", from: 1, to: 2, label: "80%" },
      { id: "2-0", from: 2, to: 0, label: "Online" },
    ],
  };
  const routingRefresh = card.loadData();
  resolveFetch(updatedRoute);
  await routingRefresh;
  assert.equal(
    graphData.edges.find((edge) => edge.from === 1).to,
    2,
    "Refresh draws the new real router link across areas",
  );
  assert.equal(
    graphData.edges.some((edge) => edge.from < 0 || edge.to < 0),
    false,
    "Area markers never become routing hops",
  );
  assert.equal(graphData.nodes.find((node) => node.id === 1).x, 123);
  assert.equal(graphData.nodes.find((node) => node.id === 1).y, 456);
  assert.deepEqual(view, beforeRouteRefresh);
  const allPositions = card.currentPositions();
  const kitchenArea = card.mapData.nodes.find(
    (n) => n.group === "Area" && n.area_id === "kitchen",
  );
  card.network.getPositions = () => allPositions;
  card.network.moveNode = (id, x, y) => {
    allPositions[id] = { x, y };
  };
  const beforeMember = { ...allPositions[2] };
  const otherMember = { ...allPositions[1] };
  const headerBefore = { ...allPositions[kitchenArea.id] };
  card.startAreaDrag(kitchenArea.id);
  allPositions[kitchenArea.id] = {
    x: headerBefore.x + 70,
    y: headerBefore.y - 35,
  };
  card.moveAreaDevices();
  assert.deepEqual(allPositions[2], {
    x: beforeMember.x + 70,
    y: beforeMember.y - 35,
  });
  assert.deepEqual(allPositions[1], otherMember, "Other areas do not move");
  card.moveAreaDevices();
  assert.equal(
    allPositions[2].x,
    beforeMember.x + 70,
    "Repeated draw does not accumulate movement",
  );
  card.startAreaDrag(2);
  assert.equal(
    card.areaDrag,
    undefined,
    "Individual device dragging remains independent",
  );
  assert.deepEqual(allPositions[kitchenArea.id], {
    x: headerBefore.x + 70,
    y: headerBefore.y - 35,
  });
  // Hidden members must travel with a collapsed group's header too.
  const hiddenPosition = { ...allPositions[2] };
  card.areaPositions[2] = hiddenPosition;
  delete allPositions[2];
  card.startAreaDrag(kitchenArea.id);
  allPositions[kitchenArea.id].x += 20;
  card.moveAreaDevices();
  assert.deepEqual(card.currentPositions()[2], {
    x: hiddenPosition.x + 20,
    y: hiddenPosition.y,
  });
  const measuredLabels = [];
  const measure = {
    save() {}, restore() {},
    measureText(text) { measuredLabels.push(text); return { width: 300 }; },
  };
  const boxes = card.areaBounds(measure);
  assert.ok(boxes.length > 0);
  assert.ok(measuredLabels.some((label) => /[▸▾]/.test(label)));
  assert.ok(boxes.every((box) => box.right - box.left >= 336),
    "Area boxes reserve measured label width plus padding");
  card.areaDrag = undefined;
  card.collapsedAreas.clear();
  allPositions[2] = { x: 420, y: 200 };
  card.network.getBoundingBox = (id) => {
    const p = allPositions[id];
    return { left: p.x - 32, right: p.x + 32, top: p.y - 32, bottom: p.y + 32 };
  };
  card.config.orientation = "vertical";
  const deviceBeforeCenter = { ...allPositions[2] };
  card.areaBounds(measure);
  assert.equal(allPositions[kitchenArea.id].x, 420,
    "Area marker is centred over its member bounds");
  assert.deepEqual(allPositions[2], deviceBeforeCenter,
    "Centring the marker does not move individual devices");
  card.areaBounds(measure);
  assert.equal(allPositions[kitchenArea.id].x, 420, "Centring is stable across frames");
  global.getComputedStyle = () => ({ getPropertyValue: (key) =>
    key === "--success-color" ? "#00ff00" : "#888888" });
  card.config = { hub: "test", group_by: "none" };
  card.zigbeeData = {
    nodes: [{ id: 0, group: "Controller", label: "Hub" }, { id: 1, group: "RoomStat", label: "Sensor" }],
    edges: [{ from: 1, to: 0, label: "Good (80%)" }],
  };
  card.mapData = card.zigbeeData;
  for (const mode of ["links", "icons", "both", "none"]) {
    card.config.link_status = mode;
    for (const labels of [true, false]) {
      card.showLabels = labels;
      card.drawNetwork();
      assert.equal(graphData.edges[0].color.color,
        ["links", "both"].includes(mode) ? "#00ff00" : "#888888");
      const artwork = decodeURIComponent(graphData.nodes.find((node) => node.id === 1).image);
      assert.equal(artwork.includes('flood-color="#00ff00"'), ["icons", "both"].includes(mode));
    }
  }
  card.mapData = card.zigbeeData = {
    nodes: [],
    edges: [
      { id: "first", from: 1, to: 0, label: "Good (80%)" },
      { id: "second", from: 2, to: 0, label: "Medium (50%)" },
    ],
  };
  let redraws = 0;
  card.network.redraw = () => { redraws++; };
  card.network.getScale = () => 1;
  card.network.getPositions = () => ({
    0: { x: 400, y: 100 }, 1: { x: 100, y: 500 }, 2: { x: 700, y: 500 },
  });
  card.network.canvasToDOM = card.network.DOMtoCanvas = (point) => point;
  card.shadowRoot = { getElementById: () => ({ clientWidth: 800, clientHeight: 600 }) };
  const drawn = [];
  const ctx = new Proxy({
    measureText: () => ({ width: 30 }),
    fillText: (text) => drawn.push(text),
  }, { get: (target, key) => target[key] ?? (() => {}) });
  card.showLabels = false;
  card.hoverLink("first");
  card.drawLinkLabels(ctx);
  assert.deepEqual(drawn.splice(0), ["80%"]);
  card.hoverLink("second");
  card.drawLinkLabels(ctx);
  assert.deepEqual(drawn.splice(0), ["50%"]);
  card.hoverLink();
  card.drawLinkLabels(ctx);
  assert.deepEqual(drawn, []);
  assert.equal(redraws, 3);
  card.showLabels = true;
  card.hoverLink("first");
  card.drawLinkLabels(ctx);
  assert.deepEqual(drawn.splice(0), ["80%", "50%"]);
  assert.equal(redraws, 3, "Hover does not disturb always-visible labels");
  preview = false;
  global.localStorage = { getItem: () => null, setItem: () => {} };
  const savingCard = new WiserZigbeeCard();
  savingCard.setConfig({ type: "custom:wiser-zigbee-card", show_labels: false, map_only: false });
  savingCard.currentPositions = () => ({ 1: { x: 10, y: 20 } });
  savingCard.showLabels = true;
  savingCard.config.map_only = true;
  await savingCard.saveLayoutClick();
  assert.equal(savedChanges.show_labels, true);
  assert.equal(savedChanges.map_only, true);
  assert.deepEqual(savedChanges.layout_data, { 1: { x: 10, y: 20 } });
  assert.equal(savingCard.config.show_labels, true);
  savingCard.showLabels = false;
  savingCard.config.map_only = false;
  await savingCard.saveLayoutClick();
  assert.equal(savedChanges.show_labels, false);
  assert.equal(savedChanges.map_only, false);
  const menu = { updateComplete: Promise.resolve(), open: false };
  const anchorButton = {};
  savingCard.shadowRoot = { querySelector: () => menu };
  savingCard.network = {};
  await savingCard.openMagnifierMenu({ querySelector: () => anchorButton });
  assert.equal(menu.open, true);
  assert.equal(menu.anchorElement, anchorButton);
  let toggles = 0;
  const buttonTemplate = savingCard.layoutIcon("editor.magnifier", "", () => toggles++, false, false);
  const clickIndex = buttonTemplate.strings.findIndex((part) => part.endsWith("@click="));
  buttonTemplate.values[clickIndex]();
  assert.equal(toggles, 0, "Release after long press must not toggle the magnifier");
  buttonTemplate.values[clickIndex]();
  assert.equal(toggles, 1, "Subsequent normal click still toggles");
  for (const localX of [999, -500]) {
    const shared = new WiserZigbeeCard();
    shared.hass = { language: "en-GB" };
    shared.setConfig({
      type: "custom:wiser-zigbee-card", hub: "shared",
      orientation: "vertical", layout_data: { 1: { x: 100, y: 200 } },
    });
    shared.drawNetwork = () => {};
    global.localStorage = { getItem: () => JSON.stringify({ 1: { x: localX, y: 777 } }) };
    let pendingLoad = shared.loadData();
    resolveFetch({ nodes: [{ id: 1, label: "Sensor", group: "RoomStat", x: 0, y: 0 }], edges: [] });
    await pendingLoad;
    assert.equal(shared.mapData.nodes[0].x, 100, "Shared config wins over each browser's older layout");
    assert.equal(shared.mapData.nodes[0].y, 200);
    shared.config.layout_data = undefined;
    pendingLoad = shared.loadData();
    resolveFetch({ nodes: [{ id: 1, label: "Sensor", group: "RoomStat", x: 0, y: 0 }], edges: [] });
    await pendingLoad;
    assert.equal(shared.mapData.nodes[0].x, localX, "Local-only layouts remain supported");
    shared.config.layout_data = {};
    pendingLoad = shared.loadData();
    resolveFetch({ nodes: [{ id: 1, label: "Sensor", group: "RoomStat", x: 0, y: 0 }], edges: [] });
    await pendingLoad;
    assert.equal(shared.mapData.nodes[0].x, 0, "Empty configured layout does not revive stale browser positions");
  }
  console.log(
    "Refresh preserves latest zoom, pan, dragged positions and double-click return view.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

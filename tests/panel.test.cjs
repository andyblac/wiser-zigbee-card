const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");

function setup() {
  class Element {
    constructor() { this.listeners = {}; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    setAttribute() {}
    removeAttribute() {}
    append(child) { (this.children ||= []).push(child); }
    showModal() { this.open = true; }
    close() { this.open = false; }
    static panelApiVersion = 1;
    static async getConfigElement() { return new Element(); }
    replaceChildren(...children) { this.children = children; }
    setConfig(config) { this.config = config; }
    dispatchEvent(event) { this.event = event; }
    attachShadow() {
      const main = new Element();
      const elements = new Map();
      this.shadowRoot = {
        querySelector: () => main,
        getElementById: (id) => {
          if (!elements.has(id)) elements.set(id, new Element());
          return elements.get(id);
        },
      };
    }
  }
  const registry = new Map([["wiser-zigbee-card", Element]]);
  const context = vm.createContext({
    requiredTranslationFragments: require("./load-ts.cjs")("src/localize/localize.ts").requiredTranslationFragments,
    localize: (key) => ({"panel.retry": "Retry", "panel.save_error": "Unable to save"}[key] || key),
    HTMLElement: Element,
    window: { loadCardHelpers: async () => ({}) },
    CustomEvent: class { constructor(type, options) { Object.assign(this, { type }, options); } },
    customElements: { get: (key) => registry.get(key), define: (key, value) => registry.set(key, value) },
    document: { createElement: () => new Element() },
    console: { error() {} },
  });
  vm.runInContext(readFileSync(resolve(__dirname,
    "../src/wiser-zigbee-panel.js"), "utf8").replace(/^import .*;\n/, ""), context);
  return new (registry.get("wiser-zigbee-panel"))();
}

test("panel creates a Zigbee card per enabled hub and forwards hass updates", () => {
  const panel = setup();
  const hass = { states: {} };
  panel.hass = hass;
  panel.panel = { config: { hubs: ["first", "second"] } };
  const cards = panel.shadowRoot.querySelector("main").children;
  assert.equal(cards.length, 2);
  assert.equal(cards[0].config.hub, "first");
  assert.equal(cards[1].config.hub, "second");
  assert.equal(cards[0].hass, hass);
  const updated = { states: { example: {} } };
  panel.hass = updated;
  assert.equal(cards[1].hass, updated);
  panel.panel = { config: { hubs: ["first", "second"] } };
  assert.equal(panel.shadowRoot.querySelector("main").children[0], cards[0]);
});

test("panel accepts hass after configuration and replaces cards when hubs change", () => {
  const panel = setup();
  panel.panel = { config: { hubs: ["first"] } };
  const hass = {};
  panel.hass = hass;
  assert.equal(panel.shadowRoot.querySelector("main").children[0].hass, hass);
  panel.panel = { config: { hubs: ["second"] } };
  const cards = panel.shadowRoot.querySelector("main").children;
  assert.equal(cards.length, 1);
  assert.equal(cards[0].config.hub, "second");
  assert.equal(cards[0].hass, hass);
});

test("menu button dispatches Home Assistant's sidebar event", () => {
  const panel = setup();
  panel.shadowRoot.getElementById("menu").listeners.click();
  assert.equal(panel.event.type, "hass-toggle-menu");
  assert.equal(panel.event.composed, true);
  assert.equal(panel.event.bubbles, true);
});

test("panel overrides saved fixed map heights and hides the height editor", async () => {
  const panel = setup();
  panel.hass = { user: { is_admin: true } };
  panel.panel = { config: { hubs: ["hub"], card_configs: { hub: { map_height: 340 } } } };
  assert.equal(panel._cards[0].config.map_height, null);
  await panel._openEditor();
  assert.equal(panel._editors[0].hideMapHeight, true);
  assert.equal(panel._editors[0].config.map_height, null);
});

test("load errors display a retry action", async () => {
  const panel = setup();
  panel.panel = { config: { hubs: null } };
  const children = panel.shadowRoot.querySelector("main").children;
  assert.ok(children[0].textContent);
  assert.equal(children[1].textContent, "Retry");
  panel._config = { hubs: ["recovered"] };
  await children[1].listeners.click();
  assert.equal(panel.shadowRoot.querySelector("main").children[0].config.hub, "recovered");
});


test("cog saves shared integration config over websocket", async () => {
  const panel = setup();
  const calls = [];
  panel.hass = { user: { is_admin: true }, callWS: async (msg) => calls.push(msg) };
  panel.panel = { config: { hubs: ["hub"] } };
  await panel.shadowRoot.getElementById("settings").listeners.click();
  assert.equal(panel.shadowRoot.getElementById("editor-dialog").open, true);
  panel._editors[0].listeners["config-changed"]({
    stopPropagation() {}, detail: { config: { name: "My network", show_labels: true } },
  });
  await panel.shadowRoot.getElementById("save").listeners.click();
  assert.equal(calls[0].type, "wiser/zigbee_panel/configure");
  assert.equal(calls[0].configs.hub.show_labels, true);
  assert.equal(panel.shadowRoot.getElementById("editor-dialog").open, false);
  assert.equal(panel._cards[0].config.show_labels, true);
  const reloaded = setup();
  reloaded.panel = { config: { hubs: ["hub"], card_configs: calls[0].configs } };
  assert.equal(reloaded._cards[0].config.name, "My network");
});

test("failed save keeps editor open and offers retry", async () => {
  const panel = setup();
  panel.hass = { user: { is_admin: true }, callWS: async () => { throw Error("Offline"); } };
  panel.panel = { config: { hubs: ["hub"] } };
  await panel._openEditor();
  await panel._saveEditor();
  assert.equal(panel.shadowRoot.getElementById("editor-dialog").open, true);
  assert.match(panel.shadowRoot.getElementById("editor-error").textContent, /Unable to save/);
  assert.equal(panel.shadowRoot.getElementById("save").disabled, false);
});

test("panel waits for native Lovelace translations before rendering the editor", async () => {
  const panel = setup();
  let finish;
  const nativeLocalize = () => "Senkrecht";
  const fragments = [];
  panel.hass = {
    user: { is_admin: true }, language: "de",
    localize: () => "",
    loadFragmentTranslation: (fragment) => {
      fragments.push(fragment);
      if (fragment === "config") return Promise.resolve(nativeLocalize);
      return new Promise(resolve => { finish = resolve; });
    },
  };
  panel.panel = { config: { hubs: ["hub"] } };
  const opening = panel._openEditor();
  assert.deepEqual(fragments, ["lovelace"]);
  assert.equal(panel._editors.length, 0);
  assert.equal(panel.shadowRoot.getElementById("save").disabled, true);
  finish(nativeLocalize);
  await opening;
  assert.deepEqual(fragments, ["lovelace", "config"]);
  assert.equal(panel._editors[0].hass.localize, nativeLocalize);
  assert.equal(panel._editors[0].hass.language, "de");
  assert.equal(panel.shadowRoot.getElementById("save").disabled, false);
});

test("translation failure shows an error instead of a blank editor and supports retry", async () => {
  const panel = setup();
  let fail = true;
  panel.hass = { user: { is_admin: true }, language: "fr", loadFragmentTranslation: async () => {
    if (fail) throw Error("Offline");
    return () => "Vertical";
  } };
  panel.panel = { config: { hubs: ["hub"] } };
  await panel._openEditor();
  assert.equal(panel._editors.length, 0);
  assert.ok(panel.shadowRoot.getElementById("editor-error").textContent);
  assert.equal(panel.shadowRoot.getElementById("save").disabled, true);
  panel._closeEditor();
  fail = false;
  await panel._openEditor();
  assert.equal(panel._editors.length, 1);
});

test("translations are reused for state updates and reloaded when language changes", async () => {
  const panel = setup();
  const calls = [];
  const makeHass = language => ({ user: { is_admin: true }, language,
    loadFragmentTranslation: async fragment => {
      calls.push(`${language}:${fragment}`);
      return () => language;
    },
  });
  panel.hass = makeHass("de");
  panel.panel = { config: { hubs: ["hub"] } };
  await panel._openEditor();
  panel.hass = { ...panel._hass, states: {} };
  await panel._loadTranslations();
  assert.deepEqual(calls, ["de:lovelace", "de:config"]);
  panel.hass = makeHass("fr");
  await panel._loadTranslations();
  assert.deepEqual(calls, ["de:lovelace", "de:config", "fr:lovelace", "fr:config"]);
  assert.equal(panel._editors[0].hass.localize("example"), "fr");
  assert.equal(panel._cards[0].hass.localize("example"), "fr");
});

test("a delayed request cannot overwrite translations after switching language away and back", async () => {
  const panel = setup();
  let finishOldRequest;
  panel.hass = { language: "de", loadFragmentTranslation: () =>
    new Promise(resolve => { finishOldRequest = resolve; }),
  };
  const oldLoad = panel._loadTranslations();
  panel.hass = { language: "fr", loadFragmentTranslation: async () => () => "French" };
  await panel._loadTranslations();
  panel.hass = { language: "de", loadFragmentTranslation: async () => () => "Current German" };
  await panel._loadTranslations();
  finishOldRequest(() => "Stale German");
  await oldLoad;
  assert.equal(panel._hass.localize("example"), "Current German");
});

test("Cancel leaves the card unchanged", async () => {
  const panel = setup();
  panel.hass = { user: { is_admin: true } };
  panel.panel = { config: { hubs: ["hub"] } };
  await panel._openEditor();
  panel._editors[0].listeners["config-changed"]({
    stopPropagation() {}, detail: { config: { name: "Discard me" } },
  });
  panel.shadowRoot.getElementById("cancel").listeners.click();
  assert.equal(panel._cards[0].config.name, undefined);
  await panel._openEditor();
  assert.equal(panel._editors[0].config.name, undefined);
});

test("hub tabs preserve selection across settings updates", () => {
  const panel = setup();
  panel.hass = {};
  panel.panel = { config: { hubs: ["first", "second"] } };
  panel._tabs[1].listeners.click();
  assert.equal(panel._cards[0].hidden, true);
  assert.equal(panel._cards[1].hidden, false);
  panel.panel = { config: { hubs: ["first", "second"], card_configs: { second: { show_labels: true } } } };
  assert.equal(panel._cards[1].hidden, false);
  assert.equal(panel._cards[1].config.show_labels, true);
});

test("layout save only updates its own hub and requires an administrator", async () => {
  const panel = setup();
  const calls = [];
  panel.hass = { user: { is_admin: true }, callWS: async (msg) => calls.push(msg) };
  panel.panel = { config: { hubs: ["first", "second"], card_configs: { second: { map_only: true } } } };
  const result = await panel.saveZigbeeCardConfig(panel._cards[0], { show_labels: true, hub: "second", map_height: 500 });
  assert.equal(result.hub, "first");
  assert.equal(result.map_height, null, "Imported fixed heights cannot constrain the panel");
  assert.deepEqual(Object.keys(calls[0].configs), ["first"]);
  assert.equal(panel._config.card_configs.second.map_only, true);
  panel.hass = { user: { is_admin: false } };
  await assert.rejects(panel.saveZigbeeCardConfig(panel._cards[0], {}), /administrators/);
  assert.equal(panel.shadowRoot.getElementById("settings").hidden, true);
});

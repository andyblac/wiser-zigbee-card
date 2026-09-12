import { localize } from "./localize/localize";
/** Sidebar host for the existing Wiser Zigbee card. */
class WiserZigbeePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; height: 100%; overflow: auto;
          color: var(--primary-text-color); background: var(--primary-background-color); }
        header { display: flex; align-items: center; gap: 16px; height: 64px;
          padding: 0 16px; background: var(--app-header-background-color);
          color: var(--app-header-text-color); }
        h1 { flex: 0 0 auto; font-size: 20px; font-weight: 400; margin: 0; }
        #menu, #settings { flex-shrink: 0; }
        #menu, #settings { color: inherit; }
        #menu ha-icon, #settings ha-icon {
          color: var(--app-header-text-color, var(--primary-text-color));
        }
        #settings[disabled] ha-icon { color: var(--disabled-text-color); }
        ha-dialog { --ha-dialog-width-md: 600px;
          --ha-dialog-surface-background: var(--primary-background-color, var(--ha-color-surface-default, #fff)); }
        .dialog-description { margin: 0 0 20px; color: var(--secondary-text-color); font-size: 14px; line-height: 20px; }
        .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
        #editors section + section { border-top: 1px solid var(--divider-color); margin-top: 24px; padding-top: 16px; }
        #editors h3 { font-size: 16px; font-weight: 500; margin: 0 0 16px; }
        #editor-error:empty { display: none; }
        #editor-error { color: var(--error-color, #db4437); }
        main { max-width: 1200px; margin: auto; padding: 16px; }
        #hub-tabs { display: flex; flex: 1; min-width: 0; margin-inline-start: 24px; align-self: stretch; overflow-x: auto; }
        #hub-tabs[hidden], wiser-zigbee-card[hidden] { display: none; }
        .hub-tab { flex: 0 0 auto; min-height: 48px; padding: 0 24px;
          border: 0; border-bottom: 2px solid transparent; background: transparent;
          color: var(--secondary-text-color); font: inherit; cursor: pointer; }
        .hub-tab[aria-selected="true"] { color: var(--app-header-text-color, var(--primary-text-color));
          border-bottom-color: currentColor; }
        .hub-tab:focus-visible { outline: 2px solid currentColor; outline-offset: -4px; }
        @media (max-width: 600px) {
          header { gap: 8px; padding: 0 8px; }
          #hub-tabs { margin-inline-start: 0; }
          h1 { flex: 0 1 auto; min-width: 0; max-width: 30%; font-size: 16px; }
          .hub-tab { padding: 0 12px; }
        }
        wiser-zigbee-card { display: block; margin-bottom: 16px; }
      </style>
      <header><ha-button id="menu" appearance="plain" aria-label="Toggle sidebar"><ha-icon icon="mdi:menu"></ha-icon></ha-button>
        <h1>Wiser Zigbee</h1>
        <nav id="hub-tabs" role="tablist" aria-label="Wiser hubs" hidden></nav>
        <ha-button id="settings" appearance="plain" aria-label="Edit Zigbee card settings" title="Edit Zigbee card settings" disabled>
          <ha-icon icon="mdi:cog"></ha-icon>
        </ha-button></header>
      <ha-dialog id="editor-dialog" header-title="Panel settings" width="medium">
        <p id="editor-description" class="dialog-description">Customize this panel. Dashboard cards keep their own settings.</p>
        <div id="editors"></div><p id="editor-error" role="alert"></p>
        <div class="dialog-actions" id="editor-actions" slot="footer">
          <ha-button id="cancel" appearance="plain">Cancel</ha-button>
          <ha-button id="save">Save</ha-button>
        </div>
      </ha-dialog>
      <main><p role="status">Loading Wiser Zigbee network…</p></main>`;
    this.shadowRoot.getElementById("menu").addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("hass-toggle-menu", {
        bubbles: true, composed: true,
      }));
    });
    this.shadowRoot.getElementById("settings").addEventListener("click", () => this._openEditor());
    this.shadowRoot.getElementById("cancel").addEventListener("click", () => this._closeEditor());
    this.shadowRoot.getElementById("save").addEventListener("click", () => this._saveEditor());
    this.shadowRoot.getElementById("editor-dialog").addEventListener("closed", () => this._closeEditor());
    this.shadowRoot.getElementById("editor-dialog").addEventListener("close-dialog", () => this._closeEditor());
    this._editors = [];
    this._cards = [];
    this._generation = 0;
  }

  _t(key) { return localize(key, this._hass); }

  set hass(hass) {
    this._hass = hass;
    this._localizeControls();
    for (const card of this._cards) card.hass = hass;
    for (const editor of this._editors) editor.hass = hass;
    this.shadowRoot.getElementById("settings").hidden = !hass?.user?.is_admin;
  }

  _localizeControls() {
    const root = this.shadowRoot;
    for (const [id, key] of [["menu", "panel.menu"], ["settings", "panel.settings"]]) {
      root.getElementById(id).setAttribute("aria-label", this._t(key));
      root.getElementById(id).title = this._t(key);
    }
    root.getElementById("cancel").textContent = this._t("panel.cancel");
    root.getElementById("save").textContent = this._t("common.save");
    root.getElementById("editor-description").textContent = this._t("panel.description");
    const dialog = root.getElementById("editor-dialog");
    dialog.setAttribute("header-title", this._t("panel.settings"));
    dialog.heading = this._t("panel.settings");
  }

  set panel(panel) {
    const config = panel.config;
    if (JSON.stringify(config) === JSON.stringify(this._config)) return;
    this._config = config;
    this._loadCards();
  }

  _cardConfig(hub) {
    return {
      layout_id: `wiser-zigbee-panel:${hub}`,
      ...this._config.card_configs?.[hub],
      type: "custom:wiser-zigbee-card", hub,
    };
  }

  async saveZigbeeCardConfig(card, config) {
    if (!this._hass?.user?.is_admin || !this._cards.includes(card)) {
      throw new Error("Only administrators can save panel settings");
    }
    const hub = this._config.hubs[this._cards.indexOf(card)];
    const settings = { ...config, type: "custom:wiser-zigbee-card", hub };
    await this._hass.callWS({ type: "wiser/zigbee_panel/configure", configs: { [hub]: settings } });
    this._config = { ...this._config, card_configs: { ...this._config.card_configs, [hub]: settings } };
    return settings;
  }

  _selectHub(hub) {
    this._activeHub = hub;
    this._cards.forEach((card, index) => {
      const selected = this._config.hubs[index] === hub;
      card.hidden = !selected;
      this._tabs[index].setAttribute("aria-selected", String(selected));
      this._tabs[index].tabIndex = selected ? 0 : -1;
    });
  }

  _renderHubTabs() {
    const hubs = this._config.hubs;
    const container = this.shadowRoot.getElementById("hub-tabs");
    container.hidden = hubs.length === 0;
    this._tabs = hubs.map((hub, index) => {
      const tab = document.createElement("ha-button");
      tab.setAttribute("appearance", "plain");
      tab.className = "hub-tab";
      tab.textContent = hub;
      tab.id = `hub-tab-${index}`;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", `hub-panel-${index}`);
      tab.addEventListener("click", () => this._selectHub(hub));
      tab.addEventListener("keydown", (event) => {
        let next;
        if (event.key === "ArrowRight") next = (index + 1) % hubs.length;
        else if (event.key === "ArrowLeft") next = (index + hubs.length - 1) % hubs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = hubs.length - 1;
        else return;
        event.preventDefault();
        this._selectHub(hubs[next]);
        this._tabs[next].focus();
      });
      const card = this._cards[index];
      card.id = `hub-panel-${index}`;
      card.setAttribute("role", "tabpanel");
      card.setAttribute("aria-labelledby", tab.id);
      return tab;
    });
    container.replaceChildren(...this._tabs);
    this._selectHub(hubs.includes(this._activeHub) ? this._activeHub : hubs[0]);
  }

  _closeEditor() {
    this.shadowRoot.getElementById("editor-dialog").open = false;
    this._editors = [];
    this.shadowRoot.getElementById("editors").replaceChildren();
  }

  async _openEditor() {
    const dialog = this.shadowRoot.getElementById("editor-dialog");
    if (dialog.open || !this._cards.length || !this._hass?.user?.is_admin) return;
    const container = this.shadowRoot.getElementById("editors");
    const error = this.shadowRoot.getElementById("editor-error");
    const save = this.shadowRoot.getElementById("save");
    this._drafts = {};
    this._editors = [];
    error.textContent = "";
    container.replaceChildren();
    save.disabled = true;
    dialog.heading = this._t("panel.settings");
    if (!("headerTitle" in (customElements.get("ha-dialog")?.prototype || {}))) {
      this.shadowRoot.getElementById("editor-actions").removeAttribute("slot");
    }
    dialog.open = true;
    try {
      // The bundled editor needs HA's helpers, which may not be loaded when
      // this dedicated panel is opened before any Lovelace dashboard.
      if (!window.loadCardHelpers) {
        const resolver = document.createElement("partial-panel-resolver");
        const routes = resolver._getRoutes?.({
          lovelace: { component_name: "lovelace", url_path: "lovelace" },
        });
        await routes?.routes?.lovelace?.load?.();
      }
      const Card = customElements.get("wiser-zigbee-card");
      for (const hub of this._config.hubs) {
        const editor = await Card.getConfigElement();
        if (!dialog.open) return;
        const config = this._cardConfig(hub);
        this._drafts[hub] = config;
        editor.hass = this._hass;
        editor.hideHubSelector = true;
        
        editor.setConfig({ ...config });
        editor.addEventListener("config-changed", (event) => {
          event.stopPropagation();
          this._drafts[hub] = { ...event.detail.config, type: "custom:wiser-zigbee-card", hub };
        });
        const section = document.createElement("section");
        const title = document.createElement("h3");
        title.textContent = hub;
        section.replaceChildren(...(this._config.hubs.length > 1 ? [title, editor] : [editor]));
        container.append(section);
        this._editors.push(editor);
      }
      save.disabled = false;
    } catch (err) {
      error.textContent = this._t("panel.editor_error");
      console.error("Unable to open Wiser editor", err);
    }
  }

  async _saveEditor() {
    const save = this.shadowRoot.getElementById("save");
    save.disabled = true;
    try {
      await this._hass.callWS({
        type: "wiser/zigbee_panel/configure", configs: this._drafts,
      });
      this._config = { ...this._config, card_configs: {
        ...this._config.card_configs, ...this._drafts,
      } };
      this._closeEditor();
      this._editors = [];
      this._loadCards();
    } catch (error) {
      this.shadowRoot.getElementById("editor-error").textContent =
        this._t("panel.save_error");
      console.error("Unable to save Wiser panel settings", error);
    } finally {
      save.disabled = false;
    }
  }

  async _loadCards() {
    const generation = ++this._generation;
    const config = this._config;
    const main = this.shadowRoot.querySelector("main");
    try {
      const Card = customElements.get("wiser-zigbee-card");
      if (Card?.panelApiVersion !== 1) {
        throw new Error("Wiser Zigbee needs its matching Zigbee card build. Update the card resource and refresh the browser.");
      }
      if (generation !== this._generation) return;
      const cards = config.hubs.map((hub) => {
        const card = document.createElement("wiser-zigbee-card");
        card.setConfig(this._cardConfig(hub));
        card.hass = this._hass;
        return card;
      });
      this._cards = cards;
      main.replaceChildren(...cards);
      this._renderHubTabs();
      this.shadowRoot.getElementById("settings").disabled = !cards.length;
    } catch (error) {
      if (generation !== this._generation) return;
      this._cards = [];
      this.shadowRoot.getElementById("hub-tabs").hidden = true;
      this.shadowRoot.getElementById("settings").disabled = true;
      const message = document.createElement("p");
      message.setAttribute("role", "alert");
      message.textContent = error.message || "Unable to load Wiser Zigbee network. Please try again.";
      const retry = document.createElement("ha-button");
      retry.textContent = this._t("panel.retry");
      retry.addEventListener("click", () => this._loadCards());
      main.replaceChildren(message, retry);
      console.error("Unable to load Wiser Zigbee network", error);
    }
  }
}

if (!customElements.get("wiser-zigbee-panel")) {
  customElements.define("wiser-zigbee-panel", WiserZigbeePanel);
}

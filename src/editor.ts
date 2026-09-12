import { sanitizeConfig } from "./sanitize-config";
import { LitElement, html, TemplateResult, css } from "lit";
import {
  HomeAssistant,
  fireEvent,
  LovelaceCardEditor,
} from "custom-card-helpers";
import { WiserZigbeeCardConfig, NetworkOrientation } from "./types";
import { property, state } from "lit/decorators.js";
import { fetchHubs } from "./data/websockets";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";
import { watchNativeElements } from "./native-ui";

export class WiserZigbeeCardEditor
  extends LitElement
  implements LovelaceCardEditor
{
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ attribute: false }) public hideHubSelector = false;
  @state() private _config?: WiserZigbeeCardConfig;
  @state() private _hubs: string[] = [];
  @state() private _formReady = !!customElements.get("ha-form");
  private loadingForm?: Promise<void>;
  private readonly boundLayoutSaveHandler = this.save_layout.bind(this);
  private readonly computeLabel = (schema: { name: string }) =>
    this.t(
      schema.name === "name"
        ? "common.title"
        : schema.name === "hub"
          ? "card.hub"
          : schema.name === "show_detailed_view"
            ? "card.show_detailed_view"
            : `editor.${schema.name}`,
    );
  private t(key: string): string {
    return localize(key, this.hass);
  }

  public setConfig(config: WiserZigbeeCardConfig): void {
    this._config = { ...config, auto_update: config.auto_update ?? true };
    void this.loadNativeForm();
  }
  connectedCallback(): void {
    super.connectedCallback();
    watchNativeElements(this);
    window.addEventListener(
      "wiser-zigbee-save-layout",
      this.boundLayoutSaveHandler,
    );
  }
  disconnectedCallback(): void {
    window.removeEventListener(
      "wiser-zigbee-save-layout",
      this.boundLayoutSaveHandler,
    );
    super.disconnectedCallback();
  }
  protected updated(changed): void {
    if (changed.has("hass") && this.hass && !changed.get("hass")) {
      void fetchHubs(this.hass)
        .then((hubs) => {
          this._hubs = hubs;
        })
        .catch(() => {
          this._hubs = [];
        });
    }
  }
  private async loadNativeForm(): Promise<void> {
    if (customElements.get("ha-form")) {
      this._formReady = true;
      return;
    }
    if (this.loadingForm) return this.loadingForm;
    this.loadingForm = (async () => {
      const helpers = await (window as any).loadCardHelpers();
      // The native button editor imports ha-form and its native selectors.
      const card = helpers.createCardElement({ type: "button" });
      await card.constructor.getConfigElement();
      await customElements.whenDefined("ha-form");
      this._formReady = true;
    })();
    try {
      await this.loadingForm;
    } catch {
      this.loadingForm = undefined;
    }
  }

  protected render(): TemplateResult {
    if (!this.hass || !this._config) return html``;
    if (!this._formReady) return html`<p>${this.t("editor.loading")}</p>`;
    const hubs = [
      ...new Set([
        ...this._hubs,
        ...(this._config.hub ? [this._config.hub] : []),
      ]),
    ];
    const data = {
      ...this._config,
      hub: this._config.hub || this._hubs[0],
      name: this._config.name ?? this.t("card.title"),
      show_detailed_view: !(this._config.map_only ?? false),
      map_height: this._config.map_height ?? null,
      show_device_list: this._config.show_device_list ?? true,
      show_labels: this._config.show_labels ?? false,
      magnifier: this._config.magnifier ?? false,
    };
    const fields = [
      {
        name: "hub",
        required: true,
        disabled: hubs.length === 0,
        selector: { select: { options: hubs, mode: "dropdown" } },
      },
      { name: "name", selector: { text: {} } },
      {
        name: "map_height",
        selector: {
          number: {
            min: 100,
            max: 2000,
            step: 1,
            mode: "box",
            unit_of_measurement: "px",
          },
        },
      },
    ];
    const switches = [
      { name: "show_labels", selector: { boolean: {} } },
      { name: "magnifier", selector: { boolean: {} } },
      { name: "auto_update", selector: { boolean: {} } },
      { name: "show_detailed_view", selector: { boolean: {} } },
      {
        name: "show_device_list",
        selector: { boolean: {} },
        disabled: !data.show_detailed_view,
      },
    ];
    return html` <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${this.hideHubSelector ? fields.filter((field) => field.name !== "hub") : fields}
        .computeLabel=${this.computeLabel}
        @value-changed=${this.valueChanged}
      ></ha-form>
      <ha-form
        class="orientation-control"
        .hass=${this.hass}
        .data=${{ orientation: this._config.orientation ?? "vertical" }}
        .schema=${[
          {
            name: "orientation",
            selector: {
              button_toggle: {
                options: ["horizontal", "vertical", "pie"].map((value) => ({
                  value,
                  label: this.t(`editor.${value}`),
                })),
              },
            },
          },
        ]}
        .computeLabel=${this.computeLabel}
        @value-changed=${this.valueChanged}
      ></ha-form>
      <ha-form
        class="orientation-control"
        .hass=${this.hass}
        .data=${{ group_by: this._config.group_by ?? "none" }}
        .schema=${[
          {
            name: "group_by",
            selector: {
              button_toggle: {
                options: ["none", "area"].map((value) => ({
                  value,
                  label: this.t(`editor.${value}`),
                })),
              },
            },
          },
        ]}
        .computeLabel=${this.computeLabel}
        @value-changed=${this.valueChanged}
      ></ha-form>
      <ha-form
        class="orientation-control"
        .hass=${this.hass}
        .data=${{ link_status: this._config.link_status ?? "links" }}
        .schema=${[{
          name: "link_status",
          selector: { button_toggle: { options: ["links", "icons", "both", "none"].map((value) => ({
            value, label: this.t(`editor.${value}`),
          })) } },
        }]}
        .computeLabel=${this.computeLabel}
        @value-changed=${this.valueChanged}
      ></ha-form>
      <div class="switches">
        ${switches.map(
          (field) =>
            html`<ha-form
              .hass=${this.hass}
              .data=${data}
              .schema=${[field]}
              .computeLabel=${this.computeLabel}
              @value-changed=${this.valueChanged}
            ></ha-form>`,
        )}
      </div>
      <div class="version">${this.t("common.version")}: ${CARD_VERSION}</div>`;
  }

  private setOrientation(orientation: NetworkOrientation): void {
    if (
      !this._config ||
      !["horizontal", "vertical", "pie"].includes(orientation) ||
      (this._config.orientation ?? "vertical") === orientation
    )
      return;
    this._config = { ...this._config, orientation };
    fireEvent(this, "config-changed", { config: this._config });
  }
  private valueChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    if (!this._config || !ev.detail.value) return;
    const value = { ...ev.detail.value };
    // The editor exposes the positive setting; retain existing YAML compatibility.
    if ("show_detailed_view" in value) {
      value.map_only = !value.show_detailed_view;
      delete value.show_detailed_view;
    }
    // Persist the native number selector’s empty value as automatic sizing.
    if (
      "map_height" in value &&
      (value.map_height == null || value.map_height === "")
    )
      value.map_height = null;
    const next = { ...this._config, ...value };
    if (
      (next.hub || this._hubs[0]) !== (this._config.hub || this._hubs[0]) ||
      (next.group_by ?? "none") !== (this._config.group_by ?? "none") ||
      (next.orientation ?? "vertical") !== (this._config.orientation ?? "vertical")
    ) {
      delete next.layout_data;
      delete next.layout_orientation;
      delete next.layout_group_by;
    }
    // Keep the implicit default translated when other form fields change.
    if (this._config.name == null && next.name === this.t("card.title"))
      delete next.name;
    this._config = sanitizeConfig(next);
    fireEvent(this, "config-changed", { config: this._config });
  }
  private save_layout(ev): void {
    if (
      !this._config ||
      (ev.detail.hub ?? "") !== (this._config.hub ?? "") ||
      (ev.detail.orientation ?? "horizontal") !==
        (this._config.orientation ?? "vertical") ||
      (ev.detail.group_by ?? "none") !== (this._config.group_by ?? "none") ||
      (ev.detail.layout_id ?? "") !== (this._config.layout_id ?? "") ||
      (ev.detail.name ?? "Wiser Zigbee Network") !==
        (this._config.name ?? "Wiser Zigbee Network")
    )
      return;
    this._config = sanitizeConfig({
      ...this._config,
      ...(typeof ev.detail.magnifier === "boolean" ? { magnifier: ev.detail.magnifier } : {}),
      ...(typeof ev.detail.map_only === "boolean" ? { map_only: ev.detail.map_only } : {}),
      ...(typeof ev.detail.show_labels === "boolean" ? { show_labels: ev.detail.show_labels } : {}),
      ...(!ev.detail.preferences_only ? {
        layout_data: ev.detail.layout_data,
        orientation: ev.detail.orientation ?? "vertical",
        group_by: ev.detail.group_by ?? "none",
        layout_orientation: undefined,
        layout_group_by: undefined,
      } : {}),
    });
    fireEvent(this, "config-changed", { config: this._config });
  }
  static styles = css`
    :host {
      color: var(--primary-text-color);
    }
    .switches {
      display: grid;
      gap: 0;
    }
    .orientation-control {
      display: block;
      margin: 16px 0 8px;
    }
    .version {
      margin-top: 24px;
      color: var(--secondary-text-color);
      font-size: 12px;
    }
  `;
}

if (!customElements.get("wiser-zigbee-card-editor")) {
  customElements.define("wiser-zigbee-card-editor", WiserZigbeeCardEditor);
}

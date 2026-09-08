import { LitElement, html, TemplateResult, css } from "lit";
import {
  HomeAssistant,
  fireEvent,
  LovelaceCardEditor,
} from "custom-card-helpers";
import { WiserZigbeeCardConfig, NetworkOrientation } from "./types";
import { customElement, property, state } from "lit/decorators.js";
import { fetchHubs } from "./data/websockets";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";
import { watchNativeElements } from "./native-ui";

@customElement("wiser-zigbee-card-editor")
export class WiserZigbeeCardEditor
  extends LitElement
  implements LovelaceCardEditor
{
  @property({ attribute: false }) public hass?: HomeAssistant;
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
    const data = {
      ...this._config,
      name: this._config.name ?? this.t("card.title"),
      map_only: this._config.map_only ?? false,
      map_height: this._config.map_height ?? 340,
      show_layout_export: this._config.show_layout_export ?? true,
      show_device_list: this._config.show_device_list ?? true,
    };
    const fields = [
      ...(this._hubs.length > 1
        ? [
            {
              name: "hub",
              selector: { select: { options: this._hubs, mode: "dropdown" } },
            },
          ]
        : []),
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
      { name: "auto_update", selector: { boolean: {} } },
      { name: "map_only", selector: { boolean: {} } },
      {
        name: "show_layout_export",
        selector: { boolean: {} },
        disabled: data.map_only,
      },
      {
        name: "show_device_list",
        selector: { boolean: {} },
        disabled: data.map_only,
      },
    ];
    return html` <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${fields}
        .computeLabel=${this.computeLabel}
        @value-changed=${this.valueChanged}
      ></ha-form>
      <div class="orientation-control">
        <div id="orientation-label">${this.t("editor.orientation")}</div>
        ${customElements.get("ha-control-select")
          ? html` <ha-control-select
              .label=${this.t("editor.orientation")}
              .value=${this._config.orientation ?? "horizontal"}
              .options=${["horizontal", "vertical"].map((value) => ({
                value,
                label: this.t(`editor.${value}`),
              }))}
              @value-changed=${(event: CustomEvent) => {
                event.stopPropagation();
                this.setOrientation(event.detail.value);
              }}
            ></ha-control-select>`
          : html` <ha-form
              .hass=${this.hass}
              .data=${{ orientation: this._config.orientation ?? "horizontal" }}
              .schema=${[
                {
                  name: "orientation",
                  selector: {
                    select: {
                      options: ["horizontal", "vertical"].map((value) => ({
                        value,
                        label: this.t(`editor.${value}`),
                      })),
                      mode: "dropdown",
                    },
                  },
                },
              ]}
              .computeLabel=${this.computeLabel}
              @value-changed=${this.valueChanged}
            ></ha-form>`}
      </div>
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${switches}
        .computeLabel=${this.computeLabel}
        @value-changed=${this.valueChanged}
      ></ha-form>
      <div class="version">${this.t("common.version")}: ${CARD_VERSION}</div>`;
  }

  private setOrientation(orientation: NetworkOrientation): void {
    if (
      !this._config ||
      !["horizontal", "vertical"].includes(orientation) ||
      (this._config.orientation ?? "horizontal") === orientation
    )
      return;
    this._config = { ...this._config, orientation };
    fireEvent(this, "config-changed", { config: this._config });
  }
  private valueChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    if (!this._config || !ev.detail.value) return;
    const next = { ...this._config, ...ev.detail.value };
    if (next.hub !== this._config.hub) {
      delete next.layout_data;
      delete next.layout_orientation;
    }
    // Keep the implicit default translated when other form fields change.
    if (this._config.name == null && next.name === this.t("card.title"))
      delete next.name;
    this._config = next;
    fireEvent(this, "config-changed", { config: this._config });
  }
  private save_layout(ev): void {
    if (
      !this._config ||
      (ev.detail.hub ?? "") !== (this._config.hub ?? "") ||
      (ev.detail.orientation ?? "horizontal") !==
        (this._config.orientation ?? "horizontal") ||
      (ev.detail.layout_id ?? "") !== (this._config.layout_id ?? "") ||
      (ev.detail.name ?? "Wiser Zigbee Network") !==
        (this._config.name ?? "Wiser Zigbee Network")
    )
      return;
    this._config = {
      ...this._config,
      layout_data: ev.detail.layout_data,
      layout_orientation: ev.detail.orientation ?? "horizontal",
    };
    fireEvent(this, "config-changed", { config: this._config });
  }
  static styles = css`
    :host {
      color: var(--primary-text-color);
    }
    .orientation-control {
      margin: 24px 0;
    }
    #orientation-label {
      margin-bottom: 12px;
    }
    ha-control-select {
      --control-select-border-radius: var(--ha-border-radius-pill, 24px);
      --control-select-padding: 0px;
      --control-select-button-border-radius: 0px;
      --control-select-thickness: 48px;
      --control-select-background: var(--primary-color);
      --control-select-background-opacity: 0.18;
      color: var(--primary-color);
      overflow: hidden;
    }
    .version {
      margin-top: 24px;
      color: var(--secondary-text-color);
      font-size: 12px;
    }
  `;
}

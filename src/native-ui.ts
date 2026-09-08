import { html, TemplateResult } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";

// Use HA-owned elements without registering replacements under their names.
// Semantic HTML is retained for standalone previews or older HA frontends.
export function actionButton(
  label: string,
  click: () => void,
  pressed?: boolean,
  disabled = false,
): TemplateResult {
  return customElements.get("ha-button")
    ? html`<ha-button
        appearance=${pressed ? "filled" : "outlined"}
        size="s"
        .disabled=${disabled}
        aria-pressed=${ifDefined(
          pressed === undefined ? undefined : String(pressed),
        )}
        @click=${click}
        >${label}</ha-button
      >`
    : html`<button
        ?disabled=${disabled}
        aria-pressed=${ifDefined(
          pressed === undefined ? undefined : String(pressed),
        )}
        @click=${click}
      >
        ${label}
      </button>`;
}
export function expansionPanel(
  label: string,
  content: TemplateResult,
): TemplateResult {
  return customElements.get("ha-expansion-panel")
    ? html`<ha-expansion-panel .header=${label} left-chevron
        ><div class="panel-content">${content}</div></ha-expansion-panel
      >`
    : html`<details>
        <summary>${label}</summary>
        ${content}
      </details>`;
}
export function readonlyText(label: string, value: string): TemplateResult {
  return customElements.get("ha-textarea")
    ? html`<ha-textarea
        .label=${label}
        .value=${value}
        readonly
        .rows=${8}
      ></ha-textarea>`
    : html`<textarea aria-label=${label} readonly .value=${value}></textarea>`;
}
export function watchNativeElements(
  host: HTMLElement & { requestUpdate(): void },
): void {
  for (const name of [
    "ha-button",
    "ha-icon-button",
    "ha-expansion-panel",
    "ha-textarea",
    "ha-control-select",
    "ha-alert",
  ]) {
    if (!customElements.get(name))
      void customElements.whenDefined(name).then(() => {
        if (host.isConnected) host.requestUpdate();
      });
  }
}

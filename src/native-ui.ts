import { html, TemplateResult } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";

// Use HA-owned elements without registering replacements under their names.
export function actionButton(
  label: string,
  click: () => void,
  pressed?: boolean,
  disabled = false,
): TemplateResult {
  return html`<ha-button
    appearance=${pressed ? "filled" : "outlined"}
    size="s"
    .disabled=${disabled}
    aria-pressed=${ifDefined(
      pressed === undefined ? undefined : String(pressed),
    )}
    @click=${click}
    >${label}</ha-button
  >`;
}
export function expansionPanel(
  label: string,
  content: TemplateResult,
): TemplateResult {
  return html`<ha-expansion-panel .header=${label} left-chevron
    ><div class="panel-content">${content}</div></ha-expansion-panel
  >`;
}
export function watchNativeElements(
  host: HTMLElement & { requestUpdate(): void },
): void {
  for (const name of [
    "ha-icon",
    "ha-button",
    "ha-icon-button",
    "ha-tooltip",
    "ha-expansion-panel",
    "ha-button-toggle-group",
    "ha-alert",
    "ha-dropdown",
    "ha-dropdown-item",
    "ha-slider",
  ]) {
    if (!customElements.get(name))
      void customElements.whenDefined(name).then(() => {
        if (host.isConnected) host.requestUpdate();
      });
  }
}

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
export function readonlyText(label: string, value: string): TemplateResult {
  return html`<ha-textarea
    .label=${label}
    .value=${value}
    readonly
    .rows=${8}
  ></ha-textarea>`;
}
export function watchNativeElements(
  host: HTMLElement & { requestUpdate(): void },
): void {
  for (const name of [
    "ha-icon",
    "ha-button",
    "ha-icon-button",
    "ha-expansion-panel",
    "ha-textarea",
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

// HA lazy-loads textarea through its native text selector. Rendering its button
// editor loads that selector without importing versioned frontend bundle URLs.
export async function ensureNativeTextarea(host: HTMLElement, hass: unknown): Promise<void> {
  if (customElements.get("ha-textarea")) return;
  const helpers = await (window as any).loadCardHelpers();
  const card = helpers.createCardElement({ type: "button" });
  const editor = await card.constructor.getConfigElement();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    editor.hidden = true;
    editor.hass = hass;
    editor.setConfig({ type: "button" });
    (host.shadowRoot ?? host).appendChild(editor);
    await Promise.race([
      customElements.whenDefined("ha-textarea"),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Native textarea did not load")), 10000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
    editor.remove();
  }
}

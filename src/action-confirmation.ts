// Capture the button before Save can replace the dashboard card.
export function buttonConfirmation(button: HTMLElement | null, message: string): () => void {
  if (!button) return () => {};
  const doc = button.ownerDocument;
  const rect = button.getBoundingClientRect();
  const theme = getComputedStyle(button);
  const colors = ["--ha-tooltip-background-color", "--ha-tooltip-text-color",
    "--ha-color-surface-default", "--primary-text-color", "--ha-font-family-body",
    "--ha-tooltip-border-radius", "--ha-border-radius-md"];
  const values = colors.map((key) => [key, theme.getPropertyValue(key)]);
  return () => {
    const wrapper = doc.createElement("div");
    const anchor = doc.createElement("span");
    const tooltip = doc.createElement("ha-tooltip") as HTMLElement & { for: string; open: boolean; trigger: string };
    const id = `wiser-confirm-${Math.random().toString(36).slice(2)}`;
    wrapper.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none;z-index:1000`;
    values.forEach(([key, value]) => { if (value) wrapper.style.setProperty(key, value); });
    anchor.id = id;
    anchor.style.cssText = "display:block;width:100%;height:100%";
    tooltip.for = id;
    tooltip.trigger = "manual";
    tooltip.setAttribute("placement", "bottom");
    tooltip.textContent = message;
    tooltip.setAttribute("role", "status");
    wrapper.append(anchor, tooltip);
    doc.body.append(wrapper);
    tooltip.open = true;
    setTimeout(() => wrapper.remove(), 2500);
  };
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Local HTTP dashboards may not expose the async clipboard API.
    }
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  const focused = document.activeElement as HTMLElement | null;
  try {
    document.body.appendChild(field);
    field.focus({ preventScroll: true });
    field.select();
    if (!document.execCommand("copy")) throw new Error("Clipboard copy failed");
  } finally {
    field.remove();
    focused?.focus?.({ preventScroll: true });
  }
}

// Shared by every card and sidebar panel in this frontend session. Browsers
// can permit writing the clipboard while denying reads (including local HTTP).
let lastCopiedText: string | undefined;
const clipboardKey = "wiser-zigbee:copied-settings";

function rememberCopy(text?: string): void {
  lastCopiedText = text;
  try {
    if (text === undefined) sessionStorage.removeItem(clipboardKey);
    else sessionStorage.setItem(clipboardKey, text);
  } catch {
    // Keep in-memory transfers working when browser storage is unavailable.
  }
}

export async function copyText(text: string): Promise<void> {
  rememberCopy();
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      rememberCopy(text);
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
    rememberCopy(text);
  } finally {
    field.remove();
    focused?.focus?.({ preventScroll: true });
  }
}

export async function readCopiedText(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch (error) {
    // sessionStorage also covers navigation/reloads and same-origin panel frames.
    let storageAvailable = false;
    try {
      const stored = sessionStorage.getItem(clipboardKey);
      storageAvailable = true;
      if (stored !== null) return stored;
    } catch {}
    if (!storageAvailable && lastCopiedText !== undefined) return lastCopiedText;
    throw error;
  }
}

// Use reported categories, never infer status from percentage alone.
export function signalColor(label: string | undefined, enabled: boolean,
  theme: Pick<CSSStyleDeclaration, "getPropertyValue">): string {
  const category = (label ?? "").split("(")[0].replace(/[\s_-]/g, "").toLowerCase();
  const token = !enabled ? "secondary-text" : ({
    verygood: "success", good: "success", excellent: "success",
    medium: "yellow", normal: "yellow", fair: "yellow", online: "yellow", connected: "yellow",
    verylow: "orange", low: "orange", poor: "orange", verypoor: "orange",
    lowquality: "orange", verylowquality: "orange",
  } as Record<string, string>)[category] ?? "error";
  const defaults: Record<string, string> = {
    success: "#4caf50", yellow: "#ffeb3b", orange: "#ff9800",
    error: "#db4437", "secondary-text": "#727272",
  };
  return theme.getPropertyValue(`--${token}-color`).trim() || defaults[token];
}
export function signalPalette(theme: Pick<CSSStyleDeclaration, "getPropertyValue">): string {
  return ["Good", "Medium", "Low", "Unknown"].map((label) => signalColor(label, true, theme)).join("|");
}

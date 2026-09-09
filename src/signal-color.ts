// Use the hub's category, not an inferred percentage/RSSI threshold.
export function signalColor(
  label: string | undefined,
  enabled: boolean,
  theme: Pick<CSSStyleDeclaration, "getPropertyValue">,
): string {
  const category = (label ?? "").split("(")[0].replace(/[\s_-]/g, "").toLowerCase();
  const token = enabled
    ? ({
        verygood: "success",
        good: "success",
        medium: "warning",
        poor: "error",
        nosignal: "disabled-text",
      } as Record<string, string>)[category]
    : undefined;
  const name = token ?? "secondary-text";
  const defaults: Record<string, string> = {
    success: "#4caf50",
    warning: "#ff9800",
    error: "#db4437",
    "disabled-text": "#bdbdbd",
    "secondary-text": "#727272",
  };
  return theme.getPropertyValue(`--${name}-color`).trim() || defaults[name];
}

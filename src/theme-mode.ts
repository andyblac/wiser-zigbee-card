export type ThemeMode = "auto" | "dark" | "light";

export function themeMode(value: unknown): ThemeMode {
  return value === "dark" || value === "light" ? value : "auto";
}

// Scoped overrides: Auto removes the selector and inherits the surrounding HA theme.
export const THEME_MODE_STYLES = `
  :host([theme-mode="dark"]) {
    color-scheme: dark;
    --primary-text-color: #e1e1e1;
    --secondary-text-color: #9b9b9b;
    --disabled-text-color: #6f6f6f;
    --primary-background-color: #111111;
    --secondary-background-color: #202020;
    --card-background-color: #1c1c1c;
    --divider-color: rgba(225, 225, 225, 0.12);
    --app-header-background-color: #1c1c1c;
    --app-header-text-color: #e1e1e1;
  }
  :host([theme-mode="light"]) {
    color-scheme: light;
    --primary-text-color: #212121;
    --secondary-text-color: #727272;
    --disabled-text-color: #bdbdbd;
    --primary-background-color: #fafafa;
    --secondary-background-color: #e5e5e5;
    --card-background-color: #ffffff;
    --divider-color: rgba(0, 0, 0, 0.12);
    --app-header-background-color: #ffffff;
    --app-header-text-color: #212121;
  }
  :host([theme-mode="dark"]), :host([theme-mode="light"]) {
    --ha-card-background: var(--card-background-color);
    --ha-dialog-surface-background: var(--card-background-color);
    --ha-color-surface-default: var(--card-background-color);
    --ha-color-surface-raised: var(--card-background-color);
    --ha-color-text-primary: var(--primary-text-color);
    --ha-color-text-secondary: var(--secondary-text-color);
    --ha-color-text-disabled: var(--disabled-text-color);
    --ha-color-border-neutral-normal: var(--divider-color);
    --mdc-theme-surface: var(--card-background-color);
    --mdc-theme-on-surface: var(--primary-text-color);
  }
`;

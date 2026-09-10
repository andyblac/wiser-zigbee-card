import { preserveDashboardScroll } from "./preserve-scroll";
type Config = Record<string, any>;
interface Dashboard {
  mode: string;
  rawConfig?: Config;
  config?: Config;
  saveConfig(config: Config): Promise<unknown>;
}
const canonical = (value: any): string => JSON.stringify(value, (_, item) =>
  item && typeof item === "object" && !Array.isArray(item)
    ? Object.keys(item).sort().reduce((sorted, key) => { sorted[key] = item[key]; return sorted; }, {} as Config)
    : item);

// Follow the actual card's ancestry, so another dashboard or preview is never saved.
export async function saveCardConfig(host: Element, original: Config, changes: Config): Promise<Config> {
  let current: any = host;
  let dashboard: Dashboard | undefined;
  while (current) {
    if (current.lovelace?.saveConfig) {
      dashboard = current.lovelace;
      break;
    }
    current = current.parentElement ?? current.getRootNode?.().host;
  }
  const raw = dashboard?.rawConfig ?? dashboard?.config;
  if (!dashboard || dashboard.mode !== "storage" || !raw || raw.strategy)
    throw new Error("Dashboard configuration is not editable");

  const matches: { value: Config; path: (string | number)[] }[] = [];
  const visit = (value: any, path: (string | number)[]) => {
    if (!value || typeof value !== "object") return;
    if (value.type === original.type && canonical(value) === canonical(original))
      matches.push({ value, path });
    for (const [key, child] of Object.entries(value)) visit(child, [...path, key]);
  };
  visit(raw, []);
  const exact = matches.filter((match) => match.value === original);
  const candidates = exact.length ? exact : matches;
  if (candidates.length !== 1) throw new Error("Cannot uniquely identify this card");
  const next = JSON.parse(JSON.stringify(raw));
  const path = candidates[0].path;
  let parent = next;
  for (const key of path.slice(0, -1)) parent = parent[key];
  const updated = { ...candidates[0].value, ...changes };
  parent[path[path.length - 1]] = updated;
  const finishScrollRestore = preserveDashboardScroll(host.ownerDocument?.defaultView ?? null);
  try {
    await dashboard.saveConfig(next);
  } finally {
    finishScrollRestore();
  }
  return updated;
}

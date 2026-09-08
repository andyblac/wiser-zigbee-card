import { LitElement, html, TemplateResult, PropertyValues, css } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { customElement, state } from "lit/decorators.js";
import {
  LovelaceCardEditor,
  LovelaceCard,
  fireEvent,
} from "custom-card-helpers";
import { UnsubscribeFunc } from "home-assistant-js-websocket";
import { Network } from "vis-network";
import { is_preview } from "./is-preview";
import type {
  WiserEventData,
  WiserZigbeeCardConfig,
  zigbeeData,
  node as ZigbeeNode,
} from "./types";
import { DEVICE_IMAGES, FALLBACK_DEVICE_IMAGE } from "./device-images";
import { OPTIONS } from "./const";
import { arrangeNetwork } from "./layout";
import { fetchZigbeeData } from "./data/websockets";
import { SubscribeMixin } from "./components/subscribe-mixin";
import {
  localize,
  localizeCount,
  localizeSignal,
  compactSignal,
  languageFor,
} from "./localize/localize";
import {
  actionButton,
  expansionPanel,
  readonlyText,
  watchNativeElements,
} from "./native-ui";
import "./editor";
import { containedView } from "./fit";
import { placeLinkLabels, LinkLabel } from "./link-labels";
import { deviceInfoEntity, receptionMetrics } from "./device-info";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "wiser-zigbee-card",
  name: "Wiser Zigbee Card",
  description: localize("card.description"),
});

declare global {
  interface HASSDomEvents {
    "wiser-zigbee-save-layout": {
      layout_data: any;
      hub?: string;
      name?: string;
      orientation?: "horizontal" | "vertical";
      layout_id?: string;
    };
  }
}

@customElement("wiser-zigbee-card")
export class WiserZigbeeCard
  extends SubscribeMixin(LitElement)
  implements LovelaceCard
{
  @state() private config?: WiserZigbeeCardConfig;
  @state() private zigbeeData?: zigbeeData;
  @state() private loading = false;
  @state() private error = "";
  @state() private showLabels = false;
  @state() private activeIcon?: string;
  private activeIconTimer?: ReturnType<typeof setTimeout>;
  @state() private selected?: number;
  @state() private selectedEntity?: string;
  @state() private layoutStatus = "";
  @state() private layoutYaml = "";
  private textColor = "";
  private displayLanguage = "";
  private t(key: string): string {
    return localize(key, this.hass);
  }
  private deviceName(node?: ZigbeeNode): string {
    if (!node) return this.t("card.unknown_device");
    return node.group === "Controller" && node.label === "Wiser Hub"
      ? this.t("card.hub")
      : node.label.replace(/\n/g, " ");
  }
  private infoReturnView?: {
    position: { x: number; y: number };
    scale: number;
    zoomReturnView?: { position: { x: number; y: number }; scale: number };
  };
  private zoomReturnView?: {
    position: { x: number; y: number };
    scale: number;
  };
  network?: Network;
  private infoRequest = 0;
  private fitAfterHeightChange = false;
  private requestId = 0;
  private pendingLoad = true;

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement("wiser-zigbee-card-editor");
  }
  public static getStubConfig(): Record<string, unknown> {
    return {};
  }
  public setConfig(config: WiserZigbeeCardConfig): void {
    if (!config) throw new Error(this.t("common.invalid_configuration"));
    const next = { ...config, auto_update: config.auto_update ?? true };
    const previous = this.config;
    const previousHeight = this.mapHeight;
    const onlyHeightChanged =
      previous &&
      this.network &&
      [...new Set([...Object.keys(previous), ...Object.keys(next)])]
        .filter((key) => key !== "map_height")
        .every(
          (key) => JSON.stringify(previous[key]) === JSON.stringify(next[key]),
        );
    this.config = next;
    if (onlyHeightChanged) {
      this.fitAfterHeightChange ||= previousHeight !== this.mapHeight;
      return;
    }
    this.cancelDeviceInfo();
    this.fitAfterHeightChange = false;
    this.network?.destroy();
    this.network = undefined;
    this.infoReturnView = undefined;
    this.zoomReturnView = undefined;
    this.layoutYaml = "";
    this.layoutStatus = "";
    this.pendingLoad = true;
    this.requestId++;
  }
  private get orientation(): "horizontal" | "vertical" {
    return this.config?.orientation === "vertical" ? "vertical" : "horizontal";
  }
  private get mapHeight(): number | null {
    const height = this.config?.map_height;
    if (height == null || height === "") return null;
    return typeof height === "number" && Number.isFinite(height)
      ? Math.min(2000, Math.max(100, Math.round(height)))
      : null;
  }
  public getGridOptions() {
    return this.mapHeight === null
      ? { columns: 12, rows: this.config?.map_only ? 6 : 9, min_rows: 3 }
      : { columns: 12 };
  }
  public getCardSize(): number {
    if (this.config?.map_only) return this.orientation === "vertical" ? 6 : 8;
    return this.orientation === "vertical" ? 7 : 9;
  }
  public hassSubscribe(): Promise<UnsubscribeFunc>[] {
    return [
      this.hass!.connection.subscribeMessage(
        (ev: WiserEventData) => {
          if (
            ev.event === "wiser_updated" &&
            this.config?.auto_update &&
            !is_preview(this)
          )
            void this.loadData();
        },
        { type: "wiser_updated" },
      ),
    ];
  }
  public connectedCallback(): void {
    super.connectedCallback();
    watchNativeElements(this);
    this.pendingLoad = true;
    this.requestUpdate();
  }
  public disconnectedCallback(): void {
    clearTimeout(this.activeIconTimer);
    this.activeIcon = undefined;
    this.cancelDeviceInfo();
    super.disconnectedCallback();
    this.requestId++;
    this.network?.destroy();
    this.network = undefined;
    this.infoReturnView = undefined;
    this.zoomReturnView = undefined;
  }
  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has("hass") && this.network) {
      const color =
        getComputedStyle(this)
          .getPropertyValue("--primary-text-color")
          .trim() || "#273448";
      if (
        color !== this.textColor ||
        languageFor(this.hass) !== this.displayLanguage
      )
        this.drawNetwork(true);
    }
    if (this.fitAfterHeightChange && this.network) {
      this.fitAfterHeightChange = false;
      // Lit has applied the new height; update vis's canvas before fitting.
      this.network.setSize("100%", "100%");
      this.fitNetwork();
    }
    if (
      changed.has("selected") ||
      changed.has("selectedEntity") ||
      changed.has("config")
    )
      this.focusAboveInfo();
    if (this.pendingLoad && this.hass && this.config) {
      this.pendingLoad = false;
      void this.loadData();
    }
  }
  private async loadData(): Promise<void> {
    if (!this.hass || !this.config) return;
    const request = ++this.requestId;
    this.loading = true;
    this.error = "";
    try {
      const data = arrangeNetwork(
        await fetchZigbeeData(this.hass, this.config.hub),
        this.orientation,
      );
      if (request !== this.requestId || !this.isConnected) return;
      let saved =
        (this.config.layout_orientation ?? "horizontal") === this.orientation
          ? this.config.layout_data
          : undefined;
      try {
        const stored = JSON.parse(
          localStorage.getItem(this.layoutKey) || "null",
        );
        if (stored && typeof stored === "object") saved = stored;
      } catch {
        /* Saved YAML and the automatic layout remain available. */
      }
      const positions = this.network?.getPositions();
      data.nodes = data.nodes.map((node) => ({
        ...node,
        ...(positions?.[node.id] ??
          this.validPosition(
            saved && typeof saved === "object" ? saved[node.id] : undefined,
          )),
      }));
      this.zigbeeData = data;
      await this.updateComplete;
      this.drawNetwork();
    } catch (error) {
      if (request === this.requestId) this.error = "card.load_error";
    } finally {
      if (request === this.requestId) this.loading = false;
    }
  }
  private drawNetwork(preservePositions = false): void {
    if (!this.zigbeeData) return;
    const positions = preservePositions
      ? this.network?.getPositions()
      : undefined;
    const textColor =
      getComputedStyle(this).getPropertyValue("--primary-text-color").trim() ||
      "#273448";
    this.textColor = textColor;
    this.displayLanguage = languageFor(this.hass);
    const data = {
      nodes: this.zigbeeData.nodes.map((node) => ({
        ...node,
        ...(positions?.[node.id] ?? {}),
        shape: "image",
        image: DEVICE_IMAGES[node.group] ?? FALLBACK_DEVICE_IMAGE,
        brokenImage: FALLBACK_DEVICE_IMAGE,
        size: 32,
        label:
          node.group === "Controller"
            ? this.deviceName(node)
            : (node.label.match(/\(([^)]+)\)/)?.[1] ?? this.deviceName(node)),
        font: { color: textColor },
      })),
      edges: this.zigbeeData.edges.map((edge) => ({
        ...edge,
        label: "",
      })),
    };
    if (this.network) {
      // setData triggers vis-network's initial fit even with physics disabled.
      // Capture at redraw time so interactions during the fetch are preserved.
      const view = {
        position: this.network.getViewPosition(),
        scale: this.network.getScale(),
      };
      this.network.setData(data);
      this.network.moveTo({ ...view, animation: false });
      if (
        this.selected !== undefined &&
        data.nodes.some((node) => node.id === this.selected)
      )
        this.network.selectNodes([this.selected]);
      else this.selected = undefined;
    } else {
      this.network = new Network(
        this.shadowRoot!.getElementById("zigbee-network")!,
        data,
        {
          ...OPTIONS,
          edges: {
            ...OPTIONS.edges,
            smooth: {
              enabled: true,
              type: "cubicBezier",
              forceDirection: this.orientation,
              roundness: 0.45,
            },
          },
        },
      );
      this.network.on("click", () => this.deviceClick());
      this.network.on("hold", (event) => this.deviceHold(event.nodes[0]));
      this.network.on("doubleClick", (event) => {
        this.cancelDeviceInfo();
        this.toggleDeviceZoom(event.nodes[0], event.pointer?.canvas);
      });
      this.network.on("afterDrawing", (ctx) => this.drawLinkLabels(ctx));
      this.network.on("dragStart", () => this.closeDeviceInfo(false));
      this.network.on("resize", () => this.fitNetwork());
      this.fitNetwork();
      this.requestUpdate();
    }
  }
  private cancelDeviceInfo(): void {
    this.infoRequest++;
    this.selectedEntity = undefined;
  }
  private closeDeviceInfo(restore = true): void {
    this.cancelDeviceInfo();
    this.selected = undefined;
    const view = this.infoReturnView;
    this.infoReturnView = undefined;
    if (restore) {
      this.network?.unselectAll();
      if (view && this.network) {
        this.zoomReturnView = view.zoomReturnView;
        this.network.moveTo({
          position: view.position,
          scale: view.scale,
          animation: false,
        });
      }
    }
  }
  private deviceClick(): void {
    this.closeDeviceInfo();
  }
  private deviceHold(nodeId?: number): void {
    if (nodeId === undefined) {
      this.closeDeviceInfo();
      return;
    }
    if (!this.infoReturnView && this.network) {
      this.infoReturnView = {
        position: this.network.getViewPosition(),
        scale: this.network.getScale(),
        zoomReturnView: this.zoomReturnView,
      };
    }
    this.cancelDeviceInfo();
    this.selected = nodeId;
    if (nodeId !== undefined)
      void this.openDeviceInfo(nodeId, this.infoRequest);
  }
  private async openDeviceInfo(nodeId: number, request: number): Promise<void> {
    const node = this.zigbeeData?.nodes.find((item) => item.id === nodeId);
    if (!node || !this.hass) return;
    try {
      const entityId = await deviceInfoEntity(
        this.hass,
        node,
        this.config?.hub,
      );
      if (
        entityId &&
        request === this.infoRequest &&
        this.isConnected &&
        this.selected === nodeId
      ) {
        this.selectedEntity = entityId;
      }
    } catch {
      // Disabled sensors or unavailable registries leave map details accessible.
    }
  }
  private toggleDeviceZoom(
    nodeId?: number,
    position?: { x: number; y: number },
  ): void {
    if (!this.network) return;
    const animation = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? false
      : { duration: 250, easingFunction: "easeInOutQuad" as const };
    if (this.zoomReturnView) {
      this.network.moveTo({ ...this.zoomReturnView, animation });
      this.zoomReturnView = undefined;
      return;
    }
    if (
      nodeId === undefined &&
      (!position ||
        !Number.isFinite(position.x) ||
        !Number.isFinite(position.y))
    )
      return;
    this.zoomReturnView = {
      position: this.network.getViewPosition(),
      scale: this.network.getScale(),
    };
    const scale = Math.max(this.zoomReturnView.scale * 2, 1.25);
    if (nodeId !== undefined)
      this.network.focus(nodeId, { scale, locked: false, animation });
    else this.network.moveTo({ position, scale, animation });
  }
  private focusAboveInfo(): void {
    if (!this.config?.map_only || this.selected === undefined || !this.network)
      return;
    const map = this.shadowRoot?.getElementById("zigbee-network");
    const panel =
      this.shadowRoot?.querySelector<HTMLElement>("footer.map-info");
    if (!map || !panel || panel.hidden) return;
    const bounds = map.getBoundingClientRect();
    const visibleBottom = Math.min(
      bounds.bottom,
      panel.getBoundingClientRect().top - 12,
    );
    if (visibleBottom <= bounds.top) return;
    // Vis offsets use CSS pixels relative to the canvas centre.
    this.network.focus(this.selected, {
      scale: this.network.getScale(),
      offset: { x: 0, y: (visibleBottom - bounds.top - bounds.height) / 2 },
      locked: false,
      animation: false,
    });
  }
  private panZoomedView(event: WheelEvent): void {
    if (!this.network || !this.zoomReturnView || event.ctrlKey || event.metaKey)
      return;
    event.preventDefault();
    const container = event.currentTarget as HTMLElement;
    const scale = this.network.getScale();
    const position = this.network.getViewPosition();
    const unitX =
      event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? container.clientWidth
          : 1;
    const unitY =
      event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? container.clientHeight
          : 1;
    const dx =
      event.shiftKey && event.deltaX === 0
        ? event.deltaY * unitX
        : event.deltaX * unitX;
    const dy = event.shiftKey && event.deltaX === 0 ? 0 : event.deltaY * unitY;
    this.network.moveTo({
      position: { x: position.x + dx / scale, y: position.y + dy / scale },
      scale,
      animation: false,
    });
  }
  private fitNetwork(): void {
    this.zoomReturnView = undefined;
    if (!this.network) return;
    const map = this.shadowRoot?.getElementById("zigbee-network");
    if (!map || !map.clientWidth || !map.clientHeight) return;
    this.network.redraw();
    const view = containedView(
      (this.zigbeeData?.nodes ?? []).map((node) =>
        this.network!.getBoundingBox(node.id),
      ),
      map.clientWidth,
      map.clientHeight,
    );
    if (view) this.network.moveTo({ ...view, animation: false });
  }
  private drawLinkLabels(ctx: CanvasRenderingContext2D): void {
    if (!this.showLabels || !this.network || !this.zigbeeData) return;
    const network = this.network;
    const map = this.shadowRoot?.getElementById("zigbee-network");
    if (!map) return;
    const scale = network.getScale();
    const positions = network.getPositions();
    const obstacles = this.zigbeeData.nodes.map((node) => {
      const box = network.getBoundingBox(node.id);
      const top = network.canvasToDOM({ x: box.left, y: box.top });
      const bottom = network.canvasToDOM({ x: box.right, y: box.bottom });
      return { left: top.x, top: top.y, right: bottom.x, bottom: bottom.y };
    });
    const panel = this.config?.map_only
      ? this.shadowRoot?.querySelector<HTMLElement>("footer.map-info")
      : undefined;
    if (panel && !panel.hidden) {
      const mapBounds = map.getBoundingClientRect(),
        panelBounds = panel.getBoundingClientRect();
      obstacles.push({
        left: panelBounds.left - mapBounds.left,
        right: panelBounds.right - mapBounds.left,
        top: panelBounds.top - mapBounds.top,
        bottom: panelBounds.bottom - mapBounds.top,
      });
    }
    ctx.save();
    ctx.font = `${14 / scale}px system-ui, sans-serif`;
    const labels: LinkLabel[] = [];
    for (const edge of this.zigbeeData.edges) {
      if (!positions[edge.from] || !positions[edge.to]) continue;
      const text = compactSignal(edge.label, this.hass);
      labels.push({
        id: edge.id,
        text,
        width: ctx.measureText(text).width * scale,
        from: network.canvasToDOM(positions[edge.from]),
        to: network.canvasToDOM(positions[edge.to]),
      });
    }
    const placed = placeLinkLabels(
      labels,
      obstacles,
      map.clientWidth,
      map.clientHeight,
      this.orientation === "vertical",
    );
    const theme = getComputedStyle(this);
    const color = (name: string) => theme.getPropertyValue(name).trim();
    // Use the same theme tokens as HA's native tooltip for canvas labels.
    const background =
      color("--ha-tooltip-background-color") ||
      color("--ha-color-surface-default") ||
      color("--card-background-color") ||
      "#fff";
    const foreground =
      color("--ha-tooltip-text-color") ||
      color("--primary-text-color") ||
      this.textColor;
    const radius =
      parseFloat(
        color("--ha-tooltip-border-radius") || color("--ha-border-radius-md"),
      ) || 4;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const label of placed) {
      const center = network.DOMtoCanvas(label.center),
        anchor = network.DOMtoCanvas(label.anchor);
      const top = network.DOMtoCanvas({ x: label.left, y: label.top });
      ctx.strokeStyle = this.textColor;
      ctx.lineWidth = 0.5 / scale;
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(center.x, center.y);
      ctx.stroke();
      ctx.fillStyle = background;
      ctx.beginPath();
      ctx.roundRect(
        top.x,
        top.y,
        (label.right - label.left) / scale,
        (label.bottom - label.top) / scale,
        Math.min(radius, (label.bottom - label.top) / 2) / scale,
      );
      ctx.fill();
      ctx.fillStyle = foreground;
      ctx.fillText(label.text, center.x, center.y);
    }
    ctx.restore();
  }
  private toggleLabels(): void {
    this.showLabels = !this.showLabels;
    this.drawNetwork(true);
  }
  private tidyLayout(): void {
    if (!this.zigbeeData) return;
    this.zigbeeData = arrangeNetwork(this.zigbeeData, this.orientation);
    this.drawNetwork();
    this.fitNetwork();
  }
  private get layoutKey(): string {
    const key = `wiser-zigbee-layout:${JSON.stringify([location.pathname, this.config?.hub ?? "", this.config?.name ?? "Wiser Zigbee Network", this.config?.layout_id ?? ""])}`;
    return this.orientation === "vertical" ? `${key}:horizontal` : key;
  }
  private validPosition(value: any): { x: number; y: number } | undefined {
    return value && Number.isFinite(value.x) && Number.isFinite(value.y)
      ? { x: value.x, y: value.y }
      : undefined;
  }
  private exportLayout(): void {
    const layout = this.network?.getPositions();
    if (!layout) return;
    this.layoutYaml =
      `orientation: ${this.orientation}\nlayout_orientation: ${this.orientation}\nlayout_data:\n` +
      Object.entries(layout)
        .map(
          ([id, position]) =>
            `  ${JSON.stringify(id)}:\n    x: ${Math.round(position.x)}\n    y: ${Math.round(position.y)}`,
        )
        .join("\n");
  }
  private saveLayoutClick(): void {
    const layout = this.network?.getPositions();
    if (!layout || !this.config) return;
    try {
      localStorage.setItem(this.layoutKey, JSON.stringify(layout));
      this.layoutStatus = "layout.saved";
    } catch {
      this.layoutStatus = "layout.storage_error";
    }
    fireEvent(this, "wiser-zigbee-save-layout", {
      layout_data: layout,
      hub: this.config.hub,
      name: this.config.name,
      orientation: this.orientation,
      layout_id: this.config.layout_id,
    });
  }
  private renderZigbeeDetails(node: ZigbeeNode): TemplateResult {
    const attrs = this.selectedEntity
      ? this.hass?.states[this.selectedEntity]?.attributes
      : undefined;
    const parent = this.zigbeeData?.edges.find(
      (edge) => edge.from === node.id,
    )?.to;
    const deviceSignal = receptionMetrics(
      attrs?.device_reception_RSSI,
      attrs?.device_reception_LQI,
    );
    const hubSignal = receptionMetrics(
      attrs?.controller_reception_RSSI,
      attrs?.controller_reception_LQI,
    );
    const rows: [string, unknown][] = [
      ["zigbee.type", node.group],
      ["zigbee.node", node.id],
      ["zigbee.parent", parent],
      ["zigbee.channel", attrs?.zigbee_channel],
      [
        "zigbee.signal",
        attrs?.displayed_signal_strength
          ? localizeSignal(attrs.displayed_signal_strength, this.hass)
          : undefined,
      ],
      [
        "zigbee.device_rssi",
        deviceSignal.rssi == null ? undefined : `${deviceSignal.rssi} dBm`,
      ],
      ["zigbee.device_lqi", deviceSignal.lqi],
      [
        "zigbee.hub_rssi",
        hubSignal.rssi == null ? undefined : `${hubSignal.rssi} dBm`,
      ],
      ["zigbee.hub_lqi", hubSignal.lqi],
    ];
    return html`<div class="zigbee-details" aria-live="polite">
      ${rows
        .filter(([, value]) => value !== undefined && value !== null)
        .map(
          ([label, value]) =>
            html`<div class="connection">
              <span>${this.t(label)}</span><strong>${value}</strong>
            </div>`,
        )}
    </div>`;
  }
  private toggleViewMode(): void {
    if (!this.config) return;
    this.config = { ...this.config, map_only: !this.config.map_only };
  }
  private layoutIcon(
    key: string,
    path: string,
    click: () => void,
    pressed?: boolean,
    disabled = !this.network,
  ): TemplateResult {
    const label = this.t(key);
    const active =
      pressed ??
      (key === "common.refresh" ? this.loading : this.activeIcon === key);
    const activate = () => {
      if (disabled) return;
      if (pressed === undefined && key !== "common.refresh") {
        clearTimeout(this.activeIconTimer);
        this.activeIcon = key;
        this.activeIconTimer = setTimeout(() => {
          this.activeIcon = undefined;
        }, 500);
      }
      click();
    };
    return html`<ha-icon-button
      class="layout-icon"
      .label=${label}
      title=${label}
      .path=${path}
      .disabled=${disabled}
      .selected=${active}
      aria-pressed=${ifDefined(
        pressed === undefined ? undefined : String(pressed),
      )}
      @click=${activate}
    ></ha-icon-button>`;
  }
  protected render(): TemplateResult {
    const nodes = this.zigbeeData?.nodes ?? [];
    const edges = this.zigbeeData?.edges ?? [];
    const selected = nodes.find((node) => node.id === this.selected);
    const savePath =
      "M17,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M15,9H5V5H15V9Z";
    return html`<ha-card
      class=${[
        this.config?.map_only ? "map-only" : "",
        this.mapHeight === null ? "auto-height" : "",
      ].join(" ")}
    >
      <div class="brand-row">
        <div class="eyebrow">WISER · ZIGBEE</div>
        <div
          class="layout-actions"
          role="group"
          aria-label=${this.t("card.controls")}
        >
          ${this.layoutIcon(
            "common.refresh",
            "M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",
            () => {
              void this.loadData();
            },
            undefined,
            this.loading,
          )}
          ${this.layoutIcon(
            "card.fit",
            "M3 3H9V5H5V9H3V3M15 3H21V9H19V5H15V3M3 15H5V19H9V21H3V15M19 15H21V21H15V19H19V15Z",
            () => this.fitNetwork(),
          )}
          ${this.layoutIcon(
            "card.tidy",
            "M3 3H10V10H3V3M14 3H21V10H14V3M3 14H10V21H3V14M14 14H21V21H14V14Z",
            () => this.tidyLayout(),
          )}
          ${this.layoutIcon(
            "card.link_labels",
            "M17.63 5.84C17.27 5.33 16.67 5 16 5H5C3.9 5 3 5.9 3 7V17C3 18.1 3.9 19 5 19H16C16.67 19 17.27 18.67 17.63 18.16L22 12L17.63 5.84Z",
            () => this.toggleLabels(),
            this.showLabels,
          )}
          ${this.layoutIcon(
            "card.show_detailed_view",
            "M3 3H21V21H3V3M5 5V7H19V5H5M5 9V19H19V9H5Z",
            () => this.toggleViewMode(),
            !(this.config?.map_only ?? false),
            !this.config,
          )}
          ${this.layoutIcon("card.save_layout", savePath, () =>
            this.saveLayoutClick(),
          )}
        </div>
      </div>
      ${this.layoutStatus
        ? html`<p class="save-status" role="status">
            ${this.t(this.layoutStatus)}
          </p>`
        : ""}
      <header ?hidden=${this.config?.map_only}>
        <div>
          ${this.config?.name === ""
            ? ""
            : html`<h2>${this.config?.name ?? this.t("card.title")}</h2>`}
          <p>
            ${localizeCount("devices", nodes.length, this.hass)}
            <span>·</span> ${localizeCount(
              "connections",
              edges.length,
              this.hass,
            )}
          </p>
        </div>
      </header>
      <div class="map ${this.orientation}">
        <div
          id="zigbee-network"
          style=${this.mapHeight === null ? "" : `height: ${this.mapHeight}px`}
          @wheel=${this.panZoomedView}
          role="img"
          aria-label=${this.t(
            this.config?.map_only
              ? "map.accessible_only"
              : this.config?.show_device_list !== false
                ? "map.accessible_list"
                : "map.accessible_details",
          )}
        ></div>
        ${this.error
          ? html`<div class="message" role="alert">
              <ha-alert alert-type="error">${this.t(this.error)}</ha-alert>
            </div>`
          : this.loading
            ? html`<div class="message" role="status">
                ${this.t("card.updating")}
              </div>`
            : !nodes.length
              ? html`<div class="message">${this.t("card.empty")}</div>`
              : ""}
      </div>
      <footer
        class=${this.config?.map_only ? "map-info" : ""}
        ?hidden=${this.config?.map_only && !selected}
        aria-label=${selected
          ? this.deviceName(selected)
          : this.t("card.controls")}
      >
        ${selected
          ? html`<div class="selection">
                <strong>${this.deviceName(selected)}</strong> ${actionButton(
                  this.t("common.close"),
                  () => {
                    this.closeDeviceInfo();
                  },
                )}
              </div>
              ${this.renderZigbeeDetails(selected)}
              ${edges
                .filter(
                  (edge) =>
                    edge.from === selected.id || edge.to === selected.id,
                )
                .map(
                  (edge) =>
                    html`<div class="connection">
                      <span
                        >${this.deviceName(
                          nodes.find(
                            (node) =>
                              node.id ===
                              (edge.from === selected.id ? edge.to : edge.from),
                          ),
                        )}</span
                      ><strong>${localizeSignal(edge.label, this.hass)}</strong>
                    </div>`,
                )}`
          : html`<p class="hint">${this.t("card.hint")}</p>`}
        ${!this.config?.map_only && this.config?.show_layout_export !== false
          ? expansionPanel(
              this.t("layout.export_title"),
              html` <p>${this.t("layout.export_help")}</p>
                ${actionButton(this.t("layout.generate"), () =>
                  this.exportLayout(),
                )}
                ${this.layoutYaml
                  ? readonlyText(this.t("layout.yaml"), this.layoutYaml)
                  : ""}`,
            )
          : ""}
        ${!this.config?.map_only && this.config?.show_device_list !== false
          ? expansionPanel(
              this.t("layout.device_list"),
              html` ${nodes.map(
                (node) =>
                  html`<div class="device">
                    <strong>${this.deviceName(node)}</strong> ${edges
                      .filter((edge) => edge.from === node.id)
                      .map(
                        (edge) =>
                          html`<div class="connection">
                            <span
                              >→
                              ${this.deviceName(
                                nodes.find((peer) => peer.id === edge.to),
                              )}</span
                            ><span
                              >${localizeSignal(edge.label, this.hass)}</span
                            >
                          </div>`,
                      )}
                  </div>`,
              )}`,
            )
          : ""}
      </footer>
    </ha-card>`;
  }
  static styles = css`
    :host {
      display: block;
      min-width: 0;
      max-width: 100%;
      --wiser-muted: var(--secondary-text-color, #7d8795);
    }
    ha-card {
      display: block;
      overflow: hidden;
      border-radius: var(--ha-card-border-radius, 20px);
      color: var(--primary-text-color, #273448);
      background: var(--ha-card-background, var(--card-background-color, #fff));
    }
    :host(:has(ha-card.auto-height)) {
      height: 100%;
      min-height: 0;
    }
    ha-card.auto-height {
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
    }
    .auto-height > .brand-row,
    .auto-height > header,
    .auto-height > .save-status {
      flex-shrink: 0;
    }
    .auto-height .map {
      flex: 1 1 340px;
      min-height: 100px;
    }
    .auto-height #zigbee-network {
      position: absolute;
      inset: 0;
      height: 100%;
    }
    .auto-height > footer:not(.map-info) {
      flex: 0 1 auto;
      min-height: 0;
      max-height: 45%;
      overflow-y: auto;
    }
    [hidden] {
      display: none !important;
    }
    .brand-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
      justify-content: space-between;
      padding: 12px 12px 0 24px;
    }
    .layout-actions {
      display: flex;
      margin-left: auto;
    }
    .layout-icon {
      --ha-icon-button-size: 36px;
      --mdc-icon-button-size: 36px;
      --mdc-icon-size: 20px;
      --ha-icon-size: 20px;
      border-radius: 50%;
    }
    .brand-row .eyebrow {
      margin: 0;
    }
    .brand-row .layout-icon {
      color: var(--wiser-muted);
      --mdc-icon-button-icon-color: var(--wiser-muted);
    }
    .save-status {
      padding: 0 24px;
    }

    .map-only .map {
      margin: 4px 12px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 8px 24px 18px;
    }
    .eyebrow {
      font-size: 10px;
      letter-spacing: 1.8px;
      font-weight: 700;
      color: var(--wiser-muted);
      margin-bottom: 8px;
    }
    h2 {
      font-size: 20px;
      line-height: 1.3;
      font-weight: 600;
      margin: 0;
      letter-spacing: -0.4px;
    }
    p {
      margin: 8px 0 0;
      font-size: 12px;
      color: var(--wiser-muted);
    }
    p span {
      margin: 0 6px;
    }
    .map {
      position: relative;
      margin: 0 12px;
      background: transparent;
    }
    #zigbee-network {
      width: 100%;
      height: 340px;
    }
    .message {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      text-align: center;
      padding: 10px;
      border-radius: 8px;
      background: var(--card-background-color, #fff);
      font-size: 12px;
      pointer-events: none;
    }
    footer {
      padding: 16px 24px 20px;
    }
    ha-card.map-only {
      position: relative;
    }
    .map-only footer.map-info {
      position: absolute;
      z-index: 1;
      inset: auto 12px 12px;
      box-sizing: border-box;
      max-height: 60%;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 16px;
      border: 1px solid var(--divider-color);
      border-radius: var(--ha-card-border-radius, 12px);
      background: var(--ha-card-background, var(--card-background-color, #fff));
      color: var(--primary-text-color);
      box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgb(0 0 0 / 15%));
    }
    .map-info .selection {
      position: sticky;
      top: -16px;
      padding: 8px 0;
      background: var(--ha-card-background, var(--card-background-color, #fff));
    }
    .hint {
      margin: 0;
      line-height: 1.5;
    }
    .selection,
    .connection {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      font-size: 12px;
    }
    .connection {
      padding: 8px 0;
      color: var(--wiser-muted);
    }
    .connection strong {
      font-weight: 500;
      text-align: right;
    }
    ha-expansion-panel {
      display: block;
      margin-top: 14px;
      --ha-card-background: transparent;
    }
    .panel-content {
      padding: 0 12px 12px;
    }
    ha-textarea {
      display: block;
      width: 100%;
      margin-top: 12px;
    }
    ha-button {
      flex-shrink: 0;
    }
    .panel-content ha-button {
      margin-top: 12px;
    }
    .device {
      border-top: 1px solid var(--divider-color);
      padding: 12px 0;
    }
    @media (max-width: 400px) {
      [hidden] {
        display: none !important;
      }
      .map-brand {
        padding: 24px 24px 0;
      }
      .map-only .map {
        margin: 4px 12px;
      }
      header {
        padding: 20px 16px 16px;
      }
      footer {
        padding: 16px;
      }
      h2 {
        font-size: 18px;
      }
    }
  `;
}

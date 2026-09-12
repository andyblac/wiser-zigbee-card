import { buttonConfirmation } from "./action-confirmation";
import { copyText } from "./copy-text";
import { MapMagnifier } from "./map-magnifier";
import { saveCardConfig } from "./save-config";
import { disconnectedDevice, statusImage, deviceMapLabel } from "./device-appearance";
import { separateAreas } from "./area-spacing";
import { signalColor, signalPalette } from "./signal-color";
import { LitElement, html, TemplateResult, PropertyValues, css } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { state, eventOptions } from "lit/decorators.js";
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
import { areaGraph, visibleAreaGraph, AREA_NODE_IMAGE } from "./area-graph";
import { withDeviceAreas } from "./areas";
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
  watchNativeElements,
} from "./native-ui";
import "./editor";
import "./wiser-zigbee-panel.js";
import { containedView } from "./fit";
import { placeLinkLabels, LinkLabel } from "./link-labels";
import { deviceInfoEntity, receptionMetrics } from "./device-info";

(window as any).customCards = (window as any).customCards || [];
if (!(window as any).customCards.some((card: { type: string }) => card.type === "wiser-zigbee-card")) (window as any).customCards.push({
  type: "wiser-zigbee-card",
  name: "Wiser Zigbee Card",
  description: localize("card.description"),
});

declare global {
  interface HASSDomEvents {
    "wiser-zigbee-save-layout": {
      layout_data: any;
      show_labels?: boolean;
      map_only?: boolean;
      preferences_only?: boolean;
      magnifier?: boolean;
      hub?: string;
      name?: string;
      orientation?: "horizontal" | "vertical" | "pie";
      layout_id?: string;
      group_by?: "none" | "area";
    };
  }
}

export class WiserZigbeeCard
  extends SubscribeMixin(LitElement)
  implements LovelaceCard
{
  static panelApiVersion = 1;
  @state() private config?: WiserZigbeeCardConfig;
  @state() private zigbeeData?: zigbeeData;
  @state() private loading = false;
  @state() private error = "";
  @state() private showLabels = false;
  private hoveredEdge?: string;
  private suppliedConfig?: WiserZigbeeCardConfig;
  private savingConfig = false;
  private magnifier = new MapMagnifier();
  private magnifierHoldTimer?: ReturnType<typeof setTimeout>;
  private magnifierHeld = false;
  @state() private activeIcon?: string;
  private activeIconTimer?: ReturnType<typeof setTimeout>;
  @state() private selected?: number;
  @state() private selectedEntity?: string;
  @state() private layoutStatus = "";
  private textColor = "";
  private statusPalette = "";
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
  private mapData?: zigbeeData;
  private collapsedAreas = new Set<string>();
  private areaPositions: Record<string, { x: number; y: number }> = {};
  private get visibleData(): zigbeeData | undefined {
    const data = this.mapData ?? this.zigbeeData;
    return data && this.config?.group_by === "area"
      ? visibleAreaGraph(data, this.collapsedAreas)
      : data;
  }
  private areaDrag?: {
    headerId: number;
    origin: { x: number; y: number };
    members: Record<string, { x: number; y: number }>;
    dx: number;
    dy: number;
  };
  private infoRequest = 0;
  private deviceTapTimer?: ReturnType<typeof setTimeout>;
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
    this.magnifier.hide();
    this.suppliedConfig = config;
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
    this.showLabels = config.show_labels ?? false;
    if (config.map_only === undefined) {
      try {
        const saved = localStorage.getItem(`${this.layoutKey}:map-only`);
        if (saved !== null) this.config.map_only = saved === "true";
      } catch {}
    }
    if (config.show_labels === undefined) {
      try { this.showLabels = localStorage.getItem(`${this.layoutKey}:labels`) === "true"; } catch {}
    }
    if (onlyHeightChanged) {
      this.fitAfterHeightChange ||= previousHeight !== this.mapHeight;
      return;
    }
    this.cancelDeviceInfo();
    this.areaDrag = undefined;
    this.mapData = undefined;
    this.collapsedAreas.clear();
    this.areaPositions = {};
    this.fitAfterHeightChange = false;
    this.network?.destroy();
    this.network = undefined;
    this.infoReturnView = undefined;
    this.zoomReturnView = undefined;
    this.layoutStatus = "";
    this.pendingLoad = true;
    this.requestId++;
  }
  private get orientation(): "horizontal" | "vertical" | "pie" {
    return this.config?.orientation === "pie" ? "pie" : this.config?.orientation === "horizontal" ? "horizontal" : "vertical";
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
    clearTimeout(this.magnifierHoldTimer);
    this.magnifier.hide();
    clearTimeout(this.activeIconTimer);
    this.activeIcon = undefined;
    this.cancelDeviceInfo();
    super.disconnectedCallback();
    this.requestId++;
    this.network?.destroy();
    this.network = undefined;
    this.areaDrag = undefined;
    this.infoReturnView = undefined;
    this.zoomReturnView = undefined;
  }
  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    this.positionAreaIcons();
    if (changed.has("hass") && this.network) {
      const color =
        getComputedStyle(this)
          .getPropertyValue("--primary-text-color")
          .trim() || "#273448";
      if (
        color !== this.textColor ||
        signalPalette(getComputedStyle(this)) !== this.statusPalette ||
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
      let source = await fetchZigbeeData(this.hass, this.config.hub);
      if (this.config.group_by === "area")
        source = await withDeviceAreas(this.hass, source, this.config.hub);
      const data = arrangeNetwork(
        this.config.group_by === "area"
          ? areaGraph(source, this.t("card.unassigned_area"))
          : source,
        this.orientation,
        undefined,
        this.config.group_by,
      );
      if (request !== this.requestId || !this.isConnected) return;
      let saved =
        (this.config.layout_orientation ?? this.orientation) === this.orientation &&
        (this.config.layout_group_by ?? this.config.group_by ?? "none") ===
          (this.config.group_by ?? "none")
          ? this.config.layout_data
          : undefined;
      // Dashboard configuration is shared across browsers. Local positions
      // are only a fallback for cards without a compatible configured layout.
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
        try {
          const stored = JSON.parse(
            localStorage.getItem(this.layoutKey) || "null",
          );
          if (stored && typeof stored === "object" && !Array.isArray(stored))
            saved = stored;
        } catch {
          /* The automatic layout remains available. */
        }
      }
      const positions = {
        ...this.areaPositions,
        ...this.network?.getPositions(),
      };
      data.nodes = data.nodes.map((node) => ({
        ...node,
        ...(positions?.[node.id] ??
          this.validPosition(
            saved && typeof saved === "object" ? saved[node.id] : undefined,
          )),
      }));
      this.zigbeeData = this.config.group_by === "area" ? source : data;
      this.mapData = data;
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
      ? { ...this.areaPositions, ...this.network?.getPositions() }
      : undefined;
    const visible = this.visibleData!;
    if (preservePositions && this.config?.group_by === "area")
      this.areaPositions = positions ?? {};
    const textColor =
      getComputedStyle(this).getPropertyValue("--primary-text-color").trim() ||
      "#273448";
    this.textColor = textColor;
    const theme = getComputedStyle(this);
    this.statusPalette = signalPalette(theme);
    const mode = this.config?.link_status ?? "links";
    const colorLinks = mode === "links" || mode === "both";
    const colorIcons = mode === "icons" || mode === "both";
    this.displayLanguage = languageFor(this.hass);
    const data = {
      nodes: visible.nodes.map((node) => {
        const offline = disconnectedDevice(node, this.zigbeeData!);
        const status = offline ? "Offline" : this.zigbeeData!.edges.find((edge) => edge.from === node.id)?.label;
        const tint = colorIcons && node.group !== "Area" && node.group !== "Controller"
          ? signalColor(status, true, theme) : undefined;
        const artwork = node.group === "Area" ? AREA_NODE_IMAGE : (DEVICE_IMAGES[node.group] ?? FALLBACK_DEVICE_IMAGE);
        return {
        ...node,
        ...(positions?.[node.id] ?? {}),
        shape: "image",
        image: statusImage(artwork, tint, offline),
        brokenImage: statusImage(FALLBACK_DEVICE_IMAGE, tint, offline),
        size: 32,
        label:
          node.group === "Area"
            ? `${node.label} ${this.collapsedAreas.has(node.area_id ?? "") ? "▸" : "▾"}`
            : node.group === "Controller"
              ? this.deviceName(node)
              : deviceMapLabel(node.label),
        font: { color: textColor },
      };
      }),
      edges: visible.edges.map((edge) => {
        const color = signalColor(edge.label, colorLinks, theme);
        return {
          ...edge,
          label: "",
          color: { color, highlight: color, hover: color, inherit: false },
        };
      }),
    };
    if (this.network) {
      // setData triggers vis-network's initial fit even with physics disabled.
      // Capture at redraw time so interactions during the fetch are preserved.
      const view = {
        position: this.network.getViewPosition(),
        scale: this.network.getScale(),
      };
      this.hoveredEdge = undefined;
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
              forceDirection: this.orientation === "pie" ? "none" : this.orientation,
              roundness: 0.45,
            },
          },
        },
      );
      this.network.on("hoverEdge", (event) => this.hoverLink(event.edge));
      this.network.on("blurEdge", () => this.hoverLink());
      this.network.on("click", (event) => this.deviceClick(event.nodes[0]));
      this.network.on("hold", (event) => this.deviceHold(event.nodes[0]));
      this.network.on("doubleClick", (event) => {
        this.cancelDeviceInfo();
        this.toggleDeviceZoom(event.nodes[0], event.pointer?.canvas);
      });
      this.network.on("beforeDrawing", (ctx) => {
        this.moveAreaDevices();
        this.drawAreaGroups(ctx);
      });
      this.network.on("afterDrawing", (ctx) => {
        this.positionAreaIcons();
        this.drawLinkLabels(ctx);
        this.magnifier.refresh();
      });
      this.network.on("dragStart", (event) =>
        this.startAreaDrag(event.nodes[0]),
      );
      this.network.on("dragEnd", () => {
        this.moveAreaDevices();
        this.areaDrag = undefined;
      });
      this.network.on("resize", () => this.fitNetwork());
      this.fitNetwork();
      this.requestUpdate();
    }
  }
  private startAreaDrag(nodeId?: number): void {
    this.closeDeviceInfo(false);
    this.areaDrag = undefined;
    if (!this.network || this.config?.group_by !== "area") return;
    const header = this.mapData?.nodes.find(
      (node) => node.id === nodeId && node.group === "Area",
    );
    if (!header) return;
    const positions = this.currentPositions()!;
    const members: Record<string, { x: number; y: number }> = {};
    for (const node of this.mapData!.nodes) {
      if (
        node.group !== "Area" &&
        node.group !== "Controller" &&
        (node.area_id ?? "") === (header.area_id ?? "") &&
        positions[node.id]
      )
        members[node.id] = { ...positions[node.id] };
    }
    this.areaDrag = {
      headerId: header.id,
      origin: { ...positions[header.id] },
      members,
      dx: 0,
      dy: 0,
    };
  }
  private moveAreaDevices(): void {
    const drag = this.areaDrag;
    if (!drag || !this.network) return;
    const visible = this.network.getPositions();
    const header = visible[drag.headerId];
    if (!header) return;
    const dx = header.x - drag.origin.x,
      dy = header.y - drag.origin.y;
    if (dx === drag.dx && dy === drag.dy) return;
    drag.dx = dx;
    drag.dy = dy;
    this.areaPositions[drag.headerId] = { ...header };
    for (const [id, origin] of Object.entries(drag.members)) {
      const position = { x: origin.x + dx, y: origin.y + dy };
      this.areaPositions[id] = position;
      if (visible[id])
        this.network.moveNode(Number(id), position.x, position.y);
    }
  }
  private areaBounds(ctx?: CanvasRenderingContext2D): Array<{
    left: number;
    right: number;
    top: number;
    bottom: number;
  }> {
    if (!this.network || this.config?.group_by !== "area") return [];
    const nodes = this.visibleData?.nodes ?? [];
    const measure = ctx ?? document.createElement("canvas").getContext("2d");
    const positions = this.network.getPositions();
    const keys = new Set(
      nodes
        .filter((node) => node.group === "Area")
        .map((node) => node.area_id ?? ""),
    );
    return [...keys].map((key) => {
      const members = nodes.filter(
        (node) => node.group !== "Controller" && (node.area_id ?? "") === key,
      );
      const boxes = members.map((node) => {
          const position = positions[node.id];
          if (!position) return this.network!.getBoundingBox(node.id);
          // vis caches label bounds from the previous draw, which can span
          // old and new positions after a layout change. Use current positions.
          const box = { left: position.x - 32, right: position.x + 32,
            top: position.y - 32, bottom: position.y + 60 };
          if (!measure) return box;
          const label = node.group === "Area"
            ? `${node.label} ${this.collapsedAreas.has(node.area_id ?? "") ? "▸" : "▾"}`
            : deviceMapLabel(node.label);
          // Image bounds can omit labels before vis has drawn them. Measure
          // explicitly so the first frame, dragging and fit include the text.
          measure.save();
          measure.font = "bold 14px system-ui, sans-serif";
          const lines = label.split("\n");
          const halfWidth = Math.max(...lines.map((line) => measure.measureText(line).width)) / 2;
          measure.restore();
          box.left = Math.min(box.left, position.x - halfWidth);
          box.right = Math.max(box.right, position.x + halfWidth);
          box.bottom = Math.max(box.bottom, position.y + 32 + 14 * (lines.length + 1));
          return box;
        });
      const headerIndex = members.findIndex((node) => node.group === "Area");
      const header = members[headerIndex];
      const position = header && positions[header.id];
      const deviceBoxes = boxes.filter((_, index) => index !== headerIndex);
      if (position && deviceBoxes.length && !this.areaDrag && this.orientation === "vertical") {
        const center = (Math.min(...deviceBoxes.map((box) => box.left)) +
          Math.max(...deviceBoxes.map((box) => box.right))) / 2;
        const dx = center - position.x;
        if (Math.abs(dx) > 0.01) {
          // Move the actual node so its label and drag target follow the icon.
          this.network!.moveNode(header.id, center, position.y);
          this.areaPositions[header.id] = { x: center, y: position.y };
          boxes[headerIndex].left += dx;
          boxes[headerIndex].right += dx;
        }
      }
      return {
        left: Math.min(...boxes.map((box) => box.left)) - 18,
        right: Math.max(...boxes.map((box) => box.right)) + 18,
        top: Math.min(...boxes.map((box) => box.top)) - 18,
        bottom: Math.max(...boxes.map((box) => box.bottom)) + 18,
      };
    });
  }
  private drawAreaGroups(ctx: CanvasRenderingContext2D): void {
    const bounds = this.areaBounds(ctx);
    if (!bounds.length || !this.network) return;
    const theme = getComputedStyle(this);
    const color =
      theme.getPropertyValue("--primary-text-color").trim() || this.textColor;
    ctx.save();
    for (const box of bounds) {
      ctx.beginPath();
      ctx.roundRect(
        box.left,
        box.top,
        box.right - box.left,
        box.bottom - box.top,
        14,
      );
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.04;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 / this.network.getScale();
      ctx.globalAlpha = 0.22;
      ctx.stroke();
    }
    ctx.restore();
  }
  private positionAreaIcons(): void {
    if (!this.network || this.config?.group_by !== "area") return;
    const positions = this.network.getPositions();
    const size = 64 * this.network.getScale();
    this.shadowRoot
      ?.querySelectorAll<HTMLElement>(".area-icons ha-icon")
      .forEach((icon) => {
        const position = positions[Number(icon.dataset.node)];
        if (!position) return;
        const point = this.network!.canvasToDOM(position);
        icon.style.left = `${point.x}px`;
        icon.style.top = `${point.y}px`;
        icon.style.width = `${size}px`;
        icon.style.height = `${size}px`;
        icon.style.setProperty("--mdc-icon-size", `${size}px`);
        icon.style.setProperty("--ha-icon-size", `${size}px`);
      });
  }
  private cancelDeviceInfo(): void {
    clearTimeout(this.deviceTapTimer);
    this.deviceTapTimer = undefined;
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
  private deviceClick(nodeId?: number): void {
    clearTimeout(this.deviceTapTimer);
    if (nodeId === undefined) {
      this.closeDeviceInfo();
      return;
    }
    // Wait for the double-click gesture before opening and centring details.
    this.deviceTapTimer = setTimeout(() => {
      const node = this.mapData?.nodes.find((item) => item.id === nodeId);
      if (node?.group === "Area") this.toggleArea(node.area_id ?? "");
      else this.showDeviceDetails(nodeId);
    }, 300);
  }
  private toggleArea(area: string): void {
    this.closeDeviceInfo(false);
    this.areaPositions = {
      ...this.areaPositions,
      ...this.network?.getPositions(),
    };
    if (this.collapsedAreas.has(area)) this.collapsedAreas.delete(area);
    else this.collapsedAreas.add(area);
    this.drawNetwork(true);
  }
  private async deviceHold(nodeId?: number): Promise<void> {
    this.closeDeviceInfo();
    const node = this.zigbeeData?.nodes.find((item) => item.id === nodeId);
    if (!node || !this.hass) return;
    const request = this.infoRequest;
    try {
      const entityId = await deviceInfoEntity(
        this.hass,
        node,
        this.config?.hub,
      );
      if (entityId && request === this.infoRequest && this.isConnected)
        fireEvent(this, "hass-more-info", { entityId });
    } catch {
      // A normal tap still provides map details if the entity is unavailable.
    }
  }
  private showDeviceDetails(nodeId?: number): void {
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
  private zoomStep(factor: number): void {
    if (!this.network) return;
    this.prepareGestureZoom();
    this.network.moveTo({
      position: this.network.getViewPosition(),
      scale: Math.min(10, Math.max(0.01, this.network.getScale() * factor)),
      animation: false,
    });
  }
  private prepareGestureZoom(): void {
    if (!this.network) return;
    this.closeDeviceInfo(false);
    this.zoomReturnView ??= {
      position: this.network.getViewPosition(),
      scale: this.network.getScale(),
    };
  }
  @eventOptions({ capture: true, passive: true })
  private touchZoomStart(event: TouchEvent): void {
    if (event.touches.length >= 2) this.prepareGestureZoom();
  }
  @eventOptions({ capture: true, passive: false })
  private panZoomedView(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) {
      // Trackpad pinch arrives as a modified wheel; let vis zoom at its centre.
      this.prepareGestureZoom();
      return;
    }
    // Keep ordinary scrolling out of vis's wheel-zoom handler.
    event.stopPropagation();
    if (!this.network || !this.zoomReturnView) return;
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
      [
        ...(this.visibleData?.nodes ?? []).map((node) =>
          this.network!.getBoundingBox(node.id),
        ),
        ...this.areaBounds(),
      ],
      map.clientWidth,
      map.clientHeight,
    );
    if (view) this.network.moveTo({ ...view, animation: false });
  }
  private hoverLink(edgeId?: string): void {
    if (this.hoveredEdge === edgeId) return;
    this.hoveredEdge = edgeId;
    if (!this.showLabels) this.network?.redraw();
  }
  private drawLinkLabels(ctx: CanvasRenderingContext2D): void {
    if ((!this.showLabels && this.hoveredEdge === undefined) || !this.network || !this.zigbeeData) return;
    const network = this.network;
    const map = this.shadowRoot?.getElementById("zigbee-network");
    if (!map) return;
    const scale = network.getScale();
    const positions = network.getPositions();
    const obstacles = this.visibleData!.nodes.map((node) => {
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
    for (const edge of this.visibleData!.edges) {
      if (!edge.label || (!this.showLabels && edge.id !== this.hoveredEdge)) continue;
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
    this.saveLayoutClick(true);
  }
  private tidyLayout(): void {
    if (!this.zigbeeData) return;
    this.mapData = arrangeNetwork(
      this.mapData ?? this.zigbeeData,
      this.orientation,
      this.network?.getPositions(),
      this.config?.group_by,
    );
    this.areaPositions = {};
    if (this.config?.group_by !== "area") this.zigbeeData = this.mapData;
    this.closeDeviceInfo(false);
    this.areaDrag = undefined;
    this.drawNetwork();
    this.spaceRenderedAreas();
    this.fitNetwork();
  }
  private spaceRenderedAreas(): void {
    if (!this.network || this.config?.group_by !== "area" || this.orientation !== "pie") return;
    this.network.redraw();
    const source = this.visibleData!;
    const positions = this.network.getPositions();
    const nodes = source.nodes.map((node) => ({ ...node, ...positions[node.id] }));
    const keys = [...new Set(source.nodes.filter((node) => node.group === "Area").map((node) => node.area_id ?? ""))];
    const outlines = this.areaBounds();
    const byArea = new Map(keys.map((key, index) => [key, outlines[index]]));
    const repeaters = new Set(source.edges.map((edge) => edge.to));
    separateAreas(nodes, repeaters, (members) => {
      const first = members[0];
      const initial = positions[first.id];
      const dx = first.x - initial.x, dy = first.y - initial.y;
      const box = first.group === "Controller" ? this.network!.getBoundingBox(first.id)
        : byArea.get(first.area_id ?? "")!;
      return { left: box.left + dx, right: box.right + dx,
        top: box.top + dy, bottom: box.bottom + dy };
    });
    for (const node of nodes) {
      if (node.x === positions[node.id].x && node.y === positions[node.id].y) continue;
      this.network.moveNode(node.id, node.x, node.y);
      this.areaPositions[node.id] = { x: node.x, y: node.y };
      const stored = this.mapData?.nodes.find((item) => item.id === node.id);
      if (stored) { stored.x = node.x; stored.y = node.y; }
    }
    this.network.redraw();
  }
  private get layoutKey(): string {
    const key = `wiser-zigbee-layout:${JSON.stringify([location.pathname, this.config?.hub ?? "", this.config?.name ?? "Wiser Zigbee Network", this.config?.layout_id ?? ""])}`;
    const oriented =
      this.orientation === "pie" ? `${key}:pie` : this.orientation === "vertical" ? `${key}:horizontal` : key;
    return this.config?.group_by === "area"
      ? `${oriented}:area-topology`
      : oriented;
  }
  private validPosition(value: any): { x: number; y: number } | undefined {
    return value && Number.isFinite(value.x) && Number.isFinite(value.y)
      ? { x: value.x, y: value.y }
      : undefined;
  }
  private currentPositions():
    | Record<string, { x: number; y: number }>
    | undefined {
    if (!this.network) return undefined;
    const positions: Record<string, { x: number; y: number }> = {};
    for (const node of this.mapData?.nodes ?? [])
      positions[node.id] = { x: node.x, y: node.y };
    return {
      ...positions,
      ...this.areaPositions,
      ...this.network.getPositions(),
    };
  }
  private prepareConfirmation(action: string, message: "common.copied" | "common.saved"): () => void {
    return buttonConfirmation(
      this.shadowRoot?.querySelector<HTMLElement>(`[data-action="${action}"]`) ?? null,
      this.t(message),
    );
  }
  private async copyLayout(): Promise<void> {
    const confirm = this.prepareConfirmation("common.copy", "common.copied");
    const layout = this.currentPositions();
    if (!layout) return;
    const yaml =
      `magnifier: ${this.config?.magnifier ?? false}\nshow_labels: ${this.showLabels}\nmap_only: ${this.config?.map_only ?? false}\norientation: ${this.orientation}\ngroup_by: ${this.config?.group_by ?? "none"}\nlayout_data:\n` +
      Object.entries(layout)
        .map(
          ([id, position]) =>
            `  ${JSON.stringify(id)}:\n    x: ${Math.round(position.x)}\n    y: ${Math.round(position.y)}`,
        )
        .join("\n");
    try {
      await copyText(yaml);
      this.layoutStatus = "";
      confirm();
    } catch {
      this.layoutStatus = "layout.copy_error";
    }
  }
  private async saveLayoutClick(preferencesOnly = false): Promise<void> {
    const layout = this.currentPositions();
    if (!layout || !this.config) return;
    const confirm = preferencesOnly ? () => {} : this.prepareConfirmation("card.save_layout", "common.saved");
    try {
      if (!preferencesOnly) localStorage.setItem(this.layoutKey, JSON.stringify(layout));
      localStorage.setItem(`${this.layoutKey}:labels`, JSON.stringify(this.showLabels));
      localStorage.setItem(`${this.layoutKey}:map-only`, JSON.stringify(this.config.map_only ?? false));
      this.layoutStatus = "";
    } catch {
      this.layoutStatus = "layout.storage_error";
    }
    if (!preferencesOnly && !is_preview(this)) {
      if (this.savingConfig || !this.suppliedConfig) return;
      this.savingConfig = true;
      try {
        this.suppliedConfig = await saveCardConfig(this, this.suppliedConfig, {
          show_labels: this.showLabels,
          magnifier: this.config.magnifier ?? false,
          map_only: this.config.map_only ?? false,
          layout_data: layout,
          orientation: this.orientation,
          group_by: this.config.group_by ?? "none",
          layout_orientation: undefined,
          layout_group_by: undefined,
        }) as WiserZigbeeCardConfig;
        this.config = { ...this.suppliedConfig, auto_update: this.suppliedConfig.auto_update ?? true };
        this.layoutStatus = "";
        confirm();
      } catch {
        this.layoutStatus = "layout.config_save_error";
      } finally {
        this.savingConfig = false;
      }
      return;
    }
    fireEvent(this, "wiser-zigbee-save-layout", {
      layout_data: layout,
      show_labels: this.showLabels,
      map_only: this.config.map_only ?? false,
      magnifier: this.config.magnifier ?? false,
      preferences_only: preferencesOnly,
      hub: this.config.hub,
      name: this.config.name,
      orientation: this.orientation,
      layout_id: this.config.layout_id,
      group_by: this.config.group_by ?? "none",
    });
    if (!preferencesOnly && !this.layoutStatus) confirm();
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
    this.saveLayoutClick(true);
  }
  private async openMagnifierMenu(anchor: HTMLElement): Promise<void> {
    clearTimeout(this.magnifierHoldTimer);
    this.magnifierHeld = true;
    const menu = this.shadowRoot?.querySelector<any>("#magnifier-menu");
    if (!menu) return;
    await menu.updateComplete;
    menu.anchorElement = anchor.querySelector("ha-icon-button");
    menu.open = true;
  }
  private magnifierControl(): TemplateResult {
    return html`<span
      @pointerdown=${(event: PointerEvent) => {
        if (!this.network || event.button !== 0) return;
        clearTimeout(this.magnifierHoldTimer);
        this.magnifierHeld = false;
        const anchor = event.currentTarget as HTMLElement;
        this.magnifierHoldTimer = setTimeout(() => void this.openMagnifierMenu(anchor), 500);
      }}
      @pointerup=${() => clearTimeout(this.magnifierHoldTimer)}
      @pointerleave=${() => clearTimeout(this.magnifierHoldTimer)}
      @pointercancel=${() => clearTimeout(this.magnifierHoldTimer)}
      @contextmenu=${(event: Event) => {
        event.preventDefault();
        if (this.network) void this.openMagnifierMenu(event.currentTarget as HTMLElement);
      }}
      @keydown=${(event: KeyboardEvent) => {
        if (event.key === "ArrowDown" && this.network) {
          event.preventDefault();
          void this.openMagnifierMenu(event.currentTarget as HTMLElement);
        }
      }}
    >${this.layoutIcon(
            "editor.magnifier",
            "M9.5 3a6.5 6.5 0 1 0 3.98 11.64L19.85 21 21 19.85l-6.36-6.37A6.5 6.5 0 0 0 9.5 3m0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9m-1 1v2.5H6V10h2.5v2.5H10V10h2.5V8.5H10V6Z",
            () => {
              this.config = { ...this.config!, magnifier: !this.config?.magnifier };
              this.magnifier.hide();
              void this.saveLayoutClick(true);
            },
            this.config?.magnifier ?? false,
          )}</span>
    <ha-dropdown id="magnifier-menu" placement="bottom-end"
      @wa-select=${(event: CustomEvent) => {
        this.magnifier.setZoom(Number(event.detail.item.value));
        this.requestUpdate();
      }}
      @wa-after-hide=${() => {
        const menu = this.shadowRoot?.querySelector<any>("#magnifier-menu");
        if (menu?.anchorElement) menu.anchorElement.selected = this.config?.magnifier ?? false;
      }}
    >
      <div class="magnifier-options">
      <div class="magnifier-zoom-options">
      ${[2, 3, 4].map((zoom) => html`<ha-dropdown-item
        .value=${String(zoom)} .selected=${this.magnifier.zoom === zoom}
      >${zoom}×</ha-dropdown-item>`)}
      </div>
      <div class="lens-size-control"
        @click=${(event: Event) => event.stopPropagation()}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key !== "Escape" && event.key !== "Tab") event.stopPropagation();
        }}
      >
        <ha-slider orientation="vertical" tooltip-placement="right"
          aria-label=${this.t("editor.lens_size")}
          .min=${100} .max=${360} .step=${10}
          .value=${this.magnifier.size}
          @input=${(event: Event) => {
            this.magnifier.setSize(Number((event.target as HTMLInputElement).value));
            this.requestUpdate();
          }}
        ></ha-slider>
        <span>${this.magnifier.size} px</span>
      </div>
      </div>
    </ha-dropdown>`;
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
      if (key === "editor.magnifier" && this.magnifierHeld) {
        this.magnifierHeld = false;
        return;
      }
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
      data-action=${key}
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
            "card.zoom_in",
            "M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z",
            () => this.zoomStep(1.1),
          )}
          ${this.layoutIcon("card.zoom_out", "M19 13H5V11H19V13Z", () =>
            this.zoomStep(0.8),
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
          ${this.magnifierControl()}
          ${this.layoutIcon(
            "card.show_detailed_view",
            "M3 3H21V21H3V3M5 5V7H19V5H5M5 9V19H19V9H5Z",
            () => this.toggleViewMode(),
            !(this.config?.map_only ?? false),
            !this.config,
          )}
          ${this.layoutIcon(
            "common.copy",
            "M19 21H8V7H19M19 5H8A2 2 0 0 0 6 7V21A2 2 0 0 0 8 23H19A2 2 0 0 0 21 21V7A2 2 0 0 0 19 5M16 1H4A2 2 0 0 0 2 3V17H4V3H16Z",
            () => void this.copyLayout(),
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
          @pointermove=${(event: PointerEvent) => {
            if (this.config?.magnifier) this.magnifier.show(event.currentTarget as HTMLElement, event);
          }}
          @pointerleave=${() => this.magnifier.hide()}
          @pointerdown=${() => this.magnifier.hide()}
          @wheel=${this.panZoomedView}
          @touchstart=${this.touchZoomStart}
          role="img"
          aria-label=${this.t(
            this.config?.map_only
              ? "map.accessible_only"
              : this.config?.show_device_list !== false
                ? "map.accessible_list"
                : "map.accessible_details",
          )}
        ></div>
        ${this.config?.group_by === "area"
          ? html`
              <div class="area-icons" aria-hidden="true">
                ${(this.visibleData?.nodes ?? [])
                  .filter((node) => node.group === "Area")
                  .map(
                    (node) => html`
                      <ha-icon
                        data-node=${node.id}
                        .icon=${node.area_icon || "mdi:floor-plan"}
                      ></ha-icon>
                    `,
                  )}
              </div>
            `
          : ""}
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
      flex-wrap: wrap;
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
    .area-icons {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      color: var(--primary-text-color);
    }
    .area-icons ha-icon, .magnifier-area-icons ha-icon {
      position: absolute;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    #magnifier-menu { position: absolute; }
    .magnifier-options { display: flex; align-items: stretch; }
    .magnifier-zoom-options { width: 64px; display: flex; flex-direction: column; }
    .lens-size-control {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 4px 8px;
      border-left: 1px solid var(--divider-color);
      color: var(--primary-text-color);
    }
    .lens-size-control ha-slider {
      display: block;
      width: 36px;
      min-width: 0;
      height: 80px;
      min-height: 0;
      flex: none;
    }
    .lens-size-control ha-slider::part(slider) {
      justify-content: center;
      padding: 8px 0;
      margin: 0;
    }
    .lens-size-control ha-slider::part(track) { height: 64px; }
    .lens-size-control span { font-size: 12px; color: var(--secondary-text-color); }
    .map-magnifier {
      position: absolute;
      z-index: 2;
      overflow: hidden;
      border-radius: 50%;
      outline: 2px solid var(--primary-color);
      box-shadow: 0 3px 12px rgb(0 0 0 / 35%);
      background: var(--ha-card-background, var(--card-background-color, #fff));
      pointer-events: none;
    }
    .magnifier-area-icons {
      position: absolute;
      left: 0;
      top: 0;
      transform-origin: 0 0;
      color: var(--primary-text-color);
      pointer-events: none;
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

if (!customElements.get("wiser-zigbee-card")) {
  customElements.define("wiser-zigbee-card", WiserZigbeeCard);
}

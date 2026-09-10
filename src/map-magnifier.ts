const SIZE = 180;
const ZOOM_KEY = "wiser-zigbee-magnifier-zoom";
export function lensGeometry(x: number, y: number, width: number, height: number, zoom = 2) {
  const size = Math.min(SIZE, width, height);
  const left = Math.max(0, Math.min(width - size, x - size / 2));
  const top = Math.max(0, Math.min(height - size, y - size / 2));
  return { size, left, top, imageX: size / 2 - x * zoom, imageY: size / 2 - y * zoom };
}

export class MapMagnifier {
  public zoom = 2;
  constructor() {
    try {
      const saved = Number(localStorage.getItem(ZOOM_KEY));
      if ([2, 3, 4].includes(saved)) this.zoom = saved;
    } catch {}
  }
  setZoom(value: number): void {
    if (![2, 3, 4].includes(value)) return;
    this.zoom = value;
    try { localStorage.setItem(ZOOM_KEY, String(value)); } catch {}
    this.refresh();
  }
  private lens?: HTMLDivElement;
  private map?: HTMLElement;
  private point?: { x: number; y: number };
  private frame?: number;

  show(map: HTMLElement, event: PointerEvent): void {
    if (event.pointerType === "touch" || event.buttons) { this.hide(); return; }
    const rect = map.getBoundingClientRect();
    this.map = map;
    this.point = {
      x: (event.clientX - rect.left) * map.clientWidth / (rect.width || map.clientWidth),
      y: (event.clientY - rect.top) * map.clientHeight / (rect.height || map.clientHeight),
    };
    this.refresh();
  }
  refresh(): void {
    if (!this.point || this.frame !== undefined) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      this.draw();
    });
  }
  hide(): void {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.point = undefined;
    this.lens?.remove();
    this.lens = undefined;
  }
  private draw(): void {
    const map = this.map, point = this.point;
    const source = map?.querySelector("canvas");
    if (!map?.isConnected || !point || !source || !map.clientWidth || !map.clientHeight) {
      this.hide(); return;
    }
    if (!this.lens) {
      this.lens = map.ownerDocument.createElement("div");
      this.lens.className = "map-magnifier";
      this.lens.setAttribute("aria-hidden", "true");
      this.lens.append(map.ownerDocument.createElement("canvas"), map.ownerDocument.createElement("div"));
      map.parentElement!.append(this.lens);
    }
    const g = lensGeometry(point.x, point.y, map.clientWidth, map.clientHeight, this.zoom);
    this.lens.style.cssText = `left:${g.left}px;top:${g.top}px;width:${g.size}px;height:${g.size}px`;
    const canvas = this.lens.firstElementChild as HTMLCanvasElement;
    const ratio = map.ownerDocument.defaultView?.devicePixelRatio || 1;
    canvas.width = Math.round(g.size * ratio);
    canvas.height = Math.round(g.size * ratio);
    canvas.style.width = canvas.style.height = `${g.size}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    // drawImage uses the full backing canvas, so retina displays and map zoom
    // need no special crop conversion. The underlying graph remains untouched.
    ctx.drawImage(source, g.imageX, g.imageY, map.clientWidth * this.zoom, map.clientHeight * this.zoom);
    // HA area icons are DOM overlays rather than canvas pixels. Keep them native
    // in the lens and apply exactly the same enlargement as the graph.
    const icons = this.lens.lastElementChild as HTMLDivElement;
    icons.className = "magnifier-area-icons";
    icons.style.transform = `translate(${g.imageX}px, ${g.imageY}px) scale(${this.zoom})`;
    icons.replaceChildren();
    map.parentElement!.querySelectorAll(".area-icons ha-icon").forEach((original) => {
      const copy = original.cloneNode(false) as HTMLElement & { icon: string };
      copy.icon = (original as HTMLElement & { icon: string }).icon;
      icons.append(copy);
    });
  }
}

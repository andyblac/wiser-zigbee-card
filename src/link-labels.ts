export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export interface LinkLabel {
  id: string;
  text: string;
  width: number;
  from: Point;
  to: Point;
}
export interface PlacedLabel extends Rect {
  id: string;
  text: string;
  anchor: Point;
  center: Point;
}
export function overlaps(a: Rect, b: Rect, gap = 4): boolean {
  return (
    a.left < b.right + gap &&
    a.right + gap > b.left &&
    a.top < b.bottom + gap &&
    a.bottom + gap > b.top
  );
}
function curve(from: Point, to: Point, t: number, vertical: boolean): Point {
  const a = vertical
    ? { x: from.x, y: from.y + (to.y - from.y) * 0.45 }
    : { x: from.x + (to.x - from.x) * 0.45, y: from.y };
  const b = vertical
    ? { x: to.x, y: to.y + (from.y - to.y) * 0.45 }
    : { x: to.x + (from.x - to.x) * 0.45, y: to.y };
  const u = 1 - t;
  return {
    x:
      u * u * u * from.x +
      3 * u * u * t * a.x +
      3 * u * t * t * b.x +
      t * t * t * to.x,
    y:
      u * u * u * from.y +
      3 * u * u * t * a.y +
      3 * u * t * t * b.y +
      t * t * t * to.y,
  };
}
// Work in screen pixels so reserved space remains consistent through zoom.
export function placeLinkLabels(
  labels: LinkLabel[],
  obstacles: Rect[],
  width: number,
  height: number,
  vertical: boolean,
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  for (const label of labels) {
    let chosen: PlacedLabel | undefined;
    for (const offset of [0, 14, -14, 26, -26, 40, -40]) {
      for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
        const anchor = curve(label.from, label.to, t, vertical);
        const before = curve(label.from, label.to, t - 0.01, vertical);
        const after = curve(label.from, label.to, t + 0.01, vertical);
        const dx = after.x - before.x,
          dy = after.y - before.y;
        const length = Math.hypot(dx, dy) || 1;
        const center = {
          x: anchor.x - (dy / length) * offset,
          y: anchor.y + (dx / length) * offset,
        };
        const rect = {
          left: center.x - label.width / 2 - 6,
          right: center.x + label.width / 2 + 6,
          top: center.y - 13,
          bottom: center.y + 13,
        };
        if (
          rect.left < 4 ||
          rect.top < 4 ||
          rect.right > width - 4 ||
          rect.bottom > height - 4
        )
          continue;
        if ([...obstacles, ...placed].some((other) => overlaps(rect, other)))
          continue;
        chosen = { ...rect, id: label.id, text: label.text, anchor, center };
        break;
      }
      if (chosen) break;
    }
    // Never draw overlapping text if a very dense/zoomed-out map has no space.
    if (chosen) placed.push(chosen);
  }
  return placed;
}

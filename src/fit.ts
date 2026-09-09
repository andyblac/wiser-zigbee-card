interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export function containedView(
  bounds: Bounds[],
  width: number,
  height: number,
  padding = 8,
  center?: { x: number; y: number },
) {
  const valid = bounds.filter((box) =>
    Object.values(box).every(Number.isFinite),
  );
  if (!valid.length || width <= padding * 2 || height <= padding * 2)
    return undefined;
  const left = Math.min(...valid.map((box) => box.left));
  const right = Math.max(...valid.map((box) => box.right));
  const top = Math.min(...valid.map((box) => box.top));
  const bottom = Math.max(...valid.map((box) => box.bottom));
  const position = center ?? { x: (left + right) / 2, y: (top + bottom) / 2 };
  const spanX = 2 * Math.max(Math.abs(left - position.x), Math.abs(right - position.x));
  const spanY = 2 * Math.max(Math.abs(top - position.y), Math.abs(bottom - position.y));
  return {
    position,
    scale: Math.min(
      (width - padding * 2) / Math.max(spanX, 1),
      (height - padding * 2) / Math.max(spanY, 1),
    ),
  };
}

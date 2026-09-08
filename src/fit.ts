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
  return {
    position: { x: (left + right) / 2, y: (top + bottom) / 2 },
    scale: Math.min(
      (width - padding * 2) / Math.max(right - left, 1),
      (height - padding * 2) / Math.max(bottom - top, 1),
    ),
  };
}

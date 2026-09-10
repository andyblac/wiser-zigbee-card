// Accept legacy layout guards on input, but never emit duplicate settings.
export function sanitizeConfig<T extends Record<string, any>>(config: T): T {
  const next = { ...config };
  if ((next.layout_orientation !== undefined &&
       next.layout_orientation !== (next.orientation ?? "vertical")) ||
      (next.layout_group_by !== undefined &&
       next.layout_group_by !== (next.group_by ?? "none"))) {
    delete next.layout_data;
  }
  delete next.layout_orientation;
  delete next.layout_group_by;
  return next;
}

// Follow the card's composed ancestry instead of assuming HA's dialog structure.
export const is_preview = (element: Element): boolean => {
  let current: Element | null = element;
  while (current) {
    if (
      ["hui-card-preview", "hui-dialog-edit-card"].includes(current.localName)
    )
      return true;
    const root = current.getRootNode();
    current =
      current.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
  }
  return false;
};

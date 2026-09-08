import images from "./device-image-data.json";

// Generic fallback for products without catalogue artwork, on transparent alpha.
export const FALLBACK_DEVICE_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect x="20" y="12" width="40" height="56" rx="9" fill="#e1e9f2" stroke="#52677f" stroke-width="2"/><rect x="28" y="22" width="24" height="23" rx="3" fill="#52677f"/><circle cx="40" cy="56" r="3" fill="#52677f"/></svg>',
  );

export const DEVICE_IMAGES: Record<string, string> = {
  ...images,
  CFMT: FALLBACK_DEVICE_IMAGE,
  PowerTagE: FALLBACK_DEVICE_IMAGE,
  ButtonPanel: FALLBACK_DEVICE_IMAGE,
  BoilerInterface: FALLBACK_DEVICE_IMAGE,
};

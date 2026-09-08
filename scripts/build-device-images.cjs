// Embed device artwork so the distributed card remains a single JS file.
const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const root = resolve(__dirname, "..");
const manifest = JSON.parse(
  readFileSync(resolve(root, "assets/devices/manifest.json"), "utf8"),
);
const images = Object.fromEntries(
  Object.entries(manifest).map(([group, entry]) => {
    const image = readFileSync(resolve(root, "assets/devices", entry.file));
    return [group, `data:image/png;base64,${image.toString("base64")}`];
  }),
);
writeFileSync(
  resolve(root, "src/device-image-data.json"),
  JSON.stringify(images),
);
console.log(
  `Embedded transparent artwork for ${Object.keys(images).length} device types.`,
);

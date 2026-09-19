# Wiser Zigbee Card

An interactive Zigbee network map for the [wiserHomeAssistantPlatform](https://github.com/asantaga/wiserHomeAssistantPlatform) integration. See how devices connect to your hub and repeaters, inspect signal quality, and arrange the map to suit your dashboard.

![Wiser network grouped by Home Assistant area, with device images and signal-coloured links](https://raw.githubusercontent.com/wiki/andyblac/wiser-zigbee-card/images/network-overview.png)

- Real device connections with product images, signal colours and optional link labels.
- Horizontal, Vertical and Pie layouts, with optional Home Assistant area grouping.
- Device details, zoom controls and a magnifying glass for exploring larger networks.
- Saved layouts shared through dashboard configuration, plus a Copy button for YAML dashboards.
- Native Home Assistant controls and theme support, with English, German and French translations.

## Getting started

Release versions of Wiser Zigbee Card are included with the [wiserHomeAssistantPlatform](https://github.com/asantaga/wiserHomeAssistantPlatform) integration. Install or update the integration to receive the bundled card; no separate card installation is needed.

You need a configured Wiser integration. Each card displays one hub; add separate cards for additional hubs.

Add **Wiser Zigbee Card** to your dashboard and select **Wiser Hub** in the visual editor.

For manual card configuration:

```yaml
type: custom:wiser-zigbee-card
hub: your_hub_name
```

### Testing a development build

Manual bundle replacement is only needed when testing a development version:

1. Build `dist/wiser-zigbee-card.js` using the [development guide](https://github.com/andyblac/wiser-zigbee-card/wiki/Development).
2. Replace the integration’s `frontend/wiser-zigbee-card.js` with that bundle.
3. Update the existing `/wiser/wiser-zigbee-card.js` **JavaScript module** resource to the development build’s version query string, then reload Home Assistant.

Keep a single resource entry for the card. An integration update may replace the development bundle with its included release version.

See the [installation guide](https://github.com/andyblac/wiser-zigbee-card/wiki/Installation) for requirements and development testing instructions.

## Documentation

The [wiki](https://github.com/andyblac/wiser-zigbee-card/wiki) contains the full documentation:

- [Configuration](https://github.com/andyblac/wiser-zigbee-card/wiki/Configuration) — editor options and YAML examples.
- [Using the map](https://github.com/andyblac/wiser-zigbee-card/wiki/Using-the-map) — toolbar, gestures, device details and signal colours.
- [Areas and layouts](https://github.com/andyblac/wiser-zigbee-card/wiki/Areas-and-layouts) — grouping, orientation and map sizing.
- [Saving layouts](https://github.com/andyblac/wiser-zigbee-card/wiki/Saving-layouts) — dashboard saves, browser storage and copying YAML.
- [Troubleshooting](https://github.com/andyblac/wiser-zigbee-card/wiki/Troubleshooting) — help with loading, device details and saved layouts.
- [Development](https://github.com/andyblac/wiser-zigbee-card/wiki/Development) — building, testing and running the demo.

Product images are embedded in the bundle. See [ASSETS.md](ASSETS.md) for image sources and device coverage.

**Theme mode** offers **Auto** (follow Home Assistant), **Dark**, and **Light** in both card and panel settings. In YAML, set `theme_mode: auto`, `dark`, or `light`. The selected mode applies to the Zigbee map card; the sidebar header and panel settings dialog keep Home Assistant’s theme. Copy/Paste includes the selected mode.

Use the toolbar’s **Copy / Paste from clipboard** menu to transfer settings and map layout between dashboard cards and sidebar panels. Copy puts YAML on the clipboard, including the title, display settings, node positions, orientation and area grouping. Paste validates and saves it to the destination; hub selection and dashboard placement stay unchanged, and sidebar panels retain automatic height. If clipboard reading is blocked, Paste uses the last successful Wiser Copy in the current browser tab session. If no copy is available, a text box opens for manual paste followed by Save. Paste is unavailable in the card editor preview; YAML dashboards can use Copy and paste the YAML into their configuration.

Originally created by [Mark Parker (@msp1974)](https://github.com/msp1974).

## Feedback

[Report a bug](https://github.com/andyblac/wiser-zigbee-card/issues) or [share ideas and ask questions](https://github.com/andyblac/wiser-zigbee-card/discussions).

Compiled card builds include a `WISER-CARD-VERSION` comment containing the card name and build version. Home Assistant can read this marker to update the resource URL without relying on minified variable names or editor text.

`npm run build` and `npm run rollup` automatically increment only `-dev.N` build numbers in both package files (for example, `3.0.0-dev.68` becomes `3.0.0-dev.69`). `npm start` increments it once when starting the watch session. Beta, release candidate and stable versions remain unchanged. Tagged release builds set `WISER_SKIP_VERSION_BUMP=1` to preserve the published version.

## Sidebar panel

With the matching Wiser integration update, enable **Show Wiser Zigbee in sidebar** in the integration’s options for each hub you want to include. The **Wiser Zigbee** panel uses hub tabs and an administrator-only settings button, following the schedules panel. Settings and saved map layouts are stored per hub in Home Assistant, separately from dashboard cards.

The panel is included in `wiser-zigbee-card.js`; both the updated bundle and integration sidebar support are required.

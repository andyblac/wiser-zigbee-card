# Wiser Zigbee Card

An interactive Zigbee network map for the [Wiser Home Assistant integration](https://github.com/asantaga/wiserHomeAssistantPlatform). See how devices connect to your hub and repeaters, inspect signal quality, and arrange the map to suit your dashboard.

![Wiser network grouped by Home Assistant area, with device images and signal-coloured links](https://raw.githubusercontent.com/wiki/andyblac/wiser-zigbee-card/images/network-overview.png)

- Real device connections with product images, signal colours and optional link labels.
- Horizontal, Vertical and Pie layouts, with optional Home Assistant area grouping.
- Device details, zoom controls and a magnifying glass for exploring larger networks.
- Saved layouts shared through dashboard configuration, plus a Copy button for YAML dashboards.
- Native Home Assistant controls and theme support, with English, German and French translations.

## Getting started

You need a configured Wiser integration. Each card displays one hub; add separate cards for additional hubs.

1. Replace the integration’s `frontend/wiser-zigbee-card.js` with the built `dist/wiser-zigbee-card.js` bundle.
2. Set the dashboard resource to `/wiser/wiser-zigbee-card.js?v=3.0.0` with type **JavaScript module**, then reload Home Assistant.
3. Add **Wiser Zigbee Card** to your dashboard and select **Wiser Hub** in the visual editor.

For manual card configuration:

```yaml
type: custom:wiser-zigbee-card
hub: your_hub_name
```

See the [installation guide](https://github.com/andyblac/wiser-zigbee-card/wiki/Installation) for requirements, obtaining the bundle and updating an existing installation.

## Documentation

The [wiki](https://github.com/andyblac/wiser-zigbee-card/wiki) contains the full documentation:

- [Configuration](https://github.com/andyblac/wiser-zigbee-card/wiki/Configuration) — editor options and YAML examples.
- [Using the map](https://github.com/andyblac/wiser-zigbee-card/wiki/Using-the-map) — toolbar, gestures, device details and signal colours.
- [Areas and layouts](https://github.com/andyblac/wiser-zigbee-card/wiki/Areas-and-layouts) — grouping, orientation and map sizing.
- [Saving layouts](https://github.com/andyblac/wiser-zigbee-card/wiki/Saving-layouts) — dashboard saves, browser storage and copying YAML.
- [Troubleshooting](https://github.com/andyblac/wiser-zigbee-card/wiki/Troubleshooting) — help with loading, device details and saved layouts.
- [Development](https://github.com/andyblac/wiser-zigbee-card/wiki/Development) — building, testing and running the demo.

Product images are embedded in the bundle. See [ASSETS.md](ASSETS.md) for image sources and device coverage.

Originally created by [Mark Parker (@msp1974)](https://github.com/msp1974).

## Feedback

[Report a bug](https://github.com/andyblac/wiser-zigbee-card/issues) or [share ideas and ask questions](https://github.com/andyblac/wiser-zigbee-card/discussions).

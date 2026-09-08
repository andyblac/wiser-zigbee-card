# Wiser Zigbee Card

A compact network map for the Wiser Home Assistant integration. Device images and short room names replace coloured text boxes. Select a device to see its full name and connection quality; use **Link labels** to show quality on the map. The expandable device list also exposes names and links without using the canvas.

## Install the updated bundle

Replace your existing card JavaScript with `dist/wiser-zigbee-card.js` and reload Home Assistant. Update the resource query to `?v=3.0.0` to refresh the browser cache. Keep the resource path and card YAML configuration. The grey network panel has been removed; the map uses the card background.

## Device information

Long-press a device (touch and hold, or hold the mouse button) to open the native Home Assistant More info dialog for its Wiser signal sensor, including the available model, firmware, serial number and Zigbee attributes. Matching uses the hub and device registry, so duplicate node IDs across hubs are kept separate. Disabled or missing signal sensors show the available name, device type, node ID and connections in the card instead. In Map only mode, selected-device Zigbee details appear in a scrollable overlay inside the card, so fixed-height dashboard layouts do not hide them. The selected device is centered in the visible map area above the panel without changing zoom. Close the panel or tap empty map space to dismiss it. Single-click shows Zigbee details in the card: device type, node and parent IDs, connections, plus channel, signal quality and device/hub RSSI and LQI when the signal sensor provides them. Single-click and double-click do not open the More info dialog.

Paired RSSI/LQI zeros are omitted because aioWiserHeatAPI uses them as defaults for absent reception data. A zero LQI with a nonzero RSSI is retained.

## Map height

Set **Map height** in the editor, pre-populated with **340 px**. It controls just the map area in both orientations and view modes. YAML: `map_height: 340`. Changing the height or card width automatically fits and centres the map while keeping device positions. Fit uses the smaller width/height scale ratio and includes device labels with an 8 px margin. The supported range is 100–2000 px; an omitted or cleared setting uses 340 px.

## Layouts

Double-click a device or empty map area to zoom into that spot. Double-click again anywhere on the map to restore the previous zoom and position. **Fit view** also exits device zoom. While zoomed in, scroll with the mouse wheel or two fingers on a trackpad to pan; Shift + wheel pans horizontally. Dragging empty map space also pans. In the overview, scrolling moves the dashboard normally. The animation respects reduced-motion preferences. Automatic and manual refreshes preserve your zoom and pan position, including device zoom.

In the visual editor, use **Network view → Horizontal / Vertical**. Horizontal is the original default, flowing left to right. Vertical places the hub above rows of devices. The setting also works in YAML as `orientation: vertical`.

Each orientation has separate browser-saved positions. Existing saved positions continue to work in the original Horizontal view. Layout YAML export includes `orientation` and `layout_orientation`, so coordinates are only applied to their matching view.

- **Tidy layout** arranges devices into columns by distance from the hub. Existing YAML positions are still read.
- Drag devices, then choose **Save layout**. Positions persist in this browser, scoped to dashboard path, hub and card name. Use a unique `layout_id` in YAML if you have otherwise identical cards on one dashboard.
- When the visual editor is open, Save layout also sends the positions to the matching editor. Save the dashboard to retain that configuration.
- For another browser, or if your Home Assistant editor does not capture the positions, expand **Layout for other browsers**, generate the YAML, and paste it into your card configuration.
- A browser-saved layout takes priority over YAML. To replace it, use **Tidy layout**, adjust positions and save again. Clearing browser site data removes local layouts.

Transparent product images are embedded in the JavaScript, with a transparent generic fallback for devices without catalogue artwork. No separate image files or external image requests are needed. See [ASSETS.md](ASSETS.md) for sources and device coverage. Photos represent device categories rather than identifying the hardware generation.

## Title

The Title field starts with the translated “Zigbee network”. Clear it to hide the title while keeping the brand label and device counts. In YAML, omit `name` for the translated default, set `name: ""` to hide it, or supply your own title.

Refresh, Fit view, Tidy layout, Link labels, Map only and Save layout sit together as icons at the top right beside WISER · ZIGBEE in both normal and Map only modes. They use the same muted theme colour, with translated tooltips and accessible labels. Link labels highlights its active state. Map only exposes its state to screen readers without a persistent selected background. The Map only icon switches between normal and map-only views without rebuilding the graph. This is a temporary view switch; the editor/YAML still sets the default for reloads. Save confirmation is visible in both modes.

## Optional sections

The editor uses Home Assistant’s native form selectors for themed switches and fields. The Horizontal / Vertical selector uses Home Assistant’s native segmented control when loaded, with a native form dropdown as its fallback. Buttons, expandable sections, alerts and the YAML field also use native components when available; standalone previews and older frontends use themed HTML fallbacks.

Enable **Map only** in the editor (or `map_only: true` in YAML) to keep the WISER · ZIGBEE label, icon controls and map while hiding the title, device counts and expandable sections. Tapping a device still shows its Zigbee information. The map keeps its chosen orientation, device labels, dragging and double-click zoom. Loading and error messages still appear when needed. Turn Map only off in the editor to restore the controls and your previous section visibility settings.

The editor has independent switches for **Show layout for other browsers** and **Show all devices & connections**. Both are shown by default. In YAML, set `show_layout_export: false` or `show_device_list: false` to hide either section.

## Languages

The card follows your Home Assistant profile language: US English (`en-US`), British English (`en-GB`), German (`de`) and French (`fr`). Core and Lovelace labels use Home Assistant translations directly, without local duplicates. Bundled dictionaries contain card-specific text and known gaps: version, empty/unknown devices and connected/online/offline statuses also try settings-panel translations that may not be loaded on a dashboard. For other languages, custom text falls back to US English while native labels follow Home Assistant. Device and room names remain unchanged.

## Development

```sh
npm ci
npx tsc --noEmit
node tests/layout.test.cjs
node tests/editor.test.cjs
node tests/localize.test.cjs
node tests/device-info.test.cjs
node tests/fit.test.cjs
node tests/refresh-view.test.cjs
npm run rollup
python3 -m http.server 8127 --bind 127.0.0.1
```

Open `http://127.0.0.1:8127/demo/` for a sample network without a Home Assistant instance. Use `?lang=de` or `?lang=fr` to preview translations. Native editor controls require Home Assistant. The demo uses mock data and supports checking layout controls, local persistence and light/dark colours.

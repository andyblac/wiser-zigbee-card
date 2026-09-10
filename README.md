# Wiser Zigbee Card

A compact network map for the Wiser Home Assistant integration. Device images and short room names replace coloured text boxes. Tap a device to see its full name and connection quality; use **Link labels** to show compact percentages, or status when no percentage is available. Full signal descriptions remain in device details. Labels use 14 px text with HA tooltip theme colours, reserve space and move along their links to avoid other labels and devices. On very dense maps, labels with no free space remain hidden until there is room; their details remain available by tapping a device. The expandable device list also exposes names and links without using the canvas.

## Install the updated bundle

Replace your existing card JavaScript with `dist/wiser-zigbee-card.js` and reload Home Assistant. Update the resource query to `?v=3.0.0` to refresh the browser cache. Keep the resource path and card YAML configuration. The grey network panel has been removed; the map uses the card background.

## Device information

Tap a device to show its Zigbee details in the card: device type, node and parent IDs, connections, plus channel, signal quality and device/hub RSSI and LQI when available. Matching uses the hub and device registry so duplicate node IDs across hubs remain separate. Missing or disabled signal sensors still show the available map details.

In Map only mode, details appear in a scrollable overlay. The selected device is centered above the panel without changing zoom. Close the panel or tap the map to dismiss it and restore the zoom and position from before opening the details. Drag devices to rearrange them; dragging dismisses the panel and cancels pending details. Use the native + / − toolbar buttons to zoom around the map centre, or pinch with two fingers to zoom in or out around the gesture centre. Trackpad pinch also zooms; ordinary wheel/trackpad scrolling keeps its existing pan behaviour. Double-click after pinching restores the pre-zoom view. A single tap waits briefly for double-click recognition; double-click zooms. Long-press a device to open HA’s native More info dialog for its matching signal entity. If no matching entity is available, tap still shows the available Zigbee map details.

Paired RSSI/LQI zeros are omitted because aioWiserHeatAPI uses them as defaults for absent reception data. A zero LQI with a nonzero RSSI is retained.

## Hub selection

Use **Wiser Hub** in the visual editor to select the network. The native picker is shown even with one hub; when no hub is configured it displays the first discovered hub. Each card displays one hub, so add another card for another hub. YAML: `hub: your_hub_name`. Switching hubs clears the previous hub’s embedded layout; browser-saved layouts remain separate per hub.

## Area grouping

Set **Group → Area** in the editor to place devices in labelled area groups while showing their real Zigbee parent/router links, including links between areas. Area icons use each HA area’s configured icon, rendered by HA’s native icon component (including custom icon sets); areas without an icon use a floor-plan icon. Groups have a subtle theme-aware outline. Drag an area icon to move its box and all its devices together, including hidden devices. Drag a device on its own to adjust its position independently; the box expands to contain it. Tap an area icon to collapse or expand its devices. Areas start expanded, and collapsed state survives automatic refresh. **None** keeps the existing layout and is the default. YAML: `group_by: area`. Grouping uses the matched device’s HA area (or the matched signal entity’s area if the device has none). Unassigned or unmatched devices appear beneath an Unassigned icon. Area icons label the groups and are not network hops. Collapsing hides that area’s devices and their links; expanding restores the real links. Refresh updates routing changes while keeping existing positions. Collapsing keeps device positions and the current zoom. Tidy preserves manual ordering within each area; grouped and ungrouped layouts are saved separately.

## Map height

**Map height** defaults to Auto (empty). In Sections, the map fills the available card height; use HA’s Layout settings to choose the card’s rows. Leaving out `map_height` or setting it to `null` enables Auto. Enter 100–2000 px for a fixed map area, for example `map_height: 340`. Both orientations and view modes support this. Height and width changes automatically fit and centre the map while keeping device positions. Fit uses the smaller width/height scale ratio and includes device labels with an 8 px margin. Outside a constrained layout, Auto uses a 340 px map as its natural size.

## Layouts

Double-click a device or empty map area to zoom into that spot. Double-click again anywhere on the map to restore the previous zoom and position. **Fit view** also exits device zoom. While zoomed in, scroll with the mouse wheel or two fingers on a trackpad to pan; Shift + wheel pans horizontally. Dragging empty map space also pans. In the overview, scrolling moves the dashboard normally. The animation respects reduced-motion preferences. Automatic and manual refreshes preserve your zoom and pan position, including device zoom.

In the visual editor, use **Network view → Horizontal / Vertical / Pie**. Vertical is the default, placing the hub above successive rows of devices following their actual parent/repeater links. Horizontal flows left to right. Pie arranges each repeater’s child devices around that repeater and centres the complete map within the card. Area boxes enclose devices without changing their connection level. The setting also works in YAML as `orientation: vertical` or `orientation: pie`.

Each orientation has separate browser-saved positions. Existing saved positions continue to work in the original Horizontal view. Layout YAML export includes `orientation` and `layout_orientation`, so coordinates are only applied to their matching view.

- **Tidy layout** arranges devices into columns by distance from the hub. Existing YAML positions are still read.
- Drag devices, then choose **Save layout**. Positions persist in this browser, scoped to dashboard path, hub and card name. Use a unique `layout_id` in YAML if you have otherwise identical cards on one dashboard.
- When the visual editor is open, Save layout also sends the positions to the matching editor. Save the dashboard to retain that configuration.
- For another browser, or if your Home Assistant editor does not capture the positions, expand **Layout for other browsers**, generate the YAML, and paste it into your card configuration.
- A browser-saved layout takes priority over YAML. To replace it, use **Tidy layout**, adjust positions and save again. Clearing browser site data removes local layouts.

Transparent product images are embedded in the JavaScript, with a transparent generic fallback for devices without catalogue artwork. No separate image files or external image requests are needed. See [ASSETS.md](ASSETS.md) for sources and device coverage. Photos represent device categories rather than identifying the hardware generation.

## Title

The Title field starts with the translated “Zigbee network”. Clear it to hide the title while keeping the brand label and device counts. In YAML, omit `name` for the translated default, set `name: ""` to hide it, or supply your own title.

Refresh, Fit view, Zoom in/out, Tidy layout, Link labels, Show detailed view and Save layout sit together as icons at the top right beside WISER · ZIGBEE in both normal and Map only modes. They use the same muted theme colour, with translated tooltips and accessible labels. Link labels highlights while enabled. Show detailed view highlights in detailed mode and is unhighlighted in map-only mode. Refresh highlights while loading; Fit view, Tidy layout and Save layout briefly highlight when used. Tidy layout keeps the current device order within each hop while aligning and spacing devices, and preserves zoom and pan. The Show detailed view icon switches between normal and map-only views without rebuilding the graph. This is a temporary view switch; the editor/YAML still sets the default for reloads. The Save icon briefly highlights to confirm the action; a message appears only if saving fails.

## Optional sections

The editor uses Home Assistant’s native form selectors for themed switches and fields. The Horizontal / Vertical field uses HA’s native button-toggle selector, which loads its segmented control automatically. Toolbar icons, action buttons, expandable sections, alerts and the YAML field use HA-owned components directly. Their focus, hover and selection styling comes from Home Assistant. The card requires Home Assistant to provide these controls; standalone previews do not recreate them.

Turn off **Show detailed view** in the editor (or `map_only: true` in YAML) to keep the WISER · ZIGBEE label, icon controls and map while hiding the title, device counts and expandable sections. Tapping a device still shows its Zigbee information. The map keeps its chosen orientation, device labels, dragging and double-click zoom. Loading and error messages still appear when needed. Show detailed view is on by default. Turn it back on to restore the title, counts and your previous section visibility settings.

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

**Link status** uses a native editor toggle: **Links** (default), **Icons**, **Both** or **None** (YAML: `link_status: links|icons|both|none`). Offline/unknown is red; very low/low/poor is orange; medium/online is yellow; good/very good is green. Colours follow HA theme colour tokens. Device artwork is tinted when Icons or Both is selected; offline artwork remains ghosted. **Link labels** only controls label visibility, independently of status colours.

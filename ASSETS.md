# Device artwork

The PNGs in `assets/devices/` come from the [official Drayton Wiser catalogue](https://wiser.draytoncontrols.co.uk/collections/wiser-system-add-ons). Exact source URLs and device mappings are recorded in `assets/devices/manifest.json`. Artwork remains the property of its respective owner; no redistribution licence is asserted. Images identify device categories and may depict a newer hardware generation.

All 14 PNGs have actual alpha transparency. Existing source transparency was preserved. The room thermostat, smart plug, electrical heat switch and underfloor heating controller had white backgrounds removed from their original product images using the user-approved local Pillow script `scripts/prepare-device-images.py`. Only border-connected near-white pixels are removed; white areas enclosed inside the product are preserved. Images are sized consistently on a transparent 160px canvas.

The built-in image editor was tried with the prompt “remove only the outside white background, preserve the exact opaque product, output real transparent alpha without a baked checkerboard.” Its thermostat outputs lacked transparency. Generated variants were not used in the final assets; the final cutouts use the original catalogue images and the local script.

Run `npm run images` to embed the PNGs in `src/device-image-data.json`. This also runs automatically before `npm run rollup` and `npm start`. The distributed JavaScript includes all images: no image directory deployment or external image requests are needed.

Product artwork covers Controller, RoomStat, SmartPlug, iTRV, TemperatureHumiditySensor, UnderFloorHeating, HeatingActuator, Shutter, OnOffLight, DimmableLight, LoadControl, SmokeAlarmDevice, WaterLeakageSensor, MotionLightSensor and WindowDoorSensor. OnOffLight and LoadControl share the power module image.

CFMT, PowerTagE, ButtonPanel and BoilerInterface use the built-in generic SVG device symbol, with transparent surroundings. Unknown device types use that same fallback. The fallback no longer places a coloured tile behind the device.

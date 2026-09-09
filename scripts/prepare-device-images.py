"""Remove border-connected white backgrounds, then size transparent device PNGs.

Requires Pillow. Supply original catalogue PNGs named as in SOURCE_FILES in the
input directory; all outputs go to assets/devices. Never removes isolated white
pixels inside a device body. Existing source alpha is preserved.
"""
from collections import deque
from pathlib import Path
import sys
from PIL import Image

SOURCE_FILES = {
    "controller": "hub.png", "temperature-humidity": "sensor.png",
    "radiator-thermostat": "trv.png", "room-thermostat": "roomstat-edit.png",
    "smart-plug": "plug-edit.png", "underfloor-heating": "ufh-edit.png",
    "heating-actuator": "actuator-edit.png", "dimmer": "dimmer.png",
    "power": "power.png", "shutter": "shutter.png", "smoke": "smoke.png",
    "leak": "leak.png", "motion": "motion.png", "window": "window.png",
    "cfmt": "cfmt.jpg", "powertag": "powertag.jpg",
    "button": "button.jpg", "boiler": "boiler.jpg",
}

def cutout(image):
    image = image.convert("RGBA")
    if image.getchannel("A").getextrema()[0] < 255:
        return image
    width, height = image.size
    pixels = image.load()
    visited = set()
    queue = deque([(x, y) for x in range(width) for y in (0, height-1)] +
                  [(x, y) for y in range(height) for x in (0, width-1)])
    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or not (0 <= x < width and 0 <= y < height):
            continue
        visited.add((x, y))
        r, g, b, a = pixels[x, y]
        if min(r, g, b) < 245 or max(r, g, b) - min(r, g, b) > 10:
            continue
        pixels[x, y] = (r, g, b, 0)
        queue.extend(((x-1,y), (x+1,y), (x,y-1), (x,y+1)))
    return image

if __name__ == "__main__":
    source = Path(sys.argv[1])
    output = Path(__file__).resolve().parents[1] / "assets/devices"
    output.mkdir(parents=True, exist_ok=True)
    for name, filename in SOURCE_FILES.items():
        image = cutout(Image.open(source / filename))
        image = image.crop(image.getchannel("A").getbbox())
        image.thumbnail((140, 140), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (160, 160))
        canvas.alpha_composite(image, ((160-image.width)//2, (160-image.height)//2))
        canvas.save(output / (name + ".png"), optimize=True)
        assert canvas.getchannel("A").getextrema() == (0, 255)
        print(name, "transparent PNG verified")

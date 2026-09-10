const assert = require("node:assert/strict");
const { MapMagnifier, lensGeometry } = require("./load-ts.cjs")("src/map-magnifier.ts");
assert.deepEqual(lensGeometry(300, 200, 800, 600), {
  size: 180, left: 210, top: 110, imageX: -510, imageY: -310,
});
for (const [x, y] of [[0,0], [800,600], [10,590]]) {
  const g = lensGeometry(x,y,800,600);
  assert.ok(g.left >= 0 && g.top >= 0 && g.left + g.size <= 800 && g.top + g.size <= 600);
  assert.equal(g.imageX + x * 2, g.size / 2);
  assert.equal(g.imageY + y * 2, g.size / 2);
}
assert.equal(lensGeometry(20,20,100,90).size,90);
let frame, draws = [], scale;
global.requestAnimationFrame = (fn) => { frame = fn; return 1; };
global.cancelAnimationFrame = () => { frame = undefined; };
function element() {
  return {
    style: {}, children: [], setAttribute() {},
    append(...children) { this.children.push(...children); },
    get firstElementChild() { return this.children[0]; },
    get lastElementChild() { return this.children.at(-1); },
    replaceChildren() { this.children = []; },
    remove() { this.removed = true; },
    getContext: () => ({ scale: (...args) => { scale = args; }, drawImage: (...args) => draws.push(args) }),
  };
}
const source = {};
const parent = element();
parent.querySelectorAll = () => [{
  icon: "mdi:bed", cloneNode: () => element(),
}];
const map = {
  clientWidth: 800, clientHeight: 600, isConnected: true,
  getBoundingClientRect: () => ({ left: 10, top: 20 }),
  querySelector: () => source, parentElement: parent,
  ownerDocument: { createElement: () => element(), defaultView: { devicePixelRatio: 2 } },
};
const lens = new MapMagnifier();
lens.show(map, { clientX: 310, clientY: 220, pointerType: "mouse", buttons: 0 });
const runFrame = frame; frame = undefined; runFrame();
const overlay = parent.children[0];
assert.deepEqual(draws[0], [source, -510, -310, 1600, 1200]);
assert.deepEqual(scale, [2,2]);
assert.equal(overlay.firstElementChild.width,360);
assert.equal(overlay.lastElementChild.children[0].icon, "mdi:bed");
lens.show(map, { pointerType: "mouse", buttons: 1 });
assert.equal(overlay.removed,true);
assert.equal(frame,undefined);
lens.show(map, { pointerType: "touch", buttons: 0 });
assert.equal(frame,undefined);
console.log("Magnifier tracks pointer, stays inside map, handles retina canvas and native area icons, and yields to dragging/touch.");
const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
for (const zoom of [2, 3, 4]) {
  const original = new MapMagnifier();
  original.setZoom(zoom);
  assert.equal(new MapMagnifier().zoom, zoom, "Browser remembers magnification");
  const g = lensGeometry(300, 200, 800, 600, zoom);
  assert.equal(g.imageX + 300 * zoom, 90);
  assert.equal(g.imageY + 200 * zoom, 90);
}
const invalid = new MapMagnifier();
invalid.setZoom(99);
assert.equal(invalid.zoom, 4);
storage.set("wiser-zigbee-magnifier-zoom", "invalid");
assert.equal(new MapMagnifier().zoom, 2);
global.localStorage = { getItem() { throw Error(); }, setItem() { throw Error(); } };
const blocked = new MapMagnifier();
blocked.setZoom(3);
assert.equal(blocked.zoom, 3, "Lens still works with browser storage unavailable");
global.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
const sized = new MapMagnifier();
assert.equal(sized.size,180);
sized.setSize(240);
assert.equal(new MapMagnifier().size,240);
assert.equal(lensGeometry(300,200,800,600,3,240).size,240);
assert.equal(lensGeometry(30,30,80,70,3,240).size,70);
sized.setSize(1000);
assert.equal(sized.size,360);
sized.setSize(-5);
assert.equal(sized.size,100);
sized.setSize(NaN);
assert.equal(sized.size,100);
storage.set("wiser-zigbee-magnifier-size","broken");
assert.equal(new MapMagnifier().size,180);

const assert = require("node:assert/strict");
const { buttonConfirmation } = require("./load-ts.cjs")("src/action-confirmation.ts");
const timeout = global.setTimeout;
let dismiss;
global.setTimeout = (fn, delay) => { assert.equal(delay,2500); dismiss = fn; return 1; };
global.getComputedStyle = () => ({ getPropertyValue: () => "#fff" });
const nodes = [];
const make = (tag) => ({
  tag, style: { setProperty() {} }, children: [], attributes: {},
  setAttribute(key,value) { this.attributes[key]=value; },
  append(...items) { this.children.push(...items); },
  remove() { this.removed=true; },
});
const doc = { createElement: make, body: { append: (element) => nodes.push(element) } };
try {
  const button = { ownerDocument: doc, getBoundingClientRect: () => ({ left:100, top:50, width:32, height:32 }) };
  const confirm = buttonConfirmation(button,"Copied");
  assert.equal(nodes.length,0,"No success feedback before the action completes");
  confirm();
  const wrapper = nodes[0];
  assert.ok(wrapper.style.cssText.includes("left:100px"));
  const [anchor, tooltip] = wrapper.children;
  assert.equal(tooltip.tag,"ha-tooltip");
  assert.equal(tooltip.for,anchor.id);
  assert.equal(tooltip.textContent,"Copied");
  assert.equal(tooltip.open,true);
  assert.equal(tooltip.trigger,"manual");
  assert.equal(tooltip.attributes.placement,"bottom");
  dismiss();
  assert.equal(wrapper.removed,true);
  buttonConfirmation(null,"Saved")();
  assert.equal(nodes.length,1);
  console.log("Success uses a native tooltip at the captured button position and dismisses cleanly.");
} finally { global.setTimeout=timeout; }

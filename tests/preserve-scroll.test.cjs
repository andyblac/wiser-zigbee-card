const assert = require("node:assert/strict");
const { preserveDashboardScroll } = require("./load-ts.cjs")("src/preserve-scroll.ts");
const clock = Date.now;
let now = 0;
Date.now = () => now;
function windowMock() {
  const listeners = new Map();
  let callback;
  return {
    scrollX: 15, scrollY: 800, location: { href: "/dashboard/test" },
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
    requestAnimationFrame: (fn) => { callback = fn; return 1; },
    cancelAnimationFrame: () => { callback = undefined; },
    scrollTo(options) { this.scrollX = options.left; this.scrollY = options.top; },
    tick() { const fn = callback; callback = undefined; fn?.(); },
    listeners,
  };
}
try {
  const win = windowMock();
  const finish = preserveDashboardScroll(win);
  win.scrollY = 0;
  win.tick();
  assert.equal(win.scrollY, 800);
  finish();
  win.scrollY = 0;
  now = 200;
  win.tick();
  assert.equal(win.scrollY, 800, "Restore while asynchronous layout settles");
  now = 501;
  win.tick();
  assert.equal(win.listeners.size, 0);
  for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) {
    const user = windowMock();
    preserveDashboardScroll(user);
    user.listeners.get(event)();
    user.scrollY = 400;
    user.tick();
    assert.equal(user.scrollY, 400, "Never fight deliberate interaction");
    assert.equal(user.listeners.size, 0);
  }
  const navigation = windowMock();
  preserveDashboardScroll(navigation);
  navigation.location.href = "/dashboard/other";
  navigation.scrollY = 0;
  navigation.tick();
  assert.equal(navigation.scrollY, 0);
  assert.equal(navigation.listeners.size, 0);
  const slow = windowMock();
  preserveDashboardScroll(slow);
  now += 2501;
  slow.tick();
  assert.equal(slow.listeners.size, 0, "Bound restoration even if saving stalls");
  console.log("Scroll survives dashboard rerender without overriding user interaction or navigation.");
} finally { Date.now = clock; }

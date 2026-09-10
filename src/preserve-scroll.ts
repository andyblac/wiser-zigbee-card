// HA recreates the dashboard view on save, temporarily shrinking the page.
// Preserve its scroll position while the replacement view renders.
export function preserveDashboardScroll(win: Window | null): () => void {
  if (!win) return () => {};
  const { scrollX: left, scrollY: top } = win;
  const url = win.location.href;
  let cancelled = false;
  let frame = 0;
  let deadline = Date.now() + 2500;
  const events = ["wheel", "touchstart", "pointerdown", "keydown", "popstate", "hashchange"];
  const cancel = () => {
    cancelled = true;
    win.cancelAnimationFrame(frame);
    events.forEach((event) => win.removeEventListener(event, cancel, true));
  };
  const restore = () => {
    if (cancelled || Date.now() >= deadline || win.location.href !== url) {
      cancel();
      return;
    }
    if (win.scrollX !== left || win.scrollY !== top)
      win.scrollTo({ left, top, behavior: "instant" as ScrollBehavior });
    frame = win.requestAnimationFrame(restore);
  };
  events.forEach((event) => win.addEventListener(event, cancel, { capture: true, passive: true }));
  frame = win.requestAnimationFrame(restore);
  // Give HA's asynchronous card rendering a brief chance to settle after save.
  return () => { deadline = Math.min(deadline, Date.now() + 500); };
}

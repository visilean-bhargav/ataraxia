export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const smooth = t => t * t * (3 - 2 * t);
export const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

// Size a canvas backing store to its CSS box. devicePixelRatio is capped at 2.
export function fitCanvas(canvas, scale) {
  const r = canvas.getBoundingClientRect();
  const dpr = scale || Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(r.width)), ht = Math.max(1, Math.round(r.height));
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(ht * dpr);
  return { w, h: ht, dpr };
}

// Multi-touch pointer tracking. Coordinates are CSS pixels relative to the element.
// Returns a dispose function.
export function pointers(el, { down, move, up }) {
  const live = new Map();
  let rect = el.getBoundingClientRect();
  const pos = e => ({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  const onDown = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    rect = el.getBoundingClientRect();
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    const p = pos(e), rec = { id: e.pointerId, x: p.x, y: p.y, x0: p.x, y0: p.y, px: p.x, py: p.y, t0: performance.now(), t: performance.now(), speed: 0 };
    live.set(e.pointerId, rec);
    down && down(rec, live);
    e.preventDefault();
  };
  const onMove = e => {
    const rec = live.get(e.pointerId); if (!rec) return;
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    const evs = list && list.length ? list : [e];
    for (const ev of evs) {
      const p = pos(ev), now = performance.now();
      const dt = Math.max(1, now - rec.t), d = Math.hypot(p.x - rec.x, p.y - rec.y);
      rec.px = rec.x; rec.py = rec.y; rec.x = p.x; rec.y = p.y;
      rec.speed = rec.speed * 0.7 + (d / dt) * 1000 * 0.3; rec.t = now;
      move && move(rec, live);
    }
    e.preventDefault();
  };
  const onUp = e => {
    const rec = live.get(e.pointerId); if (!rec) return;
    live.delete(e.pointerId);
    up && up(rec, live);
  };
  const stop = e => e.preventDefault();
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  // iOS: stop scroll, rubber-banding, double-tap zoom and the long-press callout on the sensory surface
  el.addEventListener('touchstart', stop, { passive: false });
  el.addEventListener('touchmove', stop, { passive: false });
  el.addEventListener('contextmenu', stop);
  return () => {
    el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp);
    el.removeEventListener('touchstart', stop); el.removeEventListener('touchmove', stop);
    el.removeEventListener('contextmenu', stop);
    live.clear();
  };
}

// requestAnimationFrame loop that pauses when the page is hidden. fn(dtSeconds, nowMs).
export function loop(fn) {
  let id = 0, last = 0, on = true;
  const tick = now => {
    if (!on) return;
    id = requestAnimationFrame(tick);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now; fn(dt, now);
  };
  const vis = () => { last = 0; };
  document.addEventListener('visibilitychange', vis);
  id = requestAnimationFrame(tick);
  return () => { on = false; cancelAnimationFrame(id); document.removeEventListener('visibilitychange', vis); };
}

// Haptics: navigator.vibrate on Android. iOS Safari has no vibrate; toggling a switch-style
// checkbox through its label gives a system tick on recent iOS. Fails silently elsewhere.
let lastTick = 0;
export function haptic(ms = 8) {
  const now = performance.now();
  if (now - lastTick < 45) return;
  lastTick = now;
  try {
    if (navigator.vibrate) { navigator.vibrate(ms); return; }
    const label = document.getElementById('hx');
    if (label) label.click();
  } catch (e) {}
}

// Small value-noise helper for procedural textures.
export function makeNoise(seed = 1) {
  const p = new Uint8Array(512);
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const val = (x, y) => p[(p[x & 255] + y) & 255] / 255;
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = val(xi, yi), b = val(xi + 1, yi), c = val(xi, yi + 1), d = val(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

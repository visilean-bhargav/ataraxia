// Shallow clear water over a teal bed with moving caustic light.
// Height-field ripple simulation (two buffers) on a coarse grid; the bed is refracted and
// lit by the surface slope. Canvas 2D only.
import { makeNoise, clamp, loop, reducedMotion } from '../util.js';

const TAU = Math.PI * 2;

// Tileable caustic frames (256x256), shared by every water surface. The first frame is built
// straight away; the rest are filled in over the next second so opening stays instant.
const N = 256, FRAMES = 16;
let frames = null;
function causticFrame(time) {
  const out = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const px = (x / N) * TAU - 250, py = (y / N) * TAU - 250;
    let ix = px, iy = py, c = 1;
    for (let n = 0; n < 5; n++) {
      const t = time * (1 - 3.5 / (n + 1));
      const nx = px + Math.cos(t - ix) + Math.sin(t + iy);
      const ny = py + Math.sin(t - iy) + Math.cos(t + ix);
      ix = nx; iy = ny;
      const a = px / (Math.sin(ix + t) / 0.005), b = py / (Math.cos(iy + t) / 0.005);
      c += 1 / Math.sqrt(a * a + b * b);
    }
    c = 1.17 - Math.pow(c / 5, 1.4);
    out[y * N + x] = Math.min(255, Math.pow(Math.abs(c), 8) * 255);
  }
  return out;
}
function causticFrames() {
  if (frames) return frames;
  frames = [causticFrame(23)];
  const more = () => { frames.push(causticFrame(23 + frames.length * 0.09)); if (frames.length < FRAMES) setTimeout(more, 30); };
  setTimeout(more, 250);
  return frames;
}

export function createWater(canvas, opts = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const tiles = causticFrames();
  const noise = makeNoise(7);
  const budget = opts.budget || 105000;
  let W = 0, H = 0, GW = 0, GH = 0, RW = 0, RH = 0, px = 2;
  let cur, prev, hr, bed, img, data, stop = null, time = 0, acc = 0, ambientT = 0, energy = 0;
  const still = reducedMotion();

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(40, Math.round(r.width)); H = Math.max(40, Math.round(r.height));
    px = Math.max(1.5, Math.sqrt((W * H) / budget));       // CSS px per rendered pixel
    GW = Math.ceil(W / (px * 2)) + 1; GH = Math.ceil(H / (px * 2)) + 1; // sim grid: half the render grid
    RW = GW * 2 - 1; RH = GH * 2 - 1;
    canvas.width = RW; canvas.height = RH;
    cur = new Float32Array(GW * GH); prev = new Float32Array(GW * GH);
    hr = new Float32Array(RW * RH);
    img = ctx.createImageData(RW, RH); data = img.data;
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    buildBed();
  }

  // The bed: pale turquoise sand, mottled, deeper toward the edges and the far end.
  function buildBed() {
    bed = new Uint8Array(RW * RH * 3);
    const s = px;
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      const u = x * s, v = y * s;
      const big = noise(u * 0.007, v * 0.007), mid = noise(u * 0.03 + 9, v * 0.03 + 3);
      const ridge = Math.sin(u * 0.05 + v * 0.021 + big * 6) * 0.5 + 0.5;   // faint sand ridges on the bed
      const nx = x / RW - 0.5, ny = y / RH - 0.5;
      const vig = 1 - 0.7 * (nx * nx + ny * ny);
      const depth = 1 - 0.2 * (y / RH);
      const m = (0.7 + big * 0.34 + mid * 0.12 + ridge * 0.09 + (Math.random() - 0.5) * 0.05) * vig * depth;
      const warm = mid * 0.5 + ridge * 0.3;                                 // drifts toward sand in places
      const i = (y * RW + x) * 3;
      bed[i] = clamp((34 + warm * 46) * m, 0, 255);
      bed[i + 1] = clamp((132 + warm * 22) * m, 0, 255);
      bed[i + 2] = clamp((140 - warm * 6) * m, 0, 255);
    }
  }

  // Press the surface down in a soft disc. x,y in CSS pixels.
  function touch(x, y, strength = 1, radius = 14) {
    const gx = x / (px * 2), gy = y / (px * 2), r = Math.max(1.5, radius / (px * 2));
    const x0 = Math.max(1, Math.floor(gx - r * 2)), x1 = Math.min(GW - 2, Math.ceil(gx + r * 2));
    const y0 = Math.max(1, Math.floor(gy - r * 2)), y1 = Math.min(GH - 2, Math.ceil(gy + r * 2));
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const d2 = ((i - gx) * (i - gx) + (j - gy) * (j - gy)) / (r * r);
      if (d2 < 4) cur[j * GW + i] -= strength * Math.exp(-d2 * 1.6);
    }
    energy = Math.min(1, energy + 0.1 * strength);
  }
  function stroke(x0, y0, x1, y1, strength = 0.25, radius = 11) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 6));
    for (let k = 1; k <= n; k++) touch(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, strength, radius);
  }

  function step() {
    const damp = 0.9915;
    for (let j = 1; j < GH - 1; j++) {
      let i = j * GW + 1;
      for (const end = i + GW - 2; i < end; i++) {
        prev[i] = ((cur[i - 1] + cur[i + 1] + cur[i - GW] + cur[i + GW]) * 0.5 - prev[i]) * damp;
      }
    }
    // edges mirror their neighbours, so waves reflect off the sides
    for (let i = 0; i < GW; i++) { prev[i] = prev[i + GW]; prev[(GH - 1) * GW + i] = prev[(GH - 2) * GW + i]; }
    for (let j = 0; j < GH; j++) { prev[j * GW] = prev[j * GW + 1]; prev[j * GW + GW - 1] = prev[j * GW + GW - 2]; }
    const t = cur; cur = prev; prev = t;
  }

  function render() {
    // upsample heights 2x (bilinear) to the render grid
    for (let j = 0; j < GH; j++) {
      const row = j * 2 * RW, g = j * GW;
      for (let i = 0; i < GW - 1; i++) { const a = cur[g + i]; hr[row + i * 2] = a; hr[row + i * 2 + 1] = (a + cur[g + i + 1]) * 0.5; }
      hr[row + RW - 1] = cur[g + GW - 1];
    }
    for (let j = 0; j < GH - 1; j++) {
      const a = j * 2 * RW, b = a + RW, c = b + RW;
      for (let i = 0; i < RW; i++) hr[b + i] = (hr[a + i] + hr[c + i]) * 0.5;
    }
    // caustic light: blend between neighbouring frames (ping-pong through the set), drifting slowly
    const span = Math.max(1, tiles.length - 1), ph = (time * 2.1) % (span * 2), pos = ph > span ? span * 2 - ph : ph;
    const fa = Math.min(tiles.length - 1, pos | 0), fb = Math.min(tiles.length - 1, fa + 1), mix = pos - (pos | 0);
    const tA = tiles[fa], tB = tiles[fb];
    const sc = px * 0.82, ox = time * 5 + 300, oy = time * 3 + 300;
    const REFR = 26 / px, last = RW - 1, lastY = RH - 1;
    let o = 0;
    for (let y = 0; y < RH; y++) {
      const ym = y > 0 ? -RW : 0, yp = y < lastY ? RW : 0, row = y * RW;
      for (let x = 0; x < RW; x++, o += 4) {
        const i = row + x, c = hr[i];
        const l = hr[i - (x > 0 ? 1 : 0)], r = hr[i + (x < last ? 1 : 0)], u = hr[i + ym], d = hr[i + yp];
        const dx = r - l, dy = d - u, lap = l + r + u + d - 4 * c;
        let sx = (x + dx * REFR) | 0, sy = (y + dy * REFR) | 0;
        if (sx < 0) sx = 0; else if (sx > last) sx = last;
        if (sy < 0) sy = 0; else if (sy > lastY) sy = lastY;
        const b = (sy * RW + sx) * 3;
        const ti = ((((y + dy * REFR * 2.2) * sc + oy) & 255) << 8) | (((x + dx * REFR * 2.2) * sc + ox) & 255);
        const a0 = tA[ti], ca = (a0 + (tB[ti] - a0) * mix) * 0.00392;
        // light gathers where the surface curves like a lens, and glints on slopes facing the sun
        let focus = -lap * 2.6; if (focus < -0.3) focus = -0.3; else if (focus > 2.2) focus = 2.2;
        let sp = (dx + dy) * -1.25; sp = sp > 0 ? sp * sp : 0; if (sp > 1) sp = 1;
        const lit = 0.84 + ca * 0.5 + focus * 0.7;
        const glow = ca * ca * 120 + ca * 46 + (focus > 0 ? focus * 50 : 0) + sp * 150;
        data[o] = bed[b] * lit + glow;
        data[o + 1] = bed[b + 1] * lit + glow * 0.97;
        data[o + 2] = bed[b + 2] * lit + glow * 0.84;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function frame(dt) {
    time += dt * (still ? 0.35 : 1);
    // slow ambient swell so the surface never looks dead
    ambientT -= dt;
    if (ambientT <= 0) {
      ambientT = still ? 2.4 : 0.7 + Math.random() * 0.9;
      touch(Math.random() * W, Math.random() * H, 0.1 + Math.random() * 0.12, 26 + Math.random() * 20);
    }
    acc += dt;
    let n = 0;
    while (acc > 1 / 120 && n < 4) { step(); acc -= 1 / 120; n++; }
    if (n === 4) acc = 0;
    energy *= 0.97;
    render();
  }

  resize();
  // start with a few soft swells already travelling
  for (let k = 0; k < 5; k++) touch(Math.random() * W, Math.random() * H, 0.18, 30);
  for (let k = 0; k < 30; k++) step();
  render();

  return {
    touch, stroke, resize,
    get energy() { return energy; },
    start() { if (!stop) stop = loop(frame); },
    stop() { if (stop) { stop(); stop = null; } },
    destroy() { this.stop(); },
  };
}

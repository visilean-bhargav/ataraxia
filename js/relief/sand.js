// Fine tan sand lit from one side. A height map; a finger carves a groove with raised edges,
// like a rake in a zen garden. Shaded by slope so the grooves read as real relief.
// Only the touched region is re-shaded each frame, so it stays cheap at full resolution.
import { makeNoise, clamp, loop } from '../util.js';

export function createSand(canvas, opts = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const noise = makeNoise(21);
  let W = 0, H = 0, SW = 0, SH = 0, sc = 1;
  let base, hgt, grain, img, data, stop = null;
  let dirty = null;                       // {x0,y0,x1,y1} in cells
  let wind = null;                        // active levelling sweep
  const streaks = [];
  let drew = false;

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(40, Math.round(r.width)); H = Math.max(40, Math.round(r.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    sc = Math.max(0.75, Math.min(1.5, dpr, Math.sqrt((opts.budget || 560000) / (W * H)))); // cells per CSS px
    SW = Math.round(W * sc); SH = Math.round(H * sc);
    canvas.width = SW; canvas.height = SH;
    base = new Float32Array(SW * SH); hgt = new Float32Array(SW * SH); grain = new Float32Array(SW * SH);
    img = ctx.createImageData(SW, SH); data = img.data;
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    // wind-rippled dunes underneath, as in the reference photograph
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const u = x / sc, v = y / sc;
      const warp = noise(u * 0.008, v * 0.008) * 9 + noise(u * 0.02 + 5, v * 0.02) * 2.4;
      const ripple = Math.sin(u * 0.028 + v * 0.062 + warp);
      const broad = noise(u * 0.006 + 40, v * 0.006 + 11) - 0.5;
      const i = y * SW + x;
      base[i] = (ripple * 2.6 + ripple * Math.abs(ripple) * 1.2 + broad * 6 + (noise(u * 0.11, v * 0.11) - 0.5) * 0.7) * sc;
      const g = Math.random();
      grain[i] = (g - 0.5) * 0.17 + (g > 0.975 ? -0.16 : 0) + (g < 0.02 ? 0.12 : 0);
    }
    shade(0, 0, SW - 1, SH - 1);
    ctx.putImageData(img, 0, 0);
  }

  // Shade a rectangle of cells. Light comes from the upper left.
  function shade(x0, y0, x1, y1) {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(SW - 1, x1); y1 = Math.min(SH - 1, y1);
    const K = 0.2 / sc;
    for (let y = y0; y <= y1; y++) {
      const up = y > 0 ? -SW : 0, dn = y < SH - 1 ? SW : 0;
      for (let x = x0; x <= x1; x++) {
        const i = y * SW + x, l = x > 0 ? i - 1 : i, r = x < SW - 1 ? i + 1 : i;
        const dx = base[r] + hgt[r] - base[l] - hgt[l];
        const dy = base[i + dn] + hgt[i + dn] - base[i + up] - hgt[i + up];
        let s = 0.56 + (dx * 0.8 + dy * 0.6) * K + grain[i];
        const hh = hgt[i]; if (hh < 0) s += hh * 0.035 / sc;       // grooves sit a little in shadow
        s = s < 0 ? 0 : s > 1 ? 1 : s;
        const o = i * 4;
        if (s < 0.56) { const t = s / 0.56;                        // shadow -> sand
          data[o] = 92 + t * 116; data[o + 1] = 62 + t * 106; data[o + 2] = 34 + t * 88;
        } else { const t = (s - 0.56) / 0.44;                      // sand -> sunlit
          data[o] = 208 + t * 42; data[o + 1] = 168 + t * 62; data[o + 2] = 122 + t * 76;
        }
      }
    }
  }
  function mark(x0, y0, x1, y1) {
    if (!dirty) dirty = { x0, y0, x1, y1 };
    else { dirty.x0 = Math.min(dirty.x0, x0); dirty.y0 = Math.min(dirty.y0, y0); dirty.x1 = Math.max(dirty.x1, x1); dirty.y1 = Math.max(dirty.y1, y1); }
  }

  // Carve one stroke segment (CSS pixels). Groove inside the radius, pushed-up rim outside it.
  function carve(ax, ay, bx, by) {
    ax *= sc; ay *= sc; bx *= sc; by *= sc;
    const R = 8.5 * sc, RIM = 7 * sc, D = 3.4 * sc, RH = 1.7 * sc, reach = R + RIM;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - reach)), x1 = Math.min(SW - 1, Math.ceil(Math.max(ax, bx) + reach));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - reach)), y1 = Math.min(SH - 1, Math.ceil(Math.max(ay, by) + reach));
    const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let t = len2 > 0 ? ((x - ax) * vx + (y - ay) * vy) / len2 : 0;
      const side = t >= 0;                                         // never behind the start: that would refill the groove just made
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - (ax + vx * t), y - (ay + vy * t));
      if (d >= reach) continue;
      const i = y * SW + x;
      if (d < R) {
        const q = d / R, g = -D * (1 - q * q) + (Math.random() - 0.5) * 0.35 * sc;
        if (g < hgt[i]) hgt[i] = g;
      } else if (side || len2 === 0) {
        const q = (d - R) / RIM, rim = RH * Math.sin(Math.PI * Math.min(1, q * 1.15)) * (1 - q * 0.5);
        if (rim > hgt[i]) hgt[i] = hgt[i] < 0 ? Math.min(rim, hgt[i] + rim) : rim;
      }
    }
    mark(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
  }

  // Wind: a front sweeps left to right over two seconds and levels what it passes.
  function smoothOut(done) {
    if (wind) return;
    wind = { t: 0, snap: Float32Array.from(hgt), done, prev: -1 };
  }
  function windFrame(dt) {
    wind.t += dt / 2;
    const band = SW * 0.28, front = wind.t * (SW + band);
    const a = Math.max(0, Math.floor(front - band)), b = Math.min(SW - 1, Math.ceil(front));
    const from = Math.max(0, Math.min(a, wind.prev < 0 ? 0 : wind.prev));
    for (let x = from; x <= b; x++) {
      let f = (front - x) / band; f = f < 0 ? 0 : f > 1 ? 1 : f; f = f * f * (3 - 2 * f);
      for (let y = 0, i = x; y < SH; y++, i += SW) hgt[i] = wind.snap[i] * (1 - f);
    }
    wind.prev = a;
    if (b >= from) mark(from - 1, 0, b + 1, SH - 1);
    if (Math.random() < 0.9) streaks.push({ x: front / sc - 30 + Math.random() * 40, y: Math.random() * H, l: 30 + Math.random() * 70, life: 1 });
    if (wind.t >= 1) {
      hgt.fill(0); shade(0, 0, SW - 1, SH - 1); ctx.putImageData(img, 0, 0); dirty = null;
      const d = wind.done; wind = null; d && d();
    }
  }

  function frame(dt) {
    if (wind) windFrame(dt);
    const hadStreaks = drew;                                        // last frame's streaks must be painted over
    drew = false;
    if (hadStreaks && !dirty) mark(0, 0, 0, 0);
    if (dirty) {
      const d = dirty; dirty = null;
      const x0 = Math.max(0, d.x0), y0 = Math.max(0, d.y0), x1 = Math.min(SW - 1, d.x1), y1 = Math.min(SH - 1, d.y1);
      shade(x0, y0, x1, y1);
      if (hadStreaks || wind) ctx.putImageData(img, 0, 0);
      else ctx.putImageData(img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    }
    if (streaks.length) {                                          // blown grains, drawn over the sand
      ctx.save(); ctx.scale(sc, sc); ctx.lineCap = 'round';
      for (let k = streaks.length - 1; k >= 0; k--) {
        const s = streaks[k]; s.x += dt * 520; s.life -= dt * 2.2;
        if (s.life <= 0) { streaks.splice(k, 1); continue; }
        ctx.strokeStyle = `rgba(255,240,210,${0.22 * s.life})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.l, s.y + s.l * 0.06); ctx.stroke();
        drew = true;
      }
      ctx.restore();
    }
  }

  resize();
  return {
    carve, smoothOut, resize,
    dot(x, y) { carve(x, y, x, y); },
    get levelling() { return !!wind; },
    start() { if (!stop) stop = loop(frame); },
    stop() { if (stop) { stop(); stop = null; } },
    destroy() { this.stop(); },
  };
}

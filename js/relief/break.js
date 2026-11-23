// Break: "break it. restore it."
// Tap to crack a pane of pale glass. It shatters, falls into a heap, and a long hold
// lifts every shard back into place. The mended seams show in gold.
import { h, pointers, haptic, loop, clamp, lerp, rand, easeInOut, reducedMotion, fitCanvas } from '../util.js';
import { audio } from '../audio.js';

// ---- Delaunay triangulation (Bowyer-Watson; a few hundred points at most) ----
function delaunay(pts) {
  const n = pts.length, P = pts.concat([{ x: -1e4, y: -1e4 }, { x: 1e4, y: -1e4 }, { x: 0, y: 1e4 }]);
  const circ = (a, b, c) => {
    const A = P[a], B = P[b], C = P[c];
    const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y)) || 1e-9;
    const a2 = A.x * A.x + A.y * A.y, b2 = B.x * B.x + B.y * B.y, c2 = C.x * C.x + C.y * C.y;
    const x = (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / d;
    const y = (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / d;
    return { a, b, c, x, y, r2: (A.x - x) * (A.x - x) + (A.y - y) * (A.y - y) };
  };
  let tris = [circ(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const p = P[i], edges = new Map(), keep = [];
    for (const t of tris) {
      if ((p.x - t.x) * (p.x - t.x) + (p.y - t.y) * (p.y - t.y) < t.r2) {
        for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
          const k = u < v ? u + '_' + v : v + '_' + u;
          if (edges.has(k)) edges.set(k, null); else edges.set(k, [u, v]);
        }
      } else keep.push(t);
    }
    for (const e of edges.values()) if (e) keep.push(circ(e[0], e[1], i));
    tris = keep;
  }
  return tris.filter(t => t.a < n && t.b < n && t.c < n).map(t => [t.a, t.b, t.c]);
}

// ---- sounds ----
function sTick(x01) {
  const pan = (x01 - 0.5) * 1.2, f = rand(2600, 4600);
  audio.burst({ dur: 0.05, gain: 0.3, type: 'highpass', f: 4800, pan, rev: 0.25 });
  audio.burst({ dur: 0.035, gain: 0.22, type: 'bandpass', f: 1400, q: 1.5, pan });
  audio.tone({ f, to: f * 0.985, dur: 0.14, gain: 0.07, pan, rev: 0.5 });
  audio.tone({ f: f * 1.51, dur: 0.07, gain: 0.03, pan, rev: 0.5 });
}
function sCrash() {
  audio.burst({ dur: 0.62, gain: 0.42, type: 'highpass', f: 2600, attack: 0.002, rev: 0.5 });
  audio.burst({ dur: 0.34, gain: 0.34, type: 'bandpass', f: 1100, to: 320, q: 0.7 });
  audio.tone({ f: 120, to: 46, dur: 0.28, gain: 0.3 });
  for (let i = 0; i < 16; i++) {
    const f = rand(1900, 6800);
    audio.tone({ f, to: f * 0.97, dur: rand(0.08, 0.3), gain: rand(0.015, 0.05), when: rand(0, 0.55), pan: rand(-0.8, 0.8), rev: 0.6 });
  }
}
function sTinkle(x01) {
  const f = rand(2800, 7200);
  audio.tone({ f, to: f * 0.96, dur: rand(0.05, 0.14), gain: rand(0.012, 0.035), pan: (x01 - 0.5) * 1.4, rev: 0.6 });
}
function sSeat(x01, p) {
  const f = 900 + p * 900 + rand(-60, 60);
  audio.tone({ f, dur: 0.16, gain: 0.03, attack: 0.008, pan: (x01 - 0.5) * 1.2, rev: 0.7 });
}
function sChime() {
  [587.33, 739.99, 880, 1174.66, 1479.98].forEach((f, i) => {
    audio.tone({ f, dur: 2.6, gain: 0.085, attack: 0.02, when: i * 0.17, rev: 0.9, pan: (i - 2) * 0.2 });
    audio.tone({ f: f * 2.005, dur: 1.4, gain: 0.022, attack: 0.02, when: i * 0.17, rev: 0.9 });
  });
}

export function mount(stage, api) {
  const cv = h('canvas');
  stage.append(cv);
  const ctx = cv.getContext('2d');
  const still = reducedMotion();
  let W = 0, H = 0, dpr = 1, pane = null;
  let state = 'intact';              // intact | falling | heap | restoring | mended
  let stars = [], taps = 0, need = 0, crackT = 0;
  let shards = [], heapH = null, impact = null, t = 0, fallT = 0;
  let prog = 0, holding = 0, mendT = 0, shake = 0, dirty = true, lastLand = 0, lastSeat = 0;
  let shimmer = null, shimmer2 = null;
  const after = h('div', { class: 'after' },
    h('button', { class: 'btn ghost', onclick: () => reset(true) }, 'Again'),
    h('button', { class: 'btn', style: '--c:var(--sand)', onclick: () => api.next() }, 'Something slower →'));
  stage.append(after);

  // Colour of the glass at a point: pale green-white, a little deeper toward the bottom.
  function glass(x, y) {
    const k = clamp((x / W) * 0.3 + (y / H) * 0.7, 0, 1);
    const band = Math.exp(-Math.pow(((x + y * 0.55) / (W + H * 0.55) - 0.3) / 0.07, 2)) * 0.5
               + Math.exp(-Math.pow(((x + y * 0.55) / (W + H * 0.55) - 0.74) / 0.035, 2)) * 0.3;
    return [lerp(214, 150, k) + band * 40, lerp(235, 196, k) + band * 22, lerp(224, 184, k) + band * 26];
  }

  function drawBackdrop(c) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0c2126'); g.addColorStop(0.6, '#123e44'); g.addColorStop(1, '#175457');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }

  function buildPane() {
    pane = document.createElement('canvas'); pane.width = cv.width; pane.height = cv.height;
    const c = pane.getContext('2d'); c.scale(dpr, dpr);
    drawBackdrop(c);
    // dim shapes behind the glass, so it reads as something you look through
    for (let i = 0; i < 7; i++) {
      const bx = rand(0, W), by = rand(0, H), br = rand(90, 240);
      const bg = c.createRadialGradient(bx, by, 0, bx, by, br);
      const dark = i % 2 === 0;
      bg.addColorStop(0, dark ? 'rgba(6,26,30,.55)' : 'rgba(60,140,135,.5)'); bg.addColorStop(1, dark ? 'rgba(6,26,30,0)' : 'rgba(60,140,135,0)');
      c.fillStyle = bg; c.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    // the sheet itself
    const g = c.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, 'rgba(226,242,232,.86)'); g.addColorStop(0.5, 'rgba(188,221,207,.8)'); g.addColorStop(1, 'rgba(140,190,178,.78)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // soft reflections of a window, running diagonally
    const refl = (pos, width, a) => {
      c.save(); c.transform(1, 0, -0.55, 1, 0, 0);
      const x = pos * (W + H * 0.55);
      const lg = c.createLinearGradient(x - width, 0, x + width, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, `rgba(255,255,255,${a})`); lg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = lg; c.fillRect(x - width, 0, width * 2, H); c.restore();
    };
    refl(0.52, W * 0.2, 0.3); refl(0.86, W * 0.08, 0.2); refl(1.16, W * 0.13, 0.16);
    // green depth gathering at the edges, as thick glass does
    const e = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    e.addColorStop(0, 'rgba(60,130,115,0)'); e.addColorStop(1, 'rgba(40,110,100,.42)');
    c.fillStyle = e; c.fillRect(0, 0, W, H);
    // faint surface speckle
    for (let i = 0; i < (W * H) / 900; i++) {
      c.fillStyle = `rgba(255,255,255,${rand(0.03, 0.12)})`;
      c.fillRect(rand(0, W), rand(0, H), rand(0.5, 1.6), rand(0.5, 1.6));
    }
    // a few faint old scratches
    c.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const sx = rand(0, W), sy = rand(0, H), a = rand(0, 6.28), l = rand(30, 120);
      c.strokeStyle = `rgba(255,255,255,${rand(0.05, 0.13)})`; c.lineWidth = rand(0.4, 0.9);
      c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(sx + Math.cos(a) * l * 0.5 + rand(-8, 8), sy + Math.sin(a) * l * 0.5 + rand(-8, 8), sx + Math.cos(a) * l, sy + Math.sin(a) * l); c.stroke();
    }
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.strokeRect(1, 1, W - 2, H - 2);
    // fine grain over everything, as in a photograph
    c.setTransform(1, 0, 0, 1, 0, 0);
    const id = c.getImageData(0, 0, pane.width, pane.height), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 13; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    c.putImageData(id, 0, 0);
  }

  function resize() {
    const f = fitCanvas(cv); W = f.w; H = f.h; dpr = f.dpr;
    buildPane(); dirty = true;
  }

  function reset(sound) {
    state = 'intact'; stars = []; taps = 0; need = 8 + ((Math.random() * 5) | 0); shards = []; prog = 0; holding = 0; mendT = 0;
    after.classList.remove('on'); dirty = true; crackT = 0;
    api.hint('break it. restore it.', 3200);
    if (sound) audio.tone({ f: 660, dur: 0.5, gain: 0.04, rev: 0.6 });
  }

  // ---- cracks ----
  function growRay(ray, extra) {
    let last = ray.pts[ray.pts.length - 1], a = ray.ang, left = extra;
    while (left > 0) {
      const seg = rand(12, 26); a += rand(-0.26, 0.26);
      const p = { x: last.x + Math.cos(a) * seg, y: last.y + Math.sin(a) * seg, born: t + (ray.len / 900) };
      ray.pts.push(p); ray.len += seg; left -= seg; last = p;
      if (p.x < -4 || p.y < -4 || p.x > W + 4 || p.y > H + 4) break;
    }
    ray.ang = lerp(ray.ang, a, 0.3);
    // now and then a hairline splits off
    if (ray.pts.length > 3 && Math.random() < 0.55) {
      const from = ray.pts[2 + ((Math.random() * (ray.pts.length - 3)) | 0)], ba = ray.ang + rand(0.5, 1.0) * (Math.random() < 0.5 ? -1 : 1), bl = rand(14, 44);
      const mid = { x: from.x + Math.cos(ba) * bl * 0.5 + rand(-3, 3), y: from.y + Math.sin(ba) * bl * 0.5 + rand(-3, 3) };
      (ray.twigs || (ray.twigs = [])).push([from, mid, { x: from.x + Math.cos(ba + rand(-0.3, 0.3)) * bl, y: from.y + Math.sin(ba + rand(-0.3, 0.3)) * bl }]);
    }
  }
  function addRing(star, radius) {
    const rays = star.rays;
    for (let i = 0; i < rays.length; i++) {
      if (Math.random() < 0.3) continue;                              // rings are broken, never complete
      const A = rays[i], B = rays[(i + 1) % rays.length];
      const pick = (ray, r) => { let acc = 0; for (let k = 1; k < ray.pts.length; k++) { acc += Math.hypot(ray.pts[k].x - ray.pts[k - 1].x, ray.pts[k].y - ray.pts[k - 1].y); if (acc >= r) return ray.pts[k]; } return null; };
      const p = pick(A, radius * rand(0.85, 1.15)), q = pick(B, radius * rand(0.85, 1.15));
      if (!p || !q) continue;
      const mx = (p.x + q.x) / 2 + (star.x - (p.x + q.x) / 2) * rand(-0.1, 0.12), my = (p.y + q.y) / 2 + (star.y - (p.y + q.y) / 2) * rand(-0.1, 0.12);
      star.rings.push([p, { x: mx, y: my }, q]);
    }
  }
  function strike(x, y) {
    const near = stars.find(s => Math.hypot(s.x - x, s.y - y) < 30);
    const reach = Math.min(W, H) * rand(0.17, 0.34);
    if (near) {                                                       // hitting the same spot drives its cracks further
      near.rays.forEach(r => growRay(r, reach * rand(0.3, 0.7)));
      addRing(near, rand(60, 110)); near.hits++;
    } else {
      const n = 5 + ((Math.random() * 5) | 0), a0 = rand(0, 6.28), star = { x, y, rays: [], rings: [], hits: 1, born: t };
      for (let i = 0; i < n; i++) {
        const ray = { ang: a0 + (i / n) * 6.283 + rand(-0.3, 0.3), pts: [{ x, y, born: t }], len: 0 };
        growRay(ray, reach * rand(0.45, 1.1)); star.rays.push(ray);
      }
      star.rays.sort((a, b) => Math.atan2(a.pts[1].y - y, a.pts[1].x - x) - Math.atan2(b.pts[1].y - y, b.pts[1].x - x));
      addRing(star, rand(16, 30)); if (Math.random() < 0.75) addRing(star, rand(42, 74));
      star.facets = star.rays.map(() => (Math.random() < 0.6 ? rand(0.04, 0.2) : 0));
      stars.push(star);
      // nearby crack tips answer the new blow
      for (const s of stars) if (s !== star) for (const r of s.rays) {
        const tip = r.pts[r.pts.length - 1];
        if (Math.hypot(tip.x - x, tip.y - y) < 110) growRay(r, rand(20, 60));
      }
    }
    taps++; crackT = t + 0.3; dirty = true;
  }

  // part: 0 = whole network, 1 = only the heavy inner stretch of each ray, 2 = only hairlines
  function strokeCracks(c, fn, part = 0) {
    for (const s of stars) {
      for (const r of s.rays) {
        if (part !== 2) {
          const n = part === 1 ? Math.max(2, Math.ceil(r.pts.length * 0.5)) : r.pts.length;
          c.beginPath(); c.moveTo(r.pts[0].x, r.pts[0].y);
          for (let k = 1; k < n; k++) { if (r.pts[k].born > t) break; c.lineTo(r.pts[k].x, r.pts[k].y); }
          fn();
        }
        if (part !== 1 && r.twigs) for (const g of r.twigs) { if (g[0].born > t) continue; c.beginPath(); c.moveTo(g[0].x, g[0].y); c.quadraticCurveTo(g[1].x, g[1].y, g[2].x, g[2].y); fn(); }
      }
      if (part !== 1) for (const g of s.rings) { c.beginPath(); c.moveTo(g[0].x, g[0].y); c.quadraticCurveTo(g[1].x, g[1].y, g[2].x, g[2].y); fn(); }
    }
  }
  function drawCracks(c) {
    c.lineJoin = 'round'; c.lineCap = 'round';
    const go = () => c.stroke();
    // wedges of glass near each blow sit at a slightly different angle and catch the light
    for (const s of stars) if (s.facets) for (let i = 0; i < s.rays.length; i++) {
      const al = s.facets[i]; if (!al) continue;
      const A = s.rays[i].pts, B = s.rays[(i + 1) % s.rays.length].pts, pa = A[Math.min(2, A.length - 1)], pb = B[Math.min(2, B.length - 1)];
      c.fillStyle = i % 3 === 0 ? `rgba(20,80,76,${al * 0.6})` : `rgba(255,255,255,${al})`;
      c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(pa.x, pa.y); c.lineTo(pb.x, pb.y); c.closePath(); c.fill();
    }
    c.save(); c.translate(1, 1.3); c.strokeStyle = 'rgba(14,62,60,.42)'; c.lineWidth = 1.1; strokeCracks(c, go); c.restore();   // shadow side
    c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = 4.5; strokeCracks(c, go, 1);                                         // bloom
    c.strokeStyle = 'rgba(255,255,255,.82)'; c.lineWidth = 0.7; strokeCracks(c, go);                                           // hairline core
    c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 1.5; strokeCracks(c, go, 1);                                        // heavier near the blow
    for (const s of stars) {                                          // crushed glass at the point of impact
      const R = 13 + s.hits * 4, g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, R);
      g.addColorStop(0, 'rgba(255,255,255,.8)'); g.addColorStop(0.3, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(s.x, s.y, R, 0, 6.3); c.fill();
    }
  }

  // ---- shatter ----
  function shatter(x, y) {
    const pts = [], minD = 11;
    const add = (px, py, force) => {
      px = clamp(px, 0, W); py = clamp(py, 0, H);
      if (!force) for (const q of pts) if ((q.x - px) * (q.x - px) + (q.y - py) * (q.y - py) < minD * minD) return;
      pts.push({ x: px, y: py });
    };
    [[0, 0], [W, 0], [0, H], [W, H]].forEach(p => add(p[0], p[1], true));
    for (const s of stars) { add(s.x, s.y); for (const r of s.rays) r.pts.forEach((p, k) => { if (k % 2 === 1 || k === r.pts.length - 1) add(p.x, p.y); }); for (const g of s.rings) add(g[1].x, g[1].y); }
    const step = 64;
    for (let x2 = step; x2 < W - step / 2; x2 += step) { add(x2 + rand(-14, 14), 0); add(x2 + rand(-14, 14), H); }
    for (let y2 = step; y2 < H - step / 2; y2 += step) { add(0, y2 + rand(-14, 14)); add(W, y2 + rand(-14, 14)); }
    const cell = still ? 96 : 72;                                     // fill open areas so no shard is huge
    for (let gy = cell / 2; gy < H; gy += cell) for (let gx = cell / 2; gx < W; gx += cell) {
      const px = gx + rand(-cell * 0.35, cell * 0.35), py = gy + rand(-cell * 0.35, cell * 0.35);
      if (!pts.some(q => Math.hypot(q.x - px, q.y - py) < cell * 0.55)) add(px, py);
    }
    const tris = delaunay(pts);
    shards = tris.map(([a, b, c]) => {
      const A = pts[a], B = pts[b], C = pts[c], cx = (A.x + B.x + C.x) / 3, cy = (A.y + B.y + C.y) / 3;
      const area = Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2;
      const d = Math.hypot(cx - x, cy - y), dirx = (cx - x) / (d || 1), diry = (cy - y) / (d || 1), push = 300 * Math.exp(-d / 240);
      return {
        v: [A.x - cx, A.y - cy, B.x - cx, B.y - cy, C.x - cx, C.y - cy], ox: cx, oy: cy, x: cx, y: cy, area, r: Math.sqrt(area) * 0.75,
        vx: dirx * push + rand(-45, 45), vy: diry * push + rand(-60, 20), a: 0, va: rand(-3.2, 3.2), tilt: 0, tv: rand(2, 7) * (Math.random() < 0.5 ? -1 : 1),
        delay: d / 1500 + rand(0, 0.07), col: glass(cx, cy), settled: false, hx: 0, hy: 0, ha: 0, seated: false,
        order: (1 - cy / H) * 0.55 + rand(0, 0.08), light: Math.random() < 0.12 ? rand(0.3, 0.6) : rand(-0.22, 0.16), al: rand(0.4, 0.78), e: 0,
      };
    }).filter(s => s.area > 6);
    heapH = new Float32Array(Math.ceil(W / 14) + 1);
    impact = { x, y }; state = 'falling'; fallT = 0; shake = still ? 0 : 1;
    sCrash(); haptic(40);
    api.hint(null);
  }

  function land(s) {
    s.settled = true; s.vx = s.vy = s.va = 0; s.tilt = 0; s.hx = s.x; s.hy = s.y; s.ha = s.a;
    const b0 = Math.max(0, Math.floor((s.x - s.r) / 14)), b1 = Math.min(heapH.length - 1, Math.ceil((s.x + s.r) / 14));
    const add = (s.area * 0.105) / Math.max(14, s.r * 2);
    for (let b = b0; b <= b1; b++) heapH[b] += add;
    const now = performance.now();
    if (now - lastLand > 38) { lastLand = now; sTinkle(s.x / W); }
  }

  function physics(dt) {
    fallT += dt;
    let moving = 0;
    for (const s of shards) {
      if (s.settled) continue;
      moving++;
      if (fallT < s.delay) continue;
      s.vy += 2300 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.a += s.va * dt; s.tilt += s.tv * dt; s.vx *= 1 - 0.6 * dt;
      if (s.x < 8) { s.x = 8; s.vx = Math.abs(s.vx) * 0.4; } else if (s.x > W - 8) { s.x = W - 8; s.vx = -Math.abs(s.vx) * 0.4; }
      const floor = H - 5 - heapH[clamp(Math.round(s.x / 14), 0, heapH.length - 1)] - s.r * 0.25;
      if (s.y >= floor) { s.y = floor; land(s); }
    }
    if (!moving && state === 'falling') { state = 'heap'; api.hint('Hold to restore.', 0); }
  }

  // ---- restore ----
  function restoreStep(dt) {
    if (holding > 0 && state !== 'mended') {
      if (state === 'heap') { state = 'restoring'; }
      prog = Math.min(1, prog + dt / 4);
      if (shimmer) { shimmer.set(0.05, 196 + prog * 196); shimmer2.set(0.025, (196 + prog * 196) * 1.5); }
    } else if (shimmer) { shimmer.set(0, null); shimmer2.set(0, null); }
    if (state !== 'restoring') return;
    for (const s of shards) {
      const q = clamp((prog - s.order) / 0.37, 0, 1), e = easeInOut(q);
      s.x = lerp(s.hx, s.ox, e); s.y = lerp(s.hy, s.oy, e) - Math.sin(Math.PI * e) * 34;
      s.a = s.ha * (1 - e); s.tilt = Math.sin(Math.PI * e) * 0.5; s.e = e;
      if (q >= 1 && !s.seated) {
        s.seated = true; s.flash = 1; s.e = 1;
        const now = performance.now();
        if (now - lastSeat > 55) { lastSeat = now; sSeat(s.ox / W, prog); haptic(5); }
      }
      if (q < 1) s.seated = false;
      if (s.flash) s.flash = Math.max(0, s.flash - dt * 2.5);
    }
    if (prog >= 1) {
      state = 'mended'; mendT = 0; holding = 0;
      if (shimmer) { shimmer.set(0, null); shimmer2.set(0, null); }
      sChime(); haptic(20); api.hint(null);
      setTimeout(() => { if (state === 'mended') after.classList.add('on'); }, 1700);
    }
  }

  // Each shard: a translucent body, a dark edge for thickness, and a bright bevel on the sides facing the light.
  function drawShards() {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const X = [0, 0, 0], Y = [0, 0, 0];
    for (const s of shards) {
      const e = s.e, tc = Math.cos(s.tilt);
      const fl = Math.abs(Math.sin(s.tilt)) * 0.5 + s.light * (1 - e) + (s.flash || 0) * 0.3;
      const r = clamp(s.col[0] + fl * 78, 0, 255) | 0, g = clamp(s.col[1] + fl * 62, 0, 255) | 0, b = clamp(s.col[2] + fl * 66, 0, 255) | 0;
      const cs = Math.cos(s.a), sn = Math.sin(s.a), v = s.v, k = Math.abs(tc) * 0.85 + 0.15;
      for (let i = 0; i < 3; i++) { const lx = v[i * 2], ly = v[i * 2 + 1] * k; X[i] = s.x + lx * cs - ly * sn; Y[i] = s.y + lx * sn + ly * cs; }
      ctx.beginPath(); ctx.moveTo(X[0], Y[0]); ctx.lineTo(X[1], Y[1]); ctx.lineTo(X[2], Y[2]); ctx.closePath();
      ctx.fillStyle = `rgba(${r},${g},${b},${lerp(s.al, 0.92, e)})`; ctx.fill();
      ctx.strokeStyle = `rgba(16,66,62,${lerp(0.5, 0.1, e)})`; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${lerp(0.85, 0.3, e)})`; ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3, mx = (X[i] + X[j]) / 2 - s.x, my = (Y[i] + Y[j]) / 2 - s.y;
        if (mx * -0.6 + my * -0.8 > 0) { ctx.moveTo(X[i], Y[i]); ctx.lineTo(X[j], Y[j]); }
      }
      ctx.stroke();
    }
  }
  // Mended, not erased: every join shows faintly, and the original cracks are filled with sand gold.
  function drawSeams(alpha, glow) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(212,183,139,${0.1 + glow * 0.32})`; ctx.lineWidth = 0.8 + glow * 0.5;
    ctx.beginPath();
    for (const s of shards) { const v = s.v; ctx.moveTo(s.ox + v[0], s.oy + v[1]); ctx.lineTo(s.ox + v[2], s.oy + v[3]); ctx.lineTo(s.ox + v[4], s.oy + v[5]); ctx.closePath(); }
    ctx.stroke();
    const go = () => ctx.stroke();
    if (glow > 0.01) { ctx.strokeStyle = `rgba(232,200,140,${glow * 0.2})`; ctx.lineWidth = 8; strokeCracks(ctx, go, 1); }
    ctx.save(); ctx.translate(0.8, 1); ctx.strokeStyle = `rgba(70,60,30,${alpha * 0.3})`; ctx.lineWidth = 1.4; strokeCracks(ctx, go); ctx.restore();
    ctx.strokeStyle = `rgba(212,183,139,${alpha})`; ctx.lineWidth = 1.5 + glow * 0.9; strokeCracks(ctx, go);
    ctx.strokeStyle = `rgba(255,240,205,${alpha * (0.3 + glow * 0.7)})`; ctx.lineWidth = 0.6; strokeCracks(ctx, go);
  }

  function frame(dt) {
    t += dt;
    if (state === 'falling') physics(dt);
    restoreStep(dt);
    if (state === 'mended') mendT += dt;
    const anim = state === 'falling' || state === 'restoring' || (state === 'mended' && mendT < 4.5) || t < crackT || shake > 0.01;
    if (!anim && !dirty) return;
    dirty = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (shake > 0.01) { ctx.translate(rand(-1, 1) * shake * 7, rand(-1, 1) * shake * 7); shake *= Math.pow(0.002, dt); } else shake = 0;
    if (state === 'intact') {
      ctx.drawImage(pane, 0, 0, W, H); drawCracks(ctx);
    } else if (state === 'mended') {
      if (mendT < 0.6) { drawBackdrop(ctx); drawShards(); ctx.globalAlpha = mendT / 0.6; }
      ctx.drawImage(pane, 0, 0, W, H); ctx.globalAlpha = 1;
      const glow = mendT < 2 ? Math.sin(Math.min(1, mendT / 0.5) * Math.PI / 2) * (mendT < 1.2 ? 1 : 1 - (mendT - 1.2) / 0.8 * 0.85) : 0.15 * Math.max(0, 1 - (mendT - 2) / 2);
      drawSeams((0.7 + glow * 0.3) * Math.min(1, mendT / 0.4), glow);
    } else {
      drawBackdrop(ctx); drawShards();
    }
  }

  const off = pointers(cv, {
    down(p) {
      api.touched();
      if (state === 'intact') {
        strike(p.x, p.y); sTick(p.x / W); haptic(12);
        if (taps >= need) { const x = p.x, y = p.y; setTimeout(() => { if (state === 'intact') shatter(x, y); }, 110); }
      } else if (state === 'heap' || state === 'restoring') {
        holding++;
        if (!shimmer && audio.ctx) { shimmer = audio.oscVoice({ type: 'sine', f: 196, rev: 0.6 }); shimmer2 = audio.oscVoice({ type: 'sine', f: 294, rev: 0.6 }); }
        api.hint(null);
      }
    },
    up() {
      if (holding > 0) { holding--; if (holding === 0 && state === 'restoring' && prog < 1) api.hint('Hold to restore.', 0); }
    },
  });

  resize(); reset(false);
  const stop = loop(frame);
  let rw = W, rh = H;
  const onResize = () => { const r = stage.getBoundingClientRect(); if (Math.abs(r.width - rw) > 2 || Math.abs(r.height - rh) > 2) { resize(); rw = W; rh = H; if (state !== 'intact') reset(false); } };
  window.addEventListener('resize', onResize);

  return {
    destroy() { off(); stop(); window.removeEventListener('resize', onResize); if (shimmer) { shimmer.stop(); shimmer2.stop(); } },
    // test hook
    _state: () => ({ state, taps, need, prog, shards: shards.length }),
  };
}

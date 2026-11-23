// Knead: one soft form, like warm clay. Press to dent, drag to stretch, two fingers to squeeze
// or pull apart. It wobbles back slowly and keeps part of what you did to it.
import { h, pointers, haptic, loop, clamp, lerp, rand, fitCanvas, reducedMotion } from '../util.js';
import { audio } from '../audio.js';

const N = 60;

export function mount(stage, api) {
  const cv = h('canvas');
  stage.append(cv);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, R = 100, area0 = 1, grainPat = null;
  const P = [];                      // {x,y,vx,vy,rx,ry}
  const grabs = new Map();           // pointer id -> {w:Float32Array, sx,sy (start), px:[], py:[], inside}
  const dimples = [];
  let stretch = null, strain = 0, speed = 0;

  function area(get) {
    let a = 0;
    for (let i = 0; i < N; i++) { const p = P[i], q = P[(i + 1) % N]; a += get ? p.rx * q.ry - q.rx * p.ry : p.x * q.y - q.x * p.y; }
    return a / 2;
  }
  function init() {
    const f = fitCanvas(cv); W = f.w; H = f.h; dpr = f.dpr;
    R = Math.min(W * 0.33, H * 0.2);
    P.length = 0;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, r = R * (1 + 0.06 * Math.sin(a * 2 + 0.6) + 0.04 * Math.sin(a * 3 + 2));
      const x = W / 2 + Math.cos(a) * r, y = H * 0.48 + Math.sin(a) * r * 0.94;
      P.push({ x, y, vx: 0, vy: 0, rx: x, ry: y });
    }
    area0 = area(false);
    // fine grain, so the surface reads as clay rather than plastic
    const g = document.createElement('canvas'); g.width = g.height = 128;
    const gc = g.getContext('2d'), id = gc.createImageData(128, 128);
    for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 26; }
    gc.putImageData(id, 0, 0); grainPat = ctx.createPattern(g, 'repeat');
  }

  function inside(x, y) {
    let c = false;
    for (let i = 0, j = N - 1; i < N; j = i++) {
      const a = P[i], b = P[j];
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  }

  function physics(dt) {
    const steps = 2, hdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      // volume: push every point along its normal when the form is squeezed or stretched
      const a = area(false), press = clamp((area0 - a) / area0, -0.6, 0.6) * 5200;
      let cx = 0, cy = 0; for (const p of P) { cx += p.x; cy += p.y; } cx /= N; cy /= N;
      for (let i = 0; i < N; i++) {
        const p = P[i], pr = P[(i + N - 1) % N], nx = P[(i + 1) % N];
        let fx = (p.rx - p.x) * 26, fy = (p.ry - p.y) * 26;                        // toward its resting place
        fx += (pr.x + nx.x - 2 * p.x) * 420; fy += (pr.y + nx.y - 2 * p.y) * 420;    // skin tension keeps it smooth
        let tx = nx.x - pr.x, ty = nx.y - pr.y; const tl = Math.hypot(tx, ty) || 1;
        fx += (ty / tl) * press; fy += (-tx / tl) * press;
        for (const g of grabs.values()) {
          const w = g.w[i]; if (w < 0.015) continue;
          const txx = g.px[i] + (g.x - g.sx) * w + (g.dent ? (g.x - g.px[i]) * w * 0.22 : 0);
          const tyy = g.py[i] + (g.y - g.sy) * w + (g.dent ? (g.y - g.py[i]) * w * 0.22 : 0);
          fx += (txx - p.x) * 340 * w; fy += (tyy - p.y) * 340 * w;
        }
        p.vx = (p.vx + fx * hdt) * (1 - 5.2 * hdt); p.vy = (p.vy + fy * hdt) * (1 - 5.2 * hdt);
      }
      for (const p of P) {
        p.x += p.vx * hdt; p.y += p.vy * hdt;
        if (p.x < 10) { p.x = 10; p.vx *= -0.2; } else if (p.x > W - 10) { p.x = W - 10; p.vx *= -0.2; }
        if (p.y < 10) { p.y = 10; p.vy *= -0.2; } else if (p.y > H - 10) { p.y = H - 10; p.vy *= -0.2; }
      }
    }
  }

  // Letting go: it keeps about 30% of the deformation, so it feels reshaped rather than rubbery.
  function settleRest() {
    for (const p of P) { p.rx += (p.x - p.rx) * 0.3; p.ry += (p.y - p.ry) * 0.3; }
    for (let k = 0; k < 2; k++) {                                   // relax sharp kinks in the resting shape
      const nx = P.map((p, i) => (P[(i + N - 1) % N].rx + p.rx * 2 + P[(i + 1) % N].rx) / 4);
      const ny = P.map((p, i) => (P[(i + N - 1) % N].ry + p.ry * 2 + P[(i + 1) % N].ry) / 4);
      P.forEach((p, i) => { p.rx = nx[i]; p.ry = ny[i]; });
    }
    let cx = 0, cy = 0; for (const p of P) { cx += p.rx; cy += p.ry; } cx /= N; cy /= N;
    const sc = Math.sqrt(area0 / Math.max(1, Math.abs(area(true))));  // same amount of clay as before
    const pull = 0.08;                                                // drift gently back toward the middle
    for (const p of P) {
      p.rx = cx + (p.rx - cx) * sc + (W / 2 - cx) * pull; p.ry = cy + (p.ry - cy) * sc + (H * 0.48 - cy) * pull;
      p.rx = clamp(p.rx, 24, W - 24); p.ry = clamp(p.ry, 70, H - 90);
    }
  }

  function path() {
    ctx.beginPath();
    const m = i => [(P[i].x + P[(i + 1) % N].x) / 2, (P[i].y + P[(i + 1) % N].y) / 2];
    const s = m(N - 1); ctx.moveTo(s[0], s[1]);
    for (let i = 0; i < N; i++) { const q = m(i); ctx.quadraticCurveTo(P[i].x, P[i].y, q[0], q[1]); }
    ctx.closePath();
  }

  function draw(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    bg.addColorStop(0, '#1b4750'); bg.addColorStop(0.55, '#123039'); bg.addColorStop(1, '#0c1f24');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    let cx = 0, cy = 0, minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const p of P) { cx += p.x; cy += p.y; if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
    cx /= N; cy /= N;
    const rad = Math.max(maxX - minX, maxY - minY) / 2;

    // soft shadow on the table
    ctx.save(); ctx.shadowColor = 'rgba(4,16,20,.55)'; ctx.shadowBlur = 38; ctx.shadowOffsetY = 20; ctx.fillStyle = '#b98a78'; path(); ctx.fill(); ctx.restore();

    // body: sand where the light falls, turning to pink and plum in the shade
    const g = ctx.createRadialGradient(cx - rad * 0.38, cy - rad * 0.45, rad * 0.05, cx, cy, rad * 1.35);
    g.addColorStop(0, '#f3dcb6'); g.addColorStop(0.3, '#deba93'); g.addColorStop(0.62, '#d79bb4'); g.addColorStop(0.88, '#b676b4'); g.addColorStop(1, '#7c5591');
    path(); ctx.fillStyle = g; ctx.fill();

    ctx.save(); path(); ctx.clip();
    // inner shading: the edge turns away from the light
    ctx.lineJoin = 'round';
    for (const [w, a] of [[rad * 0.5, 0.05], [rad * 0.3, 0.07], [rad * 0.15, 0.09], [rad * 0.06, 0.1]]) {
      ctx.save(); ctx.translate(-rad * 0.05, -rad * 0.07); ctx.strokeStyle = `rgba(66,47,79,${a})`; ctx.lineWidth = w; path(); ctx.stroke(); ctx.restore();
    }
    // warm rim of light along the upper left
    ctx.save(); ctx.translate(rad * 0.035, rad * 0.045); ctx.strokeStyle = 'rgba(255,240,214,.3)'; ctx.lineWidth = rad * 0.05; path(); ctx.stroke(); ctx.restore();
    // broad soft highlight
    const hl = ctx.createRadialGradient(cx - rad * 0.36, cy - rad * 0.42, 0, cx - rad * 0.36, cy - rad * 0.42, rad * 0.6);
    hl.addColorStop(0, 'rgba(255,248,232,.5)'); hl.addColorStop(1, 'rgba(255,248,232,0)');
    ctx.fillStyle = hl; ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    // dimples where fingers press
    for (let k = dimples.length - 1; k >= 0; k--) {
      const d = dimples[k];
      if (!d.held) { d.life -= dt * 0.7; if (d.life <= 0) { dimples.splice(k, 1); continue; } }
      else d.life = Math.min(1, d.life + dt * 6);
      const r = 36, a = d.life * 0.6;
      const dg = ctx.createRadialGradient(d.x + 3, d.y + 4, 0, d.x, d.y, r);
      dg.addColorStop(0, `rgba(66,47,79,${0.34 * a})`); dg.addColorStop(0.55, `rgba(66,47,79,${0.14 * a})`);
      dg.addColorStop(0.8, `rgba(255,244,224,${0.1 * a})`); dg.addColorStop(1, 'rgba(255,244,224,0)');
      ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 6.3); ctx.fill();
    }
    ctx.fillStyle = grainPat; ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    ctx.restore();
  }

  function frame(dt) {
    physics(dt);
    // how far the form is from rest drives the stretch tone
    let s = 0; for (const p of P) s += Math.hypot(p.x - p.rx, p.y - p.ry);
    strain = s / N / R; speed *= 0.88;
    if (stretch) stretch.set(grabs.size ? clamp(speed / 900, 0, 1) * 0.085 : 0, 70 + clamp(strain, 0, 1.2) * 120, 0.1);
    draw(dt);
  }

  const off = pointers(cv, {
    down(p) {
      api.touched();
      const w = new Float32Array(N), sig = R * 0.62, isIn = inside(p.x, p.y);
      let best = 0;
      for (let i = 0; i < N; i++) { const d = Math.hypot(P[i].x - p.x, P[i].y - p.y); w[i] = Math.exp(-(d * d) / (2 * sig * sig)); if (w[i] > best) best = w[i]; }
      if (best < 0.03 && !isIn) return;                                // touched the table, not the clay
      if (isIn && best < 0.55) { const k = 0.55 / Math.max(best, 0.02); for (let i = 0; i < N; i++) w[i] = Math.min(1, w[i] * k * (best < 0.2 ? 0.6 : 1)); }
      const d = { x: p.x, y: p.y, life: 0, held: true };
      if (isIn) dimples.push(d);
      grabs.set(p.id, { w, sx: p.x, sy: p.y, x: p.x, y: p.y, px: P.map(q => q.x), py: P.map(q => q.y), dent: true, dimple: isIn ? d : null });
      if (!stretch && audio.ctx) stretch = audio.oscVoice({ type: 'triangle', f: 80, lowpass: 420 });
      // a low, soft thump
      const f = rand(62, 92);
      audio.tone({ f: f * 1.7, to: f, dur: 0.22, gain: 0.3, attack: 0.008 });
      audio.burst({ dur: 0.09, gain: 0.07, type: 'lowpass', f: 320, q: 0.5 });
      haptic(10);
    },
    move(p) {
      const g = grabs.get(p.id); if (!g) return;
      g.x = p.x; g.y = p.y; speed = Math.max(speed, p.speed);
      if (g.dimple) { g.dimple.x = p.x; g.dimple.y = p.y; }
    },
    up(p) {
      const g = grabs.get(p.id); if (!g) return;
      if (g.dimple) g.dimple.held = false;
      grabs.delete(p.id);
      settleRest();
      audio.tone({ f: 70, to: 52, dur: 0.3, gain: 0.12, attack: 0.02 });
    },
  });

  init();
  api.hint('Press and reshape.', 3000);
  const stop = loop(frame);
  let rw = W, rh = H;
  const onResize = () => { const r = stage.getBoundingClientRect(); if (Math.abs(r.width - rw) > 2 || Math.abs(r.height - rh) > 2) { init(); rw = W; rh = H; } };
  window.addEventListener('resize', onResize);
  void reducedMotion; void lerp;

  return { destroy() { off(); stop(); window.removeEventListener('resize', onResize); if (stretch) stretch.stop(); } };
}

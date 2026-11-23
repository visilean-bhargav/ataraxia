// Breathe: a slow ring of light. In for four, out for six. No counters, no timer, no finish line.
// Hold anywhere to breathe in and let go to breathe out; the ring follows you, then gently
// guides the pace back toward four and six.
import { h, pointers, loop, clamp, lerp, fitCanvas } from '../util.js';
import { audio } from '../audio.js';

const IN = 4, OUT = 6;

export function mount(stage, api) {
  const cv = h('canvas');
  const word = h('div', { style: 'position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font-size:22px;font-weight:600;letter-spacing:.14em;color:rgba(229,223,211,.2);pointer-events:none;transition:opacity 1.4s ease' }, 'in');
  stage.append(cv, word);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let phase = 'in', level = 0;            // level: 0 = empty, 1 = full
  let inDur = IN, outDur = OUT;           // current pace; drifts back to 4 / 6
  let held = false, heldAt = 0, releasedAt = 0, userLed = 0, t = 0, shown = 'in';
  let v1 = null, v2 = null, air = null;
  const motes = Array.from({ length: 26 }, () => ({ a: Math.random() * 6.28, r: 0.5 + Math.random() * 0.9, s: (Math.random() - 0.5) * 0.12, z: Math.random() }));

  function resize() { const f = fitCanvas(cv); W = f.w; H = f.h; dpr = f.dpr; }

  function setWord(w) {
    if (w === shown) return; shown = w;
    word.style.opacity = 0;
    setTimeout(() => { word.textContent = w; word.style.opacity = 1; }, 700);
  }

  function voices() {
    if (v1 || !audio.ctx) return;
    v1 = audio.oscVoice({ type: 'sine', f: 98, rev: 0.5 }); v2 = audio.oscVoice({ type: 'sine', f: 147, rev: 0.6 });
    air = audio.noiseVoice({ type: 'bandpass', f: 600, q: 0.5, rev: 0.4 });
  }

  function frame(dt) {
    t += dt;
    voices();
    if (held) {
      phase = 'in'; level = Math.min(1, level + dt / inDur);
    } else if (phase === 'in') {
      level += dt / inDur;
      if (level >= 1) { level = 1; phase = 'out'; if (!userLed) { inDur = lerp(inDur, IN, 0.4); outDur = lerp(outDur, OUT, 0.4); } }
    } else {
      level -= dt / outDur;
      if (level <= 0) { level = 0; phase = 'in'; if (userLed > 0) userLed--; inDur = lerp(inDur, IN, 0.35); outDur = lerp(outDur, OUT, 0.35); }
    }
    setWord(phase);
    const e = level * level * (3 - 2 * level);         // ease the edges of each breath

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = W / 2, cy = H / 2, base = Math.min(W, H) * 0.19, R = base + e * Math.min(W, H) * 0.2;
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75);
    bg.addColorStop(0, `rgba(${28 + e * 14},${40 + e * 16},${78 + e * 30},1)`); bg.addColorStop(0.5, '#10242e'); bg.addColorStop(1, '#0a1a1f');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';
    // wide halo
    const halo = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 2.3);
    halo.addColorStop(0, 'rgba(144,162,238,0)'); halo.addColorStop(0.32, `rgba(144,162,238,${0.1 + e * 0.12})`); halo.addColorStop(1, 'rgba(144,162,238,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
    // inner glow, very faint
    const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    inner.addColorStop(0, `rgba(221,146,211,${0.03 + e * 0.05})`); inner.addColorStop(1, `rgba(144,162,238,${0.07 + e * 0.07})`);
    ctx.fillStyle = inner; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.3); ctx.fill();
    // the ring itself: a soft band, a bright core
    const band = R * 0.2;
    const ring = ctx.createRadialGradient(cx, cy, R - band, cx, cy, R + band);
    ring.addColorStop(0, 'rgba(144,162,238,0)'); ring.addColorStop(0.42, `rgba(150,170,245,${0.2 + e * 0.2})`);
    ring.addColorStop(0.5, `rgba(226,230,255,${0.5 + e * 0.35})`); ring.addColorStop(0.58, `rgba(150,170,245,${0.2 + e * 0.2})`); ring.addColorStop(1, 'rgba(144,162,238,0)');
    ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(cx, cy, R + band, 0, Math.PI * 2); ctx.closePath(); ctx.moveTo(cx + Math.max(0, R - band), cy); ctx.arc(cx, cy, Math.max(0, R - band), 0, Math.PI * 2, true); ctx.closePath(); ctx.fill();
    // an echo, a little behind
    ctx.strokeStyle = `rgba(144,162,238,${0.07 + e * 0.05})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.32 + Math.sin(t * 0.5) * 3, 0, 6.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.62 + Math.cos(t * 0.4) * 4, 0, 6.3); ctx.stroke();
    // slow motes of light drawn in and out with the breath
    for (const m of motes) {
      m.a += m.s * dt;
      const rr = R * (m.r + 0.55) * (1.25 - e * 0.25), x = cx + Math.cos(m.a) * rr, y = cy + Math.sin(m.a) * rr;
      ctx.fillStyle = `rgba(200,210,255,${(0.08 + m.z * 0.14) * (0.5 + e * 0.5)})`;
      ctx.beginPath(); ctx.arc(x, y, 0.8 + m.z * 1.4, 0, 6.3); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // a soft low tone rises and falls with the ring
    if (v1) {
      v1.set(0.012 + e * 0.085, 98 + e * 12, 0.25); v2.set(0.004 + e * 0.04, 147 + e * 18, 0.25);
      air.set(phase === 'in' ? 0.004 + e * 0.012 : e * 0.008, 500 + e * 700);
    }
  }

  const off = pointers(cv, {
    down() {
      api.touched();
      voices();
      held = true; heldAt = t;
      if (releasedAt && phase === 'out') outDur = clamp(lerp(outDur, Math.max(2, (t - releasedAt) / Math.max(0.2, 1 - level)), 0.6), 2.5, 10);
      // start the in-breath from wherever the ring is now, at the pace of the last one
    },
    up() {
      if (!held) return;
      held = false; releasedAt = t; userLed = 2;
      const took = t - heldAt;
      if (took > 0.8) inDur = clamp(lerp(inDur, took, 0.7), 2, 9);     // follow their timing
      phase = 'out';
    },
  });

  resize();
  api.hint('Hold as you breathe in.', 4200);
  const stop = loop(frame);
  const onResize = () => resize();
  window.addEventListener('resize', onResize);

  return { destroy() { off(); stop(); window.removeEventListener('resize', onResize); [v1, v2, air].forEach(v => v && v.stop()); } };
}

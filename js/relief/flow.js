// Flow: water and sand that move with your touch.
import { h, pointers, haptic, loop, clamp } from '../util.js';
import { audio } from '../audio.js';
import { createWater } from './water.js';
import { createSand } from './sand.js';

// A soft water plink: a short sine "bloop" that rises, plus a little splash air.
export function plink(x01 = 0.5, level = 1) {
  const f = 420 + Math.random() * 520;
  audio.tone({ f, to: f * 1.9, dur: 0.16, gain: 0.16 * level, attack: 0.004, rev: 0.5, pan: (x01 - 0.5) * 1.2 });
  audio.tone({ f: f * 2.02, to: f * 2.9, dur: 0.09, gain: 0.05 * level, when: 0.02, rev: 0.6, pan: (x01 - 0.5) * 1.2 });
  audio.burst({ dur: 0.07, gain: 0.035 * level, f: 2600, q: 0.7, rev: 0.4 });
}

export function mount(stage, api) {
  const waterCv = h('canvas'), sandCv = h('canvas', { style: 'opacity:0;transition:opacity .7s ease' });
  waterCv.style.transition = 'opacity .7s ease';
  stage.append(waterCv, sandCv);
  const water = createWater(waterCv);
  let sand = null, surface = 'water';
  water.start();

  let wash = null, hiss = null, moving = 0, lastTick = 0;
  const voices = () => {
    if (!audio.ctx) return;
    if (!wash) wash = audio.noiseVoice({ type: 'bandpass', f: 700, q: 0.6, rev: 0.3 });
    if (!hiss) hiss = audio.noiseVoice({ type: 'highpass', f: 3200, q: 0.4 });
  };

  const handlers = {
    down(p) {
      voices(); api.touched();
      if (surface === 'water') { water.touch(p.x, p.y, 1.5, 15); plink(p.x / stage.clientWidth); haptic(8); }
      else if (sand && !sand.levelling) { sand.dot(p.x, p.y); audio.burst({ dur: 0.12, gain: 0.06, type: 'highpass', f: 2800 }); haptic(6); }
    },
    move(p) {
      const d = Math.hypot(p.x - p.px, p.y - p.py);
      if (surface === 'water') water.stroke(p.px, p.py, p.x, p.y, clamp(0.12 + d * 0.03, 0.12, 0.5), 11);
      else if (sand && !sand.levelling) {
        sand.carve(p.px, p.py, p.x, p.y);
        const now = performance.now();
        if (d > 1 && now - lastTick > 90) { lastTick = now; haptic(4); }
      }
      moving = Math.max(moving, p.speed);
    },
    up() {},
  };
  const offA = pointers(waterCv, handlers), offB = pointers(sandCv, handlers);

  // continuous sound follows finger speed
  const stopLoop = loop(() => {
    const v = clamp(moving / 900, 0, 1); moving *= 0.86;
    if (wash) wash.set(surface === 'water' ? v * 0.11 : 0, 500 + v * 900);
    if (hiss) hiss.set(surface === 'sand' ? v * 0.085 : 0, 2600 + v * 2600);
  });

  // controls
  let seg = null, smoothBtn = null;
  function setSurface(s) {
    if (s === surface) return;
    surface = s;
    if (s === 'sand') {
      if (!sand) { sand = createSand(sandCv); }
      sand.start(); sandCv.style.opacity = 1; sandCv.style.pointerEvents = 'auto';
      setTimeout(() => { if (surface === 'sand') water.stop(); }, 750);
    } else {
      water.start(); sandCv.style.opacity = 0; sandCv.style.pointerEvents = 'none';
      setTimeout(() => { if (surface === 'water' && sand) sand.stop(); }, 750);
    }
    if (seg) [...seg.children].forEach(b => b.classList.toggle('on', b.dataset.s === s));
    if (smoothBtn) smoothBtn.style.display = s === 'sand' ? '' : 'none';
    api.hint(s === 'sand' ? 'Draw in the sand.' : 'Touch the water.', 2600);
  }
  sandCv.style.pointerEvents = 'none';

  if (!api.tap) {
    seg = h('div', { class: 'seg', style: '--c:var(--aqua)' },
      h('button', { class: 'on', 'data-s': 'water', onclick: () => setSurface('water') }, 'Water'),
      h('button', { 'data-s': 'sand', style: '--c:var(--sand)', onclick: () => setSurface('sand') }, 'Sand'));
    seg.children[1].style.setProperty('--c', 'var(--sand)');
    smoothBtn = h('button', { class: 'pillbtn', style: 'display:none', onclick: () => {
      if (!sand || sand.levelling) return;
      sand.smoothOut();
      // wind: a long breath of filtered noise
      audio.burst({ dur: 2.1, gain: 0.09, type: 'bandpass', f: 500, to: 1500, q: 0.5, attack: 0.7, rev: 0.4 });
    } }, 'smooth');
    api.dock.append(seg, smoothBtn);
  }
  api.hint('Touch the water.', api.tap ? 3000 : 2600);

  const onResize = () => { water.resize(); if (sand) sand.resize(); };
  window.addEventListener('resize', onResize);

  return {
    destroy() {
      offA(); offB(); stopLoop(); water.destroy(); if (sand) sand.destroy();
      if (wash) wash.stop(); if (hiss) hiss.stop();
      window.removeEventListener('resize', onResize);
    },
  };
}

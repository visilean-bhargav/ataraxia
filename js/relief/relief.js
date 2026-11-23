// Relief: the mode picker, and the full-screen stage that hosts each sensory mode.
import { h } from '../util.js';
import { audio } from '../audio.js';
import { softLanding } from '../sheets.js';

export const MODES = [
  { id: 'break', name: 'Break', c: 'var(--pink)', w: '100%', line: 'Shatter it. Then restore it.', load: () => import('./break.js') },
  { id: 'knead', name: 'Knead', c: 'var(--sand)', w: '74%', line: 'Press and reshape something soft.', load: () => import('./knead.js') },
  { id: 'flow', name: 'Flow', c: 'var(--aqua)', w: '48%', line: 'Sand and water move with your touch.', load: () => import('./flow.js') },
  { id: 'breathe', name: 'Breathe', c: 'var(--peri)', w: '24%', line: 'Slow light, paced to your breath.', load: () => import('./breathe.js') },
];

const fast = new URLSearchParams(location.search).has('fast');   // shortens the waits, for demonstrating
const STEP_AFTER = fast ? 8 : 75, LAND_AFTER = fast ? 4 : 20;

// time spent in each mode during this visit to Relief
let session = null;

export function renderPicker(view) {
  view.append(
    h('p', { class: 'eyebrow', style: 'color:var(--pink)' }, 'Relief'),
    h('h1', { class: 'h', style: 'margin-top:6px' }, 'From release to rest'),
    h('p', { class: 'sub' }, 'Touch first sensory play. Start wherever you are.'),
    h('div', { class: 'scale' }, h('span', null, 'release'), h('span', null, 'rest')),
    h('div', { class: 'modes' }, MODES.map(m =>
      h('a', { class: 'mode', href: '#/relief/' + m.id, style: `--c:${m.c};--w:${m.w}` },
        h('span', { class: 'bar' }), h('h3', null, m.name), h('p', null, m.line)))),
    h('p', { class: 'quiet center', style: 'margin-top:16px' }, 'A longer bar asks for more energy. Sound on every mode.'),
  );
}

const ICON_X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICON_ON = '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';

export function renderStage(view, id, { tap = false } = {}) {
  const mode = MODES.find(m => m.id === id);
  if (!mode) { location.hash = '#/relief'; return; }
  if (!session) session = { secs: {} };
  const idx = MODES.indexOf(mode), slower = MODES[idx + 1];

  const stage = h('div', { class: 'stage' });
  const hint = h('div', { class: 'hint' });
  const dock = h('div', { class: 'dock' });
  const snd = h('button', { class: 'hud snd', 'aria-label': 'Sound' });
  const paintSnd = () => { snd.innerHTML = audio.enabled ? ICON_ON : ICON_OFF; snd.classList.toggle('off', !audio.enabled); };
  snd.addEventListener('click', () => { audio.unlock(); audio.setEnabled(!audio.enabled); paintSnd(); });
  paintSnd();
  stage.append(hint, dock, snd);
  if (tap) dock.append(h('a', { class: 'pillbtn', href: '#/', style: 'display:flex;align-items:center' }, 'more'));
  else stage.append(h('a', { class: 'hud x', href: '#/relief', 'aria-label': 'Close', html: ICON_X }));
  view.append(stage);

  let hintTimer = 0, alive = true, inst = null, secs = 0, pill = null, pillShown = false;
  const api = {
    tap, dock,
    hint(text, ms = 3000, cls = '') {
      clearTimeout(hintTimer);
      if (!text) { hint.classList.remove('on'); return; }
      hint.textContent = text; hint.className = 'hint on ' + cls;
      if (ms > 0) hintTimer = setTimeout(() => hint.classList.remove('on'), ms);
    },
    touched() {},
    next() { if (slower) location.hash = '#/relief/' + slower.id; },
  };

  mode.load().then(mod => { if (alive) inst = mod.mount(stage, api); });

  // quiet clock: only counts while the page is visible
  const clock = setInterval(() => {
    if (document.hidden) return;
    secs++; session.secs[id] = (session.secs[id] || 0) + 1;
    if (!pillShown && slower && !tap && secs >= STEP_AFTER) {
      pillShown = true;
      pill = h('div', { class: 'step' },
        h('button', { onclick: () => api.next() }, 'Ready for something slower?'),
        h('button', { class: 'no', 'aria-label': 'Dismiss', onclick: () => pill.classList.remove('on') }, '×'));
      stage.append(pill);
      requestAnimationFrame(() => requestAnimationFrame(() => pill.classList.add('on')));
      setTimeout(() => pill && pill.classList.remove('on'), 8000);
    }
  }, 1000);

  return () => {
    alive = false; clearInterval(clock); clearTimeout(hintTimer);
    if (inst) inst.destroy();
  };
}

// Called by the router when leaving the sensory stage for anywhere that is not another mode.
export function leftRelief() {
  if (!session) return;
  const s = session; session = null;
  let best = null, total = 0;
  for (const k in s.secs) { total += s.secs[k]; if (!best || s.secs[k] > s.secs[best]) best = k; }
  if (best && s.secs[best] >= LAND_AFTER) setTimeout(() => softLanding({ mode: best, seconds: total }), 350);
}

// Journal: a few taps to log a moment. Warm weekly notes, no streaks, no counts of days.
import { h, loop } from './util.js';
import { store } from './store.js';
import { WHYS, checkIn } from './sheets.js';

export const MOODS = [
  { id: 'stormy', label: 'Stormy', c: '#6f5f9a', amp: 0.3, speed: 2.6, rough: 1 },
  { id: 'choppy', label: 'Choppy', c: '#90a2ee', amp: 0.2, speed: 2, rough: 0.6 },
  { id: 'rippled', label: 'Rippled', c: '#78bdcd', amp: 0.11, speed: 1.4, rough: 0.25 },
  { id: 'calm', label: 'Calm', c: '#a7d8cf', amp: 0.05, speed: 0.9, rough: 0.08 },
  { id: 'still', label: 'Still', c: '#e5dfd3', amp: 0.012, speed: 0.5, rough: 0 },
];
const moodOf = id => MOODS.find(m => m.id === id);
const WHY_TEXT = { fun: 'fun', fitting: 'fitting in', stress: 'stress', numbing: 'numbing', habit: 'habit' };
const MODE_NAME = { break: 'Break', knead: 'Knead', flow: 'Flow', breathe: 'Breathe' };
const DAY = 864e5;

// The weekly note is written on the device from simple rules. It never mentions
// substances, quantities or failure.
export function weeklyNote(entries, now = Date.now()) {
  const wk = entries.filter(e => e.t > now - 7 * DAY && e.t <= now);
  if (wk.length < 2) return "A quieter week in here. That's allowed.";
  const out = [];
  const tagged = wk.filter(e => e.why && WHY_TEXT[e.why]);
  if (tagged.length >= 2) {
    const n = {}; tagged.forEach(e => { n[e.why] = (n[e.why] || 0) + 1; });
    const top = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    if (n[top] >= 2 && n[top] / tagged.length >= 0.4) {
      const when = {}; tagged.filter(e => e.why === top).forEach(e => {
        const hr = new Date(e.t).getHours();
        const b = hr >= 5 && hr < 12 ? 'in the mornings' : hr < 17 && hr >= 12 ? 'in the afternoons' : hr >= 17 && hr < 23 ? 'in the evenings' : 'late at night';
        when[b] = (when[b] || 0) + 1;
      });
      const wTop = Object.keys(when).sort((a, b) => when[b] - when[a])[0];
      out.push(`Most of your moments this week were about ${WHY_TEXT[top]}${when[wTop] / n[top] >= 0.6 ? ', mostly ' + wTop : ''}.`);
    } else out.push('Your moments this week were about a few different things.');
  }
  const relief = wk.filter(e => e.source === 'relief' && e.after && e.mode);
  if (relief.length) {
    const by = {}; relief.forEach(e => { (by[e.mode] = by[e.mode] || []).push(e); });
    const mode = Object.keys(by).sort((a, b) => by[b].length - by[a].length)[0], list = by[mode];
    const lighter = list.filter(e => e.after === 'lighter').length, heavier = relief.filter(e => e.after === 'heavier').length;
    if (list.length >= 2 && lighter / list.length >= 0.5) out.push(`${MODE_NAME[mode]} seemed to help: you left lighter ${lighter} ${lighter === 1 ? 'time' : 'times'} out of ${list.length}.`);
    else if (heavier / relief.length >= 0.5) out.push('Some moments stayed heavy even afterwards. Talk is there whenever you want it.');
    else if (lighter) out.push(`${MODE_NAME[mode]} left you a little lighter.`);
  }
  const moods = wk.filter(e => e.mood).sort((a, b) => a.t - b.t).map(e => MOODS.findIndex(m => m.id === e.mood));
  if (moods.length >= 2 && out.length < 3) {
    const half = Math.floor(moods.length / 2), avg = a => a.reduce((s, v) => s + v, 0) / a.length;
    const d = avg(moods.slice(half)) - avg(moods.slice(0, half));
    if (d >= 0.75) out.push('The water got calmer as the week went on.');
    else if (d <= -0.75) out.push('The water got rougher toward the end of the week. Go gently.');
    else out.push(`The water stayed mostly ${MOODS[Math.round(avg(moods))].label.toLowerCase()}.`);
  }
  return out.length ? out.join(' ') : "You came by a few times this week. That's enough.";
}

function when(t) {
  const d = new Date(t), hr = d.getHours();
  const part = hr >= 5 && hr < 12 ? 'morning' : hr >= 12 && hr < 17 ? 'afternoon' : hr >= 17 && hr < 23 ? 'evening' : 'night';
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / DAY);
  return (days === 0 ? 'This' : days === 1 ? 'Yesterday' : d.toLocaleDateString('en', { weekday: 'short' })) + ' ' + part;
}
function describe(e) {
  const bits = [];
  if (e.source === 'relief' && e.mode) bits.push(MODE_NAME[e.mode] + (e.after ? (e.after === 'lighter' ? ', left lighter' : e.after === 'heavier' ? ', still heavy' : ', about the same') : ''));
  if (e.mood) bits.push(moodOf(e.mood).label);
  const w = WHYS.find(x => x.id === e.why); if (w) bits.push(w.label);
  return bits.join(' · ') || 'A moment';
}

// Small animated water tiles instead of faces.
function moodTiles(onPick) {
  const wrap = h('div', { class: 'moods' }), tiles = [];
  MOODS.forEach(m => {
    const cv = h('canvas', { width: 120, height: 120 });
    const b = h('button', { class: 'mood', onclick: () => { [...wrap.children].forEach(x => x.classList.toggle('on', x === b)); onPick(m.id); } }, cv, h('span', null, m.label));
    wrap.append(b); tiles.push({ m, ctx: cv.getContext('2d') });
  });
  let t = 0;
  const stop = loop(dt => {
    t += dt;
    for (const { m, ctx } of tiles) {
      ctx.clearRect(0, 0, 120, 120);
      for (let k = 0; k < 4; k++) {
        const y0 = 38 + k * 20, a = m.amp * 120 * (1 - k * 0.14);
        ctx.beginPath();
        for (let x = -4; x <= 124; x += 4) {
          const u = x / 120;
          const y = y0 + Math.sin(u * 7 + t * m.speed + k * 1.7) * a * 0.55 + Math.sin(u * 17 - t * m.speed * 1.6 + k) * a * 0.45 * m.rough + Math.sin(u * 31 + t * m.speed * 2.3 + k * 4) * a * 0.3 * m.rough;
          x < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = m.c; ctx.globalAlpha = 0.95 - k * 0.2; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  });
  return { el: wrap, stop };
}

function renderLog(view) {
  let mood = null, why = null;
  const note = h('input', { class: 'field', type: 'text', maxlength: 120, placeholder: 'One line, if you like', enterkeyhint: 'done', autocomplete: 'off' });
  const save = h('button', { class: 'btn wide', style: '--c:var(--peri);margin-top:20px;opacity:.4', onclick: () => {
    if (!mood) return;
    store.add({ source: 'journal', mood, why, note: note.value.trim() });
    location.hash = '#/journal';
  } }, 'Save this moment');
  const tiles = moodTiles(id => { mood = id; save.style.opacity = 1; });
  const chips = h('div', { class: 'chips', style: '--c:var(--peri)' }, WHYS.map(w => h('button', { class: 'chip', onclick: e => {
    why = why === w.id ? null : w.id;
    [...chips.children].forEach(c => c.classList.toggle('on', c === e.currentTarget && why === w.id));
  } }, w.label)));
  view.append(
    h('a', { class: 'back', href: '#/journal' }, '← Journal'),
    h('h1', { class: 'h' }, 'How is the water?'),
    tiles.el,
    h('p', { class: 'eyebrow', style: 'margin-top:26px' }, 'What is this moment for? · optional'),
    chips,
    h('p', { class: 'eyebrow', style: 'margin-top:24px' }, 'A note · optional'),
    note, save);
  return tiles.stop;
}

export function renderJournal(view, sub) {
  if (sub === 'log') return renderLog(view);
  const now = Date.now(), today = new Date().setHours(0, 0, 0, 0);
  const week = h('div', { class: 'week' });
  for (let i = 6; i >= 0; i--) {
    const start = today - i * DAY, list = store.entries.filter(e => e.t >= start && e.t < start + DAY);
    const moods = list.filter(e => e.mood).map(e => MOODS.findIndex(m => m.id === e.mood));
    const dot = h('span', { class: 'dot' });
    if (moods.length) { dot.classList.add('has'); dot.style.setProperty('--m', MOODS[Math.round(moods.reduce((a, b) => a + b, 0) / moods.length)].c); }
    else if (list.length) { dot.classList.add('has'); dot.style.setProperty('--m', '#2a8286'); }
    week.append(h('div', { class: 'day' }, dot, h('span', null, new Date(start).toLocaleDateString('en', { weekday: 'narrow' }))));
  }
  const recent = store.entries.slice().sort((a, b) => b.t - a.t).slice(0, 6);
  const erase = h('button', { class: 'erase' }, 'Erase everything');
  let armed = 0;
  erase.addEventListener('click', () => {
    if (!armed) { erase.textContent = 'Tap again to erase everything'; armed = setTimeout(() => { armed = 0; erase.textContent = 'Erase everything'; }, 4000); return; }
    clearTimeout(armed); store.erase();
    view.replaceChildren(); renderJournal(view);
    const t = h('div', { class: 'toast' }, 'Erased. Nothing is left on this phone.');
    document.getElementById('app').append(t); setTimeout(() => t.remove(), 2600);
  });
  view.append(
    h('p', { class: 'eyebrow', style: 'color:var(--peri)' }, 'Journal'),
    h('h1', { class: 'h', style: 'margin-top:6px' }, 'This week'),
    week,
    h('div', { class: 'card note' }, h('p', null, weeklyNote(store.entries, now))),
    h('a', { class: 'btn wide', href: '#/journal/log', style: '--c:var(--peri);margin-top:18px' }, 'Log a moment'),
    h('div', { class: 'center' }, h('button', { class: 'link', onclick: checkIn }, h('u', null, 'What is this moment for?'))),
    recent.length ? h('div', { class: 'entries' }, recent.map(e => h('div', { class: 'entry' },
      h('i', { style: e.mood ? `--m:${moodOf(e.mood).c}` : '' }),
      h('div', null, describe(e), e.note ? h('span', null, ' — ' + e.note) : null),
      h('em', null, when(e.t))))) : null,
    h('div', { class: 'privacy' },
      h('p', null, 'Everything here stays on this phone. No account. Nobody else can see it.'),
      erase));
}

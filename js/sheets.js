// Soft bottom sheets: the landing after Relief, and the "why, not how much" check-in.
import { h } from './util.js';
import { store } from './store.js';

export const WHYS = [
  { id: 'fun', label: 'Fun' }, { id: 'fitting', label: 'Fitting in' }, { id: 'stress', label: 'Stress' },
  { id: 'numbing', label: 'Numbing' }, { id: 'habit', label: 'Habit' }, { id: 'unsure', label: 'Not sure' },
];
const REPLY = {
  fun: { text: 'Good. Enjoy your night. This will be here if it changes.', links: [] },
  fitting: { text: "That's a real pull. You can still choose your pace.", links: [['When someone keeps offering', '#/learn/offering', 'var(--sand)']] },
  stress: { text: 'That makes sense. Two minutes here first?', links: [['Open Flow', '#/relief/flow', 'var(--aqua)']] },
  numbing: { text: "That sounds heavy. You don't have to carry it alone.", links: [['Breathe', '#/relief/breathe', 'var(--peri)'], ['Talk', '#/talk', 'var(--aqua)']] },
  habit: { text: 'Noticing is the whole first step.', links: [['Open Journal', '#/journal', 'var(--peri)']] },
  unsure: { text: "That's fine. Not every moment needs a name.", links: [] },
};

let current = null;
export function closeSheet() {
  if (!current) return;
  const el = current; current = null;
  el.classList.remove('open');
  setTimeout(() => el.remove(), 520);
}
function openSheet(color) {
  closeSheet();
  const overlay = document.getElementById('overlay');
  const body = h('div', { class: 'sheet', style: `--c:${color}` });
  const wrap = h('div', { style: 'position:absolute;inset:0' }, h('div', { class: 'scrim', onclick: closeSheet }), body);
  overlay.append(wrap); current = wrap;
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  return body;
}
const go = href => { closeSheet(); location.hash = href; };
const skip = (label = 'Skip') => h('button', { class: 'skip', onclick: closeSheet }, label);

// One question, then one warm line, then it gets out of the way. No score, no result.
function whyStep(body, entry, question) {
  body.replaceChildren(
    h('h2', null, question),
    h('div', { class: 'chips' }, WHYS.map(w => h('button', { class: 'chip', onclick: () => {
      const e = entry || store.add({ source: 'checkin' });
      e.why = w.id; store.update();
      const r = REPLY[w.id];
      body.replaceChildren(
        h('p', { class: 'reply' }, r.text),
        r.links.length ? h('div', { class: 'row' }, r.links.map(([label, href, c]) =>
          h('button', { class: 'btn', style: `--c:${c}`, onclick: () => go(href) }, label))) : null,
        skip(r.links.length ? 'Not now' : 'Close'));
      if (!r.links.length) setTimeout(() => { if (current && current.contains(body)) closeSheet(); }, 4200);
    } }, w.label))),
    skip());
}

export function checkIn() {
  whyStep(openSheet('var(--peri)'), null, 'What is this moment for?');
}

export function softLanding({ mode, seconds }) {
  const body = openSheet('var(--pink)');
  const pick = after => {
    const entry = store.add({ source: 'relief', mode, seconds, after });
    if (after === 'heavier') {
      body.replaceChildren(
        h('h2', null, 'Want to talk to someone?'),
        h('p', { class: 'sub' }, 'A peer listener or a professional. Free, and no one else will know.'),
        h('div', { class: 'row' }, h('button', { class: 'btn', style: '--c:var(--aqua)', onclick: () => go('#/talk') }, 'Open Talk')),
        skip('Not now'));
    } else whyStep(body, entry, 'What was this moment for?');
  };
  body.append(
    h('h2', null, 'How is it now?'),
    h('div', { class: 'three' },
      h('button', { onclick: () => pick('lighter') }, 'Lighter'),
      h('button', { onclick: () => pick('same') }, 'About the same'),
      h('button', { onclick: () => pick('heavier') }, 'Heavier')),
    skip());
}

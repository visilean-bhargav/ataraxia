// Ataraxia: shell, router and Home.
import { h, pointers, haptic } from './util.js';
import { store } from './store.js';
import { audio } from './audio.js';
import { createWater } from './relief/water.js';
import { plink } from './relief/flow.js';
import { renderPicker, renderStage, leftRelief } from './relief/relief.js';
import { checkIn, closeSheet } from './sheets.js';
import { renderLearn } from './learn.js';
import { renderTalk } from './talk.js';
import { renderJournal } from './journal.js';

const view = document.getElementById('view');
const tabs = document.getElementById('tabs');
const params = new URLSearchParams(location.search);

let cleanup = null, wasStage = false;
let tapEntry = /^(coaster|poster)$/.test(params.get('tap') || '');

export function toast(text) {
  const t = h('div', { class: 'toast' }, text);
  document.getElementById('app').append(t);
  setTimeout(() => t.remove(), 2400);
}

function renderHome(v) {
  const canvas = h('canvas');
  const touchHint = h('span', { class: 'touch' }, 'Touch the water');
  const mark = h('h1', { class: 'wordmark' }, 'Ataraxia');
  const home = h('div', { class: 'home' },
    h('header', null, mark, h('p', { class: 'lede' }, 'Take a breath. Nothing is wrong.')),
    h('section', { class: 'home-relief' }, canvas,
      h('div', { class: 'cap' }, h('h3', null, 'Relief'), h('p', null, 'Touch first sensory play.')),
      touchHint,
      h('a', { class: 'btn go', href: '#/relief' }, 'Begin →')),
    h('div', { class: 'home-why center' },
      h('button', { class: 'link', onclick: checkIn }, h('u', null, 'What is this moment for?'))),
    h('div', { class: 'home-grid' },
      h('a', { class: 'card', href: '#/learn', style: '--c:var(--sand)' }, h('h3', null, 'Learn'), h('p', null, 'Situations, not scare lists.')),
      h('a', { class: 'card', href: '#/talk', style: '--c:var(--aqua)' }, h('h3', null, 'Talk'), h('p', null, 'A peer listener or a professional.')),
      h('a', { class: 'card', href: '#/journal', style: '--c:var(--peri)' }, h('h3', null, 'Journal'), h('p', null, 'A few taps to log mood.'))),
    h('footer', { class: 'foot' }, 'Student design prototype · Nitya Dave'));
  v.append(home);

  // the Relief card is live water: the first touch already does something
  const water = createWater(canvas, { budget: 70000 });
  water.start();
  const off = pointers(canvas, {
    down(p) { water.touch(p.x, p.y, 1.4, 14); plink(p.x / canvas.clientWidth, 0.8); haptic(8); touchHint.style.opacity = 0; },
    move(p) { water.stroke(p.px, p.py, p.x, p.y, 0.22, 10); },
  });
  const onResize = () => water.resize();
  window.addEventListener('resize', onResize);

  // hidden: a long press on the wordmark toggles the demo week
  let hold = 0;
  const start = () => { hold = setTimeout(() => {
    if (store.hasDemo) { store.clearDemo(); toast('Demo week removed'); } else { store.seedDemo(); toast('Demo week added'); }
    haptic(20);
  }, 900); };
  const end = () => clearTimeout(hold);
  mark.addEventListener('pointerdown', start); mark.addEventListener('pointerup', end);
  mark.addEventListener('pointerleave', end); mark.addEventListener('pointercancel', end);

  return () => { off(); water.destroy(); window.removeEventListener('resize', onResize); end(); };
}

function route() {
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const [a, b] = parts;
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  closeSheet();
  view.replaceChildren(); view.scrollTop = 0;
  const isStage = a === 'relief' && !!b;
  const full = isStage || (a === 'talk' && b === 'listener');
  document.body.classList.toggle('sensory', full);
  view.classList.remove('enter');
  if (!full) { void view.offsetWidth; view.classList.add('enter'); }
  [...tabs.children].forEach(t => t.classList.toggle('on', t.dataset.tab === a));

  if (wasStage && !isStage) leftRelief();
  wasStage = isStage;

  if (isStage) { cleanup = renderStage(view, b, { tap: tapEntry && b === 'flow' }); tapEntry = false; }
  else if (a === 'relief') cleanup = renderPicker(view);
  else if (a === 'learn') cleanup = renderLearn(view, b);
  else if (a === 'talk') cleanup = renderTalk(view, b);
  else if (a === 'journal') cleanup = renderJournal(view, b);
  else cleanup = renderHome(view);
}

// ---- boot ----
if (params.get('demo') === '1' && !store.hasDemo) store.seedDemo();
if (tapEntry) history.replaceState(null, '', location.pathname + location.search + '#/relief/flow');
window.addEventListener('hashchange', route);
route();

// iOS: block pinch zoom and double-tap zoom everywhere
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

// Offline: the service worker precaches every asset. When a new version takes over, reload once
// (unless someone is in the middle of a sensory mode).
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had || reloaded || document.body.classList.contains('sensory')) return;
    reloaded = true; location.reload();
  });
}
void audio;

import { h } from './util.js';
const COPY = {
  learn: ['var(--sand)', 'Risks framed around situations, not scare lists. Credible sources, layered depth.'],
  talk: ['var(--aqua)', 'A peer listener or a professional. Free, volunteer led, with a clear escalation path.'],
  journal: ['var(--peri)', 'A few taps to log mood. Warm weekly notes, no streak guilt.'],
};
export function renderJournal(view) {
  const [c, text] = COPY['journal'];
  view.append(h('p', { class: 'eyebrow', style: 'color:' + c }, 'Journal'), h('h1', { class: 'h', style: 'margin-top:6px' }, 'Journal'),
    h('div', { class: 'stack' }, h('div', { class: 'card', style: '--c:' + c }, h('p', { style: 'color:var(--bone);font-size:16.5px' }, text))));
}

// Learn: risks framed around situations, not scare lists. Three layers of depth, sources named.
import { h } from './util.js';

const SRC = {
  whoAlcohol: ['World Health Organization', 'Alcohol: fact sheet', 'https://www.who.int/news-room/fact-sheets/detail/alcohol'],
  whoDrugs: ['World Health Organization', 'Drugs (psychoactive): health topic', 'https://www.who.int/health-topics/drugs-psychoactive'],
  nhsPoison: ['NHS', 'Alcohol poisoning: what to do', 'https://www.nhs.uk/conditions/alcohol-poisoning/'],
  nhsMisuse: ['NHS', 'Alcohol misuse: overview', 'https://www.nhs.uk/conditions/alcohol-misuse/'],
  nimhans: ['NIMHANS', 'National Institute of Mental Health and Neuro Sciences, Bengaluru', 'https://nimhans.ac.in/'],
  nddtc: ['NDDTC, AIIMS', 'Magnitude of Substance Use in India, 2019 (Ministry of Social Justice and Empowerment)', 'https://socialjustice.gov.in/'],
};

export const CARDS = [
  {
    id: 'offering', title: 'When someone keeps offering', tag: '"just a little"',
    one: 'Saying no once is easy. It is the fourth time that is hard.',
    para: ['Most offers are not pressure, they are hospitality on repeat. A short line you have already decided on is easier to say than a reason you have to invent on the spot.'],
    lines: ["I'm good for now.", "I'm pacing myself.", 'Not tonight.'],
    after: ['Holding any drink in your hand, even water or a soft drink, ends most offers before they start.'],
    deeper: ['You do not owe anyone an explanation. A calm, repeated line works better than a debate, because there is nothing in it to argue with.',
      'If one person keeps pushing after a clear no, that says something about their evening, not about you. Moving to another part of the room is a complete answer.'],
    src: ['whoAlcohol', 'nimhans'],
  },
  {
    id: 'party', title: 'At a party', tag: 'before you arrive',
    one: 'Decide your pace before you arrive, not at the table.',
    para: ['Choices made in the moment tend to follow the room. Choices made earlier tend to follow you.'],
    list: ['Eat first.', 'Alternate with water.', 'Know how you are getting home, and who with.'],
    deeper: ['Food slows how quickly alcohol is absorbed, and water between drinks stretches the evening out. Neither makes anything risk-free; they give you more room to notice how you feel.',
      'Mixing substances makes effects harder to predict than either one alone. If you are not sure what something is, that is reason enough to leave it.'],
    src: ['whoAlcohol', 'whoDrugs'],
  },
  {
    id: 'hardweek', title: "When it's been a hard week", tag: 'switching off',
    one: 'Using to switch off works tonight and costs tomorrow.',
    para: ['Sleep gets lighter and more broken, and the stress is still there in the morning with less rest behind it.', 'Try ten minutes of something else first. If the urge is still there afterwards, it will usually be smaller.'],
    deeper: ['Alcohol can help you fall asleep faster, but it disturbs the later, deeper part of the night. Over time, using something to wind down can become the only way winding down happens.',
      'Ten minutes is not a test of willpower. It is just long enough for the sharpest part of a feeling to pass. Flow or Breathe are here for exactly that.'],
    link: ['Two minutes of Flow', '#/relief/flow'],
    src: ['nhsMisuse', 'whoAlcohol'],
  },
  {
    id: 'usually', title: 'When "sometimes" is becoming "usually"', tag: 'worth noticing',
    one: 'A few signs are worth noticing. Noticing is not a diagnosis.',
    list: ['Needing more for the same effect.', 'Using alone.', 'Using to feel normal rather than to feel good.', 'Feeling irritable without it.'],
    after: ['One of these on its own may mean very little. It is the pattern, over weeks, that is worth paying attention to.'],
    deeper: ['Health bodies describe dependence as a cluster: a strong pull to use, difficulty controlling it, needing more over time, and carrying on despite things going wrong. It builds gradually, which is why it is easy to miss from the inside.',
      'If some of this sounds familiar, the next step does not have to be a big one. Talking it through once with someone trained, free and without your name attached, is enough for now.'],
    link: ['See who you can talk to', '#/talk'],
    src: ['whoDrugs', 'nddtc', 'nimhans'],
  },
  {
    id: 'friend', title: 'When a friend has had too much', tag: 'what to do',
    one: 'Stay with them. Keep them on their side.',
    list: ['Stay with them; do not leave them to sleep it off alone.', 'If they are lying down, keep them on their side.', 'Keep them warm. Give sips of water only if they are awake and can swallow.', 'Do not give coffee. Do not put them in a cold shower. Do not make them sick.'],
    call: 'Call 112 if they cannot be woken, are breathing slowly or irregularly, or have a seizure.',
    deeper: ['Someone can keep getting worse after they have stopped drinking, because what is already in the stomach is still being absorbed. That is why staying with them matters more than anything you give them.',
      'Calling for help is never an overreaction here. If you are unsure whether it is serious enough, that doubt is itself the reason to call.'],
    src: ['nhsPoison'],
  },
  {
    id: 'stop', title: '"I can stop whenever I want"', tag: 'a simple test',
    one: 'Feeling in control and having evidence of control are different things.',
    para: ['A simple test: plan a week without, and see how it goes. No judgement either way.', 'If it is easy, good, now you know. If it is harder than expected, that is useful to know too, and nothing to be ashamed of.'],
    deeper: ['Difficulty controlling use is one of the features health bodies look for, and it is hard to judge from memory alone. A planned pause turns a feeling into something you can actually see.',
      'If you have been using heavily every day, stopping suddenly can be unsafe. In that case speak to a professional first; the helplines in Talk are free.'],
    link: ['See who you can talk to', '#/talk'],
    src: ['nhsMisuse', 'whoDrugs'],
  },
];

function sources(keys) {
  return keys.map(k => { const [who, what, url] = SRC[k]; return h('a', { class: 'src', href: url, target: '_blank', rel: 'noopener noreferrer' }, h('b', null, who + ' ↗'), h('span', null, what)); });
}

function renderCard(view, card) {
  const deeper = h('div', { class: 'deeper', style: 'display:none' },
    h('p', { class: 'eyebrow', style: 'color:var(--sand)' }, 'Go deeper'),
    card.deeper.map(t => h('p', { style: 'margin-top:10px;color:rgba(229,223,211,.86)' }, t)),
    h('p', { class: 'eyebrow', style: 'margin-top:18px' }, 'Sources'),
    sources(card.src));
  const more = h('button', { class: 'btn ghost wide', style: 'margin-top:20px', onclick: () => { deeper.style.display = ''; more.remove(); deeper.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 'Go deeper');
  view.append(
    h('a', { class: 'back', href: '#/learn' }, '← Learn'),
    h('article', { class: 'article' },
      h('p', { class: 'eyebrow', style: 'color:var(--sand)' }, card.tag),
      h('h1', { class: 'h', style: 'margin-top:6px' }, card.title),
      h('p', { class: 'one' }, card.one),
      (card.para || []).map(t => h('p', null, t)),
      card.lines ? h('div', { class: 'lines' }, card.lines.map(l => h('span', null, l))) : null,
      card.list ? h('ul', null, card.list.map(l => h('li', null, l))) : null,
      card.call ? h('a', { class: 'tel', href: 'tel:112', style: '--c:var(--sand)' }, h('div', null, h('b', null, '112'), h('small', null, card.call)), h('span', { class: 'call' }, 'Call')) : null,
      (card.after || []).map(t => h('p', null, t)),
      card.link ? h('a', { class: 'btn wide', href: card.link[1], style: '--c:var(--sand);margin-top:18px' }, card.link[0]) : null,
      more, deeper));
}

export function renderLearn(view, id) {
  const card = CARDS.find(c => c.id === id);
  if (card) return renderCard(view, card);
  view.append(
    h('p', { class: 'eyebrow', style: 'color:var(--sand)' }, 'Learn'),
    h('h1', { class: 'h', style: 'margin-top:6px' }, 'Situations, not scare lists'),
    h('p', { class: 'sub' }, 'Pick the one that looks like tonight. Each opens a line at a time.'),
    h('div', { class: 'stack' }, CARDS.map(c =>
      h('a', { class: 'card lcard', href: '#/learn/' + c.id }, h('h3', null, c.title), h('p', { class: 'one' }, c.one)))),
    h('p', { class: 'quiet center', style: 'margin-top:18px' }, 'Sources: WHO, NIMHANS, NDDTC AIIMS, NHS. Named on every card.'));
}

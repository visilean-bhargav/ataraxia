// Talk: a peer listener (concept preview), a professional (real numbers), or urgent help.
import { h } from './util.js';

const tel = (num, text, c) => h('a', { class: 'tel', href: 'tel:' + num, style: `--c:${c}` },
  h('div', null, h('b', null, num), h('small', null, text)), h('span', { class: 'call' }, 'Call'));

// ---- the scripted listener: a branching preview of how a conversation could go ----
const UNSAFE = "I don't feel safe right now";
const SCRIPT = {
  start: { say: ["Hi. I'm here, and I've got time.", "Nothing you say has to be tidy. What's on your mind tonight?"],
    opts: [["It's been a rough week", 'rough'], ["I'm not sure why I'm here", 'unsure'], [UNSAFE, 'unsafe']] },
  rough: { say: ['That sounds tiring.', 'Do you want to say what made it rough, or would you rather just sit for a bit?'],
    opts: [['Everything piled up at once', 'reach'], ["I'd rather not say", 'unnamed'], [UNSAFE, 'unsafe']] },
  unsure: { say: ["That's okay. You don't need a reason.", 'Sometimes something just feels a bit off.'],
    opts: [['Yeah. Off is the word', 'reach'], ["I've been leaning on things to switch off", 'lean'], [UNSAFE, 'unsafe']] },
  unnamed: { say: ["That's completely fine. We can leave it unnamed.", "I'm still here."],
    opts: [['Thanks', 'small'], ["Actually, I've been leaning on things to switch off", 'lean'], [UNSAFE, 'unsafe']] },
  reach: { say: ['Thanks for telling me.', 'When it piles up like that, what gets you through the evening?'],
    opts: [['Going out, mostly', 'lean'], ['Anything that switches my head off', 'lean'], ['I scroll until I fall asleep', 'small']] },
  lean: { say: ["I hear you. I'm not going to tell you what to do with that.", 'Does it feel like it is still helping, or more like it has become the routine?'],
    opts: [['Still helping, I think', 'small'], ['More like routine', 'routine'], ['It scares me a bit', 'scared']] },
  routine: { say: ['Noticing that is not nothing. A lot of people never do.'], next: 'small' },
  scared: { say: ['Thank you for saying that out loud. That takes something.', 'If it would help to talk to someone trained for exactly this, I can show you two free lines. No pressure either way.'],
    opts: [['Show me', 'pro'], ['Not yet', 'stay'], [UNSAFE, 'unsafe']] },
  small: { say: ['Okay. Would it help to try something small, like two minutes of Flow? Or we can keep talking.'],
    opts: [['Try Flow', '@#/relief/flow'], ['Keep talking', 'stay'], [UNSAFE, 'unsafe']] },
  pro: { say: ['Here they are. Both are free, and you do not have to give your name.'], cards: ['pro'], next: 'stay' },
  stay: { say: ["I'm here. That is all this needs to be."], end: true },
  unsafe: { say: ['Thank you for telling me. I want to be plain with you.',
      "I'm a peer listener, not a professional, and this is more than I should hold on my own. Your safety comes first.",
      'Please reach one of these now. If you are in danger, call 112.'], cards: ['urgent', 'pro'], after: ["I'll stay here while you call."], end: true },
};

function renderListener(view) {
  const log = h('div', { class: 'chat-log' }), opts = h('div', { class: 'chat-opts' });
  const chat = h('div', { class: 'chat' },
    h('div', { class: 'chat-top' }, h('a', { class: 'back', href: '#/talk', style: 'margin:0' }, '← Talk'),
      h('span', { style: 'margin-left:auto;font-weight:800;color:var(--aqua)' }, 'Peer listener')),
    h('div', { class: 'chat-note' }, 'Concept preview — listeners are not live yet.'),
    log, opts);
  view.append(chat);
  let alive = true; const timers = [];
  const wait = ms => new Promise(r => timers.push(setTimeout(r, ms)));
  const add = el => { log.append(el); log.scrollTop = log.scrollHeight; return el; };
  const cards = kind => kind === 'urgent'
    ? h('div', { class: 'msg them', style: 'max-width:100%;width:100%' }, h('b', null, "It's urgent"), tel('112', 'National emergency number', 'var(--pink)'))
    : h('div', { class: 'msg them', style: 'max-width:100%;width:100%' }, h('b', null, 'A professional'),
        tel('14416', 'Tele-MANAS · free, 24×7 mental health support', 'var(--aqua)'),
        tel('14446', 'National de-addiction helpline · toll-free', 'var(--aqua)'));

  async function play(id) {
    const node = SCRIPT[id]; opts.replaceChildren();
    const say = async lines => { for (const line of lines) {
      const typing = add(h('div', { class: 'typing' }, '…'));
      await wait(500 + Math.min(1300, line.length * 16)); if (!alive) return;
      typing.remove(); add(h('div', { class: 'msg them' }, line));
    } };
    await say(node.say); if (!alive) return;
    for (const k of node.cards || []) add(cards(k));
    if (node.after) await say(node.after);
    if (!alive) return;
    if (node.next) return play(node.next);
    if (node.end) {
      add(h('div', { class: 'msg sys' }, 'The preview ends here. In the full service, a trained peer listener would stay with you.'));
      opts.append(h('button', { onclick: () => { log.replaceChildren(); intro(); play('start'); } }, 'Start again'), h('button', { onclick: () => { location.hash = '#/talk'; } }, 'Back to Talk'));
      return;
    }
    for (const [label, to] of node.opts) opts.append(h('button', { onclick: () => {
      add(h('div', { class: 'msg me' }, label));
      if (to[0] === '@') { location.hash = to.slice(1); return; }
      play(to);
    } }, label));
    log.scrollTop = log.scrollHeight;
  }
  const intro = () => add(h('div', { class: 'msg sys' }, 'This is a scripted preview of how a conversation could go. Nobody is on the other end, and nothing you tap is sent anywhere.'));
  intro(); play('start');
  return () => { alive = false; timers.forEach(clearTimeout); };
}

export function renderTalk(view, sub) {
  if (sub === 'listener') return renderListener(view);
  view.append(
    h('p', { class: 'eyebrow', style: 'color:var(--aqua)' }, 'Talk'),
    h('h1', { class: 'h', style: 'margin-top:6px' }, 'Someone to talk to'),
    h('p', { class: 'sub' }, 'Free, volunteer led, with a clear escalation path.'),
    h('div', { class: 'stack' },
      h('div', { class: 'card', style: '--c:var(--aqua)' },
        h('h3', null, 'A peer listener'),
        h('p', null, 'Someone your age who has been trained to listen. Not a counsellor, not a judge.'),
        h('p', { style: 'margin-top:10px' }, h('span', { class: 'badge' }, 'Concept preview — listeners are not live yet.')),
        h('a', { class: 'btn wide', href: '#/talk/listener', style: '--c:var(--aqua);margin-top:14px' }, 'See how it would feel')),
      h('div', { class: 'card', style: '--c:var(--peri)' },
        h('h3', null, 'A professional'),
        h('p', null, 'Trained counsellors, free to call.'),
        tel('14416', 'Tele-MANAS · Government of India · free, 24×7 mental health support', 'var(--peri)'),
        tel('14446', 'National de-addiction helpline · Ministry of Social Justice and Empowerment · toll-free', 'var(--peri)')),
      h('div', { class: 'card', style: '--c:var(--pink)' },
        h('h3', null, "It's urgent"),
        h('p', null, 'If you or someone with you is in danger right now.'),
        tel('112', 'National emergency number', 'var(--pink)'))),
    h('p', { class: 'quiet center', style: 'margin-top:18px' }, 'Calls are between you and them. Ataraxia never sees or stores them.'));
}

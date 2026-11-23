// Everything lives on this device, under one localStorage key. No account, no network.
const KEY = 'ataraxia.v1';

function blank() { return { entries: [], settings: { sound: true } }; }
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.entries)) { d.settings = Object.assign({ sound: true }, d.settings); return d; }
  } catch (e) { /* private mode or corrupt data: start clean */ }
  return blank();
}

let data = load();

export const store = {
  get entries() { return data.entries; },
  get settings() { return data.settings; },
  save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} },
  add(e) {
    const entry = Object.assign({ t: Date.now(), source: 'journal', mode: null, seconds: 0, after: null, mood: null, why: null, note: '' }, e);
    data.entries.push(entry); this.save(); return entry;
  },
  update() { this.save(); },
  erase() {
    const sound = data.settings.sound;
    try { localStorage.removeItem(KEY); } catch (e) {}
    data = blank(); data.settings.sound = sound; // nothing is written back until the next change
  },
  get hasDemo() { return data.entries.some(e => e.demo); },
  clearDemo() { data.entries = data.entries.filter(e => !e.demo); this.save(); },
  // Eight days of plausible entries so the week view and weekly note are populated for a demo.
  seedDemo() {
    this.clearDemo();
    const day = 864e5, now = new Date(); now.setMinutes(12, 0, 0);
    const at = (dAgo, h) => { const d = new Date(now.getTime() - dAgo * day); d.setHours(h); return Math.min(d.getTime(), Date.now() - 6e4); };
    const E = (dAgo, h, o) => data.entries.push(Object.assign({ t: at(dAgo, h), source: 'journal', mode: null, seconds: 0, after: null, mood: null, why: null, note: '', demo: true }, o));
    E(7, 21, { source: 'relief', mode: 'break', seconds: 95, after: 'same', why: 'stress' });
    E(7, 22, { mood: 'stormy', why: 'stress', note: 'Submission week.' });
    E(6, 20, { source: 'relief', mode: 'flow', seconds: 160, after: 'lighter', why: 'stress' });
    E(5, 23, { source: 'checkin', why: 'fitting' });
    E(5, 23, { mood: 'choppy', note: 'Loud night. Left a bit early.' });
    E(4, 19, { source: 'relief', mode: 'flow', seconds: 210, after: 'lighter', why: 'stress' });
    E(4, 22, { mood: 'rippled', why: 'stress' });
    E(3, 21, { source: 'relief', mode: 'flow', seconds: 140, after: 'same', why: 'habit' });
    E(2, 20, { source: 'relief', mode: 'flow', seconds: 185, after: 'lighter', why: 'stress' });
    E(2, 22, { mood: 'calm', note: 'Slept better.' });
    E(1, 18, { source: 'relief', mode: 'breathe', seconds: 120, after: 'lighter', why: 'unsure' });
    E(1, 21, { mood: 'calm', why: 'fun', note: 'Dinner with friends.' });
    E(0, 9, { mood: 'still' });
    data.entries.sort((a, b) => a.t - b.t);
    this.save();
  },
};

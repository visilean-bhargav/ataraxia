// One shared AudioContext. Every sound is synthesised; there are no sample files.
import { store } from './store.js';

let ctx = null, master = null, wet = null, noiseBuf = null, silentEl = null;
let enabled = store.settings.sound !== false;
const listeners = new Set();

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC({ latencyHint: 'interactive' });
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  master = ctx.createGain();
  master.gain.value = enabled ? 1 : 0;
  master.connect(comp); comp.connect(ctx.destination);

  // two seconds of white noise, shared by every noise-based sound
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  // a small synthetic room, so chimes and water have air around them
  const len = Math.floor(ctx.sampleRate * 2.2);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const ch = ir.getChannelData(c);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  const conv = ctx.createConvolver(); conv.buffer = ir;
  wet = ctx.createGain(); wet.gain.value = 1;
  const wetOut = ctx.createGain(); wetOut.gain.value = 0.5;
  wet.connect(conv); conv.connect(wetOut); wetOut.connect(master);
}

// iOS mutes Web Audio when the ringer switch is on silent. Prefer the Audio Session API;
// otherwise keep a silent <audio> element looping, which moves the page to the media channel.
function silentSwitchWorkaround() {
  try {
    if (navigator.audioSession) { navigator.audioSession.type = 'playback'; return; }
  } catch (e) { /* fall through */ }
  if (silentEl) { if (enabled) silentEl.play().catch(() => {}); return; }
  const rate = 8000, n = rate / 2, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate, true);
  v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  silentEl = document.createElement('audio');
  silentEl.src = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.preload = 'auto';
  silentEl.setAttribute('x-webkit-airplay', 'deny');
  if (enabled) silentEl.play().catch(() => {});
}

export const audio = {
  get ctx() { return ctx; },
  get out() { return master; },
  get wet() { return wet; },
  get enabled() { return enabled; },
  get live() { return !!ctx && enabled && ctx.state === 'running'; },
  get t() { return ctx ? ctx.currentTime : 0; },

  // Must be called from inside a user gesture (first pointerdown). Never autoplays.
  unlock() {
    if (!ctx) build();
    if (!ctx) return;
    silentSwitchWorkaround();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  },
  setEnabled(v) {
    enabled = !!v;
    store.settings.sound = enabled; store.save();
    if (master) master.gain.setTargetAtTime(enabled ? 1 : 0, ctx.currentTime, 0.04);
    if (silentEl) { if (enabled) silentEl.play().catch(() => {}); else silentEl.pause(); }
    listeners.forEach(f => f(enabled));
  },
  onChange(f) { listeners.add(f); return () => listeners.delete(f); },

  // ---- building blocks -------------------------------------------------
  // A single enveloped oscillator. `to` glides the pitch; `rev` sends some to the room.
  tone({ f = 440, to = null, type = 'sine', dur = 0.3, gain = 0.2, attack = 0.005, when = 0, rev = 0, pan = 0 }) {
    if (!this.live) return;
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); this._route(g, rev, pan);
    o.start(t); o.stop(t + dur + 0.05);
  },
  // A filtered burst of noise.
  burst({ dur = 0.1, gain = 0.2, type = 'bandpass', f = 2000, to = null, q = 1, attack = 0.002, when = 0, rev = 0, pan = 0 }) {
    if (!this.live) return;
    const t = ctx.currentTime + when, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); this._route(g, rev, pan);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  _route(node, rev, pan) {
    let n = node;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); n.connect(p); n = p; }
    n.connect(master);
    if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; n.connect(s); s.connect(wet); }
  },
  // A continuous filtered-noise voice (water wash, sand hiss). Gain starts at zero.
  noiseVoice({ type = 'bandpass', f = 1200, q = 0.8, rev = 0 } = {}) {
    if (!ctx) return null;
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0;
    s.connect(fl); fl.connect(g); this._route(g, rev, 0); s.start();
    return {
      set(level, freq) {
        const t = ctx.currentTime;
        g.gain.setTargetAtTime(level, t, 0.06);
        if (freq) fl.frequency.setTargetAtTime(freq, t, 0.08);
      },
      stop() { const t = ctx.currentTime; g.gain.setTargetAtTime(0, t, 0.05); try { s.stop(t + 0.4); } catch (e) {} },
    };
  },
  // A continuous oscillator voice (knead stretch, breathe tone, restore shimmer).
  oscVoice({ type = 'sine', f = 110, rev = 0, lowpass = 0 } = {}) {
    if (!ctx) return null;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = 0;
    let tail = o, fl = null;
    if (lowpass) { fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lowpass; o.connect(fl); tail = fl; }
    tail.connect(g); this._route(g, rev, 0); o.start();
    return {
      set(level, freq, tc = 0.08) {
        const t = ctx.currentTime;
        g.gain.setTargetAtTime(level, t, tc);
        if (freq) o.frequency.setTargetAtTime(freq, t, tc);
      },
      cutoff(freq) { if (fl) fl.frequency.setTargetAtTime(freq, ctx.currentTime, 0.1); },
      stop() { const t = ctx.currentTime; g.gain.setTargetAtTime(0, t, 0.08); try { o.stop(t + 0.6); } catch (e) {} },
    };
  },
};

// Unlock inside the very first touch, wherever it lands; re-arm after interruptions (calls, backgrounding).
const kick = () => audio.unlock();
window.addEventListener('pointerdown', kick, { capture: true, passive: true });
window.addEventListener('touchend', kick, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) { if (silentEl) silentEl.pause(); }
  else if (ctx.state !== 'running') ctx.resume().catch(() => {});
});

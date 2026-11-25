// Chiptune sound effects synthesized with the Web Audio API: no audio files to load.
// Browsers only allow audio after a user gesture, so the context starts on the first sound
// triggered by a click or key press.

let ctx = null;
let master = null;
let muted = false;
try {
  muted = localStorage.getItem("bb.muted") === "true";
} catch {
  /* private mode */
}

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone({ freq = 440, to = null, type = "square", dur = 0.12, vol = 0.25, delay = 0 }) {
  const a = audio();
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.15, vol = 0.2, freq = 2000, q = 1, type = "bandpass", delay = 0, sweep = null }) {
  const a = audio();
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
const play = (fn) => (...args) => {
  if (muted) return;
  try {
    fn(...args);
  } catch {
    /* audio unavailable */
  }
};

export const sfx = {
  click: play(() => tone({ freq: 900, dur: 0.04, vol: 0.12 })),
  spin: play(() => noise({ dur: 0.35, vol: 0.12, freq: 600, sweep: 2400, q: 0.8 })),
  reelStop: play((i = 0) => {
    tone({ freq: 140 - i * 8, to: 70, type: "triangle", dur: 0.09, vol: 0.35 });
    noise({ dur: 0.05, vol: 0.12, freq: 3000 });
  }),
  tease: play(() => {
    tone({ freq: 220, to: 880, type: "sawtooth", dur: 1.0, vol: 0.08 });
    tone({ freq: 330, to: 1320, type: "square", dur: 1.0, vol: 0.04 });
  }),
  core: play(() => {
    tone({ freq: 1318.5, type: "square", dur: 0.18, vol: 0.18 });
    tone({ freq: 1975.5, type: "square", dur: 0.25, vol: 0.12, delay: 0.06 });
  }),
  reveal: play(() => {
    noise({ dur: 0.25, vol: 0.18, freq: 4000, sweep: 300, q: 4 });
    [0, 1, 2, 3].forEach((i) => tone({ freq: NOTES[i * 2], dur: 0.06, vol: 0.12, delay: 0.18 + i * 0.04 }));
  }),
  override: play(() => {
    tone({ freq: 1800, to: 120, type: "sawtooth", dur: 0.45, vol: 0.22 });
    noise({ dur: 0.4, vol: 0.25, freq: 800, sweep: 80, type: "lowpass" });
    tone({ freq: 55, to: 40, type: "sine", dur: 0.5, vol: 0.5 });
  }),
  capture: play((n = 0) => {
    tone({ freq: NOTES[Math.min(n, 9)], to: NOTES[Math.min(n, 9)] * 1.5, type: "square", dur: 0.12, vol: 0.16 });
  }),
  reactor: play((n = 0) => tone({ freq: 660 + n * 220, to: 990 + n * 220, type: "triangle", dur: 0.14, vol: 0.25 })),
  lock: play(() => {
    tone({ freq: 200, to: 90, type: "square", dur: 0.08, vol: 0.2 });
    noise({ dur: 0.06, vol: 0.15, freq: 1500, delay: 0.02 });
  }),
  levelUp: play(() => {
    [0, 2, 4, 5, 7, 9].forEach((i, j) => tone({ freq: NOTES[i], dur: 0.14, vol: 0.18, delay: j * 0.07 }));
    noise({ dur: 0.6, vol: 0.12, freq: 500, sweep: 6000, q: 0.7, delay: 0.1 });
  }),
  win: play((x = 1) => {
    const n = x >= 10 ? 5 : x >= 3 ? 4 : x >= 1 ? 3 : 2;
    for (let i = 0; i < n; i++) tone({ freq: NOTES[i * 2], type: "square", dur: 0.1, vol: 0.14, delay: i * 0.06 });
  }),
  bigWin: play(() => {
    [0, 2, 4, 7, 4, 7, 9].forEach((i, j) => tone({ freq: NOTES[i], type: "square", dur: 0.16, vol: 0.18, delay: j * 0.11 }));
    [0, 4, 7].forEach((i) => tone({ freq: NOTES[i] / 2, type: "triangle", dur: 0.9, vol: 0.14, delay: 0.66 }));
  }),
  bonus: play(() => {
    noise({ dur: 0.5, vol: 0.25, freq: 200, sweep: 8000, q: 1.5 });
    [0, 4, 7, 9].forEach((i, j) => tone({ freq: NOTES[i], type: "sawtooth", dur: 0.25, vol: 0.12, delay: 0.3 + j * 0.09 }));
  }),
  coin: play(() => tone({ freq: 1975.5, to: 2637, type: "square", dur: 0.05, vol: 0.08 })),
};

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem("bb.muted", String(m));
  } catch {
    /* private mode */
  }
  if (!m) audio();
}

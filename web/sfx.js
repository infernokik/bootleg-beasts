// Chiptune sound effects synthesized with the Web Audio API: no audio files to load.
// Browsers only allow audio after a user gesture, so the context starts on the first sound
// triggered by a click or key press.

let ctx = null;
let master = null;
let muted = false; // master mute (the speaker button)
let sfxOff = false; // settings: sound effects / music switched off individually
let musicOff = false;
try {
  muted = localStorage.getItem("bb.muted") === "true";
  sfxOff = localStorage.getItem("bb.sfxOff") === "true";
  musicOff = localStorage.getItem("bb.musicOff") === "true";
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

function tone({ freq = 440, to = null, type = "square", dur = 0.12, vol = 0.25, delay = 0, at = null, out = null }) {
  const a = audio();
  const t = at ?? a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out || master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.15, vol = 0.2, freq = 2000, q = 1, type = "bandpass", delay = 0, sweep = null, at = null, out = null }) {
  const a = audio();
  const t = at ?? a.currentTime + delay;
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
  src.connect(f).connect(g).connect(out || master);
  src.start(t);
}

const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
const play = (fn) => (...args) => {
  if (muted || sfxOff) return;
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
export const audioPrefs = () => ({ sound: !sfxOff, music: !musicOff });
export function setAudioPrefs({ sound, music: m }) {
  sfxOff = !sound;
  musicOff = !m;
  try {
    localStorage.setItem("bb.sfxOff", String(sfxOff));
    localStorage.setItem("bb.musicOff", String(musicOff));
  } catch {
    /* private mode */
  }
  if (musicOff) music.pause();
  else music.resume();
}
export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem("bb.muted", String(m));
  } catch {
    /* private mode */
  }
  if (!m) audio();
  if (m) music.pause();
  else music.resume();
}

// ---- Bonus music -------------------------------------------------------------------
// A 4-bar chiptune loop in A minor, scheduled slightly ahead of time. Each level is faster and adds
// a layer: kick + bass, then hats, then snare + arpeggio, then a lead line. Level -1 is the calmer
// base-game loop.
const TEMPO = [116, 126, 138, 152];
const BASE_TEMPO = 96;
const ROOTS = [110, 87.31, 130.81, 98]; // A2 F2 C3 G2
const LEAD = [4, 3, 2, 3, 4, 6, 4, 3]; // scale-ish multipliers of the root, two notes per bar
const M = { on: false, level: 0, step: 0, next: 0, timer: null, gain: null };

function busGain() {
  const a = audio();
  if (!M.gain) {
    M.gain = a.createGain();
    M.gain.connect(master);
  }
  return M.gain;
}

function playStep(s, t, out) {
  const bar = s >> 4, i = s & 15, root = ROOTS[bar], L = M.level;
  if (L < 0) {
    if (i % 8 === 0) tone({ freq: 110, to: 45, type: "sine", dur: 0.16, vol: 0.32, at: t, out });
    if (i % 4 === 2) tone({ freq: root, type: "triangle", dur: 0.22, vol: 0.14, at: t, out });
    if (i % 4 === 0) tone({ freq: root * [3, 4, 4.76, 4][bar], type: "sine", dur: 0.3, vol: 0.035, at: t, out });
    if (i % 4 === 3) noise({ dur: 0.02, vol: 0.025, freq: 9000, type: "highpass", at: t, out });
    return;
  }
  if (i % 4 === 0) tone({ freq: 130, to: 42, type: "sine", dur: 0.14, vol: 0.55, at: t, out });
  if (i % 2 === 0) tone({ freq: i % 4 === 2 ? root * 2 : root, type: "triangle", dur: 0.11, vol: 0.2, at: t, out });
  if (L >= 1 && i % 2 === 1) noise({ dur: 0.03, vol: 0.06, freq: 8000, type: "highpass", at: t, out });
  if (L >= 2) {
    if (i === 4 || i === 12) noise({ dur: 0.12, vol: 0.14, freq: 1800, q: 0.8, at: t, out });
    const chord = [2, 2.378, 3, 4][i % 4];
    tone({ freq: root * chord, type: "square", dur: 0.06, vol: 0.035, at: t, out });
  }
  if (L >= 3 && (i === 0 || i === 8)) {
    tone({ freq: root * LEAD[bar * 2 + (i >> 3)], type: "sawtooth", dur: 0.34, vol: 0.05, at: t, out });
  }
}

function pump() {
  const a = audio();
  const out = busGain();
  while (M.next < a.currentTime + 0.15) {
    playStep(M.step, M.next, out);
    M.next += 60 / (M.level < 0 ? BASE_TEMPO : TEMPO[M.level]) / 4;
    M.step = (M.step + 1) % 64;
  }
}

export const music = {
  start(level = 0) {
    M.on = true;
    M.level = level;
    M.step = 0;
    this.resume();
  },
  setLevel(level) {
    M.level = Math.min(level, TEMPO.length - 1);
  },
  resume() {
    if (!M.on || muted || musicOff || M.timer) return;
    try {
      const a = audio();
      busGain().gain.setValueAtTime(0.55, a.currentTime);
      M.next = a.currentTime + 0.05;
      M.timer = setInterval(pump, 30);
      pump();
    } catch {
      /* audio unavailable */
    }
  },
  pause() {
    clearInterval(M.timer);
    M.timer = null;
    if (M.gain && ctx) M.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  },
  stop() {
    M.on = false;
    this.pause();
  },
};

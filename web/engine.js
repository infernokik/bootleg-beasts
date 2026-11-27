// Bootleg Beasts game engine: a line-for-line port of src/bootleg_beasts/engine.py.
// All amounts are multiples of the bet. The UI multiplies by the bet size.
// selftest.html checks this file against the Python engine.

export const WILD = 9;
export const OVERRIDE = 10;
export const CORE = 11;
export const STATIC = 12;
export const REACTOR = 13;
export const N_PAYING = 9;
export const N_BEASTS = 4; // symbols 0-3 are the beasts (H1-H4)
export const HOLD_FOREVER = 99; // a netted reel with this hold stays wild for the rest of the bonus

// ---- Randomness ------------------------------------------------------------
const POOL = new Uint32Array(4096);
let poolPos = POOL.length;
function cryptoInt(n) {
  const limit = Math.floor(0x100000000 / n) * n; // reject the biased tail
  for (;;) {
    if (poolPos >= POOL.length) {
      crypto.getRandomValues(POOL);
      poolPos = 0;
    }
    const x = POOL[poolPos++];
    if (x < limit) return x % n;
  }
}
let randInt = cryptoInt;
export function setRandInt(fn) {
  randInt = fn || cryptoInt;
}

// ---- Grid helpers ----------------------------------------------------------
export const emptyMask = (R, K) => Array.from({ length: R }, () => new Array(K).fill(false));
export const copyMask = (m) => m.map((col) => col.slice());

export function addCross(mask, reel, row) {
  for (let k = 0; k < mask[reel].length; k++) mask[reel][k] = true;
  for (let r = 0; r < mask.length; r++) mask[r][row] = true;
}

const cumulative = (w) => {
  let acc = 0;
  return w.map((x) => (acc += x));
};

export class Game {
  constructor(data) {
    this.data = data;
    this.R = data.reels;
    this.K = data.rows;
    this.maxWin = data.maxWin;
    this.levels = data.levels;
    this.overrideReels = data.overrideReels;
    this.codeToId = Object.fromEntries(data.symbols.map((s, i) => [s.code, i]));
    this.pay = data.symbols.slice(0, N_PAYING).map((s) => [0, 0, 0, ...data.paytable[s.code]]);
    this.reelSets = {};
    for (const [key, strips] of Object.entries(data.reelSets)) {
      const lens = data.reelLengths[key];
      this.reelSets[key] = strips.map((strip, r) => strip.slice(0, lens[r]));
    }
    this.wildMult = { values: data.wildMults.values, cum: cumulative(data.wildMults.weights) };
    this.cum = {};
    for (const [key, w] of Object.entries(data.overrideWeights)) this.cum[key] = cumulative(w);
    this.reveal = {};
    for (const [mode, table] of Object.entries(data.revealWeights)) {
      this.reveal[mode] = { syms: Object.keys(table).map((c) => this.codeToId[c]), cum: cumulative(Object.values(table)) };
    }
  }

  draw(cum) {
    const x = randInt(cum[cum.length - 1]);
    for (let i = 0; i < cum.length; i++) if (x < cum[i]) return i;
    return cum.length - 1;
  }

  spinReels(key) {
    const strips = this.reelSets[key];
    const grid = [];
    const stops = [];
    for (let r = 0; r < this.R; r++) {
      const strip = strips[r];
      const stop = randInt(strip.length);
      stops.push(stop);
      const col = [];
      for (let k = 0; k < this.K; k++) col.push(strip[(stop + k) % strip.length]);
      grid.push(col);
    }
    return { grid, stops };
  }

  /** Every visible Static not under a blocked cell turns into one random symbol (drawn every spin). */
  revealStatic(grid, blocked, mode) {
    const t = this.reveal[mode];
    const sym = t.syms[this.draw(t.cum)];
    const cells = [];
    for (let r = 0; r < this.R; r++)
      for (let k = 0; k < this.K; k++)
        if (!(blocked && blocked[r][k]) && grid[r][k] === STATIC) {
          grid[r][k] = sym;
          cells.push([r, k]);
        }
    return { sym: cells.length ? sym : -1, cells };
  }

  // Ways win (x bet). With detail, also return each paying symbol's run and the cells it uses.
  /** Ways win. `wmult` (base game only) gives each Tag Wild not covered by a Net its
   *  multiplier: it counts as that many ways, so multipliers on one win multiply together. */
  waysWin(grid, mask, detail = false, wmult = null) {
    const R = this.R;
    const K = this.K;
    const cnt = [];
    const wild = new Array(R).fill(0);
    for (let r = 0; r < R; r++) {
      const c = new Array(N_PAYING).fill(0);
      for (let k = 0; k < K; k++) {
        const v = grid[r][k];
        if (mask[r][k]) wild[r]++;
        else if (v === WILD) wild[r] += wmult ? wmult[r][k] : 1;
        else if (v < N_PAYING) c[v]++;
      }
      cnt.push(c);
    }
    let total = 0;
    const lines = [];
    for (let s = 0; s < N_PAYING; s++) {
      let ways = 1;
      let length = 0;
      for (let r = 0; r < R; r++) {
        const c = cnt[r][s] + wild[r];
        if (c === 0) break;
        ways *= c;
        length++;
      }
      if (length >= 3) {
        const win = this.pay[s][length] * ways;
        total += win;
        if (detail) {
          const cells = [];
          for (let r = 0; r < length; r++)
            for (let k = 0; k < K; k++)
              if (mask[r][k] || grid[r][k] === WILD || grid[r][k] === s) cells.push([r, k]);
          lines.push({ sym: s, length, ways, pay: this.pay[s][length], win, cells });
        }
      }
    }
    if (detail) lines.sort((a, b) => b.win - a.win);
    return detail ? { total, lines } : total;
  }

  /** One base-game spin: reels stop, Cores are counted, Static reveals, then any Net expands. */
  baseSpin({ mode = "base", forceOverride = false } = {}) {
    const { grid, stops } = this.spinReels(mode);
    const landed = grid.map((c) => c.slice());
    let cores = 0;
    for (const col of grid) for (const v of col) if (v === CORE) cores++;
    const reveal = this.revealStatic(grid, null, "base");
    const mask = emptyMask(this.R, this.K);
    const n = forceOverride ? 1 : this.draw(this.cum[mode] ?? this.cum.base);
    const drops = n > 0 ? this.placeNets(n) : [];
    for (const [r, k] of drops) addCross(mask, r, k);
    const wmult = grid.map((col) => col.map(() => 1));
    const wildMults = [];
    for (let r = 0; r < this.R; r++)
      for (let k = 0; k < this.K; k++)
        if (!mask[r][k] && grid[r][k] === WILD && landed[r][k] === WILD) { // revealed wilds carry no multiplier
          wmult[r][k] = this.wildMult.values[this.draw(this.wildMult.cum)];
          wildMults.push([r, k, wmult[r][k]]);
        }
    const { total, lines } = this.waysWin(grid, mask, true, wmult);
    const win = Math.min(total, this.maxWin);
    const startLevel = this.data.startLevel[Math.min(cores, 5)] ?? -1;
    return { grid, landed, stops, mask, drops, reveal, cores, win, lines, startLevel, wildMults };
  }

  startBonus(startLevel, cap = this.maxWin) {
    return {
      startLevel, level: startLevel, cap, spinsLeft: this.data.freeSpins, played: 0, meter: 0, reactors: 0,
      caught: 0, mult: 1, total: 0, nDrop: 0, timer: new Array(this.R).fill(0), done: false, capped: false,
      floored: false,
    };
  }

  /** Drop up to n Net Wilds on reels 2-4, each on a different reel (in the bonus, netted or not);
   *  each drop picks uniformly among the cells of the reels not used yet. */
  placeNets(n) {
    const drops = [];
    const free = [...this.overrideReels];
    for (let i = 0; i < n && free.length; i++) {
      const pick = randInt(free.length * this.K);
      const r = free.splice(Math.floor(pick / this.K), 1)[0];
      drops.push([r, pick % this.K]);
    }
    return drops;
  }

  /** One free spin. Mirrors engine.bonus_round's loop body. */
  bonusSpin(st) {
    const lv = this.levels[st.level];
    const levelBefore = st.level;
    const multBefore = st.mult;
    st.spinsLeft--;
    st.played++;
    const timerBefore = st.timer.slice();
    const { grid, stops } = this.spinReels("bonus");
    const landed = grid.map((c) => c.slice());
    const reactorCells = [];
    for (let r = 0; r < this.R; r++)
      for (let k = 0; k < this.K; k++) if (grid[r][k] === REACTOR) reactorCells.push([r, k]);
    const mask = timerBefore.map((t) => new Array(this.K).fill(t > 0));
    const reveal = this.revealStatic(grid, null, "bonus");
    const n = this.draw(this.cum[lv.key]);
    const drops = n > 0 ? this.placeNets(n) : [];
    const captures = [];
    for (const [dr] of drops) {
      for (let k = 0; k < this.K; k++) {
        if (grid[dr][k] < N_BEASTS) {
          st.mult += lv.catch;
          st.caught++;
          captures.push({ r: dr, k, sym: grid[dr][k], value: lv.catch, mult: st.mult });
        }
        mask[dr][k] = true;
      }
      const t = lv.hold >= HOLD_FOREVER ? HOLD_FOREVER : lv.hold + 1;
      if (t > st.timer[dr]) st.timer[dr] = t;
    }
    st.nDrop += drops.length;
    const { total: base, lines } = this.waysWin(grid, mask, true);
    let spinWin = base * st.mult;
    const spinMult = st.mult;
    st.total += spinWin;
    let levelUps = 0;
    let doubled = false;
    let timerDecayed = st.timer.slice();
    if (st.total >= st.cap) {
      spinWin -= st.total - st.cap;
      st.total = st.cap;
      st.capped = true;
      st.done = true;
      st.reactors += reactorCells.length;
    } else {
      for (let r = 0; r < this.R; r++) if (st.timer[r] > 0 && st.timer[r] < HOLD_FOREVER) st.timer[r]--;
      timerDecayed = st.timer.slice();
      st.reactors += reactorCells.length;
      st.meter += reactorCells.length;
      while (st.meter >= this.data.reactorsPerLevel && st.level < this.levels.length - 1) {
        st.meter -= this.data.reactorsPerLevel;
        st.level++;
        st.spinsLeft += this.data.levelUpSpins;
        levelUps++;
        if (this.levels[st.level].doubles) {
          st.mult *= 2;
          doubled = true;
          for (let r = 0; r < this.R; r++) if (st.timer[r] > 0) st.timer[r] = HOLD_FOREVER;
        }
      }
      if (st.spinsLeft <= 0) st.done = true;
    }
    if (st.done && !st.capped) {
      const floor = this.data.minBonusWin[st.startLevel];
      if (st.total < floor) {
        st.floored = Math.min(floor, st.cap) - st.total;
        st.total = Math.min(floor, st.cap);
      }
    }
    return {
      grid, landed, stops, mask, timerBefore, timerDecayed, timerAfter: st.timer.slice(), drops, reveal, reactorCells, captures,
      multBefore, spinMult, lines, baseWin: base, spinWin, levelBefore, levelUps, doubled,
    };
  }

  /** Whole bonus at once (used by the self-test). */
  playBonus(startLevel, cap = this.maxWin) {
    const st = this.startBonus(startLevel, cap);
    while (!st.done) this.bonusSpin(st);
    return st;
  }
}

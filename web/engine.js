// Bootleg Beasts game engine: a line-for-line port of src/bootleg_beasts/engine.py.
// All amounts are multiples of the bet. The UI multiplies by the bet size.
// selftest.html checks this file against the Python engine.

export const WILD = 9;
export const OVERRIDE = 10;
export const CORE = 11;
export const STATIC = 12;
export const N_PAYING = 9;

// ---- Randomness ------------------------------------------------------------
// Unbiased integers from crypto.getRandomValues, buffered for speed.
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

export class Game {
  constructor(data) {
    this.data = data;
    this.R = data.reels;
    this.K = data.rows;
    this.maxWin = data.maxWin;
    this.tiers = data.tiers;
    this.retrigger = data.retrigger;
    this.overrideReels = data.overrideReels;
    this.codeToId = Object.fromEntries(data.symbols.map((s, i) => [s.code, i]));
    this.pay = data.symbols.slice(0, N_PAYING).map((s) => [0, 0, 0, ...data.paytable[s.code]]);
    this.reelSets = {};
    for (const [key, strips] of Object.entries(data.reelSets)) {
      const lens = data.reelLengths[key];
      this.reelSets[key] = strips.map((strip, r) => strip.slice(0, lens[r]));
    }
    this.cum = {};
    for (const [key, w] of Object.entries(data.overrideWeights)) {
      let acc = 0;
      this.cum[key] = w.map((x) => (acc += x));
    }
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

  drawCount(key) {
    const cum = this.cum[key];
    const x = randInt(cum[cum.length - 1]);
    for (let i = 0; i < cum.length; i++) if (x < cum[i]) return i;
    return cum.length - 1;
  }

  // Drop up to n Override Wilds on reels 2-4, each on a different reel, never on a blocked cell.
  placeOverrides(n, blocked) {
    const drops = [];
    const used = new Set();
    for (let i = 0; i < n; i++) {
      const cands = [];
      for (const r of this.overrideReels) {
        if (used.has(r)) continue;
        for (let k = 0; k < this.K; k++) if (!blocked[r][k]) cands.push([r, k]);
      }
      if (!cands.length) break;
      const pick = cands[randInt(cands.length)];
      used.add(pick[0]);
      drops.push(pick);
    }
    return drops;
  }

  // Ways win (x bet). With detail, also return each paying symbol's run and the cells it uses.
  waysWin(grid, mask, detail = false) {
    const R = this.R;
    const K = this.K;
    const cnt = [];
    const wild = new Array(R).fill(0);
    for (let r = 0; r < R; r++) {
      const c = new Array(N_PAYING).fill(0);
      for (let k = 0; k < K; k++) {
        const v = grid[r][k];
        if (mask[r][k] || v === WILD) wild[r]++;
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

  countCores(grid, sticky) {
    let n = 0;
    for (let r = 0; r < this.R; r++)
      for (let k = 0; k < this.K; k++) if (grid[r][k] === CORE && !(sticky && sticky[r][k])) n++;
    return n;
  }

  // One base-game spin. Capture Cores are counted before any Override Wild expands.
  baseSpin() {
    const { grid, stops } = this.spinReels("base");
    const cores = this.countCores(grid, null);
    const mask = emptyMask(this.R, this.K);
    const n = this.drawCount("base");
    const drops = n > 0 ? this.placeOverrides(n, emptyMask(this.R, this.K)) : [];
    for (const [r, k] of drops) addCross(mask, r, k);
    const { total, lines } = this.waysWin(grid, mask, true);
    const win = Math.min(total, this.maxWin);
    const tier = cores >= 3 ? Math.min(cores, 5) - 3 : -1;
    return { grid, stops, mask, drops, cores, win, lines, tier };
  }

  startBonus(tierIndex, cap = this.maxWin) {
    const tier = this.tiers[tierIndex];
    const st = {
      tierIndex, tier, cap, spinsLeft: tier.freeSpins, played: 0, mult: 1, total: 0, nDrop: 0,
      sticky: emptyMask(this.R, this.K), done: false, capped: false, preplaced: [],
    };
    if (tier.preplaced > 0) {
      st.preplaced = this.placeOverrides(tier.preplaced, st.sticky);
      for (const [r, k] of st.preplaced) addCross(st.sticky, r, k);
    }
    return st;
  }

  // One free spin. Mirrors engine.bonus_round's loop body.
  bonusSpin(st) {
    const tier = st.tier;
    st.spinsLeft--;
    st.played++;
    const stickyBefore = copyMask(st.sticky);
    const { grid, stops } = this.spinReels(tier.key);
    const cores = this.countCores(grid, stickyBefore);
    const mask = copyMask(stickyBefore);
    let n = this.drawCount(tier.key);
    let guaranteed = false;
    if (tier.guaranteed && n === 0 && st.nDrop === 0 && st.spinsLeft === 0) {
      n = 1;
      guaranteed = true;
    }
    const drops = n > 0 ? this.placeOverrides(n, stickyBefore) : [];
    for (const [r, k] of drops) addCross(mask, r, k);
    for (const [r, k] of drops) {
      if (tier.stickyMode === 2) addCross(st.sticky, r, k);
      else if (tier.stickyMode === 1) for (let kk = 0; kk < this.K; kk++) st.sticky[r][kk] = true;
    }
    st.nDrop += drops.length;
    const multBefore = st.mult;
    st.mult += tier.multStep * drops.length;
    const { total: base, lines } = this.waysWin(grid, mask, true);
    let spinWin = base * st.mult;
    st.total += spinWin;
    let retrig = false;
    if (st.total >= st.cap) {
      spinWin -= st.total - st.cap;
      st.total = st.cap;
      st.capped = true;
      st.done = true;
    } else if (cores >= this.retrigger.cores) {
      st.spinsLeft += this.retrigger.spins;
      retrig = true;
    }
    if (st.spinsLeft <= 0) st.done = true;
    return {
      grid, stops, mask, stickyBefore, drops, guaranteed, cores, lines, baseWin: base,
      multBefore, mult: st.mult, spinWin, retrig,
    };
  }

  // Whole bonus at once (used by the self-test). Returns the total win.
  playBonus(tierIndex, cap = this.maxWin) {
    const st = this.startBonus(tierIndex, cap);
    while (!st.done) this.bonusSpin(st);
    return st;
  }
}

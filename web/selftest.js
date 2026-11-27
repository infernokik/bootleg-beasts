// Checks the JavaScript engine against the Python model:
//   1. ways evaluation on 1,500 grids exported from Python (must match exactly)
//   2. bonus rules on hand-built reels (same cases as tests/test_engine.py)
//   3. Monte Carlo: base game, Street Hunt, Night Raid and Lockdown starts vs the verified Python numbers
import { Game, setRandInt } from "./engine.js?v=14";

const out = document.getElementById("out");
const results = { pass: 0, fail: 0 };
const log = (s) => (out.textContent += s + "\n");
const check = (ok, s) => {
  results[ok ? "pass" : "fail"]++;
  log(`${ok ? "PASS" : "FAIL"}  ${s}`);
};

const data = await (await fetch("game-data.json", { cache: "no-cache" })).json();
const vectors = await (await fetch("test-vectors.json", { cache: "no-cache" })).json();
const game = new Game(data);
const id = Object.fromEntries(data.symbols.map((s, i) => [s.code, i]));

// 1. Ways evaluation
let maxErr = 0;
for (const v of vectors) {
  const mask = v.mask.map((col) => col.map(Boolean));
  maxErr = Math.max(maxErr, Math.abs(game.waysWin(v.grid, mask) - v.win));
}
check(maxErr < 1e-9, `ways evaluation matches Python on ${vectors.length} grids (max diff ${maxErr})`);

// 2. Bonus rules on hand-built reels
function customGame(reels, { weights = [1, 0, 0], pays = null, catchValues = null } = {}) {
  const d = structuredClone(data);
  d.reelSets.bonus = reels.map((r) => r.map((c) => id[c]));
  d.reelLengths.bonus = reels.map((r) => r.length);
  d.levels.forEach((lv, i) => {
    d.overrideWeights[lv.key] = weights;
    if (catchValues) lv.catch = catchValues[i];
  });
  for (const code of Object.keys(d.paytable)) d.paytable[code] = [0, 0, 0];
  if (pays) Object.assign(d.paytable, pays);
  d.minBonusWin = [0, 0, 0, 0];
  d.revealWeights.bonus = { L5: 1 };
  return new Game(d);
}
const L5x5 = ["L5", "L5", "L5", "L5", "L5"];
const ONE_CORE = [L5x5, ["R", "L5", "L5", "L5", "L5"], L5x5, L5x5, L5x5];
let st = customGame(ONE_CORE).playBonus(0);
check(st.played === 19 && st.level === 3 && st.reactors === 19,
  `3 Cores per level, +3 spins each: ${st.played} spins, final level ${st.level + 1}`);
st = customGame(ONE_CORE).playBonus(2);
check(st.played === 13 && st.level === 3, `starting on level 3 skips ahead: ${st.played} spins`);
st = customGame(ONE_CORE, { pays: { L5: [0, 0, 0.001] } }).playBonus(0);
check(st.mult === 2 && Math.abs(st.total - (9 * 2.5 + 10 * 5)) < 1e-9, `Overload doubles the multiplier: x${st.mult}, ${st.total}`);
const beasts = Array(5).fill(["H1", "H1", "H1", "H1", "H1"]);
const every = { weights: [0, 1, 0], pays: { H1: [0, 0, 0.001] } };
st = customGame(beasts, { ...every, catchValues: [1, 1, 1, 1] }).playBonus(0);
let expect = 0;
for (let i = 1; i <= 10; i++) expect += (1 + 5 * i) * 3.125;
check(st.mult === 51 && st.caught === 50 && Math.abs(st.total - expect) < 1e-9,
  `Catch Multiplier never resets: x${st.mult} after ${st.caught} catches, total ${st.total.toFixed(3)}`);
const ok = [0, 1, 2, 3].every((lvl) => customGame(beasts, every).playBonus(lvl).nDrop === 10);
check(ok, "Nets land every spin on every level, netted reels included");
st = customGame([L5x5, L5x5, L5x5, L5x5, L5x5], { weights: [0, 1, 0] }).playBonus(3);
check([1, 2, 3].every((r) => st.timer[r] === data.holdForever) && !st.timer[0] && !st.timer[4], "Overload nets hold for good");
st = customGame([L5x5, L5x5, L5x5, L5x5, L5x5], { weights: [0, 1, 0] }).playBonus(0);
check(st.timer.every((t) => t === 0), "Street Hunt nets don't hold");

// 3. Monte Carlo against the verified Python numbers (fast PRNG; |z| < 3 passes)
setRandInt((n) => Math.floor(Math.random() * n));
const s = data.stats;
function mc(label, n, sample, expected) {
  const t0 = performance.now();
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < n; i++) {
    const x = sample();
    sum += x;
    sq += x * x;
  }
  const mean = sum / n;
  const se = Math.sqrt((sq / n - mean * mean) / n);
  const z = (mean - expected) / se;
  check(Math.abs(z) < 3, `${label}: JS ${mean.toFixed(4)} vs Python ${expected.toFixed(4)} ` +
    `(z = ${z.toFixed(2)}, ${n.toLocaleString()} rounds, ${((performance.now() - t0) / 1000).toFixed(1)}s)`);
}
await new Promise((r) => setTimeout(r, 0));
mc("Base game ways RTP (with wild multipliers)", 4_000_000, () => game.baseSpin().win, s.baseRtp);
mc("Super Net Spin ways win (guaranteed cross)", 300_000, () => game.baseSpin({ forceOverride: true }).win, s.overrideSpinWays);
mc("Street Hunt (level 1 start) mean payout", 150_000, () => game.playBonus(0).total, s.bonusMean[0]);
mc("Night Raid (level 2 start) mean payout", 100_000, () => game.playBonus(1).total, s.bonusMean[1]);
mc("Lockdown (level 3 start) mean payout", 60_000, () => game.playBonus(2).total, s.bonusMean[2]);
setRandInt(null);

log(`\n${results.pass} passed, ${results.fail} failed`);
document.title = results.fail ? "SELFTEST FAILED" : "SELFTEST PASSED";
window.selftest = results;

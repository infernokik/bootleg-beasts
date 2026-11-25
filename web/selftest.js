// Checks the JavaScript engine against the Python model:
//   1. ways evaluation on 1,500 grids exported from Python (must match exactly)
//   2. bonus rules on hand-built reels (same cases as tests/test_engine.py)
//   3. Monte Carlo: base game, Street Hunt, Night Raid and Lockdown starts vs the verified Python numbers
import { Game, setRandInt } from "./engine.js?v=11";

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
function customGame(reels, { weights = [1, 0, 0], pays = null, capture = null } = {}) {
  const d = structuredClone(data);
  d.reelSets.bonus = reels.map((r) => r.map((c) => id[c]));
  d.reelLengths.bonus = reels.map((r) => r.length);
  for (const lv of d.levels) {
    d.overrideWeights[lv.key] = weights;
    if (capture) lv.capture = capture;
  }
  for (const code of Object.keys(d.paytable)) d.paytable[code] = [0, 0, 0];
  if (pays) Object.assign(d.paytable, pays);
  d.minBonusWin = [0, 0, 0, 0];
  d.revealWeights.bonus = { L5: 1 };
  return new Game(d);
}
const L5x5 = ["L5", "L5", "L5", "L5", "L5"];
const ONE_REACTOR = [["R", "L5", "L5", "L5", "L5"], L5x5, L5x5, L5x5, L5x5];
let st = customGame(ONE_REACTOR).playBonus(0);
check(st.played === 22 && st.level === 3 && st.reactors === 22,
  `3 Reactors per level, +4 spins each: ${st.played} spins, final level ${st.level + 1}`);
st = customGame(ONE_REACTOR).playBonus(2);
check(st.played === 14 && st.level === 3, `starting on level 3 skips ahead: ${st.played} spins`);
const beasts = Array(5).fill(["H1", "H1", "H1", "H1", "H1"]);
const two = { values: [2, 2, 2], weights: [1, 1, 1] };
const zero = { values: [0, 0, 0], weights: [1, 1, 1] };
const withCap = customGame(beasts, { weights: [0, 1, 0], pays: { H1: [0, 0, 0.001] }, capture: two }).playBonus(0).total;
const noCap = customGame(beasts, { weights: [0, 1, 0], pays: { H1: [0, 0, 0.001] }, capture: zero }).playBonus(0).total;
check(Math.abs(withCap - 11 * noCap) < 1e-9, `captured beasts stack: x${(withCap / noCap).toFixed(2)} (expect x11)`);
const lockGame = customGame([L5x5, L5x5, L5x5, L5x5, L5x5], { weights: [0, 1, 0] });
st = lockGame.playBonus(2);
check(st.nDrop === 3 && [1, 2, 3].every((r) => st.sticky[r].every(Boolean)),
  `Lockdown locks each Override column: ${st.nDrop} drops`);
st = lockGame.playBonus(0);
check(st.nDrop === 10 && !st.sticky.flat().some(Boolean), "Street Hunt columns don't lock");

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
mc("Base game ways RTP", 4_000_000, () => game.baseSpin().win, s.baseRtp);
mc("Street Hunt (level 1 start) mean payout", 150_000, () => game.playBonus(0).total, s.bonusMean[0]);
mc("Night Raid (level 2 start) mean payout", 100_000, () => game.playBonus(1).total, s.bonusMean[1]);
mc("Lockdown (level 3 start) mean payout", 60_000, () => game.playBonus(2).total, s.bonusMean[2]);
setRandInt(null);

log(`\n${results.pass} passed, ${results.fail} failed`);
document.title = results.fail ? "SELFTEST FAILED" : "SELFTEST PASSED";
window.selftest = results;

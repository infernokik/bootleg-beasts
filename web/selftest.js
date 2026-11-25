// Checks the JavaScript engine against the Python model:
//   1. ways evaluation on 1,500 grids exported from Python (must match exactly)
//   2. bonus rules on dead reels (same cases as tests/test_engine.py)
//   3. Monte Carlo: base game and both buys vs the verified Python numbers
import { Game, setRandInt } from "./engine.js";

const out = document.getElementById("out");
const results = { pass: 0, fail: 0 };
const log = (s) => (out.textContent += s + "\n");
const check = (ok, s) => {
  results[ok ? "pass" : "fail"]++;
  log(`${ok ? "PASS" : "FAIL"}  ${s}`);
};

const data = await (await fetch("game-data.json")).json();
const vectors = await (await fetch("test-vectors.json")).json();
const game = new Game(data);

// 1. Ways evaluation
let maxErr = 0;
for (const v of vectors) {
  const mask = v.mask.map((col) => col.map(Boolean));
  maxErr = Math.max(maxErr, Math.abs(game.waysWin(v.grid, mask) - v.win));
}
check(maxErr < 1e-9, `ways evaluation matches Python on ${vectors.length} grids (max diff ${maxErr})`);

// 2. Bonus rules on dead reels
function deadGame(weights) {
  // Zero paytable so no bonus ends early at the max-win cap (same as the Python test).
  const d = structuredClone(data);
  for (const code of Object.keys(d.paytable)) d.paytable[code] = [0, 0, 0];
  const L5 = d.symbols.findIndex((s) => s.code === "L5");
  for (const t of d.tiers) {
    d.reelSets[t.key] = d.reelSets[t.key].map((s) => s.map(() => L5));
    d.overrideWeights[t.key] = weights;
  }
  return new Game(d);
}
const every = deadGame([0, 1, 0]);
const never = deadGame([1, 0, 0]);
const expectEvery = [[10, 10, 1], [10, 3, 4], [10, 2, 5]];
const expectNever = [1, 1, 0];
data.tiers.forEach((t, i) => {
  const a = every.playBonus(i);
  check(
    a.played === expectEvery[i][0] && a.nDrop === expectEvery[i][1] && a.mult === expectEvery[i][2],
    `${t.name}: Override every spin -> ${a.played} spins, ${a.nDrop} drops, x${a.mult}`,
  );
  const b = never.playBonus(i);
  check(b.nDrop === expectNever[i], `${t.name}: no natural drops -> ${b.nDrop} (guaranteed cross rule)`);
});

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
mc("Base game ways RTP", 6_000_000, () => game.baseSpin().win, s.baseRtp);
mc("Street Hunt mean payout", 200_000, () => game.playBonus(0).total, s.bonusMean.street_hunt);
mc("Night Raid mean payout", 200_000, () => game.playBonus(1).total, s.bonusMean.night_raid);
setRandInt(null);

log(`\n${results.pass} passed, ${results.fail} failed`);
document.title = results.fail ? "SELFTEST FAILED" : "SELFTEST PASSED";
window.selftest = results;

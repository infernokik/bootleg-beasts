// Bootleg Beasts: browser UI. Every outcome comes from engine.js, which uses the same reel strips,
// weights and rules as the verified Python model (game-data.json).
import { Game, WILD, OVERRIDE, CORE } from "./engine.js";
import { symbolHTML } from "./symbols.js";
import { Fx, shake, glitchHit } from "./fx.js";
import { startBackground } from "./background.js";

try {
  startBackground(document.getElementById("bg"));
} catch (err) {
  console.warn("background disabled:", err); // decoration only: never block the game
}

const data = await (await fetch("game-data.json")).json();
const game = new Game(data);
const CODES = data.symbols.map((s) => s.code);
const NAMES = data.symbols.map((s) => s.name);
const R = data.reels;
const K = data.rows;
const BETS = [0.2, 0.5, 1, 2, 5, 10, 20];
const START_BALANCE = 1000;
const BIG_WIN = 25; // x bet
const FEATURE_TEXT = {
  street_hunt: "10 free spins · Override Wilds drop more often · one guaranteed",
  night_raid: "10 free spins · Override columns lock wild · multiplier +1 each",
  legendary: "10 free spins · starts with a locked cross · crosses lock · multiplier +2 each",
};

// ---- State & helpers -----------------------------------------------------------
const $ = (id) => document.getElementById(id);
const ui = {
  grid: $("grid"), wrap: document.querySelector(".grid-wrap"), ovl: $("ovl"), banner: $("banner"), bannerTitle: $("bannerTitle"), bannerSub: $("bannerSub"),
  ticker: $("ticker"), balance: $("balance"), win: $("win"), bet: $("bet"), spin: $("spinBtn"),
  betUp: $("betUp"), betDown: $("betDown"), buys: [$("buy0"), $("buy1")],
  buyCosts: [$("buyCost0"), $("buyCost1")], turbo: $("turbo"), auto: $("auto"), refill: $("refill"),
  hud: $("hud"), hudName: $("hudName"), hudSpins: $("hudSpins"), hudMult: $("hudMult"),
  hudTotal: $("hudTotal"), info: $("info"), infoBody: $("infoBody"), infoBtn: $("infoBtn"),
  sSpins: $("sSpins"), sBet: $("sBet"), sWon: $("sWon"), sRtp: $("sRtp"), repoLink: $("repoLink"),
};
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem("bb." + k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem("bb." + k, JSON.stringify(v));
    } catch {
      /* private mode */
    }
  },
};
const S = {
  balance: store.get("balance", START_BALANCE),
  betIdx: Math.min(store.get("betIdx", 2), BETS.length - 1),
  busy: false, spins: 0, wagered: 0, won: 0,
};
const round2 = (x) => Math.round(x * 100) / 100;
const fmt = (x) => x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bet = () => BETS[S.betIdx];
const speed = () => (ui.turbo.checked ? 0.35 : 1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * speed()));
const bump = (el) => {
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
};

// ---- Reels & overlay -----------------------------------------------------------------
// Each reel is a window onto a strip of cells that scrolls during a spin. The overlay grid above
// the reels holds everything that must not scroll: Override Wilds, wild crosses, locked wilds and
// win frames.
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fx = new Fx(ui.wrap);
const reels = [];
const cells = Array.from({ length: R }, () => []);
const ocells = Array.from({ length: R }, () => []);
for (let r = 0; r < R; r++) {
  const el = document.createElement("div");
  el.className = "reel";
  const strip = document.createElement("div");
  strip.className = "strip";
  el.appendChild(strip);
  ui.grid.appendChild(el);
  reels.push({ el, strip });
}
for (let k = 0; k < K; k++) {
  for (let r = 0; r < R; r++) {
    const o = document.createElement("div");
    o.className = "ocell";
    ui.ovl.appendChild(o);
    ocells[r][k] = o;
  }
}

function makeCell(sym) {
  const c = document.createElement("div");
  c.className = "cell";
  c.setAttribute("role", "img");
  c.dataset.sym = CODES[sym];
  c.setAttribute("aria-label", NAMES[sym]);
  c.innerHTML = symbolHTML(CODES[sym]);
  return c;
}

function setColumn(r, col) {
  const fresh = col.map(makeCell);
  reels[r].strip.replaceChildren(...fresh);
  cells[r] = fresh;
}

function cellPitch() {
  const [a, b] = reels[0].strip.children;
  return b.offsetTop - a.offsetTop;
}

function clearFx(keepSticky = false) {
  ui.grid.classList.remove("has-win");
  for (const col of cells) for (const c of col) c.classList.remove("win", "land");
  for (const col of ocells) {
    for (const o of col) {
      o.classList.remove("win", "wildcell", "ow-drop", "core-hit", "lock-in");
      o.style.removeProperty("--d");
      if (!keepSticky) o.classList.remove("sticky", "ow-origin");
      if (!o.classList.contains("sticky")) o.replaceChildren();
    }
  }
}

function renderSticky(sticky, origins, animate) {
  for (let r = 0; r < R; r++) {
    for (let k = 0; k < K; k++) {
      if (!sticky[r][k]) continue;
      const o = ocells[r][k];
      const origin = origins.some(([rr, kk]) => rr === r && kk === k);
      if (!o.classList.contains("sticky") || o.classList.contains("ow-origin") !== origin) {
        o.innerHTML = symbolHTML(origin ? "OW" : "W");
        o.classList.add("sticky");
        o.classList.toggle("ow-origin", origin);
        if (animate) {
          o.style.setProperty("--d", `${(r + k) * 40 * speed()}ms`);
          o.classList.add("lock-in");
        }
      }
    }
  }
}

/** Spin all reels to `grid`. Reels stop left to right; once two Capture Cores are showing, each
 *  remaining reel slows down and glows (the bonus tease). */
async function spinReels(key, grid, stops, sticky) {
  const pitch = cellPitch();
  const base = 560 * speed();
  const stagger = 170 * speed();
  const tease = 1150 * speed();
  let prev = 0;
  let cores = 0;
  const jobs = [];
  for (let r = 0; r < R; r++) {
    const locked = !!sticky && sticky[r].every(Boolean);
    const teasing = !locked && cores >= 2;
    const stopAt = teasing ? prev + tease : Math.max(base + r * stagger, prev + stagger);
    jobs.push(spinReel(r, key, grid[r], stops[r], { stopAt, teasing, teaseFrom: prev, locked }, pitch, sticky));
    prev = stopAt;
    for (let k = 0; k < K; k++) if (grid[r][k] === CORE && !(sticky && sticky[r][k])) cores++;
  }
  await Promise.all(jobs);
}

function spinReel(r, key, col, stop, plan, pitch, sticky) {
  const { el, strip } = reels[r];
  if (plan.locked || reduceMotion) {
    setColumn(r, col);
    return Promise.resolve();
  }
  const src = game.reelSets[key][r];
  const fillerCount = Math.max(6, Math.min(60, Math.round(plan.stopAt / 55)));
  const finals = col.map(makeCell);
  const fillers = [];
  for (let i = 0; i < fillerCount; i++) fillers.push(makeCell(src[(stop + 5 + i) % src.length]));
  strip.prepend(...finals, ...fillers);
  const dist = (5 + fillerCount) * pitch;
  el.classList.add("spinning");
  if (plan.teasing) setTimeout(() => el.classList.add("tease"), plan.teaseFrom);
  setTimeout(() => el.classList.remove("spinning"), plan.stopAt * 0.86);
  const anim = strip.animate(
    [
      { transform: `translateY(${-dist}px)`, easing: "cubic-bezier(.32,0,.22,1)" },
      { transform: `translateY(${pitch * 0.16}px)`, offset: 0.9, easing: "cubic-bezier(.3,0,.3,1)" },
      { transform: "translateY(0)" },
    ],
    { duration: plan.stopAt },
  );
  return anim.finished.then(() => {
    while (strip.children.length > 5) strip.lastElementChild.remove();
    cells[r] = finals;
    el.classList.remove("tease");
    for (let k = 0; k < K; k++) {
      finals[k].classList.add("land");
      if (col[k] === CORE && !(sticky && sticky[r][k])) {
        const [x, y] = fx.at(ocells[r][k]);
        fx.burst(x, y, { n: 18, colors: ["#ffc531", "#fff1a8", "#ff8a3d"], speed: 3.5, size: 3, life: 35 });
      }
    }
  });
}

async function showOverrides(drops, sticky) {
  for (const [r, k] of drops) {
    const o = ocells[r][k];
    o.innerHTML = symbolHTML("OW");
    o.classList.add("ow-drop");
    tick(`<b>Override Wild</b> on reel ${r + 1}: its whole row and column turn wild.`);
    await sleep(300);
    const [x, y] = fx.at(o);
    fx.burst(x, y, { n: 50, speed: 7.5, size: 5, life: 50 });
    shake(ui.wrap, 9, 420);
    fx.beam(o, ui.grid, false);
    fx.beam(o, ui.grid, true);
    for (let rr = 0; rr < R; rr++) {
      for (let kk = 0; kk < K; kk++) {
        if ((rr === r) === (kk === k)) continue; // only the cross, not the origin
        if (sticky && sticky[rr][kk]) continue;
        const cell = ocells[rr][kk];
        cell.style.setProperty("--d", `${(Math.abs(rr - r) + Math.abs(kk - k)) * 55 * speed()}ms`);
        cell.classList.add("wildcell");
      }
    }
    await sleep(640);
  }
}

function coreHit(grid, sticky) {
  for (let r = 0; r < R; r++) {
    for (let k = 0; k < K; k++) {
      if (grid[r][k] !== CORE || (sticky && sticky[r][k])) continue;
      ocells[r][k].classList.add("core-hit");
      const [x, y] = fx.at(ocells[r][k]);
      fx.burst(x, y, { n: 30, colors: ["#ffc531", "#fff1a8", "#ff8a3d", "#fff"], speed: 5.5, size: 4 });
    }
  }
}

// ---- Text, banners, meters ------------------------------------------------------
function tick(html) {
  ui.ticker.innerHTML = html;
}

function linesText(lines, mult, b) {
  const parts = lines.slice(0, 3).map((l) => {
    const ways = `${l.ways.toLocaleString()} way${l.ways > 1 ? "s" : ""}`;
    const m = mult > 1 ? ` × ${mult}` : "";
    return `<b>${NAMES[l.sym]}</b> ${l.length} of a kind · ${ways}${m} = <span class="amt">${fmt(l.win * mult * b)}</span>`;
  });
  if (lines.length > 3) parts.push(`+${lines.length - 3} more`);
  return parts.join(" &nbsp;|&nbsp; ");
}

async function banner(title, sub, ms, cls = "") {
  ui.bannerTitle.textContent = title;
  ui.bannerSub.innerHTML = sub || "";
  ui.banner.className = `banner ${cls}`;
  ui.banner.hidden = false;
  await sleep(ms);
  ui.banner.hidden = true;
}

async function countBanner(title, amount, ms, cls = "") {
  ui.bannerTitle.textContent = title;
  ui.banner.className = `banner ${cls}`;
  ui.banner.hidden = false;
  const dur = ms * 0.6 * speed();
  const t0 = performance.now();
  await new Promise((res) => {
    const f = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      ui.bannerSub.textContent = fmt(amount * (1 - (1 - p) ** 3));
      if (p < 1) requestAnimationFrame(f);
      else res();
    };
    requestAnimationFrame(f);
  });
  await sleep(ms * 0.4);
  ui.banner.hidden = true;
}

function setWin(x) {
  ui.win.textContent = fmt(x);
}

function credit(amount) {
  S.balance = round2(S.balance + amount);
  S.won = round2(S.won + amount);
}

function render() {
  ui.balance.textContent = fmt(S.balance);
  ui.bet.textContent = fmt(bet());
  data.tiers.forEach((t, i) => {
    if (t.buyPrice && ui.buyCosts[i]) ui.buyCosts[i].textContent = fmt(t.buyPrice * bet());
  });
  ui.sSpins.textContent = S.spins.toLocaleString();
  ui.sBet.textContent = fmt(S.wagered);
  ui.sWon.textContent = fmt(S.won);
  ui.sRtp.textContent = S.wagered ? `${((100 * S.won) / S.wagered).toFixed(1)}%` : "–";
  const canSpin = S.balance >= bet() - 1e-9;
  ui.refill.hidden = canSpin || S.busy;
  ui.spin.disabled = S.busy || !canSpin;
  ui.betUp.disabled = S.busy || S.betIdx >= BETS.length - 1;
  ui.betDown.disabled = S.busy || S.betIdx <= 0;
  ui.buys.forEach((b, i) => (b.disabled = S.busy || S.balance < data.tiers[i].buyPrice * bet() - 1e-9));
  store.set("balance", S.balance);
  store.set("betIdx", S.betIdx);
}

async function showWins(lines, mult, winX, b) {
  ui.grid.classList.add("has-win");
  const hit = new Set();
  for (const l of lines) {
    for (const [r, k] of l.cells) {
      cells[r][k].classList.add("win");
      ocells[r][k].classList.add("win");
      hit.add(r * K + k);
    }
  }
  const per = Math.max(2, Math.min(9, Math.round(150 / hit.size)));
  for (const id of hit) {
    const [x, y] = fx.at(ocells[Math.floor(id / K)][id % K]);
    fx.burst(x, y, { n: per, colors: ["#b6ff3b", "#fff1a8", "#ffc531"], speed: 3.2, size: 3, life: 38, gravity: 0.1 });
  }
  tick(linesText(lines, mult, b));
  if (winX >= BIG_WIN) {
    await sleep(700);
    shake(ui.wrap, winX >= 100 ? 12 : 8, 500);
    fx.fountain(winX >= 250 ? 220 : winX >= 100 ? 150 : 90);
    const title = winX >= 250 ? "EPIC WIN" : winX >= 100 ? "MEGA WIN" : "BIG WIN";
    await countBanner(title, round2(winX * b), 2400, winX >= 100 ? "gold" : "");
  } else {
    await sleep(950);
  }
}

// ---- Game flow -------------------------------------------------------------------
async function runBonus(tierIndex, cap) {
  const st = game.startBonus(tierIndex, cap);
  const t = st.tier;
  const b = bet();
  const origins = [...st.preplaced];
  document.body.classList.add("in-bonus", `tier-${t.key}`);
  ui.hud.hidden = false;
  ui.hudName.textContent = t.name;
  const hud = () => {
    ui.hudSpins.textContent = st.spinsLeft;
    ui.hudMult.textContent = t.multStep ? `×${st.mult}` : "none";
    ui.hudTotal.textContent = fmt(round2(st.total * b));
  };
  hud();
  await glitchHit(600);
  await banner(t.name.toUpperCase(), FEATURE_TEXT[t.key], 2300, t.key === "legendary" ? "gold" : "");
  clearFx();
  if (origins.length) {
    await showOverrides(origins, null);
    clearFx(true);
    renderSticky(st.sticky, origins, true);
    tick(`<b>${t.name}</b> starts with a locked Override cross.`);
    await sleep(900);
  }
  while (!st.done) {
    clearFx(true);
    const res = game.bonusSpin(st);
    hud();
    await spinReels(t.key, res.grid, res.stops, res.stickyBefore);
    if (res.drops.length) {
      if (res.guaranteed) {
        tick("<b>Last spin:</b> guaranteed Override Wild!");
        await sleep(650);
      }
      await showOverrides(res.drops, res.stickyBefore);
      if (t.multStep) {
        ui.hudMult.textContent = `×${res.mult}`;
        bump(ui.hudMult);
      }
      if (t.stickyMode) origins.push(...res.drops);
    }
    if (res.spinWin > 0) await showWins(res.lines, res.mult, res.spinWin, b);
    else {
      tick(`Free spin ${st.played}: no win.`);
      await sleep(380);
    }
    hud();
    if (t.stickyMode && res.drops.length) {
      clearFx(true);
      renderSticky(st.sticky, origins, true);
      tick(t.stickyMode === 1 ? "That column is now <b>locked wild</b> for the rest of the bonus." :
        "That cross is now <b>locked wild</b> for the rest of the bonus.");
      await sleep(700);
    }
    if (res.retrig) {
      coreHit(res.grid, res.stickyBefore);
      await sleep(600);
      await banner("+4 FREE SPINS", "3 Capture Cores landed", 1500);
    }
  }
  const total = round2(st.total * b);
  await countBanner(`${t.name} complete`, total, 2400, t.key === "legendary" ? "gold" : "");
  document.body.classList.remove("in-bonus", `tier-${t.key}`);
  ui.hud.hidden = true;
  clearFx();
  return st;
}

async function maxWinBanner(b) {
  shake(ui.wrap, 14, 700);
  fx.fountain(300);
  await banner("MAX WIN", `${fmt(round2(data.maxWin * b))} · 10,000× bet`, 3000, "gold");
}

async function spin() {
  if (S.busy) return;
  const b = bet();
  if (S.balance < b - 1e-9) {
    ui.auto.checked = false;
    render();
    return;
  }
  S.busy = true;
  S.balance = round2(S.balance - b);
  S.spins++;
  S.wagered = round2(S.wagered + b);
  setWin(0);
  render();
  clearFx();

  const res = game.baseSpin();
  await spinReels("base", res.grid, res.stops, null);
  if (res.drops.length) await showOverrides(res.drops, null);
  let totalX = res.win;
  if (res.win > 0) {
    await showWins(res.lines, 1, res.win, b);
    credit(round2(res.win * b));
    setWin(round2(res.win * b));
    render();
  } else if (res.tier < 0) {
    tick(res.cores ? `${res.cores} Capture Core${res.cores > 1 ? "s" : ""}. Land 3 for a bonus.` : "No win.");
  }
  if (res.tier >= 0) {
    coreHit(res.grid, null);
    tick(`<b>${res.cores} Capture Cores!</b>`);
    await sleep(1400);
    const st = await runBonus(res.tier, data.maxWin - res.win);
    totalX += st.total;
    credit(round2(st.total * b));
  }
  if (totalX >= data.maxWin - 1e-9) await maxWinBanner(b);
  setWin(round2(totalX * b));
  S.busy = false;
  render();
  if (ui.auto.checked) {
    if (S.balance >= bet() - 1e-9) setTimeout(spin, 380 * speed());
    else ui.auto.checked = false;
  }
}

async function buyBonus(i) {
  const t = data.tiers[i];
  const b = bet();
  const cost = round2(t.buyPrice * b);
  if (S.busy || S.balance < cost - 1e-9) return;
  ui.auto.checked = false;
  S.busy = true;
  S.balance = round2(S.balance - cost);
  S.wagered = round2(S.wagered + cost);
  setWin(0);
  render();
  clearFx();
  tick(`Bought <b>${t.name}</b> for ${fmt(cost)}.`);
  const st = await runBonus(i, data.maxWin);
  const amount = round2(st.total * b);
  credit(amount);
  if (st.capped) await maxWinBanner(b);
  setWin(amount);
  tick(`<b>${t.name}</b> paid <span class="amt">${fmt(amount)}</span> (${(st.total / t.buyPrice).toFixed(2)}× the price).`);
  S.busy = false;
  render();
}

// ---- Info dialog -----------------------------------------------------------------
function pct(x, d = 2) {
  return `${(100 * x).toFixed(d)}%`;
}

function buildInfo() {
  const b = bet();
  const s = data.stats || {};
  const [sh, nr] = data.tiers;
  const rows = data.symbols.slice(0, 9).map((sym) =>
    `<tr><td><span class="pt-sym">${symbolHTML(sym.code)}${sym.name}</span></td>` +
    data.paytable[sym.code].map((p) => `<td>${fmt(p * b)}</td>`).join("") + "</tr>").join("");
  const stat = (v, label) => `<div class="stat"><b>${v}</b><span>${label}</span></div>`;
  ui.infoBody.innerHTML = `
    <h2>Bootleg Beasts</h2>
    <p>5 reels × 5 rows, <b>3,125 ways</b>. Wins pay left to right for 3 or more matching symbols on
    adjacent reels, starting from reel 1. Each win is the pay per way × the number of ways (on every
    reel in the run, count the matching symbols plus wilds, then multiply).</p>
    <h3>Verified math</h3>
    <div class="stat-grid">
      ${stat(s.rtp ? pct(s.rtp, 3) : "96.00%", `RTP (± ${s.rtpCi95 ? pct(s.rtpCi95, 3) : "–"})`)}
      ${stat(s.hitRate ? pct(s.hitRate, 1) : "–", "Hit frequency")}
      ${stat("10,000×", s.maxWinOdds ? `Max win · 1 in ${Math.round(s.maxWinOdds).toLocaleString()} spins` : "Max win")}
      ${stat(s.buyRtp ? pct(s.buyRtp.street_hunt) : "–", `${sh.name} buy RTP`)}
      ${stat(s.buyRtp ? pct(s.buyRtp.night_raid) : "–", `${nr.name} buy RTP`)}
      ${stat(s.triggerOdds ? `1 in ${Math.round(s.triggerOdds[0])}` : "–", "Bonus frequency (3+ Cores)")}
    </div>
    <p>The base game is calculated exactly. Each bonus is simulated 100 million times, and the whole
    game 10 billion times as an independent check. This page plays the same reel strips and rules.
    <a href="selftest.html">Run the engine self-test.</a></p>
    <h3>Paytable (bet ${fmt(b)}, pays per way)</h3>
    <table><thead><tr><th>Symbol</th><th>3</th><th>4</th><th>5</th></tr></thead><tbody>${rows}</tbody></table>
    <h3>Wilds</h3>
    <ul>
      <li><b>Glitch Wild</b> (reels 2–5) substitutes for every paying symbol.</li>
      <li><b>Override Wild</b> is dropped onto a random position on reels 2–4. Its <b>whole row and whole
      column turn wild</b>. Capture Cores are counted before the cross expands.</li>
    </ul>
    <h3>Bonuses</h3>
    <ul>
      <li><b>3 Capture Cores: Street Hunt.</b> 10 free spins on special reels. Override Wilds drop more often,
      and at least one is guaranteed (it drops on the last spin if none has landed).</li>
      <li><b>4 Capture Cores: Night Raid.</b> 10 free spins. Each Override Wild raises the multiplier by 1,
      including on the spin it lands, and its column stays wild for the rest of the bonus. At least one
      Override Wild is guaranteed.</li>
      <li><b>5 Capture Cores: Legendary Capture.</b> 10 free spins, starting with one locked Override cross.
      Each Override Wild raises the multiplier by 2, and its whole cross stays wild. It can't be bought.</li>
      <li>During any bonus, 3 or more Capture Cores award +4 free spins. Locked cells hide whatever lands
      under them, so Cores there don't count and no new Override Wild can land there.</li>
    </ul>
    <h3>Bonus buys and max win</h3>
    <p>${sh.name} costs ${sh.buyPrice}× bet and ${nr.name} costs ${nr.buyPrice}× bet. The maximum win is
    <b>10,000× bet</b> per round, including any bonus, and the round ends when it's reached.</p>
    <p class="label">Free-play portfolio demo. Virtual credits have no cash value. Not a gambling product.</p>`;
}

// ---- Wiring ----------------------------------------------------------------------
ui.spin.addEventListener("click", spin);
ui.buys.forEach((b, i) => b.addEventListener("click", () => buyBonus(i)));
ui.betUp.addEventListener("click", () => {
  S.betIdx = Math.min(S.betIdx + 1, BETS.length - 1);
  render();
});
ui.betDown.addEventListener("click", () => {
  S.betIdx = Math.max(S.betIdx - 1, 0);
  render();
});
ui.refill.addEventListener("click", () => {
  S.balance = START_BALANCE;
  render();
});
ui.turbo.addEventListener("change", () => document.documentElement.style.setProperty("--t", speed()));
ui.auto.addEventListener("change", () => {
  if (ui.auto.checked && !S.busy) spin();
});
ui.infoBtn.addEventListener("click", () => {
  buildInfo();
  ui.info.showModal();
});
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || ui.info.open) return;
  e.preventDefault();
  spin();
});

const repo = document.body.dataset.repo;
if (repo) {
  ui.repoLink.href = repo;
  ui.repoLink.hidden = false;
}

// First screen: a random base-game window, no animation.
const first = game.spinReels("base").grid;
for (let r = 0; r < R; r++) setColumn(r, first[r]);
render();

// ---- Debug hooks (only with ?debug in the URL) -------------------------------------------
if (new URLSearchParams(location.search).has("debug")) {
  const baseCum = game.cum.base;
  window.bb = {
    game,
    /** Play a bonus tier for free (0 Street Hunt, 1 Night Raid, 2 Legendary). */
    async bonus(i) {
      if (S.busy) return;
      S.busy = true;
      render();
      const st = await runBonus(i, data.maxWin);
      credit(round2(st.total * bet()));
      S.busy = false;
      render();
    },
    /** Force an Override Wild on every base spin (true) or restore the real odds (false). */
    forceOverride(on = true) {
      game.cum.base = on ? [0, 1, 1] : baseCum;
    },
    /** Make the next base spin stop at these reel stops. */
    forceStops(stops) {
      const real = game.spinReels.bind(game);
      game.spinReels = (key) => {
        game.spinReels = real;
        const strips = game.reelSets[key];
        return { stops, grid: strips.map((s, r) => Array.from({ length: K }, (_, k) => s[(stops[r] + k) % s.length])) };
      };
    },
    spin,
  };
}

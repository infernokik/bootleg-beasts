// Glitch Tamers: browser UI. Every outcome comes from engine.js, which uses the same reel strips,
// weights and rules as the verified Python model (game-data.json).
import { Game, WILD, OVERRIDE, CORE } from "./engine.js";
import { svgFor } from "./symbols.js";

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
  grid: $("grid"), banner: $("banner"), bannerTitle: $("bannerTitle"), bannerSub: $("bannerSub"),
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
      const v = localStorage.getItem("gt." + k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem("gt." + k, JSON.stringify(v));
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

// ---- Grid ------------------------------------------------------------------------
const cells = Array.from({ length: R }, () => []);
for (let k = 0; k < K; k++) {
  for (let r = 0; r < R; r++) {
    const c = document.createElement("div");
    c.className = "cell";
    c.setAttribute("role", "img");
    ui.grid.appendChild(c);
    cells[r][k] = c;
  }
}
const allCells = () => cells.flat();

function setSym(cell, sym) {
  const code = CODES[sym];
  if (cell.dataset.sym === code) return;
  cell.dataset.sym = code;
  cell.innerHTML = svgFor(code);
  cell.setAttribute("aria-label", NAMES[sym]);
}

function clearFx(keepSticky = false) {
  ui.grid.classList.remove("has-win");
  for (const c of allCells()) {
    c.classList.remove("win", "wildcell", "ow-drop", "core-hit", "land", "spinning");
    if (!keepSticky) c.classList.remove("sticky", "ow-origin");
    c.style.removeProperty("--d");
  }
}

function renderSticky(sticky, origins) {
  for (let r = 0; r < R; r++) {
    for (let k = 0; k < K; k++) {
      const c = cells[r][k];
      if (!sticky[r][k]) continue;
      const origin = origins.some(([rr, kk]) => rr === r && kk === k);
      setSym(c, origin ? OVERRIDE : WILD);
      c.classList.add("sticky");
      c.classList.toggle("ow-origin", origin);
    }
  }
}

function animateReels(key, grid, sticky) {
  const strips = game.reelSets[key];
  const locked = (r, k) => sticky && sticky[r][k];
  for (let r = 0; r < R; r++) for (let k = 0; k < K; k++) if (!locked(r, k)) cells[r][k].classList.add("spinning");
  const stopped = new Array(R).fill(false);
  const t0 = performance.now();
  let lastSwap = 0;
  return new Promise((resolve) => {
    const frame = (now) => {
      const t = now - t0;
      const swap = now - lastSwap > 70;
      if (swap) lastSwap = now;
      let done = true;
      for (let r = 0; r < R; r++) {
        if (stopped[r]) continue;
        if (t >= (420 + r * 140) * speed()) {
          stopped[r] = true;
          for (let k = 0; k < K; k++) {
            if (locked(r, k)) continue;
            const c = cells[r][k];
            c.classList.remove("spinning", "land");
            setSym(c, grid[r][k]);
            void c.offsetWidth;
            c.classList.add("land");
          }
        } else {
          done = false;
          if (swap) {
            const strip = strips[r];
            const off = Math.floor(Math.random() * strip.length); // cosmetic only
            for (let k = 0; k < K; k++) if (!locked(r, k)) setSym(cells[r][k], strip[(off + k) % strip.length]);
          }
        }
      }
      if (done) resolve();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

async function showOverrides(drops, sticky) {
  for (const [r, k] of drops) {
    const c = cells[r][k];
    setSym(c, OVERRIDE);
    c.classList.add("ow-drop");
    tick(`<b>Override Wild</b> on reel ${r + 1}: its whole row and column turn wild.`);
    await sleep(520);
    for (let rr = 0; rr < R; rr++) {
      for (let kk = 0; kk < K; kk++) {
        if ((rr === r) === (kk === k)) continue; // only the cross, not the origin
        if (sticky && sticky[rr][kk]) continue;
        const cell = cells[rr][kk];
        cell.style.setProperty("--d", `${(Math.abs(rr - r) + Math.abs(kk - k)) * 70 * speed()}ms`);
        cell.classList.add("wildcell");
      }
    }
    await sleep(560);
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
  for (const l of lines) for (const [r, k] of l.cells) cells[r][k].classList.add("win");
  tick(linesText(lines, mult, b));
  if (winX >= BIG_WIN) {
    await sleep(800);
    const title = winX >= 250 ? "EPIC WIN" : winX >= 100 ? "MEGA WIN" : "BIG WIN";
    await countBanner(title, round2(winX * b), 2200);
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
  await banner(t.name.toUpperCase(), FEATURE_TEXT[t.key], 2300, t.key === "legendary" ? "gold" : "");
  clearFx();
  if (origins.length) {
    renderSticky(st.sticky, origins);
    tick(`<b>${t.name}</b> starts with a locked Override cross.`);
    await sleep(1100);
  }
  while (!st.done) {
    clearFx(true);
    const res = game.bonusSpin(st);
    hud();
    await animateReels(t.key, res.grid, res.stickyBefore);
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
      renderSticky(st.sticky, origins);
      tick(t.stickyMode === 1 ? "That column is now <b>locked wild</b> for the rest of the bonus." :
        "That cross is now <b>locked wild</b> for the rest of the bonus.");
      await sleep(700);
    }
    if (res.retrig) await banner("+4 FREE SPINS", "3 Capture Cores landed", 1500);
  }
  const total = round2(st.total * b);
  await countBanner(`${t.name} complete`, total, 2400, t.key === "legendary" ? "gold" : "");
  document.body.classList.remove("in-bonus", `tier-${t.key}`);
  ui.hud.hidden = true;
  clearFx();
  return st;
}

async function maxWinBanner(b) {
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
  await animateReels("base", res.grid, null);
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
    for (let r = 0; r < R; r++) for (let k = 0; k < K; k++) if (res.grid[r][k] === CORE) cells[r][k].classList.add("core-hit");
    tick(`<b>${res.cores} Capture Cores!</b>`);
    await sleep(1500);
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
    `<tr><td><span class="pt-sym">${svgFor(sym.code)}${sym.name}</span></td>` +
    data.paytable[sym.code].map((p) => `<td>${fmt(p * b)}</td>`).join("") + "</tr>").join("");
  const stat = (v, label) => `<div class="stat"><b>${v}</b><span>${label}</span></div>`;
  ui.infoBody.innerHTML = `
    <h2>Glitch Tamers</h2>
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
for (let r = 0; r < R; r++) for (let k = 0; k < K; k++) setSym(cells[r][k], first[r][k]);
render();

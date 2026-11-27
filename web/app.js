// Bootleg Beasts: browser UI. Every outcome comes from engine.js, which uses the same reel strips,
// weights and rules as the verified Python model (game-data.json).
import { Game, CORE, REACTOR } from "./engine.js?v=14";
import { symbolHTML } from "./symbols.js?v=14";
import { Fx, shake, impact } from "./fx.js?v=14";
import { startBackground } from "./background.js?v=14";
import { sfx, music, isMuted, setMuted, audioPrefs, setAudioPrefs } from "./sfx.js?v=14";
import { splash, buyMenu, autoplayMenu, settingsMenu, historyMenu, realityCheck } from "./panels.js?v=14";
import { intro, levelUp, outro } from "./screens.js?v=14";

try {
  startBackground(document.getElementById("bg"));
} catch (err) {
  console.warn("background disabled:", err); // decoration only: never block the game
}

const data = await (await fetch("game-data.json", { cache: "no-cache" })).json();
const game = new Game(data);
const CODES = data.symbols.map((s) => s.code);
const NAMES = data.symbols.map((s) => s.name);
const R = data.reels;
const K = data.rows;
const BETS = [0.2, 0.5, 1, 2, 5, 10, 20];
const START_BALANCE = 1000;
const REFILL = 10000;
const BIG_WIN = 25; // x bet
const ICON = {
  auto: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/><path class="fill" d="M10 9.5v5l4-2.5z"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24"><path class="fill" d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24"><path class="fill" d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>',
};

// ---- State & helpers -----------------------------------------------------------
const $ = (id) => document.getElementById(id);
const ui = {
  grid: $("grid"), wrap: document.querySelector(".grid-wrap"), ovl: $("ovl"), banner: $("banner"),
  bannerTitle: $("bannerTitle"), bannerSub: $("bannerSub"), winTag: $("winTag"), ticker: $("ticker"),
  boardWin: $("boardWin"), winLabel: $("winLabel"), lvlRibbon: $("lvlRibbon"), hudRule: $("hudRule"),
  hudCaught: $("hudCaught"), coreSlots: $("coreSlots"), spinsCard: $("spinsCard"), multCard: $("multCard"),
  miniLadder: $("miniLadder"), trigCores: $("trigCores"),
  balance: $("balance"), win: $("win"), bet: $("bet"), spin: $("spinBtn"), betUp: $("betUp"),
  betDown: $("betDown"), turbo: $("turbo"), autoBtn: $("autoBtn"), buyBtn: $("buyBtn"), huntBtn: $("huntBtn"),
  spinStake: $("spinStake"), clock: $("clock"), sessTime: $("sessTime"), sessNet: $("sessNet"),
  historyBtn: $("historyBtn"), settingsBtn: $("settingsBtn"), rtpBadge: $("rtpBadge"), refill: $("refill"),
  hudLevel: $("hudLevel"), hudSpins: $("hudSpins"), hudMult: $("hudMult"), info: $("info"),
  infoBody: $("infoBody"), infoBtn: $("infoBtn"), mute: $("muteBtn"), sSpins: $("sSpins"),
  sBet: $("sBet"), sWon: $("sWon"), sRtp: $("sRtp"), repoLink: $("repoLink"),
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
  hunt: store.get("hunt", false), // Bonus Hunt ante mode
  auto: null, // autoplay: { left, lossLimit, winLimit, stopOnBonus, startNet }
  history: [],
  start: Date.now(),
  lastReality: Date.now(),
  prefs: { splash: true, realityMins: 30, ...store.get("prefs", {}) },
};
const autoOn = () => !!S.auto;
const round2 = (x) => Math.round(x * 100) / 100;
const fmt = (x) => x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bet = () => BETS[S.betIdx];
/** What one spin costs: the bet, or the bet x the ante price in Bonus Hunt. */
const stake = () => round2(bet() * (S.hunt ? data.ante.price : 1));
const signed = (x) => `${x >= 0 ? "+" : "−"}${fmt(Math.abs(x))}`;
const speed = () => (ui.turbo.checked ? 0.35 : 1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * speed()));
const bump = (el) => {
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
};

// ---- Reels & overlay -----------------------------------------------------------------
// Each reel is a window onto a strip of cells that scrolls during a spin. The overlay grid above
// the reels holds everything that must not scroll: Net Wilds, the base-game net cross and win
// frames. Bonus nets sit inside their reel, over the scrolling strip.
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

function paintCell(c, sym) {
  c.dataset.sym = CODES[sym];
  c.setAttribute("aria-label", NAMES[sym]);
  c.innerHTML = symbolHTML(CODES[sym]);
}

function makeCell(sym) {
  const c = document.createElement("div");
  c.className = "cell";
  c.setAttribute("role", "img");
  paintCell(c, sym);
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

function clearFx() {
  ui.grid.classList.remove("has-win");
  ui.winTag.hidden = true;
  hideBoardWin();
  for (const col of cells) for (const c of col) c.classList.remove("win", "land", "focus", "caught");
  for (const col of ocells) {
    for (const o of col) {
      o.classList.remove("win", "wildcell", "ow-drop", "core-hit", "captured", "reactor-hit", "focus", "wm-on");
      o.style.removeProperty("--d");
      o.replaceChildren();
    }
  }
}

/** Spin all reels to `grid`. Reels stop left to right; in the base game, once two Capture Cores are
 *  showing, each remaining reel slows down and glows (the bonus tease). Bonus nets stay put over
 *  their reels while the symbols spin behind them. */
async function spinReels(key, grid, stops, bonus = false) {
  sfx.spin();
  const pitch = cellPitch();
  const base = 560 * speed();
  const stagger = 170 * speed();
  const tease = 1150 * speed();
  let prev = 0;
  let cores = 0;
  const jobs = [];
  for (let r = 0; r < R; r++) {
    const teasing = !bonus && cores >= 2;
    const hot = teasing && cores >= 3; // already a bonus: chasing a higher start level
    const stopAt = teasing ? prev + tease * (hot ? 1.45 : 1) : Math.max(base + r * stagger, prev + stagger);
    jobs.push(spinReel(r, key, grid[r], stops[r], { stopAt, teasing, hot, teaseFrom: prev }, pitch));
    prev = stopAt;
    for (let k = 0; k < K; k++) if (grid[r][k] === CORE) cores++;
  }
  await Promise.all(jobs);
}

function spinReel(r, key, col, stop, plan, pitch) {
  const { el, strip } = reels[r];
  if (reduceMotion) {
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
  if (plan.teasing) {
    setTimeout(() => {
      el.classList.add("tease");
      el.classList.toggle("hot", !!plan.hot);
      ui.wrap.classList.toggle("suspense", !!plan.hot);
      sfx.tease();
      if (plan.hot) sfx.tease();
    }, plan.teaseFrom);
  }
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
    el.classList.remove("tease", "hot");
    ui.wrap.classList.remove("suspense");
    sfx.reelStop(r);
    for (let k = 0; k < K; k++) {
      finals[k].classList.add("land");
      if (col[k] === CORE || col[k] === REACTOR) {
        if (col[k] === CORE) sfx.core();
        const [x, y] = fx.at(ocells[r][k]);
        const colors = ["#ffc531", "#fff1a8", "#ff8a3d"];
        fx.burst(x, y, { n: 18, colors, speed: 3.5, size: 3, life: 35 });
      }
    }
  });
}

/** Every Static on screen glitches, then flips to the revealed symbol. */
async function showReveal(reveal) {
  if (!reveal.cells.length) return;
  sfx.reveal();
  for (const [r, k] of reveal.cells) cells[r][k].classList.add("glitching");
  await sleep(380);
  for (const [r, k] of reveal.cells) {
    const c = cells[r][k];
    c.classList.remove("glitching");
    paintCell(c, reveal.sym);
    c.classList.remove("land");
    void c.offsetWidth;
    c.classList.add("land");
    const [x, y] = fx.at(ocells[r][k]);
    fx.burst(x, y, { n: 10, colors: ["#ffb347", "#fff3d6", "#fff"], speed: 3, size: 3, life: 30 });
  }
  tick(`<b>Static revealed ${NAMES[reveal.sym]}!</b> (${reveal.cells.length} symbol${reveal.cells.length > 1 ? "s" : ""})`);
  await sleep(450);
}

/** Base game: a Net Wild lands and nets its whole row and column. */
async function showDrops(drops) {
  for (const [r, k] of drops) {
    const o = ocells[r][k];
    o.innerHTML = symbolHTML("OW");
    o.classList.add("ow-drop");
    tick(`<b>Net Wild!</b> Its whole row and column turn wild.`);
    await sleep(280);
    sfx.override();
    const [x, y] = fx.at(o);
    fx.burst(x, y, { n: 50, speed: 7.5, size: 5, life: 50 });
    shake(ui.wrap, 9, 420);
    fx.beam(o, ui.grid, true);
    fx.beam(o, ui.grid, false);
    for (let rr = 0; rr < R; rr++) {
      for (let kk = 0; kk < K; kk++) {
        if ((rr !== r && kk !== k) || (rr === r && kk === k)) continue;
        const cell = ocells[rr][kk];
        cell.style.setProperty("--d", `${(Math.abs(rr - r) + Math.abs(kk - k)) * 55 * speed()}ms`);
        cell.classList.add("wildcell");
      }
    }
    await sleep(600);
  }
}

function pop(text, x, y, cls = "") {
  const el = document.createElement("div");
  el.className = `cap-pop ${cls}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  ui.wrap.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function coreHit(grid) {
  for (let r = 0; r < R; r++) {
    for (let k = 0; k < K; k++) {
      if (grid[r][k] !== CORE) continue;
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

function lineText(l, mult, b) {
  const ways = `${l.ways.toLocaleString()} way${l.ways > 1 ? "s" : ""}`;
  const m = mult > 1 ? ` × ${mult}` : "";
  return `<b>${NAMES[l.sym]}</b> ${l.length} of a kind · ${ways}${m} = <span class="amt">${fmt(l.win * mult * b)}</span>`;
}

async function banner(title, sub, ms, cls = "") {
  ui.bannerTitle.textContent = title;
  ui.bannerSub.innerHTML = sub || "";
  ui.banner.className = `banner ${cls}`;
  ui.banner.hidden = false;
  await sleep(ms);
  ui.banner.hidden = true;
}

async function countBanner(title, amount, ms, cls = "", note = "") {
  ui.bannerTitle.textContent = title;
  ui.banner.querySelector(".banner-eq")?.remove();
  if (note) ui.banner.insertAdjacentHTML("beforeend", `<div class="banner-eq">${note}</div>`);
  ui.banner.className = `banner ${cls}`;
  ui.banner.hidden = false;
  const dur = ms * 0.6 * speed();
  const t0 = performance.now();
  let lastCoin = 0;
  await new Promise((res) => {
    const f = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      ui.bannerSub.textContent = fmt(amount * (1 - (1 - p) ** 3));
      if (now - lastCoin > 70 && p < 1) {
        sfx.coin();
        lastCoin = now;
      }
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
  ui.spinStake.textContent = S.hunt ? `${fmt(stake())} · Hunt` : fmt(stake());
  ui.huntBtn.setAttribute("aria-pressed", String(S.hunt));
  ui.huntBtn.classList.toggle("on", S.hunt);
  document.body.classList.toggle("hunt-on", S.hunt);
  ui.huntBtn.disabled = S.busy;
  ui.buyBtn.disabled = S.busy;
  ui.autoBtn.innerHTML = S.auto ? `<b>${S.auto.left}</b>` : ICON.auto;
  ui.autoBtn.setAttribute("aria-label", S.auto ? `Stop autoplay (${S.auto.left} left)` : "Autoplay");
  ui.autoBtn.classList.toggle("on", !!S.auto);
  ui.spin.classList.toggle("hunt", S.hunt);
  ui.spin.classList.toggle("busy", S.busy);
  ui.autoBtn.disabled = S.busy && !S.auto;
  ui.sessNet.textContent = signed(round2(S.won - S.wagered));
  ui.sSpins.textContent = S.spins.toLocaleString();
  ui.sBet.textContent = fmt(S.wagered);
  ui.sWon.textContent = fmt(S.won);
  ui.sRtp.textContent = S.wagered ? `${((100 * S.won) / S.wagered).toFixed(1)}%` : "–";
  const canSpin = S.balance >= stake() - 1e-9;
  ui.refill.disabled = S.busy;
  ui.refill.classList.toggle("urgent", !canSpin && !S.busy);
  ui.spin.disabled = S.busy || !canSpin;
  ui.betUp.disabled = S.busy || S.betIdx >= BETS.length - 1;
  ui.betDown.disabled = S.busy || S.betIdx <= 0;
  store.set("balance", S.balance);
  store.set("betIdx", S.betIdx);
}

/** Show every winning cell, then (if there's more than one win) walk through each win in turn. */
async function showWins(lines, mult, winX, b, price = 1) {
  ui.grid.classList.add("has-win");
  const hit = new Set();
  for (const l of lines) {
    for (const [r, k] of l.cells) {
      cells[r][k].classList.add("win");
      ocells[r][k].classList.add("win");
      hit.add(r * K + k);
    }
  }
  if (winX > price) sfx.win(winX / price); // a return at or below the stake is not celebrated
  const per = Math.max(2, Math.min(9, Math.round(150 / hit.size)));
  for (const id of hit) {
    const [x, y] = fx.at(ocells[Math.floor(id / K)][id % K]);
    fx.burst(x, y, { n: per, colors: ["#ffd21f", "#fff3d6", "#ff8a3d"], speed: 3.2, size: 3, life: 38, gravity: 0.1 });
  }
  tick(lines.slice(0, 2).map((l) => lineText(l, mult, b)).join(" &nbsp;|&nbsp; ") +
    (lines.length > 2 ? ` &nbsp;+${lines.length - 2} more` : ""));
  if (winX < BIG_WIN) {
    await boardWin(round2((winX / mult) * b), mult, round2(winX * b));
    await sleep(350);
  } else await sleep(650);
  if (lines.length > 1 && !autoOn() && winX >= BIG_WIN) {
    for (const l of lines.slice(0, 4)) {
      const on = new Set(l.cells.map(([r, k]) => r * K + k));
      for (let r = 0; r < R; r++) {
        for (let k = 0; k < K; k++) {
          const yes = on.has(r * K + k);
          cells[r][k].classList.toggle("win", yes);
          ocells[r][k].classList.toggle("win", yes);
        }
      }
      const [r0, k0] = l.cells[0];
      const [x, y] = fx.at(ocells[r0][k0]);
      ui.winTag.innerHTML = `${NAMES[l.sym]} ×${l.length} <span>${fmt(l.win * mult * b)}</span>`;
      ui.winTag.style.left = `${x}px`;
      ui.winTag.style.top = `${y}px`;
      ui.winTag.hidden = false;
      tick(lineText(l, mult, b));
      sfx.coin();
      await sleep(620);
    }
    ui.winTag.hidden = true;
  }
  if (winX >= BIG_WIN) {
    shake(ui.wrap, winX >= 100 ? 12 : 8, 500);
    fx.fountain(winX >= 250 ? 220 : winX >= 100 ? 150 : 90);
    sfx.bigWin();
    const title = winX >= 1000 ? "LEGENDARY WIN" : winX >= 250 ? "EPIC WIN" : winX >= 100 ? "MEGA WIN" : "BIG WIN";
    const note = mult > 1 ? `${fmt(round2((winX / mult) * b))} × <b>${mult.toLocaleString()}</b> Catch Multiplier` : "";
    await countBanner(title, round2(winX * b), 2400, winX >= 100 ? "gold" : "", note);
  } else {
    await sleep(300);
  }
}

// ---- Bonus side panels -----------------------------------------------------------------
const LOCK_SVG = '<svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3h1.5v11h-13V10zm2.5 0h5V7a2.5 2.5 0 0 0-5 0z"/></svg>';

/** One-line rule for a level, from the level data. */
function ruleShort(i) {
  const lv = data.levels[i];
  const hold = lv.hold >= data.holdForever ? "nets lock for good"
    : lv.hold ? `nets hold +${lv.hold} spin${lv.hold > 1 ? "s" : ""}` : "nets last 1 spin";
  return `${lv.doubles ? "×2 on arrival · " : ""}+${lv.catch}× per catch · ${hold}`;
}

function renderLadder(level) {
  ui.miniLadder.innerHTML = data.levels.map((lv, i) =>
    `<li class="${i < level ? "done" : i === level ? "cur" : ""}"><b>${i + 1}</b><span>${lv.name}</span><small>${ruleShort(i)}</small></li>`).join("");
}

function hudLevel(level, pop = false) {
  ui.hudLevel.textContent = data.levels[level].name;
  ui.hudRule.textContent = ruleShort(level);
  document.body.dataset.level = String(level);
  renderLadder(level);
  if (pop) {
    ui.lvlRibbon.classList.remove("pop");
    void ui.lvlRibbon.offsetWidth;
    ui.lvlRibbon.classList.add("pop");
  }
}

function setSpins(n, cls = "bump") {
  if (ui.hudSpins.textContent === String(n) && cls === "bump") return;
  ui.hudSpins.textContent = n;
  ui.hudSpins.classList.remove("bump", "plus");
  void ui.hudSpins.offsetWidth;
  ui.hudSpins.classList.add(cls);
}

function setMult(m, cls = "bump") {
  ui.hudMult.textContent = `×${m.toLocaleString()}`;
  ui.hudMult.classList.remove("bump", "slam");
  void ui.hudMult.offsetWidth;
  ui.hudMult.classList.add(cls);
}

function setCoreSlots(n) {
  const top = n < 0;
  [...ui.coreSlots.children].forEach((slot, i) => {
    const on = top || i < n;
    if (on && !slot.classList.contains("on")) slot.innerHTML = symbolHTML("R");
    if (!on) slot.replaceChildren();
    slot.classList.toggle("on", on);
  });
  ui.spinsCard.classList.toggle("charged", n === data.reactorsPerLevel - 1);
}

/** A ghost of a symbol flies from a cell to a target element along an arc, leaving a trail. */
function fly(fromEl, toEl, code, cls = "", ms = 620) {
  const from = fromEl.getBoundingClientRect();
  const to = toEl.getBoundingClientRect();
  const ghost = document.createElement("div");
  ghost.className = `fly ${cls}`;
  ghost.innerHTML = symbolHTML(code);
  Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
  document.body.appendChild(ghost);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const anim = ghost.animate([
    { transform: "translate(0, 0) scale(1) rotate(0deg)" },
    { transform: `translate(${dx * 0.3}px, ${dy * 0.3 - 90}px) scale(1.15) rotate(-25deg)`, offset: 0.35 },
    { transform: `translate(${dx}px, ${dy}px) scale(.18) rotate(160deg)` },
  ], { duration: (reduceMotion ? 120 : ms) * speed(), easing: "cubic-bezier(.45,0,.8,.45)", fill: "forwards" });
  const trail = setInterval(() => {
    const g = ghost.getBoundingClientRect();
    const d = document.createElement("i");
    d.className = "fly-trail";
    d.style.left = `${g.left + g.width / 2}px`;
    d.style.top = `${g.top + g.height / 2}px`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 520);
  }, 24);
  return anim.finished.then(() => {
    clearInterval(trail);
    ghost.remove();
  });
}

/** Pop text over the multiplier card. */
function cardPop(text) {
  const el = document.createElement("div");
  el.className = "cap-pop";
  el.textContent = text;
  ui.multCard.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

// ---- Nets ------------------------------------------------------------------------------
/** Show reel r's net with `t` spins of hold left after this one (0 = none). */
function setNet(r, t, { drop = false, row = 0 } = {}) {
  const reel = reels[r].el;
  let n = reel.querySelector(".net:not(.leaving)");
  if (t <= 0 && !drop) {
    if (n) {
      n.classList.add("leaving");
      setTimeout(() => n.remove(), 420 * speed());
    }
    reel.classList.remove("netted");
    return;
  }
  if (!n) {
    n = document.createElement("div");
    n.className = "net";
    n.innerHTML = '<span class="hold"></span>';
    reel.appendChild(n);
  }
  if (drop) {
    n.style.setProperty("--from", `${row * 20}%`);
    n.classList.remove("drop");
    void n.offsetWidth;
    n.classList.add("drop");
  }
  const forever = t >= data.holdForever;
  n.classList.toggle("forever", forever);
  const h = n.querySelector(".hold");
  const label = forever ? LOCK_SVG : String(t);
  if (h.innerHTML !== label) {
    h.innerHTML = label;
    h.classList.remove("tick");
    void h.offsetWidth;
    h.classList.add("tick");
  }
  h.hidden = !forever && t <= 0;
  reel.classList.add("netted");
}

function clearNets() {
  for (const { el } of reels) {
    el.querySelectorAll(".net").forEach((n) => n.remove());
    el.classList.remove("netted");
  }
}

/** A Net Wild slams onto its cell and the net unrolls over the whole reel; then every beast on
 *  that reel is caught and flies into the Catch Multiplier. */
async function showNet([r, k], hold, captures, catchIndex) {
  const o = ocells[r][k];
  o.innerHTML = symbolHTML("OW");
  o.classList.add("ow-drop");
  tick(`<b>Net Wild</b> on reel ${r + 1}: the whole reel turns wild.`);
  await sleep(300);
  sfx.override();
  const [x, y] = fx.at(o);
  fx.burst(x, y, { n: 46, speed: 7.5, size: 5, life: 50 });
  shake(ui.wrap, 8, 380);
  setNet(r, hold, { drop: true, row: k });
  await sleep(380);
  o.classList.remove("ow-drop");
  o.replaceChildren();
  for (const c of captures) {
    const cell = cells[c.r][c.k];
    cell.classList.remove("caught");
    void cell.offsetWidth;
    cell.classList.add("caught");
    sfx.capture(Math.min(catchIndex.n, 12));
    const [cx, cy] = fx.at(ocells[c.r][c.k]);
    fx.burst(cx, cy, { n: 16, colors: ["#fff", "#ffd21f", "#ff3b3b"], speed: 4, size: 4, life: 32 });
    catchIndex.n++;
    const flight = fly(ocells[c.r][c.k], ui.hudMult, CODES[c.sym], "beast", 560).then(() => {
      setMult(c.mult);
      cardPop(`+${c.value}×`);
      ui.multCard.classList.remove("hit");
      void ui.multCard.offsetWidth;
      ui.multCard.classList.add("hit");
      ui.hudCaught.textContent = String(Number(ui.hudCaught.textContent) + 1);
    });
    await sleep(170);
    if (c === captures[captures.length - 1]) await flight;
  }
  if (captures.length) {
    tick(`<b>Caught ${captures.length} beast${captures.length > 1 ? "s" : ""}!</b> Catch Multiplier <b>×${captures[captures.length - 1].mult}</b>`);
    await sleep(200);
  }
}

/** Overload: the multiplier doubles and every net on screen locks for good. */
async function showDouble(mult, timers) {
  sfx.bigWin();
  shake(ui.wrap, 12, 600);
  ui.hudMult.textContent = "×2";
  ui.hudMult.classList.remove("bump", "slam");
  void ui.hudMult.offsetWidth;
  ui.hudMult.classList.add("slam");
  await sleep(700);
  setMult(mult, "slam");
  const [x, y] = fx.at(ui.wrap);
  fx.burst(x, y * 0.4, { n: 90, speed: 9, size: 6, life: 70 });
  timers.forEach((t, r) => t > 0 && setNet(r, t));
  tick(`<b>OVERLOAD!</b> Catch Multiplier doubled to <b>×${mult}</b>${timers.some((t) => t > 0) ? " and every net locks for good" : ""}.`);
  await sleep(900);
}

// ---- Board win counter -----------------------------------------------------------------
/** The win counts up in the middle of the board; in the bonus it shows ways win × multiplier. */
async function boardWin(baseAmount, mult, amount) {
  const el = ui.boardWin;
  el.innerHTML = (mult > 1 ? `<span class="bw-eq">${fmt(baseAmount)} <em>× ${mult.toLocaleString()}</em></span>` : "") +
    `<span class="bw-amt">${fmt(mult > 1 ? baseAmount : 0)}</span>`;
  el.classList.remove("out");
  el.hidden = false;
  const amt = el.querySelector(".bw-amt");
  if (mult > 1) {
    await sleep(380);
    el.querySelector("em").classList.add("slam");
    sfx.capture(6);
  }
  const from = mult > 1 ? baseAmount : 0;
  const dur = Math.min(1200, 380 + Math.sqrt(amount / bet()) * 90) * speed();
  const t0 = performance.now();
  let lastCoin = 0;
  await new Promise((res) => {
    const f = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      amt.textContent = fmt(from + (amount - from) * (1 - (1 - p) ** 3));
      if (now - lastCoin > 80 && p < 1) {
        sfx.coin();
        lastCoin = now;
      }
      if (p < 1) requestAnimationFrame(f);
      else res();
    };
    requestAnimationFrame(f);
  });
}

function hideBoardWin() {
  if (ui.boardWin.hidden) return;
  ui.boardWin.classList.add("out");
  setTimeout(() => {
    ui.boardWin.hidden = true;
    ui.boardWin.classList.remove("out");
  }, 250 * speed());
}

// ---- Game flow -------------------------------------------------------------------
async function runBonus(startLevel, cap) {
  const st = game.startBonus(startLevel, cap);
  const b = bet();
  let meterShown = 0;
  document.body.classList.add("in-bonus");
  hudLevel(startLevel);
  setSpins(st.spinsLeft);
  setMult(1);
  ui.hudCaught.textContent = "0";
  setCoreSlots(0);
  clearNets();
  ui.winLabel.textContent = "Bonus win";
  setWin(0);
  sfx.bonus();
  await impact(600);
  music.start(startLevel);
  await intro({ levels: data.levels, level: startLevel, spins: data.freeSpins, perLevel: data.reactorsPerLevel,
    levelUpSpins: data.levelUpSpins, rules: data.levels.map((_, i) => ruleShort(i)), speed: speed(), auto: autoOn() });
  clearFx();
  while (!st.done) {
    clearFx();
    hideBoardWin();
    const res = game.bonusSpin(st);
    setSpins(st.spinsLeft - res.levelUps * data.levelUpSpins);
    await spinReels("bonus", res.landed, res.stops, true);

    // Capture Cores fly into the meter
    const top = res.levelBefore >= data.levels.length - 1;
    const before = meterShown;
    await Promise.all(res.reactorCells.map(async ([r, k], i) => {
      ocells[r][k].classList.add("reactor-hit");
      await sleep(i * 170);
      sfx.reactor(i);
      if (top) return;
      const slot = ui.coreSlots.children[Math.min(before + i, data.reactorsPerLevel - 1)];
      await fly(ocells[r][k], slot, "R");
      meterShown++;
      setCoreSlots(Math.min(meterShown, data.reactorsPerLevel));
    }));
    if (res.reactorCells.length) await sleep(160);
    await showReveal(res.reveal);

    // Nets and catches
    const lv = data.levels[res.levelBefore];
    const catchIndex = { n: 0 };
    for (const d of res.drops) {
      const hold = lv.hold >= data.holdForever ? data.holdForever : lv.hold;
      await showNet(d, hold, res.captures.filter((c) => c.r === d[0]), catchIndex);
    }

    if (res.spinWin > 0) await showWins(res.lines, res.spinMult, res.spinWin, b, 1);
    else {
      tick(`Free spin ${st.played}: no win.`);
      await sleep(380);
    }
    setWin(round2(st.total * b)); // only after the win is shown

    // Holds count down; expired nets leave
    res.timerDecayed.forEach((t, r) => setNet(r, t));
    // Level-ups
    if (res.levelUps) hideBoardWin();
    for (let u = 0; u < res.levelUps; u++) {
      const lvl = res.levelBefore + u + 1;
      meterShown = Math.max(0, meterShown - data.reactorsPerLevel);
      setCoreSlots(meterShown);
      sfx.levelUp();
      await impact(500);
      hudLevel(lvl, true);
      music.setLevel(lvl);
      setSpins(st.spinsLeft - (res.levelUps - u - 1) * data.levelUpSpins, "plus");
      await levelUp({ levels: data.levels, level: lvl, levelUpSpins: data.levelUpSpins, rules: data.levels.map((_, i) => ruleShort(i)),
        speed: speed(), auto: autoOn() });
      if (data.levels[lvl].doubles) await showDouble(st.mult, res.timerAfter);
    }
    if (st.level >= data.levels.length - 1) setCoreSlots(-1);
    setSpins(st.spinsLeft);
  }
  hideBoardWin();
  if (st.floored) {
    tick(`Guaranteed minimum win: bonus topped up to <b>${fmt(round2(st.total * b))}</b>.`);
    setWin(round2(st.total * b));
    await sleep(900);
  }
  music.stop();
  await outro({ levels: data.levels, level: st.level, totalX: st.total, bet: b, floored: st.floored, fmt, sfx,
    mult: st.mult, caught: st.caught, speed: speed(), auto: autoOn() });
  music.start(-1);
  document.body.classList.remove("in-bonus");
  delete document.body.dataset.level;
  ui.winLabel.textContent = "Win";
  clearNets();
  clearFx();
  return st;
}

async function maxWinBanner(b) {
  shake(ui.wrap, 14, 700);
  fx.fountain(300);
  sfx.bigWin();
  await banner("MAX WIN", `${fmt(round2(data.maxWin * b))} · ${data.maxWin.toLocaleString()}× bet`, 3000, "gold");
}

/** Base-game Tag Wilds show their multipliers one by one. */
async function showWildMults(list) {
  for (const [i, [r, k, m]] of list.entries()) {
    const o = ocells[r][k];
    const tag = document.createElement("span");
    tag.className = `wm wm-${m}`;
    tag.textContent = `×${m}`;
    o.appendChild(tag);
    o.classList.add("wm-on");
    sfx.capture(i + (m === 5 ? 5 : m === 3 ? 2 : 0));
    const [x, y] = fx.at(o);
    fx.burst(x, y, { n: 8 + m * 4, colors: m === 5 ? ["#ffc531", "#fff1a8", "#fff"] : ["#ff3b3b", "#ffd21f", "#fff"], speed: 3, size: 3, life: 30 });
    await sleep(240);
  }
  if (list.length > 1) {
    const prod = list.reduce((acc, [, , m]) => acc * m, 1);
    tick(`Wild multipliers ${list.map(([, , m]) => `×${m}`).join(" ")}: up to <b>×${prod}</b> on a win through all of them.`);
  }
  await sleep(200);
}

function logRound(r) {
  S.history.push({ t: Date.now(), ...r });
  if (S.history.length > 100) S.history.shift();
}

function stopAuto(reason) {
  if (!S.auto) return;
  S.auto = null;
  if (reason) tick(`Autoplay stopped: ${reason}.`);
  render();
}

function continueAuto(winAmount) {
  if (!S.auto) return;
  const a = S.auto;
  a.left--;
  const loss = a.startNet - (S.won - S.wagered);
  if (a.left <= 0) return stopAuto("all spins played");
  if (a.lossLimit && loss >= a.lossLimit - 1e-9) return stopAuto("loss limit reached");
  if (a.winLimit && winAmount >= a.winLimit - 1e-9) return stopAuto("single-win limit reached");
  if (S.balance < stake() - 1e-9) return stopAuto("not enough credits");
  render();
  setTimeout(() => S.auto && spin(), 380 * speed());
}

function spin() {
  return S.hunt
    ? playRound({ mode: data.ante.reelSet, price: data.ante.price, label: data.ante.name })
    : playRound({ mode: "base", price: 1, label: "Spin" });
}

/** One paid base-game round: a normal spin, a Bonus Hunt spin, or an Override Spin. */
async function playRound({ mode, price, forceOverride = false, label }) {
  if (S.busy) return;
  const b = bet();
  const cost = round2(price * b);
  if (S.balance < cost - 1e-9) {
    stopAuto("not enough credits");
    render();
    return;
  }
  S.busy = true;
  S.balance = round2(S.balance - cost);
  S.spins++;
  S.wagered = round2(S.wagered + cost);
  setWin(0);
  render();
  clearFx();

  const res = game.baseSpin({ mode, forceOverride });
  await spinReels(mode, res.landed, res.stops);
  await showReveal(res.reveal);
  if (res.drops.length) await showDrops(res.drops);
  if (res.wildMults.length) await showWildMults(res.wildMults);
  let totalX = res.win;
  let note = forceOverride ? label : "";
  if (res.win > 0) {
    await showWins(res.lines, 1, res.win, b, price);
    credit(round2(res.win * b));
    setWin(round2(res.win * b));
    render();
  } else if (res.startLevel < 0) {
    tick(res.cores ? `${res.cores} Capture Core${res.cores > 1 ? "s" : ""}. Land 3 for the bonus.` : "No win.");
  }
  if (res.startLevel >= 0) {
    if (S.auto && S.auto.stopOnBonus) stopAuto("bonus triggered");
    coreHit(res.landed);
    sfx.core();
    tick(`<b>${res.cores} Capture Cores!</b> Bonus starts on level ${res.startLevel + 1}.`);
    await sleep(1400);
    const st = await runBonus(res.startLevel, data.maxWin - res.win);
    totalX += st.total;
    credit(round2(st.total * b));
    note = `${res.cores} Cores · reached ${data.levels[st.level].name}`;
  }
  if (totalX >= data.maxWin - 1e-9) await maxWinBanner(b);
  const amount = round2(totalX * b);
  setWin(amount);
  logRound({ mode: label, stake: cost, win: amount, note });
  S.busy = false;
  render();
  continueAuto(amount);
}

function featureSpin() {
  return playRound({ mode: "base", price: data.featureSpin.price, forceOverride: true, label: data.featureSpin.name });
}

async function openBuyMenu() {
  if (S.busy) return;
  stopAuto();
  const s = data.stats || {};
  const items = [
    { key: data.featureSpin.key, name: data.featureSpin.name, price: data.featureSpin.price, icon: "OW", vol: 2,
      text: "One base spin with a guaranteed Net Wild: its whole row and column turn wild.", rtp: s.featureSpin?.rtp },
    ...data.buys.map((bb) => ({
      key: bb.key, name: bb.name, price: bb.price, icon: "S", level: bb.startLevel, vol: 3 + bb.startLevel,
      text: `${data.freeSpins} free spins on level ${bb.startLevel + 1}: ${ruleShort(bb.startLevel)}.`,
      rtp: s.buyRtp?.[bb.key], min: data.minBonusWin[bb.startLevel],
    })),
  ];
  const key = await buyMenu({ items, bet: bet(), balance: S.balance, fmt });
  if (!key) return;
  if (key === data.featureSpin.key) return featureSpin();
  return buyBonus(data.buys.findIndex((bb) => bb.key === key));
}

async function buyBonus(i) {
  const buy = data.buys[i];
  const b = bet();
  const cost = round2(buy.price * b);
  if (S.busy || S.balance < cost - 1e-9) return;
  sfx.click();
  stopAuto();
  S.busy = true;
  S.balance = round2(S.balance - cost);
  S.wagered = round2(S.wagered + cost);
  setWin(0);
  render();
  clearFx();
  tick(`Bought the <b>${buy.name}</b> for ${fmt(cost)}.`);
  await buySpin(Number(Object.keys(data.startLevel).find((c) => data.startLevel[c] === buy.startLevel)));
  const st = await runBonus(buy.startLevel, data.maxWin);
  const amount = round2(st.total * b);
  credit(amount);
  if (st.capped) await maxWinBanner(b);
  setWin(amount);
  tick(`<b>${buy.name}</b> paid <span class="amt">${fmt(amount)}</span> (${(st.total / buy.price).toFixed(2)}× the price).`);
  logRound({ mode: `Buy ${buy.name}`, stake: cost, win: amount, note: `reached ${data.levels[st.level].name}` });
  S.busy = false;
  render();
}

/** Cosmetic trigger spin for a bonus buy: the reels land exactly `n` Capture Cores on random reels
 *  (with the usual tease), so a buy plays out like a natural trigger. It pays nothing, and the bonus
 *  itself is drawn separately, exactly as the verified model plays a buy. */
async function buySpin(n) {
  const strips = game.reelSets.base;
  const order = [...Array(R).keys()].sort(() => Math.random() - 0.5);
  const withCore = new Set(order.slice(0, n));
  const stops = [];
  const grid = [];
  for (let r = 0; r < R; r++) {
    const s = strips[r];
    const L = s.length;
    const window = (st) => Array.from({ length: K }, (_, k) => s[(st + k) % L]);
    let stop;
    if (withCore.has(r)) stop = (s.indexOf(CORE) - Math.floor(Math.random() * K) + L) % L;
    else do stop = Math.floor(Math.random() * L); while (window(stop).includes(CORE));
    stops.push(stop);
    grid.push(window(stop));
  }
  const landed = grid.map((c) => c.slice());
  const reveal = game.revealStatic(grid, null, "base");
  await spinReels("base", landed, stops);
  await showReveal(reveal);
  coreHit(grid);
  sfx.core();
  tick(`<b>${n} Capture Cores!</b>`);
  await sleep(1300);
}

// ---- Info dialog -----------------------------------------------------------------
function pct(x, d = 2) {
  return `${(100 * x).toFixed(d)}%`;
}

function buildInfo() {
  const b = bet();
  const s = data.stats || {};
  const rows = data.symbols.slice(0, 9).map((sym) =>
    `<tr><td><span class="pt-sym" data-sym="${sym.code}">${symbolHTML(sym.code)}${sym.name}</span></td>` +
    data.paytable[sym.code].map((p) => `<td>${fmt(p * b)}</td>`).join("") + "</tr>").join("");
  const stat = (v, label) => `<div class="stat"><b>${v}</b><span>${label}</span></div>`;
  const lv = data.levels;
  ui.infoBody.innerHTML = `
    <h2>Bootleg Beasts</h2>
    <p>5 reels × 5 rows, <b>3,125 ways</b>. Wins pay left to right for 3 or more matching symbols on
    adjacent reels, starting from reel 1. Each win is the pay per way × the number of ways.</p>
    <h3>Verified math</h3>
    <div class="stat-grid">
      ${stat(s.rtp ? pct(s.rtp, 2) : "96.00%", `RTP (± ${s.rtpCi95 ? pct(s.rtpCi95, 2) : "–"})`)}
      ${stat(s.hitRate ? pct(s.hitRate, 1) : "–", "Hit frequency")}
      ${stat(`${data.maxWin.toLocaleString()}×`, s.maxWinOdds ? `Max win · 1 in ${Math.round(s.maxWinOdds).toLocaleString()} spins` : "Max win")}
      ${stat(s.triggerOdds ? `1 in ${Math.round(s.triggerOdds[0])}` : "–", "Bonus frequency")}
      ${stat(s.ante?.rtp ? pct(s.ante.rtp) : "–", `${data.ante.name} (${data.ante.price}× bet) RTP`)}
      ${stat(s.featureSpin?.rtp ? pct(s.featureSpin.rtp) : "–", `${data.featureSpin.name} (${data.featureSpin.price}×) RTP`)}
      ${data.buys.map((bb) => stat(s.buyRtp ? pct(s.buyRtp[bb.key]) : "–", `${bb.name} buy (${bb.price}×) RTP`)).join("")}
      ${stat(s.std ? `${s.std.toFixed(0)}×` : "–", "Volatility: very high (SD per spin)")}
    </div>
    <p>The base game is calculated exactly; the bonus is simulated tens of millions of times, and the
    whole game billions of times as an independent check, in every mode. <a href="selftest.html">Run the engine self-test.</a></p>
    <h3>Paytable (bet ${fmt(b)}, pays per way)</h3>
    <p>The four beasts pay the most, then the bootleg merch. In the bonus, the beasts are what the Nets catch.</p>
    <table><thead><tr><th>Symbol</th><th>3</th><th>4</th><th>5</th></tr></thead><tbody>${rows}</tbody></table>
    <h3>Base game features</h3>
    <ul>
      <li><b>Static</b>: after every spin, all Static TVs on screen reveal the <b>same</b> random symbol (sometimes a Wild).</li>
      <li><b>Tag Wild</b> (reels 2–5) substitutes for every paying symbol. In the base game every Tag Wild
      carries a <b>×2, ×3 or ×5</b> multiplier (weights ${data.wildMults.weights.join(" : ")}). A wild counts as that many
      ways, so multipliers on the same win <b>multiply together</b>. Wilds revealed by Static and wilds under a
      Net count once (no multiplier).</li>
      <li><b>Net Wild</b> drops onto reels 2–4; its whole row and column turn wild.</li>
      <li><b>3, 4 or 5 Capture Cores</b> start the bonus on level 1, 2 or 3.</li>
    </ul>
    <h3>The bonus: catch the beasts</h3>
    <p>${data.freeSpins} free spins. On any free spin a <b>Net Wild</b> can drop onto reel 2, 3 or 4, even onto a reel
    that is already netted. Its <b>whole reel turns wild</b>, and every <b>beast</b> on that reel is <b>caught</b>: each
    catch adds to the <b>Catch Multiplier</b>. The Catch Multiplier starts at ×1, <b>never resets</b>, and multiplies
    every win in the bonus.</p>
    <p>Capture Cores land in the bonus too: every <b>${data.reactorsPerLevel} Cores</b> = next level + ${data.levelUpSpins} spins.
    Higher levels drop more Nets.</p>
    <ol>
      ${lv.map((l, i) => `<li><b>${l.name}</b>: ${ruleShort(i)}; Net chance ${pct(l.netChance, 0)} per spin.</li>`).join("")}
    </ol>
    <p>A held net keeps its reel wild for that many more spins (the number on the net). Guaranteed minimum bonus win:
    ${data.minBonusWin.slice(0, 3).map((m, i) => `${m}× from level ${i + 1}`).join(", ")}.</p>
    <h3>Bonus Hunt</h3>
    <p>Optional. Each spin costs <b>${data.ante.price}× bet</b> and plays on reels with extra Capture Cores: the bonus comes
    about 1 in ${s.ante?.p_trigger ? Math.round(1 / s.ante.p_trigger[0]) : 70} spins instead of 1 in ${s.triggerOdds ? Math.round(s.triggerOdds[0]) : 342}.
    Wins are paid on the bet, not the ante. RTP ${s.ante?.rtp ? pct(s.ante.rtp) : "96%"}.</p>
    <h3>Buy feature</h3>
    <p><b>${data.featureSpin.name}</b> (${data.featureSpin.price}× bet): one base spin with a guaranteed Net Wild cross.<br>
    ${data.buys.map((bb) => `<b>${bb.name}</b>: ${bb.price}× bet, starts on level ${bb.startLevel + 1}`).join(" · ")}.
    Overload can only be reached by collecting Capture Cores in the bonus.</p>
    <h3>Max win</h3>
    <p>Maximum win <b>${data.maxWin.toLocaleString()}× bet</b> per round (base spin plus any bonus it triggers);
    the round ends as soon as it's reached${s.maxWinOdds ? `, about 1 in ${Math.round(s.maxWinOdds).toLocaleString()} spins` : ""}.
    A malfunction voids all pays and plays.</p>
    <p class="label">Free-play portfolio demo. Virtual credits have no cash value. Not a gambling product.</p>`;
}

// ---- Wiring ----------------------------------------------------------------------
ui.spin.addEventListener("click", spin);
ui.buyBtn.addEventListener("click", openBuyMenu);
ui.huntBtn.addEventListener("click", () => {
  if (S.busy) return;
  S.hunt = !S.hunt;
  store.set("hunt", S.hunt);
  sfx.click();
  tick(S.hunt ? `<b>Bonus Hunt on</b>: each spin costs ${fmt(stake())} (${data.ante.price}× bet) and the bonus comes about 5× more often.`
    : "Bonus Hunt off.");
  render();
});
ui.autoBtn.addEventListener("click", async () => {
  if (S.auto) return stopAuto("stopped by player");
  if (S.busy) return;
  const a = await autoplayMenu({ fmt, stake: stake() });
  if (!a) return;
  S.auto = { ...a, left: a.spins, startNet: S.won - S.wagered };
  render();
  spin();
});
ui.historyBtn.addEventListener("click", () => historyMenu({ rounds: S.history, fmt }));
ui.settingsBtn.addEventListener("click", async () => {
  const cur = { ...audioPrefs(), turbo: ui.turbo.checked, splash: S.prefs.splash, realityMins: S.prefs.realityMins };
  const out = await settingsMenu(cur);
  setAudioPrefs(out);
  ui.turbo.checked = out.turbo;
  document.documentElement.style.setProperty("--t", speed());
  S.prefs = { ...S.prefs, splash: out.splash, realityMins: out.realityMins };
  store.set("prefs", S.prefs);
});
ui.betUp.addEventListener("click", () => {
  S.betIdx = Math.min(S.betIdx + 1, BETS.length - 1);
  sfx.click();
  render();
});
ui.betDown.addEventListener("click", () => {
  S.betIdx = Math.max(S.betIdx - 1, 0);
  sfx.click();
  render();
});
ui.refill.addEventListener("click", () => {
  S.balance = round2(S.balance + REFILL);
  sfx.coin();
  render();
});
ui.turbo.addEventListener("change", () => document.documentElement.style.setProperty("--t", speed()));

ui.infoBtn.addEventListener("click", () => {
  buildInfo();
  ui.info.showModal();
});
const paintMute = () => {
  ui.mute.innerHTML = isMuted() ? ICON.soundOff : ICON.soundOn;
  ui.mute.setAttribute("aria-label", isMuted() ? "Unmute sound" : "Mute sound");
};
ui.mute.addEventListener("click", () => {
  setMuted(!isMuted());
  paintMute();
  sfx.click();
});
paintMute();
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || document.querySelector("dialog[open]") || document.querySelector(".screen:not([hidden])")) return;
  e.preventDefault();
  spin();
});

const repo = document.body.dataset.repo;
if (repo) {
  ui.repoLink.href = repo;
  ui.repoLink.hidden = false;
}

// ---- Session status and reality check -----------------------------------------------
const two = (n) => String(n).padStart(2, "0");
let realityOpen = false;
setInterval(async () => {
  const now = new Date();
  ui.clock.textContent = `${two(now.getHours())}:${two(now.getMinutes())}`;
  const secs = Math.floor((now - S.start) / 1000);
  ui.sessTime.textContent = secs >= 3600 ? `${Math.floor(secs / 3600)}:${two(Math.floor(secs / 60) % 60)}:${two(secs % 60)}`
    : `${Math.floor(secs / 60)}:${two(secs % 60)}`;
  const mins = S.prefs.realityMins;
  if (mins && !realityOpen && !S.busy && now - S.lastReality >= mins * 60000) {
    realityOpen = true;
    stopAuto("reality check");
    const go = await realityCheck({ minutes: Math.round((now - S.start) / 60000), net: round2(S.won - S.wagered), fmt });
    S.lastReality = Date.now();
    realityOpen = false;
    if (!go) tick("Taking a break. Your balance is saved; come back any time.");
  }
}, 1000);
ui.trigCores.innerHTML = symbolHTML("S").repeat(3);
if (data.stats?.rtp) ui.rtpBadge.textContent = `RTP ${(100 * data.stats.rtp).toFixed(2)}%`;

// First screen: a random base-game window with the Static already revealed, no animation.
const first = game.spinReels("base").grid;
game.revealStatic(first, null, "base");
for (let r = 0; r < R; r++) setColumn(r, first[r]);
render();
document.documentElement.style.setProperty("--t", speed());
if (S.prefs.splash) {
  splash(data).then(({ skip }) => {
    if (skip) {
      S.prefs.splash = false;
      store.set("prefs", S.prefs);
    }
    music.start(-1); // the Play click unlocks audio
  });
} else {
  addEventListener("pointerdown", () => music.start(-1), { once: true });
}

// ---- Debug hooks (only with ?debug in the URL) -------------------------------------------
if (new URLSearchParams(location.search).has("debug")) {
  const baseCum = game.cum.base;
  window.bb = {
    game,
    state: S,
    /** Play the bonus for free from a starting level (0-3). */
    async bonus(level = 0) {
      if (S.busy) return;
      S.busy = true;
      render();
      const st = await runBonus(level, data.maxWin);
      credit(round2(st.total * bet()));
      S.busy = false;
      render();
    },
    /** Force a Net Wild on every base spin (true) or restore the real odds (false). */
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

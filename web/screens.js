// Full-screen bonus moments: the intro with the level ladder, level-up takeovers and the
// count-up total at the end. Each one resolves when the player clicks (or after a timeout).
import { symbolHTML } from "./symbols.js?v=14";

const TIERS = [
  [1000, "LEGENDARY WIN", "legend"],
  [250, "EPIC WIN", "epic"],
  [100, "MEGA WIN", "mega"],
  [25, "BIG WIN", "big"],
  [0, "BONUS COMPLETE", ""],
];

let el = null;
function host() {
  if (!el) {
    el = document.createElement("div");
    el.className = "screen";
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

function ladder(levels, current, rules, unlocking = -1) {
  return `<ol class="ladder">${levels.map((lv, i) => {
    const state = i < current ? "done" : i === current ? "current" : "locked";
    return `<li class="rung ${state}${i === unlocking ? " unlocking" : ""}" data-l="${i}">
      <span class="rung-num">${i + 1}</span><span class="rung-name">${lv.name}</span>
      <span class="rung-text">${rules[i] || ""}</span></li>`;
  }).join("")}</ol>`;
}

/** Show the screen, wait for a click/key (after `minMs`) or for `maxMs`, then hide it. */
function present(html, cls, { minMs = 500, maxMs = 4000 } = {}) {
  const s = host();
  s.className = `screen ${cls}`;
  delete s.dataset.tier;
  s.innerHTML = html;
  s.hidden = false;
  return new Promise((res) => {
    const t0 = performance.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      s.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey, true);
      clearTimeout(timer);
      s.classList.add("out");
      setTimeout(() => {
        s.hidden = true;
        s.classList.remove("out");
        res();
      }, 220);
    };
    const onClick = () => performance.now() - t0 > minMs && finish();
    const onKey = (e) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }
    };
    s.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey, true);
    const timer = setTimeout(finish, maxMs);
  });
}

export function intro({ levels, level, spins, perLevel, levelUpSpins, rules, speed, auto }) {
  const lv = levels[level];
  const html = `<div class="scr-card">
    <div class="scr-kicker">Bonus unlocked</div>
    <div class="scr-title">${lv.name.toUpperCase()}</div>
    <div class="scr-sub"><b>${spins}</b> free spins</div>
    <div class="scr-hint"><span class="scr-icon">${symbolHTML("OW")}</span>
      <span><b>Net Wilds</b> turn their reel wild and <b>catch every beast</b> on it. Each catch grows the
      <b>Catch Multiplier</b>, and it <b>never resets</b>.</span></div>
    ${ladder(levels, level, rules)}
    <div class="scr-hint"><span class="scr-icon">${symbolHTML("R")}</span>
      <span>Collect <b>${perLevel} Capture Cores</b> for <b>+${levelUpSpins} spins</b> and the next level</span></div>
    <div class="scr-cta">Click to start</div></div>`;
  // Waits for the player (auto-closes only during Autoplay).
  return present(html, `intro lvl-${level}`, { minMs: 1000, maxMs: auto ? 4500 * speed : 120000 });
}

export function levelUp({ levels, level, levelUpSpins, rules, speed, auto }) {
  const html = `<div class="scr-card">
    <div class="scr-kicker">Level up</div>
    <div class="scr-title">${levels[level].name.toUpperCase()}</div>
    <div class="scr-sub"><b>+${levelUpSpins}</b> free spins · ${rules[level]}</div>
    ${ladder(levels, level, rules, level)}
    <div class="scr-cta">Click to continue</div></div>`;
  return present(html, `levelup lvl-${level}`, { minMs: 1000, maxMs: auto ? 3500 * speed : 120000 });
}

/** Count the total up, rising through the win tiers as it passes them. */
export async function outro({ levels, level, totalX, bet, floored, fmt, sfx, mult, caught, speed, auto }) {
  const amount = Math.round(totalX * bet * 100) / 100;
  const html = `<div class="scr-card">
    <div class="scr-kicker">Reached ${levels[level].name}</div>
    <div class="scr-title" id="scrTier">BONUS COMPLETE</div>
    <div class="scr-amount" id="scrAmt">0.00</div>
    <div class="scr-sub" id="scrX">${floored ? "Guaranteed minimum win" : "&nbsp;"}</div>
    <div class="scr-stats"><span>Catch Multiplier <b>×${mult.toLocaleString()}</b></span><span>Beasts caught <b>${caught}</b></span></div>
    <div class="scr-cta">Click to collect</div><div class="coins" aria-hidden="true"></div></div>`;
  const dur = Math.min(4200, 1400 + Math.sqrt(totalX) * 160) * speed;
  const shown = present(html, `outro lvl-${level}`, { minMs: dur, maxMs: auto ? dur + 2500 : 120000 });
  const s = host();
  const tierEl = s.querySelector("#scrTier");
  const amtEl = s.querySelector("#scrAmt");
  const xEl = s.querySelector("#scrX");
  const t0 = performance.now();
  let tier = TIERS.length - 1;
  let lastCoin = 0;
  const tick = (now) => {
    if (s.hidden) return;
    const p = Math.min(1, (now - t0) / dur);
    const x = totalX * (1 - (1 - p) ** 2.4);
    amtEl.textContent = fmt(Math.round(x * bet * 100) / 100);
    const t = TIERS.findIndex(([min]) => x >= min);
    if (t < tier) {
      tier = t;
      tierEl.textContent = TIERS[t][1];
      s.dataset.tier = TIERS[t][2];
      tierEl.classList.remove("pop");
      void tierEl.offsetWidth;
      tierEl.classList.add("pop");
      if (t < TIERS.length - 1) {
        sfx.bigWin();
        rain(s.querySelector(".coins"), 14 + (TIERS.length - t) * 10);
      }
    }
    if (now - lastCoin > 75 && p < 1) {
      sfx.coin();
      lastCoin = now;
    }
    if (p < 1) requestAnimationFrame(tick);
    else {
      amtEl.textContent = fmt(amount);
      xEl.innerHTML = `${totalX.toLocaleString("en-US", { maximumFractionDigits: 2 })}× bet${floored ? " · guaranteed minimum" : ""}`;
      s.classList.add("counted");
    }
  };
  requestAnimationFrame(tick);
  await shown;
}

function rain(box, n) {
  if (!box) return;
  for (let i = 0; i < n; i++) {
    const c = document.createElement("i");
    c.style.left = `${Math.random() * 100}%`;
    c.style.animationDelay = `${Math.random() * 0.9}s`;
    c.style.animationDuration = `${1.4 + Math.random() * 1.2}s`;
    box.appendChild(c);
    setTimeout(() => c.remove(), 3600);
  }
}

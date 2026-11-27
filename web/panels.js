// Menus and dialogs: the splash screen, the buy-feature menu, autoplay setup, settings, game
// history and the reality check. Each function opens a <dialog> and resolves with the choice.
import { symbolHTML } from "./symbols.js?v=14";

function dialog(cls, html, { dismissable = true } = {}) {
  const d = document.createElement("dialog");
  d.className = `panel ${cls}`;
  d.innerHTML = html;
  document.body.appendChild(d);
  d.showModal();
  if (!dismissable) d.addEventListener("cancel", (e) => e.preventDefault());
  return d;
}

function closeWith(d, value, resolve) {
  d.classList.add("closing");
  setTimeout(() => {
    d.close();
    d.remove();
    resolve(value);
  }, 160);
}

const bars = (n) => `<span class="vol" aria-label="volatility ${n} of 5">${[1, 2, 3, 4, 5].map((i) =>
  `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;

/** First screen: the logo, the three headline features and the numbers. */
export function splash(data) {
  const s = data.stats || {};
  const feat = (sym, title, text) => `<div class="feat"><div class="feat-icon">${symbolHTML(sym)}</div>
    <b>${title}</b><span>${text}</span></div>`;
  return new Promise((resolve) => {
    const d = dialog("splash", `
      <div class="splash-logo" role="img" aria-label="Bootleg Beasts">${document.querySelector(".logo svg")?.outerHTML ?? ""}</div>
      <div class="feats">
        ${feat("W", "Multiplier Wilds", "Every Tag Wild in the base game carries ×2, ×3 or ×5, and they multiply each other.")}
        ${feat("OW", "Net &amp; Catch", "In the bonus, Net Wilds turn their reel wild and catch every beast on it. Each catch grows a multiplier that never resets.")}
        ${feat("R", "Level Up", "Collect 3 Capture Cores for +3 spins and the next level. Overload doubles the multiplier and locks every net.")}
      </div>
      <div class="splash-stats">
        <span><b>${s.rtp ? (100 * s.rtp).toFixed(2) : "96.00"}%</b> RTP</span>
        <span><b>${data.maxWin.toLocaleString()}×</b> max win</span>
        <span><b>Very high</b> volatility</span>
        <span><b>3,125</b> ways</span>
      </div>
      <button class="btn-primary" data-go>Play</button>
      <label class="check"><input type="checkbox" data-skip> Don't show this again</label>
      <p class="fine">Free-play portfolio demo. Virtual credits only, no real money.</p>`, { dismissable: false });
    d.querySelector("[data-go]").addEventListener("click", () =>
      closeWith(d, { skip: d.querySelector("[data-skip]").checked }, resolve));
  });
}

/** Buy menu: one card per feature. Resolves with the chosen item's key, or null. */
export function buyMenu({ items, bet, balance, fmt }) {
  return new Promise((resolve) => {
    const cards = items.map((it) => {
      const cost = it.price * bet;
      const afford = balance >= cost - 1e-9;
      return `<button class="buy-card lvl-${it.level ?? "f"}" data-key="${it.key}" ${afford ? "" : "disabled"}>
        <span class="bc-icon">${symbolHTML(it.icon)}</span>
        <span class="bc-name">${it.name}</span>
        <span class="bc-text">${it.text}</span>
        <span class="bc-meta">${it.rtp ? `RTP ${(100 * it.rtp).toFixed(2)}%` : ""}${it.min ? ` · min win ${it.min}×` : ""}</span>
        ${bars(it.vol)}
        <span class="bc-price">${fmt(cost)}<small>${it.price}× bet</small></span>
      </button>`;
    }).join("");
    const d = dialog("buy-menu", `
      <header><h2>Buy feature</h2><button class="x" data-close aria-label="Close">×</button></header>
      <div class="buy-cards">${cards}</div>
      <div class="confirm" hidden>
        <p data-q></p>
        <div class="row"><button class="btn-ghost" data-no>Cancel</button><button class="btn-primary" data-yes>Buy</button></div>
      </div>
      <p class="fine">Bet ${fmt(bet)}. The Overload level can't be bought: it has to be earned.</p>`);
    let chosen = null;
    d.querySelector("[data-close]").addEventListener("click", () => closeWith(d, null, resolve));
    d.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeWith(d, null, resolve);
    });
    const conf = d.querySelector(".confirm");
    d.querySelectorAll(".buy-card").forEach((c) => c.addEventListener("click", () => {
      chosen = items.find((i) => i.key === c.dataset.key);
      d.querySelector("[data-q]").innerHTML = `Buy <b>${chosen.name}</b> for <b>${fmt(chosen.price * bet)}</b>?`;
      conf.hidden = false;
      d.querySelectorAll(".buy-card").forEach((x) => x.classList.toggle("picked", x === c));
    }));
    d.querySelector("[data-no]").addEventListener("click", () => {
      conf.hidden = true;
      d.querySelectorAll(".buy-card").forEach((x) => x.classList.remove("picked"));
    });
    d.querySelector("[data-yes]").addEventListener("click", () => closeWith(d, chosen && chosen.key, resolve));
  });
}

/** Autoplay setup with stop conditions. Resolves with settings or null. */
export function autoplayMenu({ fmt, stake }) {
  return new Promise((resolve) => {
    const d = dialog("auto-menu", `
      <header><h2>Autoplay</h2><button class="x" data-close aria-label="Close">×</button></header>
      <p class="lbl">Number of spins</p>
      <div class="seg" data-spins>${[10, 25, 50, 100].map((n, i) => `<button class="${i === 1 ? "on" : ""}" data-n="${n}">${n}</button>`).join("")}</div>
      <p class="lbl">Stop if net loss reaches</p>
      <div class="seg" data-loss>${[20, 50, 100, 0].map((n, i) => `<button class="${i === 1 ? "on" : ""}" data-n="${n}">${n ? fmt(n * stake) : "No limit"}</button>`).join("")}</div>
      <p class="lbl">Stop if a single win is at least</p>
      <div class="seg" data-win>${[25, 100, 0].map((n, i) => `<button class="${i === 1 ? "on" : ""}" data-n="${n}">${n ? fmt(n * stake) : "No limit"}</button>`).join("")}</div>
      <label class="check"><input type="checkbox" data-bonus checked> Stop when a bonus starts</label>
      <button class="btn-primary" data-go>Start autoplay</button>`);
    d.querySelectorAll(".seg").forEach((g) => g.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      g.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    }));
    const val = (sel) => Number(d.querySelector(`${sel} .on`).dataset.n);
    d.querySelector("[data-close]").addEventListener("click", () => closeWith(d, null, resolve));
    d.querySelector("[data-go]").addEventListener("click", () => closeWith(d, {
      spins: val("[data-spins]"), lossLimit: val("[data-loss]") * stake, winLimit: val("[data-win]") * stake,
      stopOnBonus: d.querySelector("[data-bonus]").checked,
    }, resolve));
  });
}

/** Settings: sound, music, turbo, reality-check interval, intro screens. */
export function settingsMenu(cur) {
  return new Promise((resolve) => {
    const row = (key, label) => `<label class="switch"><span>${label}</span><input type="checkbox" data-k="${key}" ${cur[key] ? "checked" : ""}><i></i></label>`;
    const d = dialog("settings", `
      <header><h2>Settings</h2><button class="x" data-close aria-label="Close">×</button></header>
      ${row("sound", "Sound effects")}
      ${row("music", "Music")}
      ${row("turbo", "Turbo spin")}
      ${row("splash", "Show feature screen on load")}
      <p class="lbl">Reality check reminder</p>
      <div class="seg" data-rc>${[15, 30, 60, 0].map((n) => `<button class="${cur.realityMins === n ? "on" : ""}" data-n="${n}">${n ? `${n} min` : "Off"}</button>`).join("")}</div>
      <button class="btn-primary" data-go>Done</button>`);
    d.querySelector("[data-rc]").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) d.querySelectorAll("[data-rc] button").forEach((x) => x.classList.toggle("on", x === b));
    });
    const done = () => {
      const out = { ...cur };
      d.querySelectorAll("[data-k]").forEach((i) => (out[i.dataset.k] = i.checked));
      out.realityMins = Number(d.querySelector("[data-rc] .on")?.dataset.n ?? cur.realityMins);
      closeWith(d, out, resolve);
    };
    d.querySelector("[data-close]").addEventListener("click", done);
    d.querySelector("[data-go]").addEventListener("click", done);
  });
}

/** The last rounds played: time, mode, stake, win and any feature. */
export function historyMenu({ rounds, fmt }) {
  return new Promise((resolve) => {
    const rows = rounds.slice().reverse().map((r) =>
      `<tr><td>${new Date(r.t).toLocaleTimeString()}</td><td>${r.mode}</td><td>${fmt(r.stake)}</td>
       <td class="${r.win > 0 ? "pos" : ""}">${fmt(r.win)}</td><td>${r.note || ""}</td></tr>`).join("");
    const d = dialog("history", `
      <header><h2>Game history</h2><button class="x" data-close aria-label="Close">×</button></header>
      ${rounds.length ? `<div class="hist-wrap"><table><thead><tr><th>Time</th><th>Round</th><th>Stake</th><th>Win</th><th>Feature</th></tr></thead>
      <tbody>${rows}</tbody></table></div>` : "<p>No rounds played yet.</p>"}
      <p class="fine">Last ${rounds.length} of up to 100 rounds this session.</p>`);
    d.querySelector("[data-close]").addEventListener("click", () => closeWith(d, null, resolve));
  });
}

/** Reality check: time played and net result; resolves true to keep playing. */
export function realityCheck({ minutes, net, fmt }) {
  return new Promise((resolve) => {
    const d = dialog("reality", `
      <h2>Reality check</h2>
      <p>You have been playing for <b>${minutes} minute${minutes === 1 ? "" : "s"}</b>.</p>
      <p>Net result this session: <b class="${net >= 0 ? "pos" : "neg"}">${net >= 0 ? "+" : "−"}${fmt(Math.abs(net))}</b></p>
      <div class="row"><button class="btn-ghost" data-stop>Take a break</button><button class="btn-primary" data-go>Keep playing</button></div>`,
    { dismissable: false });
    d.querySelector("[data-go]").addEventListener("click", () => closeWith(d, true, resolve));
    d.querySelector("[data-stop]").addEventListener("click", () => closeWith(d, false, resolve));
  });
}

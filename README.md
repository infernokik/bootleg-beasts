# Bootleg Beasts — Slot Math & Simulation

A 5×5, 3,125-ways slot with a **catch-the-beasts bonus**. **Net Wilds** turn whole reels wild and
catch every beast on them, and each catch grows a **Catch Multiplier that never resets**. This repo has the
full math model, an exact calculation of the base game, and Monte Carlo verification showing the game
hits **96% RTP**.

### ▶ [Play the free demo](https://infernokik.github.io/bootleg-beasts/)

The browser demo plays the exact same reel strips, weights and rules as the verified model. Its
[self-test page](https://infernokik.github.io/bootleg-beasts/selftest.html) checks the JavaScript
engine against Python in your browser. Virtual credits only, no real-money play.

## Features

- **Multiplier Wilds:** every Tag Wild that lands in the base game carries ×2, ×3 or ×5, and they multiply each other.
- **Static TVs** are mystery symbols: every Static on screen reveals the same random symbol.
- **Net Wild** drops a wild cross in the base game (about 1 in 323 spins).
- **The bonus** (3, 4 or 5 Capture Cores): Net Wilds land on reels 2–4, even on reels already netted, and turn the
  whole reel wild. Every beast on it is **caught** and adds to the **Catch Multiplier**, which never resets.
- **Four levels**, each with one clear rule: Street Hunt (+1× per catch) → Night Raid (nets hold 1 more spin) →
  Lockdown (+2× per catch, nets hold 2) → **Overload** (multiplier doubles, +3× per catch, nets lock for good).
  Every 3 Capture Cores in the bonus = +3 spins and the next level, and higher levels drop more Nets.
- **Bonus buys:** Street Hunt (100×), Night Raid (339×) and Lockdown (1,405×), matching 3, 4 and 5 Cores, plus the
  **Super Net Spin** (57.1×, a guaranteed cross). Guaranteed minimum win per start level. Overload must be earned.
- **Bonus Hunt** ante: 3× bet per spin for the bonus about 1 in 70 spins instead of 1 in 342.
- Presentation: nets unroll over the reels with hold counters, caught beasts fly into the multiplier, a centre-board
  win counter shows ways win × multiplier, a level ribbon, an Overload ×2 slam, full-screen intro, level-up and
  count-up win screens (BIG → MEGA → EPIC → LEGENDARY).
- Each level relights the back alley (rain, searchlights, sirens, overload glow), with a music loop that speeds up as you level.
- Player protection: session clock and net result, reality checks, autoplay with loss and win limits, game history,
  and no win celebration for a return at or below the stake.
- Original hand-drawn SVG art in a back-alley sticker style, a lamp-lit brick-wall background and a phone layout.

## Headline numbers

| | Result |
|---|---|
| **RTP, exact base + simulated bonus** | **96.00% ± 0.03%** |
| RTP, 10¹⁰ full-game spins | 96.00% ± 0.05% (z = +0.29) |
| Bonus Hunt (3×) RTP, 2.5×10⁹ spins | 95.99% ± 0.07% (z = −0.04 vs exact parts) |
| Super Net Spin (57.1×) RTP | 96.14% ± 0.01% (z = +0.97) |
| Street Hunt buy (100×) RTP | 96.28% ± 0.10% |
| Night Raid buy (339×) RTP | 96.28% ± 0.08% |
| Lockdown buy (1,405×) RTP | 96.16% ± 0.05% |
| Hit frequency | 31.0% |
| Volatility (SD per spin) | 23.1× bet (very high) |
| Bonus odds (3 / 4 / 5 Cores) | 1 in 342 / 1 in 9,140 / 1 in 610,574 spins |
| Max win 10,000× | 1 in 552,486 spins |

Full numbers: **[par sheet](docs/par_sheet.md)**. Design, rules and the iteration log:
**[docs/design_spec.md](docs/design_spec.md)**. Market research behind the feature set:
**[docs/market_analysis.md](docs/market_analysis.md)**.

![RTP convergence](reports/rtp_convergence.png)
![Player sessions](reports/sessions.png)

## How the RTP is proven

- **Exact base game.** Reel stops are independent, so the expected ways win factorises into a product
  of per-reel expectations, for each Static reveal and Net position. A brute-force pass over all
  1.91 billion base-reel stop combinations matches it to ten decimal places.
- **Bonus by Monte Carlo.** Each start level is simulated for 5×10⁷ rounds, with 95% confidence intervals.
- **Independent full-game check.** 10¹⁰ complete rounds are played the way a player would play them,
  and the result agrees with exact + bonus parts. Bonus Hunt and Super Net Spin are checked the same way.
- **Unit tests** cover ways evaluation, crosses, reveals, level-ups, catches, the multiplier, holds and formula-vs-brute-force.
- **JS engine self-test** checks the browser engine against Python test vectors and by simulation.

The simulator is NumPy + Numba, running on all CPU cores with a reproducible seed per chunk.

## Layout

```
src/bootleg_beasts/
  config.py     symbols, paytable, bonus levels (catch values, holds), model loading
  engine.py     Numba kernels: ways, reveals, Net drops, base spin, bonus round, batch simulators
  exact.py      exact base-game RTP (factorised) + brute-force full-cycle check
  sim.py        Python wrappers: run simulations, summarise, confidence intervals
  reelgen.py    builds reel strips from a symbol composition
  model.json    the tuned model: reel strips, Net drop weights, reveal weights, buy prices
sims/
  tune.py       builds the reels and tunes drop rates to the RTP targets
  verify.py     runs all verifications, writes reports/results.json + convergence.csv
  charts.py     charts (reports/*.png) and the par sheet (docs/par_sheet.md)
  export_web.py exports the model + JS test vectors for the browser demo
web/            playable demo (vanilla JS, no build step), deployed by GitHub Pages
  engine.js     line-for-line port of engine.py
  app.js        UI: reels, reveals, nets, catches, multiplier and Core meters, win presentation
  symbols.js    the symbol art, hand-written SVG (sticker style)
  panels.js     splash, buy menu, autoplay, settings, history and reality-check dialogs
  screens.js    full-screen bonus intro, level-up and win screens
  sfx.js        synthesized WebAudio sound effects and the music loops
  fx.js         confetti, beams, screen shake, impact flash
  background.js lamp-lit brick back alley (canvas)
  selftest.html checks engine.js against the Python model
art/            earlier AI-generated pixel art (v0.1-v0.3, no longer used by the demo)
tests/          pytest unit tests
docs/           design spec, par sheet, art brief
reports/        results.json and charts
```

## Run it (Windows)

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe sims\tune.py
.\.venv\Scripts\python.exe sims\verify.py --spins 1e10 --bonus-rounds 5e7
.\.venv\Scripts\python.exe sims\charts.py
```

Requires Python 3.12+.

## Note on originality

The theme and creatures are original. The game takes the creature-catching *genre* and the style of
modern high-volatility studios, but uses no existing franchise's characters, art or mechanic names.

**Art:** the symbols, logo and background are original and drawn in code: hand-written SVG in
[web/symbols.js](web/symbols.js) and a canvas back alley in [web/background.js](web/background.js).
Fonts: Lilita One and Rubik (Google Fonts, SIL Open Font License). Versions up to v0.3 used pixel art
generated with Google Gemini from original prompts ([docs/art_brief.md](docs/art_brief.md)); it is kept in `art/`.

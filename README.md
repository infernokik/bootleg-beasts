# Glitch Tamers — Slot Math & Simulation

A high-volatility 5×5, 3,125-ways slot. Its **cross wild** turns its whole row and column wild, and
**three bonus tiers** are triggered by 3, 4 or 5 scatters. The top tier is hidden and can't be
bought. This repo has the full math model, an exact calculation of the base game, and Monte Carlo
verification showing the game hits **96% RTP**.

### ▶ [Play the free demo](PLAY_URL)

The browser demo plays the exact same reel strips, weights and rules as the verified model. Its
[self-test page](PLAY_URLselftest.html) checks the JavaScript engine against Python in your browser:
identical wins on 1,500 exported grids, the same bonus rules, and matching RTP by simulation.
Virtual credits only, no real-money play.

## Headline numbers

| | Result |
|---|---|
| **RTP, exact base + simulated bonuses** | **95.997% ± 0.004%** |
| RTP, 10¹⁰ full-game spins | 95.984% ± 0.024% |
| Street Hunt buy (100×) RTP | 96.18% ± 0.01% |
| Night Raid buy (300×) RTP | 96.23% ± 0.03% |
| Hit frequency | 29.6% |
| Volatility (SD per spin) | 12.5× bet |
| Bonus odds (3 / 4 / 5 Cores) | 1 in 291 / 1 in 7,300 / 1 in 458,417 spins |
| Max win 10,000× | 1 in 1,778,410 spins |

Full design, results and the design iteration log: **[docs/design_spec.md](docs/design_spec.md)**.

## How the RTP is proven

- **Exact base game.** Reel stops are independent, so the expected ways win factorises into a product
  of per-reel expectations. The exact base RTP takes milliseconds to compute. A brute-force pass
  over all 1.43 billion base-reel stop combinations matches it to ten decimal places.
- **Bonuses by Monte Carlo.** Each tier is simulated on its own for 10⁸ rounds, giving mean payouts
  with 95% confidence intervals.
- **Independent full-game check.** 10¹⁰ complete rounds are played the way a player would play them.
  The result has to agree with exact + bonus parts within the confidence interval.
- **Unit tests** cover ways evaluation, the cross, every bonus rule, and formula-vs-brute-force on
  small reels.

The simulator is NumPy + Numba. It runs on all CPU cores with a reproducible seed per chunk, at
about **55 million game rounds per second** on a 12-core desktop (10¹⁰ spins in about 3 minutes).

## Layout

```
src/glitch_tamers/
  config.py     symbols, paytable, bonus rules, model loading
  engine.py     Numba kernels: ways evaluation, cross wild, base spin, bonus round, batch simulators
  exact.py      exact base-game RTP (factorised) + brute-force full-cycle check
  sim.py        Python wrappers: run simulations, summarise, confidence intervals
  reelgen.py    builds reel strips from a symbol composition
  model.json    the tuned model: reel strips + Override Wild drop weights
sims/
  tune.py       builds the reels and tunes drop rates to the RTP targets
  verify.py     runs all three verifications, writes reports/results.json + convergence.csv
  summarize.py  turns the results into the Markdown tables used in the docs
  export_web.py exports the model + JS test vectors for the browser demo
web/            playable demo (vanilla JS, no build step), deployed by GitHub Pages
  engine.js     line-for-line port of engine.py
  selftest.html checks engine.js against the Python model
tests/          pytest unit tests
docs/           design & math spec
reports/        results (charts and par sheet coming next)
```

## Run it (Windows)

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe sims\tune.py
.\.venv\Scripts\python.exe sims\verify.py --spins 1e10
```

Requires Python 3.12+.

## Roadmap

| Part | Status |
|---|---|
| Design & math spec | Done (v0.2) |
| Exact base game + full-cycle check | Done |
| Simulator, tuning to 96% | Done |
| Playable browser demo + JS-vs-Python self-test | Done |
| Charts: RTP convergence, RTP split, win distribution, bonus buy profiles | Next |
| Player-session simulation | Next |
| Par sheet | Next |

## Note on originality

The theme and creatures are original. The game takes the creature-catching *genre* and the style of
modern high-volatility studios, but uses no existing franchise's characters, art or mechanic names.

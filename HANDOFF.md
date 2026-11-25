# Handoff: Bootleg Beasts (for another Claude session)

Read this first if you are picking this project up in a new Claude Code session.

## Where things are

- Project folder (this PC): `C:\Users\t_dim\dev\slot-project`. Open a Claude Code session there.
- Public repo: https://github.com/infernokik/bootleg-beasts (push = auto-deploy).
- Live demo: https://infernokik.github.io/bootleg-beasts/
- Python env: `.venv\Scripts\python.exe` (Python 3.12, numpy, numba, pillow, pytest).
  Install: `.venv\Scripts\python.exe -m pip install -e ".[dev]" pillow`
- Local demo server: `.venv\Scripts\python.exe -m http.server 8765 --bind 127.0.0.1 --directory web`
  then open http://127.0.0.1:8765/?debug (debug hooks: `bb.bonus(i)`, `bb.forceOverride()`, `bb.forceStops([...])`).
- GitHub CLI is logged in as `infernokik`; commits use the noreply email (repo-local git config).
- After editing Numba code in `src/bootleg_beasts`, delete `src/bootleg_beasts/__pycache__/*.nbi|*.nbc` if you rename things.

## The user

Building this as a resume project to get into the slot / iGaming industry. Likes Hacksaw / Nolimit City
style, pixel art, lots of features. Communicates casually; wants things done ("do whatever you think
is best"). Keep all art original (no Pokémon or other IP; no adult content in public art).

## State (v0.3 redesign: done and pushed)

- Base: 5x5, 3,125 ways. Static (X) is a mystery symbol (weights in model.json `reveal_weights`).
  Override Wild cross ~1 in 1,488 base spins. 3/4/5 Capture Cores start the bonus at level 1/2/3. Max win 5,000x.
- Bonus: 4 levels (config.py `LEVELS`). 3 Reactors = +4 spins and next level. Beast captures stack
  onto the spin multiplier (config `CAPTURE`). Minimum win per start level (`MIN_BONUS_WIN`).
- Buys (named after their start level): Street Hunt 100x, Night Raid 230x, Lockdown 690x. RTP 96.03% (verified, see docs/par_sheet.md).
- Volatility is high (SD ~21x/spin) though the user asked for medium; user was told.
- Pipeline after any math change: `sims	une.py` -> `simserify.py --spins 2e9` -> `sims\export_web.py`
  -> `sims\charts.py` -> pytest -> open web/selftest.html -> bump `?v=` tags in web/index.html -> commit, push.

## Ideas if the user wants more

1. Lower volatility toward medium (flatter CAPTURE values, higher MIN_BONUS_WIN, retune).
2. Replace the procedural Reactor (`art\make_reactor.py`) with Gemini art in `art\gemini`, rerun `art\pixelate.py`.
3. Ante bet; mobile layout polish.

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

## State of the redesign (in progress, NOT yet committed or pushed)

Python math model is redesigned and tuned (commit pending):
- Base: 5x5, 3,125 ways. Static (X) is a mystery symbol: every Static reveals the same random symbol
  each spin (weights in model.json `reveal_weights`). Override Wild cross drop ~1 in 1,500 base spins.
  3/4/5 Capture Cores start the bonus at level 1/2/3. Max win 5,000x.
- Bonus: one bonus with 4 levels (config.py `LEVELS`). Collect 3 Reactors (R, bonus reels 1-4) to
  level up (+4 spins). Levels: Street Hunt (Override = wild column), Night Raid (column, bigger
  captures), Lockdown (columns lock), Overload (full crosses + Glitch Wilds lock).
- Beast capture: each beast (H1-H4) under a freshly dropped Override adds a random amount to that
  spin's multiplier (config `CAPTURE`); captures stack.
- Guaranteed minimum bonus win by starting level (config `MIN_BONUS_WIN`).
- Buys: Bonus 100x (level 1), Super Bonus (level 2, price set by tuner, in model.json `buy_prices`).
- No more last-spin guaranteed Override (user disliked it); engine keeps `guarantee` param, unused.
- 23 pytest tests pass. Tuner: `sims\tune.py`. RTP 96.00% (exact base + simulated bonus).
- Volatility is high (SD ~21x/spin) despite user asking for medium; explained to user.

## Remaining TODO (in order)

1. `sims\verify.py`, `sims\summarize.py`, `sims\export_web.py` still use the OLD tier API
   (TIERS, tier_arrays, run_bonus by tier). Update them to the new API in `sim.py`
   (`run_buy`, `run_bonus(start_level)`, `run_game` keys, `run_sessions`).
2. Port the new engine to `web\engine.js` (reveals, levels, captures, min win, column/cross shapes,
   sticky wilds/crosses) + update `web\selftest.js` and `sims\export_web.py` (export LEVELS,
   CAPTURE, MIN_BONUS_WIN, reveal weights, buy prices). Self-test must pass.
3. UI (`web\app.js`, `style.css`): level meter with 3 Reactor pips + level name; Reactor collect
   animation; Static reveal animation; capture popups (+x on beasts) and spin multiplier; level-up
   banner; win presentation cycling through each winning symbol with its amount; rarity frames so
   value is obvious (H1 gold, H2 purple, H3 blue, H4 green, lows plain/dim/smaller, specials glow);
   "Super Bonus" buy button; FIX: bonus HUD "Bonus win" updates before reels land (update after win).
4. Reactor symbol art: none yet (make 96x96 pixel art procedurally or ask user for Gemini art;
   `art\pixelate.py` handles sources in `art\gemini`).
5. Sound effects: synthesized WebAudio SFX (spin, reel stop, tease riser, Override zap, capture,
   reveal, reactor blip, level-up, wins, big win) with a mute toggle saved in localStorage.
6. Charts (matplotlib, `reports\*.png`): RTP convergence with CI band, RTP split, win distribution
   (log), bonus payout distribution + level reach, player sessions (10k x 500). Par sheet
   (`docs\par_sheet.md`). Update README + `docs\design_spec.md` for the redesign.
7. Run tests, test in browser (use `?debug`), commit (end messages with the Co-Authored-By trailer
   used in this repo), push to `main` (Pages deploys automatically; check `gh run list`).

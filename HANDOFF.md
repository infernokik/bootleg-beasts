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

## State (v0.5 bonus rebuild: done and pushed)

- Base: 5x5, 3,125 ways. Static (X) mystery symbol. Tag Wilds (W) that land carry x2/x3/x5 in the base game
  (Static-revealed ones count once: REVEALED_WILD in engine.py). Net Wild (OW, code name "override" in the
  Python/JSON) drops a wild cross ~1 in 323 base spins. 3/4/5 Capture Cores start the bonus at level 1/2/3.
  Max win 10,000x.
- Bonus (v0.5): Net Wilds drop on reels 2-4 (netted reels too), turn the whole reel wild, and every beast
  (H1-H4) on that reel adds the level's catch value to a Catch Multiplier that never resets. Levels in
  config.py `LEVELS` (catch +1/+1/+2/+3, hold 0/1/2/forever, net chance x1/1.15/1.30/1.45). Overload
  doubles the multiplier on arrival. 3 bonus Capture Cores ("R", same art) = +3 spins and next level.
  The user complained that higher levels got fewer drops (locks blocked them) and that the per-spin
  multiplier was weird; this design answers both.
- Buys: Super Net Spin 57.1x, Street Hunt 100x, Night Raid 339x, Lockdown 1,405x (Overload earned only).
  Bonus Hunt ante 3x bet. All modes verified at 96% (docs/par_sheet.md), 10^10-spin z = +0.29.
- Volatility very high (SD ~23x/spin); the user said keep it.
- Art: original hand-written SVG stickers in web/symbols.js (blob-URL <img>s), canvas back alley in
  web/background.js, Lilita One + Rubik from Google Fonts. Old Gemini pixel art kept in art/ only.
  The user wants Hacksaw-level polish; they disliked the old neon look.
- Pipeline after any math change: `sims\tune.py` -> `sims\verify.py --spins 1e10 --bonus-rounds 5e7` (~10 min)
  -> `sims\export_web.py` -> `sims\charts.py` -> pytest -> web/selftest.html -> bump `?v=` tags -> commit, push.

## Ideas if the user wants more

1. Jurisdiction switch (UK: no turbo/autoplay/buys), bonus replay, buy-card art showing 3/4/5 Cores.
2. Animated character idles / custom win animations per beast; real music instead of synth loops.

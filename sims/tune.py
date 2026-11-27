"""Build the reel strips and tune the feature odds so the game hits its RTP targets.

Order of work (each step only depends on the ones before it):
  1. Build base and bonus reel strips from the compositions below (fixed seeds, so reproducible).
  2. Bonus: find the level-1 Override Wild drop chance that makes the 100x Bonus buy return the
     target RTP (bisection on Monte Carlo with common random numbers, then a secant step). Every
     level's drop chance is that times the level's factor.
  3. Super Bonus price: its simulated mean payout / target RTP, rounded to a whole number.
  4. Base Override drop rate, exact: base RTP is linear in it, so solve
     (1 - q) * E0 + q * E1 = 96% - sum over starting levels of P(trigger) * E[bonus payout].
  5. Save the model to src/bootleg_beasts/model.json.

Run:  .venv\\Scripts\\python.exe sims\\tune.py
"""

from __future__ import annotations

import time

import numpy as np

from bootleg_beasts import exact, sim
from bootleg_beasts.config import ANTE_KEY, ANTE_PRICE, BUYS, FEATURE_KEY, LEVELS, MODEL_PATH, REELS, Model, ReelSet
from bootleg_beasts.reelgen import build_strip

TARGET_RTP = 0.9600
TARGET_BUY_RTP = 0.9620
BONUS_PRICE = 100.0
WEIGHT_TOTAL = 1_000_000

PAYING = {
    "H1": [2, 2], "H2": [3, 2], "H3": [3, 2, 1], "H4": [3, 2, 2],
    "L1": [3, 3, 2], "L2": [3, 3, 2], "L3": [3, 3, 2, 1], "L4": [3, 3, 2, 1], "L5": [3, 3, 2, 2],
}
# Static (mystery) stacks: every Static on screen reveals the same symbol, so stacks on several
# reels line up into big ways wins.
BASE_STACKS = PAYING | {"X": [2, 2]}
BONUS_STACKS = PAYING | {"X": [3, 3, 3, 2]}
# (stacks, singles per reel, seed)
REEL_SETS = {
    "base": (BASE_STACKS, [{"S": 1}] + [{"W": 1, "S": 1}] * 4, 11),
    # Reactors on reels 1-4, one Glitch Wild on reels 2-5
    "bonus": (BONUS_STACKS, [{"R": 1}] + [{"W": 1, "R": 1}] * 3 + [{"W": 1}], 101),
    # Bonus Hunt (ante): the base composition with two Capture Cores on reels 1-4 (kept 5+ stops
    # apart, so still at most one per window) and one on reel 5: about 5x the bonus odds
    "hunt": (BASE_STACKS, [{"S": 2}] + [{"W": 1, "S": 2}] * 3 + [{"W": 1, "S": 1}], 11),
}
REVEAL_WEIGHTS = {
    "base": {"H1": 3, "H2": 4, "H3": 5, "H4": 6, "L1": 9, "L2": 9, "L3": 10, "L4": 10, "L5": 11, "W": 1},
    "bonus": {"H1": 5, "H2": 6, "H3": 7, "H4": 8, "L1": 7, "L2": 7, "L3": 7, "L4": 7, "L5": 7, "W": 3},
}


def build_reels(stacks: dict, singles: list[dict], seed: int) -> ReelSet:
    return ReelSet.from_codes([build_strip(stacks, singles[r], seed + r) for r in range(REELS)])


def weights(q: float) -> list[int]:
    w1 = int(round(min(q, 1.0) * WEIGHT_TOTAL))
    return [WEIGHT_TOTAL - w1, w1, 0]


def level_weights(q: float) -> dict:
    return {lv.key: weights(q * lv.override_factor) for lv in LEVELS}


def level_cum(q: float) -> np.ndarray:
    return np.stack([np.cumsum(np.array(weights(q * lv.override_factor), dtype=np.int64)) for lv in LEVELS])


def bonus_ev(model, q, rounds, seed, start_level=0):
    return sim.run_bonus(model, start_level, rounds, seed=seed, level_cum=level_cum(q))["mean_win"]


def tune_bonus(model, target_ev, lo=0.0, hi=0.9):
    if bonus_ev(model, 0.0, 1_000_000, 777) >= target_ev:
        raise SystemExit("bonus is worth more than the target even without natural Override drops")
    for _ in range(16):
        mid = 0.5 * (lo + hi)
        if bonus_ev(model, mid, 1_000_000, 777) < target_ev:
            lo = mid
        else:
            hi = mid
    q0 = 0.5 * (lo + hi)
    q1 = q0 * 1.03
    e0 = bonus_ev(model, q0, 8_000_000, 31_337)
    e1 = bonus_ev(model, q1, 8_000_000, 31_337)
    for _ in range(2):  # secant steps on common random numbers
        q2 = q1 + (target_ev - e1) * (q1 - q0) / (e1 - e0)
        q0, e0 = q1, e1
        q1, e1 = q2, bonus_ev(model, q2, 8_000_000, 31_337)
    return q1


def main() -> None:
    t0 = time.perf_counter()
    reels = {key: build_reels(*spec) for key, spec in REEL_SETS.items()}
    model = Model("0.3", reels, {"base": weights(0.0)} | level_weights(0.0), REVEAL_WEIGHTS,
                  {BUYS[0].key: BONUS_PRICE})
    for key, rs in reels.items():
        print(f"Reel lengths {key:6s} {rs.lens.tolist()}")

    q = tune_bonus(model, TARGET_BUY_RTP * BONUS_PRICE)
    model.override_weights |= level_weights(q)
    print(f"Override drop chance per free spin: level 1 {q:.4f}, " +
          ", ".join(f"{lv.name} {q * lv.override_factor:.4f}" for lv in LEVELS[1:]))

    evs, cis = [], []
    for lvl, lv in enumerate(LEVELS):
        r = sim.run_bonus(model, lvl, 10_000_000, seed=2024 + lvl)
        evs.append(r["mean_win"])
        cis.append(r["ci95"])
        print(f"  start at {lv.name:12s} mean payout {r['mean_win']:8.2f}x +/- {r['ci95']:.2f}  "
              f"sd {r['std']:.0f}  final level shares {np.round(r['final_level_share'], 3).tolist()}")
    for b in BUYS[1:]:
        model.buy_prices[b.key] = float(round(evs[b.start_level] / TARGET_BUY_RTP))
        print(f"{b.name} buy price {model.buy_prices[b.key]:.0f}x "
              f"(RTP {evs[b.start_level] / model.buy_prices[b.key]:.3%})")

    ex = exact.base_game_exact(model)
    p_trig = np.array(ex["p_trigger"])
    bonus_rtp = float(p_trig @ np.array(evs[:3]))
    e0, e1 = ex["rtp_no_override"], ex["mean_win_one_override"]
    q_base = (TARGET_RTP - bonus_rtp - e0) / (e1 - e0)
    print(f"Base, exact: no-Override RTP {e0:.4%}, one-Override mean {e1:.1f}x, "
          f"bonus odds 1 in {1 / p_trig[0]:,.0f} / {1 / p_trig[1]:,.0f} / {1 / p_trig[2]:,.0f}")
    if not 0 < q_base < 0.05:
        raise SystemExit(f"base drop rate {q_base:.5f} is out of range: change the base reels")
    model.override_weights["base"] = weights(q_base)
    ex = exact.base_game_exact(model)
    ci = float(np.sqrt(np.sum((p_trig * np.array(cis[:3])) ** 2)))
    print(f"Base Override drop: 1 in {1 / q_base:,.0f} spins")
    print(f"RTP = base {ex['rtp_base_ways']:.4%} (exact) + bonus {bonus_rtp:.4%} = "
          f"{ex['rtp_base_ways'] + bonus_rtp:.4%} +/- {ci:.4%}")
    # Override Spin: guaranteed cross; EV = exact mean win with one Override + the usual bonus part
    ev_fs = ex["mean_win_one_override"] + bonus_rtp
    model.buy_prices[FEATURE_KEY] = float(round(ev_fs / TARGET_BUY_RTP, 1))
    print(f"Override Spin price {model.buy_prices[FEATURE_KEY]:.1f}x (RTP {ev_fs / model.buy_prices[FEATURE_KEY]:.3%})")
    # Bonus Hunt ante: fixed price; solve its own Override rate exactly so it returns TARGET_RTP
    model.override_weights[ANTE_KEY] = weights(0.0)
    exh = exact.base_game_exact(model, reel_key=ANTE_KEY)
    ph = np.array(exh["p_trigger"])
    bonus_h = float(ph @ np.array(evs[:3]))
    e0h, e1h = exh["rtp_no_override"], exh["mean_win_one_override"]
    q_h = (TARGET_RTP * ANTE_PRICE - bonus_h - e0h) / (e1h - e0h)
    if not 0 < q_h < 0.1:
        raise SystemExit(f"Bonus Hunt drop rate {q_h:.5f} is out of range: change the hunt reels")
    model.override_weights[ANTE_KEY] = weights(q_h)
    model.buy_prices[ANTE_KEY] = ANTE_PRICE
    exh = exact.base_game_exact(model, reel_key=ANTE_KEY)
    print(f"Bonus Hunt ({ANTE_PRICE:g}x bet): bonus odds 1 in {1 / ph[0]:,.0f} / {1 / ph[1]:,.0f} / "
          f"{1 / ph[2]:,.0f}, Override 1 in {1 / q_h:,.0f} spins, RTP "
          f"{(exh['rtp_base_ways'] + bonus_h) / ANTE_PRICE:.4%}")
    model.save(MODEL_PATH)
    print(f"Saved {MODEL_PATH}  ({time.perf_counter() - t0:.0f}s)")


if __name__ == "__main__":
    main()
